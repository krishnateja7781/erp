
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PlusCircle, Trash2, FileText, Loader2, Video, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getTeacherClasses } from '@/actions/teacher-actions';
import { getMaterialsForTeacherClasses, saveMaterial, deleteMaterial } from '@/actions/material-actions';
import type { Material } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AddMaterialDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<Material, 'id' | 'uploadDate'>) => Promise<boolean>;
  classId: string;
  courseId: string;
}

function AddMaterialDialog({ isOpen, onOpenChange, onSave, classId, courseId }: AddMaterialDialogProps) {
    const [name, setName] = React.useState('');
    const [url, setUrl] = React.useState('');
    const [type, setType] = React.useState<'pdf' | 'video' | 'image' | 'other'>('pdf');
    const [size, setSize] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);
    const { toast } = useToast();

    const handleSubmit = async () => {
        if (!name || !url) {
            toast({ variant: 'destructive', title: 'Error', description: 'Name and URL are required.' });
            return;
        }
        setIsSaving(true);
        const success = await onSave({ name, url, type, size, classId, courseId });
        setIsSaving(false);
        if (success) {
            setName(''); setUrl(''); setType('pdf'); setSize('');
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Add New Material</DialogTitle><DialogDescription>Provide details for the new course material.</DialogDescription></DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-1"><Label htmlFor="name">Name</Label><Input id="name" value={name} onChange={e => setName(e.target.value)} /></div>
                    <div className="space-y-1"><Label htmlFor="url">URL</Label><Input id="url" value={url} onChange={e => setUrl(e.target.value)} /></div>
                    <div className="space-y-1"><Label htmlFor="type">Type</Label>
                        <Select value={type} onValueChange={(v) => setType(v as any)}><SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent><SelectItem value="pdf">PDF</SelectItem><SelectItem value="video">Video</SelectItem><SelectItem value="image">Image</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1"><Label htmlFor="size">Size (e.g., 1.2 MB)</Label><Input id="size" value={size} onChange={e => setSize(e.target.value)} /></div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
                    <Button onClick={handleSubmit} disabled={isSaving}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Save'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const getFileIcon = (type: Material['type']) => {
    switch (type) {
        case 'pdf': return <FileText className="h-5 w-5 text-red-500" />;
        case 'video': return <Video className="h-5 w-5 text-blue-500" />;
        case 'image': return <ImageIcon className="h-5 w-5 text-green-500" />;
        default: return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
};

export default function TeacherMaterialsPage() {
    const [teacherClasses, setTeacherClasses] = React.useState<{ id: string; courseCode: string; courseName: string, name: string; }[]>([]);
    const [materials, setMaterials] = React.useState<Record<string, Material[]>>({});
    const [isLoading, setIsLoading] = React.useState(true);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [selectedClassForUpload, setSelectedClassForUpload] = React.useState<{classId: string, courseId: string} | null>(null);
    const { toast } = useToast();

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        const storedUserString = localStorage.getItem('loggedInUser');
        if (!storedUserString) {
            toast({ variant: "destructive", title: "Error", description: "Could not identify teacher." });
            setIsLoading(false); return;
        }
        const user = JSON.parse(storedUserString);
        try {
            const [classes, fetchedMaterials] = await Promise.all([
                getTeacherClasses(user.uid),
                getMaterialsForTeacherClasses(user.uid)
            ]);
            setTeacherClasses(classes.map(c => ({...c, name: `${c.courseCode} - ${c.courseName} (${c.class})` })));
            setMaterials(fetchedMaterials);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSave = async (data: Omit<Material, 'id' | 'uploadDate'>): Promise<boolean> => {
        const result = await saveMaterial(data);
        if (result.success) {
            toast({ title: "Success", description: result.message });
            loadData();
            return true;
        }
        toast({ variant: "destructive", title: "Error", description: result.error });
        return false;
    };

    const handleDelete = async (id: string) => {
        const result = await deleteMaterial(id);
        if (result.success) {
            toast({ title: "Success", description: result.message });
            loadData();
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Manage Course Materials</h1>
            <Card>
                <CardHeader><CardTitle>My Classes</CardTitle><CardDescription>Add or remove materials for your assigned classes.</CardDescription></CardHeader>
                <CardContent>
                    {isLoading ? <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin"/></div> :
                        <Accordion type="single" collapsible className="w-full">
                            {teacherClasses.map(c => (
                                <AccordionItem key={c.id} value={c.id}>
                                    <AccordionTrigger>{c.name}</AccordionTrigger>
                                    <AccordionContent>
                                        <Button size="sm" className="mb-4" onClick={() => { setSelectedClassForUpload({ classId: c.id, courseId: c.courseCode }); setIsDialogOpen(true); }}><PlusCircle className="mr-2 h-4 w-4"/>Add Material</Button>
                                        {(materials[c.id] || []).length > 0 ? (
                                            <ul className="space-y-2">
                                                {(materials[c.id] || []).map(material => (
                                                    <li key={material.id} className="flex items-center justify-between p-2 border rounded-md">
                                                        <div className="flex items-center gap-3">
                                                            {getFileIcon(material.type)}
                                                            <div>
                                                                <p className="font-medium">{material.name}</p>
                                                                <p className="text-xs text-muted-foreground">{material.url}</p>
                                                            </div>
                                                        </div>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(material.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : <p className="text-center text-muted-foreground py-4">No materials uploaded yet.</p>}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    }
                </CardContent>
            </Card>
            {selectedClassForUpload && <AddMaterialDialog isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} onSave={handleSave} classId={selectedClassForUpload.classId} courseId={selectedClassForUpload.courseId} />}
        </div>
    );
}
