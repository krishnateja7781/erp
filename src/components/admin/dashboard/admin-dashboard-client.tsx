
'use client'; 

import * as React from 'react'; 
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Users, LogIn, Loader2, Activity, Banknote, BarChartHorizontal } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis, 
  ResponsiveContainer
} from "recharts"

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip, 
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { AdminDashboardData, LoginEvent } from '@/actions/dashboard-actions';

const attendanceChartConfig = {
  attendance: { label: "Attendance %", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const studentChartConfig = {
  count: { label: "Students", color: "hsl(var(--chart-2))" },
  branch: { label: "Branch" }, 
} satisfies ChartConfig;

interface AdminDashboardClientProps {
  initialData: AdminDashboardData;
}

export function AdminDashboardClient({ initialData }: AdminDashboardClientProps) {
    const feeCollectedPercentage = initialData.feeCollection.total > 0 ? (initialData.feeCollection.collected / initialData.feeCollection.total) * 100 : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{initialData.totalStudents?.toLocaleString() ?? 'N/A'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{initialData.totalTeachers?.toLocaleString() ?? 'N/A'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Programs</CardTitle>
            <BarChartHorizontal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{initialData.totalPrograms?.toLocaleString() ?? 'N/A'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fee Collection</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{feeCollectedPercentage.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
                ₹{initialData.feeCollection.collected.toLocaleString()} of ₹{initialData.feeCollection.total.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
             <CardHeader>
                 <CardTitle>Attendance Trend (Last 6 Months)</CardTitle>
             </CardHeader>
             <CardContent>
                <ChartContainer config={attendanceChartConfig} className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={initialData.attendanceTrend || []} margin={{ left: 12, right: 12, top: 5, bottom: 5 }}>
                             <CartesianGrid vertical={false} />
                             <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => value.slice(0, 3)} interval={0} />
                              <YAxis hide />
                             <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                             <defs>
                                 <linearGradient id="fillAttendance" x1="0" y1="0" x2="0" y2="1">
                                     <stop offset="5%" stopColor="var(--color-attendance)" stopOpacity={0.8}/>
                                     <stop offset="95%" stopColor="var(--color-attendance)" stopOpacity={0.1}/>
                                 </linearGradient>
                             </defs>
                             <Area dataKey="attendance" type="natural" fill="url(#fillAttendance)" stroke="var(--color-attendance)" stackId="a" />
                         </AreaChart>
                     </ResponsiveContainer>
                 </ChartContainer>
             </CardContent>
         </Card>

        <Card>
             <CardHeader>
                 <CardTitle className="flex items-center gap-2"><LogIn className="h-5 w-5 text-blue-500"/> Recent Login Activity</CardTitle>
                 <CardDescription>Latest user login events.</CardDescription>
             </CardHeader>
             <CardContent>
                 {initialData.recentLogins.length > 0 ? (
                     <ul className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                         {initialData.recentLogins.map((login) => (
                             <li key={login.id} className="flex items-center justify-between text-xs border-b pb-2 last:border-b-0">
                                 <div className='flex-1 overflow-hidden mr-2'>
                                      <p className="font-medium truncate">{login.userName}</p>
                                     <p className="text-muted-foreground capitalize">{login.userRole}</p>
                                 </div>
                                 <p className="text-muted-foreground text-right flex-shrink-0">{new Date(login.timestamp).toLocaleTimeString()}</p>
                             </li>
                         ))}
                     </ul>
                 ) : (
                     <p className="text-sm text-muted-foreground text-center py-4">No recent login activity found.</p>
                 )}
             </CardContent>
         </Card>
      </div>

       <div className="grid gap-6 md:grid-cols-2">
           <Card>
               <CardHeader>
                   <CardTitle>Student Distribution by Branch</CardTitle>
               </CardHeader>
               <CardContent>
                    {initialData.studentDistribution.length > 0 ? (
                        <ChartContainer config={studentChartConfig} className="w-full h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    accessibilityLayer
                                    data={initialData.studentDistribution}
                                    margin={{ top: 5, right: 20, left: -10, bottom: 40 }}
                                >
                                    <CartesianGrid vertical={false} />
                                    <XAxis
                                        dataKey="branch"
                                        tickLine={false}
                                        axisLine={false}
                                        stroke="#888888"
                                        fontSize={12}
                                        angle={-45}
                                        textAnchor="end"
                                        interval={0}
                                    />
                                    <YAxis stroke="#888888" fontSize={12} />
                                    <ChartTooltip
                                        cursor={false}
                                        content={<ChartTooltipContent />}
                                    />
                                    <Bar
                                        dataKey="count"
                                        fill="var(--color-count)"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    ) : (
                         <p className="text-sm text-muted-foreground text-center py-4">No student distribution data available.</p>
                    )}
               </CardContent>
           </Card>

           <Card>
               <CardHeader>
                   <CardTitle>Quick Actions</CardTitle>
                   <CardDescription>Common administrative tasks.</CardDescription>
               </CardHeader>
               <CardContent className="grid grid-cols-2 gap-4">
                  <Button variant="outline" asChild><Link href="/admin/students">Manage Students</Link></Button>
                  <Button variant="outline" asChild><Link href="/admin/teachers">Manage Staff</Link></Button>
                  <Button variant="outline" asChild><Link href="/admin/fees">Fees Dashboard</Link></Button>
                  <Button variant="outline" asChild><Link href="/admin/exams">Exam Schedules</Link></Button>
               </CardContent>
           </Card>
       </div>
    </div>
  );
}
