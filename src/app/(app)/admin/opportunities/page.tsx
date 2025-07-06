
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, MoreHorizontal, Pencil, Trash2, Loader2, Briefcase, Clipboard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { saveOpportunity, getOpportunities, deleteOpportunity } from '@/actions/placement-actions';
import type { Placement, Internship } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


type Opportunity = Placement | Internship;

interface OpportunityDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: Opportunity) => Promise<boolean>;
    initialData?: Opportunity | null;
    type: 'placement' | 'internship';
}

function OpportunityDialog({ isOpen, onOpenChange, onSave, initialData, type }: OpportunityDialogProps) {
    const [formData, setFormData] = React.useState<Partial<Opportunity>>({});
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        if (isOpen) {
            setFormData(initialData || { type });
            setIsSaving(false);
        }
    }, [isOpen, initialData, type]);

    const handleChange = (field: keyof Opportunity, value: string | string[]) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        setIsSaving(true);
        const success = await onSave(formData as Opportunity);
        setIsSaving(false);
        if (success) onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
                <DialogHeader><DialogTitle>{initialData ? 'Edit' : 'Add'} {type === 'placement' ? 'Placement' : 'Internship'} Opportunity</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4 flex-grow overflow-y-auto px-1 pr-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1"><label>Company</label><Input value={formData.company || ''} onChange={(e) => handleChange('company', e.target.value)} /></div>
                        <div className="space-y-1"><label>Role</label><Input value={formData.role || ''} onChange={(e) => handleChange('role', e.target.value)} /></div>
                        <div className="space-y-1"><label>{type === 'placement' ? 'CTC' : 'Stipend'}</label><Input value={formData.ctc_stipend || ''} onChange={(e) => handleChange('ctc_stipend', e.target.value)} /></div>
                        <div className="space-y-1"><label>{type === 'placement' ? 'Location' : 'Duration'}</label><Input value={type === 'placement' ? formData.location || '' : formData.duration || ''} onChange={(e) => handleChange(type === 'placement' ? 'location' : 'duration', e.target.value)} /></div>
                        <div className="space-y-1 md:col-span-2"><label>Skills (comma-separated)</label><Input value={(formData.skills || []).join(', ')} onChange={(e) => handleChange('skills', e.target.value.split(',').map(s => s.trim()))} /></div>
                        <div className="space-y-1 md:col-span-2"><label>Eligibility</label><Input value={formData.eligibility || ''} onChange={(e) => handleChange('eligibility', e.target.value)} /></div>
                        <div className="space-y-1 md:col-span-2"><label>Description</label><Textarea value={formData.description || ''} onChange={(e) => handleChange('description', e.target.value)} /></div>
                         <div className="space-y-1"><label>Status</label>
                            <Select value={formData.status || 'Open'} onValueChange={(value) => handleChange('status', value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Open">Open</SelectItem>
                                    <SelectItem value="Closed">Closed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
                    <Button onClick={handleSubmit} disabled={isSaving}>{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function AdminOpportunitiesPage() {
    const [opportunities, setOpportunities] = React.useState<Opportunity[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingOpportunity, setEditingOpportunity] = React.useState<Opportunity | null>(null);
    const [activeTab, setActiveTab] = React.useState<'placement' | 'internship'>('placement');
    const { toast } = useToast();

    const loadOpportunities = React.useCallback(async (type: 'placement' | 'internship') => {
        setIsLoading(true);
        try {
            const data = await getOpportunities(type);
            setOpportunities(data as Opportunity[]);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        loadOpportunities(activeTab);
    }, [activeTab, loadOpportunities]);

    const handleAdd = () => { setEditingOpportunity(null); setIsDialogOpen(true); };
    const handleEdit = (opp: Opportunity) => { setEditingOpportunity(opp); setIsDialogOpen(true); };

    const handleSave = async (data: Opportunity): Promise<boolean> => {
        const result = await saveOpportunity(data);
        if (result.success) {
            toast({ title: "Success", description: result.message });
            loadOpportunities(activeTab);
            return true;
        }
        toast({ variant: "destructive", title: "Error", description: result.error });
        return false;
    };

    const handleDelete = async (id: string) => {
        const result = await deleteOpportunity(id);
        if (result.success) {
            toast({ title: "Success", description: result.message });
            loadOpportunities(activeTab);
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Manage Opportunities</h1>
                <Button onClick={handleAdd}><PlusCircle className="mr-2 h-4 w-4" /> Add {activeTab === 'placement' ? 'Placement' : 'Internship'}</Button>
            </div>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="placement"><Briefcase className="mr-2 h-4 w-4"/> Placements</TabsTrigger>
                    <TabsTrigger value="internship"><Clipboard className="mr-2 h-4 w-4"/> Internships</TabsTrigger>
                </TabsList>
                <TabsContent value={activeTab}>
                    <Card>
                        <CardHeader><CardTitle>All {activeTab === 'placement' ? 'Placements' : 'Internships'}</CardTitle><CardDescription>View, add, edit, or remove opportunities.</CardDescription></CardHeader>
                        <CardContent>
                            {isLoading ? <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin"/></div> :
                                <Table>
                                    <TableHeader><TableRow><TableHead>Company</TableHead><TableHead>Role</TableHead><TableHead>CTC / Stipend</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {opportunities.length > 0 ? opportunities.map((opp) => (
                                            <TableRow key={opp.id}>
                                                <TableCell>{opp.company}</TableCell><TableCell>{opp.role}</TableCell>
                                                <TableCell>{opp.ctc_stipend}</TableCell>
                                                <TableCell><Badge variant={opp.status === 'Open' ? 'default' : 'secondary'}>{opp.status}</Badge></TableCell>
                                                <TableCell className="text-right">
                                                    <AlertDialog>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => handleEdit(opp)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                                                <AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem></AlertDialogTrigger>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader><AlertDialogTitle>Confirm Deletion</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this opportunity? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(opp.id!)}>Delete</AlertDialogAction></AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </TableCell>
                                            </TableRow>
                                        )) : <TableRow><TableCell colSpan={5} className="text-center py-8">No opportunities found.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            }
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
            <OpportunityDialog isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} onSave={handleSave} initialData={editingOpportunity} type={activeTab} />
        </div>
    );
}
