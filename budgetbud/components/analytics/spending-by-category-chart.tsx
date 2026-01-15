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
