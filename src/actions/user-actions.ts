
'use server';

import { auth, db } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { linkMissingProfile } from './auth-actions';

interface ActionResult {
    success: boolean;
    error?: string;
    message?: string;
}

// Helper function to recursively serialize data, converting Timestamps to ISO strings.
function serializeData(data: any): any {
  if (data === null || typeof data !== 'object') {
    return data;
  }

  // Handle Firestore Timestamps
  if (data instanceof Timestamp) {
    return data.toDate().toISOString();
  }
  
  // Handle Date objects just in case
  if (data instanceof Date) {
    return data.toISOString();
  }

  // Handle arrays by serializing each item
  if (Array.isArray(data)) {
    return data.map(item => serializeData(item));
  }
  
  // Handle plain objects by serializing each value
  const serializedObject: { [key: string]: any } = {};
  for (const key in data) {
    // hasOwnProperty check is good practice
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      serializedObject[key] = serializeData(data[key]);
    }
  }
  return serializedObject;
}

export async function getUserProfileOnLogin(uid: string, email: string | null): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const userDocRef = db.collection('users').doc(uid);
    let userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      return { success: false, error: "Your user profile does not exist in the database. Please contact support." };
    }

    let userData = userDocSnap.data()!;
    let appSpecificId = userData.studentDocId || userData.staffDocId;

    // Self-healing logic moved to the server action
    if (!appSpecificId && email) {
      console.log(`Server Action: User ${uid} is missing profile ID. Attempting self-healing...`);
      const linkResult = await linkMissingProfile(uid, email);
      if (!linkResult.success) {
        throw new Error(linkResult.error || `Your profile is not correctly linked. Please contact administration. (Error code: L-APID)`);
      }
      // Re-fetch user data after potential update
      userDocSnap = await userDocRef.get();
      userData = userDocSnap.data()!;
      appSpecificId = userData.studentDocId || userData.staffDocId;
    }

    if (!appSpecificId) {
      throw new Error(`Your profile is critically misconfigured. Please contact administration. (Error code: L-APID-FINAL)`);
    }
    
    if (!userData.role) {
      throw new Error("Your user role is not defined. Please contact support.");
    }
    
    let fullProfileData: admin.firestore.DocumentData = {};
    const profileCollection = userData.role === 'student' ? 'students' : (userData.role === 'teacher' ? 'teachers' : 'admins');
    const profileDocSnap = await db.collection(profileCollection).doc(appSpecificId).get();
    if(profileDocSnap.exists) {
        fullProfileData = profileDocSnap.data()!;
    }
    
    // Denormalized write for the login activity feed. This is robust.
    await db.collection('loginActivities').add({
        userName: userData.name || 'Unknown',
        userRole: userData.role || 'unknown',
        timestamp: FieldValue.serverTimestamp()
    }).catch(logError => {
        // This is a non-critical operation, so we just log the error and continue.
        console.error("Failed to log login activity on server:", logError);
    });
    
    const combinedData = {
        ...fullProfileData,
        ...userData,
        id: appSpecificId,
        uid: uid,
        email: email
    };

    // Serialize the combined data to make it safe to pass to client components
    const serializableData = serializeData(combinedData);

    return { success: true, data: serializableData };
  } catch (error: any) {
    console.error("Error in getUserProfileOnLogin action:", error);
    return { success: false, error: error.message || "An unexpected server error occurred while fetching your profile." };
  }
}

export async function sendPasswordResetLink(email: string): Promise<ActionResult> {
    if (!email) {
        return { success: false, error: 'Email address is required.' };
    }
    try {
        await auth.generatePasswordResetLink(email);
        return { success: true, message: `A password reset link has been sent to ${email} if the account exists.` };
    } catch (error: any) {
        console.error('Error sending password reset link:', error);
        // For security, don't reveal if an email exists or not.
        if (error.code === 'auth/user-not-found') {
            return { success: true, message: `A password reset link has been sent to ${email} if the account exists.` };
        }
        return { success: false, error: 'An unexpected error occurred. Please try again later.' };
    }
}

export async function updateNotificationPreferences(uid: string, enabled: boolean): Promise<ActionResult> {
    if (!uid) {
        return { success: false, error: 'User ID is required.' };
    }

    try {
        const userDocRef = db.collection('users').doc(uid);
        await userDocRef.set({
            settings: {
                notifications: {
                    enabled: enabled
                }
            }
        }, { merge: true });
        
        await userDocRef.update({
            updatedAt: FieldValue.serverTimestamp(),
        });
        
        return { success: true, message: `Notification preferences updated.` };
    } catch (error: any) {
        console.error('Error updating notification preferences:', error);
        return { success: false, error: 'Failed to update preferences.' };
    }
}

export async function getUserSettings(uid: string): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!uid) {
        return { success: false, error: 'User ID is required.' };
    }

    try {
        const userDocRef = db.collection('users').doc(uid);
        const docSnap = await userDocRef.get();

        if (!docSnap.exists) {
            return { success: false, error: 'User profile not found.' };
        }

        const settings = docSnap.data()?.settings || { notifications: { enabled: true } };
        return { success: true, data: settings };
    } catch (error: any) {
        console.error('Error fetching user settings:', error);
        return { success: false, error: 'Failed to fetch settings.' };
    }
}
