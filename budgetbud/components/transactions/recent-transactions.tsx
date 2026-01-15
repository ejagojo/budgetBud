"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTransactions } from "@/lib/hooks/use-transactions";
import { deleteTransaction } from "@/lib/actions/transactions";
import { useRouter } from "next/navigation";
import { Trash2, TrendingDown, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface RecentTransactionsProps {
  limit?: number;
  showHeader?: boolean;
}

export function RecentTransactions({
  limit = 5,
  showHeader = true,
}: RecentTransactionsProps) {
  const { transactions, loading, error, refetch } = useTransactions(limit);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async (transactionId: string) => {
    try {
      setDeleteLoading(transactionId);
      await deleteTransaction(transactionId);
      toast.success("Transaction deleted successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete transaction"
      );
    } finally {
      setDeleteLoading(null);
    }
  };

  if (loading) {
    return (
      <Card>
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-3">
            {[...Array(limit)].map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 border rounded-lg animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-muted rounded-full"></div>
                  <div className="space-y-1">
                    <div className="h-4 w-24 bg-muted rounded"></div>
                    <div className="h-3 w-16 bg-muted rounded"></div>
                  </div>
                </div>
                <div className="h-4 w-16 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-4">
            <p className="text-destructive text-sm mb-3">{error}</p>
            <Button onClick={refetch} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        {showHeader && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              Recent Transactions
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-8">
            <TrendingDown className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">
              No transactions yet. Start tracking your spending!
            </p>
            <Button
              onClick={() => router.push("/transactions")}
              variant="outline"
            >
              View All Transactions
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              Recent Transactions
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/transactions")}
            >
              View All
            </Button>
          </CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {transaction.categories && (
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: transaction.categories.color }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">
                    {transaction.categories?.name || "Unknown Category"}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{format(new Date(transaction.date), "MMM dd")}</span>
                    {transaction.description && (
                      <>
                        <span>•</span>
                        <span className="truncate">
                          {transaction.description}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
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
                        Are you sure you want to delete this transaction? This
                        will update your spending totals.
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
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
