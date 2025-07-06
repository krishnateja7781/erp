
'use server';

import { db } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Placement, Internship } from '@/lib/types';


// --- STUDENT-FACING ACTIONS ---

type ApplicationType = 'internship' | 'placement';

interface SubmitApplicationPayload {
    userId: string; // The auth UID of the student
    studentId: string; // The college ID of the student
    opportunityId: string;
    opportunityType: ApplicationType;
    company: string;
    role: string;
}

interface ActionResult {
    success: boolean;
    error?: string;
    message?: string;
}

export async function submitApplication(payload: SubmitApplicationPayload): Promise<ActionResult> {
    const { userId, studentId, opportunityId, opportunityType, company, role } = payload;
    console.log(`Server Action: submitApplication invoked by student ${studentId} for ${opportunityType} ID ${opportunityId}`);

    if (!userId || !studentId || !opportunityId || !opportunityType) {
        return { success: false, error: "Missing required fields for application." };
    }

    try {
        const applicationDocRef = db.collection('applications').doc(`${userId}_${opportunityId}`);
        const docSnap = await applicationDocRef.get();

        if (docSnap.exists) {
            return { success: false, error: `You have already applied for this ${opportunityType}.` };
        }

        const applicationData = {
            studentUid: userId,
            studentId,
            opportunityId,
            opportunityType,
            company,
            role,
            status: 'Applied', // Initial status
            appliedAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };

        await applicationDocRef.set(applicationData);

        console.log(`Successfully submitted application for student ${studentId} to ${company}.`);
        return { success: true, message: `Your application for the ${role} role at ${company} has been submitted.` };

    } catch (error: any) {
        console.error(`Server Action Error in submitApplication for student ${studentId}:`, error);
        return { success: false, error: error.message || `An unexpected error occurred while submitting your application.` };
    }
}


// --- ADMIN-FACING ACTIONS ---

export async function getOpportunities(type: 'placement' | 'internship'): Promise<(Placement[] | Internship[])> {
    try {
        const snapshot = await db.collection('placements').where('type', '==', type).orderBy('postedAt', 'desc').get();
        if (snapshot.empty) {
            return [];
        }
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Placement | Internship));
    } catch (error: any) {
        console.error(`Error fetching ${type} opportunities:`, error);
        throw new Error(`Failed to fetch ${type} opportunities.`);
    }
}

export type OpportunityData = Omit<Placement, 'id' | 'postedAt'> | Omit<Internship, 'id' | 'postedAt'>;

export async function saveOpportunity(opportunity: OpportunityData & { id?: string }): Promise<ActionResult> {
    try {
        if (opportunity.id) {
            // Update existing opportunity
            const { id, ...dataToUpdate } = opportunity;
            await db.collection('placements').doc(id).set({
                ...dataToUpdate,
                updatedAt: FieldValue.serverTimestamp()
            }, { merge: true });
            return { success: true, message: `${opportunity.type} updated successfully.` };
        } else {
            // Add new opportunity
            const docRef = await db.collection('placements').add({
                ...opportunity,
                postedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
            return { success: true, message: `${opportunity.type} added successfully with ID ${docRef.id}.` };
        }
    } catch (error: any) {
        console.error("Error saving opportunity:", error);
        return { success: false, error: "Failed to save opportunity." };
    }
}

export async function deleteOpportunity(id: string): Promise<ActionResult> {
    try {
        await db.collection('placements').doc(id).delete();
        return { success: true, message: `Opportunity ${id} deleted successfully.` };
    } catch (error: any) {
        console.error("Error deleting opportunity:", error);
        return { success: false, error: "Failed to delete opportunity." };
    }
}
