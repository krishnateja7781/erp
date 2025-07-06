
'use server';

import { db } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

// --- Student Dashboard Data ---
export interface StudentDashboardData {
  overallAttendance: number | null;
  coursesEnrolledCount: number | null;
  upcomingExam: { courseName: string; date: string } | null;
  feeDetails: { balance: number; dueDate: string | null };
}

export async function getStudentDashboardData(studentId: string): Promise<StudentDashboardData> {
  console.log(`Fetching dashboard data for student: ${studentId}`);
  
  const defaultData: StudentDashboardData = {
    overallAttendance: null,
    coursesEnrolledCount: null,
    upcomingExam: null,
    feeDetails: { balance: 0, dueDate: null },
  };

  try {
    const studentDoc = await db.collection('students').doc(studentId).get();
    if (!studentDoc.exists) {
      throw new Error(`Student profile with ID ${studentId} not found.`);
    }
    const studentData = studentDoc.data()!;
    const studentAuthUid = studentData.user_uid;

    if (!studentAuthUid) {
        console.warn(`Student profile for ${studentId} is missing its authentication link (user_uid). Some data may be unavailable.`);
    }

    // 1. Attendance (Resilient)
    try {
      const attendanceQuery = db.collection('attendance').where('studentId', '==', studentId);
      const attendanceSnap = await attendanceQuery.get();
      let totalClasses = 0;
      let presentClasses = 0;
      if (!attendanceSnap.empty) {
        totalClasses = attendanceSnap.size;
        presentClasses = attendanceSnap.docs.filter(doc => doc.data().status === 'Present').length;
      }
      defaultData.overallAttendance = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : null;
    } catch (e: any) {
        console.error(`Error fetching attendance for student ${studentId}:`, e.message);
        // overallAttendance remains null
    }

    // 2. Fees (Resilient)
    try {
        const feeDoc = await db.collection('fees').doc(studentId).get();
        if (feeDoc.exists) {
            const data = feeDoc.data()!;
            const balance = (data.totalFees || 0) - (data.amountPaid || 0);
            defaultData.feeDetails = {
                balance: balance,
                dueDate: data.dueDate ? data.dueDate.toDate().toLocaleDateString('en-CA') : null
            };
        }
    } catch (e: any) {
        console.error(`Error fetching fees for student ${studentId}:`, e.message);
        // feeDetails remains default
    }

    // 3. Exams (Resilient & CORRECTED)
    try {
        if (studentData.program && studentData.branch) {
            const examsQuery = db.collection('exams')
                .where('program', '==', studentData.program)
                .where('branch', '==', studentData.branch)
                .where('status', '==', 'Scheduled')
                .where('date', '>=', new Date().toISOString().split('T')[0])
                .orderBy('date', 'asc')
                .limit(1);
            
            const examSnap = await examsQuery.get();
            if (!examSnap.empty) {
                const examData = examSnap.docs[0].data();
                defaultData.upcomingExam = { courseName: examData.courseName, date: examData.date };
            }
        }
    } catch(e: any) {
        console.error(`Error fetching exams for student ${studentId}:`, e.message);
        // upcomingExam remains null
    }
    
    // 4. Enrolled Courses (Resilient)
    try {
        if (studentAuthUid) {
            const coursesQuery = db.collection('classes').where('studentUids', 'array-contains', studentAuthUid);
            const coursesSnap = await coursesQuery.get();
            defaultData.coursesEnrolledCount = coursesSnap.size;
        }
    } catch (e: any) {
        console.error(`Error fetching enrolled courses for student ${studentId}:`, e.message);
        // coursesEnrolledCount remains null
    }

    return defaultData;

  } catch (error: any) {
    console.error(`CRITICAL: Could not fetch student document for ${studentId}:`, error);
    throw new Error('Could not load student dashboard data.'); // Throw if main doc fails
  }
}


// --- Teacher Dashboard Data ---
export interface TeacherDashboardData {
    name: string | null;
    coursesTeaching: { id: string; name: string; studentCount: number; }[];
    upcomingClasses: { time: string; course: string; class: string; location: string; }[];
    pendingMarksCount: number;
}

export async function getTeacherDashboardData(teacherId: string): Promise<TeacherDashboardData> {
    const defaultData: TeacherDashboardData = {
        name: null,
        coursesTeaching: [],
        upcomingClasses: [],
        pendingMarksCount: 0
    };

    try {
        const teacherDoc = await db.collection('teachers').doc(teacherId).get();
        if (!teacherDoc.exists) {
            throw new Error("Teacher profile not found.");
        }
        const teacherData = teacherDoc.data()!;
        const teacherAuthUid = teacherData.user_uid;
        defaultData.name = teacherData.name;

        if (!teacherAuthUid) {
            console.warn(`Teacher profile ${teacherId} is missing auth UID.`);
            return defaultData; // Return default if no auth UID
        }

        let classIds: string[] = [];
        let classesData: FirebaseFirestore.DocumentData[] = [];

        // 1. Courses Teaching (Resilient)
        try {
            const classesQuery = db.collection('classes').where('teacherId', '==', teacherAuthUid);
            const classesSnap = await classesQuery.get();
            classIds = classesSnap.docs.map(doc => doc.id);
            classesData = classesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));

            const courseIds = [...new Set(classesData.map(c => c.courseId).filter(Boolean))];
            const courseMap = new Map();

            if (courseIds.length > 0) {
                 for (let i = 0; i < courseIds.length; i += 30) {
                    const chunk = courseIds.slice(i, i + 30);
                    const coursesSnap = await db.collection('courses').where(db.FieldPath.documentId(), 'in', chunk).get();
                    coursesSnap.forEach(doc => courseMap.set(doc.id, doc.data()));
                }
            }

            defaultData.coursesTeaching = classesData.map(data => {
                const courseDetails = courseMap.get(data.courseId) || { courseName: data.courseId };
                return {
                    id: data.id,
                    name: `${courseDetails.courseName} (${data.section})`,
                    studentCount: data.studentUids?.length || 0,
                };
            });
        } catch (e: any) {
            console.error(`Error fetching classes for teacher ${teacherId}:`, e.message);
        }
        
        // 2. Pending Marks (Resilient) - CORRECTED QUERY LOGIC
        try {
            if(classIds.length > 0) {
                let count = 0;
                // Firestore 'in' query supports up to 30 elements
                for (let i = 0; i < classIds.length; i += 30) {
                    const chunk = classIds.slice(i, i + 30);
                    const marksQuery = db.collection('marks').where('classId', 'in', chunk);
                    const marksSnap = await marksQuery.get();
                    marksSnap.forEach(doc => {
                        const data = doc.data();
                        if (data.totalMarks === null || typeof data.totalMarks === 'undefined') {
                            count++;
                        }
                    });
                }
                defaultData.pendingMarksCount = count;
            }
        } catch (e: any) {
            console.error(`Error fetching pending marks for teacher ${teacherId}:`, e.message);
        }
        
        // 3. Upcoming Classes (Resilient - currently mock data, so no real fetch)
        // This is complex. For this dashboard, we'll keep it simple and show today's schedule based on mock timetable data.
        // A full implementation would query a 'timetable' collection.
        defaultData.upcomingClasses = [];

        return defaultData;

    } catch (error: any) {
        console.error(`CRITICAL: Error fetching teacher document for ${teacherId}:`, error);
        throw new Error('Could not load teacher dashboard data.');
    }
}


// --- Admin Dashboard Data ---
export interface LoginEvent {
    id: string;
    timestamp: string;
    userRole: 'student' | 'teacher' | 'admin' | string;
    userName: string;
}

export interface AdminDashboardData {
  totalStudents: number;
  totalTeachers: number;
  totalPrograms: number;
  studentDistribution: { branch: string; count: number }[];
  feeCollection: { total: number; collected: number; };
  attendanceTrend: { month: string; attendance: number }[];
  recentLogins: LoginEvent[];
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
    const defaultData: AdminDashboardData = {
        totalStudents: 0,
        totalTeachers: 0,
        totalPrograms: 0,
        studentDistribution: [{ branch: 'N/A', count: 0 }],
        feeCollection: { total: 0, collected: 0 },
        attendanceTrend: [],
        recentLogins: [],
    };
    
    // Total Students (Resilient)
    try {
        const studentsSnap = await db.collection('students').count().get();
        defaultData.totalStudents = studentsSnap.data().count;
    } catch(e: any) { console.error('Error fetching student count:', e.message); }
    
    // Total Teachers (Resilient)
    try {
        const teachersSnap = await db.collection('teachers').count().get();
        defaultData.totalTeachers = teachersSnap.data().count;
    } catch(e: any) { console.error('Error fetching teacher count:', e.message); }

    // Student Distribution & Total Programs (Resilient)
    try {
        // For distribution, fetch a sample of students to avoid performance issues on large datasets
        const studentsDocsSnap = await db.collection('students').select('program', 'branch').limit(1000).get();
        const programs = new Set(studentsDocsSnap.docs.map(doc => doc.data().program));
        defaultData.totalPrograms = programs.size;
        
        const distributionMap = new Map<string, number>();
        studentsDocsSnap.forEach(doc => {
            const branch = doc.data().branch || "Unknown";
            distributionMap.set(branch, (distributionMap.get(branch) || 0) + 1);
        });
        const studentDistribution = Array.from(distributionMap, ([branch, count]) => ({ branch, count })).sort((a,b)=>b.count-a.count);
        if (studentDistribution.length > 0) {
            defaultData.studentDistribution = studentDistribution;
        }
    } catch(e: any) { console.error('Error fetching student distribution:', e.message); }
    
    // Fee Collection (Resilient)
    try {
        const feesSnap = await db.collection('fees').get();
        let totalFees = 0;
        let collectedFees = 0;
        feesSnap.forEach(doc => {
            const data = doc.data();
            totalFees += data.totalFees || 0;
            collectedFees += data.amountPaid || 0;
        });
        defaultData.feeCollection = { total: totalFees, collected: collectedFees };
    } catch(e: any) { console.error('Error fetching fee collection:', e.message); }

    // Attendance Trend (Resilient)
    try {
        const attendanceSnap = await db.collection('attendance').orderBy('date', 'desc').limit(5000).get(); // Limit for performance
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
        
        const sortedMonthKeys = Object.keys(attendanceByMonth).sort();

        defaultData.attendanceTrend = sortedMonthKeys.map(monthKey => {
            const data = attendanceByMonth[monthKey];
            const [year, month] = monthKey.split('-');
            const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'short' });
            return {
                month: monthName,
                attendance: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
            };
        }).slice(-6); // Get last 6 months
    } catch(e: any) { console.error('Error fetching attendance trend:', e.message); }

    // Recent Logins
    try {
        const loginActivitiesQuery = db.collection("loginActivities").orderBy("timestamp", "desc").limit(10);
        const loginSnap = await loginActivitiesQuery.get();
        defaultData.recentLogins = loginSnap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                timestamp: data.timestamp.toDate().toISOString(),
                userRole: data.userRole || 'unknown',
                userName: data.userName || 'Unknown User',
            };
        });
    } catch (e: any) { console.error('Error fetching recent logins:', e.message); }

    return defaultData;
}
