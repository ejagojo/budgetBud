import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/supabase/types'

type Category = Database["public"]["Tables"]["categories"]["Row"]

export interface DashboardData {
  categories: Category[]
  totalBudget: number
  totalAllocated: number
  unallocated: number
  hasBudgetVersion: boolean
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient()

  // Get current user's categories
  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('*')
    .order('created_at', { ascending: true })

  if (categoriesError) {
    throw new Error('Failed to fetch categories')
  }

  // Calculate total allocated percentage
  const totalAllocated = categories.reduce((sum, cat) => sum + cat.percentage, 0)

  // Get current budget version (latest paycheck)
  const { data: budgetVersion, error: budgetError } = await supabase
    .from('paychecks')
    .select('amount')
    .order('date', { ascending: false })
    .limit(1)
    .single()

  // For now, use a default budget if no paychecks exist
  const totalBudget = budgetVersion?.amount || 0
  const hasBudgetVersion = !!budgetVersion

  return {
    categories: categories || [],
    totalBudget,
    totalAllocated,
    unallocated: Math.max(0, 100 - totalAllocated),
    hasBudgetVersion
  }
}
