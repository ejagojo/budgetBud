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
            formatter={(value: number | undefined, name: string | undefined) => [
              value ? `$${value.toFixed(2)}` : '$0.00',
              name === 'budgeted' ? 'Budgeted' :
              name === 'spent' ? 'Spent' :
              name === 'remaining' ? 'Remaining' : (name || '')
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
