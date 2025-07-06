// src/lib/seed-admin.ts
import { auth, db } from './firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const ADMIN_EMAIL = 'krishnateja0442@gmail.com';
const ADMIN_PASSWORD = 'teja7781';
const ADMIN_NAME = 'charan jit';
const ADMIN_STAFF_ID = 'ADM24GA0001'; // Hardcoded for simplicity

async function seedAdmin() {
  console.log(`Checking for existing admin user: ${ADMIN_EMAIL}...`);

  try {
    // Check if user already exists
    await auth.getUserByEmail(ADMIN_EMAIL);
    console.log(`Admin user with email ${ADMIN_EMAIL} already exists. Aborting seed.`);
    return;
  } catch (error: any) {
    if (error.code !== 'auth/user-not-found') {
      console.error('Error checking for user:', error);
      throw error;
    }
    // User does not exist, proceed with creation
    console.log('No existing admin found. Proceeding to create one.');
  }

  let newUserUid: string | null = null;
  try {
    // 1. Create Auth user
    const userRecord = await auth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: ADMIN_NAME,
      emailVerified: true, // Let's verify them since this is a manual seed
    });
    newUserUid = userRecord.uid;
    console.log(`Successfully created Auth user with UID: ${newUserUid}`);

    // 2. Set custom claims
    await auth.setCustomUserClaims(newUserUid, {
      role: 'admin',
      staff_id: ADMIN_STAFF_ID,
      staff_doc_id: ADMIN_STAFF_ID,
    });
    console.log('Successfully set custom claims for admin role.');

    // 3. Create Firestore documents
    const batch = db.batch();
    const currentTime = FieldValue.serverTimestamp();
    const initials = ADMIN_NAME.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '??';
    const avatarUrl = `https://placehold.co/100x100.png?text=${initials}`;

    // User document
    const userDocRef = db.collection('users').doc(newUserUid);
    batch.set(userDocRef, {
      uid: newUserUid,
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      role: 'admin',
      initials,
      avatarUrl,
      staffId: ADMIN_STAFF_ID,
      staffDocId: ADMIN_STAFF_ID,
      collegeId: null, // collegeId is null for staff
      department: 'General Administration',
      createdAt: currentTime,
      updatedAt: currentTime,
    });

    // Admin document
    const adminDocRef = db.collection('admins').doc(ADMIN_STAFF_ID);
    batch.set(adminDocRef, {
        user_uid: newUserUid,
        id: ADMIN_STAFF_ID,
        staffId: ADMIN_STAFF_ID,
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        department: 'General Administration',
        position: 'Super Admin',
        designation: 'Super Admin',
        status: 'Active',
        avatarUrl,
        initials,
        phone: null,
        officeLocation: 'Main Office',
        qualifications: 'N/A',
        specialization: 'N/A',
        dob: 'N/A',
        joinDate: currentTime,
        createdAt: currentTime,
        updatedAt: currentTime,
    });

    await batch.commit();
    console.log('Successfully created Firestore documents for admin user.');
    console.log('✅ Admin user created successfully!');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);

  } catch (error) {
    console.error('🔴 Error creating admin user:', error);
    // Cleanup if auth user was created but firestore failed
    if (newUserUid) {
      await auth.deleteUser(newUserUid).catch(e => console.error('Failed to cleanup orphaned auth user:', e));
    }
  }
}

// Execute the function
seedAdmin().catch(e => {
    console.error("Seeding script failed:", e);
    process.exit(1);
});
