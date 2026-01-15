import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/types'
import { toast } from 'sonner'

type Transaction = Database['public']['Tables']['transactions']['Row'] & {
  categories?: {
    name: string
    color: string
  }
}

const supabase = createClient()

interface TransactionFilters {
  search?: string
  categoryId?: string
  page?: number
  limit?: number
}

export function useTransactions(limit: number = 10) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('transactions')
        .select(
          `
          *,
          categories (
            name,
            color
          )
        `
        )
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      setTransactions(data || [])
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load transactions'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [limit])

  // Real-time subscription
  useEffect(() => {
    fetchTransactions()

    const channel = supabase
      .channel('transactions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
        },
        (payload) => {
          console.log('Transaction change:', payload)
          fetchTransactions() // Refetch on any change
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchTransactions])

  return {
    transactions,
    loading,
    error,
    refetch: fetchTransactions,
  }
}

export function useFilteredTransactions(filters: TransactionFilters = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  const fetchTransactions = useCallback(async (reset: boolean = false) => {
    try {
      setLoading(true)
      setError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let query = supabase
        .from('transactions')
        .select(`
          *,
          categories (
            name,
            color
          )
        `, { count: 'exact' })
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      // Apply search filter
      if (filters.search) {
        query = query.or(`description.ilike.%${filters.search}%,amount.eq.${filters.search}`)
      }

      // Apply category filter
      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId)
      }

      // Apply pagination
      const page = filters.page || 1
      const limit = filters.limit || 20
      const from = reset ? 0 : (page - 1) * limit
      const to = from + limit - 1

      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) throw error

      if (reset) {
        setTransactions(data || [])
      } else {
        setTransactions(prev => [...prev, ...(data || [])])
      }

      setTotalCount(count || 0)
      setHasMore((data?.length || 0) === limit)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load transactions'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [filters])

  // Load more function for infinite scroll
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchTransactions(false)
    }
  }, [loading, hasMore, fetchTransactions])

  // Reset and fetch with new filters
  const applyFilters = useCallback((newFilters: TransactionFilters) => {
    Object.assign(filters, newFilters)
    fetchTransactions(true)
  }, [filters, fetchTransactions])

  useEffect(() => {
    fetchTransactions(true)
  }, []) // Only run on mount, filters are handled by applyFilters

  return {
    transactions,
    loading,
    error,
    hasMore,
    totalCount,
    loadMore,
    applyFilters,
    refetch: () => fetchTransactions(true),
  }
}

export function useTransactionCategories() {
  const [categories, setCategories] = useState<
    Array<{
      id: string
      name: string
      color: string
    }>
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from('categories')
          .select('id, name, color')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('name')

        if (error) throw error

        setCategories(data || [])
      } catch (err) {
        console.error('Error fetching categories:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchCategories()
  }, [])

  return { categories, loading }
}
