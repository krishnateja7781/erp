
'use server';

import { db } from '@/lib/firebaseAdmin';
import { FieldValue, Timestamp, Transaction } from 'firebase-admin/firestore';
import { createNotification, createNotificationsForRoles } from './notification-actions';
import type { Hostel, HostelDetails, Room, Complaint } from '@/lib/types';

interface ActionResult {
    success: boolean;
    error?: string;
    message?: string;
}

export interface NewHostelPayload {
    name: string;
    type: 'Boys' | 'Girls';
    status: 'Operational' | 'Under Maintenance' | 'Closed';
    wardenName: string;
    wardenContact: string;
    wardenEmail: string;
    wardenOffice?: string;
}

export async function addHostel(payload: NewHostelPayload): Promise<ActionResult> {
    const { name, type, status, wardenName, wardenContact, wardenEmail, wardenOffice } = payload;
    if (!name || !type || !status || !wardenName || !wardenContact || !wardenEmail) {
        return { success: false, error: "Missing required fields for new hostel." };
    }

    try {
        const hostelRef = db.collection('hostels').doc(); // Auto-generate ID
        
        const newHostelData = {
            id: hostelRef.id,
            name,
            type,
            status,
            warden: {
                name: wardenName,
                contact: wardenContact,
                email: wardenEmail,
                office: wardenOffice || 'N/A',
            },
            amenities: ["Wi-Fi", "Common Room", "Laundry Service"], // Default amenities
            rulesHighlight: ["No outside guests after 10 PM", "Maintain silence during study hours"], // Default rules
            rooms: [], // Start with no rooms
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        await hostelRef.set(newHostelData);

        return { success: true, message: `Hostel "${name}" created successfully.` };
    } catch (error: any) {
        console.error("Error creating new hostel:", error);
        return { success: false, error: "Failed to create new hostel." };
    }
}


export async function getHostels(): Promise<Hostel[]> {
    const hostelsSnapshot = await db.collection('hostels').orderBy('name').get();
    if (hostelsSnapshot.empty) {
        return [];
    }
    const hostels: Hostel[] = hostelsSnapshot.docs.map(doc => {
        const data = doc.data();
        const rooms = data.rooms || [];
        const capacity = rooms.reduce((acc: number, room: any) => acc + (room.capacity || 0), 0);
        const occupied = rooms.reduce((acc: number, room: any) => acc + (room.residents?.length || 0), 0);
        return {
            id: doc.id,
            name: data.name || 'N/A',
            type: data.type || 'N/A',
            warden: data.warden,
            status: data.status || 'N/A',
            capacity,
            occupied,
        };
    });
    return hostels;
}

export async function getHostelDetails(hostelId: string): Promise<HostelDetails | null> {
    const hostelDoc = await db.collection('hostels').doc(hostelId).get();
    if (!hostelDoc.exists) return null;

    const complaintsQuery = db.collection('complaints').where('hostelId', '==', hostelId);
    const complaintsSnapshot = await complaintsQuery.get();
    
    // Fetch all unique student IDs from the complaints
    const studentIds = [...new Set(complaintsSnapshot.docs.map(doc => doc.data().studentId).filter(Boolean))];
    const studentNames = new Map<string, string>();
    if (studentIds.length > 0) {
        // In a real large-scale app, you might paginate this, but for this context, batching is fine.
        for(let i=0; i<studentIds.length; i+=30) {
            const chunk = studentIds.slice(i, i+30);
            const studentDocs = await db.collection('students').where('id', 'in', chunk).get();
            studentDocs.forEach(doc => studentNames.set(doc.id, doc.data().name));
        }
    }
    
    const complaintsWithDateObj = complaintsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            roomNumber: data.roomNumber,
            issue: data.issue,
            studentId: data.studentId,
            studentName: studentNames.get(data.studentId) || data.studentName || data.studentId, // Fallback chain
            status: data.status,
            rawDate: data.date?.toDate ? data.date.toDate() : new Date(0), // Keep as Date object for sorting, with fallback
        };
    })

    const sortedComplaints = complaintsWithDateObj
        .sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime()) // Sort descending
        .map(c => {
            const { rawDate, ...complaintData } = c;
            return {
                ...complaintData,
                date: rawDate.getTime() > 0 ? rawDate.toLocaleDateString() : 'Invalid Date', // Convert to string for the final object
            } as Complaint;
        });
    
    const data = hostelDoc.data()!;
    const rooms = data.rooms || [];
    const capacity = rooms.reduce((acc: number, room: any) => acc + (room.capacity || 0), 0);
    const occupied = rooms.reduce((acc: number, room: any) => acc + (room.residents?.length || 0), 0);
    
    return {
        id: hostelDoc.id,
        name: data.name,
        type: data.type,
        status: data.status,
        warden: data.warden,
        amenities: data.amenities || [],
        rulesHighlight: data.rulesHighlight || [],
        rooms: rooms,
        complaints: sortedComplaints,
        capacity,
        occupied,
    };
}

export async function logComplaint(payload: { studentId: string; studentName: string; hostelId: string; roomNumber: string; issue: string; }): Promise<ActionResult> {
    const { studentId, studentName, hostelId, roomNumber, issue } = payload;
    if (!studentId || !hostelId || !roomNumber || !issue) {
        return { success: false, error: "Missing required fields to log a complaint." };
    }

    try {
        const complaintRef = db.collection('complaints').doc();
        const complaintData = {
            id: complaintRef.id,
            studentId, studentName, hostelId, roomNumber, issue,
            date: Timestamp.now(),
            status: 'Pending',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        };

        await complaintRef.set(complaintData);

        // Notify admins
        const notificationResult = await createNotificationsForRoles(
            ['admin'],
            'New Hostel Complaint',
            `Complaint logged by ${studentName} (${studentId}) for Room ${roomNumber}: "${issue}"`,
            'task',
            `/admin/hostels/${hostelId}`
        );

        if (!notificationResult.success) {
            console.warn("Failed to send new complaint notification to admins:", notificationResult.error, notificationResult.message);
        }

        return { success: true, message: `Complaint logged successfully. Ref ID: ${complaintRef.id}.` };
    } catch (error: any) {
        return { success: false, error: error.message || "An unexpected error occurred." };
    }
}


export async function updateHostelInfo(hostelId: string, updatedData: Partial<HostelDetails>): Promise<ActionResult> {
    if (!hostelId || !updatedData) {
        return { success: false, error: "Missing hostel ID or update data." };
    }
    try {
        await db.collection('hostels').doc(hostelId).update({
            ...updatedData,
            updatedAt: FieldValue.serverTimestamp()
        });
        return { success: true, message: "Hostel information updated successfully." };
    } catch (error: any) {
        return { success: false, error: "Failed to update hostel information." };
    }
}

export async function addHostelRoom(hostelId: string, room: Omit<Room, 'residents'>): Promise<ActionResult> {
    if (!hostelId || !room) {
        return { success: false, error: "Missing hostel ID or room data." };
    }
    try {
        const hostelRef = db.collection('hostels').doc(hostelId);
        const newRoomWithResidents = { ...room, residents: [] }; // Add empty residents array
        await hostelRef.update({
            rooms: FieldValue.arrayUnion(newRoomWithResidents),
            updatedAt: FieldValue.serverTimestamp()
        });
        return { success: true, message: `Room ${room.roomNumber} added to hostel.` };
    } catch (error: any) {
        return { success: false, error: "Failed to add room." };
    }
}

export async function allocateStudentToRoom(hostelId: string, roomNumber: string, studentId: string): Promise<ActionResult> {
    if (!hostelId || !roomNumber || !studentId) {
        return { success: false, error: "Missing required information for allocation." };
    }
    
    const hostelRef = db.collection('hostels').doc(hostelId);
    const studentRef = db.collection('students').doc(studentId);

    try {
        await db.runTransaction(async (transaction: Transaction) => {
            const hostelDoc = await transaction.get(hostelRef);
            const studentDoc = await transaction.get(studentRef);

            if (!hostelDoc.exists) throw new Error("Hostel not found.");
            if (!studentDoc.exists) throw new Error("Student not found.");

            const hostelData = hostelDoc.data() as HostelDetails;
            const studentName = studentDoc.data()!.name;

            const updatedRooms = [...hostelData.rooms];
            const roomIndex = updatedRooms.findIndex(room => room.roomNumber === roomNumber);
            if (roomIndex === -1) throw new Error("Room not found.");

            const roomToUpdate = { ...updatedRooms[roomIndex] };
            if (roomToUpdate.residents.length >= roomToUpdate.capacity) {
                throw new Error(`Room ${roomNumber} is already full.`);
            }
            if (hostelData.rooms.some(r => r.residents.some(res => res.studentId === studentId))) {
                throw new Error(`Student ${studentName} is already allocated to another room.`);
            }

            roomToUpdate.residents.push({ studentId, studentName });
            updatedRooms[roomIndex] = roomToUpdate;

            // Update hostel and student docs in one transaction
            transaction.update(hostelRef, { rooms: updatedRooms, updatedAt: FieldValue.serverTimestamp() });
            transaction.update(studentRef, { 
                hostelId: hostelId, 
                roomNumber: roomNumber,
                type: 'Hosteler', // Ensure student type is set correctly
                updatedAt: FieldValue.serverTimestamp() 
            });
        });

        return { success: true, message: `Student allocated to room ${roomNumber}.` };
    } catch (error: any) {
        console.error("Transaction Error in allocateStudentToRoom:", error);
        return { success: false, error: error.message || "Failed to allocate student." };
    }
}

export async function removeStudentFromRoom(hostelId: string, roomNumber: string, studentId: string): Promise<ActionResult> {
    if (!hostelId || !roomNumber || !studentId) {
        return { success: false, error: "Missing required information for removal." };
    }

    const hostelRef = db.collection('hostels').doc(hostelId);
    const studentRef = db.collection('students').doc(studentId);

    try {
        await db.runTransaction(async (transaction: Transaction) => {
            const [hostelDoc, studentDoc] = await Promise.all([
                transaction.get(hostelRef),
                transaction.get(studentRef)
            ]);

            if (!hostelDoc.exists) throw new Error("Hostel not found.");

            const hostelData = hostelDoc.data() as HostelDetails;
            let found = false;
            
            const updatedRooms = hostelData.rooms.map(room => {
                if (room.roomNumber === roomNumber) {
                    const initialLength = room.residents.length;
                    const newResidents = room.residents.filter(res => res.studentId !== studentId);
                    if (newResidents.length < initialLength) {
                        found = true;
                    }
                    return { ...room, residents: newResidents };
                }
                return room;
            });
            
            if (!found) {
                console.warn(`Student ${studentId} was not found in room ${roomNumber}. The operation might be redundant.`);
            }
            
            transaction.update(hostelRef, { rooms: updatedRooms, updatedAt: FieldValue.serverTimestamp() });
            
            if (studentDoc.exists) {
                transaction.update(studentRef, {
                    hostelId: null,
                    roomNumber: null,
                    type: 'Day Scholar', // Revert type
                    updatedAt: FieldValue.serverTimestamp()
                });
            } else {
                console.warn(`Student document ${studentId} not found during room removal. Removing from hostel record only.`);
            }
        });
        
        return { success: true, message: `Student removed from room ${roomNumber}.` };
    } catch (error: any) {
        console.error("Transaction Error in removeStudentFromRoom:", error);
        return { success: false, error: error.message || "Failed to remove student." };
    }
}


export async function updateComplaintStatus(complaintId: string, status: 'Pending' | 'In Progress' | 'Resolved'): Promise<ActionResult> {
    if(!complaintId || !status) {
        return { success: false, error: "Missing complaint ID or status." };
    }
    try {
        const complaintRef = db.collection('complaints').doc(complaintId);
        const complaintSnap = await complaintRef.get();
        if (!complaintSnap.exists) {
            return { success: false, error: "Complaint not found."};
        }
        
        const complaintData = complaintSnap.data()!;

        await complaintRef.update({
            status: status,
            updatedAt: FieldValue.serverTimestamp()
        });

        // Notify student of the status change
        const studentDocs = await db.collection('students').where('id', '==', complaintData.studentId).limit(1).get();
        
        if (!studentDocs.empty) {
            const studentData = studentDocs.docs[0].data();
            if (studentData && studentData.user_uid) {
                await createNotification({
                    recipientUid: studentData.user_uid,
                    title: 'Hostel Complaint Status Updated',
                    message: `Your complaint regarding "${complaintData.issue}" is now: ${status}.`,
                    type: 'info',
                    link: '/student/hostel'
                });
            } else {
                 console.warn(`Student with doc ID ${complaintData.studentId} does not have a user_uid. Cannot send notification.`);
            }
        } else {
            console.warn(`Could not find student with ID ${complaintData.studentId} to send notification.`);
        }

        return { success: true, message: `Complaint status updated to ${status}.` };
    } catch(error: any) {
        return { success: false, error: "Failed to update complaint status."};
    }
}

export async function deleteHostel(hostelId: string): Promise<ActionResult> {
    console.log(`Server Action: deleteHostel invoked for ID: ${hostelId}`);
    if (!hostelId) {
        return { success: false, error: "Hostel ID is required." };
    }

    const hostelRef = db.collection('hostels').doc(hostelId);

    try {
        await db.runTransaction(async (transaction) => {
            const hostelDoc = await transaction.get(hostelRef);
            if (!hostelDoc.exists) {
                throw new Error("Hostel not found.");
            }

            // Find all students allocated to this hostel
            const studentsQuery = db.collection('students').where('hostelId', '==', hostelId);
            const studentsSnapshot = await transaction.get(studentsQuery);

            // Un-allocate each student
            if (!studentsSnapshot.empty) {
                studentsSnapshot.forEach(studentDoc => {
                    transaction.update(studentDoc.ref, {
                        hostelId: null,
                        roomNumber: null,
                        type: 'Day Scholar', // Revert their type
                        updatedAt: FieldValue.serverTimestamp()
                    });
                });
            }
            
            // Finally, delete the hostel document
            transaction.delete(hostelRef);
        });

        console.log(`Successfully deleted hostel ${hostelId} and un-allocated its students.`);
        return { success: true, message: `Hostel deleted successfully. Any allocated students have been un-assigned.` };
    } catch (error: any) {
        console.error(`Error deleting hostel ${hostelId}:`, error);
        return { success: false, error: error.message || "An unexpected error occurred during hostel deletion." };
    }
}


export interface StudentHostelInfo {
    hostelId: string | null;
    hostelName: string | null;
    roomNumber: string | null;
    wardenName: string | null;
    wardenContact: string | null;
    complaints: Complaint[];
}

export async function getStudentHostelData(studentId: string): Promise<{ success: boolean; data?: StudentHostelInfo; error?: string }> {
    if (!studentId) {
        return { success: false, error: 'Student ID is required.' };
    }

    try {
        const studentDoc = await db.collection('students').doc(studentId).get();
        if (!studentDoc.exists) {
            return { success: false, error: 'Student profile not found.' };
        }
        const studentData = studentDoc.data()!;

        if (studentData.type !== 'Hosteler') {
            return { success: false, error: 'This page is for hosteler students only.' };
        }
        if (!studentData.hostelId) {
            return { success: false, error: 'Hostel allocation not found for your profile.' };
        }

        const hostelDoc = await db.collection('hostels').doc(studentData.hostelId).get();
        if (!hostelDoc.exists) {
            return { success: false, error: `Assigned hostel with ID ${studentData.hostelId} not found.` };
        }
        const hostelData = hostelDoc.data()!;

        // More robust query: Fetch all complaints for the student, then filter by hostelId in code.
        const complaintsQuery = db.collection('complaints').where('studentId', '==', studentId);

        const complaintsSnapshot = await complaintsQuery.get();
        const complaints: Complaint[] = [];
        
        complaintsSnapshot.forEach(doc => {
            const data = doc.data();
            // Filter by hostelId in the application code for resilience.
            if(data.hostelId === studentData.hostelId) {
                complaints.push({
                    id: doc.id,
                    roomNumber: data.roomNumber,
                    issue: data.issue,
                    studentId: data.studentId,
                    status: data.status,
                    date: data.date.toDate().toLocaleDateString(),
                });
            }
        });

        // Sort complaints by date descending
        complaints.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const resultData: StudentHostelInfo = {
            hostelId: studentData.hostelId,
            hostelName: hostelData.name || null,
            roomNumber: studentData.roomNumber || null,
            wardenName: hostelData.warden?.name || null,
            wardenContact: hostelData.warden?.contact || null,
            complaints,
        };

        return { success: true, data: resultData };

    } catch (error: any) {
        console.error(`Error fetching hostel data for student ${studentId}:`, error);
        if (error.code === 'failed-precondition') {
             return { success: false, error: "A database index is missing for fetching complaints. Please contact an administrator." };
        }
        return { success: false, error: 'An unexpected error occurred while fetching your hostel data.' };
    }
}
