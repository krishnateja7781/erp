
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { CourseDialog } from '@/components/admin/courses/course-dialog';
import { getGroupedCourses } from '@/actions/course-actions';

// Define the top-level programs available in the institution.
const PROGRAMS = ["B.Tech", "MBA", "Law", "MBBS", "B.Sc", "B.Com"];

export default function AdminCoursesProgramSelectionPage() {
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);

    // Dummy handler because the dialog needs it, but it will be handled by the specific page
    const handleCourseSaved = () => {
        toast({ title: 'Action Complete', description: 'Returning to program selection.' });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Manage Courses</h1>
                 <Button onClick={() => setIsDialogOpen(true)}>Add New Course</Button>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>Select a Program</CardTitle>
                    <CardDescription>Choose a program to view or manage its course catalogue.</CardDescription>
                </CardHeader>
                <CardContent>
                    {PROGRAMS.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {PROGRAMS.map(program => (
                                <Card key={program} className="flex flex-col">
                                    <CardHeader className="flex-grow">
                                        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-lg font-medium">{program}</CardTitle>
                                            <GraduationCap className="h-6 w-6 text-muted-foreground" />
                                        </div>
                                         <CardDescription>
                                            Manage courses related to the {program} program.
                                         </CardDescription>
                                    </CardHeader>
                                    <CardFooter>
                                        <Link href={`/admin/courses/${encodeURIComponent(program)}`} passHref className="w-full">
                                            <Button className="w-full">
                                               View Courses
                                            </Button>
                                        </Link>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-muted-foreground py-10 flex flex-col items-center gap-4">
                            <p>No programs are configured in the application.</p>
                        </div>
                    )}
                </CardContent>
             </Card>
             <CourseDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onCourseSaved={handleCourseSaved}
            />
        </div>
    );
}
