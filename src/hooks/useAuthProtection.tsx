
'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged, signOut, type User as FirebaseUser, sendEmailVerification } from 'firebase/auth';
import { auth, db, messaging } from '@/lib/firebaseClient';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { getToken } from 'firebase/messaging';
import { getUserProfileOnLogin } from '@/actions/user-actions';

export type AppUser = {
  name: string;
  initials: string;
  avatarUrl?: string;
  id: string; // This is the consistent, internal Firestore document ID (studentDocId or staffDocId)
  uid: string;
  role: 'student' | 'admin' | 'teacher';
};

const VAPID_KEY = "BDCP77G-ZNGJrbLjwHMIerpEQd7G7uUGDpacGMvHO0H2x0C4aPQIlZs418kjI0v0Jh_vFZsnMxrFryrBrFpcdd4";

export function useAuthProtection(expectedRole: 'student' | 'admin' | 'teacher') {
  const [currentUser, setCurrentUser] = React.useState<AppUser | null>(null);
  const [authIsLoading, setAuthIsLoading] = React.useState(true);
  const [clientMounted, setClientMounted] = React.useState(false);
  const [layoutError, setLayoutError] = React.useState<string | null>(null);
  const [showEmailVerificationPrompt, setShowEmailVerificationPrompt] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);
  const [hasSentInitialVerification, setHasSentInitialVerification] = React.useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  React.useEffect(() => {
    setClientMounted(true);
  }, []);

  const handleLogout = React.useCallback(async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('loggedInUser');
      setCurrentUser(null);
      router.push('/login');
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
    } catch (error) {
      console.error("Error signing out: ", error);
      toast({ variant: "destructive", title: "Logout Failed", description: "Could not log out." });
    }
  }, [router, toast]);
  
  const handleSendVerificationEmail = React.useCallback(async () => {
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        toast({
          title: hasSentInitialVerification ? "Verification Email Resent" : "Verification Email Sent",
          description: `A new verification link has been sent to ${auth.currentUser.email}. Please check your inbox and spam folder.`,
          duration: 6000,
        });
        if (!hasSentInitialVerification) {
          setHasSentInitialVerification(true);
        }
      } else {
        toast({ variant: "destructive", title: "Error", description: "You are not logged in." });
      }
    } catch (e: any) {
      console.error("Layout: Error sending verification email:", e);
      let message = "Could not send verification email. Please try again in a few minutes.";
      if (e.code === 'auth/too-many-requests') {
        message = "Too many requests. Please try again later.";
      }
      toast({ variant: "destructive", title: "Error", description: message });
    }
  }, [toast, hasSentInitialVerification]);
  
  const requestNotificationPermission = React.useCallback(async (userId: string) => {
    if (!messaging) return;
    if (!VAPID_KEY) {
      console.error("VAPID key is missing.");
      return;
    }
    
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
        if (currentToken) {
          const userDocRef = doc(db, "users", userId);
          await setDoc(userDocRef, { fcmToken: currentToken }, { merge: true });
        }
      }
    } catch (err) {
      console.error('An error occurred while retrieving FCM token. ', err);
    }
  }, []);

  React.useEffect(() => {
    if (!clientMounted) return;
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setLayoutError(null); 
      setShowEmailVerificationPrompt(false);
      setUserEmail(null);
      setHasSentInitialVerification(false);
      setAuthIsLoading(true);

      try {
        if (firebaseUser) {
          setUserEmail(firebaseUser.email);
          
          if (!firebaseUser.emailVerified && expectedRole === 'student') {
            setShowEmailVerificationPrompt(true);
            setAuthIsLoading(false);
            return; // Halt further processing for unverified students
          }

          const profileResult = await getUserProfileOnLogin(firebaseUser.uid, firebaseUser.email);
          if (!profileResult.success || !profileResult.data) {
            throw new Error(profileResult.error || "Failed to validate user session.");
          }

          const userProfile = profileResult.data;

          if (userProfile.role === expectedRole) {
            const appUser: AppUser = {
              uid: firebaseUser.uid,
              name: userProfile.name || 'User',
              initials: userProfile.initials || '??',
              role: expectedRole,
              avatarUrl: userProfile.avatarUrl,
              id: userProfile.id,
            };
            setCurrentUser(appUser);
            localStorage.setItem('loggedInUser', JSON.stringify(userProfile));
            
            requestNotificationPermission(firebaseUser.uid);
          } else {
            throw new Error(`Access Denied: You are logged in as a ${userProfile.role || 'user'}, but this page requires a ${expectedRole} role.`);
          }
        } else {
          localStorage.removeItem('loggedInUser');
          setCurrentUser(null);
          if (pathname !== '/login' && pathname !== '/signup' && pathname !== '/forgot-password' && pathname !== '/admin-signup') {
            router.push('/login');
          }
        }
      } catch (err: any) {
        console.error("Auth Protection Error:", err);
        setLayoutError(err.message || "An authentication error occurred. Please try logging in again.");
        await handleLogout();
      } finally {
        setAuthIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, [clientMounted, router, pathname, toast, expectedRole, requestNotificationPermission, handleLogout]);

  return {
    currentUser,
    authIsLoading,
    layoutError,
    showEmailVerificationPrompt,
    userEmail,
    handleLogout,
    handleSendVerificationEmail
  };
}
