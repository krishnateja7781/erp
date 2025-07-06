
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, User, Users, Search as SearchIcon, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TimetableGrid } from '@/components/shared/TimetableGrid';
import { getTimetableFilters, getScheduleForClass, type FullSchedule, type TeacherSchedule, type TimetableFilters } from '@/actions/timetable-actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


export default function AdminTimetablesPage() {
    const { toast } = useToast();
    const [filters, setFilters] = React.useState<TimetableFilters>({ programs: [], branches: {}, years: [], semesters: [], sections: {} });
    const [selected, setSelected] = React.useState({ program: '', branch: '', semester: '', section: '' });
    const [mode, setMode] = React.useState<'student' | 'teacher'>('student');
    const [scheduleData, setScheduleData] = React.useState<FullSchedule | null>(null);
    const [isLoadingFilters, setIsLoadingFilters] = React.useState(true);
    const [isLoadingSchedule, setIsLoadingSchedule] = React.useState(false);

    React.useEffect(() => {
        const loadFilters = async () => {
            setIsLoadingFilters(true);
            try {
                const data = await getTimetableFilters();
                setFilters(data);
            } catch (error) {
                toast({ variant: 'destructive', title: "Error", description: "Failed to load available filters." });
            } finally {
                setIsLoadingFilters(false);
            }
        };
        loadFilters();
    }, [toast]);

    const handleFilterChange = (filterName: keyof typeof selected, value: string) => {
        const newSelected = { ...selected, [filterName]: value };
        if (filterName === 'program') {
            newSelected.branch = '';
            newSelected.section = '';
        }
        setSelected(newSelected);
        setScheduleData(null); // Clear old data when filters change
    };

    const handleFetchSchedule = async () => {
        if (!selected.program || !selected.branch || !selected.semester || !selected.section) {
            toast({ variant: 'destructive', title: 'Incomplete Selection', description: 'Please select program, branch, semester, and section.' });
            return;
        }
        setIsLoadingSchedule(true);
        setScheduleData(null);
        try {
            const data = await getScheduleForClass(selected);
            setScheduleData(data);
            if (data.studentSchedule.length === 0) {
                 toast({ title: 'No Classes Found', description: 'No classes have been created for the selected criteria.' });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: "Failed to generate timetable." });
        } finally {
            setIsLoadingSchedule(false);
        }
    };
    
    const availableBranches = filters.branches[selected.program] || [];
    const availableSections = filters.sections[selected.program] || [];

    const isFetchDisabled = !selected.program || !selected.branch || !selected.semester || !selected.section || isLoadingSchedule;

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">View Timetables</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Timetable Generator</CardTitle>
                    <CardDescription>Select filters to generate a timetable for a specific class section.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                        <div><Label>Program</Label><Select value={selected.program} onValueChange={(v) => handleFilterChange('program', v)} disabled={isLoadingFilters}><SelectTrigger><SelectValue placeholder="Select Program"/></SelectTrigger><SelectContent>{filters.programs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Branch</Label><Select value={selected.branch} onValueChange={(v) => handleFilterChange('branch', v)} disabled={!selected.program}><SelectTrigger><SelectValue placeholder="Select Branch"/></SelectTrigger><SelectContent>{availableBranches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Semester</Label><Select value={selected.semester} onValueChange={(v) => handleFilterChange('semester', v)} disabled={isLoadingFilters}><SelectTrigger><SelectValue placeholder="Select Semester"/></SelectTrigger><SelectContent>{filters.semesters.map(s => <SelectItem key={s} value={s}>Sem {s}</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Section</Label><Select value={selected.section} onValueChange={(v) => handleFilterChange('section', v)} disabled={!selected.program}><SelectTrigger><SelectValue placeholder="Select Section"/></SelectTrigger><SelectContent>{availableSections.map(s => <SelectItem key={s} value={s}>Sec {s}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                    <Button onClick={handleFetchSchedule} disabled={isFetchDisabled}>
                        {isLoadingSchedule ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <SearchIcon className="mr-2 h-4 w-4"/>}
                        Fetch Timetable
                    </Button>
                </CardContent>
            </Card>

            {scheduleData && (
                <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 max-w-sm">
                        <TabsTrigger value="student"><Users className="mr-2 h-4 w-4"/>Student View</TabsTrigger>
                        <TabsTrigger value="teacher"><User className="mr-2 h-4 w-4"/>Teacher View</TabsTrigger>
                    </TabsList>
                    <TabsContent value="student">
                         <TimetableGrid schedule={scheduleData.studentSchedule} />
                    </TabsContent>
                    <TabsContent value="teacher">
                        {scheduleData.teacherSchedules.length > 0 ? (
                            <div className="space-y-6">
                                {scheduleData.teacherSchedules.map(({ teacher, schedule }) => (
                                    <Card key={teacher.id}>
                                        <CardHeader>
                                            <CardTitle>{teacher.name}</CardTitle>
                                            <CardDescription>Timetable for this section's classes.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <TimetableGrid schedule={schedule} />
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card>
                                <CardContent className="py-10 text-center text-muted-foreground">
                                    <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
                                    No teachers are assigned to the classes for this section.
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
