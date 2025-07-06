
'use server';

import { db } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

interface User {
  uid: string;
}

export type NotificationType = 'alert' | 'task' | 'info' | 'event';

interface NotificationPayload {
  recipientUid: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string;
}

export async function createNotification(payload: NotificationPayload): Promise<{ success: boolean; error?: string }> {
  const { recipientUid, title, message, type, link } = payload;
  if (!recipientUid || !title || !message || !type) {
    return { success: false, error: 'Missing required fields for notification.' };
  }

  try {
    const notificationRef = db.collection('notifications').doc();
    await notificationRef.set({
      id: notificationRef.id,
      recipientUid,
      title,
      message,
      type,
      link: link || null,
      read: false,
      timestamp: FieldValue.serverTimestamp(),
    });
    console.log(`Notification created for user ${recipientUid}: ${title}`);
    return { success: true };
  } catch (error: any) {
    console.error('Error creating notification:', error);
    return { success: false, error: 'Failed to create notification.' };
  }
}

export async function createNotificationsForRoles(roles: string[], title: string, message: string, type: NotificationType, link?: string): Promise<{ success: boolean; error?: string; message?: string; }> {
    if (!roles || roles.length === 0) {
        return { success: false, error: 'No roles specified for notification.' };
    }

    try {
        const usersSnapshot = await db.collection('users').where('role', 'in', roles).get();
        if (usersSnapshot.empty) {
            const warningMessage = `No users found with roles: ${roles.join(', ')}. No notifications were sent.`;
            console.warn(warningMessage);
            return { success: true, message: warningMessage };
        }
        
        const uids = usersSnapshot.docs.map(doc => doc.id);
        return createNotificationsForUids(uids, title, message, type, link);

    } catch (error: any) {
        console.error('Error creating notifications for roles:', error);
        return { success: false, error: 'Failed to create notifications for roles.' };
    }
}


export async function createNotificationsForUids(uids: string[], title: string, message: string, type: NotificationType, link?: string): Promise<{ success: boolean; error?: string; message?: string; }> {
    if (!uids || uids.length === 0) {
        return { success: true, message: 'No user IDs provided, no notifications sent.' };
    }

    try {
        const batch = db.batch();
        uids.forEach(uid => {
            const notificationRef = db.collection('notifications').doc();
            batch.set(notificationRef, {
                id: notificationRef.id,
                recipientUid: uid,
                title,
                message,
                type,
                link: link || null,
                read: false,
                timestamp: FieldValue.serverTimestamp(),
            });
        });

        await batch.commit();
        const successMessage = `Notifications created for ${uids.length} specified users.`;
        console.log(successMessage);
        return { success: true, message: successMessage };
    } catch (error: any) {
        console.error('Error creating notifications for UIDs:', error);
        return { success: false, error: 'Failed to create notifications for specified users.' };
    }
}
