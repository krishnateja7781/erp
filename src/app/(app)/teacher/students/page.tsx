
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStudentsByClassForTeacher, type TeacherClassWithStudents } from '@/actions/teacher-actions';
import { Button } from '@/components/ui/button';

export default function TeacherStudentsPage() {
  const { toast } = useToast();
  const [data, setData] = React.useState<TeacherClassWithStudents[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const storedUserString = localStorage.getItem('loggedInUser');
      if (!storedUserString) {
        toast({ variant: "destructive", title: "Error", description: "Could not identify teacher." });
        setIsLoading(false);
        return;
      }
      const user = JSON.parse(storedUserString);
      try {
        const result = await getStudentsByClassForTeacher(user.uid);
        setData(result);
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: "Failed to load student data." });
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [toast]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Class Rosters</CardTitle>
          <CardDescription>View the list of students enrolled in each of your classes. Click a name to view their profile.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.length > 0 ? (
            <Accordion type="single" collapsible className="w-full" defaultValue={data[0]?.classInfo.id}>
              {data.map(({ classInfo, students }) => (
                <AccordionItem key={classInfo.id} value={classInfo.id}>
                  <AccordionTrigger>
                    <div className="flex justify-between w-full pr-4">
                      <span>{classInfo.courseCode} - {classInfo.courseName} ({classInfo.class})</span>
                      <span className="text-sm text-muted-foreground">{students.length} Students</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {students.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>College ID</TableHead>
                            <TableHead>Student Name</TableHead>
                             <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.map(student => (
                            <TableRow key={student.id}>
                              <TableCell>{student.collegeId || student.id}</TableCell>
                              <TableCell>{student.name}</TableCell>
                               <TableCell className="text-right">
                                <Button asChild variant="outline" size="sm">
                                    <Link href={`/teacher/students/${student.id}`}>
                                        View Profile
                                    </Link>
                                </Button>
                               </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center text-muted-foreground p-4">No students are enrolled in this class.</p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <p className="text-center text-muted-foreground p-8">You are not assigned to any classes.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
