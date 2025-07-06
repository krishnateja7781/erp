
'use client';

import * as React from 'react';
import { Bell, Circle, CheckCircle, AlertTriangle, Info, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebaseClient';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, orderBy, limit } from 'firebase/firestore';

export interface NotificationMessage {
  id: string;
  title: string;
  message: string;
  timestamp: string; // ISO string
  read: boolean;
  type: 'alert' | 'task' | 'info' | 'event';
  link?: string;
}

const getNotificationIcon = (type: NotificationMessage['type']) => {
  switch (type) {
    case 'alert':
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    case 'task':
      return <CheckCircle className="h-4 w-4 text-blue-500" />;
    case 'event':
      return <Info className="h-4 w-4 text-purple-500" />;
    case 'info':
    default:
      return <Info className="h-4 w-4 text-primary" />;
  }
};

export function NotificationBell() {
  const [notifications, setNotifications] = React.useState<NotificationMessage[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    const storedUserString = localStorage.getItem('loggedInUser');
    if (!storedUserString) return;

    const user = JSON.parse(storedUserString);
    if (!user || !user.uid) return;

    const q = query(
        collection(db, "notifications"),
        where("recipientUid", "==", user.uid),
        orderBy("timestamp", "desc"),
        limit(20) // Limit to recent 20 notifications for performance in the popover
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedNotifications: NotificationMessage[] = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            fetchedNotifications.push({
                id: doc.id,
                title: data.title,
                message: data.message,
                read: data.read,
                timestamp: data.timestamp.toDate().toISOString(),
                type: data.type,
                link: data.link
            });
        });
        setNotifications(fetchedNotifications);
    }, (error) => {
        console.error("Error fetching notifications:", error);
        toast({ variant: "destructive", title: "Notification Error", description: "Could not fetch notifications."})
    });

    return () => unsubscribe();
  }, [toast]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    try {
        const notificationRef = doc(db, "notifications", id);
        await updateDoc(notificationRef, { read: true });
    } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Could not mark notification as read." });
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.read);
    if (unreadNotifications.length === 0) return;

    const batch = writeBatch(db);
    unreadNotifications.forEach(n => {
        const docRef = doc(db, "notifications", n.id);
        batch.update(docRef, { read: true });
    });

    try {
        await batch.commit();
        toast({ title: "All Read", description: "All notifications marked as read." });
    } catch (error) {
         toast({ variant: "destructive", title: "Error", description: "Could not mark all notifications as read." });
    }
  };
  
  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.round(diffMs / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);

    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Open notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="text-sm font-medium">Notifications</h3>
          {notifications.length > 0 && (
            <Button variant="link" size="sm" className="text-xs h-auto p-0" onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
              Mark all as read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-sm text-center text-muted-foreground flex flex-col items-center justify-center h-full">
                <BellRing className="w-8 h-8 text-muted-foreground/50 mb-2"/>
                <p>No new notifications.</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 hover:bg-accent/50",
                    !notification.read && "bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!notification.read && (
                      <Circle className="h-2 w-2 mt-1.5 fill-primary stroke-primary flex-shrink-0" />
                    )}
                    <div className={cn("flex-shrink-0 mt-1", notification.read && "ml-4")}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium leading-none">{notification.title}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {notification.message}
                      </p>
                       <p className="text-xs text-muted-foreground/80 mt-0.5">
                        {formatTimestamp(notification.timestamp)}
                      </p>
                    </div>
                    {notification.link ? (
                      <Link href={notification.link} onClick={() => {
                        if (!notification.read) handleMarkAsRead(notification.id);
                        setIsOpen(false); // Close popover on link click
                      }}>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs h-auto p-1"
                        >
                          View
                        </Button>
                      </Link>
                    ) : (
                      !notification.read && (
                        <Button variant="ghost" size="sm" className="text-xs h-auto p-1" onClick={() => handleMarkAsRead(notification.id)}>
                          Mark read
                        </Button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="p-2 border-t text-center">
           <Link href="/notifications" onClick={() => setIsOpen(false)}>
            <Button variant="link" size="sm" className="text-xs w-full">
                View all notifications
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
