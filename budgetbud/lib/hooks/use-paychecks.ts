import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/types'
import { toast } from 'sonner'

type Paycheck = Database['public']['Tables']['paychecks']['Row'] & {
  allocations?: Array<{
    category_id: string
    category_name: string
    category_color: string
    budgeted_amount: number
    spent_amount: number
    percentage: number
  }>
}

const supabase = createClient()

export function usePaychecks() {
  const [paychecks, setPaychecks] = useState<Paycheck[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch paychecks with allocations
  const fetchPaychecks = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Fetch paychecks with basic info
      const { data: paycheckData, error: paycheckError } = await supabase
        .from('paychecks')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (paycheckError) throw paycheckError

      // For each paycheck, get top 3 allocations for preview
      const paychecksWithAllocations = await Promise.all(
        (paycheckData || []).map(async (paycheck) => {
          const { data: allocations, error: allocError } = await supabase
            .rpc('get_paycheck_with_allocations', {
              p_paycheck_id: paycheck.id,
              p_user_id: user.id
            })

          if (allocError) {
            console.error('Error fetching allocations for paycheck:', paycheck.id, allocError)
            return { ...paycheck, allocations: [] }
          }

          // Group allocations by paycheck and take top 3
          const paycheckAllocations = allocations
            ?.filter(a => a.paycheck_id === paycheck.id)
            .sort((a, b) => b.percentage - a.percentage)
            .slice(0, 3)
            .map(a => ({
              category_id: a.category_id,
              category_name: a.category_name,
              category_color: a.category_color,
              budgeted_amount: Number(a.budgeted_amount),
              spent_amount: Number(a.spent_amount),
              percentage: Number(a.percentage)
            })) || []

          return { ...paycheck, allocations: paycheckAllocations }
        })
      )

      setPaychecks(paychecksWithAllocations)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load paychecks'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Real-time subscription
  useEffect(() => {
    fetchPaychecks()

    const channel = supabase
      .channel('paychecks_changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'paychecks',
        },
        (payload) => {
          console.log('Paychecks change:', payload)
          fetchPaychecks() // Refetch on any change
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchPaychecks])

  return {
    paychecks,
    loading,
    error,
    refetch: fetchPaychecks,
  }
}

export function usePaycheck(paycheckId: string) {
  const [paycheck, setPaycheck] = useState<Paycheck | null>(null)
  const [allocations, setAllocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPaycheck = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Get paycheck details
      const { data: paycheckData, error: paycheckError } = await supabase
        .from('paychecks')
        .select('*')
        .eq('id', paycheckId)
        .eq('user_id', user.id)
        .single()

      if (paycheckError) throw paycheckError

      // Get full allocations
      const { data: allocationData, error: allocError } = await supabase
        .rpc('get_paycheck_with_allocations', {
          p_paycheck_id: paycheckId,
          p_user_id: user.id
        })

      if (allocError) throw allocError

      setPaycheck(paycheckData)
      setAllocations(allocationData || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load paycheck'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [paycheckId])

  useEffect(() => {
    if (paycheckId) {
      fetchPaycheck()
    }
  }, [paycheckId, fetchPaycheck])

  return {
    paycheck,
    allocations,
    loading,
    error,
    refetch: fetchPaycheck,
  }
}
