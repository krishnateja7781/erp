'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Search, PlusCircle, Loader2, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { recordPayment, getFeeRecords, type FeeRecord } from '@/actions/fee-actions';


type FeeStatus = 'Paid' | 'Pending' | 'Overdue';

const recordPaymentSchema = z.object({
    amount: z.coerce.number().positive({ message: "Amount must be greater than zero." }),
    reference: z.string().min(3, { message: "Reference must be at least 3 characters." }),
    notes: z.string().optional(),
});


export default function AdminFeesPage() {
    const { toast } = useToast();
    const [allRecords, setAllRecords] = React.useState<FeeRecord[]>([]);
    const [filteredRecords, setFilteredRecords] = React.useState<FeeRecord[]>([]);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<FeeStatus | 'all'>('all');
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [selectedStudent, setSelectedStudent] = React.useState<FeeRecord | null>(null);

    const form = useForm<z.infer<typeof recordPaymentSchema>>({
        resolver: zodResolver(recordPaymentSchema),
        defaultValues: { amount: undefined, reference: "", notes: "" },
    });

    const loadFeeData = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getFeeRecords();
            setAllRecords(data);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Failed to load fee records." });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        loadFeeData();
    }, [loadFeeData]);

    React.useEffect(() => {
        let records = allRecords.filter(record =>
            record.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            record.studentId.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (statusFilter !== 'all') {
            records = records.filter(record => record.status === statusFilter);
        }
        setFilteredRecords(records);
    }, [searchTerm, statusFilter, allRecords]);

    const handleOpenPaymentDialog = (student: FeeRecord) => {
        setSelectedStudent(student);
        form.reset();
    };

    const handleRecordPayment = async (values: z.infer<typeof recordPaymentSchema>) => {
        if (!selectedStudent) return;
        setIsSubmitting(true);
        try {
            const result = await recordPayment({
                studentDocId: selectedStudent.id, // Use the stable document ID
                amount: values.amount,
                reference: values.reference,
                notes: values.notes,
            });

            if (result.success) {
                toast({ title: "Success", description: `Payment of ₹${values.amount} recorded for ${selectedStudent.studentName}.` });
                setSelectedStudent(null);
                loadFeeData(); // Refresh data
            } else {
                toast({ variant: "destructive", title: "Failed", description: result.error || "Could not record payment." });
            }
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "An unexpected error occurred." });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const getStatusBadge = (status: FeeStatus) => {
        switch (status) {
            case 'Paid': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Paid</Badge>;
            case 'Pending': return <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-black">Pending</Badge>;
            case 'Overdue': return <Badge variant="destructive">Overdue</Badge>;
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" /><span>Loading Fee Records...</span></div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Fees Management</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Student Fee Status</CardTitle>
                    <CardDescription>View, search, and manage fee payments for all students.</CardDescription>
                    <div className="pt-4 flex flex-wrap items-center gap-4">
                        <div className="relative flex-1 min-w-[250px]">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search by Student Name or ID..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        <Select value={statusFilter} onValueChange={(value: FeeStatus | 'all') => setStatusFilter(value)}>
                            <SelectTrigger className="w-full sm:w-auto flex-grow min-w-[150px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="Paid">Paid</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Overdue">Overdue</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>College ID</TableHead><TableHead>Name</TableHead><TableHead>Total Fees</TableHead><TableHead>Amount Paid</TableHead><TableHead>Balance</TableHead><TableHead>Due Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {filteredRecords.length > 0 ? filteredRecords.map((record) => (
                                <TableRow key={record.id}>
                                    <TableCell className="font-medium">{record.studentId}</TableCell>
                                    <TableCell>{record.studentName}</TableCell>
                                    <TableCell>₹{record.totalFees.toLocaleString()}</TableCell>
                                    <TableCell className="text-green-600">₹{record.amountPaid.toLocaleString()}</TableCell>
                                    <TableCell className="font-semibold text-destructive">₹{record.balance.toLocaleString()}</TableCell>
                                    <TableCell>{record.dueDate}</TableCell>
                                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => handleOpenPaymentDialog(record)} disabled={record.status === 'Paid'}>
                                            <PlusCircle className="mr-2 h-4 w-4" /> Record Payment
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No records found matching your criteria.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
                <CardFooter>
                    <p className="text-xs text-muted-foreground">Showing up to 100 fee records, ordered by name. Use search and filters for specific results.</p>
                </CardFooter>
            </Card>

            <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Record Payment for {selectedStudent?.studentName}</DialogTitle>
                        <DialogDescription>Student ID: {selectedStudent?.studentId}. Current Balance: ₹{selectedStudent?.balance.toLocaleString()}</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleRecordPayment)} className="space-y-4" id="record-payment-form">
                            <FormField control={form.control} name="amount" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amount Being Paid *</FormLabel>
                                    <FormControl>
                                        <Input
                                          type="number"
                                          placeholder="Enter amount"
                                          {...field}
                                          value={field.value ?? ''}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="reference" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Transaction/Reference ID *</FormLabel>
                                    <FormControl><Input placeholder="e.g., TXN123456" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="notes" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes (Optional)</FormLabel>
                                    <FormControl><Input placeholder="e.g., Late fee waiver" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </form>
                    </Form>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline" disabled={isSubmitting}>Cancel</Button></DialogClose>
                        <Button type="submit" form="record-payment-form" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Receipt className="mr-2 h-4 w-4" />}
                            {isSubmitting ? "Saving..." : "Save Payment"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}