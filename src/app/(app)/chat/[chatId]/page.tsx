
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebaseClient';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, getDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2, ArrowLeft, Users } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { ParticipantsDrawer, type Participant } from '@/components/chat/participants-drawer';
import { getChatParticipants } from '@/actions/chat-actions';
import type { ChatRoom } from '@/lib/types';


interface Message {
  id: string;
  text: string;
  senderUid: string;
  senderName: string;
  senderInitials: string;
  senderAvatarUrl?: string;
  timestamp: Timestamp | null;
}

interface CurrentUser {
  uid: string;
  name: string;
  initials: string;
  avatarUrl?: string;
  role: 'student' | 'teacher' | 'admin';
}

// Main Chat Room Component
export default function ChatRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const chatId = params.chatId as string;

  const [messages, setMessages] = React.useState<Message[]>([]);
  const [newMessage, setNewMessage] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSending, setIsSending] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState<CurrentUser | null>(null);
  const [chatRoom, setChatRoom] = React.useState<ChatRoom | null>(null);
  const [participants, setParticipants] = React.useState<Participant[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const storedUserString = localStorage.getItem('loggedInUser');
    if (storedUserString) {
      try {
        const user = JSON.parse(storedUserString);
        setCurrentUser({
          uid: user.uid,
          name: user.name,
          initials: user.initials,
          avatarUrl: user.avatarUrl,
          role: user.role,
        });
      } catch (e) {
        toast({ variant: 'destructive', title: 'Authentication Error', description: 'Could not parse user data. Please log in again.' });
      }
    } else {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'User not found. Please log in.' });
    }
  }, [toast]);
  
  React.useEffect(() => {
     if(!chatId) return;

     const fetchRoomData = async () => {
         const roomDocRef = doc(db, 'chats', chatId);
         const roomSnap = await getDoc(roomDocRef);
         if(roomSnap.exists()){
             const roomData = {id: roomSnap.id, ...roomSnap.data()} as ChatRoom;
             setChatRoom(roomData);
         } else {
             setChatRoom(null);
             toast({variant: 'destructive', title: 'Chat Not Found', description: 'This chat room may not exist or has been deleted.'})
         }
     };
     fetchRoomData();
  }, [chatId, toast]);

  React.useEffect(() => {
    if (!chatId || !currentUser || !chatRoom) return;

    const isParticipant = chatRoom.participantUids.includes(currentUser.uid);
    const isAdmin = currentUser.role === 'admin';
    if (!isParticipant && !isAdmin) {
        toast({ variant: 'destructive', title: 'Access Denied', description: 'You are not a member of this chat room.' });
        router.push('/chat');
        return;
    }

    const messagesCollectionRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesCollectionRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedMessages: Message[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        fetchedMessages.push({
          id: doc.id,
          text: data.text,
          senderUid: data.senderUid,
          senderName: data.senderName,
          senderInitials: data.senderInitials,
          senderAvatarUrl: data.senderAvatarUrl,
          timestamp: data.timestamp as Timestamp,
        });
      });
      setMessages(fetchedMessages);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching messages: ", error);
      toast({ variant: "destructive", title: "Error", description: "Could not load messages." });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [chatId, toast, currentUser, chatRoom, router]);

  React.useEffect(() => {
    if(isDrawerOpen && chatRoom) {
      const fetchParticipants = async () => {
        const participantDetails = await getChatParticipants(chatRoom.participantUids);
        setParticipants(participantDetails);
      }
      fetchParticipants();
    }
  }, [isDrawerOpen, chatRoom]);
  
  React.useEffect(() => {
    if (scrollAreaRef.current) {
      setTimeout(() => {
        const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }, 100);
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() === '' || !currentUser) return;
    setIsSending(true);

    try {
      const messagesCollectionRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesCollectionRef, {
        text: newMessage,
        senderUid: currentUser.uid,
        senderName: currentUser.name,
        senderInitials: currentUser.initials,
        senderAvatarUrl: currentUser.avatarUrl || null,
        timestamp: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message: ", error);
      toast({ variant: "destructive", title: "Error", description: "Could not send message." });
    } finally {
      setIsSending(false);
    }
  };
  
  if (!chatRoom && !isLoading) {
    return (
        <div className="flex flex-col items-center justify-center h-full">
            <CardTitle>Chat Not Found</CardTitle>
            <CardDescription>This chat room does not exist or you do not have permission to view it.</CardDescription>
            <Button onClick={() => router.back()} variant="link" className="mt-4">
                <ArrowLeft className="mr-2 h-4 w-4"/>
                Go Back
            </Button>
        </div>
    )
  }

  return (
    <>
      <div className="flex h-[calc(100vh-120px)] flex-col">
        <Card className="flex flex-1 flex-col">
          <CardHeader className="flex-row items-center justify-between border-b">
            <div className="flex items-center gap-2">
                 <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
                     <ArrowLeft className="h-5 w-5"/>
                 </Button>
                 <div>
                    <CardTitle>{chatRoom?.name || 'Loading Chat...'}</CardTitle>
                    <CardDescription>{chatRoom?.description || '...'}</CardDescription>
                 </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsDrawerOpen(true)}>
                <Users className="mr-2 h-4 w-4"/>
                Participants
            </Button>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full" ref={scrollAreaRef}>
              <div className="p-4 space-y-4">
                {isLoading ? (
                  <div className="flex justify-center items-center h-full pt-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-muted-foreground p-8">No messages yet. Be the first to start a conversation!</div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className={cn("flex items-end gap-2", msg.senderUid === currentUser?.uid ? "justify-end" : "justify-start")}>
                      {msg.senderUid !== currentUser?.uid && (
                        <Avatar className="h-8 w-8"><AvatarImage src={msg.senderAvatarUrl} alt={msg.senderName} /><AvatarFallback>{msg.senderInitials}</AvatarFallback></Avatar>
                      )}
                      <div className={cn("max-w-xs md:max-w-md lg:max-w-lg rounded-lg px-3 py-2", msg.senderUid === currentUser?.uid ? "bg-primary text-primary-foreground" : "bg-muted")}>
                        <p className="text-sm font-semibold">{msg.senderName}</p>
                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        <p className="text-xs opacity-70 mt-1 text-right">{msg.timestamp ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}</p>
                      </div>
                      {msg.senderUid === currentUser?.uid && (
                        <Avatar className="h-8 w-8"><AvatarImage src={msg.senderAvatarUrl} alt={msg.senderName} /><AvatarFallback>{msg.senderInitials}</AvatarFallback></Avatar>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
          <div className="p-4 border-t">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." disabled={isSending || !currentUser} autoComplete="off" />
              <Button type="submit" disabled={isSending || !newMessage.trim() || !currentUser}><Send className="h-4 w-4" /><span className="sr-only">Send</span></Button>
            </form>
          </div>
        </Card>
      </div>
      
      {chatRoom && (
         <ParticipantsDrawer
            isOpen={isDrawerOpen}
            onOpenChange={setIsDrawerOpen}
            roomName={chatRoom.name}
            participants={participants}
          />
      )}
    </>
  );
}
