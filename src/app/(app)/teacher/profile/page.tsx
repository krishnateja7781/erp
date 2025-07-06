
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, Phone, Briefcase, GraduationCap, Edit, CalendarDays, Home, BookOpen, Building, Loader2 } from "lucide-react";
import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { TimetableGrid, type ScheduleEntry } from '@/components/shared/TimetableGrid';
import { useRouter } from 'next/navigation';
import { getTeacherProfileDetails, type FullTeacherData } from '@/actions/staff-actions';


export default function TeacherProfilePage() {
    const { toast } = useToast();
    const [teacherData, setTeacherData] = React.useState<FullTeacherData | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const router = useRouter(); 

    React.useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            setError(null);
            const storedUserString = typeof window !== 'undefined' ? localStorage.getItem('loggedInUser') : null;
            if (storedUserString) {
                try {
                    const user = JSON.parse(storedUserString);
                    if (user && user.id && user.role === 'teacher') {
                        const data = await getTeacherProfileDetails(user.id);
                        if (data) {
                            setTeacherData(data);
                        } else {
                            setError("Could not find profile data for the logged-in teacher.");
                        }
                    } else {
                        setError("Could not identify logged-in teacher.");
                    }
                } catch (e) {
                    console.error("Failed to load teacher profile:", e);
                    setError("An error occurred while loading your profile.");
                }
            } else {
                 setError("Not logged in. Please log in to view your profile.");
            }
            setIsLoading(false);
        };
        loadData();
    }, []);

    const handleEditProfile = () => {
        // Navigate to the same edit page as admin, but for the current user
        if (teacherData?.profile.id) {
            router.push(`/admin/teachers?action=edit&id=${teacherData.profile.id}`);
        } else {
            toast({ title: "Info", description: "Cannot edit profile without a valid ID." });
        }
    };

    const handleTimetableClick = (day: ScheduleEntry['day'], period: ScheduleEntry['period'], entry: (ScheduleEntry & { classId?: string }) | null) => {
         if (entry && entry.classId) { 
             const targetUrl = `/teacher/attendance?classId=${entry.classId}`;
             router.push(targetUrl);
         } else {
              toast({
                  variant: "destructive",
                  title: "Navigation Error",
                  description: `Could not find class details for this slot. Please select the class manually.`,
                  duration: 4000,
              });
         }
     };

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="mr-2 h-8 w-8 animate-spin"/>Loading profile...</div>;
    }

    if (error) {
        return <div className="text-center text-destructive py-10">{error}</div>;
    }

    if (!teacherData) {
        return <div className="text-center text-muted-foreground py-10">Profile data could not be loaded.</div>;
    }

    const { profile, coursesAssigned, schedule, responsibilities } = teacherData;

    return (
        <div className="space-y-6">
             <div className="flex items-center justify-between">
                 <h1 className="text-3xl font-bold">My Profile</h1>
                 <Button variant="outline" onClick={handleEditProfile}>
                     <Edit className="mr-2 h-4 w-4" /> Edit Profile
                 </Button>
             </div>

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
                        {profile?.program === 'B.Tech' ? <GraduationCap className="h-4 w-4" /> : <Building className="h-4 w-4" />}
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
                    <CardDescription>List of courses you are currently handling. Click on a timetable slot below to mark attendance.</CardDescription>
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
                </CardContent>
            </Card>

             <TimetableGrid
                 schedule={schedule || []}
                 interactive={true} 
                 onCellClick={handleTimetableClick} 
                 className="mt-6"
             />
        </div>
    );
}
