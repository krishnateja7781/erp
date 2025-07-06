
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the login page immediately
    router.replace('/login');
  }, [router]);

  // Optional: Show a loading indicator while redirecting
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
       <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
   );
}
