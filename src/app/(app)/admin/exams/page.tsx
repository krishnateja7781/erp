
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Loader2, Ticket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScheduleExamDialog } from '@/components/admin/exams/schedule-exam-dialog';
import { getExamSchedules, deleteExamSchedule } from '@/actions/exam-actions';
import type { ExamSchedule, ExamStatus } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';


export default function AdminExamSchedulePage() {
  const [allSchedules, setAllSchedules] = React.useState<ExamSchedule[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isScheduleExamDialogOpen, setIsScheduleExamDialogOpen] = React.useState(false);
  const { toast } = useToast();

  const loadSchedules = React.useCallback(async () => {
    setIsLoading(true);
    try {
        const fetchedSchedules = await getExamSchedules();
        setAllSchedules(fetchedSchedules);
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message || "Failed to load exam schedules." });
    } finally {
        setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const groupedSchedules = React.useMemo(() => {
    if (!allSchedules) return {};
    return allSchedules.reduce((acc, schedule) => {
      const sessionName = schedule.examSessionName || "Uncategorized Exams";
      if (!acc[sessionName]) {
        acc[sessionName] = [];
      }
      acc[sessionName].push(schedule);
      return acc;
    }, {} as Record<string, ExamSchedule[]>);
  }, [allSchedules]);


  const confirmDeleteSchedule = async (scheduleId: string, courseCode: string) => {
    const result = await deleteExamSchedule(scheduleId);
    if (result.success) {
        toast({ title: "Schedule Deleted", description: `Exam schedule for ${courseCode} has been removed.` });
        loadSchedules();
    } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
    }
  };

  const getStatusBadge = (status: ExamStatus) => {
      switch (status) {
          case 'Scheduled': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Scheduled</Badge>;
          case 'Cancelled': return <Badge variant="destructive">Cancelled</Badge>;
          default: return <Badge variant="outline">{status}</Badge>;
      }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
        <span>Loading Exam Schedules...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold">Manage Exam Schedules</h1>
        <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setIsScheduleExamDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Schedule Exams</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exam Timetables</CardTitle>
          <CardDescription>Schedules are grouped by examination session. Click to expand.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center items-center py-8">
                <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
                <span>Loading schedules...</span>
             </div>
           ) : Object.keys(groupedSchedules).length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {Object.entries(groupedSchedules).map(([sessionName, schedules]) => (
                <AccordionItem key={sessionName} value={sessionName}>
                    <AccordionTrigger className="text-lg font-medium">{sessionName} <Badge variant="secondary" className="ml-2">{schedules.length} exams</Badge></AccordionTrigger>
                    <AccordionContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Course</TableHead>
                            <TableHead>Class</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {schedules.map((schedule) => (
                            <TableRow key={schedule.id}>
                              <TableCell>{schedule.date}</TableCell>
                              <TableCell>{schedule.startTime} - {schedule.endTime}</TableCell>
                              <TableCell>
                                <div className="font-medium">{schedule.courseName}</div>
                                <div className="text-xs text-muted-foreground">{schedule.courseCode}</div>
                              </TableCell>
                              <TableCell>{schedule.program} {schedule.branch} - Sem {schedule.semester}</TableCell>
                              <TableCell>{getStatusBadge(schedule.status)}</TableCell>
                              <TableCell className="text-right">
                                <AlertDialog>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem disabled><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                            <AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem></AlertDialogTrigger>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Confirm Deletion</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this exam schedule? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => confirmDeleteSchedule(schedule.id!, schedule.courseCode)}>Delete</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
           ) : (
             <div className="text-center text-muted-foreground py-8">No exam schedules found.</div>
           )}
        </CardContent>
      </Card>
      
       <ScheduleExamDialog
          isOpen={isScheduleExamDialogOpen}
          onOpenChange={setIsScheduleExamDialogOpen}
          onScheduleSaved={loadSchedules}
        />
    </div>
  );
}
