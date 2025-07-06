
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Building, Calendar, DollarSign, ExternalLink, Filter, Search, Check, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { getOpportunities } from '@/actions/placement-actions';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import { submitApplication } from '@/actions/placement-actions';
import type { Internship } from '@/lib/types';

type ApplicationStatus = 'Not Applied' | 'Applied' | 'Under Review' | 'Shortlisted' | 'Rejected';

export default function InternshipsPage() {
  const [internships, setInternships] = React.useState<Internship[]>([]);
  const [applicationStatus, setApplicationStatus] = React.useState<Record<string, ApplicationStatus>>({});
  const [loadingStatus, setLoadingStatus] = React.useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [currentUser, setCurrentUser] = React.useState<{uid: string, id: string} | null>(null);
  const { toast } = useToast();

  React.useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setCurrentUser({ uid: parsedUser.uid, id: parsedUser.id });
    }
  }, []);

  React.useEffect(() => {
    const loadData = async () => {
        setIsLoading(true);
        try {
            const internshipData = await getOpportunities('internship');
            setInternships(internshipData as Internship[]);
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not fetch internship opportunities." });
        } finally {
            setIsLoading(false);
        }
    };
    loadData();
  }, [toast]);
  
  React.useEffect(() => {
    if (!currentUser?.uid) return;

    const q = query(
        collection(db, "applications"), 
        where("studentUid", "==", currentUser.uid), 
        where("opportunityType", "==", "internship")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const statuses: Record<string, ApplicationStatus> = {};
        querySnapshot.forEach(doc => {
            const data = doc.data();
            statuses[data.opportunityId] = data.status as ApplicationStatus;
        });
        setApplicationStatus(statuses);
    });

    return () => unsubscribe();
  }, [currentUser]);


  const handleApply = async (internship: Internship) => {
    if (!currentUser) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to apply.' });
        return;
    }
    setLoadingStatus(prev => ({ ...prev, [internship.id]: true }));
    try {
      const result = await submitApplication({
          userId: currentUser.uid,
          studentId: currentUser.id,
          opportunityId: internship.id,
          opportunityType: 'internship',
          company: internship.company,
          role: internship.role
      });
      if (result.success) {
        // Status will be updated by the realtime listener
        toast({ title: 'Application Successful', description: result.message });
      } else {
        toast({ variant: 'destructive', title: 'Application Failed', description: result.error });
      }
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setLoadingStatus(prev => ({ ...prev, [internship.id]: false }));
    }
  };

  const getStatusButton = (internship: Internship) => {
    const status = applicationStatus[internship.id] || 'Not Applied';
    const isLoading = loadingStatus[internship.id] || false;

    if (isLoading) {
      return <Button disabled className="w-full"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applying...</Button>;
    }

    if (status !== 'Not Applied') {
        return <Button disabled variant="secondary" className="w-full"><Check className="mr-2 h-4 w-4" /> {status}</Button>;
    }

    return <Button onClick={() => handleApply(internship)} className="w-full">Apply Now</Button>;
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Internship Opportunities</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Find Your Next Internship</CardTitle>
          <CardDescription>Browse and apply for internships based on your profile and interests.</CardDescription>
          {/* Add filter components here in the future */}
          <div className="pt-4 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by role or company..." className="pl-8" />
              </div>
              <Button variant="outline" disabled><Filter className="mr-2 h-4 w-4" /> Filters</Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          {internships.length > 0 ? internships.map(internship => (
            <Card key={internship.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-xl">{internship.role}</CardTitle>
                        <CardDescription className="flex items-center gap-2 pt-1"><Building className="h-4 w-4"/> {internship.company}</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 flex-grow">
                <div className="text-sm text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4"/> Stipend: <span className="font-semibold text-foreground">{internship.ctc_stipend}</span></div>
                <div className="text-sm text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4"/> Duration: <span className="font-semibold text-foreground">{internship.duration}</span></div>
                <p className="text-sm text-muted-foreground pt-2">{internship.description}</p>
                <div className="pt-2">
                    <h4 className="text-xs font-semibold mb-1">SKILLS REQUIRED</h4>
                    <div className="flex flex-wrap gap-1">
                        {(internship.skills || []).map(skill => <Badge key={skill} variant="secondary">{skill}</Badge>)}
                    </div>
                </div>
                 <div className="pt-2">
                    <h4 className="text-xs font-semibold mb-1">ELIGIBILITY</h4>
                    <p className="text-sm text-muted-foreground">{internship.eligibility}</p>
                </div>
              </CardContent>
              <CardFooter>
                {getStatusButton(internship)}
              </CardFooter>
            </Card>
          )) : (
            <div className="md:col-span-2 text-center text-muted-foreground py-10">
                No open internship opportunities at the moment. Please check back later.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
