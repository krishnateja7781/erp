
'use client';

import * as React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type ScheduleEntry = {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  period: 1 | 2 | 3 | 4 | 5 | 6; // 6 periods
  courseCode: string;
  courseName: string;
  class: string; // e.g., "CSE-A"
  location?: string; // Optional
  teacherName?: string;
  classId?: string; // Optional Class ID for linking
};

interface TimetableGridProps {
  schedule: ScheduleEntry[];
  interactive?: boolean; // Make cells clickable if true
  onCellClick?: (day: ScheduleEntry['day'], period: ScheduleEntry['period'], entry: (ScheduleEntry & { classId?: string }) | null) => void;
  className?: string;
}

const daysOfWeek: ScheduleEntry['day'][] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const periods: ScheduleEntry['period'][] = [1, 2, 3, 4, 5, 6]; // 6 periods

export function TimetableGrid({ schedule, interactive = false, onCellClick, className }: TimetableGridProps) {

  // Create a lookup map for quick access: key = "Day-Period"
  const scheduleMap = React.useMemo(() => {
    const map = new Map<string, ScheduleEntry>();
    if (Array.isArray(schedule)) {
        schedule.forEach(entry => {
            if(entry && entry.day && entry.period) {
                 map.set(`${entry.day}-${entry.period}`, entry);
            }
        });
    }
    return map;
  }, [schedule]);

  const handleCellClick = (day: ScheduleEntry['day'], period: ScheduleEntry['period']) => {
    if (interactive && onCellClick) {
      const entry = scheduleMap.get(`${day}-${period}`) || null;
      if (entry) { // Only call handler if there's a class scheduled
          onCellClick(day, period, entry);
      }
    }
  };

  return (
    <Card className={cn(className)}>
       <CardHeader className="p-4">
         <CardTitle>Weekly Schedule</CardTitle>
         <CardDescription>Overview of scheduled classes. Click on a class to take attendance.</CardDescription>
       </CardHeader>
       <CardContent className="p-0 overflow-x-auto">
         <Table className="min-w-[800px]">
           <TableHeader>
             <TableRow>
               <TableHead className="w-[100px] text-center">Period</TableHead>
               {daysOfWeek.map(day => (
                 <TableHead key={day} className="text-center">{day}</TableHead>
               ))}
             </TableRow>
           </TableHeader>
           <TableBody>
             {periods.map(period => (
               <TableRow key={period}>
                 <TableCell className="font-semibold text-center align-middle">{period}</TableCell>
                 {daysOfWeek.map(day => {
                   const entry = scheduleMap.get(`${day}-${period}`);
                   const isClickable = interactive && !!entry;
                   return (
                     <TableCell
                       key={`${day}-${period}`}
                       className={cn(
                           "h-20 text-center align-top p-1 text-xs border relative",
                           isClickable ? "cursor-pointer hover:bg-accent transition-colors" : "bg-muted/20"
                       )}
                       onClick={() => handleCellClick(day, period)}
                     >
                       {entry ? (
                         <div className="flex flex-col items-center justify-center h-full">
                           <span className="font-semibold block truncate">{entry.courseCode}</span>
                           <span className="text-muted-foreground block truncate">{entry.courseName}</span>
                           {entry.teacherName && <span className="text-muted-foreground text-[10px] italic">({entry.teacherName})</span>}
                           <Badge variant="secondary" className="mt-1 text-[10px] px-1 py-0">{entry.class}</Badge>
                           {entry.location && <span className="text-muted-foreground text-[10px] mt-0.5">({entry.location})</span>}
                         </div>
                       ) : (
                         // Empty cell - potentially show break or free period
                         <span className="text-muted-foreground/50">-</span>
                       )}
                     </TableCell>
                   );
                 })}
               </TableRow>
             ))}
           </TableBody>
         </Table>
       </CardContent>
     </Card>
  );
}
