'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, BookOpen, CheckCircle, CalendarDays, DollarSign, AlertTriangle, RefreshCw } from "lucide-react";
import { getStudentDashboardData, type StudentDashboardData } from '@/actions/dashboard-actions';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function StudentDashboardPage() {
    const [dashboardData, setDashboardData] = React.useState<StudentDashboardData | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isRefreshing, setIsRefreshing] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [userName, setUserName] = React.useState<string | null>(null);
    const { toast } = useToast();

    const loadData = React.useCallback(async (isRefresh = false) => {
        if (!isRefresh) {
            setIsLoading(true);
        } else {
            setIsRefreshing(true);
        }
        setError(null);
        
        const storedUserString = localStorage.getItem('loggedInUser');
        if (!storedUserString) {
            setError("Login information not found. Please log in again.");
            if (!isRefresh) setIsLoading(false); else setIsRefreshing(false);
            return;
        }

        try {
            const user = JSON.parse(storedUserString);
            if (!isRefresh) setUserName(user.name || "Student");

            if (user && user.id) {
                const data = await getStudentDashboardData(user.id);
                setDashboardData(data);
                if (isRefresh) {
                    toast({ title: "Dashboard Updated", description: "Your data has been refreshed."});
                }
            } else {
                setError("Could not identify student. Please log in again.");
            }
        } catch (err: any) {
            console.error("Failed to load dashboard data:", err);
            setError("Could not load your dashboard data. Please try refreshing.");
        } finally {
            if (!isRefresh) setIsLoading(false); else setIsRefreshing(false);
        }
    }, [toast]);

    // Initial load
    React.useEffect(() => {
        loadData();
    }, [loadData]);

    // Refetch on window focus for a "live" feel
    React.useEffect(() => {
        const handleFocus = () => {
            console.log("Window focused, refreshing dashboard data silently.");
            loadData(true);
        };
        window.addEventListener('focus', handleFocus);
        return () => {
            window.removeEventListener('focus', handleFocus);
        };
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
                <Button onClick={() => loadData()} className="mt-4" variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                </Button>
            </div>
        );
    }

    const { overallAttendance, coursesEnrolledCount, upcomingExam, feeDetails } = dashboardData;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h1 className="text-3xl font-bold">Welcome, {userName || 'Student'}!</h1>
                <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={isRefreshing}>
                    <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
                    Refresh
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm font-medium"><CheckCircle className="h-4 w-4 text-green-600"/> Attendance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{overallAttendance ?? 'N/A'}%</div>
                        <Progress value={overallAttendance ?? 0} aria-label={`${overallAttendance ?? 0}% Attendance`} className="mt-2 h-2" />
                        {overallAttendance !== null && overallAttendance < 75 && <p className="text-xs text-destructive mt-1">Below minimum requirement</p>}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm font-medium"><BookOpen className="h-4 w-4 text-blue-600"/> Courses Enrolled</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{coursesEnrolledCount ?? 'N/A'}</div>
                        <p className="text-xs text-muted-foreground">Courses this semester</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm font-medium"><CalendarDays className="h-4 w-4 text-purple-500"/> Next Exam</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {upcomingExam ? (
                            <>
                                <div className="text-xl font-bold">{upcomingExam.courseName}</div>
                                <p className="text-xs text-muted-foreground">{new Date(upcomingExam.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground">No upcoming exams scheduled.</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm font-medium"><DollarSign className="h-4 w-4 text-orange-500"/> Fee Balance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-3xl font-bold ${feeDetails.balance > 0 ? 'text-destructive' : 'text-green-600'}`}>
                            ₹{feeDetails.balance.toLocaleString()}
                        </div>
                        {feeDetails.balance > 0 && <p className="text-xs text-muted-foreground">Due by: {feeDetails.dueDate || 'N/A'}</p>}
                    </CardContent>
                </Card>
            </div>
            
            {feeDetails.balance > 0 && (
                <Card className="border-destructive bg-destructive/10">
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                        <AlertTriangle className="h-6 w-6 text-destructive"/>
                        <div>
                            <CardTitle className="text-destructive">Action Required</CardTitle>
                            <CardDescription className="text-destructive/80">You have an outstanding fee balance of ₹{feeDetails.balance.toLocaleString()}. Please clear the dues before the deadline.</CardDescription>
                        </div>
                    </CardHeader>
                </Card>
            )}
        </div>
    );
}
