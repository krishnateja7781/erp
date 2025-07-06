
'use client';

import { AdminSignupForm } from "@/components/auth/admin-signup-form";

export default function AdminSignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-secondary p-4 overflow-hidden">
       <AdminSignupForm />
    </div>
  );
}
