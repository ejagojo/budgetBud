'use server'

import { createClient } from '@/lib/supabase/server' // Use the helper we fixed!
import { Database } from '@/lib/supabase/types'

export interface CategorySpending {
  categoryId: string
  categoryName: string
  categoryColor: string
  spent: number
  budgeted: number
  percentage: number
}

export interface AnalyticsData {
  spendingByCategory: CategorySpending[]
  totalSpent: number
  totalBudgeted: number
  categoriesCount: number
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  // 1. Use the shared helper (don't forget await!)
  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Not authenticated')
  }

  // Use the RPC function we created for fast analytics
  const { data: analyticsData, error } = await supabase
    .rpc('get_analytics_data', { p_user_id: user.id })

  if (error) {
    console.error('Analytics RPC error:', error)
    return {
      spendingByCategory: [],
      totalSpent: 0,
      totalBudgeted: 0,
      categoriesCount: 0,
    }
  }

  // Transform the raw data
  const spendingByCategory = (analyticsData || []).map(item => ({
    categoryId: item.category_id,
    categoryName: item.category_name,
    categoryColor: item.category_color,
    spent: Number(item.spent_amount),
    budgeted: Number(item.budgeted_percentage),
    percentage: Number(item.budgeted_percentage),
  }))

  const totalSpent = spendingByCategory.reduce((sum, cat) => sum + cat.spent, 0)
  const totalBudgeted = spendingByCategory.reduce((sum, cat) => sum + cat.budgeted, 0)

  return {
    spendingByCategory,
    totalSpent,
    totalBudgeted,
    categoriesCount: spendingByCategory.length,
  }
}