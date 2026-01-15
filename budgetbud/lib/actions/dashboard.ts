import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/supabase/types'

/*
CORRECTED SQL FUNCTION FOR get_dashboard_stats:

-- =======================================================================================
-- 🚨 CRITICAL SECURITY FIX: Row Level Security & Data Isolation
-- =======================================================================================
-- Run this entire SQL block in Supabase SQL Editor to fix data leaks

-- 1. ENABLE ROW LEVEL SECURITY ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paychecks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 2. DROP ANY EXISTING POLICIES (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own paychecks" ON public.paychecks;
DROP POLICY IF EXISTS "Users can insert own paychecks" ON public.paychecks;
DROP POLICY IF EXISTS "Users can update own paychecks" ON public.paychecks;
DROP POLICY IF EXISTS "Users can delete own paychecks" ON public.paychecks;
DROP POLICY IF EXISTS "Users can view own allocations" ON public.allocations;
DROP POLICY IF EXISTS "Users can insert own allocations" ON public.allocations;
DROP POLICY IF EXISTS "Users can update own allocations" ON public.allocations;
DROP POLICY IF EXISTS "Users can delete own allocations" ON public.allocations;
DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can view own budget_versions" ON public.budget_versions;
DROP POLICY IF EXISTS "Users can insert own budget_versions" ON public.budget_versions;
DROP POLICY IF EXISTS "Users can update own budget_versions" ON public.budget_versions;
DROP POLICY IF EXISTS "Users can delete own budget_versions" ON public.budget_versions;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;

-- 3. CREATE STRICT ROW LEVEL SECURITY POLICIES

-- PROFILES: Users can only access their own profile
CREATE POLICY "Users can view own profiles" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profiles" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- PAYCHECKS: Users can only access their own paychecks
CREATE POLICY "Users can view own paychecks" ON public.paychecks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own paychecks" ON public.paychecks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own paychecks" ON public.paychecks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own paychecks" ON public.paychecks
  FOR DELETE USING (auth.uid() = user_id);

-- ALLOCATIONS: Users can only access allocations for their paychecks
CREATE POLICY "Users can view own allocations" ON public.allocations
  FOR SELECT USING (
    paycheck_id IN (
      SELECT id FROM public.paychecks WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own allocations" ON public.allocations
  FOR INSERT WITH CHECK (
    paycheck_id IN (
      SELECT id FROM public.paychecks WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own allocations" ON public.allocations
  FOR UPDATE USING (
    paycheck_id IN (
      SELECT id FROM public.paychecks WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own allocations" ON public.allocations
  FOR DELETE USING (
    paycheck_id IN (
      SELECT id FROM public.paychecks WHERE user_id = auth.uid()
    )
  );

-- CATEGORIES: Users can only access their own categories
CREATE POLICY "Users can view own categories" ON public.categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" ON public.categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" ON public.categories
  FOR DELETE USING (auth.uid() = user_id);

-- BUDGET VERSIONS: Users can only access their own budget versions
CREATE POLICY "Users can view own budget_versions" ON public.budget_versions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budget_versions" ON public.budget_versions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budget_versions" ON public.budget_versions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own budget_versions" ON public.budget_versions
  FOR DELETE USING (auth.uid() = user_id);

-- TRANSACTIONS: Users can only access their own transactions
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id);

-- 4. SECURE THE RPC FUNCTION WITH EXPLICIT USER ID PARAMETER
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  lifetime_allocations_data JSON;
  income_trends_data JSON;
  latest_paycheck_data JSON;
BEGIN
  -- CRITICAL: Exit if no user ID provided
  IF p_user_id IS NULL THEN
    RETURN json_build_object('error', 'No user ID provided');
  END IF;

  -- Get lifetime allocations aggregated by category NAME (allows merging)
  -- ONLY for current user's paychecks and categories
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
      MAX(a.category_id) as category_id,
      COALESCE(c.name, 'Archived Category') as category_name,
      MAX(COALESCE(c.color, '#6B7280')) as category_color,
      SUM(a.budgeted_amount) as total_amount
    FROM public.allocations a
    INNER JOIN public.paychecks p ON a.paycheck_id = p.id AND p.user_id = p_user_id
    LEFT JOIN public.categories c ON a.category_id = c.id AND c.user_id = p_user_id
    GROUP BY c.name
    ORDER BY SUM(a.budgeted_amount) DESC
  ) lifetime;

  -- Get recent paychecks for income trends (last 10)
  -- ONLY for current user
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
    WHERE user_id = p_user_id
    ORDER BY date DESC
    LIMIT 10
  ) trends;

  -- Get latest paycheck with allocations
  -- ONLY for current user
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
      LEFT JOIN public.categories c ON a.category_id = c.id AND c.user_id = p_user_id
      WHERE a.paycheck_id = p.id
    )
  ) INTO latest_paycheck_data
  FROM public.paychecks p
  WHERE p.user_id = p_user_id
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

-- Grant permissions to authenticated users only
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;

-- =======================================================================================
-- VERIFICATION: Run these queries to check RLS is working
-- =======================================================================================

-- Check RLS is enabled on all tables:
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('profiles', 'paychecks', 'allocations', 'categories', 'budget_versions', 'transactions');

-- Check policies exist:
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- Test with a specific user ID (replace with actual UUID):
-- SELECT get_dashboard_stats(); -- Should only return data for authenticated user
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

  // Get current user for explicit user ID passing
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    console.error('Authentication error:', userError)
    // Return empty data if not authenticated
    return {
      categories: [],
      totalBudget: 0,
      totalAllocated: 0,
      unallocated: 100,
      hasBudgetVersion: false,
      latestPaycheck: undefined,
      recentPaychecks: [],
      lifetimeAllocations: []
    }
  }

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

  // Call the RPC function for dashboard stats with explicit user ID
  console.log('Server: Calling get_dashboard_stats RPC with user ID:', user.id)
  const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('get_dashboard_stats', {
    p_user_id: user.id
  })

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
