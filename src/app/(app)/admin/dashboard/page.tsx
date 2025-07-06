
'use client';

import * as React from 'react';
import { getAdminDashboardData, type AdminDashboardData } from '@/actions/dashboard-actions';
import { AdminDashboardClient } from '@/components/admin/dashboard/admin-dashboard-client';
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from '@/components/ui/button';

export default function AdminDashboardPage() {
    const [dashboardData, setDashboardData] = React.useState<AdminDashboardData | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getAdminDashboardData();
            setDashboardData(data);
        } catch (err: any) {
            console.error("Failed to load dashboard data:", err);
            setError("Could not load your dashboard data. Please try refreshing.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Loading Dashboard...</span>
            </div>
        );
    }

    if (error || !dashboardData) {
        return (
            <div className="text-center text-destructive py-10">
                <AlertTriangle className="mx-auto h-12 w-12" />
                <h2 className="mt-4 text-lg font-semibold">Failed to Load Data</h2>
                <p className="text-sm">{error || "Dashboard data could not be loaded."}</p>
                <Button onClick={loadData} className="mt-4" variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                </Button>
            </div>
        );
    }

    return <AdminDashboardClient initialData={dashboardData} />;
}
