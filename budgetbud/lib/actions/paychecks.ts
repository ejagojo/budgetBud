'use server'

import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'

type PaycheckInsert = Database['public']['Tables']['paychecks']['Insert']

export async function createPaycheck(formData: {
  amount: number
  date: string
  frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly'
  description?: string
}) {
  const supabase = await createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Not authenticated')
  }

  try {
    // Call the RPC function
    const { data, error } = await (supabase as any).rpc('create_paycheck_with_snapshot', {
      p_user_id: user.id,
      p_amount: formData.amount,
      p_date: formData.date,
      p_frequency: formData.frequency,
      p_description: formData.description || null,
    })

    if (error) throw error

    // Revalidate all affected pages and cache
    revalidatePath('/dashboard')
    revalidatePath('/paychecks')
    revalidatePath('/')

    return {
      success: true,
      paycheckId: data.paycheck_id,
      message: data.message
    }
  } catch (err) {
    console.error('Paycheck creation error:', err)
    throw new Error(err instanceof Error ? err.message : 'Failed to create paycheck')
  }
}

export async function updatePaycheck(paycheckId: string, updates: {
  date?: string
  description?: string
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  try {
    const { error } = await (supabase as any)
      .from('paychecks')
      .update(updates)
      .eq('id', paycheckId)
      .eq('user_id', user.id)

    if (error) throw error

    revalidatePath(`/paychecks/${paycheckId}`)
    revalidatePath('/paychecks')

    return { success: true }
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to update paycheck')
  }
}

export async function deletePaycheck(paycheckId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  try {
    const { error } = await supabase
      .from('paychecks')
      .delete()
      .eq('id', paycheckId)
      .eq('user_id', user.id)

    if (error) throw error

    revalidatePath('/paychecks')
    revalidatePath('/dashboard')

    return { success: true }
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Failed to delete paycheck')
  }
}
