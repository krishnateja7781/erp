
'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { HallTicketData, HallTicketExam } from '@/lib/types';
import { Badge } from '../ui/badge';
import { getInitials, formatDate } from '@/lib/utils';

interface HallTicketDisplayProps {
  hallTicketData: HallTicketData | null; // Allow null for initial state or errors
}

export const HallTicketDisplay = React.forwardRef<HTMLDivElement, HallTicketDisplayProps>(
  ({ hallTicketData }, ref) => {
    if (!hallTicketData) {
        // Render a placeholder or error message if data is not available
        return <div ref={ref} className="p-6 border rounded-lg bg-card text-card-foreground shadow-lg text-center">Hall ticket data is not available.</div>;
    }
    
    return (
      <div ref={ref} className="p-6 border rounded-lg bg-card text-card-foreground shadow-lg font-sans max-w-3xl mx-auto print:shadow-none print:border-none print:p-0">
        {/* Header: College Name, Hall Ticket Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary print:text-2xl">EduSphere Institute of Technology</h1>
          <h2 className="text-2xl font-semibold mt-1 print:text-xl">{hallTicketData.examSessionName || "Examination Hall Ticket"}</h2>
          <p className="text-xl print:text-lg">HALL TICKET</p>
        </div>

        {/* Student Information Section */}
        <div className="grid grid-cols-3 gap-6 mb-8 items-start print:grid-cols-3 print:gap-4">
          <div className="col-span-2 space-y-2.5 print:col-span-2">
            <InfoRow label="Student Name" value={hallTicketData.studentName} />
            <InfoRow label="College ID" value={hallTicketData.studentCollegeId} />
            <InfoRow label="Program" value={hallTicketData.program} />
            <InfoRow label="Branch" value={hallTicketData.branch} />
            <InfoRow label="Year / Semester" value={`${hallTicketData.year || 'N/A'} / ${hallTicketData.semester || 'N/A'}`} />
          </div>
          <div className="flex justify-center items-start print:justify-end">
            <Avatar className="h-32 w-32 border-2 border-primary print:h-24 print:w-24">
              <AvatarImage src={hallTicketData.studentPhotoUrl} alt={hallTicketData.studentName || 'Student Photo'} data-ai-hint="student photo" />
              <AvatarFallback className="text-4xl print:text-2xl">{getInitials(hallTicketData.studentName)}</AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Examination Schedule Table */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3 text-center uppercase tracking-wider print:text-base">Examination Schedule</h3>
          <div className="overflow-x-auto">
            <Table className="border print:text-xs">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="border-r px-3 py-2">Date</TableHead>
                  <TableHead className="border-r px-3 py-2">Course Code</TableHead>
                  <TableHead className="border-r px-3 py-2">Course Name</TableHead>
                  <TableHead className="border-r px-3 py-2">Time</TableHead>
                  <TableHead className="px-3 py-2">Signature</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hallTicketData.exams && hallTicketData.exams.length > 0 ? hallTicketData.exams.map((exam: HallTicketExam) => (
                  <TableRow key={exam.id || exam.courseCode} className="[&_td]:border-r [&_td:last-child]:border-r-0 [&_td]:px-3 [&_td]:py-2">
                    <TableCell className="font-medium">{formatDate(exam.date)}</TableCell>
                    <TableCell>{exam.courseCode}</TableCell>
                    <TableCell>{exam.courseName}</TableCell>
                    <TableCell>{exam.startTime} - {exam.endTime}</TableCell>
                    <TableCell>{/* Empty for invigilator's signature */}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No exams scheduled for this session.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Instructions Section */}
        <div className="mb-8 print:text-xs">
          <h3 className="text-lg font-semibold mb-2 print:text-base">Instructions for Candidates:</h3>
          {hallTicketData.instructions && hallTicketData.instructions.trim() !== "" ? (
            <ul className="list-decimal list-inside text-sm space-y-1.5 text-muted-foreground pl-4">
              {hallTicketData.instructions.split('\n').map((line, index) => (
                line.trim() && <li key={index}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">No specific instructions provided.</p>
          )}
        </div>

        {/* Signature Section */}
        <div className="flex justify-between items-end pt-10 mt-12 border-t print:pt-6 print:mt-8 print:text-xs">
          <div className="text-center">
            <div className="h-12 border-b border-dashed w-48 mx-auto print:h-8 print:w-36"></div>
            <p className="mt-1">(Candidate's Signature)</p>
          </div>
          <div className="text-center">
            <div className="h-12 border-b border-dashed w-48 mx-auto print:h-8 print:w-36"></div>
            <p className="mt-1">({hallTicketData.controllerSignaturePlaceholder || "Controller of Examinations"})</p>
          </div>
        </div>
        
        <p className="text-center text-xs text-muted-foreground mt-6 print:mt-4">
          Generated on: {formatDate(hallTicketData.generatedDate || new Date().toISOString().split('T')[0])}
        </p>
      </div>
    );
  }
);
HallTicketDisplay.displayName = "HallTicketDisplay";


const InfoRow = ({ label, value }: { label: string; value: string | number | undefined | null }) => (
  <div className="grid grid-cols-3 text-sm print:text-xs">
    <span className="font-medium text-muted-foreground col-span-1">{label}:</span>
    <span className="col-span-2">{value || <Badge variant="outline" className="text-xs px-1.5 py-0.5">N/A</Badge>}</span>
  </div>
);
