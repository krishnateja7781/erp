
'use server';

import { db } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Material } from '@/lib/types';
import { createNotification } from './notification-actions';

interface ActionResult {
    success: boolean;
    error?: string;
    message?: string;
}

export async function getMaterialsForTeacherClasses(teacherId: string): Promise<Record<string, Material[]>> {
  try {
    const classSnapshot = await db.collection('classes').where('teacherId', '==', teacherId).get();
    if (classSnapshot.empty) return {};
    
    const classIds = classSnapshot.docs.map(doc => doc.id);
    if (classIds.length === 0) return {};
    
    const materialsByClass: Record<string, Material[]> = {};
    classIds.forEach(id => { materialsByClass[id] = []; });
    
    // Chunking the query to handle more than 30 classes
    const materialPromises = [];
    for (let i = 0; i < classIds.length; i += 30) {
      const chunk = classIds.slice(i, i + 30);
      const q = db.collection('materials').where('classId', 'in', chunk).orderBy('uploadDate', 'desc');
      materialPromises.push(q.get());
    }

    const allMaterialSnapshots = await Promise.all(materialPromises);

    for (const materialsSnapshot of allMaterialSnapshots) {
      materialsSnapshot.forEach(doc => {
        const material = { id: doc.id, ...doc.data() } as Material;
        if(material.classId && materialsByClass[material.classId]) {
            materialsByClass[material.classId].push(material);
        }
      });
    }

    return materialsByClass;
  } catch (error: any) {
    console.error("Error fetching materials for teacher:", error);
    throw new Error("Failed to fetch course materials.");
  }
}

export async function saveMaterial(material: Omit<Material, 'id' | 'uploadDate'> & { id?: string }): Promise<ActionResult> {
  try {
    const { id, ...data } = material;
    if (id) {
      // Update
      await db.collection('materials').doc(id).update({
        ...data,
        updatedAt: FieldValue.serverTimestamp()
      });
      return { success: true, message: 'Material updated successfully.' };
    } else {
      // Create
      const newMaterialRef = await db.collection('materials').add({
        ...data,
        uploadDate: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Notify students in the class
      const classDoc = await db.collection('classes').doc(data.classId).get();
      if(classDoc.exists) {
        const studentIds = classDoc.data()?.studentIds || [];
        const studentDocs = await db.collection('students').where(FieldValue.documentId(), 'in', studentIds).get();
        studentDocs.forEach(studentDoc => {
            const student = studentDoc.data();
            if (student.user_uid) {
                createNotification({
                    recipientUid: student.user_uid,
                    title: `New Material: ${data.courseId}`,
                    message: `Your teacher has uploaded a new material: "${data.name}"`,
                    type: 'info',
                    link: '/student/materials'
                }).catch(e => console.error("Failed to send material upload notification:", e));
            }
        });
      }
      return { success: true, message: 'Material added successfully.' };
    }
  } catch (error: any) {
    return { success: false, error: 'Failed to save material.' };
  }
}

export async function deleteMaterial(id: string): Promise<ActionResult> {
  try {
    await db.collection('materials').doc(id).delete();
    return { success: true, message: 'Material deleted successfully.' };
  } catch (error: any) {
    return { success: false, error: 'Failed to delete material.' };
  }
}

export async function getMaterialsForCourse(courseId: string): Promise<Material[]> {
    try {
        const materialSnapshot = await db.collection('materials').where('courseId', '==', courseId).orderBy('uploadDate', 'desc').get();
        if (materialSnapshot.empty) return [];
        return materialSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Material));
    } catch(error: any) {
        console.error(`Error fetching materials for course ${courseId}:`, error);
        throw new Error('Failed to fetch materials.');
    }
}
