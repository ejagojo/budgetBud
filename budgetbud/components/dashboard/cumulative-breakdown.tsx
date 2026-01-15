'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { CountUp } from '@/components/ui/count-up'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { TrendingUp, DollarSign } from 'lucide-react'

interface LifetimeAllocation {
  category_id: string
  category_name: string
  category_color: string
  total_amount: number
}

interface PaycheckAllocation {
  category_id: string
  category_name: string
  category_color: string
  amount: number
  spent_amount: number
  percentage: number
}

interface CumulativeBreakdownProps {
  lifetimeAllocations?: LifetimeAllocation[]
  latestPaycheckAllocations?: PaycheckAllocation[]
}

export function CumulativeBreakdown({
  lifetimeAllocations = [],
  latestPaycheckAllocations
}: CumulativeBreakdownProps) {
  const [activeTab, setActiveTab] = useState('lifetime')

  // Debug logging (only if no data to help troubleshoot)
  if (!lifetimeAllocations?.length && !latestPaycheckAllocations?.length) {
    console.log('🔍 CumulativeBreakdown: No data available')
    console.log('📊 Lifetime:', lifetimeAllocations?.length || 0, 'records')
    console.log('💰 Latest:', latestPaycheckAllocations?.length || 0, 'records')
  }

  // Prepare data for lifetime chart
  const lifetimeChartData = (lifetimeAllocations || []).map(allocation => ({
    name: allocation.category_name,
    value: allocation.total_amount,
    color: allocation.category_color
  }))

  // Prepare data for latest paycheck chart
  const latestPaycheckChartData = (latestPaycheckAllocations || []).map(allocation => ({
    name: allocation.category_name,
    value: allocation.amount,
    color: allocation.category_color
  }))

  const formatCurrency = (amount: number) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}k`
    }
    return `$${amount.toLocaleString()}`
  }

  const formatTooltipValue = (value: number) => `$${value.toLocaleString()}`

  const totalLifetime = (lifetimeAllocations || []).reduce((sum, item) => sum + item.total_amount, 0)
  const totalLatest = (latestPaycheckAllocations || []).reduce((sum, item) => sum + item.amount, 0)

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
          <DollarSign className="w-4 h-4 md:w-5 md:h-5" />
          Income Allocation Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-10 md:h-11">
            <TabsTrigger value="lifetime" className="text-sm md:text-base">Lifetime Totals</TabsTrigger>
            <TabsTrigger value="recent" className="text-sm md:text-base">Last Paycheck</TabsTrigger>
          </TabsList>

          <TabsContent value="lifetime" className="space-y-4">
            {lifetimeAllocations.length > 0 ? (
              <>
                {/* Responsive Grid Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Chart Section (Left) */}
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        $<CountUp value={totalLifetime} duration={1500} />
                      </div>
                      <p className="text-sm text-muted-foreground">Total contributed across all paychecks</p>
                    </div>

                    {/* Chart with Center Label */}
                    <div className="h-[250px] relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={lifetimeChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={90}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {lifetimeChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                      <Tooltip
                        formatter={(value) => [value ? formatTooltipValue(value as number) : '$0', 'Amount']}
                        labelFormatter={(label) => label}
                      />
                          {/* Hide default legend */}
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Center Label */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                          <div className="text-lg font-bold text-primary">
                            {formatCurrency(totalLifetime)}
                          </div>
                          <div className="text-xs text-muted-foreground">Total</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Details List Section (Right) */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm md:text-base">Category Breakdown</h4>
                    <div className="max-h-[250px] overflow-y-auto space-y-1">
                      {lifetimeAllocations
                        .sort((a, b) => b.total_amount - a.total_amount)
                        .map((allocation) => (
                          <div key={allocation.category_id} className="flex items-center justify-between py-2 px-1 border-b border-border/50 last:border-b-0">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: allocation.category_color }}
                              />
                              <span className="text-sm truncate">{allocation.category_name}</span>
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                              <div className="font-semibold text-sm">
                                {formatCurrency(allocation.total_amount)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {((allocation.total_amount / totalLifetime) * 100).toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">No lifetime allocation data yet</p>
                <p className="text-sm text-muted-foreground">Add your first paycheck to see cumulative totals</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="recent" className="space-y-4">
            {latestPaycheckAllocations && latestPaycheckAllocations.length > 0 ? (
              <>
                {/* Responsive Grid Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Chart Section (Left) */}
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        $<CountUp value={totalLatest} duration={1500} />
                      </div>
                      <p className="text-sm text-muted-foreground">Most recent paycheck allocation</p>
                    </div>

                    {/* Chart with Center Label */}
                    <div className="h-[250px] relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={latestPaycheckChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={90}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {latestPaycheckChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                      <Tooltip
                        formatter={(value) => [value ? formatTooltipValue(value as number) : '$0', 'Amount']}
                        labelFormatter={(label) => label}
                      />
                          {/* Hide default legend */}
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Center Label */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                          <div className="text-lg font-bold text-primary">
                            {formatCurrency(totalLatest)}
                          </div>
                          <div className="text-xs text-muted-foreground">Total</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Details List Section (Right) */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm md:text-base">Paycheck Breakdown</h4>
                    <div className="max-h-[250px] overflow-y-auto space-y-1">
                      {latestPaycheckAllocations
                        .sort((a, b) => b.percentage - a.percentage)
                        .map((allocation) => (
                          <div key={allocation.category_id} className="flex items-center justify-between py-2 px-1 border-b border-border/50 last:border-b-0">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: allocation.category_color }}
                              />
                              <span className="text-sm truncate">{allocation.category_name}</span>
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                              <div className="font-semibold text-sm">
                                {formatCurrency(allocation.amount)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {allocation.percentage}%
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">No recent paycheck data</p>
                <p className="text-sm text-muted-foreground">Add a paycheck to see the breakdown</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
