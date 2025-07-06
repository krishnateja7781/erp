
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Search, Calculator, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getMarksRecords, saveAllMarksForClass, MarksRecord } from '@/actions/marks-actions';
import { Timestamp } from 'firebase/firestore';


type MarksField = 'internals' | 'externals';

const calculateGrade = (total: number | null): string | null => {
    if (total === null || typeof total !== 'number' || isNaN(total) || total < 0 || total > 100) return null;
    if (total >= 90) return 'O'; if (total >= 80) return 'A+'; if (total >= 70) return 'A';
    if (total >= 60) return 'B+'; if (total >= 50) return 'B'; if (total >= 45) return 'C+';
    if (total >= 40) return 'C'; if (total >= 35) return 'P'; return 'FAIL';
};

export default function AdminMarksPage() {
    const { toast } = useToast();
    const [allRecords, setAllRecords] = React.useState<MarksRecord[]>([]);
    const [modifiedRecords, setModifiedRecords] = React.useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [filters, setFilters] = React.useState({ program: 'all', branch: 'all', year: 'all', semester: 'all' });
    const [error, setError] = React.useState<string | null>(null);

    const loadMarks = React.useCallback(async () => {
        setIsLoading(true); setError(null);
        try {
            const result = await getMarksRecords();
            if (result.success && result.data) {
                setAllRecords(result.data);
            } else {
                 setError(result.error || "Failed to load marks data.");
                 toast({variant: "destructive", title: "Loading Error", description: result.error || "Failed to load marks data."});
            }
        } catch (e:any) {
            setError(e.message || "An unknown error occurred while loading marks.");
            toast({variant: "destructive", title: "Loading Error", description: e.message || "An unknown error occurred."});
        } finally { setIsLoading(false); }
    }, [toast]);

    React.useEffect(() => { loadMarks(); }, [loadMarks]);

    const programs = React.useMemo(() => ['all', ...new Set(allRecords.map(r => r.program).filter(Boolean) as string[])].sort(), [allRecords]);
    const branches = React.useMemo(() => {
        const relevantRecords = filters.program === 'all' ? allRecords : allRecords.filter(r => r.program === filters.program);
        return ['all', ...new Set(relevantRecords.map(r => r.branch).filter(Boolean) as string[])].sort();
    }, [filters.program, allRecords]);
    const years = React.useMemo(() => ['all', ...new Set(allRecords.map(r => r.year?.toString()).filter(Boolean) as string[])].sort((a,b) => a === 'all' ? -1 : b === 'all' ? 1 : parseInt(a) - parseInt(b)), [allRecords]);
    const semesters = React.useMemo(() => ['all', ...new Set(allRecords.map(r => r.semester?.toString()).filter(Boolean) as string[])].sort((a,b) => a === 'all' ? -1 : b === 'all' ? 1 : parseInt(a) - parseInt(b)), [allRecords]);

    const filteredRecords = React.useMemo(() => {
        return allRecords.filter(record => 
            (filters.program === 'all' || record.program === filters.program) &&
            (filters.branch === 'all' || record.branch === filters.branch) &&
            (filters.year === 'all' || record.year?.toString() === filters.year) &&
            (filters.semester === 'all' || record.semester?.toString() === filters.semester) &&
            (!searchTerm || record.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) || record.studentId?.toLowerCase().includes(searchTerm.toLowerCase()) || record.courseCode?.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [allRecords, searchTerm, filters]);

    const handleMarkChange = (recordId: string, field: MarksField, value: string | null) => {
        const numericValue = value === null || value.trim() === '' ? null : parseInt(value, 10);
        if (numericValue !== null && (isNaN(numericValue) || numericValue < 0 || numericValue > 50)) {
            toast({ variant: "destructive", title: "Invalid Input", description: "Marks must be a number between 0 and 50." });
            return;
        }
        setAllRecords(prev => prev.map(rec => {
            if (rec.id === recordId) {
                const updatedRec = { ...rec, [field]: numericValue };
                if (typeof updatedRec.internals === 'number' && typeof updatedRec.externals === 'number') {
                    updatedRec.total = updatedRec.internals + updatedRec.externals;
                    updatedRec.grade = calculateGrade(updatedRec.total);
                } else {
                    updatedRec.total = null;
                    updatedRec.grade = null;
                }
                return updatedRec;
            }
            return rec;
        }));
        setModifiedRecords(prev => new Set(prev).add(recordId));
    };
    
    const handleCalculateAllGrades = () => {
        const modifiedIds = new Set<string>();
        const updatedRecordsState = allRecords.map(rec => {
            if (rec.id && typeof rec.internals === 'number' && typeof rec.externals === 'number') {
                const total = rec.internals + rec.externals;
                const grade = calculateGrade(total);
                if (total !== rec.total || grade !== rec.grade) {
                    modifiedIds.add(rec.id);
                    return { ...rec, total, grade };
                }
            }
            return rec;
        });
        setAllRecords(updatedRecordsState);
        setModifiedRecords(prev => new Set([...prev, ...modifiedIds]));
        toast({ title: "Success", description: `Calculated grades for ${modifiedIds.size} records. Please save your changes.`});
    };

    const handleSaveChanges = async () => {
        const recordsToSave = allRecords.filter(r => 
            modifiedRecords.has(r.id) && 
            r.internals !== null && 
            r.externals !== null && 
            r.studentId && 
            r.courseCode && 
            r.semester
        );
        if(recordsToSave.length === 0){
            toast({title: "No Complete Changes", description: "There are no modified records with all required fields to save."});
            return;
        }
        
        setIsSaving(true);
        const payload = recordsToSave.map(rec => ({
            recordId: rec.id,
            studentId: rec.studentId!,
            courseCode: rec.courseCode!,
            semester: rec.semester!,
            marks: {
                internalsMarks: rec.internals!,
                externalsMarks: rec.externals!,
                totalMarks: rec.total!,
                grade: rec.grade!
            }
        }));

        const result = await saveAllMarksForClass(payload);

        if(result.success) {
            toast({title: "Success", description: result.message});
            setModifiedRecords(new Set());
        } else {
            toast({variant: "destructive", title: "Save Failed", description: result.error});
        }
        setIsSaving(false);
    };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold">Manage Marks & Grades</h1>
        <div className="flex gap-2 flex-wrap">
            <Button onClick={handleCalculateAllGrades} disabled={isSaving || isLoading || filteredRecords.length === 0}><Calculator className="mr-2 h-4 w-4" />Calculate All</Button>
            <Button onClick={handleSaveChanges} disabled={isSaving || isLoading || modifiedRecords.size === 0}><Save className="mr-2 h-4 w-4" />Save {modifiedRecords.size > 0 ? `(${modifiedRecords.size})` : ''} Changes</Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Student Marks Records</CardTitle>
          <CardDescription>View, edit, and manage student marks and grades.</CardDescription>
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2"><Input placeholder="Search Student Name, ID, Course..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
              <Select value={filters.program} onValueChange={(v) => setFilters(f => ({...f, program: v, branch: 'all', year: 'all', semester: 'all'}))}><SelectTrigger><SelectValue placeholder="Program"/></SelectTrigger><SelectContent>{programs.map(p=><SelectItem key={p} value={p}>{p === 'all' ? 'All Programs':p}</SelectItem>)}</SelectContent></Select>
              <Select value={filters.branch} onValueChange={(v) => setFilters(f => ({...f, branch: v, year: 'all', semester: 'all'}))} disabled={filters.program === 'all'}><SelectTrigger><SelectValue placeholder="Branch"/></SelectTrigger><SelectContent>{branches.map(b=><SelectItem key={b} value={b}>{b === 'all' ? 'All Branches':b}</SelectItem>)}</SelectContent></Select>
              <Select value={filters.year} onValueChange={(v) => setFilters(f => ({...f, year: v, semester: 'all'}))}><SelectTrigger><SelectValue placeholder="Year"/></SelectTrigger><SelectContent>{years.map(y=><SelectItem key={y} value={y}>{y === 'all' ? 'All Years' : `Year ${y}`}</SelectItem>)}</SelectContent></Select>
            </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin mx-auto"/></div> :
            error ? <div className="text-center text-destructive py-10"><AlertTriangle className="mx-auto h-8 w-8" /><p className="mt-2">{error}</p></div> :
            <Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Course</TableHead><TableHead>Internals</TableHead><TableHead>Externals</TableHead><TableHead>Total</TableHead><TableHead>Grade</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredRecords.length > 0 ? filteredRecords.map((record) => (
                    <TableRow key={record.id} className={modifiedRecords.has(record.id) ? "bg-yellow-100 dark:bg-yellow-900/30" : ""}>
                        <TableCell><div className="font-medium">{record.studentName}</div><div className="text-xs text-muted-foreground">{record.studentId}</div></TableCell>
                        <TableCell>{record.courseCode} - {record.courseName}</TableCell>
                        <TableCell><Input type="number" defaultValue={record.internals ?? ''} onBlur={(e) => handleMarkChange(record.id, 'internals', e.target.value)} className="h-8 text-center" min="0" max="50"/></TableCell>
                        <TableCell><Input type="number" defaultValue={record.externals ?? ''} onBlur={(e) => handleMarkChange(record.id, 'externals', e.target.value)} className="h-8 text-center" min="0" max="50"/></TableCell>
                        <TableCell><Input value={record.total ?? ''} className="h-8 text-center font-semibold bg-muted" readOnly/></TableCell>
                        <TableCell><Input value={record.grade ?? ''} className="h-8 text-center font-semibold bg-muted" readOnly/></TableCell>
                    </TableRow>
                )) : (<TableRow><TableCell colSpan={6} className="text-center py-8">No records match your criteria.</TableCell></TableRow>)}
              </TableBody>
            </Table>
          }
        </CardContent>
        <CardFooter>
            <p className="text-xs text-muted-foreground">Showing up to 200 marks records. Use filters for specific results.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
