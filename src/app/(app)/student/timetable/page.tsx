
'use client';

import * as React from 'react';
import { TimetableGrid, type ScheduleEntry } from '@/components/shared/TimetableGrid';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getStudentSchedule } from '@/actions/student-actions';

export default function StudentTimetablePage() {
    const [schedule, setSchedule] = React.useState<ScheduleEntry[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const { toast } = useToast();

    React.useEffect(() => {
        const loadSchedule = async () => {
            setIsLoading(true);
            const storedUserString = localStorage.getItem('loggedInUser');
            if (!storedUserString) {
                toast({ variant: "destructive", title: "Error", description: "Could not identify student." });
                setIsLoading(false);
                return;
            }
            try {
                const user = JSON.parse(storedUserString);
                const data = await getStudentSchedule(user.id);
                setSchedule(data);
            } catch (err: any) {
                console.error("Failed to load timetable:", err);
                toast({ variant: "destructive", title: "Error", description: "Could not load your timetable." });
            } finally {
                setIsLoading(false);
            }
        };
        loadSchedule();
    }, [toast]);
    
    const handleDownload = () => {
        toast({
            title: "Feature Not Implemented",
            description: "PDF/iCal download is not yet available.",
        });
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" /><span>Loading Timetable...</span></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
                 <h1 className="text-3xl font-bold">My Weekly Timetable</h1>
                 <Button variant="outline" onClick={handleDownload} disabled>
                    <Download className="mr-2 h-4 w-4" /> Download (WIP)
                 </Button>
            </div>
           <TimetableGrid schedule={schedule} interactive={false} />
        </div>
    );
}
