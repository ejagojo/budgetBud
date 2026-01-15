'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePaychecks } from '@/lib/hooks/use-paychecks'
import { useRouter } from 'next/navigation'
import { Calendar, TrendingUp, Plus, RefreshCw, Copy, CheckCircle, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

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
            <CardContent className="p-3 md:p-4">
              {/* Mobile-first layout: Top row for date/amount, bottom row for status/actions */}
              <div className="space-y-3">
                {/* Top Row: Date (Left) | Amount (Right) */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium text-sm md:text-base">
                      {format(new Date(paycheck.date + 'T00:00:00'), 'MMM dd, yyyy')}
                    </span>
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-primary">
                    ${paycheck.amount.toLocaleString()}
                  </div>
                </div>

                {/* Bottom Row: Status Badge (Left) | View Chevron (Right) */}
                <div className="flex justify-between items-center">
                  <Badge variant="secondary" className="capitalize text-xs">
                    {paycheck.frequency.replace('-', ' ')}
                  </Badge>
                  <div className="flex items-center gap-2">
                    {paycheck.description && (
                      <span className="text-xs text-muted-foreground truncate max-w-24 md:max-w-32">
                        {paycheck.description}
                      </span>
                    )}
                    <div className="text-muted-foreground">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Allocation Breakdown */}
              {paycheck.allocations && paycheck.allocations.length > 0 && (
                <PaycheckAllocationBreakdown allocations={paycheck.allocations} />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Component for displaying full allocation breakdown
function PaycheckAllocationBreakdown({ allocations }: { allocations: any[] }) {
  const [expanded, setExpanded] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())

  const displayAllocations = expanded ? allocations : allocations.slice(0, 4)
  const hasMore = allocations.length > 4

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Amount copied to clipboard')
    } catch (err) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const toggleChecked = (categoryId: string) => {
    const newChecked = new Set(checkedItems)
    if (newChecked.has(categoryId)) {
      newChecked.delete(categoryId)
    } else {
      newChecked.add(categoryId)
    }
    setCheckedItems(newChecked)
  }

  const totalAllocated = allocations.reduce((sum, a) => sum + (a.amount || a.budgeted_amount || 0), 0)
  const totalSpent = allocations.reduce((sum, a) => sum + (a.spent_amount || 0), 0)

  return (
    <div className="space-y-2">
      {/* Header with totals */}
      <div className="flex justify-between items-center text-xs text-muted-foreground border-b pb-2 mb-2">
        <span className="font-medium">Budget Allocation</span>
        <div className="flex gap-3 text-right">
          <div className="hidden sm:block">
            <div className="text-xs opacity-75">Total</div>
            <div className="font-semibold">${totalAllocated.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs opacity-75 sm:hidden">Total</div>
            <div className="text-xs opacity-75 hidden sm:block">Spent</div>
            <div className="font-semibold">${totalSpent.toFixed(0)}</div>
          </div>
        </div>
      </div>

      {/* Allocation rows */}
      <div className="space-y-0">
        {displayAllocations.map((allocation, index) => (
          <div
            key={allocation.category_id}
            className={`
              border-b border-border/50 last:border-b-0
              hover:bg-muted/30 transition-colors
              ${index === 0 ? 'rounded-t-md' : ''}
              ${index === displayAllocations.length - 1 ? 'rounded-b-md' : ''}
            `}
          >
            {/* Mobile Layout (default) */}
            <div className="md:hidden flex items-center justify-between py-2 px-3">
              {/* Left side: Stacked name and percentage */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: allocation.category_color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate leading-tight">
                    {allocation.category_name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {allocation.percentage}%
                  </div>
                </div>
              </div>

              {/* Right side: Amount and actions */}
              <div className="flex items-center gap-1 ml-2">
                <span className="text-sm font-mono font-semibold mr-1">
                  ${(allocation.budgeted_amount || 0).toLocaleString()}
                </span>

                {/* Copy button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation()
                    copyToClipboard((allocation.budgeted_amount || 0).toString())
                  }}
                  title="Copy amount for bank transfer"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>

                {/* Checklist button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleChecked(allocation.category_id)
                  }}
                  title="Mark as transferred"
                >
                  <CheckCircle
                    className={`h-3.5 w-3.5 transition-colors ${
                      checkedItems.has(allocation.category_id)
                        ? 'text-green-600 fill-green-600'
                        : 'text-muted-foreground'
                    }`}
                  />
                </Button>
              </div>
            </div>

            {/* Desktop Layout (md and up) */}
            <div className="hidden md:flex items-center justify-between py-2 px-3">
              {/* Category indicator and name */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: allocation.category_color }}
                />
                <span className="text-sm font-medium truncate">{allocation.category_name}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {allocation.percentage}%
                </span>
              </div>

              {/* Amount and actions */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-semibold">
                  ${(allocation.budgeted_amount || 0).toLocaleString()}
                </span>

                {/* Copy button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation()
                    copyToClipboard((allocation.budgeted_amount || 0).toString())
                  }}
                  title="Copy amount for bank transfer"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>

                {/* Checklist button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleChecked(allocation.category_id)
                  }}
                  title="Mark as transferred"
                >
                  <CheckCircle
                    className={`h-3.5 w-3.5 transition-colors ${
                      checkedItems.has(allocation.category_id)
                        ? 'text-green-600 fill-green-600'
                        : 'text-muted-foreground'
                    }`}
                  />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Expand/collapse button */}
      {hasMore && (
        <div className="pt-2 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs h-8 hover:bg-muted/50"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-2" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-2" />
                Show {allocations.length - 4} More Categories
              </>
            )}
          </Button>
        </div>
      )}

      {/* Progress indicator */}
      <div className="space-y-2 pt-2 border-t border-border/50">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className="font-medium">Spending Progress</span>
          <span className="font-semibold">
            {totalAllocated === 0 ? '0.0' : ((totalSpent / totalAllocated) * 100).toFixed(1)}% used
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
            style={{
              width: totalAllocated === 0 ? '0%' : `${Math.min((totalSpent / totalAllocated) * 100, 100)}%`
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>${totalSpent.toFixed(0)} spent</span>
          <span>${totalAllocated === 0 ? '0' : (totalAllocated - totalSpent).toFixed(0)} remaining</span>
        </div>
      </div>
    </div>
  )
}
