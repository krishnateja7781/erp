'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { getStudentProfileForTeacher } from '@/actions/student-actions';
import type { FullStudentData } from '@/actions/student-actions';
import { StudentProfileView } from '@/components/teacher/student-profile-view';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function TeacherStudentProfilePage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();

    const [studentData, setStudentData] = React.useState<FullStudentData | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const loadData = async () => {
            const studentId = params.studentId as string;
            const storedUserString = localStorage.getItem('loggedInUser');

            if (!storedUserString) {
                setError("Could not identify teacher. Please log in again.");
                setIsLoading(false);
                return;
            }

            const teacher = JSON.parse(storedUserString);
            if (!teacher?.uid) {
                setError("Teacher authentication details are missing.");
                setIsLoading(false);
                return;
            }

            try {
                const result = await getStudentProfileForTeacher(studentId, teacher.uid);
                if (result.data) {
                    setStudentData(result.data);
                } else {
                    setError(result.error || "Failed to load student profile.");
                }
            } catch (err: any) {
                setError("An unexpected error occurred.");
            } finally {
                setIsLoading(false);
            }
        };

        if(params.studentId) {
            loadData();
        }

    }, [params.studentId, toast]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="mr-2 h-8 w-8 animate-spin"/>Loading student profile...</div>;
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4 gap-4">
                <Alert variant="destructive" className="w-full max-w-md">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Access Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button variant="outline" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                </Button>
            </div>
        );
    }
    
    if (!studentData) {
        return <div className="text-center text-muted-foreground py-10">Student data could not be loaded.</div>;
    }

    return (
        <div className="space-y-6">
             <div className="flex items-center justify-between">
                <Button variant="outline" size="icon" onClick={() => router.back()} aria-label="Back">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                 <h1 className="text-xl font-bold text-right">Viewing Student Profile</h1>
            </div>
            <StudentProfileView studentData={studentData} />
        </div>
    );
}
