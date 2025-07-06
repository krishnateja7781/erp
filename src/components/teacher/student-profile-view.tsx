'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Mail, Phone, Home, Calendar, BedDouble, GraduationCap, CheckCircle, BookOpen, DollarSign } from "lucide-react";
import type { FullStudentData } from '@/actions/student-actions';

interface StudentProfileViewProps {
  studentData: FullStudentData;
}

export function StudentProfileView({ studentData }: StudentProfileViewProps) {
    const { profile, attendance, marks, fees, hostelInfo } = studentData;

    const getFeeStatusBadge = (status: string | null) => {
        switch (status?.toLowerCase()) {
            case 'paid': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Paid</Badge>;
            case 'pending': return <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-black">Pending</Badge>;
            case 'overdue': return <Badge variant="destructive">Overdue</Badge>;
            default: return <Badge variant="outline">{status || 'N/A'}</Badge>;
        }
    };

    return (
        <div className="space-y-6">
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
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"> <Phone className="h-4 w-4" /> <span>{profile.phone || '[Not Provided]'}</span> </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"> <Calendar className="h-4 w-4" /> <span>DOB: {profile.dob ? new Date(profile.dob).toLocaleDateString() : 'N/A'}</span> </div>
                    <div className="flex items-start gap-2 text-sm text-muted-foreground"> <Home className="h-4 w-4 mt-0.5 flex-shrink-0" /> <span>{profile.address || '[Not Provided]'}</span> </div>
                </div>
                <div className="space-y-2">
                    <h3 className="font-semibold text-primary">Emergency Contact</h3>
                    {profile.emergencyContact && (profile.emergencyContact.name || profile.emergencyContact.phone) ? (
                        <>
                            <p className="text-sm text-muted-foreground"><span className="font-medium">Name:</span> {profile.emergencyContact.name || 'N/A'}</p>
                            <p className="text-sm text-muted-foreground"><span className="font-medium">Phone:</span> {profile.emergencyContact.phone || 'N/A'}</p>
                            <p className="text-sm text-muted-foreground"><span className="font-medium">Address:</span> {profile.emergencyContact.address || 'N/A'}</p>
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
                        <CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-600"/> Attendance</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Overall Percentage</span>
                            <span className="text-2xl font-bold">{attendance.overallPercentage ?? 'N/A'}%</span>
                        </div>
                        <Progress value={attendance.overallPercentage || 0} />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-blue-600"/> Marks</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Cumulative GPA (CGPA)</span>
                            <span className="text-2xl font-bold">{marks.cgpa?.toFixed(2) || 'N/A'}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
