
'use server';

import { db } from '@/lib/firebaseAdmin';
import { auth } from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';


export interface ChatRoom {
  id: string;
  name: string;
  description: string;
  participantUids: string[];
}


export async function getChatRoomsForUser(userId: string, userRole: 'admin' | 'teacher' | 'student'): Promise<ChatRoom[]> {
    try {
        console.log(`Fetching chat rooms for user ${userId} with role ${userRole}`);
        let query;

        if (userRole === 'admin') {
            // Admins can see all chat rooms
            query = db.collection('chats').orderBy('name');
        } else {
            // Students and Teachers can only see chats they are a part of
            query = db.collection('chats').where('participantUids', 'array-contains', userId).orderBy('name');
        }

        const snapshot = await query.get();
        if (snapshot.empty) {
            console.log("No chat rooms found for user:", userId);
            return [];
        }

        const chatRooms = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as ChatRoom));
        
        console.log(`Found ${chatRooms.length} chat rooms for user ${userId}`);
        return chatRooms;

    } catch (error: any) {
        console.error(`Error fetching chat rooms for user ${userId}:`, error);
        throw new Error("Failed to fetch chat rooms.");
    }
}

export async function getChatParticipants(uids: string[]) {
    if (uids.length === 0) {
        return [];
    }

    try {
        const users = await auth().getUsers(uids.map(uid => ({ uid })));
        
        const userDocs = await db.collection('users').where('uid', 'in', uids).get();
        const userDocsMap = new Map(userDocs.docs.map(doc => [doc.id, doc.data()]));
        
        return users.users.map(userRecord => {
            const userDoc = userDocsMap.get(userRecord.uid);
            return {
                uid: userRecord.uid,
                name: userRecord.displayName || 'Unknown User',
                role: userDoc?.role || 'student',
                initials: userDoc?.initials || '??',
                avatarUrl: userRecord.photoURL || userDoc?.avatarUrl,
            };
        });

    } catch (error) {
        console.error("Error fetching participant details:", error);
        return uids.map(uid => ({
            uid,
            name: 'Unknown User',
            role: 'student',
            initials: '??',
        }));
    }
}

export interface ClassForChatManagement {
  id: string;
  name: string;
  studentCount: number;
  teacherName: string | null;
}

export async function getClassesForChatManagement(): Promise<ClassForChatManagement[]> {
  try {
    const classesSnapshot = await db.collection('classes').orderBy('program').orderBy('branch').orderBy('section').get();
    if (classesSnapshot.empty) {
      return [];
    }

    // Fetch all teachers at once to minimize reads, and map by UID
    const teachersSnapshot = await db.collection('teachers').get();
    const teachersData: Record<string, string> = {}; // map uid to name
    teachersSnapshot.forEach(doc => {
      const teacher = doc.data();
      if(teacher.user_uid) {
        teachersData[teacher.user_uid] = teacher.name;
      }
    });

    return classesSnapshot.docs.map(doc => {
      const data = doc.data();
      // teacherId in classes is now UID
      const teacherName = data.teacherId ? teachersData[data.teacherId] || 'N/A' : 'N/A';
      return {
        id: doc.id,
        name: `${data.program} ${data.branch} - Section ${data.section} (Sem ${data.semester})`,
        studentCount: data.studentUids?.length || 0,
        teacherName: teacherName,
      };
    });
  } catch (error) {
    console.error("Error fetching classes for chat management:", error);
    throw new Error("Failed to fetch classes.");
  }
}

export async function createChatRoomForClass(classId: string): Promise<{ success: boolean; error?: string; message?: string }> {
    console.log(`Server Action: createChatRoomForClass invoked for classId: ${classId}`);
    
    if (!classId) {
        return { success: false, error: "Class ID is required." };
    }

    const chatDocRef = db.collection('chats').doc(classId);
    const classDocRef = db.collection('classes').doc(classId);

    try {
        const [chatDoc, classDoc] = await Promise.all([
            chatDocRef.get(),
            classDocRef.get()
        ]);

        if (chatDoc.exists()) {
            return { success: false, error: "A chat room for this class already exists." };
        }

        if (!classDoc.exists()) {
            return { success: false, error: "Class not found." };
        }

        const classData = classDoc.data()!;
        const teacherUid = classData.teacherId; // This is now the teacher's auth UID
        const studentUids = classData.studentUids || []; // These are student auth UIDs
        
        if (!teacherUid) {
             return { success: false, error: "Class does not have a teacher assigned." };
        }

        const participantUids = [...new Set([teacherUid, ...studentUids])];

        const chatRoomData = {
            id: classId,
            name: `${classData.program} ${classData.branch} - Section ${classData.section}`,
            description: `Official group for Semester ${classData.semester} - Course: ${classData.courseId}`,
            participantUids: participantUids,
            classId: classId,
            createdAt: FieldValue.serverTimestamp(),
        };

        await chatDocRef.set(chatRoomData);

        console.log(`Successfully created chat room for class ${classId}`);
        return { success: true, message: `Chat room for ${chatRoomData.name} created successfully.` };

    } catch (error: any) {
        console.error("Error creating chat room:", error);
        return { success: false, error: "An unexpected error occurred while creating the chat room." };
    }
}
