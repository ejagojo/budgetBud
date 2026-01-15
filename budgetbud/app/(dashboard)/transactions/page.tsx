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
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete transaction'
      )
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
