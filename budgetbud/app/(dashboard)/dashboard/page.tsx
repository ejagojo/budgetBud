import { getDashboardData } from "@/lib/actions/dashboard";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const dashboardData = await getDashboardData();

  return <DashboardClient initialData={dashboardData} />;
}

