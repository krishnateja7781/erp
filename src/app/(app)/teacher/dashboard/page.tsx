
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarCheck, BookOpen, MessageSquare, Loader2, Edit, AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { getTeacherDashboardData, type TeacherDashboardData } from '@/actions/dashboard-actions';
import { Badge } from "@/components/ui/badge";

export default function TeacherDashboardPage() {
    const [dashboardData, setDashboardData] = React.useState<TeacherDashboardData | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        
        const storedUserString = localStorage.getItem('loggedInUser');
        if (!storedUserString) {
            setError("Login information not found. Please log in again.");
            setIsLoading(false);
            return;
        }

        try {
            const user = JSON.parse(storedUserString);
            if (user && user.id) {
                const data = await getTeacherDashboardData(user.id);
                setDashboardData(data);
            } else {
                setError("Could not identify teacher. Please log in again.");
            }
        } catch (err: any) {
            console.error("Failed to load dashboard data:", err);
            setError("Could not load your dashboard data. Please try refreshing.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadData();
    }, [loadData]);


    if (isLoading) {
        return (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading Dashboard...</span>
          </div>
        );
    }

    if (error || !dashboardData) {
        return (
            <div className="text-center text-destructive py-10">
                 <AlertTriangle className="mx-auto h-12 w-12" />
                <h2 className="mt-4 text-lg font-semibold">Failed to Load Dashboard</h2>
                <p className="text-sm">{error || "Dashboard data could not be retrieved."}</p>
                <Button onClick={loadData} className="mt-4" variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Welcome, {dashboardData.name || 'Teacher'}!</h1>
            <p className="text-muted-foreground">Here's a summary of your courses, schedule, and tasks.</p>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary"/> Courses You're Teaching</CardTitle>
                        <CardDescription>Overview of your currently assigned courses.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {dashboardData.coursesTeaching.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Course</TableHead>
                                        <TableHead className="text-right">Students</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {dashboardData.coursesTeaching.map(course => (
                                        <TableRow key={course.id}>
                                            <TableCell className="font-medium">{course.name}</TableCell>
                                            <TableCell className="text-right">{course.studentCount}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <p className="text-center text-muted-foreground py-4">No courses assigned.</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-green-600"/> Today's Schedule</CardTitle>
                        <CardDescription>Your upcoming classes for today.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {dashboardData.upcomingClasses.length > 0 ? (
                            dashboardData.upcomingClasses.map((item, index) => (
                                <div key={index} className="flex items-center justify-between text-sm">
                                    <p>{item.time} - {item.course} ({item.class})</p>
                                    <p className="text-muted-foreground">{item.location}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-muted-foreground py-4">No classes scheduled for today.</p>
                        )}
                        <Link href="/teacher/profile" passHref><Button variant="link" size="sm" className="w-full p-0 h-auto justify-start">View Full Timetable</Button></Link>
                    </CardContent>
                </Card>
                
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Edit className="h-5 w-5 text-orange-500"/> Pending Tasks</CardTitle>
                        <CardDescription>Action items that need your attention.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                         <div className="flex justify-between items-center text-sm">
                            <p>Marks to be entered</p>
                            <Badge variant="destructive">{dashboardData.pendingMarksCount} students</Badge>
                         </div>
                         <Button asChild variant="outline" size="sm"><Link href="/teacher/marks">Enter Marks</Link></Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-blue-500"/> Communication</CardTitle>
                        <CardDescription>Engage with your students and colleagues.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        <Button asChild variant="default"><Link href="/chat">Open Chat Lobby</Link></Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
