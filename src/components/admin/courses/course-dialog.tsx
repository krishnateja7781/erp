
'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { saveCourse, type Course, type CoursePayload } from '@/actions/course-actions';

const programs = ["B.Tech", "MBA", "Law", "MBBS", "B.Sc", "B.Com"];
const branches: Record<string, string[]> = {
  "B.Tech": ["CSE", "ECE", "MECH", "IT", "AI&ML", "DS", "CIVIL", "Other"],
  "MBA": ["Marketing", "Finance", "HR", "Operations", "General", "Other"],
  "Law": ["Corporate Law", "Criminal Law", "Civil Law", "General", "Other"],
  "MBBS": ["General Medicine"],
  "B.Sc": ["Physics", "Chemistry", "Mathematics", "Computer Science", "Other"],
  "B.Com": ["General", "Accounting & Finance", "Taxation", "Other"],
};
const semesters = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

const formSchema = z.object({
  courseName: z.string().min(3, "Course Name is required."),
  program: z.string({ required_error: "Program is required." }),
  branch: z.string({ required_error: "Branch is required." }),
  semester: z.coerce.number().min(1, "Semester is required."),
  credits: z.coerce.number().min(1, "Credits are required.").max(5, "Credits must be between 1 and 5."),
});

type CourseFormValues = z.infer<typeof formSchema>;

interface CourseDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCourseSaved: () => void;
  initialData?: Partial<Course> | null;
}

export function CourseDialog({ isOpen, onOpenChange, onCourseSaved, initialData }: CourseDialogProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = React.useState(false);
    const [currentBranches, setCurrentBranches] = React.useState<string[]>([]);
    
    const form = useForm<CourseFormValues>({
        resolver: zodResolver(formSchema),
    });

    const { watch, setValue, reset, control } = form;
    const watchedProgram = watch("program");

    React.useEffect(() => {
        const programBranches = watchedProgram ? branches[watchedProgram] : [];
        setCurrentBranches(programBranches || []);
        // Reset branch if it's not valid for the new program
        if (watchedProgram && !programBranches.includes(form.getValues("branch"))) {
            setValue('branch', undefined, { shouldValidate: true });
        }
    }, [watchedProgram, form, setValue]);

    React.useEffect(() => {
        if(isOpen) {
            if (initialData && initialData.id) { // Editing existing course
                form.reset({
                    courseName: initialData.courseName || '',
                    program: initialData.program || undefined,
                    branch: initialData.branch || undefined,
                    semester: initialData.semester || undefined,
                    credits: initialData.credits || undefined,
                });
            } else { // Adding new course (could have pre-filled data)
                form.reset({
                    courseName: '',
                    program: initialData?.program,
                    branch: initialData?.branch,
                    semester: initialData?.semester,
                    credits: undefined,
                });
            }
        }
    }, [isOpen, initialData, form]);

    async function onSubmit(values: CourseFormValues) {
        setIsLoading(true);
        const payload: CoursePayload = { ...values };
        if (initialData?.id) {
            payload.id = initialData.id;
        }

        try {
            const result = await saveCourse(payload);
            if(result.success) {
                toast({ title: 'Success', description: result.message });
                onCourseSaved();
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

    const isEditMode = !!initialData?.id;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isEditMode ? 'Edit Course' : 'Add New Course'}</DialogTitle>
                    <DialogDescription>
                        {isEditMode 
                            ? `Editing ${initialData?.courseId || 'course'}. Program, Branch, and Semester cannot be changed.`
                            : 'Enter the details for the new course. The Course ID will be auto-generated.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} id="course-form" className="space-y-4 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={control} name="program" render={({ field }) => (<FormItem><FormLabel>Program</FormLabel><Select onValueChange={(v) => { field.onChange(v); }} value={field.value} disabled={isEditMode}><FormControl><SelectTrigger><SelectValue placeholder="Select program..." /></SelectTrigger></FormControl><SelectContent>{programs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={control} name="branch" render={({ field }) => (<FormItem><FormLabel>Branch</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isEditMode || !watchedProgram}><FormControl><SelectTrigger><SelectValue placeholder="Select branch..." /></SelectTrigger></FormControl><SelectContent>{currentBranches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={control} name="semester" render={({ field }) => (<FormItem><FormLabel>Semester</FormLabel><Select onValueChange={(value) => field.onChange(parseInt(value, 10))} value={field.value?.toString()} disabled={isEditMode}><FormControl><SelectTrigger><SelectValue placeholder="Select semester..." /></SelectTrigger></FormControl><SelectContent>{semesters.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={control} name="courseName" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Course Name</FormLabel><FormControl><Input placeholder="e.g., Introduction to Programming" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={control} name="credits" render={({ field }) => (<FormItem><FormLabel>Credits</FormLabel><FormControl><Input type="number" placeholder="e.g., 3" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || undefined)}/></FormControl><FormMessage /></FormItem>)} />
                        </div>
                    </form>
                </Form>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline" disabled={isLoading}>Cancel</Button></DialogClose>
                    <Button type="submit" form="course-form" disabled={isLoading}>{isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {isEditMode ? 'Save Changes' : 'Create Course'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
