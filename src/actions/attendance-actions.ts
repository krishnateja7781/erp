
'use server';

import { db } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export interface AttendanceRecordPayload {
    classId: string;
    courseCode: string;
    courseName: string;
    teacherId: string;
    date: string; // YYYY-MM-DD
    period: number;
    studentRecords: {
        studentId: string;
        status: 'Present' | 'Absent';
    }[];
}

interface ActionResult {
    success: boolean;
    error?: string;
    message?: string;
}

export async function saveAttendance(payload: AttendanceRecordPayload): Promise<ActionResult> {
    const { classId, teacherId, date, period, studentRecords } = payload;
    console.log(`Server Action: saveAttendance invoked for class ${classId} on ${date}, period ${period}`);

    if (!classId || !teacherId || !date || !period || !studentRecords) {
        return { success: false, error: "Missing required fields for saving attendance." };
    }
    
    if(studentRecords.length === 0) {
        return { success: true, message: "No student records to save." };
    }
    
    const classDocRef = db.collection('classes').doc(classId);

    try {
        const classDocSnap = await classDocRef.get();
        if (!classDocSnap.exists) {
            return { success: false, error: `Class with ID ${classId} not found.` };
        }
        const classData = classDocSnap.data()!;

        const batch = db.batch();
        const now = FieldValue.serverTimestamp();
        const attendanceDate = new Date(date);

        studentRecords.forEach(record => {
            // Using a predictable ID to prevent duplicates for the same session
            const attendanceDocId = `${classId}_${date}_${period}_${record.studentId}`;
            const attendanceDocRef = db.collection('attendance').doc(attendanceDocId);
            
            const attendanceData = {
                classId,
                teacherId,
                studentId: record.studentId,
                date: attendanceDate, // Store as Firestore timestamp for querying
                period,
                status: record.status,
                program: classData.program,
                branch: classData.branch,
                year: classData.year,
                semester: classData.semester,
                courseCode: classData.courseId,
                createdAt: now,
                updatedAt: now,
            };
            // Use set with merge: true to create or overwrite
            batch.set(attendanceDocRef, attendanceData, { merge: true });
        });

        await batch.commit();

        console.log(`Successfully saved attendance for ${studentRecords.length} students.`);
        return { success: true, message: `Attendance for ${studentRecords.length} students saved successfully.` };

    } catch (error: any) {
        console.error(`Server Action Error in saveAttendance for class ${classId}:`, error);
        return { success: false, error: error.message || "An unexpected error occurred while saving attendance." };
    }
}


export interface AggregatedData {
    overall: { percentage: number; totalClasses: number; totalPresent: number; };
    byProgram: Record<string, {
        program: string;
        percentage: number; totalClasses: number; totalPresent: number;
        branches: Record<string, {
            branch: string;
            percentage: number; totalClasses: number; totalPresent: number;
            classes: Record<string, {
                year: number;
                percentage: number; totalClasses: number; totalPresent: number;
            }>;
        }>
    }>;
    duplicateCount: number; // Placeholder for now
    incompleteCount: number;
    totalRecords: number;
}


export async function getAggregatedAttendance(): Promise<{ success: boolean; data?: AggregatedData; error?: string }> {
    try {
        console.log("Fetching aggregated attendance data...");
        const attendanceSnaps = await db.collection('attendance').get();
        const records = attendanceSnaps.docs.map(doc => doc.data());
        
        let incompleteCount = 0;
        
        const aggregation: AggregatedData = {
            overall: { percentage: 0, totalClasses: 0, totalPresent: 0 },
            byProgram: {},
            duplicateCount: 0,
            incompleteCount: 0,
            totalRecords: records.length,
        };

        records.forEach(record => {
            const { program, branch, year, status } = record;
            if (!program || !branch || !year || !status) {
                incompleteCount++;
                return;
            }

            // Overall
            aggregation.overall.totalClasses++;
            if (status === 'Present') aggregation.overall.totalPresent++;

            // Program level
            if (!aggregation.byProgram[program]) {
                aggregation.byProgram[program] = { program, percentage: 0, totalClasses: 0, totalPresent: 0, branches: {} };
            }
            aggregation.byProgram[program].totalClasses++;
            if (status === 'Present') aggregation.byProgram[program].totalPresent++;

            // Branch level
            if (!aggregation.byProgram[program].branches[branch]) {
                aggregation.byProgram[program].branches[branch] = { branch, percentage: 0, totalClasses: 0, totalPresent: 0, classes: {} };
            }
            aggregation.byProgram[program].branches[branch].totalClasses++;
            if (status === 'Present') aggregation.byProgram[program].branches[branch].totalPresent++;

            // Class (Year) level
            if (!aggregation.byProgram[program].branches[branch].classes[year]) {
                aggregation.byProgram[program].branches[branch].classes[year] = { year, percentage: 0, totalClasses: 0, totalPresent: 0 };
            }
            aggregation.byProgram[program].branches[branch].classes[year].totalClasses++;
            if (status === 'Present') aggregation.byProgram[program].branches[branch].classes[year].totalPresent++;
        });

        aggregation.incompleteCount = incompleteCount;

        // Calculate percentages
        const calcPercent = (present: number, total: number) => total > 0 ? Math.round((present / total) * 100) : 0;
        
        aggregation.overall.percentage = calcPercent(aggregation.overall.totalPresent, aggregation.overall.totalClasses);
        
        for (const prog in aggregation.byProgram) {
            const programData = aggregation.byProgram[prog];
            programData.percentage = calcPercent(programData.totalPresent, programData.totalClasses);
            for (const br in programData.branches) {
                const branchData = programData.branches[br];
                branchData.percentage = calcPercent(branchData.totalPresent, branchData.totalClasses);
                for (const yr in branchData.classes) {
                    const classData = branchData.classes[yr];
                    classData.percentage = calcPercent(classData.totalPresent, classData.totalClasses);
                }
            }
        }

        console.log("Successfully aggregated attendance data.");
        return { success: true, data: aggregation };
    } catch (error: any) {
        console.error("Error in getAggregatedAttendance:", error);
        return { success: false, error: "Failed to fetch and process attendance data." };
    }
}
