
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, LogIn } from "lucide-react";
import { Separator } from '@/components/ui/separator';

import { auth } from '@/lib/firebaseClient';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getUserProfileOnLogin } from "@/actions/user-actions";

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(1, { message: "Password is required" }),
});

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        // Client authenticates, then calls a secure server action to get the profile.
        const profileResult = await getUserProfileOnLogin(firebaseUser.uid, firebaseUser.email);
        
        if (!profileResult.success || !profileResult.data) {
            throw new Error(profileResult.error || "Failed to retrieve user profile from server.");
        }
        
        const userProfile = profileResult.data;
        
        localStorage.setItem('loggedInUser', JSON.stringify(userProfile));

        toast({
          title: "Login Successful",
          description: `Welcome back, ${userProfile.name || values.email}! Redirecting...`,
        });

        if (userProfile.role === 'admin') {
          router.push('/admin/dashboard');
        } else if (userProfile.role === 'teacher') {
          router.push('/teacher/dashboard');
        } else if (userProfile.role === 'student') {
          router.push('/student/dashboard');
        } else {
          throw new Error("User role not found or invalid.");
        }
      }
    } catch (error: any) {
      await auth.signOut().catch(() => {});
      let userMessage = "An unexpected error occurred. Please try again.";

      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        userMessage = "The email or password you entered is incorrect. Please check your credentials and try again.";
      } else {
        // Show the specific error from our server action or other sources
        userMessage = error.message;
        console.error("Login attempt failed:", error.message);
      }
      
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: userMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-primary">EduSphere Connect</CardTitle>
        <CardDescription>Login to access your portal</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Enter your email address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Enter your password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="text-right text-sm">
              <Link href="/forgot-password" className="text-primary hover:underline">
                Forgot Password?
              </Link>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Login
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col gap-4 text-center text-sm">
        <div>
          <p className="text-muted-foreground">
            Student?&nbsp;
            <Link href="/signup" className="text-primary hover:underline font-medium">
              Sign Up Here
            </Link>
          </p>
        </div>
        <div className="w-full">
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                    Or
                    </span>
                </div>
            </div>
             <div className="mt-4 text-center">
                 <Link href="/admin-signup" className="text-xs text-muted-foreground hover:text-primary hover:underline">
                    Register as Admin
                </Link>
             </div>
        </div>
      </CardFooter>
    </Card>
  );
}
