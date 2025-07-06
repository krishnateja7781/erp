
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BellRing, Circle, CheckCircle, AlertTriangle, Info, ArrowLeft, Loader2 } from "lucide-react";
import { type NotificationMessage } from '@/components/layout/notification-bell'; // Assuming type is exported
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebaseClient';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, orderBy, Timestamp } from 'firebase/firestore';


const getNotificationIcon = (type: NotificationMessage['type']) => {
  switch (type) {
    case 'alert':
      return <AlertTriangle className="h-5 w-5 text-destructive" />;
    case 'task':
      return <CheckCircle className="h-5 w-5 text-blue-500" />;
    case 'event':
      return <Info className="h-5 w-5 text-purple-500" />;
    case 'info':
    default:
      return <Info className="h-5 w-5 text-primary" />;
  }
};

export default function AllNotificationsPage() {
  const [notifications, setNotifications] = React.useState<NotificationMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const router = useRouter();
  const { toast } = useToast();

  React.useEffect(() => {
    const storedUserString = localStorage.getItem('loggedInUser');
    if (!storedUserString) {
        toast({variant: "destructive", title: "Authentication Error", description: "Please log in to see notifications."});
        setIsLoading(false);
        return;
    }

    const user = JSON.parse(storedUserString);
    if (!user || !user.uid) {
        setIsLoading(false);
        return;
    };

    const q = query(
        collection(db, "notifications"),
        where("recipientUid", "==", user.uid),
        orderBy("timestamp", "desc")
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
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching notifications:", error);
        toast({ variant: "destructive", title: "Notification Error", description: "Could not fetch notifications."})
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  const handleMarkAsRead = async (id: string) => {
     try {
        const notificationRef = doc(db, "notifications", id);
        await updateDoc(notificationRef, { read: true });
        toast({ title: "Notification Marked Read" });
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
    return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  };


  if (isLoading) {
    return <div className="p-6 text-center flex items-center justify-center h-64"><Loader2 className="mr-2 h-6 w-6 animate-spin"/>Loading notifications...</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-4xl">
      <Button variant="outline" size="icon" onClick={() => router.back()} className="mb-6" aria-label="Back">
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <BellRing className="h-6 w-6 text-primary" /> All Notifications
          </CardTitle>
          <CardDescription>
            Here are all your notifications. Keep track of important updates and tasks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length > 0 && (
             <div className="text-right mb-4">
                <Button onClick={handleMarkAllAsRead} size="sm" variant="outline" disabled={notifications.every(n => n.read)}>
                    Mark All as Read
                </Button>
            </div>
          )}
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">
              You have no notifications.
            </p>
          ) : (
            <ul className="space-y-4">
              {notifications.map(notification => (
                <li
                  key={notification.id}
                  className={cn(
                    "p-4 border rounded-lg flex items-start gap-4 transition-colors",
                    notification.read ? "bg-card hover:bg-muted/30" : "bg-primary/5 hover:bg-primary/10 border-primary/30"
                  )}
                >
                  {!notification.read && (
                    <Circle className="h-2.5 w-2.5 mt-1.5 fill-primary stroke-primary flex-shrink-0" />
                  )}
                  <div className={cn("flex-shrink-0 mt-0.5", notification.read && "ml-[calc(0.625rem+0.5rem)]")}> {/* 0.625rem is h-2.5, 0.5rem is gap */}
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">{notification.title}</h4>
                    <p className="text-sm text-muted-foreground">{notification.message}</p>
                    <p className="text-xs text-muted-foreground/80 mt-1">
                      {formatTimestamp(notification.timestamp)}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center">
                    {notification.link && (
                       <Button variant="link" size="sm" className="text-xs h-auto p-1" asChild>
                        <Link href={notification.link} onClick={() => !notification.read && handleMarkAsRead(notification.id)}>View Details</Link>
                      </Button>
                    )}
                    {!notification.read && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-auto p-1"
                        onClick={() => handleMarkAsRead(notification.id)}
                      >
                        Mark as Read
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
