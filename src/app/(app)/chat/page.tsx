
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, MessageSquare, Users, ArrowRight, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getChatRoomsForUser } from '@/actions/chat-actions';
import type { ChatRoom } from '@/lib/types';


// Main Chat Lobby Component
export default function ChatLobbyPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [myChatRooms, setMyChatRooms] = React.useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [currentUser, setCurrentUser] = React.useState<{uid: string, role: 'admin' | 'teacher' | 'student'} | null>(null);
  const [canGoBack, setCanGoBack] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
        setCanGoBack(true);
    }
  }, []);


  React.useEffect(() => {
    const storedUserString = localStorage.getItem('loggedInUser');
    if (storedUserString) {
      const user = JSON.parse(storedUserString);
      if (user.uid && user.role) {
        setCurrentUser({ uid: user.uid, role: user.role });
      } else {
        toast({ variant: 'destructive', title: 'Authentication Error', description: 'Could not find user information.' });
        setIsLoading(false);
      }
    } else {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'User not logged in.' });
      setIsLoading(false);
    }
  }, [toast]);
  
  React.useEffect(() => {
    if (currentUser) {
        const fetchRooms = async () => {
            setIsLoading(true);
            try {
                const rooms = await getChatRoomsForUser(currentUser.uid, currentUser.role);
                setMyChatRooms(rooms);
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch your chat rooms.' });
                console.error("Error fetching chat rooms:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchRooms();
    }
  }, [currentUser, toast]);


  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
        <span>Loading your chat rooms...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2"><MessageSquare className="h-6 w-6 text-primary"/> Chat Lobby</CardTitle>
                    <CardDescription>Select a chat room to join the conversation.</CardDescription>
                </div>
                {canGoBack && 
                    <Button variant="outline" size="icon" onClick={() => router.back()} aria-label="Back">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                }
            </CardHeader>
            <CardContent>
                {myChatRooms.length > 0 ? (
                    <div className="space-y-3">
                        {myChatRooms.map(room => (
                            <Link href={`/chat/${room.id}`} key={room.id} passHref>
                                <div className="p-4 border rounded-lg hover:bg-accent hover:border-primary transition-colors cursor-pointer flex justify-between items-center">
                                    <div>
                                        <h3 className="font-semibold">{room.name}</h3>
                                        <p className="text-sm text-muted-foreground">{room.description}</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center text-sm text-muted-foreground">
                                            <Users className="mr-1.5 h-4 w-4" />
                                            {room.participantUids.length}
                                        </div>
                                        <ArrowRight className="h-5 w-5 text-muted-foreground"/>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground p-8">
                        You are not a member of any chat rooms yet.
                    </div>
                )}
            </CardContent>
       </Card>
    </div>
  );
}
