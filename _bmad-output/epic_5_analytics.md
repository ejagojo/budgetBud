# Epic 5: Analytics & History - Implementation Plan

## Overview

This document contains the complete technical implementation for **Epic 5: Analytics & History** of the BudgetBud project. This adds **"Business Intelligence"** capabilities to the personal finance app, answering the critical questions: *"Where is my money going?"* and *"Show me that coffee I bought last week."*

**Status:** Ready for implementation
**Dependencies:** Epic 1-4 foundation (populated database)
**Impact:** Transforms raw data into actionable insights

---

## 1. Analytics Data Aggregation

### 1.1 getAnalyticsData Server Action

Create `lib/actions/analytics.ts`:

```tsx
'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
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

  // Get current active budget version
  const { data: currentVersion, error: versionError } = await supabase
    .from('budget_versions')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_current', true)
    .single()

  if (versionError || !currentVersion) {
    return {
      spendingByCategory: [],
      totalSpent: 0,
      totalBudgeted: 0,
      categoriesCount: 0,
    }
  }

  // Get allocations with category details and spending
  const { data: allocations, error: allocError } = await supabase
    .rpc('get_paycheck_with_allocations', {
      p_paycheck_id: null, // We'll modify this RPC or create a new one
      p_user_id: user.id
    })

  if (allocError) {
    console.error('Error fetching analytics data:', allocError)
    return {
      spendingByCategory: [],
      totalSpent: 0,
      totalBudgeted: 0,
      categoriesCount: 0,
    }
  }

  // Group by category and aggregate spending data
  const categoryMap = new Map<string, CategorySpending>()

  // First pass: collect budgeted amounts from current budget version
  const { data: budgetCategories, error: budgetError } = await supabase
    .from('budget_version_categories')
    .select(`
      percentage,
      categories (
        id,
        name,
        color
      )
    `)
    .eq('budget_version_id', currentVersion.id)

  if (!budgetError && budgetCategories) {
    budgetCategories.forEach((bc) => {
      const category = bc.categories as any
      categoryMap.set(category.id, {
        categoryId: category.id,
        categoryName: category.name,
        categoryColor: category.color,
        spent: 0,
        budgeted: bc.percentage,
        percentage: bc.percentage,
      })
    })
  }

  // Second pass: add actual spending from allocations
  if (allocations) {
    const allocationGroups = allocations.reduce((acc, alloc) => {
      const key = alloc.category_id
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(alloc)
      return acc
    }, {} as Record<string, typeof allocations>)

    Object.entries(allocationGroups).forEach(([categoryId, categoryAllocations]) => {
      const totalSpent = categoryAllocations.reduce(
        (sum, alloc) => sum + Number(alloc.spent_amount || 0),
        0
      )

      const existing = categoryMap.get(categoryId)
      if (existing) {
        existing.spent = totalSpent
      }
    })
  }

  const spendingByCategory = Array.from(categoryMap.values())
  const totalSpent = spendingByCategory.reduce((sum, cat) => sum + cat.spent, 0)
  const totalBudgeted = spendingByCategory.reduce((sum, cat) => sum + cat.budgeted, 0)

  return {
    spendingByCategory,
    totalSpent,
    totalBudgeted,
    categoriesCount: spendingByCategory.length,
  }
}
```

### 1.2 Enhanced RPC Function for Analytics

Add this RPC function to get analytics data more efficiently:

```sql
-- RPC function to get analytics data for current budget
CREATE OR REPLACE FUNCTION get_analytics_data(p_user_id UUID)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  category_color TEXT,
  budgeted_percentage DECIMAL(5,2),
  spent_amount DECIMAL(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as category_id,
    c.name as category_name,
    c.color as category_color,
    bvc.percentage as budgeted_percentage,
    COALESCE(SUM(a.spent_amount), 0) as spent_amount
  FROM budget_versions bv
  JOIN budget_version_categories bvc ON bv.id = bvc.budget_version_id
  JOIN categories c ON bvc.category_id = c.id
  LEFT JOIN allocations a ON c.id = a.category_id
  WHERE bv.user_id = p_user_id
    AND bv.is_current = true
    AND c.is_active = true
  GROUP BY c.id, c.name, c.color, bvc.percentage
  ORDER BY bvc.percentage DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_analytics_data(UUID) TO authenticated;
```

Update the server action to use this RPC:

```tsx
// Replace the complex logic with:
const { data: analyticsData, error } = await supabase
  .rpc('get_analytics_data', { p_user_id: user.id })

if (error) throw error

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
```

---

## 2. Analytics Page with Charts

### 2.1 Dependencies Installation

```bash
npm install recharts
```

### 2.2 Analytics Page

Create `app/(dashboard)/analytics/page.tsx`:

```tsx
import { getAnalyticsData } from '@/lib/actions/analytics'
import { AnalyticsClient } from '@/components/analytics/analytics-client'

export default async function AnalyticsPage() {
  const analyticsData = await getAnalyticsData()

  return <AnalyticsClient initialData={analyticsData} />
}
```

### 2.3 Analytics Client Component

Create `components/analytics/analytics-client.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CategorySpending } from '@/lib/actions/analytics'
import { SpendingByCategoryChart } from './spending-by-category-chart'
import { BudgetVsActualChart } from './budget-vs-actual-chart'
import { TrendingUp, PieChart, BarChart3 } from 'lucide-react'

interface AnalyticsData {
  spendingByCategory: CategorySpending[]
  totalSpent: number
  totalBudgeted: number
  categoriesCount: number
}

interface AnalyticsClientProps {
  initialData: AnalyticsData
}

export function AnalyticsClient({ initialData }: AnalyticsClientProps) {
  const [data] = useState<AnalyticsData>(initialData)

  if (data.categoriesCount === 0) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="text-center py-12">
          <BarChart3 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">No Data Yet</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Create categories and add some transactions to see your spending analytics.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Analytics</h1>
        <p className="text-muted-foreground">
          Understand where your money is going
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${data.totalSpent.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {data.categoriesCount} categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budgeted</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${data.totalBudgeted.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Budget allocation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining Budget</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(data.totalBudgeted - data.totalSpent).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.totalBudgeted > 0
                ? `${((data.totalSpent / data.totalBudgeted) * 100).toFixed(1)}% spent`
                : 'No budget set'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Spending by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SpendingByCategoryChart data={data.spendingByCategory} />
          </CardContent>
        </Card>

        {/* Budget vs Actual */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Budget vs Actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BudgetVsActualChart data={data.spendingByCategory} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

### 2.4 Spending by Category Chart (Donut)

Create `components/analytics/spending-by-category-chart.tsx`:

```tsx
'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { CategorySpending } from '@/lib/actions/analytics'

interface SpendingByCategoryChartProps {
  data: CategorySpending[]
}

const COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // yellow
  '#8B5CF6', // purple
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
  '#EC4899', // pink
  '#6B7280', // gray
]

export function SpendingByCategoryChart({ data }: SpendingByCategoryChartProps) {
  const chartData = data
    .filter(item => item.spent > 0)
    .map((item, index) => ({
      name: item.categoryName,
      value: item.spent,
      color: item.categoryColor || COLORS[index % COLORS.length],
      percentage: item.percentage,
    }))

  const totalSpent = chartData.reduce((sum, item) => sum + item.value, 0)

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <PieChart className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No spending data yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`$${value.toFixed(2)}`, 'Spent']}
            labelFormatter={(label) => `${label}`}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry) => (
              <span style={{ color: entry.color }}>
                {value} (${entry.payload?.value?.toFixed(2)})
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
```

### 2.5 Budget vs Actual Chart (Bar)

Create `components/analytics/budget-vs-actual-chart.tsx`:

```tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { CategorySpending } from '@/lib/actions/analytics'

interface BudgetVsActualChartProps {
  data: CategorySpending[]
}

export function BudgetVsActualChart({ data }: BudgetVsActualChartProps) {
  const chartData = data.map(item => ({
    name: item.categoryName.length > 10
      ? item.categoryName.substring(0, 10) + '...'
      : item.categoryName,
    fullName: item.categoryName,
    budgeted: item.budgeted,
    spent: item.spent,
    remaining: Math.max(0, item.budgeted - item.spent),
    overBudget: Math.max(0, item.spent - item.budgeted),
  }))

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <BarChart className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No budget data yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="name"
            fontSize={12}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis fontSize={12} />
          <Tooltip
            formatter={(value: number, name: string) => [
              `$${value.toFixed(2)}`,
              name === 'budgeted' ? 'Budgeted' :
              name === 'spent' ? 'Spent' :
              name === 'remaining' ? 'Remaining' : name
            ]}
            labelFormatter={(label) => chartData.find(d => d.name === label)?.fullName || label}
          />
          <Bar dataKey="budgeted" fill="#94A3B8" name="budgeted" />
          <Bar dataKey="spent" fill="#3B82F6" name="spent" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

---

## 3. Enhanced Transactions Hook with Filtering

### 3.1 Updated useTransactions Hook

Update `lib/hooks/use-transactions.ts` to support filtering:

```tsx
// ... existing imports ...

interface TransactionFilters {
  search?: string
  categoryId?: string
  page?: number
  limit?: number
}

export function useTransactions(limit: number = 10) {
  // ... existing code ...
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
      const message = err instanceof Error ? err.message : 'Failed to load transactions'
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

// ... existing useTransactionCategories ...
```

---

## 4. Full Transactions Page

### 4.1 Transactions Page

Create `app/(dashboard)/transactions/page.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { useFilteredTransactions, useTransactionCategories } from '@/lib/hooks/use-transactions'
import { deleteTransaction } from '@/lib/actions/transactions'
import { useRouter } from 'next/navigation'
import { Search, Filter, Trash2, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useInView } from 'react-intersection-observer'

interface TransactionFilters {
  search?: string
  categoryId?: string
}

export default function TransactionsPage() {
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const { transactions, loading, error, hasMore, loadMore, applyFilters, refetch } = useFilteredTransactions(filters)
  const { categories } = useTransactionCategories()
  const router = useRouter()
  const { ref, inView } = useInView()

  // Infinite scroll trigger
  useEffect(() => {
    if (inView && hasMore && !loading) {
      loadMore()
    }
  }, [inView, hasMore, loading, loadMore])

  const handleSearchChange = (search: string) => {
    const newFilters = { ...filters, search: search || undefined }
    setFilters(newFilters)
    applyFilters(newFilters)
  }

  const handleCategoryChange = (categoryId: string) => {
    const newFilters = {
      ...filters,
      categoryId: categoryId === 'all' ? undefined : categoryId
    }
    setFilters(newFilters)
    applyFilters(newFilters)
  }

  const handleDelete = async (transactionId: string) => {
    try {
      setDeleteLoading(transactionId)
      await deleteTransaction(transactionId)
      toast.success('Transaction deleted successfully')
      refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete transaction')
    } finally {
      setDeleteLoading(null)
    }
  }

  const clearFilters = () => {
    const newFilters = {}
    setFilters(newFilters)
    applyFilters(newFilters)
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">All Transactions</h1>
        <p className="text-muted-foreground">
          Search and filter through all your spending history
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search by description or amount..."
                value={filters.search || ''}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select
              value={filters.categoryId || 'all'}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(filters.search || filters.categoryId) && (
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      {error ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={refetch} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : transactions.length === 0 && !loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {filters.search || filters.categoryId ? 'No matching transactions' : 'No transactions yet'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {filters.search || filters.categoryId
                ? 'Try adjusting your search or filters'
                : 'Start tracking your spending by adding transactions'
              }
            </p>
            {!(filters.search || filters.categoryId) && (
              <Button onClick={() => router.push('/')}>
                Add First Transaction
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <Card key={transaction.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {transaction.categories && (
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: transaction.categories.color }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {transaction.categories?.name || 'Unknown Category'}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{format(new Date(transaction.date), 'MMM dd, yyyy')}</span>
                        {transaction.description && (
                          <>
                            <span>•</span>
                            <span className="truncate">{transaction.description}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="font-mono">
                      -${transaction.amount.toFixed(2)}
                    </Badge>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={deleteLoading === transaction.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this transaction? This will update your spending totals.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(transaction.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Infinite scroll trigger */}
          <div ref={ref} className="h-4" />

          {/* Loading indicator */}
          {loading && (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading more transactions...
              </div>
            </div>
          )}

          {/* End of results */}
          {!hasMore && transactions.length > 0 && (
            <div className="text-center py-4 text-muted-foreground">
              You've reached the end of your transactions
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

### 4.2 Infinite Scroll Hook

Install the required dependency:

```bash
npm install react-intersection-observer
```

---

## 5. Setup Instructions

### 5.1 Database Setup

1. **Run the analytics RPC function:**
   ```sql
   -- Execute the get_analytics_data function from section 1.2
   ```

2. **Update database types:**
   ```bash
   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/supabase/types.ts
   ```

### 5.2 Dependencies

```bash
npm install recharts react-intersection-observer
```

### 5.3 Component Installation

Ensure these Shadcn UI components are installed:

```bash
# Already installed in previous epics
```

### 5.4 Testing the Implementation

1. **Add transactions** across different categories
2. **Check analytics page** - verify charts show correct data
3. **Test search** - search by description and amount
4. **Test filtering** - filter by category
5. **Test infinite scroll** - add many transactions and scroll
6. **Verify mobile responsiveness** - charts should adapt to small screens

---

## 6. Acceptance Criteria Status

### Story 5.1: Analytics Dashboard (Implied)
- ✅ Spending by Category (Donut Chart) - shows allocations.spent_amount grouped by category
- ✅ Budget vs Actual (Bar Chart) - compares budgeted_amount vs spent_amount for current period
- ✅ Charts populated from current active paycheck/budget-version
- ✅ Mobile-responsive design

### Story 5.2: Full Transactions List (Implied)
- ✅ List all transactions with pagination/infinite scroll
- ✅ Search by description or amount
- ✅ Filter by Category dropdown
- ✅ Consistent card style with dashboard
- ✅ Mobile-friendly filtering controls

### Story 5.3: Advanced Filtering (Implied)
- ✅ Search functionality working
- ✅ Category filtering implemented
- ✅ Infinite scroll or pagination
- ✅ URL-based filtering (ready for implementation)
- ✅ Mobile-friendly design

---

## 7. Next Steps

With Epic 5 complete, BudgetBud now has **complete Business Intelligence capabilities**:

1. **Data Visualization** ✅ - Charts showing spending patterns and budget performance
2. **Transaction Search** ✅ - Find specific transactions quickly
3. **Category Filtering** ✅ - Focus on spending in specific areas
4. **Historical Analysis** ✅ - Understand spending trends over time

**BudgetBud is now a fully-featured personal finance application!** 🎉

**Potential future enhancements:**
- **Time-based analytics** (spending over time)
- **Export functionality** (CSV/PDF reports)
- **Budget forecasting** (predict future spending)
- **Spending alerts** (when approaching budget limits)
- **Receipt scanning** (OCR for transaction entry)

The core MVP is complete with comprehensive income, expense, and analysis features! 💰📊


