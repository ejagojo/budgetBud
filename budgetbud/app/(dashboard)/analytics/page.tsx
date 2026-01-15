import { getAnalyticsData } from '@/lib/actions/analytics'
import { AnalyticsClient } from '@/components/analytics/analytics-client'

export default async function AnalyticsPage() {
  const analyticsData = await getAnalyticsData()

  return <AnalyticsClient initialData={analyticsData} />
}
