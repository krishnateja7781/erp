
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { TrendingUp, Download, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Bar, BarChart, Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { getStudentPerformanceData } from '@/actions/student-actions';
import type { StudentPerformanceData } from '@/actions/student-actions';
import { useToast } from '@/hooks/use-toast';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const marksChartConfig = {
  internals: { label: 'Internals', color: 'hsl(var(--chart-1))' },
  externals: { label: 'Externals', color: 'hsl(var(--chart-2))' },
  total: { label: 'Total', color: 'hsl(var(--chart-3))' },
} satisfies ChartConfig;

const attendanceChartConfig = {
    percentage: { label: 'Attendance %', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

export default function PerformancePage() {
  const [performanceData, setPerformanceData] = React.useState<StudentPerformanceData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const reportRef = React.useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const storedUserString = localStorage.getItem('loggedInUser');
    if (!storedUserString) {
        setError("You must be logged in to view performance data.");
        setIsLoading(false);
        return;
    }
    const user = JSON.parse(storedUserString);

    try {
        const data = await getStudentPerformanceData(user.id);
        setPerformanceData(data);
    } catch (err: any) {
        setError("Failed to load performance data.");
        toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
        setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);


  const handleDownloadReport = async () => {
    if (!reportRef.current) {
      toast({ variant: "destructive", title: "Error", description: "Report content is not available for download." });
      return;
    }
    toast({ title: "Info", description: "Generating PDF report..." });
    try {
        const canvas = await html2canvas(reportRef.current, { 
            scale: 2, 
            useCORS: true, 
            logging: false,
            backgroundColor: null
        });
        
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgData = canvas.toDataURL('image/png', 1.0);
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        
        const ratio = Math.min((pdfWidth - 80) / imgWidth, (pdfHeight - 80) / imgHeight);
        const newImgWidth = imgWidth * ratio;
        const newImgHeight = imgHeight * ratio;

        const xOffset = (pdfWidth - newImgWidth) / 2;
        const yOffset = 40;

        pdf.addImage(imgData, 'PNG', xOffset, yOffset, newImgWidth, newImgHeight);
        pdf.save(`performance_report.pdf`);
        toast({ title: "Success", description: "Performance report downloaded." });
    } catch (e) {
        console.error("PDF Generation Error:", e);
        toast({ variant: "destructive", title: "Download Failed", description: "Could not generate PDF report."});
    }
  };
  
    if (isLoading) {
        return (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
            <span>Loading Performance Data...</span>
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

    if (!performanceData) {
        return <div className="text-center text-muted-foreground py-10">No performance data available.</div>;
    }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Performance Analysis</h1>
        <Button variant="outline" onClick={handleDownloadReport}>
          <Download className="mr-2 h-4 w-4" /> Download Report
        </Button>
      </div>

        <div ref={reportRef} className="space-y-6 p-4 bg-background">
          <Card>
            <CardHeader>
              <CardTitle>Marks Distribution (Current Semester)</CardTitle>
              <CardDescription>Comparison of internal and external marks across subjects.</CardDescription>
            </CardHeader>
            <CardContent>
              {performanceData.marksData.length > 0 ? (
                <ChartContainer config={marksChartConfig} className="h-[300px] w-full">
                  <BarChart accessibilityLayer data={performanceData.marksData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="subject" tickLine={false} tickMargin={10} axisLine={false} />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="internals" fill="var(--color-internals)" radius={4} />
                    <Bar dataKey="externals" fill="var(--color-externals)" radius={4} />
                  </BarChart>
                </ChartContainer>
              ) : (
                 <p className="text-center text-muted-foreground py-10">No marks data available for this semester.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attendance Trend</CardTitle>
              <CardDescription>Your monthly attendance percentage over the last 6 months.</CardDescription>
            </CardHeader>
            <CardContent>
              {performanceData.attendanceData.length > 0 ? (
                <ChartContainer config={attendanceChartConfig} className="h-[300px] w-full">
                  <AreaChart accessibilityLayer data={performanceData.attendanceData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
                    <YAxis domain={[0, 100]}/>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                    <defs>
                       <linearGradient id="fillAttendance" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="var(--color-percentage)" stopOpacity={0.8}/>
                           <stop offset="95%" stopColor="var(--color-percentage)" stopOpacity={0.1}/>
                       </linearGradient>
                    </defs>
                    <Area dataKey="percentage" type="natural" fill="url(#fillAttendance)" stroke="var(--color-percentage)" stackId="a" />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <p className="text-center text-muted-foreground py-10">No attendance data available to show a trend.</p>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
