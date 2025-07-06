
'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Bell, Palette, Loader2 } from "lucide-react";
import { sendPasswordResetLink, updateNotificationPreferences, getUserSettings } from '@/actions/user-actions';

export default function SettingsPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = React.useState(true);
    const [isPasswordResetLoading, setIsPasswordResetLoading] = React.useState(false);
    const [isNotificationToggleLoading, setIsNotificationToggleLoading] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState<{ uid: string; email: string; } | null>(null);
    const [notificationEnabled, setNotificationEnabled] = React.useState(true);

    React.useEffect(() => {
        const storedUserString = localStorage.getItem('loggedInUser');
        if (storedUserString) {
            const user = JSON.parse(storedUserString);
            if (user && user.uid && user.email) {
                setCurrentUser({ uid: user.uid, email: user.email });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not identify user. Please log in again.' });
                 setIsLoading(false);
            }
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'User not logged in.' });
             setIsLoading(false);
        }
    }, [toast]);

    React.useEffect(() => {
        if (currentUser) {
            const fetchSettings = async () => {
                setIsLoading(true);
                try {
                    const result = await getUserSettings(currentUser.uid);
                    if (result.success && result.data?.notifications) {
                        setNotificationEnabled(result.data.notifications.enabled);
                    }
                } catch (e: any) {
                    console.error("Error fetching settings:", e);
                    toast({ variant: 'destructive', title: 'Error', description: 'Could not load your settings.' });
                }
                setIsLoading(false);
            };
            fetchSettings();
        }
    }, [currentUser, toast]);

    const handleChangePassword = async () => {
        if (!currentUser?.email) {
            toast({ variant: 'destructive', title: 'Error', description: 'Your email is not available.' });
            return;
        }
        setIsPasswordResetLoading(true);
        const result = await sendPasswordResetLink(currentUser.email);
        if (result.success) {
            toast({ title: 'Password Reset Email Sent', description: result.message });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsPasswordResetLoading(false);
    };

    const handleNotificationToggle = async (enabled: boolean) => {
        if (!currentUser?.uid) return;
        setIsNotificationToggleLoading(true);
        setNotificationEnabled(enabled); // Optimistic update
        try {
            const result = await updateNotificationPreferences(currentUser.uid, enabled);
            if (!result.success) {
                setNotificationEnabled(!enabled); // Revert on failure
                toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
            } else {
                 toast({ title: 'Success', description: result.message });
            }
        } catch (e: any) {
            setNotificationEnabled(!enabled); // Revert on failure
            toast({ variant: 'destructive', title: 'Error', description: "An unexpected error occurred." });
        }
        setIsNotificationToggleLoading(false);
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold">Settings</h1>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Account Security</CardTitle>
                    <CardDescription>Manage your password and account security settings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <Label htmlFor="change-password">Change Password</Label>
                            <p className="text-sm text-muted-foreground">A secure link will be sent to your registered email to reset your password.</p>
                        </div>
                        <Button
                            id="change-password"
                            variant="outline"
                            onClick={handleChangePassword}
                            disabled={isPasswordResetLoading || !currentUser}
                        >
                            {isPasswordResetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Send Reset Link
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications</CardTitle>
                    <CardDescription>Control how you receive notifications from the application.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <Label htmlFor="notifications-enabled">Enable Push Notifications</Label>
                            <p className="text-sm text-muted-foreground">Receive real-time alerts on your device. (Requires browser permission)</p>
                        </div>
                        {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Switch
                                id="notifications-enabled"
                                checked={notificationEnabled}
                                onCheckedChange={handleNotificationToggle}
                                disabled={isNotificationToggleLoading || !currentUser}
                            />
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Appearance</CardTitle>
                    <CardDescription>Customize the look and feel of the application.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                            <Label>Theme</Label>
                            <p className="text-sm text-muted-foreground">Choose between light, dark, or system default mode.</p>
                        </div>
                        <ThemeToggle />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

    