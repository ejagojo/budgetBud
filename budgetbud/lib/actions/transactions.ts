'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { Database } from '@/lib/supabase/types'

type TransactionInsert = Database['public']['Tables']['transactions']['Insert']

export async function createTransaction(formData: {
  categoryId: string
  amount: number
  date: string
  description?: string
}) {
  const cookieStore = await cookies()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('Not authenticated')
  }

  try {
  const { data, error } = await (supabase as any)
    .from('transactions')
    .insert({
      user_id: user.id,
      category_id: formData.categoryId,
      amount: formData.amount,
      date: formData.date,
      description: formData.description || null,
    })
      .select()
      .single()

    if (error) throw error

    // Revalidate dashboard and related pages
    revalidatePath('/dashboard')
    revalidatePath('/transactions')

    return {
      success: true,
      transaction: data,
    }
  } catch (err) {
    console.error('Transaction creation error:', err)
    throw new Error(
      err instanceof Error ? err.message : 'Failed to create transaction'
    )
  }
}

export async function deleteTransaction(transactionId: string) {
  const cookieStore = await cookies()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  try {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', transactionId)
      .eq('user_id', user.id)

    if (error) throw error

    revalidatePath('/dashboard')
    revalidatePath('/transactions')

    return { success: true }
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : 'Failed to delete transaction'
    )
  }
}
