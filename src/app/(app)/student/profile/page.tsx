
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Home, Calendar, BedDouble, BookOpen, GraduationCap, Loader2 } from "lucide-react";
import Link from 'next/link';
import * as React from 'react';
import { getStudentProfileDetails, type FullStudentData } from "@/actions/student-actions";

const HydrationSafeDOB = ({ dateString }: { dateString: string | null }) => {
  const [displayDate, setDisplayDate] = React.useState(dateString ? dateString : "[Not Provided]");

  React.useEffect(() => {
    if (dateString) {
      try {
        setDisplayDate(new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
      } catch (e) {
        setDisplayDate("[Invalid Date]");
      }
    } else {
        setDisplayDate("[Not Provided]");
    }
  }, [dateString]);

  return <>{displayDate}</>;
};


export default function StudentProfilePage() {
   const [studentData, setStudentData] = React.useState<FullStudentData | null>(null);
   const [isLoading, setIsLoading] = React.useState(true);
   const [error, setError] = React.useState<string | null>(null);

   React.useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            setError(null);
            const storedUserString = typeof window !== 'undefined' ? localStorage.getItem('loggedInUser') : null;
            if (storedUserString) {
                try {
                    const user = JSON.parse(storedUserString);
                    if (user && user.id) {
                        const data = await getStudentProfileDetails(user.id);
                        if (data) {
                            setStudentData(data);
                        } else {
                            setError("Could not find profile data for the logged-in student.");
                        }
                    } else {
                        setError("Could not identify logged-in student.");
                    }
                } catch (e) {
                    console.error("Failed to load profile:", e);
                    setError("An error occurred while loading your profile.");
                }
            } else {
                setError("Not logged in. Please log in to view your profile.");
            }
            setIsLoading(false);
        };
        loadData();
   }, []);

   if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="mr-2 h-8 w-8 animate-spin"/>Loading profile...</div>;
   }

   if (error) {
       return <div className="text-center text-destructive py-10">{error}</div>;
   }

   if (!studentData) {
       return <div className="text-center text-muted-foreground py-10">Profile data could not be loaded.</div>;
   }

   const { profile, coursesEnrolled, hostelInfo } = studentData;
   const displayInitials = profile.initials || '??';
   const validCourses = coursesEnrolled?.filter(course => course && course.trim().length > 0) || [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Profile</h1>

      <Card>
        <CardHeader className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left space-y-4 md:space-y-0 md:space-x-6">
          <Avatar className="h-24 w-24 border">
            <AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.name ?? 'Student'} />
            <AvatarFallback className="text-3xl">{displayInitials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="text-2xl">{profile.name}</CardTitle>
            <CardDescription className="text-lg">{profile.collegeId}</CardDescription>
             <p className="flex items-center gap-1 justify-center md:justify-start text-muted-foreground">
                <GraduationCap className="h-4 w-4"/>
                <span>{profile.program} - {profile.branch}</span>
             </p>
             <p className="text-muted-foreground">
                 Year {profile.year ?? '?'} | Batch: {profile.batch}
             </p>
              {profile.type && <Badge variant="outline" className="mt-2">{profile.type}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2 pt-4 border-t">
          <div className="space-y-3">
            <h3 className="font-semibold text-primary">Contact Information</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 flex-shrink-0" />
              <span>{profile.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 flex-shrink-0" />
              <span>{profile.phone}</span>
            </div>
             <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 flex-shrink-0" />
               <span>Date of Birth: <HydrationSafeDOB dateString={profile.dob} /></span>
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Home className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                  <span className="font-medium block">Permanent Address:</span>
                   <span>{profile.address}</span>
              </div>
            </div>
            {profile.type === "Hosteler" && hostelInfo && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground pt-2 border-t mt-3">
                  <BedDouble className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                    <div>
                        <span className="font-medium block text-primary">Hostel Address:</span>
                        <span>{hostelInfo.hostelName}, Room {hostelInfo.roomNumber}</span>
                        <br/>
                        <Link href="/student/hostel" className="text-xs text-primary hover:underline">View Hostel Details &rarr;</Link>
                    </div>
                </div>
            )}
          </div>
           <div className="space-y-3">
              <h3 className="font-semibold text-primary flex items-center gap-2"><BookOpen className="h-4 w-4"/> Courses Enrolled (Current Sem)</h3>
              {validCourses.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                     {validCourses.map((course, index) => (
                        <Badge key={index} variant="secondary">{course}</Badge>
                     ))}
                  </div>
              ) : (
                  <p className="text-sm text-muted-foreground italic">[No courses listed for current semester]</p>
              )}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
