
'use server';

import { db, adminSDK } from '@/lib/firebaseAdmin';
import type { ScheduleEntry } from '@/components/shared/TimetableGrid';
import type { Teacher } from '@/lib/types';

export interface TimetableFilters {
    programs: string[];
    branches: Record<string, string[]>;
    years: string[];
    semesters: string[];
    sections: Record<string, string[]>; // program -> sections
}

export async function getTimetableFilters(): Promise<TimetableFilters> {
    const [studentsSnap, classesSnap] = await Promise.all([
        db.collection('students').select('program', 'branch', 'year', 'semester', 'section').get(),
        db.collection('classes').select('program', 'branch', 'year', 'semester', 'section').get()
    ]);

    const programs = new Set<string>();
    const branches: Record<string, Set<string>> = {};
    const years = new Set<string>();
    const semesters = new Set<string>();
    const sections: Record<string, Set<string>> = {};
    
    const processDoc = (doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>) => {
        const data = doc.data();
        if (data.program) {
            programs.add(data.program);

            if (!branches[data.program]) branches[data.program] = new Set();
            if(data.branch) branches[data.program].add(data.branch);

            if (!sections[data.program]) sections[data.program] = new Set();
            if (data.section) sections[data.program].add(data.section);
        }
        if (data.year) years.add(data.year.toString());
        if (data.semester) semesters.add(data.semester.toString());
    };
    
    studentsSnap.docs.forEach(processDoc);
    classesSnap.docs.forEach(processDoc);
    
    const branchesObject: Record<string, string[]> = {};
    for (const prog in branches) {
        branchesObject[prog] = Array.from(branches[prog]).sort();
    }
    
    const sectionsObject: Record<string, string[]> = {};
    for (const prog in sections) {
        sectionsObject[prog] = Array.from(sections[prog]).sort();
    }


    return {
        programs: Array.from(programs).sort(),
        branches: branchesObject,
        years: Array.from(years).sort((a, b) => parseInt(a) - parseInt(b)),
        semesters: Array.from(semesters).sort((a, b) => parseInt(a) - parseInt(b)),
        sections: sectionsObject,
    };
}


// --- SCHEDULE GENERATION ---

// Simple hash function to create a pseudo-random but deterministic number from a string
const simpleHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
};


interface ScheduleRequest {
    program: string;
    branch: string;
    semester: string;
    section: string;
}

export interface TeacherSchedule {
    teacher: Teacher;
    schedule: ScheduleEntry[];
}

export interface FullSchedule {
    studentSchedule: ScheduleEntry[];
    teacherSchedules: TeacherSchedule[];
}

export async function getScheduleForClass(filters: ScheduleRequest): Promise<FullSchedule> {
    const { program, branch, semester, section } = filters;
    const semesterNum = parseInt(semester);

    const classesSnap = await db.collection('classes')
        .where('program', '==', program)
        .where('branch', '==', branch)
        .where('semester', '==', semesterNum)
        .where('section', '==', section)
        .get();

    if (classesSnap.empty) {
        return { studentSchedule: [], teacherSchedules: [] };
    }

    const assignedClasses = classesSnap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            courseId: data.courseId,
            courseName: data.courseName,
            teacherId: data.teacherId,
        };
    });

    // Fetch all teacher details in one go
    const teacherIds = [...new Set(assignedClasses.map(c => c.teacherId).filter(Boolean))];
    const teacherMap = new Map<string, Teacher>();
    if (teacherIds.length > 0) {
        const teacherDocs = await db.collection('users').where('uid', 'in', teacherIds).get();
        teacherDocs.forEach(doc => {
            const data = doc.data();
            teacherMap.set(data.uid, {
                id: data.staffDocId || data.uid,
                uid: data.uid,
                name: data.name,
            } as Teacher);
        });
    }

    const days: ScheduleEntry['day'][] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const slotsPerDay = 6;
    
    // --- Generate Combined Student Schedule ---
    const studentSchedule: ScheduleEntry[] = [];
    const studentScheduleSlots = new Set<string>(); // "Day-Period"

    let classIndexForStudent = 0;
    for (const day of days) {
        for (let period = 1; period <= slotsPerDay; period++) {
            if (classIndexForStudent >= assignedClasses.length) break;
            
            const slotKey = `${day}-${period}`;
            if (studentScheduleSlots.has(slotKey)) continue;

            const course = assignedClasses[classIndexForStudent];
            const slotHash = simpleHash(`${course.id}-${day}-${period}`);
            
            const isScheduled = (slotHash % 10) < 4; // ~40% chance of a class

            if (isScheduled) {
                const teacherName = course.teacherId ? (teacherMap.get(course.teacherId)?.name || 'N/A') : 'N/A';
                studentSchedule.push({
                    day,
                    period: period as ScheduleEntry['period'],
                    courseCode: course.courseId,
                    courseName: course.courseName,
                    teacherName: teacherName,
                    class: `${program} ${branch} ${section}`,
                    location: `Room ${100 + (simpleHash(course.id) % 10) * 10 + period}`,
                    classId: course.id,
                });
                studentScheduleSlots.add(slotKey);
                classIndexForStudent++; // Move to the next class for variety
            }
        }
    }


    // --- Generate Individual Teacher Schedules (Non-overlapping for each teacher) ---
    const teacherSchedules: TeacherSchedule[] = [];
    for (const teacherId of teacherIds) {
        const teacher = teacherMap.get(teacherId);
        if (!teacher) continue;

        const teacherClassesForSection = assignedClasses.filter(c => c.teacherId === teacherId);
        const individualSchedule: ScheduleEntry[] = [];
        const teacherOccupiedSlots = new Set<string>(); // "Day-Period"
        
        let classIndexForTeacher = 0;
        for (const day of days) {
             for (let period = 1; period <= slotsPerDay; period++) {
                if(classIndexForTeacher >= teacherClassesForSection.length) break;
                
                const slotKey = `${day}-${period}`;
                if (teacherOccupiedSlots.has(slotKey)) continue;

                const course = teacherClassesForSection[classIndexForTeacher];
                 const slotHash = simpleHash(`${course.id}-${day}-${period}`);
                 const isScheduled = (slotHash % 10) < 3; // ~30% chance of a class
                
                if (isScheduled) {
                    individualSchedule.push({
                        day,
                        period: period as ScheduleEntry['period'],
                        courseCode: course.courseId,
                        courseName: course.courseName,
                        class: `${program} ${branch} ${section}`,
                        location: `Room ${200 + (simpleHash(course.id) % 10) * 10 + period}`,
                        classId: course.id,
                    });
                    teacherOccupiedSlots.add(slotKey);
                    classIndexForTeacher++; // Move to next class
                }
             }
        }
        teacherSchedules.push({ teacher, schedule: individualSchedule });
    }

    return { studentSchedule, teacherSchedules };
}
