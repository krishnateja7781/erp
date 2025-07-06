
'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { createClass, getAvailableSections } from '@/actions/class-actions';
import { getCoursesForSelection } from '@/actions/course-actions';
import { getAssignableTeachers } from '@/actions/staff-actions';
import type { Teacher } from '@/app/(app)/admin/teachers/page';

const programs = ["B.Tech", "MBA", "Law", "MBBS", "B.Sc", "B.Com"];
const years = ["1", "2", "3", "4", "5"];
const semesters = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

const formSchema = z.object({
  program: z.string({ required_error: "Program is required."}),
  year: z.coerce.number({ required_error: "Year is required."}),
  semester: z.coerce.number({ required_error: "Semester is required."}),
  courseId: z.string({ required_error: "Course is required."}),
  section: z.string({ required_error: "Section is required."}),
  teacherId: z.string({ required_error: "Teacher is required."}),
});

type AddClassFormValues = z.infer<typeof formSchema>;

interface AddClassDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onClassAdded: () => void;
}

export function AddClassDialog({ isOpen, onOpenChange, onClassAdded }: AddClassDialogProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = React.useState(false);
    const [courses, setCourses] = React.useState<{id: string, name: string}[]>([]);
    const [isCoursesLoading, setIsCoursesLoading] = React.useState(false);
    const [availableTeachers, setAvailableTeachers] = React.useState<Teacher[]>([]);
    const [isTeachersLoading, setIsTeachersLoading] = React.useState(false);
    const [availableSections, setAvailableSections] = React.useState<string[]>([]);
    const [isSectionsLoading, setIsSectionsLoading] = React.useState(false);

    const form = useForm<AddClassFormValues>({
        resolver: zodResolver(formSchema),
    });

    const { watch, setValue, reset, formState: { isValid } } = form;
    const watchedProgram = watch("program");
    const watchedYear = watch("year");
    const watchedSemester = watch("semester");
    const watchedCourseId = watch("courseId");

    React.useEffect(() => {
        if (!isOpen) {
            reset({
                program: undefined,
                year: undefined,
                semester: undefined,
                courseId: undefined,
                section: undefined,
                teacherId: undefined,
            });
            setCourses([]);
            setAvailableTeachers([]);
            setAvailableSections([]);
        }
    }, [isOpen, reset]);
    
    React.useEffect(() => {
        setValue('teacherId', undefined);
        if (watchedProgram) {
            const fetchTeachers = async () => {
                setIsTeachersLoading(true);
                try {
                    const fetchedTeachers = await getAssignableTeachers(watchedProgram);
                    setAvailableTeachers(fetchedTeachers);
                } catch (e) {
                    toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch teachers.'});
                    setAvailableTeachers([]);
                } finally {
                    setIsTeachersLoading(false);
                }
            };
            fetchTeachers();
        } else {
            setAvailableTeachers([]);
        }
    }, [watchedProgram, setValue, toast]);
    
    React.useEffect(() => {
        setValue("courseId", undefined);
        setValue("section", undefined);
        setAvailableSections([]);
        if (watchedProgram && watchedSemester) {
            const fetchCourses = async () => {
                setIsCoursesLoading(true);
                try {
                    const fetchedCourses = await getCoursesForSelection(watchedProgram, watchedSemester);
                    setCourses(fetchedCourses);
                } catch (e: any) {
                    console.error("Course fetch failed:", e);
                    toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch courses for the selected program and semester.'});
                    setCourses([]);
                } finally {
                    setIsCoursesLoading(false);
                }
            };
            fetchCourses();
        } else {
            setCourses([]);
        }
    }, [watchedProgram, watchedSemester, setValue, toast]);

    React.useEffect(() => {
        setValue("section", undefined);
        if (watchedProgram && watchedYear && watchedCourseId) {
             const fetchSections = async () => {
                setIsSectionsLoading(true);
                try {
                    const sections = await getAvailableSections(watchedProgram, watchedYear, watchedCourseId);
                    setAvailableSections(sections);
                } catch (e) {
                    toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch available sections.'});
                    setAvailableSections([]);
                } finally {
                    setIsSectionsLoading(false);
                }
            };
            fetchSections();
        } else {
            setAvailableSections([]);
        }
    }, [watchedProgram, watchedYear, watchedCourseId, setValue, toast]);


    async function onSubmit(values: AddClassFormValues) {
        setIsLoading(true);
        try {
            const result = await createClass(values);
            if(result.success) {
                toast({ title: 'Success', description: result.message });
                onClassAdded();
                onOpenChange(false);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        } catch(error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Create Class</DialogTitle>
                    <DialogDescription>
                        Assign a teacher to a specific course and section.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} id="add-class-form" className="space-y-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="program" render={({ field }) => (<FormItem><FormLabel>Program</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select program..." /></SelectTrigger></FormControl><SelectContent>{programs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                            <FormField control={form.control} name="year" render={({ field }) => (<FormItem><FormLabel>Student Year</FormLabel><Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}><FormControl><SelectTrigger><SelectValue placeholder="Select year..." /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>Year {y}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                            <FormField control={form.control} name="semester" render={({ field }) => (<FormItem><FormLabel>Semester</FormLabel><Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}><FormControl><SelectTrigger><SelectValue placeholder="Select semester..." /></SelectTrigger></FormControl><SelectContent>{semesters.map(s => <SelectItem key={s} value={s}>Semester {s}</SelectItem>)}</SelectContent></Select></FormItem>)} />
                             <FormField control={form.control} name="courseId" render={({ field }) => (<FormItem><FormLabel>Course</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!watchedProgram || !watchedSemester || isCoursesLoading}><FormControl><SelectTrigger>
                                <SelectValue placeholder={isCoursesLoading ? "Loading courses..." : "Select course..."} />
                             </SelectTrigger></FormControl><SelectContent>
                                {courses.length > 0 ? (
                                    courses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                                ) : (
                                    <SelectItem value="no-courses" disabled>No courses available</SelectItem>
                                )}
                             </SelectContent></Select><FormMessage /></FormItem>)} />
                             <FormField control={form.control} name="section" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Section</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={isSectionsLoading || !watchedCourseId}>
                                        <FormControl><SelectTrigger>
                                            <SelectValue placeholder={isSectionsLoading ? "Loading..." : "Select section..."} />
                                        </SelectTrigger></FormControl>
                                        <SelectContent>
                                            {availableSections.length > 0 ? (
                                                availableSections.map(s => <SelectItem key={s} value={s}>Section {s}</SelectItem>)
                                            ) : (
                                                <SelectItem value="none" disabled>No available sections</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="teacherId" render={({ field }) => (<FormItem><FormLabel>Teacher</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!watchedProgram || isTeachersLoading}><FormControl><SelectTrigger>
                                <SelectValue placeholder={isTeachersLoading ? "Loading..." : "Assign teacher..."} />
                            </SelectTrigger></FormControl><SelectContent>
                                {isTeachersLoading ? (
                                    <SelectItem value="loading" disabled>Loading teachers...</SelectItem>
                                ) : availableTeachers.length > 0 ? (
                                    availableTeachers.map(t => <SelectItem key={t.uid} value={t.uid!}>{t.name} ({t.staffId})</SelectItem>)
                                ) : (
                                    <SelectItem value="no-teachers" disabled>No available staff</SelectItem>
                                )}
                            </SelectContent></Select><FormMessage /></FormItem>)} />
                        </div>
                    </form>
                </Form>
                 <DialogFooter>
                    <DialogClose asChild><Button variant="outline" disabled={isLoading}>Cancel</Button></DialogClose>
                    <Button type="submit" form="add-class-form" disabled={isLoading || !isValid}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Class
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
