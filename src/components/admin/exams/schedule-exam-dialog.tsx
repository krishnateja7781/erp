
'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, ArrowRight, ArrowLeft } from "lucide-react";
import { getCoursesForSelection } from '@/actions/course-actions';
import { scheduleExamsAndSetupHallTickets } from '@/actions/exam-actions';
import type { Student } from '@/lib/types';
import { getStudentProfileDetails } from '@/actions/student-actions';
import { HallTicketDisplay } from '@/components/student/hallticket-display';
import { Textarea } from '@/components/ui/textarea';

interface CourseOption {
    id: string;
    name: string;
    credits: number;
}

interface ExamRow {
    courseCode: string;
    courseName: string;
    date: string;
    startTime: string;
    endTime: string;
    credits: number;
}

interface ScheduleExamDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduleSaved: () => void;
}

const programs = ["B.Tech", "MBA", "Law", "MBBS", "B.Sc", "B.Com"];
const years = ["1", "2", "3", "4", "5"];
const semesters = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const hardcodedBranches: Record<string, string[]> = {
  "B.Tech": ["CSE", "ECE", "MECH", "IT", "AI&ML", "DS", "CIVIL", "Other"],
  "MBA": ["Marketing", "Finance", "HR", "Operations", "General", "Other"],
  "Law": ["Corporate Law", "Criminal Law", "Civil Law", "General", "Other"],
  "MBBS": ["General Medicine"],
  "B.Sc": ["Physics", "Chemistry", "Mathematics", "Computer Science", "Other"],
  "B.Com": ["General", "Accounting & Finance", "Taxation", "Other"],
};
const examSessionTypes = ["IA-1", "IA-2", "SEE (semester end examinations)"];

export function ScheduleExamDialog({ isOpen, onOpenChange, onScheduleSaved }: ScheduleExamDialogProps) {
    const { toast } = useToast();
    const [step, setStep] = React.useState<'schedule' | 'hallticket'>('schedule');
    const [isLoading, setIsLoading] = React.useState(false);
    
    // Filters
    const [program, setProgram] = React.useState('');
    const [branch, setBranch] = React.useState('');
    const [year, setYear] = React.useState('');
    const [semester, setSemester] = React.useState('');

    // Data for dropdowns
    const [branches, setBranches] = React.useState<string[]>([]);
    const [courses, setCourses] = React.useState<CourseOption[]>([]);
    const [isCourseLoading, setIsCourseLoading] = React.useState(false);

    // Main schedule table data
    const [examRows, setExamRows] = React.useState<ExamRow[]>([]);
    const [selectedCourse, setSelectedCourse] = React.useState('');
    
    // Hall Ticket Data
    const [examSessionType, setExamSessionType] = React.useState('');
    const [instructions, setInstructions] = React.useState("1. Reach the examination hall 30 minutes before the scheduled time.\n2. Bring your college ID card and this hall ticket.\n3. No electronic gadgets are allowed inside the examination hall.");
    const [controllerSignature, setControllerSignature] = React.useState("Controller of Examinations");
    const [minAttendance, setMinAttendance] = React.useState(75);
    const [maxDues, setMaxDues] = React.useState(0);
    const [dummyStudent, setDummyStudent] = React.useState<any>(null);

    const resetDialog = React.useCallback(() => {
        setStep('schedule');
        setProgram(''); setBranch(''); setYear(''); setSemester('');
        setBranches([]); setCourses([]);
        setExamRows([]); setSelectedCourse('');
        setExamSessionType('');
        setIsLoading(false);
    }, []);

    React.useEffect(() => { if (!isOpen) resetDialog(); }, [isOpen, resetDialog]);
    
    React.useEffect(() => {
        setBranches(hardcodedBranches[program] || []);
        setBranch('');
    }, [program]);
    
    React.useEffect(() => {
        setCourses([]);
        setSelectedCourse('');
        if (program && branch && semester) {
            setIsCourseLoading(true);
            getCoursesForSelection(program, branch, parseInt(semester))
                .then(setCourses).catch(() => toast({ variant: 'destructive', title: 'Error', description: 'Could not load courses.' }))
                .finally(() => setIsCourseLoading(false));
        }
    }, [program, branch, semester, toast]);
    
    React.useEffect(() => {
        if(step === 'hallticket' && !dummyStudent) {
            const fetchDummyStudent = async () => {
                const dummyStudentData: Student = { id: 'PREVIEW_STUDENT_01', collegeId: `${program.substring(0,2).toUpperCase()}${year}XX0001`, name: 'John Doe', program, branch, year: parseInt(year), semester: parseInt(semester), section: 'A', batch: '2024', status: 'Active', type: 'Day Scholar', gender: 'Male', avatarUrl: 'https://placehold.co/150x150.png', initials: 'JD' };
                const studentDetails = await getStudentProfileDetails(dummyStudentData.id);
                 setDummyStudent(studentDetails ? studentDetails.profile : dummyStudentData);
            }
            fetchDummyStudent().catch(() => {
                 setDummyStudent({ name: 'John Doe', collegeId: 'PREVIEW001', program, branch, year: parseInt(year), semester: parseInt(semester), photoUrl: 'https://placehold.co/150x150.png' })
            });
        }
    }, [step, dummyStudent, program, branch, year, semester]);
    
    const availableCourses = React.useMemo(() => {
        const addedCodes = new Set(examRows.map(row => row.courseCode));
        return courses.filter(course => !addedCodes.has(course.id));
    }, [courses, examRows]);

    const handleAddCourse = () => {
        const course = courses.find(c => c.id === selectedCourse);
        if (course) {
            const name = course.name.includes(' - ') ? course.name.split(' - ')[1] : course.name;
            setExamRows(prev => [...prev, { courseCode: course.id, courseName: name, date: '', startTime: '09:00', endTime: '12:00', credits: course.credits }]);
        }
        setSelectedCourse('');
    };

    const handleRemoveCourse = (code: string) => setExamRows(prev => prev.filter(e => e.courseCode !== code));
    const handleRowChange = (index: number, field: keyof Omit<ExamRow, 'credits'>, value: string) => {
        const newRows = [...examRows];
        newRows[index] = { ...newRows[index], [field]: value };
        setExamRows(newRows);
    };

    const handleNextStep = () => {
        if (examRows.length === 0 || examRows.some(e => !e.date)) {
            toast({ variant: 'destructive', title: 'Incomplete Schedule', description: 'Please add courses and set dates for all of them.' });
            return;
        }
        setStep('hallticket');
    }

    const handleSubmit = async () => {
        if (!program || !branch || !year || !semester) {
            toast({ variant: 'destructive', title: 'Incomplete Filters', description: 'Please select program, branch, year, and semester.' });
            return;
        }
        if (!examSessionType) {
            toast({ variant: 'destructive', title: 'Incomplete Rules', description: 'Please select an Exam Session Type.' });
            return;
        }

        setIsLoading(true);
        const result = await scheduleExamsAndSetupHallTickets({
            filters: { program, branch, year, semester },
            exams: examRows,
            hallTicketData: { examSessionName: examSessionType, instructions, controllerSignaturePlaceholder: controllerSignature, minAttendance, maxDues }
        });

        if (result.success) {
            toast({ title: 'Success', description: result.message });
            onScheduleSaved();
            onOpenChange(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsLoading(false);
    };
    
    const previewHallTicketData = React.useMemo(() => {
        if (!dummyStudent) return null;
        return {
            studentId: dummyStudent.id, studentName: dummyStudent.name, studentPhotoUrl: dummyStudent.avatarUrl, studentCollegeId: dummyStudent.collegeId,
            program: dummyStudent.program, branch: dummyStudent.branch, year: dummyStudent.year, semester: dummyStudent.semester,
            examSessionName: examSessionType, instructions, controllerSignaturePlaceholder: controllerSignature, generatedDate: new Date().toISOString(),
            eligibility: { minAttendance, maxDues },
            exams: examRows.map((er, i) => ({ ...er, id: `prev_${i}`, status: 'Scheduled' })),
        };
    }, [dummyStudent, examRows, examSessionType, instructions, controllerSignature, minAttendance, maxDues]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Schedule Exams & Hall Tickets</DialogTitle>
                    <DialogDescription>
                        Step {step === 'schedule' ? '1 of 2: Build the timetable' : '2 of 2: Set hall ticket rules'}
                    </DialogDescription>
                </DialogHeader>

                {step === 'schedule' && (
                  <div className="flex-grow overflow-y-auto px-1">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-1">
                        <Select value={program} onValueChange={setProgram}><SelectTrigger><SelectValue placeholder="Program" /></SelectTrigger><SelectContent>{programs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
                        <Select value={branch} onValueChange={setBranch} disabled={!program}><SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger><SelectContent>{branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select>
                        <Select value={year} onValueChange={setYear}><SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={y}>Year {y}</SelectItem>)}</SelectContent></Select>
                        <Select value={semester} onValueChange={setSemester}><SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger><SelectContent>{semesters.map(s => <SelectItem key={s} value={s}>Sem {s}</SelectItem>)}</SelectContent></Select>
                    </div>

                    <div className="flex items-end gap-2 p-1 mt-4">
                        <div className="flex-grow"><Label>Add Course to Schedule</Label><Select value={selectedCourse} onValueChange={setSelectedCourse} disabled={isCourseLoading || !program || !branch || !semester}><SelectTrigger><SelectValue placeholder={isCourseLoading ? "Loading..." : "Select a course"} /></SelectTrigger><SelectContent>{availableCourses.length > 0 ? availableCourses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>) : <SelectItem value="none" disabled>{courses.length > 0 ? 'All courses added' : 'No courses found'}</SelectItem>}</SelectContent></Select></div>
                        <Button onClick={handleAddCourse} disabled={!selectedCourse}><PlusCircle className="mr-2 h-4 w-4"/>Add</Button>
                    </div>

                    <div className="mt-4 p-1"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Time</TableHead><TableHead>Course</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                        <TableBody>{examRows.length > 0 ? examRows.map((row, index) => (
                            <TableRow key={row.courseCode}><TableCell><Input type="date" value={row.date} onChange={e => handleRowChange(index, 'date', e.target.value)} /></TableCell>
                                <TableCell className="flex gap-1"><Input type="time" value={row.startTime} onChange={e => handleRowChange(index, 'startTime', e.target.value)} /><Input type="time" value={row.endTime} onChange={e => handleRowChange(index, 'endTime', e.target.value)} /></TableCell>
                                <TableCell className="font-medium">{row.courseCode} - {row.courseName}</TableCell>
                                <TableCell><Button variant="ghost" size="icon" onClick={() => handleRemoveCourse(row.courseCode)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                            </TableRow>
                        )) : <TableRow><TableCell colSpan={4} className="text-center h-24">No courses added yet.</TableCell></TableRow>}
                        </TableBody></Table>
                    </div>
                  </div>
                )}
                
                {step === 'hallticket' && (
                    <div className="grid md:grid-cols-2 gap-6 flex-grow overflow-y-auto px-1">
                        <div className="space-y-4">
                             <div className="space-y-1">
                                <Label htmlFor="exam-session-type">Exam Session Type *</Label>
                                <Select value={examSessionType} onValueChange={setExamSessionType} disabled={isLoading}>
                                    <SelectTrigger id="exam-session-type"><SelectValue placeholder="Select session type..." /></SelectTrigger>
                                    <SelectContent>
                                        {examSessionTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1"><Label htmlFor="min-attendance">Min. Attendance (%)</Label><Input id="min-attendance" type="number" value={minAttendance} onChange={(e) => setMinAttendance(parseInt(e.target.value, 10) || 0)} disabled={isLoading}/></div>
                                <div className="space-y-1"><Label htmlFor="max-dues">Max. Fee Dues (₹)</Label><Input id="max-dues" type="number" value={maxDues} onChange={(e) => setMaxDues(parseInt(e.target.value, 10) || 0)} disabled={isLoading}/></div>
                             </div>
                             <div className="space-y-1"><Label htmlFor="exam-instructions">Instructions</Label><Textarea id="exam-instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} className="min-h-[100px]" disabled={isLoading}/></div>
                             <div className="space-y-1"><Label htmlFor="controller-signature">Controller of Examinations</Label><Input id="controller-signature" value={controllerSignature} onChange={(e) => setControllerSignature(e.target.value)} disabled={isLoading}/></div>
                        </div>
                        <div className="space-y-2">
                             <h4 className="font-semibold text-center">Hall Ticket Preview</h4>
                             <div className="scale-[0.45] origin-top h-[520px] overflow-hidden border bg-gray-100 rounded-lg">
                                {previewHallTicketData ? <HallTicketDisplay hallTicketData={previewHallTicketData} /> : <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin"/></div>}
                             </div>
                        </div>
                    </div>
                )}
                
                <DialogFooter className="flex-shrink-0">
                    {step === 'schedule' && (
                        <>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleNextStep} disabled={examRows.length === 0}>Next: Set Hall Ticket Rules <ArrowRight className="ml-2 h-4 w-4"/></Button>
                        </>
                    )}
                    {step === 'hallticket' && (
                        <>
                            <Button variant="outline" onClick={() => setStep('schedule')} disabled={isLoading}><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
                            <Button onClick={handleSubmit} disabled={isLoading}>{isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Scheduling...</> : 'Schedule & Issue Hall Tickets'}</Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
