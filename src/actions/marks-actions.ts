
'use server';

import { db, adminSDK } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Student } from '@/lib/types';

interface MarksEntryPayload {
    internalsMarks: number;
    externalsMarks: number;
    totalMarks: number;
    grade: string;
}

interface ActionResult {
    success: boolean;
    error?: string;
    message?: string;
}

export async function saveMarks(recordId: string, marks: MarksEntryPayload): Promise<ActionResult> {
    if (!recordId || !marks) {
        return { success: false, error: "Missing record ID or marks data." };
    }
    try {
        const markDocRef = db.collection('marks').doc(recordId);
        await markDocRef.update({
            ...marks,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { success: true, message: "Marks saved successfully." };
    } catch (error: any) {
        console.error(`Error saving marks for record ${recordId}:`, error);
        return { success: false, error: "Failed to save marks." };
    }
}

const createBacklogEntry = async (studentId: string, courseCode: string, courseName: string, semester: number) => {
    const backlogId = `${studentId}_${courseCode}`;
    const backlogRef = db.collection('backlogs').doc(backlogId);
    
    await backlogRef.set({
        studentId,
        courseCode,
        courseName,
        semesterAttempted: semester,
        status: 'Active',
        gradeAchieved: 'FAIL',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
};

const clearBacklogEntry = async (studentId: string, courseCode: string, grade: string) => {
    const backlogId = `${studentId}_${courseCode}`;
    const backlogRef = db.collection('backlogs').doc(backlogId);

    const doc = await backlogRef.get();
    if (doc.exists) {
        await backlogRef.update({
            status: 'Cleared',
            gradeAchieved: grade,
            updatedAt: FieldValue.serverTimestamp()
        });
    }
};


export async function saveAllMarksForClass(marksToSave: { recordId: string; studentId: string; courseCode: string; semester: number; marks: MarksEntryPayload }[]): Promise<ActionResult> {
    if (!marksToSave || marksToSave.length === 0) {
        return { success: false, error: "No marks data provided to save." };
    }
    
    const courseIds = [...new Set(marksToSave.map(m => m.courseCode).filter(Boolean))];
    const courseMap = new Map();
    if (courseIds.length > 0) {
        const coursesSnap = await db.collection('courses').where(adminSDK.firestore.FieldPath.documentId(), 'in', courseIds).get();
        coursesSnap.forEach(doc => courseMap.set(doc.id, doc.data()));
    }

    const batch = db.batch();
    const backlogPromises: Promise<void>[] = [];
    
    marksToSave.forEach(({ recordId, studentId, courseCode, semester, marks }) => {
        if (recordId) { 
            const docRef = db.collection('marks').doc(recordId);
            const classId = recordId.substring(0, recordId.lastIndexOf(`_${studentId}`));
            const courseData = courseMap.get(courseCode);

            const dataToSet = {
                ...marks,
                studentId,
                courseCode,
                semester,
                classId,
                updatedAt: FieldValue.serverTimestamp(),
            };

            batch.set(docRef, dataToSet, { merge: true });

            if (marks.grade === 'FAIL' && courseData) {
                backlogPromises.push(createBacklogEntry(studentId, courseCode, courseData.courseName, semester));
            } else if (marks.grade && marks.grade !== 'FAIL') {
                backlogPromises.push(clearBacklogEntry(studentId, courseCode, marks.grade));
            }
        }
    });

    try {
        await batch.commit();
        await Promise.all(backlogPromises);
        return { success: true, message: `Successfully saved marks for ${marksToSave.length} students.` };
    } catch (error: any) {
        console.error("Error batch saving marks:", error);
        return { success: false, error: "An error occurred while saving all marks." };
    }
}


export type MarksRecord = {
    id: string;
    studentId: string | null;
    studentName: string | null;
    program: string | null;
    branch: string | null;
    year: number | null;
    courseCode: string | null;
    courseName: string | null;
    semester: number | null;
    internals: number | null;
    externals: number | null;
    total: number | null;
    grade: string | null;
    credits?: number; 
};

export async function getMarksRecords(filters?: { program?: string; branch?: string; year?: string; semester?: string }): Promise<{ success: boolean, data?: MarksRecord[], error?: string }> {
    try {
        let marksQuery: adminSDK.firestore.Query = db.collection('marks');

        if (filters?.semester && filters.semester !== 'all') {
            marksQuery = marksQuery.where('semester', '==', parseInt(filters.semester));
        }
        
        const marksSnaps = await marksQuery.limit(200).get();
        if (marksSnaps.empty) {
            return { success: true, data: [] };
        }

        const studentIds = [...new Set(marksSnaps.docs.map(doc => doc.data().studentId).filter(Boolean))];
        const courseIds = [...new Set(marksSnaps.docs.map(doc => doc.data().courseCode).filter(Boolean))];

        const studentMap = new Map<string, Student>();
        const courseMap = new Map();

        if (studentIds.length > 0) {
            for (let i = 0; i < studentIds.length; i += 30) {
                const chunk = studentIds.slice(i, i + 30);
                const studentsQuery = db.collection('students').where(adminSDK.firestore.FieldPath.documentId(), 'in', chunk);
                const studentSnaps = await studentsQuery.get();
                studentSnaps.forEach(doc => {
                    studentMap.set(doc.id, { id: doc.id, ...doc.data() } as Student);
                });
            }
        }
        if (courseIds.length > 0) {
            for (let i = 0; i < courseIds.length; i += 30) {
                const chunk = courseIds.slice(i, i + 30);
                const coursesQuery = db.collection('courses').where(adminSDK.firestore.FieldPath.documentId(), 'in', chunk);
                const courseSnaps = await coursesQuery.get();
                courseSnaps.forEach(doc => courseMap.set(doc.id, doc.data()));
            }
        }
        
        const records = marksSnaps.docs.map(doc => {
            const data = doc.data();
            const student = studentMap.get(data.studentId);
            const course = courseMap.get(data.courseCode);
            return {
                id: doc.id,
                studentId: data.studentId,
                studentName: student?.name || 'N/A',
                program: student?.program || 'N/A',
                branch: student?.branch || 'N/A',
                year: student?.year || null,
                courseCode: data.courseCode || 'N/A',
                courseName: course?.courseName || 'N/A',
                semester: data.semester || null,
                internals: data.internalsMarks ?? null,
                externals: data.externalsMarks ?? null,
                total: data.totalMarks ?? null,
                grade: data.grade ?? null,
                credits: course?.credits ?? null,
            };
        });
        
        const filteredRecords = records.filter(record => 
            (!filters?.program || filters.program === 'all' || record.program === filters.program) &&
            (!filters?.branch || filters.branch === 'all' || record.branch === filters.branch) &&
            (!filters?.year || filters.year === 'all' || record.year?.toString() === filters.year)
        );

        return { success: true, data: filteredRecords };

    } catch (error: any) {
        console.error("Error fetching all marks records:", error);
        return { success: false, error: "Failed to fetch marks data." };
    }
}
