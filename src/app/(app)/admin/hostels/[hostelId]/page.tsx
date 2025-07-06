
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Building, User, Phone, Mail, Users, Wrench, ArrowLeft, Edit, PlusCircle, Search, BedDouble, DoorOpen, UsersRound, SquarePlus, Check, RotateCw, Loader2 } from "lucide-react";
import Link from 'next/link';
import * as React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getHostelDetails, updateHostelInfo, addHostelRoom, allocateStudentToRoom, removeStudentFromRoom, updateComplaintStatus } from '@/actions/hostel-actions';
import { getStudents } from '@/actions/student-actions';
import type { Student, HostelDetails, Room, Complaint } from '@/lib/types';


// --- DIALOGS ---

interface AddRoomDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onAddRoom: (roomNumber: string, capacity: number) => Promise<boolean>;
    existingRoomNumbers: string[];
    hostelPrefix: string;
}

function AddRoomDialog({ isOpen, onOpenChange, onAddRoom, existingRoomNumbers, hostelPrefix }: AddRoomDialogProps) {
    const [roomNumberSuffix, setRoomNumberSuffix] = React.useState('');
    const [capacity, setCapacity] = React.useState<string | undefined>(undefined);
    const [error, setError] = React.useState<string | null>(null);
    const [isAdding, setIsAdding] = React.useState(false);
    const fullRoomNumber = `${hostelPrefix}-${roomNumberSuffix}`;

    const handleSubmit = async () => {
        setError(null);
        setIsAdding(true);
        if (!roomNumberSuffix.trim()) { setError("Room number suffix cannot be empty."); setIsAdding(false); return; }
        if (!/^[a-zA-Z0-9]+$/.test(roomNumberSuffix)) { setError("Room number suffix can only contain letters and numbers."); setIsAdding(false); return; }
        if (!capacity || parseInt(capacity, 10) <= 0) { setError("Please select a valid capacity."); setIsAdding(false); return; }
        if (existingRoomNumbers.includes(fullRoomNumber)) { setError(`Room number ${fullRoomNumber} already exists.`); setIsAdding(false); return; }

        const success = await onAddRoom(fullRoomNumber, parseInt(capacity, 10));

        if (success) {
            setRoomNumberSuffix('');
            setCapacity(undefined);
            onOpenChange(false);
        }
        setIsAdding(false);
    };

    React.useEffect(() => { if (!isOpen) { setRoomNumberSuffix(''); setCapacity(undefined); setError(null); setIsAdding(false); } }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Add New Room</DialogTitle><DialogDescription>Enter the details for the new room.</DialogDescription></DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="room-number-suffix" className="text-right">Room Suffix</Label><div className="col-span-3 flex items-center gap-2"><span className="font-semibold text-muted-foreground">{hostelPrefix}-</span><Input id="room-number-suffix" value={roomNumberSuffix} onChange={(e) => setRoomNumberSuffix(e.target.value.toUpperCase())} className="flex-1" placeholder="e.g., 101, 205A" disabled={isAdding} /></div></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="capacity" className="text-right">Capacity</Label><Select value={capacity} onValueChange={setCapacity} disabled={isAdding}><SelectTrigger id="capacity" className="col-span-3"><SelectValue placeholder="Select number of beds" /></SelectTrigger><SelectContent><SelectItem value="1">1 Bed</SelectItem><SelectItem value="2">2 Beds</SelectItem><SelectItem value="3">3 Beds</SelectItem></SelectContent></Select></div>
                    {error && <p className="col-span-4 text-center text-sm text-destructive">{error}</p>}
                </div>
                <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAdding}>Cancel</Button><Button onClick={handleSubmit} disabled={isAdding}>{isAdding ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding...</> : 'Add Room'}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface EditHostelDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    hostel: HostelDetails;
    onSaveChanges: (updatedData: Partial<HostelDetails>) => Promise<boolean>;
}

function EditHostelDialog({ isOpen, onOpenChange, hostel, onSaveChanges }: EditHostelDialogProps) {
    const [name, setName] = React.useState(hostel.name);
    const [type, setType] = React.useState<'Boys' | 'Girls'>(hostel.type);
    const [status, setStatus] = React.useState<'Operational' | 'Under Maintenance' | 'Closed'>(hostel.status);
    const [wardenName, setWardenName] = React.useState(hostel.warden.name);
    const [wardenContact, setWardenContact] = React.useState(hostel.warden.contact);
    const [wardenEmail, setWardenEmail] = React.useState(hostel.warden.email);
    const [wardenOffice, setWardenOffice] = React.useState(hostel.warden.office);
    const [amenities, setAmenities] = React.useState(hostel.amenities.join(', '));
    const [rules, setRules] = React.useState(hostel.rulesHighlight.join('\n'));
    const [error, setError] = React.useState<string | null>(null);
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => { if (isOpen && hostel) { setName(hostel.name); setType(hostel.type); setStatus(hostel.status); setWardenName(hostel.warden.name); setWardenContact(hostel.warden.contact); setWardenEmail(hostel.warden.email); setWardenOffice(hostel.warden.office); setAmenities(hostel.amenities.join(', ')); setRules(hostel.rulesHighlight.join('\n')); setError(null); setIsSaving(false); } }, [isOpen, hostel]);

    const handleSubmit = async () => {
        setError(null); setIsSaving(true);
        if (!name.trim() || !wardenName.trim() || !wardenContact.trim()) { setError("Hostel name, Warden name, and contact are required."); setIsSaving(false); return; }
        if (wardenEmail.trim() && !/\S+@\S+\.\S+/.test(wardenEmail)) { setError("Invalid warden email format."); setIsSaving(false); return; }

        const updatedData: Partial<HostelDetails> = { name: name.trim(), type, status, warden: { name: wardenName.trim(), contact: wardenContact.trim(), email: wardenEmail.trim(), office: wardenOffice.trim(), }, amenities: amenities.split(',').map(a => a.trim()).filter(Boolean), rulesHighlight: rules.split('\n').map(r => r.trim()).filter(Boolean) };
        const success = await onSaveChanges(updatedData);
        if (success) onOpenChange(false);
        setIsSaving(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]"><DialogHeader><DialogTitle>Edit Hostel Information</DialogTitle><DialogDescription>Update the details for {hostel?.name || 'the hostel'}.</DialogDescription></DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto px-1 py-4 space-y-6">
                    <div className="space-y-4 border-b pb-4"><h4 className="font-semibold text-primary">Hostel Details</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="hostel-name">Name</Label><Input id="hostel-name" value={name} onChange={(e) => setName(e.target.value)} disabled={isSaving} /></div><div className="space-y-2"><Label htmlFor="hostel-type">Type</Label><Select value={type} onValueChange={(value: 'Boys' | 'Girls') => setType(value)} disabled={isSaving}><SelectTrigger id="hostel-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Boys">Boys</SelectItem><SelectItem value="Girls">Girls</SelectItem></SelectContent></Select></div><div className="space-y-2 md:col-span-2"><Label htmlFor="hostel-status">Status</Label><Select value={status} onValueChange={(value: 'Operational' | 'Under Maintenance' | 'Closed') => setStatus(value)} disabled={isSaving}><SelectTrigger id="hostel-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Operational">Operational</SelectItem><SelectItem value="Under Maintenance">Under Maintenance</SelectItem><SelectItem value="Closed">Closed</SelectItem></SelectContent></Select></div></div></div>
                    <div className="space-y-4 border-b pb-4"><h4 className="font-semibold text-primary">Warden Details</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="space-y-2"><Label htmlFor="warden-name">Name</Label><Input id="warden-name" value={wardenName} onChange={(e) => setWardenName(e.target.value)} disabled={isSaving} /></div><div className="space-y-2"><Label htmlFor="warden-contact">Contact</Label><Input id="warden-contact" value={wardenContact} onChange={(e) => setWardenContact(e.target.value)} disabled={isSaving} /></div><div className="space-y-2"><Label htmlFor="warden-email">Email</Label><Input id="warden-email" type="email" value={wardenEmail} onChange={(e) => setWardenEmail(e.target.value)} disabled={isSaving}/></div><div className="space-y-2"><Label htmlFor="warden-office">Office</Label><Input id="warden-office" value={wardenOffice} onChange={(e) => setWardenOffice(e.target.value)} disabled={isSaving}/></div></div></div>
                    <div className="space-y-4"><h4 className="font-semibold text-primary">Other Details</h4><div className="space-y-2"><Label htmlFor="amenities">Amenities (comma-separated)</Label><Textarea id="amenities" value={amenities} onChange={(e) => setAmenities(e.target.value)} placeholder="e.g., Wi-Fi, Common Room" disabled={isSaving} /></div><div className="space-y-2"><Label htmlFor="rules">Rules Highlight (one rule per line)</Label><Textarea id="rules" value={rules} onChange={(e) => setRules(e.target.value)} className="min-h-[80px]" placeholder="e.g., Gate closes at 10:00 PM" disabled={isSaving}/></div></div>
                    {error && <p className="text-center text-sm text-destructive mt-4">{error}</p>}
                </div>
                <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button><Button onClick={handleSubmit} disabled={isSaving}>{isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface AllocateRoomDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: Room[];
  availableStudents: Student[];
  onAllocateStudent: (roomNumber: string, studentId: string) => Promise<boolean>;
}

function AllocateRoomDialog({ isOpen, onOpenChange, rooms, availableStudents, onAllocateStudent }: AllocateRoomDialogProps) {
    const [selectedRoom, setSelectedRoom] = React.useState<string | undefined>(undefined);
    const [selectedStudent, setSelectedStudent] = React.useState<string | undefined>(undefined);
    const [error, setError] = React.useState<string | null>(null);
    const [isAllocating, setIsAllocating] = React.useState(false);

    const availableRooms = rooms.filter(r => r.residents.length < r.capacity);

    const handleSubmit = async () => {
        setError(null);
        if (!selectedRoom || !selectedStudent) { setError("Please select both a room and a student."); return; }
        
        setIsAllocating(true);
        const success = await onAllocateStudent(selectedRoom, selectedStudent);
        if (success) {
            setSelectedRoom(undefined);
            setSelectedStudent(undefined);
            onOpenChange(false);
        }
        setIsAllocating(false);
    };

    React.useEffect(() => { if (!isOpen) { setSelectedRoom(undefined); setSelectedStudent(undefined); setError(null); setIsAllocating(false); } }, [isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent><DialogHeader><DialogTitle>Allocate Room to Student</DialogTitle><DialogDescription>Assign an available student to a vacant spot.</DialogDescription></DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="allocate-room" className="text-right">Room</Label><Select value={selectedRoom} onValueChange={setSelectedRoom} disabled={isAllocating}><SelectTrigger id="allocate-room" className="col-span-3"><SelectValue placeholder="Select available room" /></SelectTrigger><SelectContent>{availableRooms.length > 0 ? availableRooms.map(room => (<SelectItem key={room.roomNumber} value={room.roomNumber}>{room.roomNumber} ({room.residents.length}/{room.capacity} filled)</SelectItem>)) : <SelectItem value="none" disabled>No rooms with vacancies</SelectItem>}</SelectContent></Select></div>
                    <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="allocate-student" className="text-right">Student</Label><Select value={selectedStudent} onValueChange={setSelectedStudent} disabled={isAllocating}><SelectTrigger id="allocate-student" className="col-span-3"><SelectValue placeholder="Select available student" /></SelectTrigger><SelectContent>{availableStudents.length > 0 ? availableStudents.map(student => (<SelectItem key={student.id} value={student.id!}>{student.name} ({student.collegeId})</SelectItem>)) : <SelectItem value="none" disabled>No unassigned students found</SelectItem>}</SelectContent></Select></div>
                    {error && <p className="col-span-4 text-center text-sm text-destructive">{error}</p>}
                </div>
                <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAllocating}>Cancel</Button><Button onClick={handleSubmit} disabled={isAllocating || !selectedRoom || !selectedStudent}>{isAllocating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Allocating...</> : 'Allocate'}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface ManageRoomDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    room: Room | null;
    onRemoveStudent: (roomNumber: string, studentId: string) => Promise<boolean>;
}

function ManageRoomDialog({ isOpen, onOpenChange, room, onRemoveStudent }: ManageRoomDialogProps) {
    const [isRemoving, setIsRemoving] = React.useState<Record<string, boolean>>({});
    React.useEffect(() => { if (!isOpen) setIsRemoving({}); }, [isOpen]);
    if (!room) return null;

    const handleRemoveClick = async (studentId: string) => {
        setIsRemoving(prev => ({ ...prev, [studentId]: true }));
        await onRemoveStudent(room.roomNumber, studentId);
        setIsRemoving(prev => ({ ...prev, [studentId]: false }));
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent><DialogHeader><DialogTitle>Manage Room: {room.roomNumber}</DialogTitle><DialogDescription>Capacity: {room.capacity} | Occupied: {room.residents.length}</DialogDescription></DialogHeader>
                <div className="py-4 max-h-[60vh] overflow-y-auto"><h4 className="font-semibold mb-2">Residents:</h4>
                    {room.residents.length > 0 ? (<ul className="space-y-2">{room.residents.map(resident => (<li key={resident.studentId} className="flex justify-between items-center text-sm p-2 border rounded-md"><div><Link href={`/admin/students/${resident.studentId}`} className="font-medium text-primary hover:underline">{resident.studentName}</Link><span className="text-muted-foreground"> ({resident.studentId})</span></div><Button variant="destructive" size="sm" onClick={() => handleRemoveClick(resident.studentId)} disabled={isRemoving[resident.studentId]}>{isRemoving[resident.studentId] ? <Loader2 className="h-4 w-4 animate-spin"/> : "Remove"}</Button></li>))}</ul>) : (<p className="text-sm text-muted-foreground">This room is currently empty.</p>)}
                </div>
                <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// --- MAIN PAGE COMPONENT ---
export default function AdminHostelDetailPage() {
    const params = useParams();
    const router = useRouter();
    const hostelId = params.hostelId as string;
    const [hostelData, setHostelData] = React.useState<HostelDetails | null>(null);
    const [allStudents, setAllStudents] = React.useState<Student[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [roomSearchTerm, setRoomSearchTerm] = React.useState('');
    const [dialogs, setDialogs] = React.useState({ addRoom: false, editHostel: false, allocateRoom: false, manageRoom: false });
    const [selectedRoomToManage, setSelectedRoomToManage] = React.useState<Room | null>(null);
    const [actionLoading, setActionLoading] = React.useState<Record<string, boolean>>({});
    const { toast } = useToast();

    const loadHostelData = React.useCallback(async () => {
        if (!hostelId) { setError("Invalid Hostel ID."); setIsLoading(false); return; }
        setIsLoading(true); setError(null);
        try {
            const [data, studentsData] = await Promise.all([
                getHostelDetails(hostelId),
                getStudents()
            ]);
            if (data) setHostelData(data);
            else { setError("Hostel not found."); router.push('/admin/hostels'); }
            setAllStudents(studentsData);
        } catch (err: any) {
            console.error("Failed to fetch hostel details:", err);
            setError("Failed to load hostel data. Please try refreshing.");
            toast({ variant: "destructive", title: "Error", description: err.message || "Could not fetch hostel data." });
        } finally { setIsLoading(false); }
    }, [hostelId, toast, router]);

    React.useEffect(() => { loadHostelData(); }, [loadHostelData]);

    const handleServerAction = async (action: Promise<{success: boolean; error?: string; message?: string;}>, successMsg: string) => {
        const result = await action;
        if (result.success) {
            toast({ title: "Success", description: result.message || successMsg });
            loadHostelData(); // Re-fetch data on success
            return true;
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error || "An unknown error occurred." });
            return false;
        }
    };

    const handleAddRoom = (roomNumber: string, capacity: number) => handleServerAction(addHostelRoom(hostelId, { roomNumber, capacity }), `Room ${roomNumber} added.`);
    const handleEditHostelInfo = (updatedData: Partial<HostelDetails>) => handleServerAction(updateHostelInfo(hostelId, updatedData), `Hostel info updated.`);
    const handleAllocateStudent = (roomNumber: string, studentId: string) => handleServerAction(allocateStudentToRoom(hostelId, roomNumber, studentId), `Student allocated.`);
    const handleRemoveStudent = (roomNumber: string, studentId: string) => handleServerAction(removeStudentFromRoom(hostelId, roomNumber, studentId), `Student removed.`);
    
    const handleComplaintStatusChange = async (complaintId: string, newStatus: Complaint['status']) => {
        setActionLoading(prev => ({ ...prev, [complaintId]: true }));
        await handleServerAction(updateComplaintStatus(complaintId, newStatus), `Complaint status updated.`);
        setActionLoading(prev => ({ ...prev, [complaintId]: false }));
    };

    const filteredRooms = React.useMemo(() => {
        if (!hostelData?.rooms) return [];
        const lowerSearch = roomSearchTerm.toLowerCase();
        return hostelData.rooms.filter(room =>
            room.roomNumber?.toLowerCase().includes(lowerSearch) ||
            room.residents?.some(res => res?.studentName?.toLowerCase().includes(lowerSearch) || res?.studentId?.toLowerCase().includes(lowerSearch))
        ).sort((a, b) => (a.roomNumber || '').localeCompare(b.roomNumber || '', undefined, { numeric: true }));
    }, [hostelData, roomSearchTerm]);

    const assignedStudentIds = React.useMemo(() => {
        if (!hostelData?.rooms) return new Set<string>();
        return new Set(hostelData.rooms.flatMap(r => r.residents?.map(res => res.studentId) || []));
    }, [hostelData]);

    const availableStudentsForHostel = React.useMemo(() => {
        if (!hostelData?.type || !allStudents) return [];
        const requiredGender = hostelData.type === 'Boys' ? 'Male' : 'Female';
        return allStudents.filter(student => 
            !assignedStudentIds.has(student.id) && student.gender === requiredGender && student.type === 'Hosteler'
        );
    }, [allStudents, assignedStudentIds, hostelData?.type]);

    const handleOpenManageRoom = (room: Room) => { setSelectedRoomToManage(room); setDialogs(d => ({ ...d, manageRoom: true })); };

    if (isLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading hostel details...</div>;
    if (error) return <div className="text-center text-destructive py-10">{error}</div>;
    if (!hostelData) return <div className="text-center text-muted-foreground py-10">Hostel data could not be loaded.</div>;

    const occupancyPercentage = hostelData.capacity > 0 ? Math.round((hostelData.occupied / hostelData.capacity) * 100) : 0;
    const hostelPrefix = hostelData.name ? hostelData.name.charAt(0).toUpperCase() : 'X';
    
    const getHostelStatusBadge = (status?: HostelDetails['status']) => {
        switch (status) {
            case 'Operational': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Operational</Badge>;
            case 'Under Maintenance': return <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-black">Maintenance</Badge>;
            case 'Closed': return <Badge variant="destructive">Closed</Badge>;
            default: return <Badge variant="outline">{status || 'Unknown'}</Badge>;
        }
    };
     const getOccupancyBadge = (room: Room) => {
        const residentsCount = room.residents?.length || 0;
        const capacity = room.capacity || 0;
        if (residentsCount === 0) return <Badge variant="secondary" className="text-xs">Empty</Badge>;
        if (capacity > 0 && residentsCount === capacity) return <Badge variant="destructive" className="text-xs">Full</Badge>;
        if (capacity > 0) return <Badge variant="default" className="bg-yellow-600 hover:bg-yellow-700 text-xs">{residentsCount}/{capacity} Filled</Badge>;
        return <Badge variant="outline" className="text-xs">N/A</Badge>;
    };

    const getComplaintStatusBadge = (status: Complaint['status']) => {
        switch (status) {
            case 'Resolved': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Resolved</Badge>;
            case 'Pending': return <Badge variant="destructive">Pending</Badge>;
            case 'In Progress': return <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-black">In Progress</Badge>;
            default: return <Badge variant="outline">{status || 'Unknown'}</Badge>;
        }
    };

    return (
        <TooltipProvider>
            <div className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <Button variant="outline" size="icon" onClick={() => router.back()} aria-label="Back">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex gap-2 flex-wrap">
                        <Button variant="outline" onClick={() => setDialogs(d => ({ ...d, addRoom: true }))}><SquarePlus className="mr-2 h-4 w-4" /> Add Room</Button>
                        <Button variant="outline" onClick={() => setDialogs(d => ({ ...d, editHostel: true }))}><Edit className="mr-2 h-4 w-4" /> Edit Info</Button>
                        <Button onClick={() => setDialogs(d => ({ ...d, allocateRoom: true }))}><PlusCircle className="mr-2 h-4 w-4" /> Allocate Room</Button>
                    </div>
                </div>

                <h1 className="text-3xl font-bold">{hostelData.name} Details</h1>
                
                <Card><CardHeader><CardTitle className="flex items-center gap-2"><Building className="h-5 w-5 text-primary"/> Hostel Information</CardTitle><CardDescription>Basic details and current status.</CardDescription></CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div><p className="text-sm font-medium text-muted-foreground">Hostel ID</p><p className="font-semibold">{hostelData.id}</p></div>
                        <div><p className="text-sm font-medium text-muted-foreground">Type</p><p className="font-semibold">{hostelData.type}</p></div>
                        <div><p className="text-sm font-medium text-muted-foreground">Status</p>{getHostelStatusBadge(hostelData.status)}</div>
                        <div><p className="text-sm font-medium text-muted-foreground">Occupancy (Beds)</p><p className="font-semibold">{hostelData.occupied} / {hostelData.capacity}</p><Progress value={occupancyPercentage} className="w-full h-2 mt-1" /></div>
                    </CardContent>
                </Card>

                <Card><CardHeader><CardTitle className="flex items-center gap-2"><BedDouble className="h-5 w-5 text-indigo-600"/> Room Occupancy</CardTitle><CardDescription>Visual overview of room status.</CardDescription>
                    <div className="pt-4 relative"><Search className="absolute left-2.5 top-[50%] -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search Room Number or Resident..." className="pl-8 h-9" value={roomSearchTerm} onChange={(e) => setRoomSearchTerm(e.target.value)} /></div></CardHeader>
                    <CardContent>
                        {filteredRooms.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {filteredRooms.map((room) => (
                                    <Card key={room.roomNumber} className="flex flex-col items-center p-3 text-center border hover:shadow-md transition-shadow">
                                        <div className="flex items-center justify-between w-full mb-2"><span className="font-semibold text-lg">{room.roomNumber}</span>{getOccupancyBadge(room)}</div>
                                        <div className="flex flex-wrap justify-center gap-2 mb-2 min-h-[32px]">{room.residents.length > 0 ? room.residents.map(res => <Tooltip key={res.studentId}><TooltipTrigger asChild><Link href={`/admin/students/${res.studentId}`}><User className="h-6 w-6 text-primary"/></Link></TooltipTrigger><TooltipContent><p>{res.studentName}</p></TooltipContent></Tooltip>) : <DoorOpen className="h-8 w-8 text-muted-foreground" />}</div>
                                        <Button variant="outline" size="sm" className="w-full mt-auto text-xs h-7" onClick={() => handleOpenManageRoom(room)}>Manage</Button>
                                    </Card>
                                ))}
                            </div>
                        ) : (<p className="text-muted-foreground text-center py-8">No rooms found.</p>)}
                    </CardContent>
                </Card>

                <Card><CardHeader><CardTitle className="flex items-center justify-between"><div className='flex items-center gap-2'><Wrench className="h-5 w-5 text-red-600"/> Complaints</div></CardTitle><CardDescription>Maintenance issues reported.</CardDescription></CardHeader>
                    <CardContent>
                        <Table><TableHeader><TableRow><TableHead>Room</TableHead><TableHead>Issue</TableHead><TableHead>Reported By</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
                            <TableBody>{hostelData.complaints.map((c) => (<TableRow key={c.id}><TableCell>{c.roomNumber}</TableCell><TableCell>{c.issue}</TableCell><TableCell><Link href={`/admin/students/${c.studentId}`} className='text-primary hover:underline text-xs'>{c.studentId}</Link></TableCell><TableCell>{c.date}</TableCell><TableCell className="text-right"><DropdownMenu><DropdownMenuTrigger asChild disabled={actionLoading[c.id]}><Button variant="ghost" size="sm" className="h-auto py-0.5 px-1.5">{actionLoading[c.id] ? <Loader2 className="h-4 w-4 animate-spin"/> : getComplaintStatusBadge(c.status)}</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => handleComplaintStatusChange(c.id, 'Pending')}><RotateCw className="mr-2 h-4 w-4 text-destructive"/>Pending</DropdownMenuItem><DropdownMenuItem onClick={() => handleComplaintStatusChange(c.id, 'In Progress')}><RotateCw className="mr-2 h-4 w-4 text-yellow-600"/>In Progress</DropdownMenuItem><DropdownMenuItem onClick={() => handleComplaintStatusChange(c.id, 'Resolved')}><Check className="mr-2 h-4 w-4 text-green-600"/>Resolved</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>))}</TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            
            {hostelData && <>
                <AddRoomDialog isOpen={dialogs.addRoom} onOpenChange={(open) => setDialogs(d => ({ ...d, addRoom: open }))} onAddRoom={handleAddRoom} existingRoomNumbers={hostelData.rooms.map(r => r.roomNumber)} hostelPrefix={hostelPrefix} />
                <EditHostelDialog isOpen={dialogs.editHostel} onOpenChange={(open) => setDialogs(d => ({ ...d, editHostel: open }))} hostel={hostelData} onSaveChanges={handleEditHostelInfo} />
                <AllocateRoomDialog isOpen={dialogs.allocateRoom} onOpenChange={(open) => setDialogs(d => ({ ...d, allocateRoom: open }))} rooms={hostelData.rooms} availableStudents={availableStudentsForHostel} onAllocateStudent={handleAllocateStudent} />
                <ManageRoomDialog isOpen={dialogs.manageRoom} onOpenChange={(open) => setDialogs(d => ({ ...d, manageRoom: open }))} room={selectedRoomToManage} onRemoveStudent={handleRemoveStudent} />
            </>}
        </TooltipProvider>
    );
}
