
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { Briefcase, Building, MapPin, DollarSign, ExternalLink, Filter, Search, Check, Loader2, FileDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { getOpportunities } from '@/actions/placement-actions';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import { submitApplication } from '@/actions/placement-actions';
import type { Placement } from '@/lib/types';


type PlacementStatus = 'Not Applied' | 'Applied' | 'Under Review' | 'Shortlisted' | 'Offer Extended' | 'Offer Accepted' | 'Rejected';

export default function PlacementsPage() {
    const [placements, setPlacements] = React.useState<Placement[]>([]);
    const [applicationStatus, setApplicationStatus] = React.useState<Record<string, PlacementStatus>>({});
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
                const placementData = await getOpportunities('placement');
                setPlacements(placementData as Placement[]);
            } catch (error) {
                toast({ variant: "destructive", title: "Error", description: "Could not fetch placement opportunities." });
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
            where("opportunityType", "==", "placement")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const statuses: Record<string, PlacementStatus> = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                statuses[data.opportunityId] = data.status as PlacementStatus;
            });
            setApplicationStatus(statuses);
        });

        return () => unsubscribe();
    }, [currentUser]);


    const handleApply = async (placement: Placement) => {
        if (!currentUser) {
            toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to apply.' });
            return;
        }
        setLoadingStatus(prev => ({ ...prev, [placement.id]: true }));
        try {
            const result = await submitApplication({
                userId: currentUser.uid,
                studentId: currentUser.id,
                opportunityId: placement.id,
                opportunityType: 'placement',
                company: placement.company,
                role: placement.role
            });
            if (result.success) {
                toast({ title: 'Application Successful', description: result.message });
            } else {
                toast({ variant: 'destructive', title: 'Application Failed', description: result.error });
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setLoadingStatus(prev => ({ ...prev, [placement.id]: false }));
        }
    };
    
    const handleDownloadOffer = (company: string) => {
        toast({
            title: 'Download Offer Letter (Simulated)',
            description: `Downloading offer letter from ${company}...`,
        });
    }

    const getStatusButton = (placement: Placement) => {
        const status = applicationStatus[placement.id] || 'Not Applied';
        const isLoading = loadingStatus[placement.id] || false;

        if (isLoading) {
            return <Button disabled className="w-full"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applying...</Button>;
        }

        if (status === 'Offer Accepted') {
             return <Button onClick={() => handleDownloadOffer(placement.company)} className="w-full bg-green-600 hover:bg-green-700"><FileDown className="mr-2 h-4 w-4" /> Download Offer</Button>;
        }

        if (status !== 'Not Applied') {
            return <Button disabled variant="secondary" className="w-full"><Check className="mr-2 h-4 w-4" /> {status}</Button>;
        }
        
        return <Button onClick={() => handleApply(placement)} className="w-full">Apply Now</Button>;
    };
    
    if (isLoading) {
      return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Placement Drives</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Find Your Dream Job</CardTitle>
                    <CardDescription>Browse and apply for campus placement opportunities.</CardDescription>
                     <div className="pt-4 flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search by role, company, or location..." className="pl-8" />
                        </div>
                        <Button variant="outline" disabled><Filter className="mr-2 h-4 w-4" /> Filters</Button>
                    </div>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                    {placements.length > 0 ? placements.map(placement => (
                        <Card key={placement.id} className="flex flex-col">
                            <CardHeader>
                                 <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-xl">{placement.role}</CardTitle>
                                        <CardDescription className="flex items-center gap-2 pt-1"><Building className="h-4 w-4"/> {placement.company}</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3 flex-grow">
                                <div className="text-sm text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4"/> CTC: <span className="font-semibold text-foreground">{placement.ctc_stipend}</span></div>
                                <div className="text-sm text-muted-foreground flex items-center gap-2"><MapPin className="h-4 w-4"/> Location: <span className="font-semibold text-foreground">{placement.location}</span></div>
                                <p className="text-sm text-muted-foreground pt-2">{placement.description}</p>
                                <div className="pt-2">
                                    <h4 className="text-xs font-semibold mb-1">SKILLS REQUIRED</h4>
                                    <div className="flex flex-wrap gap-1">
                                        {(placement.skills || []).map(skill => <Badge key={skill} variant="secondary">{skill}</Badge>)}
                                    </div>
                                </div>
                                <div className="pt-2">
                                    <h4 className="text-xs font-semibold mb-1">ELIGIBILITY</h4>
                                    <p className="text-sm text-muted-foreground">{placement.eligibility}</p>
                                </div>
                            </CardContent>
                            <CardFooter>
                                {getStatusButton(placement)}
                            </CardFooter>
                        </Card>
                    )) : (
                        <div className="md:col-span-2 text-center text-muted-foreground py-10">
                            No open placement opportunities at the moment. Please check back later.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
