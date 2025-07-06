
'use server';
console.log("staff-actions.ts: Module loading...");

import { auth, db } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp, Transaction } from 'firebase-admin/firestore';
import type { AddStaffFormValues as ClientAddStaffFormValues } from '@/components/admin/staff/add-staff-dialog';
import type { Teacher } from '@/lib/types';
import type { ScheduleEntry } from '@/components/shared/TimetableGrid';
import { getTeacherClasses as fetchTeacherClassesForSchedule } from '@/actions/teacher-actions';
import { generatePassword, getDepartmentCode } from '@/lib/utils';

interface ServerAddStaffFormValues extends ClientAddStaffFormValues {
  firstName: string;
  lastName: string;
  email: string;
  role: 'teacher' | 'admin';
  programAssociation?: string;
  department: string;
  position: string;
  status: string;
  phone?: string;
  officeLocation?: string;
  qualifications?: string;
  specialization?: string;
  dateOfJoining: string;
  dob: string;
}

interface ActionResult {
  success: boolean;
  error?: string;
  staffId?: string;
  password?: string;
}

export async function getStaff(): Promise<Teacher[]> {
  console.log("Server Action: getStaff invoked.");
  try {
    const [teachersSnapshot, adminsSnapshot] = await Promise.all([
        db.collection('teachers').get(),
        db.collection('admins').get()
    ]);

    const staff: Teacher[] = [];

    const processSnapshot = (snapshot: FirebaseFirestore.QuerySnapshot, role: 'teacher' | 'admin') => {
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (!data.user_uid || !data.name) return;

            const position = data.position || data.designation;
            staff.push({
              id: doc.id,
              uid: data.user_uid,
              name: data.name || null,
              email: data.email || null,
              collegeId: null, 
              staffId: data.staffId || null,
              avatarUrl: data.avatarUrl || null,
              initials: data.initials || null,
              status: data.status || null,
              dob: data.dob || null,
              program: role === 'teacher' ? (data.program || null) : 'General Administration',
              department: data.department || null,
              branch: null, 
              position: position || null,
              designation: position || null,
              type: position || null,
              role: role,
              joinDate: data.joinDate ? (data.joinDate.toDate ? data.joinDate.toDate().toISOString().split('T')[0] : typeof data.joinDate === 'string' ? data.joinDate : null) : null,
              qualifications: data.qualifications || null,
              specialization: data.specialization || null,
              year: null, semester: null, batch: null, section: null, emergencyContact: null,
            });
        });
    }

    processSnapshot(teachersSnapshot, 'teacher');
    processSnapshot(adminsSnapshot, 'admin');

    staff.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    console.log(`Server Action: getStaff - Successfully fetched and mapped ${staff.length} staff members.`);
    return staff;
  } catch (error: any) {
    console.error("Server Action Error in getStaff:", error);
    throw new Error("Failed to fetch staff from server.");
  }
}

export async function getTeachers(): Promise<Teacher[]> {
  console.log("Server Action: getTeachers invoked.");
  try {
    const teachersSnapshot = await db.collection('teachers').limit(100).get();
    if (teachersSnapshot.empty) {
      console.log("Server Action: getTeachers - No teacher documents found.");
      return [];
    }

    const teachers: Teacher[] = teachersSnapshot.docs
      .map(doc => {
        const data = doc.data();
        if (!data.user_uid || !data.name) {
            return null;
        }
        const position = data.position || data.designation;
        return {
          id: doc.id,
          uid: data.user_uid,
          name: data.name,
          email: data.email || null,
          collegeId: null,
          staffId: data.staffId || null,
          avatarUrl: data.avatarUrl || null,
          initials: data.initials || null,
          status: data.status || null,
          dob: data.dob || null,
          program: data.program || null,
          department: data.department || null,
          branch: null, 
          position: position || null,
          designation: position || null,
          type: position || null,
          role: 'teacher',
          joinDate: data.joinDate ? (data.joinDate.toDate ? data.joinDate.toDate().toISOString().split('T')[0] : typeof data.joinDate === 'string' ? data.joinDate : null) : null,
          qualifications: data.qualifications || null,
          specialization: data.specialization || null,
          year: null,
          semester: null,
          batch: null,
          section: null,
          emergencyContact: null,
        };
      })
      .filter((teacher): teacher is Teacher => teacher !== null);

    teachers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    console.log(`Server Action: getTeachers - Successfully mapped ${teachers.length} assignable teachers.`);
    return teachers;
  } catch (error: any) {
    console.error("Server Action Error in getTeachers:", error);
    throw new Error("Failed to fetch teachers from server.");
  }
}

export async function createStaffAccount(values: ServerAddStaffFormValues): Promise<ActionResult> {
  console.log("Server Action: createStaffAccount invoked.");
  
  const {
    firstName, lastName, email, dob, dateOfJoining, role, programAssociation,
    department, position, status, phone, officeLocation, qualifications, specialization
  } = values;
  
  let authUserUid: string | null = null;
  const staffCollectionName = role === 'teacher' ? 'teachers' : 'admins';
  const newStaffDocRef = db.collection(staffCollectionName).doc(); 

  try {
    try { await auth.getUserByEmail(email); return { success: false, error: `Email ${email} is already in use.` }; }
    catch (error: any) { if (error.code !== 'auth/user-not-found') throw error; }

    const generatedPassword = generatePassword(firstName, dob);
    if (!generatedPassword) return { success: false, error: "Invalid Date of Birth provided." };
    
    let generatedStaffId = '';
    
    await db.runTransaction(async (transaction: Transaction) => {
        const rolePrefix = role === 'admin' ? "ADM" : "TCH";
        const deptCode = getDepartmentCode(department, programAssociation);
        const dojYearShort = new Date(dateOfJoining).getFullYear().toString().substring(2);
        const idPrefix = `${rolePrefix}${dojYearShort}${deptCode}`;

        const counterRef = db.collection('counters').doc(`staff_${idPrefix}`);
        const counterDoc = await transaction.get(counterRef);
        const newSequence = (counterDoc.data()?.current || 0) + 1;
        generatedStaffId = `${idPrefix}${newSequence.toString().padStart(4, '0')}`;
        transaction.set(counterRef, { current: newSequence }, { merge: true });
    });

    const authUserRecord = await auth.createUser({
        email, emailVerified: false, password: generatedPassword, displayName: `${firstName} ${lastName}`.trim(),
    });
    authUserUid = authUserRecord.uid;
    await auth.setCustomUserClaims(authUserUid, { role: role, staff_doc_id: newStaffDocRef.id, staff_id: generatedStaffId });

    const batchWrite = db.batch();
    const currentTime = FieldValue.serverTimestamp();
    const staffName = `${firstName} ${lastName}`.trim();
    const staffInitials = staffName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '??';
    const staffAvatarUrl = `https://placehold.co/100x100.png?text=${staffInitials}`;

    const userProfileData = {
        uid: authUserUid, name: staffName, email, role,
        staffDocId: newStaffDocRef.id, staffId: generatedStaffId,
        collegeId: null, initials: staffInitials, avatarUrl: staffAvatarUrl,
        createdAt: currentTime, updatedAt: currentTime,
    };
    batchWrite.set(db.collection('users').doc(authUserUid), userProfileData);

    const staffProfileData: any = {
        id: newStaffDocRef.id, user_uid: authUserUid, staffId: generatedStaffId,
        name: staffName, email, department, position, designation: position, status,
        avatarUrl: staffAvatarUrl, initials: staffInitials, phone: phone || null,
        officeLocation: officeLocation || null, qualifications: qualifications || null,
        specialization: specialization || null, dob,
        joinDate: dateOfJoining ? Timestamp.fromDate(new Date(dateOfJoining)) : currentTime,
        createdAt: currentTime, updatedAt: currentTime,
    };
    if (role === 'teacher') staffProfileData.program = programAssociation;
    else staffProfileData.program = "General Administration";

    batchWrite.set(newStaffDocRef, staffProfileData);
    
    await batchWrite.commit();

    return { success: true, staffId: generatedStaffId, password: generatedPassword };

  } catch (error: any) {
    console.error("Server Action Error in createStaffAccount:", error);
    if (authUserUid) await auth.deleteUser(authUserUid).catch(e => console.error("Failed to clean up orphaned auth user:", e));
    return { success: false, error: error.message || "An unexpected server error occurred." };
  }
}

export async function updateStaff(staffDocId: string, role: 'teacher' | 'admin', values: ClientAddStaffFormValues): Promise<ActionResult> {
    console.log(`Server Action: updateStaff invoked for doc ID: ${staffDocId}`);

    if (!staffDocId || !role) return { success: false, error: "Staff Document ID and role are required." };

    const staffCollectionName = role === 'teacher' ? 'teachers' : 'admins';
    const staffDocRef = db.collection(staffCollectionName).doc(staffDocId);

    try {
        await db.runTransaction(async (transaction) => {
            const staffDoc = await transaction.get(staffDocRef);
            if (!staffDoc.exists) throw new Error("Staff member not found.");
            
            const staffData = staffDoc.data()!;
            const userUid = staffData.user_uid;
            if (!userUid) throw new Error("Associated user account link is missing.");

            const userRef = db.collection('users').doc(userUid);
            const classesQuery = db.collection('classes').where('teacherId', '==', userUid);
            const classesSnapshot = await transaction.get(classesQuery);
            
            const newName = `${values.firstName} ${values.lastName}`.trim();

            const staffUpdateData: any = {
                name: newName, email: values.email, department: values.department,
                position: values.position, designation: values.position, status: values.status,
                phone: values.phone || null, officeLocation: values.officeLocation || null,
                qualifications: values.qualifications || null, specialization: values.specialization || null,
                dob: values.dob, joinDate: values.dateOfJoining ? Timestamp.fromDate(new Date(values.dateOfJoining)) : staffData.joinDate,
                updatedAt: FieldValue.serverTimestamp(),
            };
            if (role === 'teacher') staffUpdateData.program = values.programAssociation;
            transaction.update(staffDocRef, staffUpdateData);

            transaction.update(userRef, { name: newName, email: values.email, updatedAt: FieldValue.serverTimestamp() });

            if (!classesSnapshot.empty && newName !== staffData.name) {
                 classesSnapshot.forEach(doc => transaction.update(doc.ref, { teacherName: newName, updatedAt: FieldValue.serverTimestamp() }));
            }
        });
        
        const updatedStaffDoc = await staffDocRef.get();
        const updatedStaffData = updatedStaffDoc.data()!;
        await auth.updateUser(updatedStaffData.user_uid, { email: values.email, displayName: `${values.firstName} ${values.lastName}`.trim() });

        return { success: true, message: "Staff profile updated successfully." };
    } catch (error: any) {
        console.error(`Error updating staff ${staffDocId}:`, error);
        return { success: false, error: error.message || "An unexpected server error occurred." };
    }
}


export async function getAssignableTeachers(program: string): Promise<Teacher[]> {
  console.log(`Server Action: getAssignableTeachers for program "${program}" invoked.`);
  try {
    const teacherQuery = db.collection('teachers').where('program', '==', program);
    const [teachersSnapshot, adminsSnapshot] = await Promise.all([
      teacherQuery.get(),
      db.collection('admins').get(),
    ]);

    const staff: Teacher[] = [];

    const processSnapshot = (snapshot: FirebaseFirestore.QuerySnapshot, role: 'teacher' | 'admin') => {
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (!data.user_uid || !data.name) return;

            const position = data.position || data.designation;
            staff.push({
              id: doc.id,
              uid: data.user_uid,
              name: data.name,
              email: data.email || null,
              collegeId: null, 
              staffId: data.staffId || null,
              avatarUrl: data.avatarUrl || null,
              initials: data.initials || null,
              status: data.status || null,
              dob: data.dob || null,
              program: role === 'teacher' ? (data.program || null) : 'General Administration',
              department: data.department || null,
              branch: null,
              position: position || null,
              designation: position || null,
              type: position || null,
              role: role,
              joinDate: data.joinDate ? (data.joinDate.toDate ? data.joinDate.toDate().toISOString().split('T')[0] : typeof data.joinDate === 'string' ? data.joinDate : null) : null,
              qualifications: data.qualifications || null,
              specialization: data.specialization || null,
              year: null, semester: null, batch: null, section: null, emergencyContact: null,
            });
        });
    }

    processSnapshot(teachersSnapshot, 'teacher');
    processSnapshot(adminsSnapshot, 'admin');

    staff.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    console.log(`Server Action: getAssignableTeachers - Found ${staff.length} assignable staff.`);
    return staff;

  } catch (error: any) {
    console.error("Server Action Error in getAssignableTeachers:", error);
    throw new Error("Failed to fetch assignable teachers from server.");
  }
}


type TeacherClassForSchedule = {
    id: string;
    courseCode: string;
    courseName: string;
    class: string;
    semester: number;
};

export interface FullTeacherData {
    profile: Teacher;
    coursesAssigned: { id: string; code: string; name: string; semester: number; class: string; }[];
    schedule: ScheduleEntry[];
    responsibilities: string[];
}

export async function getTeacherProfileDetails(teacherDocId: string): Promise<FullTeacherData | null> {
    const teacherDocRef = db.collection("teachers").doc(teacherDocId);
    const teacherDocSnap = await teacherDocRef.get();

    if (!teacherDocSnap.exists) {
        console.error(`No teacher found with doc ID: ${teacherDocId}`);
        return null;
    }
    const teacherData = teacherDocSnap.data()!;

    const position = teacherData.position || teacherData.designation;
    const profile: Teacher = {
        id: teacherDocSnap.id,
        name: teacherData.name || '[Name Not Set]',
        uid: teacherData.user_uid || null,
        collegeId: null,
        staffId: teacherData.staffId || 'N/A',
        email: teacherData.email || '[Not Provided]',
        phone: teacherData.phone || '[Not Provided]',
        avatarUrl: teacherData.avatarUrl || null,
        initials: teacherData.initials || '??',
        status: teacherData.status || 'Unknown',
        dob: teacherData.dob || null,
        officeLocation: teacherData.officeLocation || 'N/A',
        program: teacherData.program || 'N/A',
        department: teacherData.department || 'N/A',
        branch: null,
        position: position || 'N/A',
        designation: position || 'N/A',
        type: position || null,
        role: 'teacher',
        joinDate: teacherData.joinDate ? (teacherData.joinDate.toDate ? teacherData.joinDate.toDate().toISOString().split('T')[0] : typeof teacherData.joinDate === 'string' ? teacherData.joinDate : 'N/A') : 'N/A',
        qualifications: teacherData.qualifications || 'N/A',
        specialization: teacherData.specialization || 'N/A',
        year: null,
        semester: null,
        batch: null,
        section: null,
        emergencyContact: null,
    };

    let coursesAssigned: TeacherClassForSchedule[] = [];
    let schedule: ScheduleEntry[] = [];
    let responsibilities: string[] = []; 
    
    try {
        if (teacherData.user_uid) {
            coursesAssigned = await fetchTeacherClassesForSchedule(teacherData.user_uid);
            schedule = await getTeacherSchedule(teacherData.user_uid, coursesAssigned);
        } else {
            console.warn(`Teacher document ${teacherDocId} is missing user_uid. Schedule and course data cannot be fetched.`);
        }
    } catch (e: any) {
        console.error(`Failed to fetch schedule or class details for teacher ${teacherDocId}:`, e);
    }
    
    return {
        profile,
        coursesAssigned: coursesAssigned.map(c => ({ id: c.id, code: c.courseCode, name: c.courseName, semester: c.semester, class: c.class })),
        schedule,
        responsibilities, 
    };
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

async function getTeacherSchedule(teacherId: string, assignedClasses: TeacherClassForSchedule[]): Promise<ScheduleEntry[]> {
    if (!teacherId || assignedClasses.length === 0) return [];
    
    console.log(`Generating deterministic schedule for teacher ${teacherId}...`);

    try {
        const schedule: ScheduleEntry[] = [];
        const slotsPerDay = 6;
        const days: ScheduleEntry['day'][] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        
        let classIndex = simpleHash(teacherId) % assignedClasses.length;

        for (const day of days) {
            for (let period = 1; period <= slotsPerDay; period++) {
                const course = assignedClasses[classIndex];
                const slotHash = simpleHash(`${course.id}-${day}-${period}`);
                
                const isScheduled = (slotHash % 10) < 4;
                const previousPeriodEntry = schedule.find(s => s.day === day && s.period === period - 1);
                
                if (isScheduled && previousPeriodEntry?.courseCode !== course.courseCode) {
                    schedule.push({
                        day,
                        period: period as ScheduleEntry['period'],
                        courseCode: course.courseCode,
                        courseName: course.courseName,
                        class: course.class,
                        location: `Room ${100 + (simpleHash(course.id) % 10) * 10 + period}`,
                        classId: course.id,
                    });
                    classIndex = (classIndex + 1) % assignedClasses.length;
                }
            }
        }
        return schedule;
    } catch(err) {
        console.error("Could not generate teacher schedule:", err);
        return [];
    }
};

export async function deleteTeacher(teacherDocId: string): Promise<ActionResult> {
  console.log(`Server Action: deleteTeacher invoked for doc ID: ${teacherDocId}`);
  if (!teacherDocId) return { success: false, error: "Teacher Document ID is required." };

  const teacherRef = db.collection('teachers').doc(teacherDocId);
  const teacherDoc = await teacherRef.get();

  if (!teacherDoc.exists) return { success: false, error: "Teacher not found." };
  
  const teacherData = teacherDoc.data()!;
  const userUid = teacherData.user_uid;

  try {
    if (userUid) await auth.deleteUser(userUid);

    const batch = db.batch();
    
    const classesQuery = db.collection('classes').where('teacherId', '==', userUid);
    const classesSnapshot = await classesQuery.get();
    if (!classesSnapshot.empty) {
        classesSnapshot.forEach(doc => batch.update(doc.ref, { teacherId: null, teacherName: 'N/A' }));
    }

    batch.delete(teacherRef);
    if (userUid) batch.delete(db.collection('users').doc(userUid));
    
    await batch.commit();
    console.log(`Successfully deleted documents for teacher doc ID ${teacherDocId}`);

    return { success: true, message: `Teacher ${teacherData.name} and their account have been permanently deleted.` };
  } catch (error: any) {
    console.error(`Error deleting teacher ${teacherDocId}:`, error);
    return { success: false, error: error.message || "An unexpected error occurred during deletion." };
  }
}
