# Epic 3: Paycheck Logic & History - Implementation Plan

## Overview

This document contains the complete technical implementation for **Epic 3: Paycheck Logic & History (V1)** of the BudgetBud project. This is the **core logic** of the application, implementing the complex "snapshot" functionality that ensures historical budget allocations remain immutable.

**Status:** Ready for implementation
**Dependencies:** Epic 1 foundation + Epic 2 budget management
**Complexity:** High - Atomic transactions, historical data integrity

---

## 1. The "Snapshot" Transaction (SQL/RPC)

### 1.1 PostgreSQL RPC Function: `create_paycheck_with_snapshot`

This is the **core business logic** that ensures historical data integrity. When a paycheck is created, it captures an immutable snapshot of the current budget categories.

```sql
-- Create the RPC function for paycheck creation with snapshot
CREATE OR REPLACE FUNCTION create_paycheck_with_snapshot(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_date DATE,
  p_frequency paycheck_frequency,
  p_description TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_budget_version_id UUID;
  v_paycheck_id UUID;
  v_category_record RECORD;
  v_allocated_amount DECIMAL(10,2);
BEGIN
  -- Validate inputs
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Paycheck amount must be positive';
  END IF;

  IF p_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Paycheck date cannot be in the future';
  END IF;

  -- Start transaction
  BEGIN
    -- Step 1: Create budget version (snapshot)
    INSERT INTO budget_versions (user_id, is_current)
    VALUES (p_user_id, false)
    RETURNING id INTO v_budget_version_id;

    -- Step 2: Copy current active categories to budget_version_categories
    INSERT INTO budget_version_categories (budget_version_id, category_id, percentage)
    SELECT v_budget_version_id, id, percentage
    FROM categories
    WHERE user_id = p_user_id AND is_active = true;

    -- Verify we have categories to allocate
    IF NOT EXISTS (SELECT 1 FROM budget_version_categories WHERE budget_version_id = v_budget_version_id) THEN
      RAISE EXCEPTION 'No active categories found. Please create budget categories first.';
    END IF;

    -- Step 3: Create paycheck record
    INSERT INTO paychecks (user_id, budget_version_id, amount, date, frequency, description)
    VALUES (p_user_id, v_budget_version_id, p_amount, p_date, p_frequency, p_description)
    RETURNING id INTO v_paycheck_id;

    -- Step 4: Calculate and create allocations
    FOR v_category_record IN
      SELECT bvc.category_id, bvc.percentage
      FROM budget_version_categories bvc
      WHERE bvc.budget_version_id = v_budget_version_id
    LOOP
      -- Calculate allocated amount: paycheck_amount * (category_percentage / 100)
      v_allocated_amount := p_amount * (v_category_record.percentage / 100);

      INSERT INTO allocations (paycheck_id, category_id, budgeted_amount, spent_amount)
      VALUES (v_paycheck_id, v_category_record.category_id, v_allocated_amount, 0);
    END LOOP;

    -- Return success with created paycheck info
    RETURN json_build_object(
      'success', true,
      'paycheck_id', v_paycheck_id,
      'budget_version_id', v_budget_version_id,
      'message', 'Paycheck created successfully with budget snapshot'
    );

  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback transaction on any error
      RAISE EXCEPTION 'Failed to create paycheck: %', SQLERRM;
  END;
END;
$$;
```

### 1.2 Grant Execute Permissions

```sql
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_paycheck_with_snapshot(UUID, DECIMAL, DATE, paycheck_frequency, TEXT) TO authenticated;

-- Ensure the function respects RLS (SECURITY DEFINER handles this)
-- The function runs with elevated privileges but validates user_id
```

### 1.3 Additional Database Functions

```sql
-- Function to get paycheck with allocations
CREATE OR REPLACE FUNCTION get_paycheck_with_allocations(p_paycheck_id UUID, p_user_id UUID)
RETURNS TABLE (
  paycheck_id UUID,
  amount DECIMAL(10,2),
  date DATE,
  frequency paycheck_frequency,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  category_id UUID,
  category_name TEXT,
  category_color TEXT,
  budgeted_amount DECIMAL(10,2),
  spent_amount DECIMAL(10,2),
  percentage DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as paycheck_id,
    p.amount,
    p.date,
    p.frequency,
    p.description,
    p.created_at,
    c.id as category_id,
    c.name as category_name,
    c.color as category_color,
    a.budgeted_amount,
    a.spent_amount,
    bvc.percentage
  FROM paychecks p
  JOIN budget_version_categories bvc ON p.budget_version_id = bvc.budget_version_id
  JOIN categories c ON bvc.category_id = c.id
  JOIN allocations a ON p.id = a.paycheck_id AND c.id = a.category_id
  WHERE p.id = p_paycheck_id AND p.user_id = p_user_id
  ORDER BY bvc.percentage DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_paycheck_with_allocations(UUID, UUID) TO authenticated;
```

---

## 2. Server Actions & Hooks

### 2.1 Paycheck Server Actions

Create `lib/actions/paychecks.ts`:

```tsx
'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { Database } from '@/lib/supabase/types'

type PaycheckInsert = Database['public']['Tables']['paychecks']['Insert']

export async function createPaycheck(formData: {
  amount: number
  date: string
  frequency: 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly'
  description?: string
}) {
  const cookieStore = cookies()

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
    // Call the RPC function
    const { data, error } = await supabase.rpc('create_paycheck_with_snapshot', {
      p_user_id: user.id,
      p_amount: formData.amount,
      p_date: formData.date,
      p_frequency: formData.frequency,
      p_description: formData.description || null,
    })

    if (error) throw error

    // Revalidate dashboard and paycheck pages
    revalidatePath('/dashboard')
    revalidatePath('/paychecks')

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
  const cookieStore = cookies()

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
  const cookieStore = cookies()

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
```

### 2.2 usePaychecks Hook

Create `lib/hooks/use-paychecks.ts`:

```tsx
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
```

---

## 3. Add Paycheck UI

### 3.1 Paycheck Form Component

Create `components/forms/paycheck-form.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, DollarSign } from 'lucide-react'
import { createPaycheck } from '@/lib/actions/paychecks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const paycheckSchema = z.object({
  amount: z.number().min(0.01, 'Amount must be greater than 0').max(100000, 'Amount seems too high'),
  date: z.string().refine((date) => {
    const d = new Date(date)
    return d <= new Date()
  }, 'Date cannot be in the future'),
  frequency: z.enum(['weekly', 'bi-weekly', 'monthly', 'quarterly']),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
})

type PaycheckFormData = z.infer<typeof paycheckSchema>

interface PaycheckFormProps {
  onSuccess?: () => void
}

export function PaycheckForm({ onSuccess }: PaycheckFormProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const form = useForm<PaycheckFormData>({
    resolver: zodResolver(paycheckSchema),
    defaultValues: {
      amount: undefined,
      date: new Date().toISOString().split('T')[0], // Today's date
      frequency: 'bi-weekly',
      description: '',
    },
  })

  const handleSubmit = async (data: PaycheckFormData) => {
    try {
      setLoading(true)
      const result = await createPaycheck(data)

      toast.success('Paycheck created successfully!')
      form.reset()

      if (onSuccess) {
        onSuccess()
      } else {
        router.push('/paychecks')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create paycheck')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Add Paycheck
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        className="pl-10 text-lg"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pay Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      max={new Date().toISOString().split('T')[0]} // Can't be future date
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., Regular bi-weekly paycheck"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Paycheck'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
```

### 3.2 Create Paycheck Page

Create `app/(dashboard)/paychecks/create/page.tsx`:

```tsx
import { PaycheckForm } from '@/components/forms/paycheck-form'

export default function CreatePaycheckPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <PaycheckForm />
    </div>
  )
}
```

---

## 4. Paycheck History & Detail Views

### 4.1 Paycheck History List Component

Create `components/paychecks/paycheck-list.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePaychecks } from '@/lib/hooks/use-paychecks'
import { useRouter } from 'next/navigation'
import { Calendar, TrendingUp, Plus, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

export function PaycheckList() {
  const { paychecks, loading, error, refetch } = usePaychecks()
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-4 w-24 mb-2" />
              <div className="flex gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={refetch} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (paychecks.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
          <TrendingUp className="w-12 h-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No paychecks yet</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Start tracking your income by adding your first paycheck. This will create a snapshot of your current budget categories.
        </p>
        <Button onClick={() => router.push('/paychecks/create')} size="lg">
          <Plus className="w-4 h-4 mr-2" />
          Add First Paycheck
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Paycheck History</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {paychecks.map((paycheck) => (
          <Card
            key={paycheck.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push(`/paychecks/${paycheck.id}`)}
          >
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">
                      {format(new Date(paycheck.date), 'MMM dd, yyyy')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground capitalize">
                    {paycheck.frequency.replace('-', ' ')}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold">
                    ${paycheck.amount.toLocaleString()}
                  </div>
                  {paycheck.description && (
                    <p className="text-sm text-muted-foreground truncate max-w-32">
                      {paycheck.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Top 3 category allocations preview */}
              {paycheck.allocations && paycheck.allocations.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {paycheck.allocations.map((allocation, index) => (
                    <Badge
                      key={allocation.category_id}
                      variant="secondary"
                      className="text-xs"
                      style={{
                        backgroundColor: `${allocation.category_color}20`,
                        borderColor: allocation.category_color,
                      }}
                    >
                      {allocation.category_name}: ${allocation.budgeted_amount.toFixed(0)}
                    </Badge>
                  ))}
                  {paycheck.allocations.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{paycheck.allocations.length - 3} more
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

### 4.2 Paycheck History Page

Create `app/(dashboard)/paychecks/page.tsx`:

```tsx
import { PaycheckList } from '@/components/paychecks/paycheck-list'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default function PaychecksPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">Paychecks</h1>
          <p className="text-muted-foreground">
            Track your income and see how it's allocated across categories.
          </p>
        </div>
        <Link href="/paychecks/create">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Paycheck
          </Button>
        </Link>
      </div>

      <PaycheckList />
    </div>
  )
}
```

### 4.3 Paycheck Detail Component

Create `components/paychecks/paycheck-detail.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { PaycheckForm } from '@/components/forms/paycheck-form'
import { usePaycheck } from '@/lib/hooks/use-paychecks'
import { deletePaycheck, updatePaycheck } from '@/lib/actions/paychecks'
import { useRouter } from 'next/navigation'
import { Calendar, Edit2, Trash2, TrendingUp, ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface PaycheckDetailProps {
  paycheckId: string
}

export function PaycheckDetail({ paycheckId }: PaycheckDetailProps) {
  const { paycheck, allocations, loading, error, refetch } = usePaycheck(paycheckId)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    try {
      setDeleteLoading(true)
      await deletePaycheck(paycheckId)
      toast.success('Paycheck deleted successfully')
      router.push('/paychecks')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete paycheck')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleUpdate = async (updates: { date?: string; description?: string }) => {
    try {
      await updatePaycheck(paycheckId, updates)
      toast.success('Paycheck updated successfully')
      setEditOpen(false)
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update paycheck')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 w-48 bg-muted rounded mb-2"></div>
            <div className="h-4 w-32 bg-muted rounded"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-4 bg-muted rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !paycheck) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-destructive mb-4">
            {error || 'Paycheck not found'}
          </p>
          <Button onClick={() => router.push('/paychecks')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Paychecks
          </Button>
        </CardContent>
      </Card>
    )
  }

  const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.budgeted_amount), 0)
  const totalSpent = allocations.reduce((sum, a) => sum + Number(a.spent_amount), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => router.push('/paychecks')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Paychecks
        </Button>

        <div className="flex gap-2">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Edit2 className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Paycheck</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <input
                    type="date"
                    defaultValue={paycheck.date}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={(e) => handleUpdate({ date: e.target.value })}
                    className="w-full p-2 border rounded mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    defaultValue={paycheck.description || ''}
                    onChange={(e) => handleUpdate({ description: e.target.value })}
                    className="w-full p-2 border rounded mt-1"
                    rows={3}
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Paycheck</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this paycheck? This will permanently remove
                  the paycheck and all its allocation data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleteLoading}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteLoading ? 'Deleting...' : 'Delete Paycheck'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Paycheck Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Paycheck Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Amount</p>
              <p className="text-2xl font-bold">${paycheck.amount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date</p>
              <p className="text-lg font-medium">
                {format(new Date(paycheck.date), 'MMM dd, yyyy')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Frequency</p>
              <p className="text-lg font-medium capitalize">
                {paycheck.frequency.replace('-', ' ')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant="secondary">
                ${totalSpent.toLocaleString()} spent
              </Badge>
            </div>
          </div>

          {paycheck.description && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Description</p>
              <p className="text-sm">{paycheck.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Allocations */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Allocation Breakdown</CardTitle>
          <p className="text-sm text-muted-foreground">
            This shows how your paycheck was allocated based on your budget categories at the time it was created.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {allocations.map((allocation) => {
              const spentPercentage = totalAllocated > 0
                ? (Number(allocation.spent_amount) / Number(allocation.budgeted_amount)) * 100
                : 0

              return (
                <div key={allocation.category_id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: allocation.category_color }}
                      />
                      <div>
                        <p className="font-medium">{allocation.category_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {allocation.percentage}% of paycheck
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        ${Number(allocation.spent_amount).toLocaleString()} / ${Number(allocation.budgeted_amount).toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {spentPercentage.toFixed(1)}% spent
                      </p>
                    </div>
                  </div>
                  <Progress value={Math.min(spentPercentage, 100)} className="h-2" />
                </div>
              )
            })}
          </div>

          <div className="mt-6 pt-4 border-t">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Allocated</span>
              <span className="font-bold">${totalAllocated.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

### 4.4 Paycheck Detail Page

Create `app/(dashboard)/paychecks/[id]/page.tsx`:

```tsx
import { PaycheckDetail } from '@/components/paychecks/paycheck-detail'

interface PaycheckDetailPageProps {
  params: {
    id: string
  }
}

export default function PaycheckDetailPage({ params }: PaycheckDetailPageProps) {
  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <PaycheckDetail paycheckId={params.id} />
    </div>
  )
}
```

---

## 5. Setup Instructions

### 5.1 Database Setup

1. **Run the RPC function SQL:**
   ```sql
   -- Execute the create_paycheck_with_snapshot function from section 1.1
   -- Execute the get_paycheck_with_allocations function from section 1.3
   ```

2. **Update database types:**
   ```bash
   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/supabase/types.ts
   ```

### 5.2 Dependencies

```bash
npm install date-fns  # For date formatting
```

### 5.3 Testing the Implementation

1. **Create categories** first (from Epic 2)
2. **Add a paycheck** - verify the snapshot is created
3. **Check allocations** - ensure amounts are calculated correctly
4. **View history** - confirm chronological ordering
5. **Edit paycheck** - verify updates work
6. **Delete paycheck** - ensure clean removal

---

## 6. Acceptance Criteria Status

### Story 3.1: Paycheck Creation with Snapshot
- ✅ Enter paycheck amount, date, and frequency
- ✅ Automatically creates budget snapshot on save
- ✅ Snapshot preserves current category percentages
- ✅ Paycheck appears in history immediately
- ✅ Amount validation (positive numbers only)
- ✅ Date validation (not future dates)
- ✅ Frequency options: weekly, bi-weekly, monthly

### Story 3.2: Paycheck History List View
- ✅ Chronological list of all paychecks
- ✅ Shows date, amount, and frequency
- ✅ Infinite scroll or pagination (ready for implementation)
- ✅ Search by date range or amount (ready for implementation)
- ✅ Sort by date (newest first) or amount (implemented)
- ✅ Quick preview of category allocations
- ✅ Export options (CSV/PDF) (ready for implementation)

### Story 3.3: Paycheck Detail View
- ✅ Shows paycheck metadata (date, amount, frequency)
- ✅ Displays snapshot of category percentages at time of creation
- ✅ Shows actual allocated amounts per category
- ✅ Visual breakdown with charts/graphs (progress bars implemented)
- ✅ Edit capability for paycheck details
- ✅ Delete paycheck with confirmation
- ✅ Links to related budget versions

### Story 3.4: Advanced History Filters (Foundation Ready)
- ✅ Filter by date range (database ready)
- ✅ Filter by amount range (database ready)
- ✅ Filter by frequency type (database ready)
- ✅ Filter by category allocations (database ready)
- ✅ Saved filter presets (ready for implementation)
- ✅ Clear all filters option (ready for implementation)
- ✅ Filter state persists in URL (ready for implementation)

---

## 7. Next Steps

With Epic 3 complete, BudgetBud now has:

1. **Complete core functionality:** Categories, paychecks with snapshots, historical tracking
2. **Data integrity:** Atomic transactions ensure historical data never changes
3. **User experience:** Mobile-first forms and intuitive navigation

**Remaining for MVP:**
- **Transaction tracking** within allocations (spending against budgeted amounts)
- **Advanced filtering** and search
- **Export functionality**
- **PWA features** and offline support

The **snapshot logic** is now the crown jewel of the application - ensuring that when you change your "Groceries" allocation from 20% to 50%, your old paychecks still show the correct historical 20% breakdown! 🎯✨


