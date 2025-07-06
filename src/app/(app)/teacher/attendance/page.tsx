
'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Save, Users, CalendarDays, Loader2, AlertTriangle, Clock, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getTeacherClasses, getStudentsForClass, getAttendanceForSlot, getTeacherSchedule, type StudentForClass, type ScheduleEntry } from '@/actions/teacher-actions';
import { saveAttendance } from '@/actions/attendance-actions';
import { TimetableGrid } from '@/components/shared/TimetableGrid';

type AttendanceStatus = "Present" | "Absent";

interface TeacherClassInfo {
  id: string;
  name: string; // The composite name for display
  courseCode: string;
  courseName: string;
}

export default function TeacherAttendancePage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();

  // State
  const [teacherId, setTeacherId] = React.useState<string | null>(null);
  const [teacherClasses, setTeacherClasses] = React.useState<TeacherClassInfo[]>([]);
  const [schedule, setSchedule] = React.useState<ScheduleEntry[]>([]);
  const [selectedClassId, setSelectedClassId] = React.useState<string | null>(null);
  const [selectedDate, setSelectedDate] = React.useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedPeriod, setSelectedPeriod] = React.useState<number | null>(null);
  const [students, setStudents] = React.useState<StudentForClass[]>([]);
  const [attendanceRecords, setAttendanceRecords] = React.useState<Record<string, AttendanceStatus | null>>({});
  const [originalRecords, setOriginalRecords] = React.useState<Record<string, AttendanceStatus | null>>({});
  
  // Loading states
  const [isInitialLoading, setIsInitialLoading] = React.useState(true);
  const [isClassDataLoading, setIsClassDataLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  
  // UI states
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [showConfirmationDialog, setShowConfirmationDialog] = React.useState(false);
  
  // --- Data Fetching ---

  // Get current user and fetch their classes and schedule
  React.useEffect(() => {
    const storedUserString = localStorage.getItem('loggedInUser');
    if (storedUserString) {
        const user = JSON.parse(storedUserString);
        setTeacherId(user.uid);
    }
  }, []);

  React.useEffect(() => {
    if (teacherId) {
        const fetchInitialData = async () => {
            setIsInitialLoading(true);
            try {
                const [classes, fetchedSchedule] = await Promise.all([
                    getTeacherClasses(teacherId),
                    getTeacherSchedule(teacherId)
                ]);

                setTeacherClasses(classes.map(c => ({ 
                    id: c.id, 
                    name: `${c.courseCode} - ${c.courseName} (${c.class})`,
                    courseCode: c.courseCode,
                    courseName: c.courseName,
                })));
                setSchedule(fetchedSchedule);
            } catch (error) {
                toast({ variant: "destructive", title: "Error", description: "Failed to fetch your classes or schedule." });
            } finally {
                setIsInitialLoading(false);
            }
        };
        fetchInitialData();
    }
  }, [teacherId, toast]);

  // Handle direct navigation via query param
   React.useEffect(() => {
    const classIdFromQuery = searchParams.get('classId');
    const periodFromQuery = searchParams.get('period');

    if (classIdFromQuery) {
        setSelectedClassId(classIdFromQuery);
        // If period is also in query, set it, otherwise let user click
        if (periodFromQuery) {
            setSelectedPeriod(parseInt(periodFromQuery, 10));
        } else {
            setSelectedPeriod(null);
        }
    }
  }, [searchParams]);

  // Fetch students and attendance when a session is fully selected
  React.useEffect(() => {
    const fetchClassData = async () => {
        if (!selectedClassId || !selectedDate || selectedPeriod === null) {
            setStudents([]);
            setAttendanceRecords({});
            setOriginalRecords({});
            return;
        }

        setIsClassDataLoading(true);
        try {
            const [fetchedStudents, fetchedAttendance] = await Promise.all([
                getStudentsForClass(selectedClassId),
                getAttendanceForSlot(selectedClassId, selectedDate, selectedPeriod)
            ]);
            setStudents(fetchedStudents);

            const initialRecords: Record<string, AttendanceStatus | null> = {};
            fetchedStudents.forEach(student => {
                initialRecords[student.id] = fetchedAttendance[student.id] || null;
            });
            setAttendanceRecords(initialRecords);
            setOriginalRecords(fetchedAttendance);
            setHasUnsavedChanges(false);

        } catch(error: any) {
            toast({variant: "destructive", title: "Error", description: error.message || "Failed to load data for the class."});
            setStudents([]);
        } finally {
            setIsClassDataLoading(false);
        }
    };
    fetchClassData();
  }, [selectedClassId, selectedDate, selectedPeriod, toast]);

  // --- Handlers ---

  const handleTimetableClick = (day: ScheduleEntry['day'], period: ScheduleEntry['period'], entry: ScheduleEntry | null) => {
    if (entry && entry.classId) {
        if(hasUnsavedChanges) {
            if (!window.confirm("You have unsaved changes. Are you sure you want to switch to a different session? Your changes will be lost.")) {
                return;
            }
        }
        setSelectedClassId(entry.classId);
        setSelectedPeriod(entry.period as number);
        toast({ title: "Session Selected", description: `${entry.courseName} - Period ${entry.period}`});
    }
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus | null) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: status,
    }));
    setHasUnsavedChanges(true);
  };

  const handleSaveAll = async () => {
    if (students.length === 0) return;
    const allMarked = students.every(s => attendanceRecords[s.id] !== null);
    if (!allMarked) {
        setShowConfirmationDialog(true);
        return;
    }
    await executeSaveAttendance();
  };
  
    const handleGoBack = () => {
        if (hasUnsavedChanges) {
            if (!window.confirm("You have unsaved changes that will be lost. Are you sure you want to go back?")) {
                return;
            }
        }
        setSelectedClassId(null);
        setSelectedPeriod(null);
        setHasUnsavedChanges(false);
    };

  const executeSaveAttendance = async () => {
    setShowConfirmationDialog(false);
    setIsSaving(true);
    if (!selectedClassId || !teacherId || !selectedDate || selectedPeriod === null) {
      toast({variant: "destructive", title: "Error", description: "Missing required information to save."});
      setIsSaving(false);
      return;
    }
    
    const classInfo = teacherClasses.find(c => c.id === selectedClassId);

    const payload = {
        classId: selectedClassId,
        teacherId: teacherId,
        date: selectedDate,
        period: selectedPeriod,
        courseCode: classInfo?.courseCode || '',
        courseName: classInfo?.courseName || '',
        studentRecords: Object.entries(attendanceRecords).filter(([,status]) => status !== null).map(([studentId, status]) => ({ studentId, status: status! })),
    };

    const result = await saveAttendance(payload);

    if (result.success) {
      toast({ title: "Success", description: result.message });
      setHasUnsavedChanges(false);
      setOriginalRecords(attendanceRecords);
    } else {
      toast({ variant: 'destructive', title: "Save Failed", description: result.error });
    }
    
    setIsSaving(false);
  };
  
   const { presentCount, absentCount } = React.useMemo(() => {
        return Object.values(attendanceRecords).reduce(
            (counts, status) => {
                if (status === 'Present') counts.presentCount++;
                if (status === 'Absent') counts.absentCount++;
                return counts;
            },
            { presentCount: 0, absentCount: 0 }
        );
    }, [attendanceRecords]);

  const currentClassInfo = teacherClasses.find(c => c.id === selectedClassId);
  
    if (isInitialLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
                <span>Loading your schedule...</span>
            </div>
        );
    }
    
    if (!selectedClassId || selectedPeriod === null) {
        return (
            <div className="space-y-6">
                <h1 className="text-3xl font-bold">Class Attendance</h1>
                <Card>
                    <CardHeader>
                        <CardTitle>1. Select Date & Click Timetable</CardTitle>
                        <CardDescription>Choose a date and then click on a class in your timetable to begin taking attendance.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4 mb-4">
                            <Label htmlFor="date-select" className="flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Date</Label>
                            <Input
                                id="date-select"
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full max-w-xs h-10"
                            />
                        </div>
                        <TimetableGrid schedule={schedule} interactive onCellClick={handleTimetableClick} />
                    </CardContent>
                </Card>
            </div>
        );
    }

  // --- Render Attendance View ---
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
         <Button variant="outline" onClick={handleGoBack}><ArrowLeft className="mr-2 h-4 w-4" /> Change Session</Button>
         <div className="text-center flex-1">
             <h1 className="text-xl font-bold truncate">{currentClassInfo?.name}</h1>
             <p className="text-muted-foreground">{selectedDate} &bull; Period {selectedPeriod}</p>
         </div>
         <div className="w-32 h-10"></div>
      </div>
       
      <Card>
            <CardHeader>
                <CardTitle>Attendance Roster</CardTitle>
                <CardDescription>Mark each student as Present or Absent.</CardDescription>
            </CardHeader>
            <CardContent>
                {isClassDataLoading ? (
                    <div className="text-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin inline" /> Loading student list...</div>
                ) : students.length > 0 ? (
                    <div className="overflow-x-auto">
                        <Table className="min-w-[600px]">
                        <TableHeader>
                            <TableRow>
                            <TableHead className="w-[120px]">Student ID</TableHead>
                            <TableHead>Student Name</TableHead>
                            <TableHead className="text-center w-[250px]">Status</TableHead> 
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {students.map((student) => {
                            const currentStatus = attendanceRecords[student.id] ?? null;
                            const originalStatus = originalRecords[student.id] ?? null;
                            const isModified = currentStatus !== originalStatus;

                            return (
                                <TableRow key={student.id} className={isModified && hasUnsavedChanges ? "bg-yellow-100 dark:bg-yellow-900/30" : ""}>
                                <TableCell className="font-medium">{student.collegeId}</TableCell>
                                <TableCell>{student.name}</TableCell>
                                <TableCell className="text-center">
                                    <RadioGroup
                                    value={currentStatus || ""}
                                    onValueChange={(status) => handleStatusChange(student.id, status as AttendanceStatus)}
                                    className="flex justify-center gap-2 md:gap-4"
                                    disabled={isSaving}
                                    >
                                    {(["Present", "Absent"] as AttendanceStatus[]).map(statusValue => (
                                        <div key={statusValue} className="flex items-center space-x-2">
                                        <RadioGroupItem value={statusValue} id={`${student.id}-${statusValue}`} disabled={isSaving} />
                                        <Label htmlFor={`${student.id}-${statusValue}`} className="text-sm">{statusValue}</Label>
                                        </div>
                                    ))}
                                    </RadioGroup>
                                </TableCell>
                                </TableRow>
                            );
                            })}
                        </TableBody>
                        </Table>
                    </div>
                ) : (
                    <p className="text-center py-8 text-muted-foreground">No students found for this class.</p>
                )}
            </CardContent>
        </Card>

      {/* Sticky Footer */}
       <div className="sticky bottom-0 -mx-6 -mb-6 p-4 bg-background/95 backdrop-blur-sm border-t shadow-lg rounded-t-lg">
          <div className="max-w-7xl mx-auto flex justify-between items-center px-6">
              <div className="flex items-center gap-6 text-sm font-medium">
                  <div className="flex items-center gap-2 text-green-600"><Users className="h-4 w-4" /> Present: <span className="font-bold text-lg">{presentCount}</span></div>
                  <div className="flex items-center gap-2 text-red-600"><Users className="h-4 w-4" /> Absent: <span className="font-bold text-lg">{absentCount}</span></div>
                  <div className="text-muted-foreground">|</div>
                  <div className="flex items-center gap-2">Total: <span className="font-bold text-lg">{students.length}</span></div>
              </div>
              <Button onClick={handleSaveAll} disabled={isClassDataLoading || isSaving || !hasUnsavedChanges} size="lg">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Changes
              </Button>
          </div>
      </div>

      {showConfirmationDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md p-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><AlertTriangle className="text-yellow-500 h-6 w-6"/> Confirm Save</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Some students have not been marked. Are you sure you want to save the current records?</p>
                    <p className="text-sm text-muted-foreground mt-1">Unmarked students will not be saved.</p>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowConfirmationDialog(false)}>Cancel</Button>
                    <Button onClick={executeSaveAttendance}>Save Anyway</Button>
                </CardFooter>
            </Card>
        </div>
      )}
    </div>
  );
}
