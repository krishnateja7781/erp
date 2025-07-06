
'use client'; 

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import * as React from 'react'; 
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { db } from '@/lib/firebaseClient';
import { collection, query, where, getDocs, DocumentData } from 'firebase/firestore';
import { fetchStudentBacklogs } from "@/actions/student-actions";

type CourseMark = {
    code: string | null; name: string | null; internals: number | null; externals: number | null;
    total: number | null; grade: string | null; credits: number | null;
};
type SemesterMark = { semester: number | null; gpa: number | null; courses: CourseMark[]; };
type BacklogEntry = { courseCode: string | null; courseName: string | null; semesterAttempted: number | null; status: 'Active' | 'Cleared' | null; gradeAchieved: string | null; };

const fetchStudentMarks = async (studentId: string): Promise<SemesterMark[]> => {
    const marksQuery = query(collection(db, "marks"), where("studentId", "==", studentId));
    const querySnapshot = await getDocs(marksQuery);
    const marksBySemester: Record<number, SemesterMark> = {};
    querySnapshot.forEach(doc => {
        const data = doc.data();
        const semester = data.semester || 0;
        if (!marksBySemester[semester]) {
            marksBySemester[semester] = { semester: semester, gpa: null, courses: [] };
        }
        marksBySemester[semester].courses.push({
            code: data.courseCode || null, name: data.courseName || null,
            internals: data.internalsMarks ?? null, externals: data.externalsMarks ?? null,
            total: data.totalMarks ?? null, grade: data.grade || null, credits: data.credits ?? null,
        });
    });
    return Object.values(marksBySemester).sort((a,b) => (b.semester || 0) - (a.semester || 0));
}

const getGradePoint = (grade: string | null): number | null => {
    if (!grade) return null;
    switch (grade.toUpperCase()) {
        case 'O': return 10; case 'A+': return 9; case 'A': return 8; case 'B+': return 7;
        case 'B': return 6; case 'C+': return 5; case 'C': return 4; case 'P': return 3;
        case 'FAIL': return 0; default: return null; 
    }
};

const calculateSGPA = (courses: CourseMark[]): number | null => {
    let totalCreditPoints = 0; let totalCreditsAttempted = 0;
    courses.forEach(course => {
        if (course.credits && typeof course.credits === 'number' && course.credits > 0) {
            const gradePoint = getGradePoint(course.grade);
            if (gradePoint !== null) {
                totalCreditPoints += gradePoint * course.credits;
                totalCreditsAttempted += course.credits;
            }
        }
    });
    if (totalCreditsAttempted === 0) return null;
    return parseFloat((totalCreditPoints / totalCreditsAttempted).toFixed(2));
};

const calculateCGPA = (allSemesterData: SemesterMark[]): number | null => {
    let totalCreditPoints = 0; let totalCreditsEarned = 0;
    allSemesterData.forEach(semester => {
        semester.courses.forEach(course => {
            if (course.credits && typeof course.credits === 'number' && course.credits > 0) {
                const gradePoint = getGradePoint(course.grade);
                if (gradePoint !== null && gradePoint >= 3) {
                    totalCreditPoints += gradePoint * course.credits;
                    totalCreditsEarned += course.credits;
                }
            }
        });
    });
    if (totalCreditsEarned === 0) return null;
    return parseFloat((totalCreditPoints / totalCreditsEarned).toFixed(2));
};

export default function StudentMarksPage() {
   const [marksData, setMarksData] = React.useState<SemesterMark[]>([]);
   const [backlogData, setBacklogData] = React.useState<BacklogEntry[]>([]);
   const [isLoading, setIsLoading] = React.useState(true);
   const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const loadData = async () => {
            setIsLoading(true); setError(null);
            const storedUserString = localStorage.getItem('loggedInUser');
            if (!storedUserString) { setError("Student not logged in."); setIsLoading(false); return; }
            try {
                const user = JSON.parse(storedUserString);
                const [fetchedMarks, fetchedBacklogs] = await Promise.all([
                    fetchStudentMarks(user.id),
                    fetchStudentBacklogs(user.id)
                ]);
                const marksWithGPA = fetchedMarks.map(sem => ({ ...sem, gpa: calculateSGPA(sem.courses) }));
                setMarksData(marksWithGPA);
                setBacklogData(fetchedBacklogs);
            } catch (e: any) { setError(e.message || "Failed to load academic data."); } 
            finally { setIsLoading(false); }
        };
        loadData();
    }, []);

   const validSemesters = React.useMemo(() => marksData.filter(s => s && s.semester).sort((a, b) => (b.semester || 0) - (a.semester || 0)), [marksData]);
   const calculatedCGPA = React.useMemo(() => calculateCGPA(marksData), [marksData]);
   const activeBacklogs = React.useMemo(() => backlogData.filter(b => b.status === 'Active'), [backlogData]);
   const clearedBacklogs = React.useMemo(() => backlogData.filter(b => b.status === 'Cleared'), [backlogData]);

   const getGradeBadgeVariant = (grade: string | null): "default" | "secondary" | "outline" | "destructive" => {
      if (!grade) return "outline";
      const upperGrade = grade.toUpperCase();
      if (['O', 'A+', 'A'].includes(upperGrade)) return "default"; 
      if (['B+', 'B'].includes(upperGrade)) return "secondary"; 
      if (['C+', 'C', 'P'].includes(upperGrade)) return "outline"; 
      if (upperGrade === 'FAIL') return "destructive"; 
      return "outline";
   }

    if (isLoading) { return <div className="flex justify-center items-center h-64"><Loader2 className="mr-2 h-8 w-8 animate-spin" /></div>; }
    if (error) { return <div className="text-center text-destructive py-10">{error}</div>; }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Marks & Grades</h1>
       <Card>
        <CardHeader><CardTitle>Overall Performance</CardTitle><CardDescription>Summary of your academic performance.</CardDescription></CardHeader>
        <CardContent>
             <div className="flex items-center justify-between"><span className="text-sm font-medium text-muted-foreground">Cumulative GPA (CGPA)</span><span className="text-2xl font-bold">{calculatedCGPA?.toFixed(2) ?? 'N/A'}</span></div>
        </CardContent>
      </Card>
      <Accordion type="single" collapsible className="w-full" defaultValue={validSemesters[0]?.semester ? `semester-${validSemesters[0].semester}` : undefined}>
        {validSemesters.map((semesterData) => (
             <AccordionItem key={`semester-${semesterData.semester}`} value={`semester-${semesterData.semester}`}>
             <AccordionTrigger className="text-lg font-medium px-4 py-3 hover:bg-muted/50 rounded-md"><div className="flex justify-between w-full pr-4"><span>Semester {semesterData.semester}</span><Badge variant="secondary">SGPA: {semesterData.gpa?.toFixed(2) ?? 'N/A'}</Badge></div></AccordionTrigger>
             <AccordionContent className="px-1 pb-1">
               <Table><TableHeader><TableRow><TableHead>Course</TableHead><TableHead>Internals</TableHead><TableHead>Externals</TableHead><TableHead>Total</TableHead><TableHead>Grade</TableHead><TableHead className="text-right">Credits</TableHead></TableRow></TableHeader>
                 <TableBody>{semesterData.courses.map((course, index) => (<TableRow key={course.code || index}><TableCell>{course.code} - {course.name}</TableCell><TableCell>{course.internals ?? '-'}</TableCell><TableCell>{course.externals ?? '-'}</TableCell><TableCell>{course.total ?? '-'}</TableCell><TableCell><Badge variant={getGradeBadgeVariant(course.grade)}>{course.grade || 'N/A'}</Badge></TableCell><TableCell className="text-right">{course.credits ?? '-'}</TableCell></TableRow>))}</TableBody>
               </Table>
             </AccordionContent>
             </AccordionItem>
        ))}
      </Accordion>
      <Card>
        <CardHeader><CardTitle>Backlog Summary</CardTitle><CardDescription>Details of active and cleared backlogs.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
            <div><h3 className="text-lg font-semibold mb-2 text-destructive flex items-center"><AlertTriangle className="mr-2 h-5 w-5" /> Active Backlogs ({activeBacklogs.length})</h3>
                {activeBacklogs.length > 0 ? (<Table><TableHeader><TableRow><TableHead>Course</TableHead><TableHead>Sem Attempted</TableHead></TableRow></TableHeader><TableBody>{activeBacklogs.map((b, i) => <TableRow key={i}><TableCell>{b.courseCode} - {b.courseName}</TableCell><TableCell>{b.semesterAttempted}</TableCell></TableRow>)}</TableBody></Table>) : <p className="text-sm text-muted-foreground text-center py-4">No active backlogs.</p>}
            </div>
            <div><h3 className="text-lg font-semibold mb-2 text-green-600 flex items-center"><CheckCircle className="mr-2 h-5 w-5" /> Cleared Backlogs ({clearedBacklogs.length})</h3>
                {clearedBacklogs.length > 0 ? (<Table><TableHeader><TableRow><TableHead>Course</TableHead><TableHead>Grade Achieved</TableHead></TableRow></TableHeader><TableBody>{clearedBacklogs.map((b, i) => <TableRow key={i}><TableCell>{b.courseCode} - {b.courseName}</TableCell><TableCell><Badge variant={getGradeBadgeVariant(b.gradeAchieved)}>{b.gradeAchieved}</Badge></TableCell></TableRow>)}</TableBody></Table>) : <p className="text-sm text-muted-foreground text-center py-4">No cleared backlogs.</p>}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
