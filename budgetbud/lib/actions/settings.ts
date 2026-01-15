'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function deleteAllPaycheckData() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  try {
    // Get all paycheck IDs for this user first
    const { data: paychecks, error: fetchError } = await supabase
      .from('paychecks')
      .select('id')
      .eq('user_id', user.id)

    if (fetchError) {
      console.error('Error fetching paychecks:', fetchError)
      throw new Error('Failed to fetch paycheck data for deletion')
    }

    const paycheckIds = paychecks?.map((p: any) => p.id) || []

    // 1. Delete allocations (child of paychecks) - must be done first
    if (paycheckIds.length > 0) {
      const { error: allocError } = await supabase
        .from('allocations')
        .delete()
        .in('paycheck_id', paycheckIds)

      if (allocError) {
        console.error('Error deleting allocations:', allocError)
        throw new Error('Failed to delete allocation data')
      }

      console.log(`Deleted allocations for ${paycheckIds.length} paychecks`)
    }

    // 2. Delete paychecks (child of budget_versions)
    const { error: paycheckError } = await supabase
      .from('paychecks')
      .delete()
      .eq('user_id', user.id)

    if (paycheckError) {
      console.error('Error deleting paychecks:', paycheckError)
      throw new Error('Failed to delete paycheck data')
    }

    console.log(`Deleted ${paychecks?.length || 0} paychecks`)

    // 3. Get budget version IDs for cleanup
    const { data: budgetVersions, error: bvFetchError } = await supabase
      .from('budget_versions')
      .select('id')
      .eq('user_id', user.id)

    if (bvFetchError) {
      console.error('Error fetching budget versions:', bvFetchError)
      // Don't throw here - paychecks are already deleted, just log the error
    }

    const budgetVersionIds = budgetVersions?.map((bv: any) => bv.id) || []

    // 4. Delete budget version categories (junction table)
    if (budgetVersionIds.length > 0) {
      const { error: bvcError } = await supabase
        .from('budget_version_categories')
        .delete()
        .in('budget_version_id', budgetVersionIds)

      if (bvcError) {
        console.error('Error deleting budget version categories:', bvcError)
        // Don't throw here - main data is deleted
      }
    }

    // 5. Delete budget versions (now safe since paychecks are gone)
    const { error: bvError } = await supabase
      .from('budget_versions')
      .delete()
      .eq('user_id', user.id)

    if (bvError) {
      console.error('Error deleting budget versions:', bvError)
      // Don't throw here - main data is deleted
    }

    console.log('Paycheck data deletion completed successfully')

    // Aggressive cache busting - revalidate everything
    revalidatePath('/', 'layout')

    return { success: true }
  } catch (err) {
    console.error('Delete paycheck data error:', err)
    throw new Error(err instanceof Error ? err.message : 'Failed to delete paycheck data')
  }
}
