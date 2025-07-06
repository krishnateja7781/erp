
'use server';
/**
 * @fileOverview Tools for the AI chatbot assistant to fetch live data.
 */
import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';
import { db } from '@/lib/firebaseAdmin';

// --- STUDENT TOOLS ---

export const getStudentAttendance = ai.defineTool(
  {
    name: 'getStudentAttendance',
    description: "Get the current overall attendance percentage for a specific student.",
    inputSchema: z.object({ studentId: z.string().describe("The student's unique ID.") }),
    outputSchema: z.string().describe("A string stating the student's attendance percentage, or 'N/A' if not available."),
  },
  async ({ studentId }) => {
    try {
      const attendanceQuery = db.collection('attendance').where('studentId', '==', studentId);
      const attendanceSnap = await attendanceQuery.get();
      if (attendanceSnap.empty) return "N/A";
      
      const totalClasses = attendanceSnap.size;
      const presentClasses = attendanceSnap.docs.filter(doc => doc.data().status === 'Present').length;
      const percentage = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;
      return `${percentage}%`;
    } catch (e: any) {
      console.error(`Error in getStudentAttendance tool for studentId ${studentId}:`, e);
      return "Error fetching attendance data.";
    }
  }
);

export const getStudentFeeBalance = ai.defineTool(
  {
    name: 'getStudentFeeBalance',
    description: "Get the outstanding fee balance for a specific student.",
    inputSchema: z.object({ studentId: z.string().describe("The student's unique ID.") }),
    outputSchema: z.string().describe("A string stating the student's fee balance, or 'N/A' if not available."),
  },
  async ({ studentId }) => {
    try {
      const feeDoc = await db.collection('fees').doc(studentId).get();
      if (!feeDoc.exists) return "N/A";
      
      const data = feeDoc.data()!;
      const balance = (data.totalFees || 0) - (data.amountPaid || 0);
      return `₹${balance.toLocaleString()}`;
    } catch (e: any) {
      console.error(`Error in getStudentFeeBalance tool for studentId ${studentId}:`, e);
      return "Error fetching fee data.";
    }
  }
);

export const getStudentNextExam = ai.defineTool(
  {
    name: 'getStudentNextExam',
    description: "Get the next upcoming exam for a specific student.",
    inputSchema: z.object({ studentId: z.string().describe("The student's unique ID.") }),
    outputSchema: z.string().describe("A string with the next exam's course name and date, or 'N/A' if none are scheduled."),
  },
  async ({ studentId }) => {
    try {
        const studentDoc = await db.collection('students').doc(studentId).get();
        if (!studentDoc.exists) return "Student profile not found.";

        const studentData = studentDoc.data()!;
        if (!studentData.program || !studentData.branch) {
            return `I can't look up exams because the profile for student ${studentId} is incomplete. It is missing program or branch information.`;
        }

        const examsQuery = db.collection('exams')
            .where('program', '==', studentData.program)
            .where('branch', '==', studentData.branch)
            .where('status', '==', 'Scheduled')
            .where('date', '>=', new Date().toISOString().split('T')[0])
            .orderBy('date', 'asc')
            .limit(1);
        
        const examSnap = await examsQuery.get();
        if (examSnap.empty) return "N/A";
        
        const examData = examSnap.docs[0].data();
        return `${examData.courseName} on ${new Date(examData.date).toLocaleDateString()}`;
    } catch (e: any) {
        console.error(`Error in getStudentNextExam tool for studentId ${studentId}:`, e);
        const errorMessage = e.message?.toLowerCase().includes('index') 
            ? `Query failed: A database index is likely required. Contact an admin.`
            : `An error occurred while fetching exam data.`;
        return errorMessage;
    }
  }
);


// --- TEACHER TOOLS ---
export const getTeacherPendingTasks = ai.defineTool(
    {
        name: 'getTeacherPendingTasks',
        description: "Get the count of pending marks to be entered by a specific teacher.",
        inputSchema: z.object({ teacherId: z.string().describe("The teacher's unique ID.") }),
        outputSchema: z.string().describe("A string stating the number of students with pending marks."),
    },
    async ({ teacherId }) => {
        try {
            // Teacher ID in the teacher collection is the document ID, but in classes it's the auth UID.
            // First, get the teacher's auth UID from their document ID.
            const teacherDoc = await db.collection('teachers').doc(teacherId).get();
            if (!teacherDoc.exists) {
                return "Teacher profile not found.";
            }
            const teacherAuthUid = teacherDoc.data()!.user_uid;
            if (!teacherAuthUid) {
                return "Teacher's authentication link is missing.";
            }

            const classesSnap = await db.collection('classes').where('teacherId', '==', teacherAuthUid).get();
            if (classesSnap.empty) return "0 students";

            const classIds = classesSnap.docs.map(doc => doc.id);
            if (classIds.length === 0) return "0 students";

            let pendingMarksCount = 0;
            //Firestore 'in' query supports up to 30 elements
            for (let i = 0; i < classIds.length; i += 30) {
              const chunk = classIds.slice(i, i + 30);
              const marksQuery = db.collection('marks').where('classId', 'in', chunk);
              const marksSnap = await marksQuery.get();
              marksSnap.forEach(doc => {
                  const data = doc.data();
                  if (data.totalMarks === null || typeof data.totalMarks === 'undefined') {
                      pendingMarksCount++;
                  }
              });
            }
            
            return `${pendingMarksCount} students require marks entry.`;
        } catch (e: any)
        {
            console.error(`Error in getTeacherPendingTasks tool for teacherId ${teacherId}:`, e);
            const errorMessage = e.message?.toLowerCase().includes('index') 
                ? `Query failed: A database index is likely required. Contact an admin.`
                : `An error occurred while fetching pending tasks.`;
            return errorMessage;
        }
    }
);


// --- ADMIN TOOLS ---
export const getAdminStudentCount = ai.defineTool(
    {
        name: 'getAdminStudentCount',
        description: "Get the total number of students enrolled in the institution.",
        inputSchema: z.object({}), // No input needed
        outputSchema: z.string().describe("A string stating the total number of students."),
    },
    async () => {
        try {
            const studentsSnap = await db.collection('students').count().get();
            return `${studentsSnap.data().count} students`;
        } catch (e: any) {
            console.error("Error in getAdminStudentCount tool:", e);
            return "Error fetching student count.";
        }
    }
);

export const getOverallAttendanceSummary = ai.defineTool(
  {
    name: 'getOverallAttendanceSummary',
    description: "Get a summary of the overall attendance percentage for the entire institution. Use this when asked to 'summarize attendance' or for the 'overall attendance'. This tool is available only to admins.",
    inputSchema: z.object({}),
    outputSchema: z.string().describe("A string stating the overall attendance percentage, or 'N/A' if not available."),
  },
  async () => {
    try {
      const attendanceSnaps = await db.collection('attendance').orderBy('date', 'desc').limit(500).get();
      if (attendanceSnaps.empty) {
        return "N/A - No attendance records found to summarize.";
      }
      const total = attendanceSnaps.size;
      const present = attendanceSnaps.docs.filter(d => d.data().status === 'Present').length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
      return `The overall attendance is approximately ${percentage}%, based on the last ${total.toLocaleString()} records.`;
    } catch (e: any) {
      console.error("Error in getOverallAttendanceSummary tool:", e);
      return "Error fetching attendance summary data.";
    }
  }
);

    