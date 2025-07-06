
'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Mail, Phone, Home, Calendar, ArrowLeft, Edit, Trash2, DollarSign, CheckCircle, BookOpen, BedDouble, GraduationCap } from "lucide-react";
import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { deleteStudent, type FullStudentData } from '@/actions/student-actions';
import { AddStudentDialog } from '@/components/admin/students/add-student-dialog';


interface StudentProfileClientPageProps {
  initialStudentData: FullStudentData;
}

export function StudentProfileClientPage({ initialStudentData }: StudentProfileClientPageProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [studentData] = React.useState<FullStudentData>(initialStudentData);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);

    const handleProfileUpdate = () => {
        toast({ title: "Profile Updated", description: "Refreshing student data..." });
        router.refresh();
    };

    const confirmDeleteStudent = async () => {
        if (!studentData?.profile) return;
        const { id, name } = studentData.profile;
        const result = await deleteStudent(id);

        if (result.success) {
            toast({ title: "Student Deleted", description: result.message });
            router.push('/admin/students');
        } else {
            toast({ variant: "destructive", title: "Deletion Failed", description: result.error });
        }
    };

    const getFeeStatusBadge = (status: string | null) => {
        switch (status?.toLowerCase()) {
            case 'paid': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Paid</Badge>;
            case 'pending': return <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-black">Pending</Badge>;
            case 'overdue': return <Badge variant="destructive">Overdue</Badge>;
            default: return <Badge variant="outline">{status || 'N/A'}</Badge>;
        }
    };
    
    const handleViewAttendanceLog = () => toast({ title: "Info", description: "Detailed attendance log view not implemented." });
    const handleViewMarksSheet = () => toast({ title: "Info", description: "Detailed marks sheet view not implemented." });
    const handleViewPaymentHistory = () => toast({ title: "Info", description: "Payment history view not implemented." });

    const { profile, attendance, marks, fees, hostelInfo } = studentData;

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
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Student
                            </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the profile for
                                    <span className="font-semibold"> {profile.name} ({profile.collegeId})</span>.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    className="bg-destructive hover:bg-destructive/90"
                                    onClick={confirmDeleteStudent}
                                >
                                    Delete
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>

                <h1 className="text-3xl font-bold">Student Profile: {profile.name}</h1>

                <Card>
                    <CardHeader className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left space-y-4 md:space-y-0 md:space-x-6">
                    <Avatar className="h-24 w-24 border">
                        <AvatarImage src={profile.avatarUrl || undefined} alt={profile.name || 'Student'} />
                        <AvatarFallback className="text-3xl">{profile.initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <CardTitle className="text-2xl">{profile.name}</CardTitle>
                        <CardDescription className="text-lg">{profile.collegeId || profile.id}</CardDescription>
                        <p className="flex items-center justify-center md:justify-start gap-1 text-muted-foreground"><GraduationCap className="h-4 w-4"/> {profile.program} - {profile.branch} (Year {profile.year || 'N/A'})</p>
                        <p className="text-muted-foreground">Batch: {profile.batch}</p>
                        <div className="flex gap-2 mt-2 justify-center md:justify-start">
                            <Badge variant={profile.status === 'Active' ? 'default' : 'destructive'}>{profile.status}</Badge>
                            <Badge variant="secondary">{profile.type}</Badge>
                            {profile.type === 'Hosteler' && hostelInfo && (
                                <Badge variant="outline">{hostelInfo.hostelName} / {hostelInfo.roomNumber}</Badge>
                            )}
                        </div>
                    </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                    <div className="space-y-2">
                        <h3 className="font-semibold text-primary">Contact Information</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground"> <Mail className="h-4 w-4" /> <span>{profile.email}</span> </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground"> <Phone className="h-4 w-4" /> <span>{profile.phone}</span> </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground"> <Calendar className="h-4 w-4" /> <span>DOB: {profile.dob ? new Date(profile.dob).toLocaleDateString() : 'N/A'}</span> </div>
                        <div className="flex items-start gap-2 text-sm text-muted-foreground"> <Home className="h-4 w-4 mt-0.5 flex-shrink-0" /> <span>{profile.address}</span> </div>
                        {profile.type === "Hosteler" && hostelInfo && (
                            <div className="flex items-start gap-2 text-sm text-muted-foreground pt-2 border-t mt-3">
                            <BedDouble className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                                <div>
                                    <span className="font-medium block text-primary">Hostel Address:</span>
                                    <span>{hostelInfo.hostelName}, Room {hostelInfo.roomNumber}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="space-y-2">
                        <h3 className="font-semibold text-primary">Emergency Contact</h3>
                        {profile.emergencyContact && (profile.emergencyContact.name || profile.emergencyContact.phone) ? (
                            <>
                                <p className="text-sm text-muted-foreground">
                                    <span className="font-medium">Name:</span> {profile.emergencyContact.name || 'N/A'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    <span className="font-medium">Phone:</span> {profile.emergencyContact.phone || 'N/A'}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    <span className="font-medium">Address:</span> {profile.emergencyContact.address || 'N/A'}
                                </p>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">No emergency contact information provided.</p>
                        )}
                    </div>
                    </CardContent>
                </Card>


                <div className="grid gap-6 lg:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-600"/> Attendance Summary</CardTitle>
                            <CardDescription>Overall attendance and course-wise breakdown.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Overall Percentage</span>
                                <span className="text-2xl font-bold">{attendance.overallPercentage ?? 'N/A'}%</span>
                            </div>
                            <Progress value={attendance.overallPercentage || 0} aria-label={`${attendance.overallPercentage ?? 0}% Overall Attendance`} />
                            {(attendance.overallPercentage || 0) < 75 && (
                                <p className="text-sm text-destructive">Below minimum requirement (75%)</p>
                            )}
                            <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleViewAttendanceLog}>
                                    View Detailed Attendance Log
                                </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-blue-600"/> Marks & Grades Summary</CardTitle>
                            <CardDescription>Overall CGPA and recent performance.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Cumulative GPA (CGPA)</span>
                                <span className="text-2xl font-bold">{marks.cgpa?.toFixed(2) || 'N/A'}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Improved from last semester</p>
                            <h4 className="font-semibold text-sm pt-2">Recent Grades:</h4>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Course</TableHead><TableHead className="text-right">Grade</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {marks.recentGrades.map((grade: any, index: number) => (
                                        <TableRow key={`${grade.course}-${index}`}>
                                            <TableCell className="font-medium">{grade.course}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant={grade.grade.startsWith('A') ? 'default' : grade.grade.startsWith('B') ? 'secondary' : 'outline'}>
                                                    {grade.grade}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleViewMarksSheet}>
                                    View Detailed Marks Sheet
                                </Button>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-orange-600"/> Fees Summary</CardTitle>
                        <CardDescription>Current fee payment status.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Total Fees</p>
                            <p className="text-xl font-semibold">₹{fees.totalFees?.toLocaleString() || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Amount Paid</p>
                            <p className="text-xl font-semibold text-green-600">₹{fees.amountPaid?.toLocaleString() || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Remaining Balance</p>
                            <p className={`text-xl font-semibold ${(fees.remainingBalance || 0) > 0 ? 'text-destructive' : 'text-green-600'}`}>
                                ₹{fees.remainingBalance?.toLocaleString() || 'N/A'}
                            </p>
                            {(fees.remainingBalance || 0) > 0 && (
                                <p className="text-xs text-muted-foreground">Due: {fees.dueDate || 'N/A'}</p>
                            )}
                        </div>
                    </CardContent>
                    <CardContent className="pt-0 border-t mt-4 pt-4 flex items-center justify-between">
                        <div>
                            <span className="text-sm font-medium mr-2">Status:</span>
                            {getFeeStatusBadge(fees.status)}
                        </div>
                        <Button variant="outline" size="sm" onClick={handleViewPaymentHistory}>
                            View Payment History
                        </Button>
                    </CardContent>
                </Card>
            </div>
            <AddStudentDialog
                isOpen={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                initialData={profile}
                onSave={handleProfileUpdate}
            />
        </>
    );
}
