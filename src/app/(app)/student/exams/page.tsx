
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { CalendarDays, Clock, Info, Download, Loader2, AlertTriangle, Ticket } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { HallTicketDisplay } from '@/components/student/hallticket-display';
import type { HallTicketData, ExamSchedule, ExamStatus } from '@/lib/types';
import { getStudentExamSchedules, getHallTicket } from '@/actions/exam-actions';
import { formatDate } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function StudentExamPage() {
  const [allSchedules, setAllSchedules] = React.useState<ExamSchedule[]>([]);
  const [hallTicketData, setHallTicketData] = React.useState<HallTicketData | null>(null);
  const [isHallTicketLoading, setIsHallTicketLoading] = React.useState(false);
  const [hallTicketError, setHallTicketError] = React.useState<string | null>(null);
  const [isHallTicketDialogOpen, setIsHallTicketDialogOpen] = React.useState(false);
  const hallTicketRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(true);
  const [currentUser, setCurrentUser] = React.useState<{program: string, branch: string, semester: number, id: string, name: string, collegeId: string, avatarUrl?:string} | null>(null);

  React.useEffect(() => {
    const userStr = localStorage.getItem('loggedInUser');
    if (userStr) {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
    }
  }, []);

  React.useEffect(() => {
    if (!currentUser) return;
    const loadSchedules = async () => {
        setIsLoading(true);
        try {
            const fetchedSchedules = await getStudentExamSchedules(currentUser.program, currentUser.branch);
            setAllSchedules(fetchedSchedules);
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: "Failed to load exam schedules." });
        } finally {
            setIsLoading(false);
        }
    };
    loadSchedules();
  }, [currentUser, toast]);
  
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


  const getStatusBadge = (status: ExamStatus) => {
      switch (status) {
          case 'Scheduled': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Scheduled</Badge>;
          case 'Cancelled': return <Badge variant="destructive">Cancelled</Badge>;
          default: return <Badge variant="outline">{status}</Badge>;
      }
  };

  const handleViewHallTicket = async (schedules: ExamSchedule[]) => {
    if (!currentUser) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not identify current user.'});
        return;
    }
    const semester = schedules[0]?.semester;
    if (!semester) {
         toast({ variant: 'destructive', title: 'Error', description: 'Cannot determine semester for this exam session.'});
        return;
    }

    setIsHallTicketLoading(true);
    setHallTicketError(null);
    setHallTicketData(null); 
    setIsHallTicketDialogOpen(true);
    try {
      const result = await getHallTicket(currentUser.id, semester);
      
      if (result.success && result.data) {
        setHallTicketData(result.data);
      } else {
        setHallTicketError(result.error || `Your hall ticket for Semester ${semester} is not yet available.`);
        setHallTicketData(null);
      }
    } catch (err: any) {
      console.error("Failed to fetch hall ticket:", err);
      setHallTicketError("Could not load your hall ticket due to a server error.");
    } finally {
      setIsHallTicketLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!hallTicketRef.current || !hallTicketData) {
        toast({ variant: "destructive", title: "Error", description: "Hall ticket content is not available for download." });
        return;
    }
    toast({ title: "Info", description: "Generating PDF..." });
    try {
        const canvas = await html2canvas(hallTicketRef.current, { 
            scale: 2, 
            useCORS: true, 
            logging: false,
            backgroundColor: '#ffffff' 
        });
        const imgData = canvas.toDataURL('image/png');
        
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
        const newImgWidth = imgWidth * ratio * 0.9; 
        const newImgHeight = imgHeight * ratio * 0.9;

        const xOffset = (pdfWidth - newImgWidth) / 2;
        const yOffset = (pdfHeight - newImgHeight) / 2;

        pdf.addImage(imgData, 'PNG', xOffset, yOffset, newImgWidth, newImgHeight);
        pdf.save(`hall_ticket_${hallTicketData.studentId}_Sem${hallTicketData.semester}.pdf`);
        toast({ title: "Success", description: "Hall ticket downloaded as PDF." });
    } catch (e) {
        console.error("PDF Generation Error:", e);
        toast({ variant: "destructive", title: "Download Failed", description: "Could not generate PDF."});
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Exams</h1>

      <Card>
        <CardHeader>
             <div>
                 <CardTitle>My Exam Schedule</CardTitle>
                 <CardDescription>Schedules are grouped by session. Click to expand and view your hall ticket.</CardDescription>
             </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
          ) : Object.keys(groupedSchedules).length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {Object.entries(groupedSchedules).map(([sessionName, schedules]) => (
                <AccordionItem key={sessionName} value={sessionName}>
                    <AccordionTrigger className="text-lg font-medium">
                        {sessionName}
                        <Badge variant="secondary" className="ml-2">{schedules.length} exams</Badge>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                        <Table>
                          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Course</TableHead><TableHead>Time</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {schedules.map((schedule) => (
                              <TableRow key={schedule.id}>
                                <TableCell className="font-medium flex items-center gap-2">
                                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                  {formatDate(schedule.date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </TableCell>
                                <TableCell>
                                    <div>{schedule.courseName}</div>
                                    <div className="text-xs text-muted-foreground">{schedule.courseCode}</div>
                                </TableCell>
                                <TableCell className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    {schedule.startTime} - {schedule.endTime}
                                </TableCell>
                                <TableCell className="text-right">{getStatusBadge(schedule.status)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                         <div className="text-right pt-2">
                           <Button onClick={() => handleViewHallTicket(schedules)} disabled={isHallTicketLoading}>
                                {isHallTicketLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ticket className="mr-2 h-4 w-4" />}
                                Get Hall Ticket
                           </Button>
                         </div>
                    </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No exam schedules have been published for you yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isHallTicketDialogOpen} onOpenChange={setIsHallTicketDialogOpen}>
        <DialogContent className="max-w-3xl flex flex-col max-h-[90vh] p-0">
          <DialogHeader className="p-4 sm:p-6 border-b print:hidden">
            <DialogTitle>Hall Ticket</DialogTitle>
             <DialogDescription>
                {hallTicketData ? `Session: ${hallTicketData.examSessionName}` : `Loading...`}
             </DialogDescription>
          </DialogHeader>
          {isHallTicketLoading ? ( 
            <div className="p-6 text-center flex-grow flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p>Loading hall ticket...</p>
            </div>
           ) : hallTicketData ? (
            <>
              <div className="flex-grow overflow-y-auto bg-white p-4 sm:p-6 print:p-0">
                <HallTicketDisplay ref={hallTicketRef} hallTicketData={hallTicketData} />
              </div>
              <DialogFooter className="p-4 sm:p-6 border-t print:hidden flex-shrink-0">
                <DialogClose asChild>
                    <Button variant="outline">Close</Button>
                </DialogClose>
                <Button onClick={handleDownloadPdf}>
                  <Download className="mr-2 h-4 w-4" /> Download as PDF
                </Button>
              </DialogFooter>
            </>
          ) : ( 
             <div className="p-6 text-center flex-grow flex flex-col items-center justify-center text-destructive">
                 <AlertTriangle className="h-8 w-8 mx-auto mb-4" />
                 <p className="font-semibold">Hall Ticket Blocked or Not Available</p>
                 <p className="text-sm">{hallTicketError || "Could not display hall ticket."}</p>
             </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
