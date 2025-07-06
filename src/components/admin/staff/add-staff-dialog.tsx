
'use client';

import * as React from 'react';
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
import { createStaffAccount, updateStaff } from '@/actions/staff-actions';
import { generatePassword, getDepartmentCode } from '@/lib/utils';
import type { Teacher } from '@/lib/types';

const programs = ["B.Tech", "MBA", "Law", "MBBS", "B.Sc", "B.Com", "General Admin", "Other"];
const departments: Record<string, string[]> = {
  "B.Tech": ["CSE", "ECE", "MECH", "IT", "AI&ML", "DS", "CIVIL", "Mathematics", "Physics", "Chemistry", "English", "Other"],
  "MBA": ["Marketing", "Finance", "HR", "Operations", "General Management", "Other"],
  "Law": ["Corporate Law", "Criminal Law", "Civil Law", "Constitutional Law", "Other"],
  "MBBS": ["Anatomy", "Physiology", "Biochemistry", "General Medicine", "Surgery", "Pediatrics", "Other"],
  "B.Sc": ["Physics", "Chemistry", "Mathematics", "Computer Science", "Biotechnology", "Other"],
  "B.Com": ["General", "Accounting & Finance", "Taxation", "Corporate Secretaryship", "Other"],
  "General Admin": ["Administration", "Accounts", "HR", "IT Support", "Library", "Other"],
  "Other": ["General Office", "Maintenance", "Security"],
};
const staffRoles = ["teacher", "admin"];
const staffStatuses = ["Active", "Inactive", "On Leave", "Resigned", "Terminated"];

const addStaffFormSchema = z.object({
  firstName: z.string().min(2, { message: "First name must be at least 2 characters." }).trim(),
  lastName: z.string().min(1, { message: "Last name is required." }).trim(),
  email: z.string().email({ message: "Please enter a valid email address." }).trim(),
  dob: z.string().refine((date) => !isNaN(Date.parse(date)), { message: "Please enter a valid date of birth." }),
  dateOfJoining: z.string().refine((date) => !isNaN(Date.parse(date)), { message: "Please enter a valid date of joining." }),
  role: z.enum(["teacher", "admin"], { required_error: "Please select a role." }),
  programAssociation: z.string().optional(),
  department: z.string({ required_error: "Please select a department." }),
  position: z.string().min(3, { message: "Position/Designation is required." }).trim(),
  status: z.string({ required_error: "Please select a status." }),
  phone: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  officeLocation: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  qualifications: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  specialization: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  // Display only fields
  displayStaffId: z.string().optional(),
  displayPassword: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.role === 'teacher' && !data.programAssociation) {
        ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Program Association is required for teachers.",
        path: ["programAssociation"],
        });
    }
});

export type AddStaffFormValues = Omit<z.infer<typeof addStaffFormSchema>, 'displayStaffId' | 'displayPassword'>;

interface AddStaffDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onStaffAdded: () => void;
  initialData?: Teacher | null;
}

const initialStaffFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  dob: '',
  dateOfJoining: new Date().toISOString().split('T')[0],
  role: undefined,
  programAssociation: undefined,
  department: undefined,
  position: '',
  status: "Active",
  phone: '',
  officeLocation: '',
  qualifications: '',
  specialization: '',
  displayStaffId: 'Auto-generated',
  displayPassword: 'Auto-generated',
};

export function AddStaffDialog({ isOpen, onOpenChange, onStaffAdded, initialData }: AddStaffDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentDepartments, setCurrentDepartments] = React.useState<string[]>([]);
  const isEditMode = !!initialData;

  const form = useForm<z.infer<typeof addStaffFormSchema>>({
    resolver: zodResolver(addStaffFormSchema),
    defaultValues: initialStaffFormValues,
  });

  const { watch, setValue, reset, formState: { errors } } = form;
  const watchedFirstName = watch("firstName");
  const watchedDob = watch("dob");
  const watchedDoj = watch("dateOfJoining");
  const watchedRole = watch("role");
  const watchedDepartment = watch("department");
  const watchedProgramAssociation = watch("programAssociation");

  React.useEffect(() => {
    const selectedProgram = watchedProgramAssociation;
    const availableDepts = selectedProgram ? departments[selectedProgram] || [] : [];
    setCurrentDepartments(availableDepts);
    
    // Do not reset department if it's a valid option for the new program
    if (watchedProgramAssociation && !availableDepts.includes(form.getValues("department"))) {
      setValue("department", undefined, { shouldValidate: true });
    }
  }, [watchedProgramAssociation, setValue, form]);

  React.useEffect(() => {
    if (isOpen) {
      if (isEditMode && initialData) {
        const [firstName, ...lastNameParts] = initialData.name?.split(' ') || ['', ''];
        form.reset({
          firstName,
          lastName: lastNameParts.join(' '),
          email: initialData.email || '',
          dob: initialData.dob || '',
          dateOfJoining: initialData.joinDate || '',
          role: initialData.role || undefined,
          programAssociation: initialData.program || undefined,
          department: initialData.department || undefined,
          position: initialData.position || '',
          status: initialData.status || 'Active',
          phone: initialData.phone || '',
          officeLocation: initialData.officeLocation || '',
          qualifications: initialData.qualifications || '',
          specialization: initialData.specialization || '',
        });
      } else {
        form.reset(initialStaffFormValues);
      }
    }
  }, [isOpen, initialData, isEditMode, form]);


  React.useEffect(() => {
    if (isEditMode) return;
    if (watchedFirstName && watchedDob) {
      const pwd = generatePassword(watchedFirstName, watchedDob);
      if (pwd) setValue("displayPassword", pwd);
      else setValue("displayPassword", "Invalid DOB");
    } else {
      setValue("displayPassword", "Fill Name & DOB");
    }
  }, [watchedFirstName, watchedDob, setValue, isEditMode]);

  React.useEffect(() => {
    if (isEditMode) return;
    const rolePrefix = watchedRole === 'admin' ? "ADM" : watchedRole === 'teacher' ? "TCH" : "STF";
    let dojYearCode = "XX";
    if (watchedDoj) {
      try {
        const yearMatch = new Date(watchedDoj).getFullYear().toString().substring(2);
        if (yearMatch) dojYearCode = yearMatch;
      } catch (e) { /* ignore invalid date during input */ }
    }
    const deptCode = getDepartmentCode(watchedDepartment, watchedProgramAssociation);

    if (watchedRole && watchedDoj && watchedDepartment) {
      setValue("displayStaffId", `${rolePrefix}${dojYearCode}${deptCode}0001 (Example)`);
    } else {
      setValue("displayStaffId", "Auto-generated");
    }
  }, [watchedRole, watchedDoj, watchedDepartment, watchedProgramAssociation, setValue, isEditMode]);

  async function onSubmit(values: z.infer<typeof addStaffFormSchema>) {
    setIsLoading(true);
    const dataToSubmit: AddStaffFormValues = { ...values };

    try {
      let result;
      if (isEditMode && initialData) {
        result = await updateStaff(initialData.id, initialData.role!, dataToSubmit);
      } else {
        result = await createStaffAccount(dataToSubmit);
      }

      if (result.success) {
        toast({
          title: isEditMode ? "Update Successful" : "Staff Added Successfully",
          description: result.message || (isEditMode ? `${values.firstName} ${values.lastName}'s profile has been updated.` : `${values.firstName} ${values.lastName} (ID: ${result.staffId}) has been added. Password: ${result.password}. They will need to verify their email upon first login.`),
          duration: isEditMode ? 4000 : 8000,
        });
        onStaffAdded();
        onOpenChange(false);
      } else {
        toast({
          variant: "destructive",
          title: isEditMode ? "Update Failed" : "Failed to Add Staff",
          description: result.error || "An unknown server error occurred.",
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isLoading) onOpenChange(open); }}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Staff Profile' : 'Add New Staff (Teacher/Admin)'}</DialogTitle>
          <DialogDescription>
             {isEditMode ? `Editing profile for ${initialData?.name} (${initialData?.staffId})` : 'Enter details for the new staff member. Staff ID and Password will be auto-generated.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-2 py-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" id="add-staff-form-actual">
              {!isEditMode && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <FormField
                    control={form.control}
                    name="displayStaffId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Staff ID (Example)</FormLabel>
                        <FormControl><Input placeholder="Auto-generated" {...field} readOnly className="bg-muted/50" /></FormControl>
                        <FormDescription>The final ID will have a unique serial number.</FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="displayPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password (Example)</FormLabel>
                        <FormControl><Input placeholder="Auto-generated" {...field} readOnly className="bg-muted/50" /></FormControl>
                        <FormDescription>Generated from Name + DOB.</FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name *</FormLabel><FormControl><Input placeholder="Enter first name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name *</FormLabel><FormControl><Input placeholder="Enter last name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email Address *</FormLabel><FormControl><Input type="email" placeholder="staff@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="dob" render={({ field }) => (<FormItem><FormLabel>Date of Birth *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="dateOfJoining" render={({ field }) => (<FormItem><FormLabel>Date of Joining *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />

                <FormField control={form.control} name="role" render={({ field }) => (<FormItem><FormLabel>Role *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isEditMode}><FormControl><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger></FormControl><SelectContent className="max-h-60 overflow-y-auto">{staffRoles.map(r => <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="programAssociation" render={({ field }) => (<FormItem><FormLabel>Program Association {watch('role') === 'teacher' && '*'}</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select program association" /></SelectTrigger></FormControl><SelectContent className="max-h-60 overflow-y-auto">{programs.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="department" render={({ field }) => (<FormItem><FormLabel>Department *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!watchedProgramAssociation || currentDepartments.length === 0}><FormControl><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger></FormControl><SelectContent className="max-h-60 overflow-y-auto">{currentDepartments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}{currentDepartments.length === 0 && <SelectItem value="--" disabled>Select program first</SelectItem>}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="position" render={({ field }) => (<FormItem><FormLabel>Position/Designation *</FormLabel><FormControl><Input placeholder="e.g., Assistant Professor, Clerk" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent className="max-h-60 overflow-y-auto">{staffStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              </div>

              <h3 className="text-lg font-semibold pt-4 border-t mt-6">Additional Information (Optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input type="tel" placeholder="Enter phone number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="officeLocation" render={({ field }) => (<FormItem><FormLabel>Office Location</FormLabel><FormControl><Input placeholder="e.g., Admin Block, Room 101" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="qualifications" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Qualifications</FormLabel><FormControl><Input placeholder="e.g., PhD in CSE, M.Com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="specialization" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Specialization/Expertise</FormLabel><FormControl><Input placeholder="e.g., Machine Learning, Accountancy" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
            </form>
          </Form>
        </div>
        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isLoading}>Cancel</Button>
          </DialogClose>
          <Button type="submit" form="add-staff-form-actual" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            {isLoading ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Add Staff')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
