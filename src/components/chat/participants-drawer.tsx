
'use client';

import * as React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import type { ChatRoom } from '@/lib/types';


export type Participant = {
    uid: string;
    name: string;
    role: 'admin' | 'teacher' | 'student';
    initials: string;
    avatarUrl?: string;
};

interface ParticipantsDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  roomName: string;
  participants: Participant[];
}

const getRoleBadge = (role: string) => {
    switch (role) {
        case 'admin': return <Badge variant="destructive">Admin</Badge>;
        case 'teacher': return <Badge variant="secondary">Teacher</Badge>;
        case 'student':
        default: return <Badge variant="outline">Student</Badge>;
    }
}


export function ParticipantsDrawer({ isOpen, onOpenChange, roomName, participants }: ParticipantsDrawerProps) {
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        if(isOpen && participants.length > 0) {
            setIsLoading(false);
        } else if (isOpen) {
            setIsLoading(true);
        }
    }, [isOpen, participants]);


    const sortedParticipants = React.useMemo(() => {
        return [...participants].sort((a, b) => {
            const roleOrder = { admin: 0, teacher: 1, student: 2 };
            if (roleOrder[a.role] !== roleOrder[b.role]) {
                return roleOrder[a.role] - roleOrder[b.role];
            }
            return a.name.localeCompare(b.name);
        });
    }, [participants]);

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="flex flex-col">
                <SheetHeader>
                    <SheetTitle>{roomName} - Members</SheetTitle>
                    <SheetDescription>
                        {participants.length} members are in this chat room.
                    </SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto pr-4 -mr-4 mt-4">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="space-y-4">
                             {sortedParticipants.map(user => (
                                <div key={user.uid} className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-9 w-9">
                                            <AvatarImage src={user.avatarUrl} alt={user.name}/>
                                            <AvatarFallback>{user.initials}</AvatarFallback>
                                        </Avatar>
                                        <span className="font-medium text-sm">{user.name}</span>
                                    </div>
                                    {getRoleBadge(user.role)}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
