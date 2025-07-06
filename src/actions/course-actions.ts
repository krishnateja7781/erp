
'use server';

import { db } from '@/lib/firebaseAdmin';
import { FieldValue, Transaction } from 'firebase-admin/firestore';
import { getProgramCode, getBranchCode } from '@/lib/utils';

// Cleaner interface, no redundant docId
export interface Course {
    id: string; // Firestore document ID
    courseId: string; // The human-readable course ID (e.g. CSE301)
    courseName: string;
    program: string;
    branch: string;
    semester: number;
    credits: number;
}

export interface CoursePayload {
    id?: string; // Document ID, present for updates.
    courseName: string;
    program: string;
    branch: string;
    semester: number;
    credits: number;
}

interface ActionResult {
    success: boolean;
    error?: string;
    message?: string;
}

// Grouped structure for the UI
export interface GroupedCourses {
    [program: string]: {
        [branch: string]: {
            [semester: number]: Course[];
        };
    };
}

export async function getGroupedCourses(): Promise<GroupedCourses> {
    try {
        // Fetch all courses without ordering at the DB level to avoid complex index requirements.
        // Sorting will be handled in memory. This is more resilient to missing index issues.
        const coursesSnapshot = await db.collection('courses').get();
        const courses: Course[] = [];

        coursesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            // Defensive check to ensure core data exists before pushing
            if(data.courseId && data.courseName && data.program && data.branch && data.semester && data.credits) {
                courses.push({
                    id: doc.id,
                    courseId: data.courseId,
                    courseName: data.courseName,
                    program: data.program,
                    branch: data.branch,
                    semester: data.semester,
                    credits: data.credits,
                });
            } else {
                 console.warn(`Skipping malformed course document with ID: ${doc.id}`);
            }
        });
        
        // In-memory sorting of the fetched courses
        courses.sort((a, b) => {
            if (a.program !== b.program) return a.program.localeCompare(b.program);
            if (a.branch !== b.branch) return a.branch.localeCompare(b.branch);
            if (a.semester !== b.semester) return a.semester - b.semester;
            return a.courseId.localeCompare(b.courseId);
        });

        const grouped: GroupedCourses = {};

        courses.forEach(course => {
            const { program, branch, semester } = course;
            // These checks are now safer because of the initial filter
            if (!grouped[program]) {
                grouped[program] = {};
            }
            if (!grouped[program][branch]) {
                grouped[program][branch] = {};
            }
            if (!grouped[program][branch][semester]) {
                grouped[program][branch][semester] = [];
            }
            grouped[program][branch][semester].push(course);
        });

        return grouped;

    } catch (error: any) {
        console.error("Error fetching or grouping courses:", error.message, error.stack);
        if (error.code === 'failed-precondition' || (error.message && error.message.toLowerCase().includes('index'))) {
             return Promise.reject(new Error("Database setup issue: A required index is missing or still being built. Please check your Firebase console's Firestore section for index creation prompts or try again in a few minutes. This is the most common cause for this error."));
        }
        return Promise.reject(new Error("Failed to fetch and process course data from the server. Check server logs for details."));
    }
}

export async function saveCourse(payload: CoursePayload): Promise<ActionResult> {
    const { id, ...courseData } = payload;

    if (!courseData.courseName || !courseData.program || !courseData.branch || !courseData.semester || !courseData.credits) {
        return { success: false, error: "Missing required fields." };
    }

    try {
        if (id) {
            // UPDATE logic for an existing course.
            console.log(`Updating course with docId: ${id}`);
            const courseRef = db.collection('courses').doc(id);
            // In edit mode, we only allow changing the name and credits to prevent data corruption.
            // Program, branch, and semester changes should involve creating a new course.
            await courseRef.update({
                courseName: courseData.courseName,
                credits: courseData.credits,
                updatedAt: FieldValue.serverTimestamp()
            });
            const courseDoc = await courseRef.get();
            const courseId = courseDoc.data()?.courseId || id;
            return { success: true, message: `Course ${courseId} updated successfully.` };
        } else {
            // CREATE logic for a new course.
            const { program, branch, semester } = courseData;

            // 1. Find all existing courses for this combination to find the next available serial number.
            const coursesQuery = db.collection('courses')
                .where('program', '==', program)
                .where('branch', '==', branch)
                .where('semester', '==', semester);
            
            const snapshot = await coursesQuery.get();

            const existingSerials = new Set<number>();
            snapshot.docs.forEach(doc => {
                const existingCourseId = doc.data().courseId;
                if (existingCourseId) {
                    const serialMatch = existingCourseId.match(/\d+$/);
                    if (serialMatch && serialMatch[0]) {
                        existingSerials.add(parseInt(serialMatch[0], 10));
                    }
                }
            });
            
            // 2. Find the first available serial number (gap filling).
            let newSequence = 1;
            while (existingSerials.has(newSequence)) {
                newSequence++;
            }
            
            // 3. Construct the new human-readable courseId
            const programCode = getProgramCode(program);
            const branchCode = getBranchCode(branch, program);
            const idPrefix = `${programCode}${semester}${branchCode}`;
            const generatedCourseId = `${idPrefix}${newSequence.toString().padStart(3, '0')}`;

            // 4. Atomically create the new course document, using the generated ID as the document ID to enforce uniqueness.
            const newCourseRef = db.collection('courses').doc(generatedCourseId);
            
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(newCourseRef);
                if (doc.exists) {
                    throw new Error(`Course ID ${generatedCourseId} was just created by another user. Please try creating the course again.`);
                }
                
                const dataToSave: Omit<Course, 'id'> & { createdAt: FieldValue, updatedAt: FieldValue } = {
                    ...courseData,
                    courseId: generatedCourseId,
                    createdAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp(),
                };
                // Since `id` and `courseId` are the same, we don't need `id` in the data itself.
                // The document ID is the `id`.
                transaction.set(newCourseRef, dataToSave);
            });

            console.log(`Successfully created new course ${generatedCourseId}`);
            return { success: true, message: `Course ${generatedCourseId} created successfully.` };
        }
    } catch (error: any) {
        console.error("Error in saveCourse action:", error);
         if (error.code === 'failed-precondition' || (error.message && error.message.toLowerCase().includes('index'))) {
             return { success: false, error: "Database setup issue: A required index is missing or being built. Please check your Firebase console for index creation prompts or try again in a few minutes." };
        }
        return { success: false, error: error.message || "An unexpected server error occurred while saving the course." };
    }
}

export async function deleteCourse(courseId: string): Promise<ActionResult> {
    if (!courseId) {
        return { success: false, error: "Course ID is required." };
    }
    
    try {
        const courseRef = db.collection('courses').doc(courseId);
        const courseDoc = await courseRef.get();
        if (!courseDoc.exists) {
            return { success: false, error: "Course not found." };
        }

        // This query now has a corresponding index in firestore.indexes.json
        const classesQuery = db.collection('classes').where('courseId', '==', courseId).limit(1);
        
        const classesSnap = await classesQuery.get();
        if (!classesSnap.empty) {
            return { success: false, error: `Cannot delete course. It is assigned to one or more classes (e.g., class doc: ${classesSnap.docs[0].id}). Please unassign it first.` };
        }
        
        await courseRef.delete();
        return { success: true, message: `Course ${courseId} deleted successfully.` };

    } catch (error: any) {
        console.error("Error deleting course:", error);
        if (error.code === 'failed-precondition' || (error.message && error.message.toLowerCase().includes('index'))) {
             return { success: false, error: "Database setup issue: A required index for checking class assignments is missing. Please check your Firebase console for index creation prompts or wait a few minutes if you've recently created one." };
        }
        return { success: false, error: "An unexpected error occurred while deleting the course." };
    }
}

export async function getCoursesForSelection(program: string, branch: string, semester: number): Promise<{ id: string; name: string; credits: number; }[]> {
    try {
        const coursesSnapshot = await db.collection('courses')
            .where('program', '==', program)
            .where('branch', '==', branch)
            .where('semester', '==', semester)
            .get();

        if (coursesSnapshot.empty) return [];

        const courses = coursesSnapshot.docs.map(doc => {
            const courseData = doc.data();
            const courseIdentifier = courseData.courseId;
            return {
                id: courseIdentifier,
                name: `${courseIdentifier} - ${courseData.courseName}`,
                credits: courseData.credits || 0,
            };
        });
        
        courses.sort((a, b) => a.id.localeCompare(b.id));
        
        return courses;

    } catch (error: any)
    {
        console.error("Error fetching courses for selection:", error);
        if (error.code === 'failed-precondition' || (error.message && error.message.toLowerCase().includes('index'))) {
            throw new Error("A required database index is missing for fetching courses. Please check your Firebase console for index creation prompts.");
        }
        throw new Error("Failed to fetch courses. Please check server logs and database configuration.");
    }
}
