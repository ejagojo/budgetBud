import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/supabase/types'

/*
CORRECTED SQL FUNCTION FOR get_dashboard_stats:

CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  lifetime_allocations_data JSON;
  income_trends_data JSON;
  latest_paycheck_data JSON;
BEGIN
  -- Get lifetime allocations aggregated by category NAME (allows merging)
  SELECT json_agg(
    json_build_object(
      'category_id', category_id,
      'category_name', category_name,
      'category_color', category_color,
      'total_amount', total_amount
    )
  ) INTO lifetime_allocations_data
  FROM (
    SELECT
      MAX(a.category_id) as category_id,  -- Pick one ID (arbitrary)
      COALESCE(c.name, 'Archived Category') as category_name,
      MAX(COALESCE(c.color, '#6B7280')) as category_color,  -- Pick one color (arbitrary)
      SUM(a.budgeted_amount) as total_amount
    FROM public.allocations a
    LEFT JOIN public.categories c ON a.category_id = c.id
    GROUP BY c.name  -- Group by category NAME to enable merging
    ORDER BY SUM(a.budgeted_amount) DESC
  ) lifetime;

  -- Get recent paychecks for income trends (last 10)
  SELECT json_agg(
    json_build_object(
      'id', id,
      'amount', amount,
      'date', date,
      'frequency', frequency,
      'description', description
    )
  ) INTO income_trends_data
  FROM (
    SELECT id, amount, date, frequency, description
    FROM public.paychecks
    ORDER BY date DESC
    LIMIT 10
  ) trends;

  -- Get latest paycheck with allocations
  SELECT json_build_object(
    'id', p.id,
    'amount', p.amount,
    'date', p.date,
    'frequency', p.frequency,
    'description', p.description,
    'allocations', (
      SELECT json_agg(
        json_build_object(
          'category_id', a.category_id,
          'category_name', COALESCE(c.name, 'Unknown'),
          'category_color', COALESCE(c.color, '#6B7280'),
          'amount', a.budgeted_amount,
          'spent_amount', a.spent_amount,
          'percentage', CASE
            WHEN p.amount > 0 THEN (a.budgeted_amount / p.amount) * 100
            ELSE 0
          END
        )
      )
      FROM public.allocations a
      LEFT JOIN public.categories c ON a.category_id = c.id
      WHERE a.paycheck_id = p.id
    )
  ) INTO latest_paycheck_data
  FROM public.paychecks p
  ORDER BY p.date DESC
  LIMIT 1;

  -- Build final result
  result := json_build_object(
    'lifetime_allocations', COALESCE(lifetime_allocations_data, '[]'::json),
    'income_trends', COALESCE(income_trends_data, '[]'::json),
    'latest_paycheck', latest_paycheck_data
  );

  RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;
*/

type Category = Database["public"]["Tables"]["categories"]["Row"]
type Paycheck = Database["public"]["Tables"]["paychecks"]["Row"]

export interface DashboardData {
  categories: Category[]
  totalBudget: number
  totalAllocated: number
  unallocated: number
  hasBudgetVersion: boolean
  latestPaycheck?: Paycheck & {
    allocations?: Array<{
      category_id: string
      category_name: string
      category_color: string
      amount: number
      spent_amount: number
      percentage: number
    }>
  }
  recentPaychecks: Paycheck[]
  lifetimeAllocations: Array<{
    category_id: string
    category_name: string
    category_color: string
    total_amount: number
  }>
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient()

  // Get current user's categories
  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('*')
    .order('created_at', { ascending: true })

  if (categoriesError) {
    console.error('Failed to fetch categories:', categoriesError)
    // Continue with empty categories rather than crashing
  }

  // Calculate total allocated percentage
  const totalAllocated = (categories || []).reduce((sum: number, cat: any) => sum + cat.percentage, 0)

  // Call the RPC function for dashboard stats
  console.log('Server: Calling get_dashboard_stats RPC...')
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_stats')

  if (rpcError) {
    console.error('RPC Error:', JSON.stringify(rpcError, null, 2))
    console.log('Server: RPC failed, returning empty data')

    // Return empty data with categories if available
    return {
      categories: categories || [],
      totalBudget: 0,
      totalAllocated,
      unallocated: Math.max(0, 100 - totalAllocated),
      hasBudgetVersion: false,
      latestPaycheck: undefined,
      recentPaychecks: [],
      lifetimeAllocations: []
    }
  }

  console.log('Server: RPC returned data:', JSON.stringify(rpcData, null, 2))

  // Type-safe mapping of RPC JSON response
  const rpcResponse = rpcData as {
    lifetime_allocations?: Array<{
      category_id: string
      category_name: string
      category_color: string
      total_amount: number
    }>
    income_trends?: Paycheck[]
    latest_paycheck?: Paycheck & {
      allocations?: Array<{
        category_id: string
        category_name: string
        category_color: string
        amount: number
        spent_amount: number
        percentage: number
      }>
    } | null
  } | null

  // Map RPC response to our interface with safe defaults
  const lifetimeAllocations = rpcResponse?.lifetime_allocations || []
  const latestPaycheck = rpcResponse?.latest_paycheck || undefined

  // Get recent paychecks from RPC (reverse for chronological order: Oldest -> Newest)
  const recentPaychecks = (rpcResponse?.income_trends || []).reverse()

  // Calculate total budget from latest paycheck
  const totalBudget = latestPaycheck?.amount || 0
  const hasBudgetVersion = !!latestPaycheck

  console.log(`Server: Processed ${lifetimeAllocations.length} lifetime allocations, ${recentPaychecks.length} recent paychecks`)

  return {
    categories: categories || [],
    totalBudget,
    totalAllocated,
    unallocated: Math.max(0, 100 - totalAllocated),
    hasBudgetVersion,
    latestPaycheck,
    recentPaychecks,
    lifetimeAllocations
  }
}
