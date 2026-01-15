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
