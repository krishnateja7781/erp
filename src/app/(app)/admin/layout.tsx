
'use client';

import * as React from 'react';
import { AppLayout } from "@/components/layout/app-layout";
import { Loader2, PlusCircle } from "lucide-react"; 
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuthProtection } from '@/hooks/useAuthProtection';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  
  const {
    currentUser,
    authIsLoading,
    layoutError,
    showEmailVerificationPrompt,
    userEmail,
    handleLogout,
    handleSendVerificationEmail
  } = useAuthProtection('admin');

  let pageHeaderActions: React.ReactNode = null;
  // Conditionally create the header button based on the current page
  if (pathname === '/admin/students') {
    pageHeaderActions = (
      <Button onClick={() => router.push('/admin/students?action=add')}>
        <PlusCircle /> Add New Student
      </Button>
    );
  } else if (pathname === '/admin/teachers') {
      pageHeaderActions = (
      <Button onClick={() => router.push('/admin/teachers?action=add')}>
        <PlusCircle /> Add New Staff
      </Button>
    );
  }


  if (authIsLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading Admin Area...</span>
      </div>
    );
  }

  if (layoutError) { 
    return (
      <div className="flex h-screen w-full items-center justify-center text-center p-4">
        <div>
          <h2 className="text-xl font-semibold text-destructive mb-2">Access Error</h2>
          <p className="text-destructive">{layoutError}</p>
          <Button onClick={() => router.push('/login')} className="mt-4">Go to Login</Button>
        </div>
      </div>
    );
  }
  
  if (showEmailVerificationPrompt) {
    return (
      <div className="flex flex-col h-screen w-full items-center justify-center p-4 text-center">
        <h1 className="text-2xl font-semibold mb-4">Please Verify Your Email</h1>
        <p className="mb-4 text-muted-foreground">
          To activate your account, please verify your email address: <strong className="text-primary">{userEmail}</strong>.
          <br />
          If you don't receive the email, please check your spam folder.
        </p>
        <div className="flex gap-4">
            <Button onClick={handleSendVerificationEmail}>Resend Verification Email</Button>
            <Button variant="outline" onClick={handleLogout}>Logout</Button>
        </div>
      </div>
    );
  }
  
  if (!currentUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Session not found or invalid. Redirecting...</span>
      </div>
    ); 
  }

  return (
    <AppLayout
        role={currentUser.role}
        user={{ name: currentUser.name, initials: currentUser.initials, avatarUrl: currentUser.avatarUrl, id: currentUser.id }}
        onLogout={handleLogout}
        pageHeaderActions={pageHeaderActions}
      >
        {children}
      </AppLayout>
  );
}
