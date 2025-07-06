
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from "@/components/ui/dialog";
import { Download, FileText, Video, Image as ImageIcon, Loader2, Eye, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { summarizeMaterial } from '@/ai/flows/summarize-material-flow';
import type { Material, Course } from '@/lib/types';
import { db } from '@/lib/firebaseClient';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

const getFileIcon = (type: Material['type']) => {
    switch (type) {
        case 'pdf': return <FileText className="h-5 w-5 text-red-500" />;
        case 'video': return <Video className="h-5 w-5 text-blue-500" />;
        case 'image': return <ImageIcon className="h-5 w-5 text-green-500" />;
        default: return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
};

type CourseWithMaterials = Course & { materials: Material[] };

export default function StudentMaterialsPage() {
    const [courses, setCourses] = React.useState<CourseWithMaterials[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isViewerOpen, setIsViewerOpen] = React.useState(false);
    const [viewerContent, setViewerContent] = React.useState<Material | null>(null);
    const [isSummaryOpen, setIsSummaryOpen] = React.useState(false);
    const [summaryContent, setSummaryContent] = React.useState('');
    const [isSummarizing, setIsSummarizing] = React.useState<string | null>(null);
    const { toast } = useToast();

    React.useEffect(() => {
        const fetchStudentData = async () => {
            setIsLoading(true);
            const userStr = localStorage.getItem('loggedInUser');
            if (!userStr) {
                toast({ variant: 'destructive', title: 'Error', description: 'Please log in to view materials.' });
                setIsLoading(false);
                return;
            }
            const user = JSON.parse(userStr);

            try {
                // Correctly query classes where the student's auth UID is in the studentUids array
                const classesQuery = query(collection(db, "classes"), where("studentUids", "array-contains", user.uid));
                const classesSnapshot = await getDocs(classesQuery);
                
                if (classesSnapshot.empty) {
                    setCourses([]);
                    setIsLoading(false);
                    return;
                }

                const enrolledClasses = classesSnapshot.docs.map(doc => ({
                    docId: doc.id,
                    ...doc.data()
                }));

                const classIds = enrolledClasses.map(c => c.docId);
                
                // Fetch all materials for those classes at once
                const materialsByClassId: Record<string, Material[]> = {};

                if (classIds.length > 0) {
                    const materialsQuery = query(collection(db, "materials"), where('classId', 'in', classIds), orderBy('uploadDate', 'desc'));
                    const materialsSnapshot = await getDocs(materialsQuery);
                    
                    materialsSnapshot.forEach(doc => {
                        const material = {
                            id: doc.id,
                            ...doc.data(),
                            uploadDate: doc.data().uploadDate.toDate().toISOString(),
                        } as Material;
                        if (!materialsByClassId[material.classId]) {
                            materialsByClassId[material.classId] = [];
                        }
                        materialsByClassId[material.classId].push(material);
                    });
                }
                
                // Combine them into the format the page expects
                const coursesWithMaterialsData: CourseWithMaterials[] = enrolledClasses.map(c => ({
                    id: c.courseId,
                    name: c.courseName,
                    description: c.description || `Materials for ${c.courseName}`,
                    program: c.program,
                    branch: c.branch,
                    semester: c.semester,
                    credits: c.credits,
                    materials: materialsByClassId[c.docId] || [],
                }));
                
                setCourses(coursesWithMaterialsData);
            } catch(e) {
                 console.error("Error fetching materials:", e);
                 toast({ variant: 'destructive', title: 'Error', description: 'Could not load materials data.' });
            } finally {
                 setIsLoading(false);
            }
        };
        fetchStudentData();
    }, [toast]);
    
    const handleView = (material: Material) => {
        if (material.type === 'pdf' || material.type === 'image' || material.type === 'video') {
            if (material.url && material.url !== '#') {
                setViewerContent(material);
                setIsViewerOpen(true);
            } else {
                 toast({ variant: 'destructive', title: 'Preview Not Available', description: `No valid URL for ${material.name}.` });
            }
        } else {
            toast({
                title: 'Preview Not Available',
                description: `The file '${material.name}' must be downloaded to be viewed.`,
            });
            handleDownload(material);
        }
    };

    const handleDownload = (material: Material) => {
        if (!material.url || material.url === '#') {
            toast({
                variant: "destructive",
                title: 'Download Not Available',
                description: `No valid URL for ${material.name}.`,
            });
            return;
        }

        toast({
            title: 'Download Started',
            description: `Downloading ${material.name}...`,
        });
        
        const link = document.createElement('a');
        link.href = material.url;
        link.setAttribute('download', material.name);
        link.setAttribute('target', '_blank'); // Fallback for some browsers
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSummarize = async (material: Material) => {
        if (material.type !== 'pdf') {
            toast({ title: 'Summarization available only for PDFs.' });
            return;
        }
        setIsSummarizing(material.id);
        try {
            // In a real application, you would use a library like pdf.js to extract text from the PDF here.
            // For this demo, we'll use placeholder text to simulate the PDF's content.
            const placeholderText = `Asymptotic notation is a set of languages that allow us to express the performance of our algorithms in relation to their input size. This is a very important tool for analyzing algorithms, as it allows us to compare the performance of different algorithms and decide which one is better for a given problem. There are three main types of asymptotic notation: Big O, Big Omega, and Big Theta. Big O notation describes the upper bound of an algorithm's running time. It gives the worst-case scenario. For example, an algorithm with a running time of O(n^2) will take at most n^2 steps to complete. Big Omega notation describes the lower bound of an algorithm's running time. It gives the best-case scenario. For example, an algorithm with a running time of Omega(n) will take at least n steps to complete. Big Theta notation describes the tight bound of an algorithm's running time. It gives both the best-case and worst-case scenarios. For example, an algorithm with a running time of Theta(n log n) will take between c1 * n log n and c2 * n log n steps to complete, for some constants c1 and c2.`;

            const result = await summarizeMaterial({ materialText: placeholderText });
            if (result && result.summary) {
                setSummaryContent(result.summary);
                setIsSummaryOpen(true);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to get a summary.' });
            }
        } catch (error) {
            console.error("Summarization error:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'An error occurred while generating the summary.' });
        } finally {
            setIsSummarizing(null);
        }
    };
    
    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" /><span>Loading Materials...</span></div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Course Materials</h1>
            <Card>
                <CardHeader>
                    <CardTitle>My Courses</CardTitle>
                    <CardDescription>Browse, download, and summarize study materials for your enrolled subjects.</CardDescription>
                </CardHeader>
                <CardContent>
                    {courses.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full" defaultValue={courses[0]?.id}>
                            {courses.map(course => (
                                <AccordionItem key={course.id} value={course.id}>
                                    <AccordionTrigger className="text-lg font-medium">
                                        {course.id} - {course.name}
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        {course.materials.length > 0 ? (
                                            <ul className="space-y-3 pt-2">
                                                {course.materials.map(material => (
                                                    <li key={material.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50">
                                                        <div className="flex items-center gap-4">
                                                            {getFileIcon(material.type)}
                                                            <div>
                                                                <p className="font-medium">{material.name}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {new Date(material.uploadDate).toLocaleDateString()} &bull; {material.size}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {material.type === 'pdf' && (
                                                                <Button variant="outline" size="sm" onClick={() => handleSummarize(material)} disabled={isSummarizing === material.id}>
                                                                    {isSummarizing === material.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                                                    Summarize
                                                                </Button>
                                                            )}
                                                            <Button variant="outline" size="sm" onClick={() => handleView(material)}>
                                                                <Eye className="mr-2 h-4 w-4" /> View
                                                            </Button>
                                                            <Button variant="ghost" size="icon" onClick={() => handleDownload(material)}>
                                                                <Download className="h-5 w-5" />
                                                                <span className="sr-only">Download</span>
                                                            </Button>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-center text-muted-foreground py-4">No materials uploaded for this course yet.</p>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">You are not enrolled in any courses with materials.</p>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
                    <DialogHeader className="p-4 border-b">
                        <DialogTitle>{viewerContent?.name || 'File Viewer'}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 p-0 overflow-auto bg-muted/30">
                        {viewerContent?.type === 'pdf' && (
                            <iframe src={viewerContent.url} className="w-full h-full border-0" title={viewerContent.name} />
                        )}
                        {viewerContent?.type === 'image' && (
                            <div className="w-full h-full flex items-center justify-center p-4">
                                <img src={viewerContent.url} alt={viewerContent.name || 'Image'} className="max-w-full max-h-full object-contain" />
                            </div>
                        )}
                        {viewerContent?.type === 'video' && (
                            <div className="w-full h-full flex items-center justify-center bg-black">
                                <video controls autoPlay src={viewerContent.url} className="max-w-full max-h-full">
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isSummaryOpen} onOpenChange={setIsSummaryOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>AI-Generated Summary</DialogTitle>
                        <DialogDescription>
                            Here are the key points from the document. This is an AI-generated summary and may not be perfect.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2 max-h-[60vh] overflow-y-auto">
                        {summaryContent.split('\n').map((line, index) => (
                            <p key={index} className="text-sm text-foreground">{line}</p>
                        ))}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button">Close</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
