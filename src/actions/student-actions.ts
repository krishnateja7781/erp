
'use server';
console.log("student-actions.ts: Module loading..."); 

import { auth, db, adminSDK } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp, Transaction } from 'firebase-admin/firestore';
import type { AddStudentFormValues as ClientAddStudentFormValues } from '@/components/admin/students/add-student-dialog';
import type { Student } from '@/lib/types';
import type { ScheduleEntry } from '@/components/shared/TimetableGrid';
import { generatePassword, getProgramCode, getBranchCode } from '@/lib/utils';

interface ServerAddStudentFormValues extends ClientAddStudentFormValues {
  firstName: string;
  lastName: string;
  email: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  program: string;
  branch: string;
  year: string; 
  semester: string; 
  batch: string;
  status: string;
  type: string;
  phone?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactAddress?: string;
}

interface ActionResult {
  success: boolean;
  error?: string;
  studentId?: string; 
  password?: string;
}

export async function getStudents(): Promise<Student[]> {
  console.log("Server Action: getStudents invoked correctly.");
  try {
    const studentsSnapshot = await db.collection('students').orderBy('name').get();
    if (studentsSnapshot.empty) {
      console.log("Server Action: getStudents - No student documents found.");
      return [];
    }
    const students: Student[] = studentsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id, 
        name: data.name || null,
        program: data.program || null,
        branch: data.branch || null,
        year: typeof data.year === 'number' ? data.year : null,
        semester: typeof data.semester === 'number' ? data.semester : null,
        section: data.section || null,
        batch: data.batch || null,
        status: data.status || null,
        type: data.type || null, 
        gender: data.gender || null,
        avatarUrl: data.avatarUrl || null,
        initials: data.initials || null,
        email: data.email || null,
        uid: data.user_uid || data.uid || null,
        collegeId: data.collegeId || null, 
        staffId: null,
        emergencyContact: data.emergencyContact ? {
            name: data.emergencyContact.name || null,
            phone: data.emergencyContact.phone || null,
            address: data.emergencyContact.address || null,
        } : null,
        dob: data.dob || null,
        phone: data.phone || null,
        address: data.address || null,
        hostelId: data.hostelId || null,
      };
    });
    console.log(`Server Action: getStudents - Successfully fetched and mapped ${students.length} students.`);
    return students;
  } catch (error: any) {
    console.error("Server Action Error in getStudents:", error);
    throw new Error("Failed to fetch students from server.");
  }
}

export async function createStudentAccount(values: ServerAddStudentFormValues): Promise<ActionResult> {
  console.log("Server Action: createStudentAccount invoked.");
  
  const {
      firstName, lastName, email, program, branch, year, dob,
      gender, semester, batch, status, type,
      phone, address,
      emergencyContactName, emergencyContactPhone, emergencyContactAddress
    } = values;

  let authUserUid: string | null = null;
  const newStudentDocRef = db.collection('students').doc(); 

  try {
    try {
      await auth.getUserByEmail(email);
      return { success: false, error: `The email address '${email}' is already registered.` };
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') throw error;
    }

    const generatedPassword = generatePassword(firstName, dob);
    if (!generatedPassword) {
      return { success: false, error: "Invalid Date of Birth provided. Could not generate password." };
    }
    
    const programCode = getProgramCode(program);
    const branchCode = getBranchCode(branch, program);
    let batchYearShort = "XX";
    const yearMatch = batch.match(/^\d{4}/);
    if (yearMatch) batchYearShort = yearMatch[0].substring(2);
    const idPrefix = `${programCode}${batchYearShort}${branchCode}`;

    const studentsQuery = db.collection('students')
        .where('program', '==', program)
        .where('branch', '==', branch)
        .where('batch', '==', batch);
        
    const snapshot = await studentsQuery.get();
    
    const existingSerials = new Set<number>();
    snapshot.docs.forEach(doc => {
        const existingCollegeId = doc.data().collegeId;
        if (existingCollegeId && existingCollegeId.startsWith(idPrefix)) {
            const serialMatch = existingCollegeId.substring(idPrefix.length);
            if (serialMatch) {
                const serialNum = parseInt(serialMatch, 10);
                if (!isNaN(serialNum)) {
                    existingSerials.add(serialNum);
                }
            }
        }
    });

    let newSequence = 1;
    while (existingSerials.has(newSequence)) {
        newSequence++;
    }
    
    const generatedCollegeId = `${idPrefix}${newSequence.toString().padStart(4, '0')}`;
    const sectionIndex = Math.floor((newSequence - 1) / 30);
    const generatedSection = String.fromCharCode(65 + sectionIndex);
    
    const authUserRecord = await auth.createUser({
        email, emailVerified: false, password: generatedPassword,
        displayName: `${firstName} ${lastName}`.trim(), disabled: false,
    });
    authUserUid = authUserRecord.uid;
    await auth.setCustomUserClaims(authUserUid, { role: 'student', college_id: generatedCollegeId, student_doc_id: newStudentDocRef.id });
    
    const batchWrite = db.batch();
    const currentTime = FieldValue.serverTimestamp();
    const studentName = `${firstName} ${lastName}`.trim();
    const studentInitials = studentName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '??';
    const studentAvatarUrl = `https://placehold.co/100x100.png?text=${studentInitials}`;

    const userProfileData = {
        uid: authUserUid, name: studentName, email, role: 'student', 
        collegeId: generatedCollegeId, studentDocId: newStudentDocRef.id,
        staffId: null, initials: studentInitials, avatarUrl: studentAvatarUrl, program, branch,
        year: parseInt(year, 10), section: generatedSection, createdAt: currentTime, updatedAt: currentTime,
    };
    batchWrite.set(db.collection('users').doc(authUserUid), userProfileData);

    const studentProfileData = {
        id: newStudentDocRef.id, 
        user_uid: authUserUid, collegeId: generatedCollegeId, name: studentName, email,
        program, branch, year: parseInt(year, 10), semester: parseInt(semester, 10),
        section: generatedSection, batch, dob, gender, phone: phone || null, address: address || null,
        avatarUrl: studentAvatarUrl, initials: studentInitials, status, type,
        emergencyContact: { name: emergencyContactName || null, phone: emergencyContactPhone || null, address: emergencyContactAddress || null },
        hostelId: null, roomNumber: null,
        createdAt: currentTime, updatedAt: currentTime,
    };
    batchWrite.set(newStudentDocRef, studentProfileData);

    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + 2);
    const feeProfileData = {
        studentDocId: newStudentDocRef.id, 
        studentCollegeId: generatedCollegeId,
        studentName, program, branch,
        totalFees: 150000, amountPaid: 0, balance: 150000, dueDate: Timestamp.fromDate(dueDate),
        paymentHistory: [], createdAt: currentTime, updatedAt: currentTime,
    };
    batchWrite.set(db.collection('fees').doc(newStudentDocRef.id), feeProfileData);
    
    await batchWrite.commit();

    return { success: true, studentId: generatedCollegeId, password: generatedPassword };

  } catch (error: any) {
    console.error("Server Action Error in createStudentAccount:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    if (authUserUid) await auth.deleteUser(authUserUid).catch(e => console.error("Failed to clean up orphaned auth user:", e));
    return { success: false, error: error.message || "An unexpected server error occurred." };
  }
}

export async function updateStudent(studentDocId: string, values: ClientAddStudentFormValues): Promise<ActionResult> {
    console.log(`Server Action: updateStudent invoked for doc ID: ${studentDocId}`);

    if (!studentDocId) return { success: false, error: "Student Document ID is missing." };

    const studentDocRef = db.collection('students').doc(studentDocId);
    
    try {
        await db.runTransaction(async (transaction) => {
            const studentDoc = await transaction.get(studentDocRef);
            if (!studentDoc.exists) throw new Error("Student not found.");
            
            const studentData = studentDoc.data()!;
            const userUid = studentData.user_uid;
            if (!userUid) throw new Error("Associated user account link is missing for this student.");

            const feeDocRef = db.collection('fees').doc(studentDocId);
            const userRef = db.collection('users').doc(userUid);
            const complaintsQuery = db.collection('complaints').where('studentId', '==', studentDocId);

            const [feeDocSnap, complaintsSnap] = await Promise.all([
                transaction.get(feeDocRef),
                transaction.get(complaintsQuery)
            ]);

            const newName = `${values.firstName} ${values.lastName}`.trim();
            let newCollegeId = studentData.collegeId;

            const hasProgramChanged = studentData.program !== values.program || studentData.branch !== values.branch || studentData.batch !== values.batch;
            
            if (hasProgramChanged) {
                console.log("Program/Branch/Batch has changed. Regenerating College ID.");
                const programCode = getProgramCode(values.program);
                const branchCode = getBranchCode(values.branch, values.program);
                const batchYearShort = values.batch.match(/^\d{4}/)?.[0].substring(2) || "XX";
                const idPrefix = `${programCode}${batchYearShort}${branchCode}`;
                
                const originalSerialMatch = studentData.collegeId.match(/\d+$/);
                const originalSerial = originalSerialMatch ? originalSerialMatch[0] : '0001';
                newCollegeId = `${idPrefix}${originalSerial}`;
            }

            const studentUpdateData = {
                name: newName,
                collegeId: newCollegeId,
                email: values.email,
                program: values.program,
                branch: values.branch,
                year: parseInt(values.year, 10),
                semester: parseInt(values.semester, 10),
                batch: values.batch,
                status: values.status,
                type: values.type,
                gender: values.gender,
                dob: values.dob,
                phone: values.phone || null,
                address: values.address || null,
                emergencyContact: {
                    name: values.emergencyContactName || null,
                    phone: values.emergencyContactPhone || null,
                    address: values.emergencyContactAddress || null,
                },
                updatedAt: FieldValue.serverTimestamp(),
            };
            transaction.update(studentDocRef, studentUpdateData);

            transaction.update(userRef, {
                name: newName,
                email: values.email,
                collegeId: newCollegeId,
                program: values.program,
                branch: values.branch,
                year: parseInt(values.year, 10),
                updatedAt: FieldValue.serverTimestamp(),
            });

            if (feeDocSnap.exists) {
                transaction.update(feeDocRef, {
                    studentName: newName,
                    studentCollegeId: newCollegeId,
                    program: values.program,
                    branch: values.branch,
                    updatedAt: FieldValue.serverTimestamp(),
                });
            }
            if (!complaintsSnap.empty) {
                complaintsSnap.forEach(doc => {
                    transaction.update(doc.ref, { studentName: newName, updatedAt: FieldValue.serverTimestamp() });
                });
            }
        });
        
        console.log(`Updated profile for student ${studentDocId}.`);
        
        return { success: true, message: "Student profile updated successfully." };

    } catch (error: any) {
        console.error(`Error updating student ${studentDocId}:`, error);
        return { success: false, error: error.message || "An unexpected server error occurred." };
    }
}


type DetailedLogEntry = {
  id: string;
  date: string;
  period: number;
  courseCode: string | null;
  courseName: string | null;
  status: "Present" | "Absent" | null;
};

type CourseSummary = {
  courseCode: string;
  courseName: string;
  attended: number;
  total: number;
};

type SemesterAttendance = {
  semester: number;
  courses: CourseSummary[];
};

export async function getStudentAttendanceDetails(studentDocId: string): Promise<{logs: DetailedLogEntry[], summary: SemesterAttendance[]}> {
    if (!studentDocId) return { logs: [], summary: [] };

    const attendanceQuery = db.collection('attendance').where('studentId', '==', studentDocId);
    const attendanceSnap = await attendanceQuery.get();
    
    const logs: DetailedLogEntry[] = attendanceSnap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            date: data.date.toDate().toISOString().split('T')[0],
            period: data.period,
            courseCode: data.courseCode,
            courseName: data.courseName || 'N/A',
            status: data.status,
        };
    });

    const summaryByCourse: Record<string, { attended: number, total: number, name: string, semester: number }> = {};
    logs.forEach(log => {
        if (log.courseCode) {
            if (!summaryByCourse[log.courseCode]) {
                summaryByCourse[log.courseCode] = { attended: 0, total: 0, name: log.courseName || log.courseCode, semester: 0 };
            }
            summaryByCourse[log.courseCode].total++;
            if (log.status === 'Present') {
                summaryByCourse[log.courseCode].attended++;
            }
        }
    });

    const studentDoc = await db.collection('students').doc(studentDocId).get();
    const currentSemester = studentDoc.exists ? studentDoc.data()?.semester : 1;


    const semesterSummary: SemesterAttendance = {
        semester: currentSemester,
        courses: Object.entries(summaryByCourse).map(([code, data]) => ({
            courseCode: code,
            courseName: data.name,
            attended: data.attended,
            total: data.total
        }))
    };
    
    return { logs, summary: [semesterSummary] };
}

export type StudentPerformanceData = {
    marksData: { subject: string; internals: number; externals: number; total: number, credits: number }[];
    attendanceData: { month: string; percentage: number }[];
};

export async function getStudentPerformanceData(studentDocId: string): Promise<StudentPerformanceData> {
    const marksQuery = db.collection('marks').where('studentId', '==', studentDocId);
    const marksSnap = await marksQuery.get();
    const marksData = marksSnap.docs.map(doc => {
        const data = doc.data();
        return {
            subject: data.courseCode,
            internals: data.internalsMarks || 0,
            externals: data.externalsMarks || 0,
            total: data.totalMarks || 0,
            credits: data.credits || 0,
        };
    });

    const attendanceQuery = db.collection('attendance').where('studentId', '==', studentDocId).orderBy('date', 'desc');
    const attendanceSnap = await attendanceQuery.get();
    
    const attendanceByMonth: { [key: string]: { total: number; present: number } } = {};
    
    attendanceSnap.forEach(doc => {
        const data = doc.data();
        const date = data.date.toDate();
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!attendanceByMonth[monthKey]) {
            attendanceByMonth[monthKey] = { total: 0, present: 0 };
        }
        attendanceByMonth[monthKey].total++;
        if (data.status === 'Present') {
            attendanceByMonth[monthKey].present++;
        }
    });
    
    const attendanceTrend = Object.entries(attendanceByMonth).map(([monthKey, data]) => {
        const [year, month] = monthKey.split('-');
        const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'short' });
        return {
            month: monthName,
            percentage: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
        };
    }).slice(0, 6).reverse();

    return { marksData, attendanceData: attendanceTrend };
}

export async function getStudentEnrolledCourses(studentDocId: string): Promise<{id: string; courseId: string; courseName: string; teacherId: string;}[]> {
    if (!studentDocId) return [];
    
    const studentDoc = await db.collection('students').doc(studentDocId).get();
    if (!studentDoc.exists) return [];
    const studentUid = studentDoc.data()!.user_uid;

    if (!studentUid) {
        console.warn(`Student with doc ID ${studentDocId} does not have a linked auth UID. Cannot fetch enrolled courses.`);
        return [];
    }

    const classesSnap = await db.collection('classes').where('studentUids', 'array-contains', studentUid).get();
    if (classesSnap.empty) return [];
    
    const classes = classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const courseIds = [...new Set(classes.map(c => c.courseId).filter(Boolean))];

    if (courseIds.length === 0) return [];

    const courseMap = new Map();
    for (let i = 0; i < courseIds.length; i += 30) {
        const chunk = courseIds.slice(i, i + 30);
        const coursesSnap = await db.collection('courses').where(adminSDK.firestore.FieldPath.documentId(), 'in', chunk).get();
        coursesSnap.forEach(doc => courseMap.set(doc.id, doc.data()));
    }

    const courses = classes.map(c => {
        const courseData = courseMap.get(c.courseId);
        if (!courseData) return null;
        return {
            id: c.id,
            courseId: c.courseId,
            courseName: courseData.courseName || 'Unnamed Course',
            teacherId: c.teacherId,
        };
    }).filter((c): c is {id: string; courseId: string; courseName: string; teacherId: string;} => c !== null);
    
    return courses;
}

const simpleHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return Math.abs(hash);
};

export async function getStudentSchedule(studentDocId: string): Promise<ScheduleEntry[]> {
    if (!studentDocId) return [];
    
    console.log(`Generating deterministic schedule for student doc ID ${studentDocId}...`);

    const enrolledCourses = await getStudentEnrolledCourses(studentDocId);
    if (enrolledCourses.length === 0) return [];

    const teacherIds = [...new Set(enrolledCourses.map(c => c.teacherId).filter(Boolean))];
    const teacherMap = new Map<string, string>();
    if (teacherIds.length > 0) {
        for (let i = 0; i < teacherIds.length; i += 30) {
            const chunk = teacherIds.slice(i, i + 30);
            const teachersSnap = await db.collection('teachers').where('user_uid', 'in', chunk).get();
            teachersSnap.forEach(doc => {
                teacherMap.set(doc.data().user_uid, doc.data().name);
            });
        }
    }
    
    const schedule: ScheduleEntry[] = [];
    const slotsPerDay = 6;
    const days: ScheduleEntry['day'][] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    let classIndex = simpleHash(studentDocId) % enrolledCourses.length;

    for (const day of days) {
        for (let period = 1; period <= slotsPerDay; period++) {
            const course = enrolledCourses[classIndex];
            const slotHash = simpleHash(`${course.id}-${day}-${period}`);
            
            const isScheduled = (slotHash % 10) < 4;
            const previousPeriodEntry = schedule.find(s => s.day === day && s.period === period - 1);
            
            if (isScheduled && previousPeriodEntry?.courseCode !== course.courseId) {
                schedule.push({
                    day,
                    period: period as ScheduleEntry['period'],
                    courseCode: course.courseId,
                    courseName: course.courseName,
                    teacherName: teacherMap.get(course.teacherId) || 'N/A',
                    class: "Your Class", 
                    location: `Room ${200 + (simpleHash(course.id) % 10) * 10 + period}`,
                    classId: course.id,
                });
                classIndex = (classIndex + 1) % enrolledCourses.length;
            }
        }
    }
    return schedule;
}


const getGradePoint = (grade: string | null): number | null => {
    if (!grade) return null;
    switch (grade.toUpperCase()) {
        case 'O': return 10; case 'A+': return 9; case 'A': return 8; case 'B+': return 7;
        case 'B': return 6; case 'C+': return 5; case 'C': return 4; case 'P': return 3;
        case 'FAIL': case 'F': return 0;
        default: return null; 
    }
};

const calculateCGPA = (marksData: { grade: string | null; credits: number | null }[]): number | null => {
    let totalCreditPoints = 0;
    let totalCreditsAttempted = 0;

    marksData.forEach(mark => {
        if (mark.credits && typeof mark.credits === 'number' && mark.credits > 0) {
            const gradePoint = getGradePoint(mark.grade);
            if (gradePoint !== null) {
                totalCreditPoints += gradePoint * mark.credits;
                totalCreditsAttempted += mark.credits;
            }
        }
    });

    if (totalCreditsAttempted === 0) return null;
    return parseFloat((totalCreditPoints / totalCreditsAttempted).toFixed(2));
};

export interface FullStudentData {
    profile: Student;
    attendance: { overallPercentage: number | null; recentAbsences: number | null; };
    marks: { cgpa: number | null; recentGrades: { course: string; grade: string; }[]; };
    fees: { totalFees: number | null; amountPaid: number | null; remainingBalance: number | null; dueDate: string | null; status: string | null; };
    hostelInfo: { hostelName: string | null; roomNumber: string | null; } | null;
    coursesEnrolled: (string | null)[];
}

export async function getStudentProfileDetails(studentDocId: string): Promise<FullStudentData | null> {
    if (!studentDocId) return null;

    const studentDocRef = db.collection("students").doc(studentDocId);
    const studentDocSnap = await studentDocRef.get();

    if (!studentDocSnap.exists) {
        console.error(`No student found with doc ID: ${studentDocId}`);
        return null;
    }
    const studentData = studentDocSnap.data()!;

    const profile: Student = {
        id: studentDocSnap.id,
        collegeId: studentData.collegeId || '[Not Assigned]',
        name: studentData.name || '[Name Not Set]',
        program: studentData.program || '[Not Assigned]',
        branch: studentData.branch || '[Not Assigned]',
        year: studentData.year || null,
        semester: studentData.semester || null,
        section: studentData.section || 'N/A',
        batch: studentData.batch || 'N/A',
        gender: studentData.gender || null,
        email: studentData.email || '[Not Provided]',
        phone: studentData.phone || '[Not Provided]',
        address: studentData.address || '[Not Provided]',
        dob: studentData.dob || null,
        avatarUrl: studentData.avatarUrl || null,
        initials: studentData.initials || '??',
        status: studentData.status || 'Unknown',
        type: studentData.type || 'Unknown',
        staffId: null,
        uid: studentData.user_uid || null,
        emergencyContact: studentData.emergencyContact || { name: null, phone: null, address: null },
        hostelId: studentData.hostelId || null,
    };

    let hostelInfo: FullStudentData['hostelInfo'] = null;
    if (profile.type === 'Hosteler' && profile.hostelId && profile.hostelId !== 'N/A') {
        const hostelDocSnap = await db.collection('hostels').doc(profile.hostelId).get();
        if (hostelDocSnap.exists) {
            hostelInfo = {
                hostelName: hostelDocSnap.data()?.name || 'N/A',
                roomNumber: studentData.roomNumber || 'N/A',
            };
        }
    }

    let fees: FullStudentData['fees'] = { totalFees: null, amountPaid: null, remainingBalance: null, dueDate: null, status: null };
    const feeDoc = await db.collection("fees").doc(studentDocId).get();
    if (feeDoc.exists) {
        const feeData = feeDoc.data()!;
        const balance = (feeData.totalFees || 0) - (feeData.amountPaid || 0);
        let dueDateString: string | null = null;
        let feeStatus: string | null = 'Pending';
        if (feeData.dueDate && typeof feeData.dueDate.toDate === 'function') {
            const dueDateObj = feeData.dueDate.toDate();
            dueDateString = dueDateObj.toLocaleDateString('en-CA');
            if (balance > 0 && new Date() > dueDateObj) feeStatus = 'Overdue';
        }
        if (balance <= 0) feeStatus = 'Paid';
        fees = { totalFees: feeData.totalFees || 0, amountPaid: feeData.amountPaid || 0, remainingBalance: balance, dueDate: dueDateString, status: feeStatus };
    }

    const coursesEnrolled = (await getStudentEnrolledCourses(studentDocId)).map(c => c.courseName);
    
    const marksSnap = await db.collection('marks').where('studentId', '==', studentDocId).get();
    const allMarksData = marksSnap.docs.map(doc => {
        const d = doc.data();
        return { subject: d.courseCode, total: d.totalMarks, grade: d.grade || null, credits: d.credits || null };
    });
    const marks = {
        cgpa: calculateCGPA(allMarksData),
        recentGrades: allMarksData.slice(-3).map(m => ({ course: m.subject || 'N/A', grade: m.grade || 'N/A' }))
    };
    
    const attendanceSnap = await db.collection('attendance').where('studentId', '==', studentDocId).get();
    const totalClasses = attendanceSnap.size;
    const attendance = {
        overallPercentage: totalClasses > 0 ? Math.round((attendanceSnap.docs.filter(d => d.data().status === 'Present').length / totalClasses) * 100) : null,
        recentAbsences: null,
    };

    return { profile, attendance, marks, fees, hostelInfo, coursesEnrolled };
}

export async function getStudentProfileForTeacher(
  studentDocId: string,
  teacherUid: string
): Promise<{ data: FullStudentData | null; error: string | null }> {
  try {
    // 1. Get all classes taught by the teacher
    const classesSnap = await db.collection('classes').where('teacherId', '==', teacherUid).get();
    if (classesSnap.empty) {
      return { data: null, error: "You are not assigned to any classes." };
    }

    // 2. Get the student document to check their details
    const studentDoc = await db.collection('students').doc(studentDocId).get();
    if (!studentDoc.exists) {
      return { data: null, error: "Student not found." };
    }
    const studentData = studentDoc.data()!;
    
    // 3. Check if the teacher teaches this student's section
    const isTeacherTeachingThisSection = classesSnap.docs.some(doc => {
        const classData = doc.data();
        return classData.program === studentData.program && 
               classData.branch === studentData.branch && 
               classData.section === studentData.section;
    });

    if (!isTeacherTeachingThisSection) {
      return { data: null, error: "You do not have permission to view this student's profile as you do not teach their section." };
    }
    
    // 4. If authorized, fetch the full details
    const fullDetails = await getStudentProfileDetails(studentDocId);
    if (!fullDetails) {
        return { data: null, error: "Could not retrieve student details after authorization." };
    }
    return { data: fullDetails, error: null };

  } catch (error: any) {
    console.error("Error in getStudentProfileForTeacher:", error);
    return { data: null, error: "An unexpected error occurred while verifying access." };
  }
}


export type BacklogEntry = {
    courseCode: string | null;
    courseName: string | null;
    semesterAttempted: number | null;
    status: 'Active' | 'Cleared' | null;
    gradeAchieved: string | null;
};
export async function fetchStudentBacklogs(studentDocId: string): Promise<BacklogEntry[]> {
    const snapshot = await db.collection("backlogs").where("studentId", "==", studentDocId).get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => doc.data() as BacklogEntry);
}

// Helper function to delete documents in a collection that match a query
async function deleteQueryBatch(query: adminSDK.firestore.Query, batch: adminSDK.firestore.WriteBatch) {
    const snapshot = await query.get();
    if (!snapshot.empty) {
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
    }
}

export async function deleteStudent(studentDocId: string): Promise<ActionResult> {
  console.log(`Server Action: deleteStudent invoked for doc ID: ${studentDocId}`);
  if (!studentDocId) return { success: false, error: "Student Document ID is required." };

  const studentRef = db.collection('students').doc(studentDocId);

  try {
    const studentDoc = await studentRef.get();
    if (!studentDoc.exists) {
        return { success: false, error: "Student not found." };
    }
  
    const studentData = studentDoc.data()!;
    const userUid = studentData.user_uid;

    const batch = db.batch();

    // 1. Delete associated data
    await deleteQueryBatch(db.collection('marks').where('studentId', '==', studentDocId), batch);
    await deleteQueryBatch(db.collection('attendance').where('studentId', '==', studentDocId), batch);
    await deleteQueryBatch(db.collection('backlogs').where('studentId', '==', studentDocId), batch);
    await deleteQueryBatch(db.collection('complaints').where('studentId', '==', studentDocId), batch);
    if (userUid) {
        await deleteQueryBatch(db.collection('applications').where('studentUid', '==', userUid), batch);
        await deleteQueryBatch(db.collection('notifications').where('recipientUid', '==', userUid), batch);
    }
    
    // 2. Un-allocate from hostel if applicable
    if (studentData.hostelId && studentData.roomNumber) {
        const hostelRef = db.collection('hostels').doc(studentData.hostelId);
        const hostelDoc = await hostelRef.get();
        if (hostelDoc.exists) {
            const hostelData = hostelDoc.data()!;
            const updatedRooms = hostelData.rooms.map((room: any) => {
                if (room.roomNumber === studentData.roomNumber) {
                    return {
                        ...room,
                        residents: room.residents.filter((res: any) => res.studentId !== studentDocId)
                    };
                }
                return room;
            });
            batch.update(hostelRef, { rooms: updatedRooms });
        }
    }

    // 3. Remove student's UID from any classes they were in
    if(userUid) {
        const classesSnap = await db.collection('classes').where('studentUids', 'array-contains', userUid).get();
        if (!classesSnap.empty) {
            classesSnap.docs.forEach(doc => {
                batch.update(doc.ref, { studentUids: FieldValue.arrayRemove(userUid) });
            });
        }
    }

    // 4. Delete core documents
    batch.delete(studentRef);
    batch.delete(db.collection('fees').doc(studentDocId));
    if (userUid) {
      batch.delete(db.collection('users').doc(userUid));
    }
    
    await batch.commit();

    // 5. Delete Firebase Auth user (done last)
    if (userUid) {
        await auth.deleteUser(userUid).catch(e => console.error(`Failed to delete auth user ${userUid}, but Firestore data was cleaned. Manual cleanup required.`, e));
    }
    
    console.log(`Successfully deleted student ${studentDocId} and all associated data.`);
    return { success: true, message: `Student ${studentData.name} and all associated data have been permanently deleted.` };

  } catch (error: any) {
    console.error(`Error deleting student doc ID ${studentDocId}:`, error);
    return { success: false, error: error.message || "An unexpected error occurred during deletion." };
  }
}


export async function getSectionsForBranch(program: string, branch: string): Promise<string[]> {
    try {
        const studentsQuery = db.collection('students')
            .where('program', '==', program)
            .where('branch', '==', branch)
            .select('section');
        
        const studentsSnap = await studentsQuery.get();
        if (studentsSnap.empty) {
            return [];
        }
        
        const sections = new Set<string>();
        studentsSnap.docs.forEach(doc => {
            const section = doc.data().section;
            if (section) {
                sections.add(section);
            }
        });
        
        return Array.from(sections).sort();

    } catch (error: any) {
        console.error("Error fetching sections for branch:", error);
        return [];
    }
}

export async function getStudentsForSection(program: string, branch: string, section: string): Promise<Student[]> {
    try {
        const studentsQuery = db.collection('students')
            .where('program', '==', program)
            .where('branch', '==', branch)
            .where('section', '==', section);
            
        const studentsSnap = await studentsQuery.get();
        if (studentsSnap.empty) {
            return [];
        }
        
        const students: Student[] = studentsSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id, 
            name: data.name || null,
            collegeId: data.collegeId || null,
            program: data.program || null,
            branch: data.branch || null,
            year: typeof data.year === 'number' ? data.year : null,
            semester: typeof data.semester === 'number' ? data.semester : null,
            section: data.section || null,
            batch: data.batch || null,
            status: data.status || null,
            type: data.type || null, 
            gender: data.gender || null,
            avatarUrl: data.avatarUrl || null,
            initials: data.initials || null,
            email: data.email || null,
            uid: data.user_uid || data.uid || null,
            staffId: null,
            emergencyContact: data.emergencyContact ? {
                name: data.emergencyContact.name || null,
                phone: data.emergencyContact.phone || null,
                address: data.emergencyContact.address || null,
            } : null,
            dob: data.dob || null,
            phone: data.phone || null,
            address: data.address || null,
            hostelId: data.hostelId || null,
          };
        });
        
        return students.sort((a,b) => (a.name || '').localeCompare(b.name || ''));

    } catch (error: any) {
        console.error("Error fetching students for section:", error);
        return [];
    }
}
