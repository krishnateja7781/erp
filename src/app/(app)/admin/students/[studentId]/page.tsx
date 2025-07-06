
import { getStudentProfileDetails } from '@/actions/student-actions';
import { StudentProfileClientPage } from '@/components/admin/students/student-profile-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface AdminStudentDetailPageProps {
  params: { studentId: string; };
}

export const revalidate = 0; // Disable caching for this dynamic page

export default async function AdminStudentDetailPage({ params }: AdminStudentDetailPageProps) {
    const studentData = await getStudentProfileDetails(params.studentId);

    if (!studentData) {
        return (
            <div className="flex justify-center items-center h-full p-4">
                <Alert variant="destructive" className="w-full max-w-md">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Student Not Found</AlertTitle>
                    <AlertDescription>
                        A student profile with the ID <span className="font-mono bg-destructive/20 px-1 py-0.5 rounded">{params.studentId}</span> could not be found.
                        It may have been deleted or the link is incorrect.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return <StudentProfileClientPage initialStudentData={studentData} />;
}
