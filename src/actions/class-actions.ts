
'use server';

import { db, adminSDK } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Class } from '@/lib/types';
import { createChatRoomForClass } from './chat-actions';

interface ClassPayload {
    program: string;
    year: number;
    semester: number;
    courseId: string;
    section: string;
    teacherId: string; 
}

interface ActionResult {
    success: boolean;
    error?: string;
    message?: string;
}

export async function createClass(payload: ClassPayload): Promise<ActionResult> {
    console.log("Server Action: createClass invoked with payload:", payload);
    const { program, year, semester, courseId, section, teacherId } = payload;
    
    try {
        // 1. Check if class already exists
        const classExistsQuery = db.collection('classes')
            .where('program', '==', program)
            .where('year', '==', year)
            .where('semester', '==', semester)
            .where('section', '==', section)
            .where('courseId', '==', courseId);
        
        const existingClassSnap = await classExistsQuery.get();
        if (!existingClassSnap.empty) {
            return { success: false, error: `A class for ${courseId} - Section ${section} already exists.` };
        }

        // 2. Fetch all active students for the given program, year, and section
        const studentsQuery = db.collection('students')
            .where('program', '==', program)
            .where('year', '==', year)
            .where('section', '==', section)
            .where('status', '==', 'Active');
            
        const studentsSnap = await studentsQuery.get();
        if (studentsSnap.empty) {
            return { success: false, error: `No active students found for ${program} Year ${year} Section ${section}.` };
        }
        
        const studentUids = studentsSnap.docs.map(doc => doc.data().user_uid).filter(uid => !!uid);
        const branch = studentsSnap.docs[0].data().branch; // Get branch from the first student. Assume it's consistent.

        // 3. Verify teacher exists
        const teacherUserDoc = await db.collection('users').doc(teacherId).get();
        if (!teacherUserDoc.exists) {
            return { success: false, error: 'The selected teacher account was not found.' };
        }

        // 4. Create the class document (without denormalized course name/credits)
        const newClassRef = db.collection('classes').doc();
        const newClassData = {
            program,
            branch: branch,
            section: section,
            year,
            semester,
            courseId,
            teacherId,
            studentUids: studentUids,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };
        await newClassRef.set(newClassData);
        
        console.log(`Successfully created class document ${newClassRef.id}.`);

        // 5. Create chat room (non-critical)
        createChatRoomForClass(newClassRef.id).catch(e => console.warn(`Failed to create chat room for new class ${newClassRef.id}:`, e));

        return { success: true, message: `Successfully created class for ${program} ${courseId} - Section ${section}.` };

    } catch (error: any) {
        console.error("Error in createClass action:", error);
        return { success: false, error: 'An unexpected error occurred while creating the class.' };
    }
}


export async function getClassesWithDetails(): Promise<Class[]> {
    try {
        const [classesSnap, teachersSnap, coursesSnap] = await Promise.all([
            db.collection('classes').get(),
            db.collection('teachers').get(),
            db.collection('courses').get()
        ]);
        
        if (classesSnap.empty) return [];
        
        const teacherMap = new Map(teachersSnap.docs.map(doc => [doc.data().user_uid, doc.data().name]));
        const courseMap = new Map(coursesSnap.docs.map(doc => [doc.id, { name: doc.data().courseName, credits: doc.data().credits }]));

        const classesData: Class[] = classesSnap.docs.map(doc => {
            const data = doc.data();
            const courseDetails = courseMap.get(data.courseId) || { name: 'N/A', credits: 0 };
            
            return {
                id: doc.id,
                program: data.program,
                branch: data.branch,
                year: data.year,
                semester: data.semester,
                section: data.section,
                courseId: data.courseId,
                courseName: courseDetails.name,
                credits: courseDetails.credits,
                teacherId: data.teacherId,
                teacherName: teacherMap.get(data.teacherId) || 'N/A',
                studentCount: data.studentUids?.length || 0,
            };
        }).filter(cls => cls.courseName !== 'N/A'); // Filter out classes with no matching/valid course

        classesData.sort((a, b) => {
            if (a.program !== b.program) return (a.program || '').localeCompare(b.program || '');
            if (a.branch !== b.branch) return (a.branch || '').localeCompare(b.branch || '');
            if (a.section !== b.section) return (a.section || '').localeCompare(b.section || '');
            return 0;
        });

        return classesData;

    } catch (error: any) {
        console.error("Error fetching classes with details:", error);
        throw new Error("Failed to load class data.");
    }
}

export async function getCourses(): Promise<CourseInfo[]> {
    try {
        const coursesSnap = await db.collection('courses').get();
        if (coursesSnap.empty) {
            return [];
        }

        const courses = coursesSnap.docs.map(doc => {
            const data = doc.data();
            return {
                courseId: data.courseId,
                courseName: data.courseName,
                program: data.program,
                branch: data.branch,
                semester: data.semester,
                credits: data.credits,
            };
        });
        
        courses.sort((a, b) => {
            if (a.program !== b.program) return a.program.localeCompare(b.program);
            if (a.branch !== b.branch) return a.branch.localeCompare(b.branch);
            if (a.semester !== b.semester) return a.semester - b.semester;
            return a.courseId.localeCompare(b.courseId);
        });

        return courses;

    } catch (error: any) {
        console.error("Error fetching all courses from 'courses' collection:", error);
        throw new Error("Failed to load all course data.");
    }
}

export interface CourseInfo {
    courseId: string;
    courseName: string;
    program: string;
    branch: string;
    semester: number;
    credits: number;
}


export async function updateTeacherForClass(classId: string, teacherId: string): Promise<ActionResult> {
    if (!classId || !teacherId) {
        return { success: false, error: 'Class ID and Teacher ID are required.' };
    }
    try {
        await db.collection('classes').doc(classId).update({
            teacherId: teacherId,
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { success: true, message: 'Teacher successfully assigned to class.' };
    } catch (error: any) {
        console.error(`Error updating teacher for class ${classId}:`, error);
        return { success: false, error: 'Failed to assign teacher.' };
    }
}

export async function deleteClass(classId: string): Promise<ActionResult> {
    if (!classId) {
        return { success: false, error: 'Class ID is required.' };
    }
    try {
        await db.collection('classes').doc(classId).delete();
        await db.collection('chats').doc(classId).delete().catch(e => console.warn(`Could not delete associated chat room for class ${classId}:`, e));
        return { success: true, message: 'Class and associated chat room deleted successfully.' };
    } catch (error: any) {
        console.error(`Error deleting class ${classId}:`, error);
        return { success: false, error: 'Failed to delete class.' };
    }
}


export async function getAvailableSections(program: string, year: number, courseId: string): Promise<string[]> {
    try {
        const studentsQuery = db.collection('students')
            .where('program', '==', program)
            .where('year', '==', year);
        
        const studentsSnap = await studentsQuery.get();
        if (studentsSnap.empty) {
            return [];
        }
        const allSections = new Set(studentsSnap.docs.map(doc => doc.data().section).filter(Boolean));
        
        const existingClassesQuery = db.collection('classes')
            .where('program', '==', program)
            .where('year', '==', year)
            .where('courseId', '==', courseId);
            
        const existingClassesSnap = await existingClassesQuery.get();
        const assignedSections = new Set(existingClassesSnap.docs.map(doc => doc.data().section));
        
        const availableSections = [...allSections].filter(section => !assignedSections.has(section));
        
        return availableSections.sort();

    } catch (error: any) {
        console.error("Error fetching available sections:", error);
        return [];
    }
}


export async function getClassDetails(filters: { program: string, branch: string, year: number, semester: number, section: string}): Promise<{classId: string | null, studentUids: string[], teacherId: string | null}> {
    try {
        const classQuery = db.collection('classes')
            .where('program', '==', filters.program)
            .where('branch', '==', filters.branch)
            .where('year', '==', filters.year)
            .where('semester', '==', filters.semester)
            .where('section', '==', filters.section)
            .limit(1);

        const classSnap = await classQuery.get();
        if (classSnap.empty) {
            return { classId: null, studentUids: [], teacherId: null };
        }

        const classDoc = classSnap.docs[0];
        const classData = classDoc.data();

        return {
            classId: classDoc.id,
            studentUids: classData.studentUids || [],
            teacherId: classData.teacherId || null,
        }
    } catch (error) {
        console.error("Error fetching class details for notification:", error);
        return { classId: null, studentUids: [], teacherId: null };
    }
}
