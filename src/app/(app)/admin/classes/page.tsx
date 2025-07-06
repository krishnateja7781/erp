
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Loader2, MoreHorizontal, Trash2, UserCog } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Class } from '@/lib/types';
import { getClassesWithDetails, deleteClass } from '@/actions/class-actions';
import { AddClassDialog } from '@/components/admin/classes/add-class-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { EditTeacherDialog } from '@/components/admin/classes/edit-teacher-dialog';

export default function AdminClassesPage() {
    const [classes, setClasses] = React.useState<Class[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
    const [selectedClassForEdit, setSelectedClassForEdit] = React.useState<{ classId: string; className: string; program: string; currentTeacherId?: string | null; } | null>(null);
    const { toast } = useToast();

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedClasses = await getClassesWithDetails();
            setClasses(fetchedClasses);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to load class data.' });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);
    
    const handleDeleteClass = async (classId: string, className: string) => {
        const result = await deleteClass(classId);
        if (result.success) {
            toast({ title: 'Success', description: `Class "${className}" deleted.` });
            loadData();
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    };

    const handleOpenEditDialog = (cls: Class) => {
        setSelectedClassForEdit({
            classId: cls.id,
            className: `${cls.courseName} (Sec ${cls.section})`,
            program: cls.program,
            currentTeacherId: cls.teacherId,
        });
        setIsEditDialogOpen(true);
    };


    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Manage Classes</h1>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create New Class
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Class List</CardTitle>
                    <CardDescription>
                        List of all created classes, their assigned teachers, and student counts.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Course</TableHead>
                                <TableHead>Class</TableHead>
                                <TableHead>Assigned Teacher</TableHead>
                                <TableHead className="text-center">Student Count</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                                    </TableCell>
                                </TableRow>
                            ) : classes.length > 0 ? (
                                classes.map((cls) => (
                                    <TableRow key={cls.id}>
                                        <TableCell className="font-medium">
                                            {cls.courseName} <span className="text-muted-foreground">({cls.courseId})</span>
                                        </TableCell>
                                        <TableCell>
                                            {cls.program} {cls.branch} - Year {cls.year} (Sec {cls.section})
                                        </TableCell>
                                        <TableCell>{cls.teacherName}</TableCell>
                                        <TableCell className="text-center">{cls.studentCount}</TableCell>
                                        <TableCell className="text-right">
                                             <AlertDialog>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleOpenEditDialog(cls)}><UserCog className="mr-2 h-4 w-4" /> Edit Teacher</DropdownMenuItem>
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will delete the class <span className="font-semibold">{cls.courseName} for Section {cls.section}</span>. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeleteClass(cls.id, cls.courseName)}>Delete</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                        No classes created yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <AddClassDialog
                isOpen={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                onClassAdded={loadData}
            />
             <EditTeacherDialog
                isOpen={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                onTeacherUpdated={loadData}
                classData={selectedClassForEdit}
            />
        </div>
    );
}
