
'use server';

import { auth, db } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp, Transaction } from 'firebase-admin/firestore';
import type { SignupFormValues as ClientSignupFormValues } from '@/components/auth/signup-form';
import type { AdminSignupFormValues } from '@/components/auth/admin-signup-form';
import { createNotificationsForRoles } from './notification-actions';

interface ActionResult {
  success: boolean;
  error?: string;
}

export async function linkMissingProfile(uid: string, email: string): Promise<{ success: boolean; error?: string }> {
  console.log(`Server Action: linkMissingProfile invoked for uid: ${uid}`);
  
  if (!uid || !email) {
    return { success: false, error: 'User ID and email are required.' };
  }

  try {
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return { success: false, error: 'User record not found.' };
    }

    const userData = userDoc.data()!;
    
    // Check if profile is already linked
    if (userData.studentDocId || userData.staffDocId) {
        return { success: true }; // Already linked, no action needed.
    }
    
    let profileId: string | null = null;
    let profileCollection: string | null = null;

    if (userData.role === 'student') {
      profileCollection = 'students';
      const studentQuery = db.collection(profileCollection).where('email', '==', email).limit(1);
      const studentSnap = await studentQuery.get();
      if (!studentSnap.empty) {
        profileId = studentSnap.docs[0].id;
      }
    } else if (userData.role === 'teacher' || userData.role === 'admin') {
      profileCollection = userData.role === 'teacher' ? 'teachers' : 'admins';
      const staffQuery = db.collection(profileCollection).where('email', '==', email).limit(1);
      const staffSnap = await staffQuery.get();
      if (!staffSnap.empty) {
        profileId = staffSnap.docs[0].id;
      }
    }

    if (profileId && profileCollection) {
      const fieldToUpdate = userData.role === 'student' ? 'studentDocId' : 'staffDocId';
      await userDocRef.update({ [fieldToUpdate]: profileId });
      console.log(`Successfully linked profile ${profileId} for user ${uid}`);
      return { success: true };
    } else {
      return { success: false, error: 'Could not find a matching profile to link.' };
    }

  } catch (error: any) {
    console.error(`Error in linkMissingProfile for ${uid}:`, error);
    return { success: false, error: 'An unexpected server error occurred during profile linking.' };
  }
}


// This action is specifically for student self-registration.
export async function studentSelfRegister(values: ClientSignupFormValues): Promise<ActionResult> {
  console.log("Server Action: studentSelfRegister invoked with:", values.email);

  const { firstName, lastName, email, password, studentId, gender } = values;

  // Basic validation
  if (!firstName || !lastName || !email || !password || !studentId || !gender) {
    return { success: false, error: "Missing required fields for registration." };
  }

  let authUserRecord;
  const studentCollegeId = studentId.trim();
  const newStudentDocRef = db.collection('students').doc(); // Auto-generate the internal doc ID

  try {
    // Check if email already exists in Auth
    try {
        await auth.getUserByEmail(email);
        return { success: false, error: "This email address is already registered. Please try logging in." };
    } catch (error: any) {
        if (error.code !== 'auth/user-not-found') {
            console.error("Error checking email in Auth:", error);
            throw error; // Re-throw unexpected errors
        }
    }

    // Check if student's collegeId already exists in the students collection
    const studentWithCollegeIdQuery = db.collection('students').where('collegeId', '==', studentCollegeId);
    const existingStudentSnap = await studentWithCollegeIdQuery.get();
    if (!existingStudentSnap.empty) {
      return { success: false, error: `This Student ID (${studentCollegeId}) is already registered. Please contact administration if you believe this is an error.` };
    }

    // 1. Create Firebase Auth user
    authUserRecord = await auth.createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`.trim(),
      emailVerified: false, // User must verify their email
    });
    console.log("Successfully created new auth user:", authUserRecord.uid);

    // 2. Set Custom Claims for the new user, using the NEW internal document ID
    await auth.setCustomUserClaims(authUserRecord.uid, {
      role: 'student',
      student_doc_id: newStudentDocRef.id,
      college_id: studentCollegeId,
    });
    console.log("Successfully set custom claims for user:", authUserRecord.uid);

    // 3. Create user, student, and fee documents in Firestore within a batch
    const batch = db.batch();
    const currentTime = FieldValue.serverTimestamp();
    const studentName = `${firstName} ${lastName}`.trim();
    const userInitials = studentName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '??';
    
    // User Document
    const userDocFirestoreRef = db.collection('users').doc(authUserRecord.uid);
    const userProfileData = {
      uid: authUserRecord.uid,
      name: studentName,
      email: email,
      role: 'student',
      studentDocId: newStudentDocRef.id, // The new, correct internal document ID
      collegeId: studentCollegeId, // The human-readable ID
      staffId: null,
      initials: userInitials,
      avatarUrl: `https://placehold.co/100x100.png?text=${userInitials}`,
      program: 'Not Yet Assigned',
      branch: 'Not Yet Assigned',
      year: 1, // Default
      createdAt: currentTime,
      updatedAt: currentTime,
    };
    batch.set(userDocFirestoreRef, userProfileData);

    // Student Document (using the auto-generated ID)
    const studentProfileData = {
      user_uid: authUserRecord.uid,
      id: newStudentDocRef.id, // The internal ID
      collegeId: studentCollegeId, // The human-readable ID
      name: studentName,
      email: email,
      gender,
      status: 'Pending Approval',
      avatarUrl: userProfileData.avatarUrl,
      initials: userInitials,
      program: 'Not Yet Assigned',
      branch: 'Not Yet Assigned',
      year: 1, // Default
      semester: 1, // Default
      batch: new Date().getFullYear().toString(),
      type: 'Day Scholar', // Default
      dob: 'N/A',
      createdAt: currentTime,
      updatedAt: currentTime,
    };
    batch.set(newStudentDocRef, studentProfileData);
    
    // Fee Document (using the new student document ID)
    const feeDocRef = db.collection('fees').doc(newStudentDocRef.id);
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + 2);
    const feeProfileData = {
        studentDocId: newStudentDocRef.id,
        studentCollegeId: studentCollegeId,
        studentName: studentName,
        program: 'Not Yet Assigned',
        branch: 'Not Yet Assigned',
        totalFees: 150000,
        amountPaid: 0,
        balance: 150000,
        dueDate: Timestamp.fromDate(dueDate),
        paymentHistory: [],
        createdAt: currentTime,
        updatedAt: currentTime,
    };
    batch.set(feeDocRef, feeProfileData);


    await batch.commit();
    console.log("Firestore documents created successfully for new student.");

    // 4. Send notification to all admins
    await createNotificationsForRoles(
        ['admin'],
        'New Student Registration',
        `${firstName} ${lastName} (${studentCollegeId}) has registered and is pending approval.`,
        'task',
        `/admin/students?status=Pending+Approval`
    );


    return { success: true };

  } catch (error: any) {
    console.error("Error in studentSelfRegister server action:", error);
    // Attempt to clean up the created auth user if Firestore operations fail
    if (authUserRecord?.uid) {
      await auth.deleteUser(authUserRecord.uid).catch(e => console.error("Failed to clean up orphaned auth user:", e));
    }
    return { success: false, error: error.message || "An unexpected server error occurred." };
  }
}

// --- ADMIN SELF REGISTRATION ---

const ADMIN_SIGNUP_CODE = 'SECRETADMIN2024';

const getDepartmentCode = (department: string): string => {
  if (department.toUpperCase().includes("ADMINISTRATION")) return "AD";
  return department.substring(0, Math.min(department.length, 2)).toUpperCase();
};

export async function adminSelfRegister(values: AdminSignupFormValues): Promise<ActionResult> {
  console.log("Server Action: adminSelfRegister invoked with:", values.email);

  if (values.adminCode !== ADMIN_SIGNUP_CODE) {
    return { success: false, error: "Invalid Admin Code. Registration denied." };
  }
  
  const { firstName, lastName, email, password } = values;

  let authUserUid: string | null = null;
  
  try {
    await auth.getUserByEmail(email);
    return { success: false, error: `Email ${email} is already in use.` };
  } catch (error: any) {
    if (error.code !== 'auth/user-not-found') throw error;
  }

  let generatedStaffId = '';
  const defaultDepartment = 'General Administration';
  const role = 'admin';

  try {
    await db.runTransaction(async (transaction: Transaction) => {
        const rolePrefix = "ADM";
        const deptCode = getDepartmentCode(defaultDepartment);
        const dojYearShort = new Date().getFullYear().toString().substring(2);
        const idPrefix = `${rolePrefix}${dojYearShort}${deptCode}`;

        const counterRef = db.collection('counters').doc(`staff_${idPrefix}`);
        const counterDoc = await transaction.get(counterRef);
        const newSequence = (counterDoc.data()?.current || 0) + 1;
        generatedStaffId = `${idPrefix}${newSequence.toString().padStart(4, '0')}`;

        if (!counterDoc.exists) {
            transaction.set(counterRef, { current: newSequence });
        } else {
            transaction.update(counterRef, { current: newSequence });
        }
    });

    const newAdminDocRef = db.collection('admins').doc(); // Auto-generate internal ID

    const authUserRecord = await auth.createUser({
        email,
        password,
        displayName: `${firstName} ${lastName}`.trim(),
        emailVerified: true, // Auto-verify admins created this way
    });
    authUserUid = authUserRecord.uid;
    await auth.setCustomUserClaims(authUserUid, { role: role, staff_id: generatedStaffId, staff_doc_id: newAdminDocRef.id });

    const batchWrite = db.batch();
    const currentTime = FieldValue.serverTimestamp();
    const adminName = `${firstName} ${lastName}`.trim();
    const initials = adminName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '??';
    const avatarUrl = `https://placehold.co/100x100.png?text=${initials}`;

    const userProfileData = {
        uid: authUserUid,
        name: adminName,
        email,
        role,
        staffId: generatedStaffId,
        staffDocId: newAdminDocRef.id,
        collegeId: null,
        initials,
        avatarUrl,
        createdAt: currentTime,
        updatedAt: currentTime,
    };
    batchWrite.set(db.collection('users').doc(authUserUid), userProfileData);

    const adminProfileData = {
        user_uid: authUserUid,
        id: newAdminDocRef.id,
        staffId: generatedStaffId,
        name: adminName,
        email,
        department: defaultDepartment,
        position: 'Administrator',
        designation: 'Administrator',
        status: 'Active',
        avatarUrl,
        initials,
        phone: null,
        officeLocation: null,
        qualifications: null,
        specialization: null,
        dob: null,
        joinDate: currentTime,
        createdAt: currentTime,
        updatedAt: currentTime,
    };
    batchWrite.set(newAdminDocRef, adminProfileData);
    
    await batchWrite.commit();

    return { success: true };

  } catch (error: any) {
    console.error("Error in adminSelfRegister action:", error);
    if (authUserUid) {
      await auth.deleteUser(authUserUid).catch(e => console.error("Failed to clean up orphaned auth user:", e));
    }
    return { success: false, error: error.message || "An unexpected server error occurred." };
  }
}
