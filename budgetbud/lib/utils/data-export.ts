import { createClient } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/types'

type PaycheckWithAllocations = Database['public']['Tables']['paychecks']['Row'] & {
  allocations: Array<{
    category_name: string
    budgeted_amount: number
    spent_amount: number
  }>
}

export interface ExportData {
  metadata: {
    exportDate: string
    exportVersion: string
    userId: string
  }
  profile: {
    display_name: string | null
    theme: string
  }
  categories: Array<{
    id: string
    name: string
    percentage: number
    color: string
    is_active: boolean
  }>
  paychecks: PaycheckWithAllocations[]
  transactions: Array<{
    id: string
    category_name: string
    amount: number
    date: string
    description: string | null
  }>
}

export async function exportUserData(): Promise<void> {
  const supabase = createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Not authenticated')
  }

  try {
    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('display_name, theme')
      .eq('id', user.id)
      .single()

    if (profileError) throw profileError

    // Type assertion for profile data
    const profileData = profile as { display_name: string | null; theme: string }

    // Fetch categories
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name, percentage, color, is_active')
      .eq('user_id', user.id)
      .order('created_at')

    if (categoriesError) throw categoriesError

    // Fetch paychecks with allocations
    const { data: paychecks, error: paychecksError } = await (supabase.rpc as any)('get_paycheck_with_allocations', {
      p_paycheck_id: null,
      p_user_id: user.id
    })

    if (paychecksError) throw paychecksError

    // Group allocations by paycheck
    const paycheckMap = new Map<string, PaycheckWithAllocations>()

    paychecks?.forEach((item: any) => {
      const paycheckId = item.paycheck_id

      if (!paycheckMap.has(paycheckId)) {
        paycheckMap.set(paycheckId, {
          id: item.paycheck_id,
          user_id: item.paycheck_user_id,
          budget_version_id: item.budget_version_id,
          amount: Number(item.amount),
          date: item.date,
          frequency: item.frequency,
          description: item.description,
          created_at: item.created_at,
          updated_at: item.updated_at,
          allocations: []
        })
      }

      paycheckMap.get(paycheckId)!.allocations.push({
        category_name: item.category_name,
        budgeted_amount: Number(item.budgeted_amount),
        spent_amount: Number(item.spent_amount)
      })
    })

    // Fetch transactions
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select(`
        id,
        amount,
        date,
        description,
        categories (
          name
        )
      `)
      .eq('user_id', user.id)
      .order('date', { ascending: false })

    if (transactionsError) throw transactionsError

    // Format export data
    const exportData: ExportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        exportVersion: '1.0',
        userId: user.id
      },
      profile: {
        display_name: profileData.display_name,
        theme: profileData.theme
      },
      categories: categories || [],
      paychecks: Array.from(paycheckMap.values()),
      transactions: ((transactions as any[]) || []).map((t: any) => ({
        id: t.id,
        category_name: (t.categories as any)?.name || 'Unknown',
        amount: Number(t.amount),
        date: t.date,
        description: t.description
      }))
    }

    // Create and download JSON file
    const dataStr = JSON.stringify(exportData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)

    const exportFileDefaultName = `budgetbud-data-${new Date().toISOString().split('T')[0]}.json`

    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()

  } catch (error) {
    console.error('Export error:', error)
    throw new Error('Failed to export data')
  }
}
