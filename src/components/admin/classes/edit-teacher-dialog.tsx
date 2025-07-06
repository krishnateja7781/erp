
'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { getAssignableTeachers } from '@/actions/staff-actions';
import { updateTeacherForClass } from '@/actions/class-actions';
import type { Teacher } from '@/app/(app)/admin/teachers/page';

interface EditTeacherDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTeacherUpdated: () => void;
  classData: { classId: string; className: string; program: string; currentTeacherId?: string | null } | null;
}

export function EditTeacherDialog({ isOpen, onOpenChange, onTeacherUpdated, classData }: EditTeacherDialogProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = React.useState(false);
    const [isTeachersLoading, setIsTeachersLoading] = React.useState(false);
    const [availableTeachers, setAvailableTeachers] = React.useState<Teacher[]>([]);
    const [selectedTeacherId, setSelectedTeacherId] = React.useState<string | undefined>(undefined);

    React.useEffect(() => {
        if (isOpen && classData) {
            setSelectedTeacherId(classData.currentTeacherId || undefined);
            const fetchTeachers = async () => {
                setIsTeachersLoading(true);
                try {
                    const teachers = await getAssignableTeachers(classData.program);
                    setAvailableTeachers(teachers);
                } catch (e) {
                    toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch teachers for this program.' });
                    setAvailableTeachers([]);
                } finally {
                    setIsTeachersLoading(false);
                }
            };
            fetchTeachers();
        } else {
            setAvailableTeachers([]);
            setSelectedTeacherId(undefined);
        }
    }, [isOpen, classData, toast]);

    async function handleSave() {
        if (!classData || !selectedTeacherId) {
            toast({ variant: 'destructive', title: 'Error', description: 'No teacher selected.' });
            return;
        }
        setIsLoading(true);
        try {
            const result = await updateTeacherForClass(classData.classId, selectedTeacherId);
            if (result.success) {
                toast({ title: 'Success', description: result.message });
                onTeacherUpdated();
                onOpenChange(false);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Assigned Teacher</DialogTitle>
                    <DialogDescription>
                        Re-assign a teacher for class: <span className="font-semibold">{classData?.className}</span>.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Select onValueChange={setSelectedTeacherId} value={selectedTeacherId} disabled={isTeachersLoading || isLoading}>
                        <SelectTrigger>
                            <SelectValue placeholder={isTeachersLoading ? "Loading teachers..." : "Select a new teacher..."} />
                        </SelectTrigger>
                        <SelectContent>
                            {isTeachersLoading ? (
                                <SelectItem value="loading" disabled>Loading...</SelectItem>
                            ) : availableTeachers.length > 0 ? (
                                availableTeachers.map(teacher => (
                                    <SelectItem key={teacher.uid} value={teacher.uid!}>{teacher.name} ({teacher.staffId})</SelectItem>
                                ))
                            ) : (
                                <SelectItem value="none" disabled>No teachers found for this program</SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" disabled={isLoading}>Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSave} disabled={isLoading || isTeachersLoading || !selectedTeacherId}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
