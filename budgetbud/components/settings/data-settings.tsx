'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { createClient } from '@/lib/supabase/client'
import { exportUserData } from '@/lib/utils/data-export'
import { deleteAllPaycheckData } from '@/lib/actions/settings'
import { toast } from 'sonner'
import { Download, Trash2, AlertTriangle, Database, DollarSign } from 'lucide-react'

export function DataSettings() {
  const [exportLoading, setExportLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [deletePaychecksLoading, setDeletePaychecksLoading] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const supabase = createClient()

  const handleExport = async () => {
    try {
      setExportLoading(true)
      await exportUserData()
      toast.success('Data exported successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export data')
    } finally {
      setExportLoading(false)
    }
  }

  const handleReset = async () => {
    try {
      setResetLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await (supabase.rpc as any)('reset_user_data', {
        p_user_id: user.id
      })

      if (error) throw error

      if (data.success) {
        toast.success('All data has been reset successfully')
        // Optionally redirect to dashboard or reload
        window.location.href = '/dashboard'
      } else {
        toast.error(data.error || 'Failed to reset data')
      }
    } catch (err) {
      console.error('Reset error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to reset data')
    } finally {
      setResetLoading(false)
    }
  }

  const handleDeletePaychecks = async () => {
    if (deleteConfirmation !== 'DELETE') {
      toast.error('Please type "DELETE" to confirm')
      return
    }

    try {
      setDeletePaychecksLoading(true)
      await deleteAllPaycheckData()
      toast.success('All paycheck data has been deleted successfully')
      setDeleteConfirmation('')
      // Close dialog by triggering state reset
    } catch (err) {
      console.error('Delete paycheck error:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to delete paycheck data')
    } finally {
      setDeletePaychecksLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Export Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Export Data
          </CardTitle>
          <CardDescription>
            Download all your BudgetBud data as a JSON file for backup or migration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleExport}
            disabled={exportLoading}
            className="w-full sm:w-auto"
          >
            <Download className="w-4 h-4 mr-2" />
            {exportLoading ? 'Exporting...' : 'Export My Data'}
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions that will permanently affect your account and data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
              <h4 className="font-medium text-destructive mb-2 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Clear Paycheck History
              </h4>
              <p className="text-sm text-muted-foreground mb-4">
                Permanently delete all paycheck data and budget allocations. This will reset your dashboard
                to show no income history while keeping your categories and spending data intact.
              </p>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={deletePaychecksLoading}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deletePaychecksLoading ? 'Deleting...' : 'Clear Paycheck History'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-destructive">
                      Clear Paycheck History
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3">
                        <p className="font-medium">
                          This action cannot be undone. This will permanently delete:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          <li>All paycheck records and amounts</li>
                          <li>All budget allocations for each paycheck</li>
                          <li>Income trends and dashboard history</li>
                        </ul>
                        <div className="pt-2 border-t">
                          <p className="text-sm font-medium mb-2">
                            Type "DELETE" to confirm:
                          </p>
                          <input
                            type="text"
                            value={deleteConfirmation}
                            onChange={(e) => setDeleteConfirmation(e.target.value)}
                            placeholder="DELETE"
                            className="w-full px-3 py-2 border rounded-md text-center font-mono text-sm"
                            maxLength={6}
                          />
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setDeleteConfirmation('')}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeletePaychecks}
                      disabled={deleteConfirmation !== 'DELETE' || deletePaychecksLoading}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deletePaychecksLoading ? 'Deleting...' : 'Yes, Delete All Paychecks'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
              <h4 className="font-medium text-destructive mb-2">Reset All Data</h4>
              <p className="text-sm text-muted-foreground mb-4">
                This will permanently delete all your paychecks, categories, transactions, and reset your profile settings.
                Your account will remain active, but all financial data will be lost.
              </p>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={resetLoading}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {resetLoading ? 'Resetting...' : 'Reset All Data'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-destructive">
                      Reset All Data
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p>This action cannot be undone. This will permanently delete:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>All paychecks and budget snapshots</li>
                        <li>All spending categories</li>
                        <li>All transactions and spending records</li>
                        <li>Your display name and theme preferences</li>
                      </ul>
                      <p className="font-medium">Your PIN and account will remain unchanged.</p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleReset}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {resetLoading ? 'Resetting...' : 'Yes, Reset Everything'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
