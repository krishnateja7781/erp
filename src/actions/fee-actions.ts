
'use server';

import { db, adminSDK } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { sendPaymentReceiptEmail, sendInvoiceEmail } from '@/ai/flows/email-flow';
import type { InvoiceData } from '@/components/student/invoice-display';
import { createNotification, createNotificationsForRoles } from './notification-actions';

interface RecordPaymentPayload {
    studentDocId: string;
    amount: number;
    reference: string;
    notes?: string;
}

interface ActionResult {
    success: boolean;
    error?: string;
    message?: string;
}

export async function recordPayment(payload: RecordPaymentPayload): Promise<ActionResult> {
    const { studentDocId, amount, reference, notes } = payload;
    console.log(`Server Action: recordPayment invoked for student doc ID ${studentDocId} with amount ${amount}`);

    if (!studentDocId || !amount || !reference) {
        return { success: false, error: "Missing required fields: studentDocId, amount, and reference." };
    }
    if (typeof amount !== 'number' || amount <= 0) {
        return { success: false, error: "Payment amount must be a positive number." };
    }

    const feeDocRef = db.collection('fees').doc(studentDocId);
    const studentDocRef = db.collection('students').doc(studentDocId);

    try {
        const [feeDocSnap, studentDocSnap] = await Promise.all([feeDocRef.get(), studentDocRef.get()]);

        if (!feeDocSnap.exists) {
            return { success: false, error: `No fee record found for student with doc ID: ${studentDocId}` };
        }
        if (!studentDocSnap.exists) {
            console.warn(`Student document not found for doc ID ${studentDocId}, but proceeding with payment record.`);
        }

        const feeData = feeDocSnap.data()!;
        const studentData = studentDocSnap.data();

        const newPayment = {
            amount,
            reference,
            date: Timestamp.now(),
            recordedBy: 'admin',
            notes: notes || null,
            status: 'Success'
        };

        await feeDocRef.update({
            amountPaid: FieldValue.increment(amount),
            paymentHistory: FieldValue.arrayUnion(newPayment),
            updatedAt: FieldValue.serverTimestamp(),
        });
        
        console.log(`Successfully recorded payment for student doc ID ${studentDocId}`);
        
        if (studentData && studentData.user_uid) {
            createNotification({
                recipientUid: studentData.user_uid,
                title: 'Payment Received',
                message: `Your payment of ₹${amount.toLocaleString()} has been confirmed by the accounts department.`,
                type: 'info',
                link: '/student/fees',
            }).catch(e => console.error("Failed to send payment confirmation notification:", e));
        }

        return { success: true, message: `Payment of ${amount} recorded successfully.` };

    } catch (error: any) {
        console.error(`Server Action Error in recordPayment for student doc ID ${studentDocId}:`, error);
        return { success: false, error: error.message || "An unexpected error occurred while recording the payment." };
    }
}

interface SubmitPaymentPayload {
    studentDocId: string;
    studentName: string;
    studentEmail: string;
    amount: number;
    reference: string;
}

export async function submitPaymentConfirmation(payload: SubmitPaymentPayload): Promise<ActionResult> {
    const { studentDocId, studentName, studentEmail, amount, reference } = payload;
    console.log(`Server Action: submitPaymentConfirmation invoked for student doc ID ${studentDocId}`);

    if (!studentDocId || !amount || !reference || !studentName || !studentEmail) {
        return { success: false, error: "Missing required fields." };
    }

    const feeDocRef = db.collection('fees').doc(studentDocId);

    try {
        const feeDocSnap = await feeDocRef.get();
        if (!feeDocSnap.exists) {
            return { success: false, error: `No fee record found for student doc ID: ${studentDocId}` };
        }

        const newPayment = {
            amount,
            reference,
            date: Timestamp.now(),
            recordedBy: 'student',
            status: 'Pending Confirmation'
        };

        await feeDocRef.update({
            paymentHistory: FieldValue.arrayUnion(newPayment),
            updatedAt: FieldValue.serverTimestamp(),
        });

        const studentDoc = await db.collection('students').doc(studentDocId).get();
        const studentCollegeId = studentDoc.exists() ? studentDoc.data()?.collegeId : studentDocId;

        // Trigger email generation without blocking the response
        const feeData = feeDocSnap.data() || {};
        const totalFees = feeData.totalFees || 0;
        const amountPaid = feeData.amountPaid || 0;
        const balance = totalFees - amountPaid;

        sendPaymentReceiptEmail({
            studentName,
            studentEmail,
            amount,
            transactionId: reference,
            paymentDate: new Date().toISOString(),
            totalFees,
            totalPaid: amountPaid,
            balance,
        }).catch(emailError => {
            console.error(`Failed to trigger email generation for student ${studentDocId}:`, emailError);
        });

        // Send notification to Admins
        createNotificationsForRoles(
            ['admin'],
            'Payment Submitted',
            `${studentName} (${studentCollegeId}) submitted a payment of ₹${amount.toLocaleString()} for verification.`,
            'task',
            `/admin/fees`
        ).catch(e => console.error("Failed to send payment submission notification:", e));


        return { success: true, message: `Payment details submitted successfully. It will be verified by the accounts department.` };

    } catch (error: any) {
        console.error(`Server Action Error in submitPaymentConfirmation for student ${studentDocId}:`, error);
        return { success: false, error: error.message || "An unexpected error occurred while submitting payment details." };
    }
}

export async function getStudentInvoices(studentDocId: string): Promise<InvoiceData[]> {
    if (!studentDocId) return [];
    const feeDoc = await db.collection('fees').doc(studentDocId).get();
    if (!feeDoc.exists) return [];
    
    const feeData = feeDoc.data()!;
    const studentDoc = await db.collection('students').doc(studentDocId).get();
    const studentData = studentDoc.exists() ? studentDoc.data()! : {};

    const invoices: InvoiceData[] = (feeData.paymentHistory || [])
        .filter((p: any) => p.status?.toLowerCase() === 'success')
        .map((payment: any, index: number) => ({
            invoiceNumber: `INV-${studentData.collegeId?.slice(-4) || 'XXXX'}-${index + 1}`,
            issueDate: payment.date.toDate().toLocaleDateString(),
            dueDate: payment.date.toDate().toLocaleDateString(),
            status: 'Paid',
            studentName: studentData.name || feeData.studentName,
            studentId: studentData.collegeId,
            studentEmail: studentData.email || 'N/A',
            items: [
                { description: `Semester Fees Payment via Ref: ${payment.reference}`, amount: payment.amount }
            ],
            totalAmount: payment.amount,
    }));
    return invoices.sort((a,b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
}


export async function sendInvoiceByEmail(invoiceData: InvoiceData): Promise<ActionResult> {
    if (!invoiceData || !invoiceData.studentEmail || invoiceData.studentEmail === 'N/A') {
        return { success: false, error: 'Student email is not available for this invoice.' };
    }
    
    try {
        await sendInvoiceEmail(invoiceData);
        return { success: true, message: `Invoice successfully sent to ${invoiceData.studentEmail}.` };
    } catch (error: any) {
        console.error('Error sending invoice email via Genkit flow:', error);
        return { success: false, error: 'Failed to send invoice email.' };
    }
}

type FeeStatus = 'Paid' | 'Pending' | 'Overdue';
export type FeeRecord = {
  id: string; 
  studentId: string; 
  studentName: string;
  program: string;
  branch: string;
  totalFees: number;
  amountPaid: number;
  balance: number;
  dueDate: string;
  status: FeeStatus;
};

export async function getFeeRecords(): Promise<FeeRecord[]> {
    console.log("Server Action: getFeeRecords invoked.");
    try {
        const feesSnapshot = await db.collection("fees").limit(100).get();
        if (feesSnapshot.empty) {
            return [];
        }

        // Create a list of all student document IDs from the fee records
        const studentDocIds = feesSnapshot.docs.map(doc => doc.id);

        const studentDataMap = new Map<string, FirebaseFirestore.DocumentData>();
        
        // Fetch all student documents in chunks of 30 (Firestore 'in' query limit)
        for (let i = 0; i < studentDocIds.length; i += 30) {
            const chunk = studentDocIds.slice(i, i + 30);
            if (chunk.length > 0) {
                const studentsQuery = db.collection('students').where(adminSDK.firestore.FieldPath.documentId(), 'in', chunk);
                const studentSnaps = await studentsQuery.get();
                studentSnaps.forEach(doc => {
                    studentDataMap.set(doc.id, doc.data());
                });
            }
        }
        
        // Map over the fee records and merge with authoritative student data
        const records: FeeRecord[] = feesSnapshot.docs.map(feeDoc => {
            const feeData = feeDoc.data();
            const studentData = studentDataMap.get(feeDoc.id);

            const balance = (feeData.totalFees || 0) - (feeData.amountPaid || 0);
            let status: FeeStatus = 'Pending';
            if (balance <= 0) {
                status = 'Paid';
            } else if (feeData.dueDate && feeData.dueDate.toDate() < new Date()) {
                status = 'Overdue';
            }

            // Prioritize data from the 'students' collection (the single source of truth)
            return {
                id: feeDoc.id,
                studentId: studentData?.collegeId || feeData.studentCollegeId || 'N/A',
                studentName: studentData?.name || feeData.studentName || 'N/A',
                program: studentData?.program || feeData.program || 'N/A',
                branch: studentData?.branch || feeData.branch || 'N/A',
                totalFees: feeData.totalFees || 0,
                amountPaid: feeData.amountPaid || 0,
                balance: balance,
                dueDate: feeData.dueDate ? feeData.dueDate.toDate().toLocaleDateString() : 'N/A',
                status: status,
            };
        });

        records.sort((a, b) => a.studentName.localeCompare(b.studentName));
        
        console.log(`Server Action: Successfully fetched and merged ${records.length} fee records.`);
        return records;
    } catch (error: any) {
        console.error("Error fetching fee records in server action:", error);
        throw new Error("Failed to load fee data from the server.");
    }
}
