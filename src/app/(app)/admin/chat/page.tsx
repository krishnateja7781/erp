
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, RefreshCw, MessageSquarePlus, Eye } from "lucide-react";
import { getClassesForChatManagement, createChatRoomForClass } from '@/actions/chat-actions';
import type { ClassForChatManagement } from '@/actions/chat-actions';
import type { ChatRoom } from '@/lib/types';
import { getChatRoomsForUser } from '@/actions/chat-actions';
import Link from 'next/link';

export default function AdminChatManagementPage() {
    const { toast } = useToast();
    const [classes, setClasses] = React.useState<ClassForChatManagement[]>([]);
    const [chatRooms, setChatRooms] = React.useState<ChatRoom[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isCreating, setIsCreating] = React.useState<string | null>(null);

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        const storedUserString = localStorage.getItem('loggedInUser');
        if (!storedUserString) {
            toast({ variant: 'destructive', title: 'Error', description: 'Admin user session not found.' });
            setIsLoading(false);
            return;
        }
        const user = JSON.parse(storedUserString);

        try {
            const [fetchedClasses, fetchedChats] = await Promise.all([
                getClassesForChatManagement(),
                getChatRoomsForUser(user.uid, 'admin') 
            ]);
            setClasses(fetchedClasses);
            setChatRooms(fetchedChats);
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: "Failed to load necessary data." });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCreateChat = async (classId: string) => {
        setIsCreating(classId);
        const result = await createChatRoomForClass(classId);
        if (result.success) {
            toast({ title: "Success", description: result.message });
            // Refresh data to show new chat room status
            await loadData();
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
        setIsCreating(null);
    };

    const existingChatClassIds = new Set(chatRooms.map(room => room.id));

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
                <span>Loading Classes...</span>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h1 className="text-3xl font-bold">Chat Room Management</h1>
                 <Button variant="outline" onClick={loadData} disabled={isLoading}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Refresh Data
                 </Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Class List</CardTitle>
                    <CardDescription>
                        Create official chat rooms for each class section. Teachers and students will be automatically added.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Class Name</TableHead>
                                <TableHead>Teacher</TableHead>
                                <TableHead className="text-center">Students</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {classes.length > 0 ? classes.map(cls => {
                                const chatExists = existingChatClassIds.has(cls.id);
                                return (
                                    <TableRow key={cls.id}>
                                        <TableCell className="font-medium">{cls.name}</TableCell>
                                        <TableCell>{cls.teacherName}</TableCell>
                                        <TableCell className="text-center">{cls.studentCount}</TableCell>
                                        <TableCell className="text-right">
                                            {chatExists ? (
                                                <Button variant="outline" size="sm" asChild>
                                                    <Link href={`/chat/${cls.id}`}>
                                                        <Eye className="mr-2 h-4 w-4"/> View Chat
                                                    </Link>
                                                </Button>
                                            ) : (
                                                <Button 
                                                    size="sm"
                                                    onClick={() => handleCreateChat(cls.id)}
                                                    disabled={isCreating === cls.id}
                                                >
                                                    {isCreating === cls.id ? (
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                                    ) : (
                                                        <MessageSquarePlus className="mr-2 h-4 w-4"/>
                                                    )}
                                                    Create Chat Room
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            }) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                        No classes found. Add classes in the student management section first.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
