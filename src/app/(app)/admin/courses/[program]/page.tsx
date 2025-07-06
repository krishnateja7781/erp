'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PlusCircle, Loader2, MoreHorizontal, Pencil, Trash2, Library, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getGroupedCourses, deleteCourse, type GroupedCourses, type Course } from '@/actions/course-actions';
import { CourseDialog } from '@/components/admin/courses/course-dialog';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSectionsForBranch, getStudentsForSection } from '@/actions/student-actions';
import type { Student } from '@/lib/types';
import { Badge } from '@/components/ui/badge';


export default function AdminProgramCoursesPage() {
    const params = useParams();
    const programName = React.useMemo(() => decodeURIComponent(params.program as string), [params.program]);

    const [groupedCourses, setGroupedCourses] = React.useState<GroupedCourses>({});
    const [isLoading, setIsLoading] = React.useState(true);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingCourse, setEditingCourse] = React.useState<Partial<Course> | null>(null);
    const { toast } = useToast();

    // State for sections and students
    const [sectionsByBranch, setSectionsByBranch] = React.useState<Record<string, string[]>>({});
    const [studentsBySection, setStudentsBySection] = React.useState<Record<string, Student[]>>({});
    const [activeSection, setActiveSection] = React.useState<Record<string, string | null>>({}); // { [branch]: section }
    const [isSectionsLoading, setIsSectionsLoading] = React.useState<Record<string, boolean>>({});
    const [isStudentsLoading, setIsStudentsLoading] = React.useState<Record<string, boolean>>({});

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedCourses = await getGroupedCourses();
            setGroupedCourses(fetchedCourses);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to load course data.' });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);
    
    const handleAddCourse = (branch: string, semester: number) => {
        setEditingCourse({ program: programName, branch, semester });
        setIsDialogOpen(true);
    };

    const handleAddNewCourse = () => {
        setEditingCourse({ program: programName });
        setIsDialogOpen(true);
    };

    const handleEditCourse = (course: Course) => {
        setEditingCourse(course);
        setIsDialogOpen(true);
    };

    const handleDeleteCourse = async (course: Course) => {
        const result = await deleteCourse(course.id);
        if (result.success) {
            toast({ title: 'Success', description: result.message });
            loadData();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    };
    
    const handleBranchAccordionToggle = async (branch: string) => {
        if (sectionsByBranch[branch]) return;
        setIsSectionsLoading(prev => ({ ...prev, [branch]: true }));
        try {
            const sections = await getSectionsForBranch(programName, branch);
            setSectionsByBranch(prev => ({...prev, [branch]: sections}));
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: `Could not fetch sections for ${branch}.`});
        } finally {
            setIsSectionsLoading(prev => ({ ...prev, [branch]: false }));
        }
    };

    const handleSectionSelect = async (branch: string, section: string) => {
        setActiveSection(prev => ({ ...prev, [branch]: section }));
        setIsStudentsLoading(prev => ({ ...prev, [`${branch}-${section}`]: true }));
        try {
            const students = await getStudentsForSection(programName, branch, section);
            setStudentsBySection(prev => ({ ...prev, [`${branch}-${section}`]: students }));
        } catch(e) {
            toast({ variant: 'destructive', title: 'Error', description: `Could not fetch students for Section ${section}.`});
        } finally {
            setIsStudentsLoading(prev => ({ ...prev, [`${branch}-${section}`]: false }));
        }
    };
    
    const getStatusBadge = (status: string | null) => {
      if (!status) return <Badge variant="outline">N/A</Badge>;
      switch (status.toLowerCase()) {
          case 'active': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Active</Badge>;
          case 'inactive': return <Badge variant="secondary">Inactive</Badge>;
          case 'suspended': return <Badge variant="destructive">Suspended</Badge>
          default: return <Badge variant="outline">{status}</Badge>;
      }
    };


    const programData = groupedCourses[programName] || {};
    const branches = Object.keys(programData).sort();
    
    if (isLoading) {
      return (
          <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
          </div>
      );
    }
    
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin/courses" passHref>
                        <Button variant="outline" size="icon" aria-label="Back to Programs">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold">{programName} Courses</h1>
                </div>
                <Button onClick={handleAddNewCourse}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Course
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Course Catalogue for {programName}</CardTitle>
                    <CardDescription>Hierarchical view of all courses and student sections in this program.</CardDescription>
                </CardHeader>
                <CardContent>
                    {branches.length > 0 ? (
                        <Accordion type="multiple" className="w-full" onValueChange={(values) => {
                            values.forEach(value => {
                                const [prog, branch] = value.split('-');
                                if (branch) handleBranchAccordionToggle(branch);
                            });
                        }}>
                            {branches.map(branch => (
                                <AccordionItem key={`${programName}-${branch}`} value={`${programName}-${branch}`}>
                                    <AccordionTrigger className="text-lg">{branch}</AccordionTrigger>
                                    <AccordionContent className="pl-2">
                                        <Tabs defaultValue="courses" className="w-full">
                                            <TabsList>
                                                <TabsTrigger value="courses">Courses</TabsTrigger>
                                                <TabsTrigger value="sections">Sections &amp; Students</TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="courses" className="mt-4">
                                                {Object.keys(programData[branch]).sort((a,b) => parseInt(a) - parseInt(b)).map(semesterStr => {
                                                    const semester = parseInt(semesterStr);
                                                    return (
                                                        <div key={`${programName}-${branch}-${semester}`} className="mb-4">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <h4 className="font-semibold text-md">Semester {semester}</h4>
                                                                <Button size="sm" variant="outline" onClick={() => handleAddCourse(branch, semester)}><PlusCircle className="mr-2 h-4 w-4" /> Add Course</Button>
                                                            </div>
                                                            <Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead className="text-center">Credits</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                                                <TableBody>{programData[branch][semester].map(course => (
                                                                    <TableRow key={course.id}><TableCell className="font-medium">{course.courseId}</TableCell><TableCell>{course.courseName}</TableCell><TableCell className="text-center">{course.credits}</TableCell>
                                                                        <TableCell className="text-right">
                                                                            <AlertDialog>
                                                                                <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                                                    <DropdownMenuContent align="end">
                                                                                        <DropdownMenuItem onClick={() => handleEditCourse(course)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                                                                        <AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem></AlertDialogTrigger>
                                                                                    </DropdownMenuContent>
                                                                                </DropdownMenu>
                                                                                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will delete the course <span className="font-semibold">{course.courseId} - {course.courseName}</span>. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteCourse(course)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                                                            </AlertDialog>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}</TableBody>
                                                            </Table>
                                                        </div>
                                                    )
                                                })}
                                            </TabsContent>
                                            <TabsContent value="sections" className="mt-4">
                                                {isSectionsLoading[branch] ? <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div> :
                                                sectionsByBranch[branch] && sectionsByBranch[branch].length > 0 ? (
                                                    <div className="flex flex-col gap-4">
                                                        <div className="flex flex-wrap gap-2">
                                                            {(sectionsByBranch[branch] || []).map(section => (
                                                                <Button key={section} variant={activeSection[branch] === section ? "default" : "outline"} onClick={() => handleSectionSelect(branch, section)} disabled={isStudentsLoading[`${branch}-${section}`]}>
                                                                    {isStudentsLoading[`${branch}-${section}`] && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                                                    Section {section}
                                                                </Button>
                                                            ))}
                                                        </div>
                                                        {activeSection[branch] && (
                                                            <div className="border-t pt-4">
                                                                <h4 className="font-semibold mb-2">Students in Section {activeSection[branch]}</h4>
                                                                {isStudentsLoading[`${branch}-${activeSection[branch]}`] ? <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin"/></div> :
                                                                    <Table>
                                                                        <TableHeader><TableRow><TableHead>College ID</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                                                                        <TableBody>
                                                                            {studentsBySection[`${branch}-${activeSection[branch]}`]?.length > 0 ? (
                                                                                studentsBySection[`${branch}-${activeSection[branch]}`].map(student => (
                                                                                    <TableRow key={student.id}><TableCell>{student.collegeId}</TableCell><TableCell>{student.name}</TableCell><TableCell>{getStatusBadge(student.status)}</TableCell></TableRow>
                                                                                ))
                                                                            ) : (<TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No students found for this section.</TableCell></TableRow>)}
                                                                        </TableBody>
                                                                    </Table>
                                                                }
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (<p className="text-center text-muted-foreground py-4">No sections found for this branch.</p>)}
                                            </TabsContent>
                                        </Tabs>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                         <div className="text-center text-muted-foreground py-10 flex flex-col items-center gap-4">
                            <Library className="h-12 w-12 text-muted-foreground/50"/>
                            <p>No courses found for {programName}.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
             <CourseDialog
                key={editingCourse ? JSON.stringify(editingCourse) : 'new-course'}
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onCourseSaved={loadData}
                initialData={editingCourse}
            />
        </div>
    );
}