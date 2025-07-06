
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Save, Calculator, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getTeacherClasses, getStudentsForClass, getMarksForClass, MarksEntry as OriginalMarksEntry, StudentForClass } from '@/actions/teacher-actions';
import { saveAllMarksForClass } from '@/actions/marks-actions';

type MarksEntry = OriginalMarksEntry & { isModified?: boolean };

type TeacherClass = {
  id: string;
  courseCode: string;
  courseName: string;
  class: string;
  semester: number;
  credits: number;
};

const calculateGrade = (total: number | null): string | null => {
    if (total === null || typeof total !== 'number' || isNaN(total) || total < 0 || total > 100) return null;
    if (total >= 90) return 'O'; if (total >= 80) return 'A+'; if (total >= 70) return 'A';
    if (total >= 60) return 'B+'; if (total >= 50) return 'B'; if (total >= 45) return 'C+';
    if (total >= 40) return 'C'; if (total >= 35) return 'P'; return 'FAIL';
};

export default function TeacherMarksPage() {
    const { toast } = useToast();
    const [teacherClasses, setTeacherClasses] = React.useState<TeacherClass[]>([]);
    const [selectedClassId, setSelectedClassId] = React.useState<string>('select_class_placeholder');
    const [students, setStudents] = React.useState<StudentForClass[]>([]);
    const [marks, setMarks] = React.useState<Record<string, MarksEntry>>({});
    const [isLoading, setIsLoading] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        const fetchClasses = async () => {
            const storedUserString = localStorage.getItem('loggedInUser');
            if (!storedUserString) return;
            const user = JSON.parse(storedUserString);
            try {
                const classesData = await getTeacherClasses(user.uid);
                setTeacherClasses(classesData);
            } catch (error) {
                toast({ variant: "destructive", title: "Error", description: "Failed to fetch your classes." });
            }
        };
        fetchClasses();
    }, [toast]);

    React.useEffect(() => {
        const fetchClassData = async () => {
            if (!selectedClassId || selectedClassId === 'select_class_placeholder') {
                setStudents([]); setMarks({}); return;
            }
            setIsLoading(true);
            try {
                const [fetchedStudents, fetchedMarks] = await Promise.all([
                    getStudentsForClass(selectedClassId),
                    getMarksForClass(selectedClassId)
                ]);
                setStudents(fetchedStudents);
                const initialMarksState: Record<string, MarksEntry> = {};
                
                fetchedStudents.forEach(student => {
                    const existingMark = fetchedMarks.find(m => m.studentId === student.id);
                    const recordId = `${selectedClassId}_${student.id}`;
                    initialMarksState[student.id] = existingMark ? 
                        { ...existingMark.marks, recordId: existingMark.marks.recordId || recordId, isModified: false } : 
                        { recordId, studentId: student.id, internals: null, externals: null, total: null, grade: null, isModified: false };
                });
                setMarks(initialMarksState);
            } catch (error) {
                toast({ variant: "destructive", title: "Error", description: "Failed to load students or marks." });
            } finally { setIsLoading(false); }
        };
        fetchClassData();
    }, [selectedClassId, toast]);

    const handleMarkChange = (studentId: string, field: 'internals' | 'externals', value: string) => {
        const numericValue = value === '' ? null : parseInt(value, 10);
        if (numericValue !== null && (isNaN(numericValue) || numericValue < 0 || numericValue > 50)) {
            toast({ variant: "destructive", title: "Invalid Range", description: "Marks must be between 0 and 50." });
            return;
        }
        setMarks(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], [field]: numericValue, isModified: true }
        }));
    };

    const handleCalculateAll = () => {
        setMarks(prevMarks => {
            const newMarks = { ...prevMarks };
            Object.keys(newMarks).forEach(studentId => {
                const entry = newMarks[studentId];
                if (typeof entry.internals === 'number' && typeof entry.externals === 'number') {
                    entry.total = entry.internals + entry.externals;
                    entry.grade = calculateGrade(entry.total);
                    entry.isModified = true;
                }
            });
            return newMarks;
        });
        toast({ title: "Grades Calculated", description: "All entered marks have been totaled and graded." });
    };

    const handleSaveAll = async () => {
        const marksToSave = Object.values(marks).filter(m => m.isModified && m.internals !== null && m.externals !== null);
        const currentClass = teacherClasses.find(c => c.id === selectedClassId);

        if (!currentClass) {
            toast({ variant: "destructive", title: "Error", description: "Selected class details not found. Cannot save." });
            return;
        }
        if (marksToSave.length === 0) {
            toast({ title: "No Changes", description: "No modified marks entries to save." });
            return;
        }
        setIsSaving(true);
        try {
            const payload = marksToSave.map(m => ({
                recordId: m.recordId,
                studentId: m.studentId,
                courseCode: currentClass.courseCode,
                semester: currentClass.semester,
                marks: { internalsMarks: m.internals!, externalsMarks: m.externals!, totalMarks: m.total!, grade: m.grade! },
            }));
            const result = await saveAllMarksForClass(payload);
            if (result.success) {
                toast({ title: "Success", description: result.message });
                setMarks(prev => {
                    const newMarks = {...prev};
                    marksToSave.forEach(m => { if(newMarks[m.studentId]) newMarks[m.studentId].isModified = false; });
                    return newMarks;
                });
            } else {
                toast({ variant: "destructive", title: "Save Failed", description: result.error });
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally { setIsSaving(false); }
    };
    
    const hasUnsavedChanges = Object.values(marks).some(m => m.isModified);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h1 className="text-3xl font-bold">Enter/View Marks</h1>
                <div className="flex gap-2 flex-wrap">
                    <Button onClick={handleCalculateAll} disabled={isLoading || isSaving || students.length === 0}><Calculator className="mr-2 h-4 w-4" />Calculate All</Button>
                    <Button onClick={handleSaveAll} disabled={isLoading || isSaving || students.length === 0 || !hasUnsavedChanges}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Changes</Button>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Select Class</CardTitle><CardDescription>Choose the class to enter or view marks for.</CardDescription>
                    <div className="pt-4 flex flex-wrap items-center gap-4">
                        <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoading || isSaving}><SelectTrigger className="w-full sm:w-auto flex-grow min-w-[300px]"><SelectValue placeholder="-- Select Class/Course --" /></SelectTrigger>
                            <SelectContent><SelectItem value="select_class_placeholder" disabled>-- Select Class/Course --</SelectItem>{teacherClasses.map(c => (<SelectItem key={c.id} value={c.id}>{`${c.courseCode} - ${c.courseName} (${c.class})`}</SelectItem>))}</SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (<div className="text-center py-8"><Loader2 className="inline mr-2 h-4 w-4 animate-spin" />Loading...</div>) : 
                    students.length > 0 ? (
                        <div className="overflow-x-auto"><Table className="min-w-[700px]"><TableHeader><TableRow><TableHead>Student ID</TableHead><TableHead>Name</TableHead><TableHead>Internals (/50)</TableHead><TableHead>Externals (/50)</TableHead><TableHead>Total</TableHead><TableHead>Grade</TableHead></TableRow></TableHeader>
                            <TableBody>{students.map((student) => {
                                const mark = marks[student.id] ?? {};
                                return (<TableRow key={student.id} className={mark.isModified ? "bg-yellow-100 dark:bg-yellow-900/30" : ""}>
                                    <TableCell>{student.id}</TableCell><TableCell>{student.name}</TableCell>
                                    <TableCell><Input type="number" defaultValue={mark.internals ?? ''} onChange={(e) => handleMarkChange(student.id, 'internals', e.target.value)} className="h-8 text-center" min="0" max="50" /></TableCell>
                                    <TableCell><Input type="number" defaultValue={mark.externals ?? ''} onChange={(e) => handleMarkChange(student.id, 'externals', e.target.value)} className="h-8 text-center" min="0" max="50" /></TableCell>
                                    <TableCell><Input value={mark.total ?? ''} className="h-8 text-center font-semibold bg-muted" readOnly /></TableCell>
                                    <TableCell><Input value={mark.grade ?? ''} className="h-8 text-center font-semibold bg-muted" readOnly /></TableCell>
                                </TableRow>);
                            })}</TableBody>
                        </Table></div>
                    ) : (<div className="text-center py-8 text-muted-foreground">Please select a class.</div>)}
                </CardContent>
            </Card>
        </div>
    );
}
