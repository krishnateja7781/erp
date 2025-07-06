
'use server';

import { db, adminSDK } from '@/lib/firebaseAdmin';
import type { ExamSchedule, ExamStatus, HallTicketData, HallTicketExam } from '@/lib/types';
import { createNotificationsForUids } from './notification-actions';

interface ActionResult {
    success: boolean;
    error?: string;
    message?: string;
}

export async function getExamSchedules(): Promise<ExamSchedule[]> {
    try {
        const snapshot = await db.collection('exams').orderBy('date', 'desc').limit(200).get();
        if (snapshot.empty) return [];
        
        const schedules: ExamSchedule[] = [];
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            // Defensive check to ensure all required fields are present before mapping
            if (data.program && data.branch && data.year && data.semester && data.courseCode && data.date && data.startTime && data.endTime && data.status) {
                 schedules.push({
                    id: doc.id,
                    program: data.program,
                    branch: data.branch,
                    year: data.year,
                    semester: data.semester,
                    courseCode: data.courseCode,
                    courseName: data.courseName || 'N/A',
                    examSessionName: data.examSessionName || null,
                    date: data.date, 
                    startTime: data.startTime,
                    endTime: data.endTime,
                    status: data.status,
                    credits: data.credits || null,
                });
            } else {
                console.warn(`Skipping malformed exam document with ID: ${doc.id}`);
            }
        });
        
        return schedules;

    } catch (error: any) {
        console.error("Critical error in getExamSchedules:", error);
        if (error.code === 'failed-precondition' || (error.message && error.message.toLowerCase().includes('index'))) {
            throw new Error("A required database index is missing or still being built for sorting exams by date (`date` DESC). Please check your Firebase console's Firestore section for index creation prompts or try again in a few minutes.");
        }
        throw new Error("A critical server error occurred while fetching exam schedules.");
    }
}


export async function saveExamSchedule(schedule: Omit<ExamSchedule, 'id'> | ExamSchedule): Promise<ActionResult> {
    try {
        const { courseName, credits, ...dataToSave } = schedule as any; // Exclude denormalized fields
        
        if ('id' in dataToSave && dataToSave.id) {
            // Update existing schedule
            const { id, ...updateData } = dataToSave;
            await db.collection('exams').doc(id).set(updateData, { merge: true });
            return { success: true, message: `Exam schedule for ${dataToSave.courseCode} updated.` };
        } else {
            // Add new schedule
            const docRef = await db.collection('exams').add(dataToSave);
            return { success: true, message: `Exam schedule for ${dataToSave.courseCode} added with ID ${docRef.id}.` };
        }
    } catch (error: any) {
        console.error("Error saving exam schedule:", error);
        return { success: false, error: "Failed to save exam schedule." };
    }
}


const getAcademicYear = (semester: number, program: string = "B.Tech"): number => {
    if (program === "B.Tech") { if (semester >= 1 && semester <= 2) return 1; if (semester >= 3 && semester <= 4) return 2; if (semester >= 5 && semester <= 6) return 3; if (semester >= 7 && semester <= 8) return 4; }
    if (program === "MBA") { if (semester >= 1 && semester <= 2) return 1; if (semester >= 3 && semester <= 4) return 2; }
    return Math.ceil(semester / 2);
};

interface ScheduleAndHallTicketPayload {
    filters: { program: string; branch: string; year: string; semester: string; };
    exams: { courseCode: string; courseName: string; date: string; startTime: string; endTime: string; credits?: number; }[];
    hallTicketData: {
        examSessionName: string;
        instructions: string;
        controllerSignaturePlaceholder: string;
        minAttendance: number;
        maxDues: number;
    }
}

export async function scheduleExamsAndSetupHallTickets(payload: ScheduleAndHallTicketPayload): Promise<ActionResult> {
    const { filters, exams, hallTicketData } = payload;
    if (!filters || exams.length === 0 || !hallTicketData) {
        return { success: false, error: 'Missing filter, exam, or hall ticket data.' };
    }
    
    // --- SERVER-SIDE VALIDATION ---
    const sessionName = hallTicketData.examSessionName?.trim();
    if (!sessionName) {
        return { success: false, error: 'Exam Session Name is a required field. Please go back and select a session type.' };
    }

    try {
        const batch = db.batch();
        const semesterNum = parseInt(filters.semester, 10);
        const yearNum = parseInt(filters.year, 10);
        
        // --- 1. Save Exam Documents ---
        const courseIds = exams.map(exam => exam.courseCode);
        const coursesSnapshot = await db.collection('courses').where(adminSDK.firestore.FieldPath.documentId(), 'in', courseIds).get();
        const courseMap = new Map(coursesSnapshot.docs.map(doc => [doc.id, doc.data()]));
        
        exams.forEach(exam => {
            const courseDetails = courseMap.get(exam.courseCode);
            const newExamRef = db.collection('exams').doc();
            
            const examData = {
                courseCode: exam.courseCode,
                courseName: courseDetails?.courseName || exam.courseName,
                credits: exam.credits ?? courseDetails?.credits ?? null,
                date: exam.date,
                startTime: exam.startTime,
                endTime: exam.endTime,
                program: filters.program,
                branch: filters.branch,
                semester: semesterNum,
                year: yearNum,
                status: 'Scheduled' as ExamStatus,
                examSessionName: sessionName, // Use validated session name
            };
            batch.set(newExamRef, examData);
        });

        // --- 2. Generate Hall Tickets ---
        const studentsSnapshot = await db.collection('students')
            .where('program', '==', filters.program)
            .where('branch', '==', filters.branch)
            .where('year', '==', yearNum)
            .get();

        if (studentsSnapshot.empty) {
            await batch.commit(); // Commit the exam schedule even if no students are found
            return { success: true, message: `Successfully scheduled ${exams.length} exams. No eligible students found for hall ticket generation in Year ${yearNum}.` };
        }
        
        const academicYearForExams = getAcademicYear(semesterNum, filters.program);
        const hallTicketExams: HallTicketExam[] = exams.map((exam, index) => ({
             id: `HT_EXAM_${exam.courseCode}_${index}`,
             program: filters.program,
             branch: filters.branch,
             year: academicYearForExams,
             semester: semesterNum,
             courseCode: exam.courseCode,
             courseName: exam.courseName,
             date: exam.date,
             startTime: exam.startTime,
             endTime: exam.endTime,
             status: 'Scheduled' as ExamStatus,
             credits: exam.credits ?? null,
        }));
        
        const hallTicketMasterData: Omit<HallTicketData, 'studentId' | 'studentName' | 'studentPhotoUrl' | 'studentCollegeId'> = {
            program: filters.program,
            branch: filters.branch,
            year: yearNum,
            semester: semesterNum,
            examSessionName: sessionName,
            instructions: hallTicketData.instructions,
            controllerSignaturePlaceholder: hallTicketData.controllerSignaturePlaceholder,
            generatedDate: new Date().toISOString(),
            eligibility: {
                minAttendance: hallTicketData.minAttendance,
                maxDues: hallTicketData.maxDues,
            },
            exams: hallTicketExams,
        };
        
        studentsSnapshot.forEach(studentDoc => {
            const studentData = studentDoc.data();
            const hallTicketId = `${studentData.id}_${hallTicketMasterData.semester}`;
            const hallTicketRef = db.collection('hallTickets').doc(hallTicketId);
            
            const newHallTicket: HallTicketData = {
                ...hallTicketMasterData,
                studentId: studentData.id,
                studentName: studentData.name,
                studentPhotoUrl: studentData.avatarUrl,
                studentCollegeId: studentData.collegeId,
            };
            
            batch.set(hallTicketRef, newHallTicket, { merge: true });
        });
        
        await batch.commit();

        // --- 3. Send Notifications (After successful commit) ---
        const notificationTitle = `Exam Schedule Published: ${sessionName}`;
        const studentMessage = `The exam schedule for ${filters.program} - Sem ${filters.semester} has been published. Please check the Exams page for details and your hall ticket.`;
        const studentUidsToNotify = new Set(studentsSnapshot.docs.map(doc => doc.data().user_uid).filter(Boolean));

        if (studentUidsToNotify.size > 0) {
            createNotificationsForUids(Array.from(studentUidsToNotify), notificationTitle, studentMessage, 'event', '/student/exams')
                .catch(e => console.error("Failed to send exam schedule notifications:", e));
        }

        return { success: true, message: `Successfully scheduled ${exams.length} exams and generated ${studentsSnapshot.size} hall tickets.` };

    } catch (error: any) {
        console.error("Error in scheduleExamsAndSetupHallTickets:", error);
        if (error.code === 'failed-precondition' || (error.message && error.message.toLowerCase().includes('index'))) {
            return { success: false, error: `A required database index is missing. Please check your Firestore indexes for a composite index on 'students' collection including (program, branch, year).` };
        }
        return { success: false, error: 'An unexpected error occurred while saving the schedule.' };
    }
}


export async function deleteExamSchedule(id: string): Promise<ActionResult> {
    try {
        await db.collection('exams').doc(id).delete();
        return { success: true, message: `Exam schedule ${id} deleted successfully.` };
    } catch (error: any) {
        console.error("Error deleting exam schedule:", error);
        return { success: false, error: "Failed to delete exam schedule." };
    }
}

export async function getStudentExamSchedules(program: string, branch: string): Promise<ExamSchedule[]> {
    try {
        const snapshot = await db.collection('exams')
            .where("program", "==", program)
            .where("branch", "==", branch)
            .limit(200)
            .get();
            
        if (snapshot.empty) return [];

        const allExamsForBranch = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                program: data.program,
                branch: data.branch,
                year: data.year,
                semester: data.semester,
                courseCode: data.courseCode,
                courseName: data.courseName || 'N/A',
                examSessionName: data.examSessionName || null,
                date: data.date,
                startTime: data.startTime,
                endTime: data.endTime,
                status: data.status,
                credits: data.credits || null,
            } as ExamSchedule;
        });

        const schedules: ExamSchedule[] = allExamsForBranch
            .filter(schedule => schedule.status === 'Scheduled')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return schedules;

    } catch (error: any) {
        console.error(`Error fetching student exam schedules for ${program}/${branch}:`, error);
        if (error.code === 'failed-precondition') {
          throw new Error(`Database query failed. A required index might be missing for the 'exams' collection on (program, branch). Please contact an admin.`);
        }
        throw new Error(`Failed to fetch exam schedules due to a server error. Please try again later.`);
    }
}

export async function getHallTicket(studentId: string, semester: number): Promise<{ success: boolean; data?: HallTicketData; error?: string }> {
    try {
        const hallTicketId = `${studentId}_${semester}`;
        const hallTicketRef = db.collection('hallTickets').doc(hallTicketId);
        const feeRef = db.collection('fees').doc(studentId);

        const [hallTicketDoc, feeDoc] = await Promise.all([
            hallTicketRef.get(),
            feeRef.get()
        ]);

        if (!hallTicketDoc.exists) {
            return { success: false, error: `Hall ticket for semester ${semester} has not been issued yet.` };
        }
        
        const hallTicketData = hallTicketDoc.data() as HallTicketData;
        const { minAttendance, maxDues } = hallTicketData.eligibility;

        // --- ELIGIBILITY CHECKS (LIVE DATA) ---

        // 1. Check Fee Dues
        if (feeDoc.exists) {
            const feeData = feeDoc.data()!;
            const balance = (feeData.totalFees || 0) - (feeData.amountPaid || 0);
            if (balance > maxDues) {
                return { success: false, error: `Hall ticket blocked due to outstanding fees of ₹${balance.toLocaleString()}. Please clear your dues.` };
            }
        }

        // 2. Check Attendance (Live Calculation)
        const attendanceQuery = db.collection('attendance').where('studentId', '==', studentId);
        const attendanceSnap = await attendanceQuery.get();
        let studentAttendance = 100; // Default to 100% if no attendance records exist
        
        if (!attendanceSnap.empty) {
            const totalClasses = attendanceSnap.size;
            const presentClasses = attendanceSnap.docs.filter(doc => doc.data().status === 'Present').length;
            studentAttendance = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 100;
        }
        
        if (studentAttendance < minAttendance) {
            return { success: false, error: `Hall ticket blocked due to low attendance (${studentAttendance}%). Minimum required is ${minAttendance}%.` };
        }
        
        // If all checks pass, return the hall ticket data
        return { success: true, data: hallTicketData };

    } catch (error: any) {
        console.error(`Error fetching hall ticket for student ${studentId}:`, error);
        return { success: false, error: 'Failed to fetch hall ticket data due to a server error.' };
    }
}
