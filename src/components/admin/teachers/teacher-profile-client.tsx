
'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, Phone, Briefcase, GraduationCap, ArrowLeft, Edit, Trash2, CalendarDays, Home, BookOpen, Building } from "lucide-react";
import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { TimetableGrid, type ScheduleEntry } from '@/components/shared/TimetableGrid';
import { deleteTeacher, type FullTeacherData } from '@/actions/staff-actions';
import { AddStaffDialog } from '@/components/admin/staff/add-staff-dialog';

interface TeacherProfileClientPageProps {
  initialTeacherData: FullTeacherData;
}

export function TeacherProfileClientPage({ initialTeacherData }: TeacherProfileClientPageProps) {
    const router = useRouter(); 
    const { toast } = useToast(); 
    const [teacherData] = React.useState<FullTeacherData>(initialTeacherData);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

    const handleProfileUpdate = () => {
        toast({ title: "Profile Updated", description: "Refreshing teacher data..." });
        router.refresh();
    };

    const confirmDeleteTeacher = async () => {
        if (!teacherData?.profile) return;
        const { id, name } = teacherData.profile;
        const result = await deleteTeacher(id);

        if (result.success) {
            toast({ title: "Teacher Deleted", description: result.message });
            router.push('/admin/teachers');
        } else {
            toast({ variant: "destructive", title: "Deletion Failed", description: result.error });
        }
    };

    const handleManageCourses = () => {
        router.push('/admin/classes');
    }
    
    const { profile, coursesAssigned, schedule, responsibilities } = teacherData;

    return (
        <>
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Button variant="outline" size="icon" onClick={() => router.back()} aria-label="Back">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
                        <Edit className="mr-2 h-4 w-4" /> Edit Profile
                    </Button>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Teacher
                           </Button>
                        </AlertDialogTrigger>
                         <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the profile for
                                <span className="font-semibold"> {profile?.name} ({profile?.staffId})</span> and unassign them from all classes.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-destructive hover:bg-destructive/90"
                                onClick={confirmDeleteTeacher}
                            >
                                Delete
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            <h1 className="text-3xl font-bold">Teacher Profile: {profile?.name}</h1>

             <Card>
                <CardHeader className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left space-y-4 md:space-y-0 md:space-x-6">
                <Avatar className="h-24 w-24 border">
                    <AvatarImage src={profile?.avatarUrl || undefined} alt={profile?.name || 'Teacher'} data-ai-hint={`${profile?.department || ''} teacher`}/>
                    <AvatarFallback className="text-3xl">{profile?.initials || '?'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <CardTitle className="text-2xl">{profile?.name}</CardTitle>
                    <CardDescription className="text-lg">{profile?.staffId}</CardDescription>
                    <div className="flex items-center gap-2 mt-1 justify-center md:justify-start text-muted-foreground">
                       {profile?.program === 'General Administration' ? <Building className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
                       <span>{profile?.program} - {profile?.department}</span>
                    </div>
                     <div className="flex items-center gap-2 mt-1 justify-center md:justify-start text-muted-foreground">
                        <Briefcase className="h-4 w-4" /> <span>{profile?.position}</span>
                     </div>
                     <div className="flex gap-2 mt-2 justify-center md:justify-start">
                         <Badge variant={profile?.status === 'Active' ? 'default' : 'secondary'}>{profile?.status}</Badge>
                     </div>
                </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                <div className="space-y-2">
                    <h3 className="font-semibold text-primary">Contact Information</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"> <Mail className="h-4 w-4" /> <span>{profile?.email}</span> </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"> <Phone className="h-4 w-4" /> <span>{profile?.phone}</span> </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"> <Home className="h-4 w-4" /> <span>Office: {profile?.officeLocation}</span> </div>
                </div>
                <div className="space-y-2">
                    <h3 className="font-semibold text-primary">Professional Details</h3>
                     <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="h-4 w-4" /> <span>Joined: {profile?.joinDate}</span>
                     </div>
                     <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Qualifications:</span> {profile?.qualifications}
                     </p>
                     <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Specialization:</span> {profile?.specialization}
                     </p>
                      <h3 className="font-semibold text-primary pt-2">Responsibilities</h3>
                     {responsibilities && responsibilities.length > 0 ? (
                         <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                             {responsibilities.map((resp: string, index: number) => <li key={index}>{resp}</li>)}
                         </ul>
                     ) : <p className="text-sm text-muted-foreground">No specific responsibilities listed.</p>}
                </div>
                </CardContent>
            </Card>


            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-indigo-600"/> Courses Assigned</CardTitle>
                    <CardDescription>List of courses currently handled by the teacher. Click "Manage Assignments" to make changes.</CardDescription>
                </CardHeader>
                <CardContent>
                    {coursesAssigned && coursesAssigned.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Course Code</TableHead><TableHead>Course Name</TableHead><TableHead className="text-center">Semester</TableHead><TableHead className="text-right">Class</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {coursesAssigned.map((course: any) => (
                                    <TableRow 
                                        key={course.id || (course.code + course.class)}
                                        onClick={() => router.push(`/teacher/attendance?classId=${course.id}`)}
                                        className="cursor-pointer"
                                    >
                                        <TableCell>{course.code}</TableCell>
                                        <TableCell className="font-medium">{course.name}</TableCell>
                                        <TableCell className="text-center">{course.semester}</TableCell>
                                        <TableCell className="text-right">{course.class}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <p className="text-muted-foreground text-center py-4">No courses currently assigned.</p>
                    )}
                    <div className="pt-4 text-right">
                        <Button variant="outline" size="sm" onClick={handleManageCourses}>Manage Course Assignments</Button>
                    </div>
                </CardContent>
            </Card>

             <TimetableGrid schedule={schedule || []} className="mt-6" />

        </div>
        
        <AddStaffDialog 
            isOpen={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            initialData={profile}
            onStaffAdded={handleProfileUpdate}
        />
        </>
    );
}
