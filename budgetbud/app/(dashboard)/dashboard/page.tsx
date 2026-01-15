import { getDashboardData } from "@/lib/actions/dashboard";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const dashboardData = await getDashboardData();

  // Debug logging to help troubleshoot cache issues
  console.log('Dashboard Page Data:', {
    hasPaycheck: !!dashboardData.latestPaycheck,
    paycheckCount: dashboardData.recentPaychecks?.length || 0,
    totalBudget: dashboardData.totalBudget,
    timestamp: new Date().toISOString()
  });

  return <DashboardClient initialData={dashboardData} />;
}


