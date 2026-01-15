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
