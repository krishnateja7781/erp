
'use client'; 

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PlusCircle, Search, MoreHorizontal, Eye, Users, Wrench, Loader2, AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast'; 
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'; 
import { getHostels as fetchHostels, addHostel, deleteHostel, type NewHostelPayload } from '@/actions/hostel-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Hostel } from '@/lib/types';


const addHostelSchema = z.object({
    name: z.string().min(3, "Hostel name must be at least 3 characters."),
    type: z.enum(['Boys', 'Girls'], { required_error: "Please select a type." }),
    status: z.enum(['Operational', 'Under Maintenance', 'Closed'], { required_error: "Please select a status." }),
    wardenName: z.string().min(3, "Warden name is required."),
    wardenContact: z.string().min(10, "A valid contact number is required."),
    wardenEmail: z.string().email("Please enter a valid email."),
    wardenOffice: z.string().optional(),
});

type AddHostelFormValues = z.infer<typeof addHostelSchema>;

function AddHostelDialog({ isOpen, onOpenChange, onHostelAdded }: { isOpen: boolean; onOpenChange: (open: boolean) => void; onHostelAdded: () => void; }) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = React.useState(false);

    const form = useForm<AddHostelFormValues>({
        resolver: zodResolver(addHostelSchema),
        defaultValues: {
            name: '',
            type: undefined,
            status: 'Operational',
            wardenName: '',
            wardenContact: '',
            wardenEmail: '',
            wardenOffice: '',
        },
    });

    const onSubmit = async (values: AddHostelFormValues) => {
        setIsSaving(true);
        const result = await addHostel(values);
        if (result.success) {
            toast({ title: "Success", description: result.message });
            onHostelAdded();
            onOpenChange(false);
        } else {
            toast({ variant: 'destructive', title: "Error", description: result.error });
        }
        setIsSaving(false);
    };

    React.useEffect(() => {
        if (!isOpen) {
            form.reset();
        }
    }, [isOpen, form]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add New Hostel</DialogTitle>
                    <DialogDescription>Enter the details for the new hostel facility.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} id="add-hostel-form" className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-1">
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Hostel Name</FormLabel><FormControl><Input placeholder="e.g., Ganga Hostel" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="type" render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Boys">Boys</SelectItem><SelectItem value="Girls">Girls</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Operational">Operational</SelectItem><SelectItem value="Under Maintenance">Under Maintenance</SelectItem><SelectItem value="Closed">Closed</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="wardenName" render={({ field }) => (<FormItem><FormLabel>Warden Name</FormLabel><FormControl><Input placeholder="Enter warden's full name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="wardenContact" render={({ field }) => (<FormItem><FormLabel>Warden Contact</FormLabel><FormControl><Input placeholder="Enter contact number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="wardenEmail" render={({ field }) => (<FormItem><FormLabel>Warden Email</FormLabel><FormControl><Input type="email" placeholder="warden@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="wardenOffice" render={({ field }) => (<FormItem><FormLabel>Warden Office (Optional)</FormLabel><FormControl><Input placeholder="e.g., Block A, Room 101" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </form>
                </Form>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
                    <Button type="submit" form="add-hostel-form" disabled={isSaving}>{isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Saving...</> : 'Add Hostel'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function AdminHostelsPage() {
  const [hostels, setHostels] = React.useState<Hostel[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isAddHostelDialogOpen, setIsAddHostelDialogOpen] = React.useState(false);
  const { toast } = useToast();

  const loadHostels = React.useCallback(async () => {
      setIsLoading(true);
      setError(null);
      try {
          const fetchedHostels = await fetchHostels();
          setHostels(fetchedHostels);
      } catch (err: any) {
          setError("Failed to fetch hostel list. Please try again.");
          console.error("Error fetching hostels:", err);
      } finally {
          setIsLoading(false);
      }
  }, []);

  React.useEffect(() => {
    loadHostels();
  }, [loadHostels]);

  const filteredHostels = hostels.filter(hostel => {
    const wardenName = hostel.warden?.name || '';
    return hostel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           hostel.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
           wardenName.toLowerCase().includes(searchTerm.toLowerCase())
  });

  const getOccupancyPercentage = (hostel: Hostel) => {
      return hostel.capacity > 0 ? Math.round((hostel.occupied / hostel.capacity) * 100) : 0;
  };

   const confirmDeleteHostel = async (hostelId: string, hostelName: string) => {
    const result = await deleteHostel(hostelId);
    if (result.success) {
        toast({ title: "Hostel Deleted", description: `${hostelName} has been removed.` });
        loadHostels();
    } else {
        toast({ variant: "destructive", title: "Deletion Failed", description: result.error });
    }
   };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
                <span>Loading Hostels...</span>
            </div>
        );
    }
    
    if (error) {
        return (
             <div className="text-center text-destructive py-10">
                <AlertTriangle className="mx-auto h-12 w-12" />
                <h2 className="mt-4 text-lg font-semibold">Failed to Load Data</h2>
                <p className="text-sm">{error}</p>
                 <Button onClick={loadHostels} className="mt-4" variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                 </Button>
            </div>
        );
    }

  const getStatusBadge = (status: Hostel['status']) => {
    switch (status) {
        case 'Operational': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Operational</Badge>;
        case 'Under Maintenance': return <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-black">Maintenance</Badge>;
        case 'Closed': return <Badge variant="destructive">Closed</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Manage Hostels</h1>
        <Button onClick={() => setIsAddHostelDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Hostel
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hostel Directory</CardTitle>
           <CardDescription>View, manage, and track hostel details and occupancy.</CardDescription>
            <div className="pt-4 flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[250px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                    placeholder="Search hostels by name, ID, or warden..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hostel ID</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Warden</TableHead><TableHead className="text-center">Occupancy (Beds)</TableHead><TableHead className="text-center">Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHostels.length > 0 ? filteredHostels.map((hostel) => {
                 const occupancyPercent = getOccupancyPercentage(hostel);
                 return (
                    <TableRow key={hostel.id}>
                    <TableCell className="font-medium">{hostel.id}</TableCell>
                    <TableCell>{hostel.name}</TableCell>
                    <TableCell>{hostel.type}</TableCell>
                    <TableCell>{hostel.warden?.name || 'N/A'}</TableCell>
                    <TableCell className="text-center">
                         <div className="flex flex-col items-center">
                            <span>{hostel.occupied} / {hostel.capacity}</span>
                            <Badge variant="secondary" className="mt-1 w-[60px] justify-center">{occupancyPercent}%</Badge>
                         </div>
                    </TableCell>
                    <TableCell className="text-center">{getStatusBadge(hostel.status)}</TableCell>
                    <TableCell className="text-right">
                        <AlertDialog>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">Actions</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <Link href={`/admin/hostels/${hostel.id}`} passHref>
                                        <DropdownMenuItem>
                                            <Eye className="mr-2 h-4 w-4" /> View Details
                                        </DropdownMenuItem>
                                    </Link>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete Hostel
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the hostel profile
                                    for <span className="font-semibold">{hostel.name} ({hostel.id})</span> and un-assign all its residents.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => confirmDeleteHostel(hostel.id, hostel.name)}>
                                    Delete
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                    </TableRow>
                 )
                 }) : (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No hostels found matching your criteria.
                        </TableCell>
                    </TableRow>
                 )}
            </TableBody>
          </Table>
           <div className="flex justify-end pt-4 text-sm text-muted-foreground">
               Showing {filteredHostels.length} of {hostels.length} hostels
           </div>
        </CardContent>
      </Card>
      <AddHostelDialog isOpen={isAddHostelDialogOpen} onOpenChange={setIsAddHostelDialogOpen} onHostelAdded={loadHostels} />
    </div>
  );
}
