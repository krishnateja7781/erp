
'use client';

import *
as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus } from 'lucide-react';
import { createStudentAccount, updateStudent } from '@/actions/student-actions';
import { generatePassword, getProgramCode, getBranchCode } from '@/lib/utils';
import type { Student } from '@/lib/types';

const programs = ["B.Tech", "MBA", "Law", "MBBS", "B.Sc", "B.Com"];
const branches: Record<string, string[]> = {
  "B.Tech": ["CSE", "ECE", "MECH", "IT", "AI&ML", "DS", "CIVIL", "Other"],
  "MBA": ["Marketing", "Finance", "HR", "Operations", "General", "Other"],
  "Law": ["Corporate Law", "Criminal Law", "Civil Law", "General", "Other"],
  "MBBS": ["General Medicine"],
  "B.Sc": ["Physics", "Chemistry", "Mathematics", "Computer Science", "Other"],
  "B.Com": ["General", "Accounting & Finance", "Taxation", "Other"],
};
const years = ["1", "2", "3", "4", "5"]; 
const semesters = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]; 
const studentStatuses = ["Active", "Inactive", "Graduated", "Pending Approval", "Suspended", "Dropped Out"];
const studentTypes = ["Day Scholar", "Hosteler"];
const studentGenders = ["Male", "Female", "Other"];

const addStudentFormSchema = z.object({
  firstName: z.string().min(2, { message: "First name must be at least 2 characters." }).trim(),
  lastName: z.string().min(1, { message: "Last name is required." }).trim(),
  email: z.string().email({ message: "Please enter a valid email address." }).trim(),
  dob: z.string().refine((date) => {
    if (!date) return false;
    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime()) && parsedDate < new Date();
  }, { message: "Please enter a valid date of birth (must be in the past)." }),
  gender: z.enum(["Male", "Female", "Other"], { required_error: "Please select a gender." }),
  program: z.string({ required_error: "Please select a program." }),
  branch: z.string({ required_error: "Please select a branch." }),
  year: z.string({ required_error: "Please select a year." }),
  semester: z.string({ required_error: "Please select a semester." }),
  batch: z.string().min(4, { message: "Batch (e.g., 2024 or 2024-2028) is required." })
          .regex(/^(\d{4}|\d{4}-\d{4})$/, {message: "Batch must be YYYY or YYYY-YYYY format."}),
  status: z.string({ required_error: "Please select a status." }),
  type: z.string({ required_error: "Please select student type." }),
  phone: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  address: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  emergencyContactName: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  emergencyContactPhone: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  emergencyContactAddress: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  displayCollegeId: z.string().optional(),
  displayPassword: z.string().optional(),
});

export type AddStudentFormValues = Omit<z.infer<typeof addStudentFormSchema>, 'displayCollegeId' | 'displayPassword'>;

interface AddStudentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  initialData?: Student | null;
}

const defaultBatchYear = new Date().getFullYear();

export function AddStudentDialog({ isOpen, onOpenChange, onSave, initialData }: AddStudentDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentBranches, setCurrentBranches] = React.useState<string[]>([]);
  const isEditMode = !!initialData;

  const form = useForm<z.infer<typeof addStudentFormSchema>>({ 
    resolver: zodResolver(addStudentFormSchema),
  });

  const { watch, setValue, reset, formState: { errors } } = form;
  
  const watchedFirstName = watch("firstName");
  const watchedDob = watch("dob");
  const watchedProgram = watch("program");
  const watchedBranch = watch("branch");
  const watchedBatch = watch("batch");

  React.useEffect(() => {
    const programBranches = watchedProgram ? branches[watchedProgram] : [];
    setCurrentBranches(programBranches || []);
    if (watchedProgram && !programBranches.includes(form.getValues("branch"))) {
        setValue("branch", undefined, { shouldValidate: true });
    }
  }, [watchedProgram, form, setValue]);
  
  React.useEffect(() => {
    if (isOpen) {
      if (isEditMode && initialData) {
        const [firstName, ...lastNameParts] = initialData.name?.split(' ') || ['', ''];
        reset({
          ...initialData,
          firstName,
          lastName: lastNameParts.join(' '),
          year: initialData.year?.toString(),
          semester: initialData.semester?.toString(),
          gender: initialData.gender || undefined,
          emergencyContactName: initialData.emergencyContact?.name || '',
          emergencyContactPhone: initialData.emergencyContact?.phone || '',
          emergencyContactAddress: initialData.emergencyContact?.address || '',
        });
      } else {
        reset({
          firstName: '', lastName: '', email: '', dob: '',
          program: undefined, branch: undefined, year: undefined, semester: undefined,
          gender: undefined,
          batch: `${defaultBatchYear}-${defaultBatchYear + 4}`,
          status: "Active", type: "Day Scholar", phone: '', address: '',
          emergencyContactName: '', emergencyContactPhone: '', emergencyContactAddress: '',
          displayCollegeId: 'Auto-generated', displayPassword: 'Auto-generated',
        });
      }
    }
  }, [isOpen, initialData, isEditMode, reset]);


  async function onSubmit(values: z.infer<typeof addStudentFormSchema>) {
    setIsLoading(true);
    const formValues: AddStudentFormValues = { ...values };
    try {
      let result;
      if (isEditMode && initialData) {
        result = await updateStudent(initialData.id, formValues);
      } else {
        result = await createStudentAccount(formValues);
      }

      if (result.success) {
        toast({
          title: isEditMode ? "Update Successful" : "Student Added Successfully",
          description: result.message || `${values.firstName} ${values.lastName}'s profile has been saved.`,
          duration: isEditMode ? 4000 : 8000,
        });
        onSave();
        onOpenChange(false); 
      } else {
        toast({
          variant: "destructive",
          title: isEditMode ? "Update Failed" : "Failed to Add Student",
          description: result.error || "An unknown error occurred on the server.",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Operation Failed",
        description: error.message || "An unexpected error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isLoading && onOpenChange(open)}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Student Profile' : 'Add New Student'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? `Editing profile for ${initialData?.name} (${initialData?.collegeId}).` : 'Enter details for the new student.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-2 py-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" id="student-form">
              {!isEditMode && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <FormField
                    control={form.control}
                    name="displayCollegeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>College ID (Example)</FormLabel>
                        <FormControl><Input placeholder="Auto-generated" {...field} value={getProgramCode(watchedProgram)+ (watchedBatch?.match(/^\d{4}/)?.[0].substring(2) || 'XX') + getBranchCode(watchedBranch, watchedProgram) + '0001 (Example)'} readOnly className="bg-muted/50" /></FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="displayPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password (Example)</FormLabel>
                        <FormControl><Input placeholder="Fill name & DOB" {...field} value={generatePassword(watchedFirstName, watchedDob) || 'Fill name & DOB'} readOnly className="bg-muted/50" /></FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name *</FormLabel><FormControl><Input placeholder="Enter first name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name *</FormLabel><FormControl><Input placeholder="Enter last name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email Address *</FormLabel><FormControl><Input type="email" placeholder="student@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="dob" render={({ field }) => (<FormItem><FormLabel>Date of Birth *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="gender" render={({ field }) => (<FormItem><FormLabel>Gender *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl><SelectContent>{studentGenders.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                
                <FormField control={form.control} name="program" render={({ field }) => (<FormItem><FormLabel>Program *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger></FormControl><SelectContent>{programs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="branch" render={({ field }) => (<FormItem><FormLabel>Branch *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!watchedProgram || currentBranches.length === 0}><FormControl><SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger></FormControl><SelectContent>{currentBranches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="year" render={({ field }) => (<FormItem><FormLabel>Current Year *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger></FormControl><SelectContent>{years.map(y => <SelectItem key={y} value={y}>Year {y}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="semester" render={({ field }) => (<FormItem><FormLabel>Current Semester *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger></FormControl><SelectContent>{semesters.map(s => <SelectItem key={s} value={s}>Semester {s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="batch" render={({ field }) => (<FormItem><FormLabel>Batch *</FormLabel><FormControl><Input placeholder="YYYY or YYYY-YYYY" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent>{studentStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="type" render={({ field }) => (<FormItem><FormLabel>Accommodation Type *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl><SelectContent>{studentTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              </div>

              <h3 className="text-lg font-semibold pt-4 border-t mt-6">Additional Information (Optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" placeholder="Enter phone number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="address" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Address</FormLabel><FormControl><Input placeholder="Enter full address" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>

              <h4 className="text-md font-semibold pt-2">Emergency Contact Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <FormField control={form.control} name="emergencyContactName" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Contact Name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="emergencyContactPhone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input type="tel" placeholder="Contact Phone" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="emergencyContactAddress" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Address</FormLabel><FormControl><Input placeholder="Contact Address" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
            </form>
          </Form>
        </div>
        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <DialogClose asChild><Button type="button" variant="outline" disabled={isLoading}>Cancel</Button></DialogClose>
          <Button type="submit" form="student-form" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            {isLoading ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Add Student')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
