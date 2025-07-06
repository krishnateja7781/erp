
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, Activity, Users, BarChartHorizontal, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getAggregatedAttendance, AggregatedData } from '@/actions/attendance-actions';

export default function AdminAttendanceSummaryPage() {
    const { toast } = useToast();
    const [aggregatedData, setAggregatedData] = React.useState<AggregatedData | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await getAggregatedAttendance();
            if (result.success && result.data) {
                setAggregatedData(result.data);
                if (result.data.duplicateCount > 0 || result.data.incompleteCount > 0) {
                     toast({ variant: "destructive", title: "Data Quality Note", description: `${result.data.duplicateCount} duplicate(s) and ${result.data.incompleteCount} incomplete record(s) were found and skipped during aggregation.`, duration: 7000 });
                }
            } else {
                 setError(result.error || "Failed to load aggregated data.");
                 toast({ variant: "destructive", title: "Error", description: result.error || "Could not load aggregated attendance data." });
            }
        } catch (err: any) {
            console.error("Error loading attendance data:", err);
            setError("A critical error occurred while fetching attendance data.");
            toast({ variant: "destructive", title: "Error", description: "Could not load attendance data due to a network or server issue." });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);


    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const [filters, setFilters] = React.useState({
      program: 'all',
      branch: 'all',
      year: 'all',
    });

    const programs = React.useMemo(() => {
        if (!aggregatedData || !aggregatedData.byProgram) return ['all'];
        return ['all', ...Object.keys(aggregatedData.byProgram)];
    }, [aggregatedData]);

    const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
        const newFilters = { ...filters };
        if (filterName === 'program') {
            newFilters.program = value;
            newFilters.branch = 'all';
            newFilters.year = 'all';
        } else if (filterName === 'branch') {
             newFilters.branch = value;
             newFilters.year = 'all';
        } else {
            newFilters[filterName] = value;
        }
        setFilters(newFilters);
        toast({ title: "Filter Updated", description: `Viewing data for ${filterName}: ${value}`, duration: 2000 });
     };

    const branches = React.useMemo(() => {
        if (!aggregatedData || !aggregatedData.byProgram || filters.program === 'all') return ['all'];
        const programData = aggregatedData.byProgram[filters.program];
        return programData && programData.branches ? ['all', ...Object.keys(programData.branches)] : ['all'];
    }, [filters.program, aggregatedData]);

    const years = React.useMemo(() => {
        if (!aggregatedData || !aggregatedData.byProgram || filters.program === 'all' || filters.branch === 'all') return ['all'];
        const programData = aggregatedData.byProgram[filters.program];
        const branchData = programData?.branches?.[filters.branch];
        return branchData && branchData.classes ? ['all', ...Object.keys(branchData.classes)] : ['all'];
    }, [filters.program, filters.branch, aggregatedData]);


    const handleUploadCsv = () => {
        console.log("Placeholder: Trigger CSV Upload for Attendance");
        toast({ title: "File Upload", description: "CSV upload functionality is for demonstration. No actual file will be processed." });
    };

    const handleDownloadReport = () => {
        console.log("Placeholder: Trigger Report Download (Aggregated)");
        toast({ title: "Report Download", description: "Aggregated report download is for demonstration. No actual file will be downloaded." });
    };

     const displayData = React.useMemo(() => {
         if (!aggregatedData || !aggregatedData.byProgram) return [];
         if (filters.program === 'all') return Object.values(aggregatedData.byProgram);

         const progData = aggregatedData.byProgram[filters.program];
         if (!progData || !progData.branches) return [];
         if (filters.branch === 'all') return Object.values(progData.branches);

         const branchData = progData.branches[filters.branch];
          if (!branchData || !branchData.classes) return [];
          if (filters.year === 'all') return Object.values(branchData.classes);

          const classData = branchData.classes[filters.year];
          return classData ? [classData] : [];
     }, [filters, aggregatedData]);

     const detailedViewTitle = React.useMemo(() => {
        if (filters.program === 'all') return "Attendance by Program";
        let title = `Program: ${filters.program}`;
        if (filters.branch !== 'all') {
            title += ` / Branch: ${filters.branch}`;
        }
         if (filters.year !== 'all') {
             title += ` / Year: ${filters.year}`;
         }
        return title;
     }, [filters]);

      const displayItemType = React.useMemo(() => {
          if (filters.program === 'all') return "Program";
          if (filters.branch === 'all') return "Branch";
          if (filters.year === 'all') return "Class (Year)";
          return "Class (Year)"; // When specific year is selected
      }, [filters]);

     if (isLoading) {
        return (
             <div className="flex justify-center items-center h-64">
                <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
                <span>Loading Attendance Data...</span>
             </div>
        );
    }

    if (error) {
        return (
            <div className="text-center text-destructive py-10">
                <AlertTriangle className="mx-auto h-12 w-12" />
                <h2 className="mt-4 text-lg font-semibold">Failed to Load Data</h2>
                <p className="text-sm">{error}</p>
                 <Button onClick={loadData} className="mt-4" variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                 </Button>
            </div>
        );
    }

    if (!aggregatedData || !aggregatedData.overall) {
         return <div className="text-center text-muted-foreground py-10">No attendance data available to display.</div>;
    }

    const { overall, byProgram, duplicateCount, incompleteCount, totalRecords } = aggregatedData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold">Overall Attendance Summary</h1>
        <div className="flex gap-2">
           <Button variant="outline" onClick={handleUploadCsv} disabled>
             <Upload className="mr-2 h-4 w-4" /> Upload Records (WIP)
           </Button>
            <Button variant="outline" onClick={handleDownloadReport} disabled>
             <Download className="mr-2 h-4 w-4" /> Download Report (WIP)
           </Button>
        </div>
      </div>

       {(duplicateCount > 0 || incompleteCount > 0) && (
            <Card className="border-yellow-500 bg-yellow-50 dark:border-yellow-400 dark:bg-yellow-900/20">
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" /> Data Quality Note
                    </CardTitle>
                 </CardHeader>
                <CardContent className="text-xs text-yellow-700 dark:text-yellow-400 px-4 pb-4 space-y-1">
                    {duplicateCount > 0 && <p>- {duplicateCount} duplicate record ID(s) were found and excluded from calculations.</p>}
                    {incompleteCount > 0 && <p>- {incompleteCount} record(s) missing essential data were skipped during aggregation.</p>}
                 </CardContent>
            </Card>
       )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Overall Attendance %</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{overall.percentage}%</div>
                    <p className="text-xs text-muted-foreground">Based on {overall.totalClasses.toLocaleString()} recorded classes (Present/Absent)</p>
                    <Progress value={overall.percentage} className="mt-2 h-2" aria-label={`${overall.percentage}% Overall Attendance`} />
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Programs Tracked</CardTitle>
                     <BarChartHorizontal className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{byProgram ? Object.keys(byProgram).length : 0}</div>
                    <p className="text-xs text-muted-foreground">Across all departments</p>
                </CardContent>
            </Card>
            <Card>
                 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Records Processed</CardTitle>
                     <Users className="h-4 w-4 text-muted-foreground" />
                 </CardHeader>
                 <CardContent>
                     <div className="text-2xl font-bold">{(totalRecords).toLocaleString()}</div>
                     <p className="text-xs text-muted-foreground">Total attendance entries fetched from the database</p>
                 </CardContent>
             </Card>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>{detailedViewTitle}</CardTitle>
           <CardDescription>Select filters to view attendance breakdown.</CardDescription>
            <div className="pt-4 flex flex-wrap items-center gap-4">
                <Select value={filters.program} onValueChange={(value) => handleFilterChange('program', value)}>
                    <SelectTrigger className="w-full sm:w-auto flex-grow min-w-[150px]">
                        <SelectValue placeholder="Select Program" />
                    </SelectTrigger>
                    <SelectContent>
                        {programs.map(p => <SelectItem key={p} value={p}>{p === 'all' ? 'All Programs' : p}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Select value={filters.branch} onValueChange={(value) => handleFilterChange('branch', value)} disabled={filters.program === 'all'}>
                    <SelectTrigger className="w-full sm:w-auto flex-grow min-w-[150px]" disabled={filters.program === 'all'}>
                        <SelectValue placeholder="Select Branch" />
                    </SelectTrigger>
                    <SelectContent>
                         {branches.map(b => <SelectItem key={b} value={b}>{b === 'all' ? 'All Branches' : b}</SelectItem>)}
                    </SelectContent>
                </Select>

                <Select value={filters.year} onValueChange={(value) => handleFilterChange('year', value)} disabled={filters.program === 'all' || filters.branch === 'all'}>
                    <SelectTrigger className="w-full sm:w-auto flex-grow min-w-[120px]" disabled={filters.program === 'all' || filters.branch === 'all'}>
                        <SelectValue placeholder="Select Year" />
                    </SelectTrigger>
                    <SelectContent>
                        {years.map(y => <SelectItem key={y} value={y}>{y === 'all' ? 'All Years' : `Year ${y}`}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </CardHeader>
        <CardContent>
            {displayData.length > 0 ? (
                 <Accordion type="single" collapsible className="w-full" defaultValue={displayData.length === 1 && displayData[0]?.[displayItemType.toLowerCase().replace(' (year)', '') as keyof typeof displayData[0]] ? displayData[0][displayItemType.toLowerCase().replace(' (year)', '') as keyof typeof displayData[0]]?.toString() : undefined}>
                     {displayData.map((item: any, index: number) => {
                         if (!item) return null;
                         let itemKey: string | number = '';
                         let itemName: string = '';

                         if (displayItemType === "Program") { itemKey = item.program; itemName = item.program; }
                         else if (displayItemType === "Branch") { itemKey = item.branch; itemName = item.branch; }
                         else if (displayItemType === "Class (Year)") { itemKey = item.year?.toString(); itemName = `Year ${item.year}`; }

                         if (!itemKey || typeof item.percentage === 'undefined') return null;

                         const itemValue = `${item.percentage}% (${item.totalPresent}/${item.totalClasses})`;
                         const uniqueKey = `${displayItemType}-${itemKey}-${index}`;

                         return (
                            <AccordionItem key={uniqueKey} value={itemKey.toString()}>
                                <AccordionTrigger className="text-lg font-medium px-4 py-3 hover:bg-muted/50 rounded-md">
                                    <div className="flex justify-between w-full pr-4 items-center">
                                        <span>{itemName}</span>
                                         <div className="flex items-center gap-2">
                                            <span className='text-sm text-muted-foreground mr-2'>{itemValue}</span>
                                             <Progress value={item.percentage} className="w-24 h-2" aria-label={`${item.percentage}% Attendance`} />
                                         </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-1 pb-1">
                                     {displayItemType === "Program" && item.branches && Object.keys(item.branches).length > 0 && (
                                         <Table>
                                             <TableHeader><TableRow><TableHead>Branch</TableHead><TableHead className='text-right'>Attendance %</TableHead></TableRow></TableHeader>
                                             <TableBody>
                                                {Object.values(item.branches as any)
                                                      .sort((a: any, b: any) => a.branch.localeCompare(b.branch))
                                                      .map((branch: any) => (
                                                        <TableRow key={`${uniqueKey}-${branch.branch}`}>
                                                            <TableCell>{branch.branch}</TableCell>
                                                            <TableCell className='text-right'>{branch.percentage}% ({branch.totalPresent}/{branch.totalClasses})</TableCell>
                                                        </TableRow>
                                                ))}
                                             </TableBody>
                                         </Table>
                                     )}
                                    {displayItemType === "Branch" && item.classes && Object.keys(item.classes).length > 0 && (
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Class (Year)</TableHead><TableHead className='text-right'>Attendance %</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                               {Object.values(item.classes as any)
                                                     .sort((a: any, b: any) => a.year - b.year)
                                                     .map((cls: any) => (
                                                       <TableRow key={`${uniqueKey}-Year-${cls.year}`}>
                                                           <TableCell>Year {cls.year}</TableCell>
                                                           <TableCell className='text-right'>{cls.percentage}% ({cls.totalPresent}/{cls.totalClasses})</TableCell>
                                                       </TableRow>
                                               ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                     {displayItemType === "Class (Year)" && (
                                        <p className="text-sm text-muted-foreground p-4 text-center">End of breakdown for {itemName}.</p>
                                     )}
                                     {((displayItemType === "Program" && (!item.branches || Object.keys(item.branches).length === 0)) ||
                                       (displayItemType === "Branch" && (!item.classes || Object.keys(item.classes).length === 0))) && (
                                        <p className="text-sm text-muted-foreground p-4 text-center">No further breakdown available for {itemName}.</p>
                                     )}
                                </AccordionContent>
                            </AccordionItem>
                         )
                     })}
                 </Accordion>

            ) : (
                 <div className="text-center text-muted-foreground py-8">
                    No attendance data found for the selected criteria.
                 </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
