
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Loader2, AlertTriangle, MoreHorizontal, Eye, Edit, Trash2, PlusCircle } from "lucide-react";
import { getStaff, deleteTeacher } from '@/actions/staff-actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import type { Teacher } from '@/lib/types';
import { AddStaffDialog } from '@/components/admin/staff/add-staff-dialog';

async function fetchStaff(): Promise<Teacher[]> {
  console.log("AdminStaffListPage: fetchStaff - Attempting to fetch via server action...");
  const staff = await getStaff();
  return staff;
}

const getUniqueValues = (staff: Teacher[], key: keyof Teacher): string[] => {
    const values = new Set(staff.map(t => t[key]).filter(v => typeof v === 'string' && v.trim().length > 0) as string[]);
    return ['all', ...Array.from(values)].sort((a, b) => a === 'all' ? -1 : b === 'all' ? 1 : a.localeCompare(b));
}

export default function AdminStaffListPage() {
  const [allStaff, setAllStaff] = React.useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = React.useState(true); 
  const [error, setError] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [isAddStaffDialogOpen, setIsAddStaffDialogOpen] = React.useState(false);
  const [editingStaff, setEditingStaff] = React.useState<Teacher | null>(null);
  const { toast } = useToast();
  const [filters, setFilters] = React.useState({
      program: 'all',
      department: 'all', 
      status: 'all',
      role: 'all',
  });
  
  const router = useRouter();
  const searchParams = useSearchParams();

  const loadStaff = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const staffData = await fetchStaff();
      setAllStaff(staffData);
    } catch (e: any) {
      setError(e.message || "Failed to load staff data.");
      setAllStaff([]); 
    } finally {
      setIsLoading(false);
    }
  }, []); 

  React.useEffect(() => {
    loadStaff();
  }, [loadStaff]); 

  React.useEffect(() => {
    if (searchParams.get('action') === 'add') {
      handleAddNew();
      router.replace('/admin/teachers', { scroll: false });
    }
  }, [searchParams, router]);


   const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
       setFilters(prev => {
         const newFilters = { ...prev, [filterName]: value };
         if (filterName === 'program') {
           newFilters.department = 'all'; 
         }
         return newFilters;
       });
   };

    const programs = getUniqueValues(allStaff, 'program');
    const departments = React.useMemo(() => {
        let relevantStaff = allStaff;
        if (filters.program !== 'all') {
            relevantStaff = allStaff.filter(t => t.program === filters.program);
        }
        return getUniqueValues(relevantStaff, 'department'); 
    }, [filters.program, allStaff]);
    const statuses = getUniqueValues(allStaff, 'status');

  const filteredStaff = React.useMemo(() => {
      return allStaff.filter(teacher => {
        const lowerSearchTerm = searchTerm.toLowerCase();
        const nameMatch = teacher.name && teacher.name.toLowerCase().includes(lowerSearchTerm);
        const idMatch = teacher.id && teacher.id.toLowerCase().includes(lowerSearchTerm);
        const searchMatch = !searchTerm || nameMatch || idMatch;

        const programMatch = filters.program === 'all' || teacher.program === filters.program;
        const departmentMatch = filters.department === 'all' || teacher.department === filters.department; 
        const statusMatch = filters.status === 'all' || teacher.status === filters.status;
        const roleMatch = filters.role === 'all' || teacher.role === filters.role;
        return searchMatch && programMatch && departmentMatch && statusMatch && roleMatch;
      });
  }, [allStaff, searchTerm, filters]);
  
    const getStatusBadge = (status: string | null) => {
      if (!status) return <Badge variant="outline">N/A</Badge>;
      switch (status.toLowerCase()) {
          case 'active': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Active</Badge>;
          case 'inactive': return <Badge variant="secondary">Inactive</Badge>;
          case 'on leave': return <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-black">On Leave</Badge>;
          default: return <Badge variant="outline">{status}</Badge>;
      }
    };
    
    const handleAddNew = React.useCallback(() => {
        setEditingStaff(null);
        setIsAddStaffDialogOpen(true);
    }, []);

    const handleEdit = (staff: Teacher) => {
        setEditingStaff(staff);
        setIsAddStaffDialogOpen(true);
    };

    const confirmDelete = async (staffId: string, staffName: string | null) => {
        const result = await deleteTeacher(staffId);
        if(result.success) {
            toast({ title: "Success", description: result.message || `Staff member ${staffName} deleted.` });
            loadStaff();
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error || "Failed to delete staff member." });
        }
    };
    
    if (isLoading && allStaff.length === 0) {
      return <div className="flex justify-center items-center h-64"><Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" /><span>Loading Staff...</span></div>;
    }
    
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by Name or Staff ID..."
                        className="pl-8 w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                 <Select value={filters.program} onValueChange={(value) => handleFilterChange('program', value)}>
                    <SelectTrigger><SelectValue placeholder="Program Association" /></SelectTrigger>
                    <SelectContent>{programs.map(p => <SelectItem key={p} value={p}>{p === 'all' ? 'All Programs' : p}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.department} onValueChange={(value) => handleFilterChange('department', value)} disabled={filters.program === 'all' && departments.length <= 1}>
                    <SelectTrigger disabled={filters.program === 'all' && departments.length <= 1}><SelectValue placeholder="Department" /></SelectTrigger>
                    <SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d === 'all' ? 'All Departments' : d}</SelectItem>)}</SelectContent>
                </Select>
                 <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filters.role} onValueChange={(value) => handleFilterChange('role', value)}>
                    <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="teacher">Teachers</SelectItem>
                        <SelectItem value="admin">Admins</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Staff ID</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead><TableHead>Position</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center"><Loader2 className="inline mr-2 h-4 w-4 animate-spin"/>Loading...</TableCell></TableRow>
              ) : filteredStaff.length > 0 ? filteredStaff.map((staff) => (
                <TableRow key={staff.id}>
                  <TableCell className="font-medium">{staff.staffId}</TableCell>
                  <TableCell>{staff.name}</TableCell>
                  <TableCell>{staff.department}</TableCell>
                  <TableCell>{staff.position}</TableCell>
                  <TableCell className="capitalize">{staff.role}</TableCell>
                  <TableCell>{getStatusBadge(staff.status)}</TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild><Link href={`/admin/teachers/${staff.id}`}><Eye className="mr-2 h-4 w-4"/> View Profile</Link></DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(staff)}><Edit className="mr-2 h-4 w-4"/> Edit</DropdownMenuItem>
                          <AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}><Trash2 className="mr-2 h-4 w-4"/> Delete</DropdownMenuItem></AlertDialogTrigger>
                        </DropdownMenuContent>
                      </DropdownMenu>
                       <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the staff profile for <span className="font-semibold">{staff.name} ({staff.staffId})</span> and all associated data.
                              </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => confirmDelete(staff.id, staff.name)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No staff members found matching criteria.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <CardFooter>
            <p className="text-xs text-muted-foreground">Showing up to 100 staff members, ordered by name. Use search and filters for specific results.</p>
        </CardFooter>
      </Card>
      <AddStaffDialog 
        isOpen={isAddStaffDialogOpen}
        onOpenChange={setIsAddStaffDialogOpen}
        onStaffAdded={loadStaff}
        initialData={editingStaff}
      />
    </div>
  );
}
