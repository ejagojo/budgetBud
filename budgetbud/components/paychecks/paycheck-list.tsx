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
