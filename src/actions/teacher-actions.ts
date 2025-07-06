
'use server';

import { db, adminSDK } from '@/lib/firebaseAdmin';
import type { ScheduleEntry } from '@/components/shared/TimetableGrid';

// --- Types ---
type TeacherClass = {
  id: string;
  courseCode: string;
  courseName: string;
  class: string; // e.g., CSE-A
  semester: number;
  credits: number;
};

export type StudentForClass = {
  id: string; // The doc ID
  name: string;
  collegeId: string | null; // The human-readable ID
};

export type MarksEntry = {
    recordId: string;
    studentId: string;
    internals: number | null;
    externals: number | null;
    total: number | null;
    grade: string | null;
};

export type TeacherClassWithStudents = {
    classInfo: TeacherClass;
    students: StudentForClass[];
};


// --- Actions ---

export async function getTeacherClasses(teacherId: string): Promise<TeacherClass[]> {
  try {
    const classesQuery = db.collection('classes').where('teacherId', '==', teacherId);
    const snapshot = await classesQuery.get();
    if (snapshot.empty) return [];

    const classes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const courseIds = [...new Set(classes.map(c => c.courseId).filter(Boolean))];

    if (courseIds.length === 0) return [];

    const courseMap = new Map();
    for (let i = 0; i < courseIds.length; i += 30) {
        const chunk = courseIds.slice(i, i + 30);
        const coursesSnap = await db.collection('courses').where(adminSDK.firestore.FieldPath.documentId(), 'in', chunk).get();
        coursesSnap.forEach(doc => courseMap.set(doc.id, doc.data()));
    }

    const finalClasses: TeacherClass[] = classes.map(c => {
        const courseData = courseMap.get(c.courseId);
        if (!courseData) return null;

        return {
            id: c.id,
            courseCode: c.courseId,
            courseName: courseData.courseName,
            class: `${c.program}-${c.branch} (${c.section})`,
            semester: c.semester,
            credits: courseData.credits,
        };
    }).filter((c): c is TeacherClass => c !== null);

    return finalClasses;
  } catch (error) {
    console.error("Error fetching teacher classes:", error);
    throw new Error("Could not retrieve assigned classes.");
  }
}


export async function getStudentsForClass(classId: string): Promise<StudentForClass[]> {
  try {
    const classDoc = await db.collection('classes').doc(classId).get();
    if (!classDoc.exists) {
      console.warn(`Class with ID ${classId} not found.`);
      return [];
    }
    
    const classData = classDoc.data()!;
    const { program, year, section } = classData;

    if (!program || !year || !section) {
        console.warn(`Class document ${classId} is missing program, year, or section.`);
        return [];
    }
    
    // Dynamic query based on class properties. This is more reliable than a stale studentUids array.
    const studentsQuery = db.collection('students')
        .where('program', '==', program)
        .where('year', '==', year)
        .where('section', '==', section)
        .where('status', '==', 'Active');
        
    const studentsSnap = await studentsQuery.get();
    
    if (studentsSnap.empty) {
        return [];
    }

    const students: StudentForClass[] = studentsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        collegeId: data.collegeId || null
      };
    });

    return students.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error: any) {
    console.error(`Error fetching students for class ${classId}:`, error);
    if (error.code === 'failed-precondition' || (error.message && error.message.toLowerCase().includes('index'))) {
        throw new Error("A required database index is missing to fetch student rosters. Please check your Firebase console for index creation prompts or contact an administrator.");
    }
    throw new Error("Could not retrieve students for the class.");
  }
}

export async function getStudentsByClassForTeacher(teacherId: string): Promise<TeacherClassWithStudents[]> {
  try {
    const teacherClasses = await getTeacherClasses(teacherId);
    if (teacherClasses.length === 0) {
      return [];
    }

    const result: TeacherClassWithStudents[] = [];

    for (const classInfo of teacherClasses) {
      const students = await getStudentsForClass(classInfo.id);
      result.push({
        classInfo,
        students,
      });
    }

    return result;
  } catch (error) {
    console.error(`Error fetching students for teacher ${teacherId}:`, error);
    throw new Error("Could not retrieve students for your classes.");
  }
}

export async function getMarksForClass(classId: string): Promise<{ studentId: string; marks: MarksEntry }[]> {
  try {
    if (!classId) return [];
    
    const marksQuery = db.collection('marks').where('classId', '==', classId);
    const snapshot = await marksQuery.get();

    if (snapshot.empty) {
        return [];
    }

    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            studentId: data.studentId,
            marks: {
                recordId: doc.id,
                studentId: data.studentId,
                internals: data.internalsMarks ?? null,
                externals: data.externalsMarks ?? null,
                total: data.totalMarks ?? null,
                grade: data.grade ?? null,
            }
        };
    });
  } catch (error) {
    console.error(`Error fetching marks for class ${classId}:`, error);
    throw new Error("Could not retrieve existing marks.");
  }
}

export async function getAttendanceForSlot(classId: string, date: string, period: number): Promise<Record<string, 'Present' | 'Absent' | null>> {
    try {
        const attendanceSnaps = await db.collection('attendance')
            .where('classId', '==', classId)
            .where('date', '==', new Date(date))
            .where('period', '==', period)
            .get();

        if (attendanceSnaps.empty) {
            return {};
        }

        const records: Record<string, 'Present' | 'Absent' | null> = {};
        attendanceSnaps.forEach(doc => {
            const data = doc.data();
            records[data.studentId] = data.status;
        });
        return records;
    } catch (error) {
        console.error(`Error fetching attendance for slot ${classId}-${date}-${period}:`, error);
        throw new Error("Could not fetch existing attendance for this slot.");
    }
}

const simpleHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
};


export async function getTeacherSchedule(teacherId: string): Promise<ScheduleEntry[]> {
    if (!teacherId) return [];
    
    console.log(`Generating deterministic schedule for teacher ${teacherId}...`);

    try {
        const assignedClasses = await getTeacherClasses(teacherId);
        if (assignedClasses.length === 0) return [];

        const schedule: ScheduleEntry[] = [];
        const slotsPerDay = 6;
        const days: ScheduleEntry['day'][] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        
        let classIndex = simpleHash(teacherId) % assignedClasses.length;

        for (const day of days) {
            for (let period = 1; period <= slotsPerDay; period++) {
                const course = assignedClasses[classIndex];
                const slotHash = simpleHash(`${course.id}-${day}-${period}`);
                
                const isScheduled = (slotHash % 10) < 4; 
                const previousPeriodEntry = schedule.find(s => s.day === day && s.period === period - 1);
                
                if (isScheduled && previousPeriodEntry?.courseCode !== course.courseCode) {
                    schedule.push({
                        day,
                        period: period as ScheduleEntry['period'],
                        courseCode: course.courseCode,
                        courseName: course.courseName,
                        class: course.class,
                        location: `Room ${100 + (simpleHash(course.id) % 10) * 10 + period}`,
                        classId: course.id,
                    });
                    classIndex = (classIndex + 1) % assignedClasses.length;
                }
            }
        }
        return schedule;
    } catch(err) {
        console.error("Could not generate teacher schedule:", err);
        return [];
    }
};
