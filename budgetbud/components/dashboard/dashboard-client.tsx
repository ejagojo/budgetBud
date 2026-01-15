"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Database } from "@/lib/supabase/types";
import { useRouter } from "next/navigation";
import { Plus, TrendingUp, AlertCircle, Calendar, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { CumulativeBreakdown } from "@/components/dashboard/cumulative-breakdown";

type Category = Database["public"]["Tables"]["categories"]["Row"];
type Paycheck = Database["public"]["Tables"]["paychecks"]["Row"];

interface DashboardData {
  categories: Category[];
  totalBudget: number;
  totalAllocated: number;
  unallocated: number;
  hasBudgetVersion: boolean;
  latestPaycheck?: Paycheck & {
    allocations?: Array<{
      category_id: string;
      category_name: string;
      category_color: string;
      amount: number;
      spent_amount: number;
      percentage: number;
    }>;
  };
  recentPaychecks: Paycheck[];
  lifetimeAllocations: Array<{
    category_id: string;
    category_name: string;
    category_color: string;
    total_amount: number;
  }>;
}

interface DashboardClientProps {
  initialData: DashboardData;
}

export function DashboardClient({ initialData }: DashboardClientProps) {
  const [data, setData] = useState<DashboardData>(initialData);
  const router = useRouter();

  // Calculate spent amounts (placeholder until allocations are implemented)
  const categoriesWithSpent = data.categories.map((category) => ({
    ...category,
    spent: 0, // TODO: Calculate from allocations
    remaining: (data.totalBudget * category.percentage) / 100,
  }));

  const totalSpent = categoriesWithSpent.reduce(
    (sum, cat) => sum + cat.spent,
    0
  );
  const totalRemaining = data.totalBudget - totalSpent;

  if (data.categories.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
            <Plus className="w-12 h-12 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Welcome to BudgetBud</h1>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Start by creating your budget categories to track your spending and
            stay on top of your finances.
          </p>
          <Button onClick={() => router.push("/categories")} size="lg">
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Categories
          </Button>
        </div>
      </div>
    );
  }

  // Prepare income trends data for chart
  const incomeTrendsData = data.recentPaychecks.slice(0, 6).reverse().map((paycheck) => ({
    date: format(new Date(paycheck.date + 'T00:00:00'), 'MMM dd'),
    amount: paycheck.amount
  }));

  // Calculate current budget breakdown data
  const currentBudgetBreakdown = data.latestPaycheck?.allocations?.map(allocation => ({
    category: allocation.category_name,
    budgeted: allocation.amount,
    spent: allocation.spent_amount,
    remaining: allocation.amount - allocation.spent_amount,
    color: allocation.category_color,
    percentage: allocation.percentage
  })) || [];

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Your income and spending at a glance</p>
      </div>

      {/* Latest Paycheck Card */}
      {data.latestPaycheck ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Latest Paycheck
              </div>
              <Badge variant="default">
                {format(new Date(data.latestPaycheck.date + 'T00:00:00'), 'MMM dd, yyyy')}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="text-2xl font-bold">${data.latestPaycheck.amount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Frequency</p>
                <p className="text-lg font-medium capitalize">
                  {data.latestPaycheck.frequency.replace('-', ' ')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Allocated</p>
                <p className="text-lg font-medium">
                  ${currentBudgetBreakdown.reduce((sum, item) => sum + item.budgeted, 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Spent</p>
                <p className="text-lg font-medium">
                  ${currentBudgetBreakdown.reduce((sum, item) => sum + item.spent, 0).toLocaleString()}
                </p>
              </div>
            </div>
            {data.latestPaycheck.description && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="text-sm">{data.latestPaycheck.description}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Paychecks Yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your first paycheck to see your budget breakdown and income trends.
            </p>
            <Button onClick={() => router.push('/paychecks/create')}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Paycheck
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Current Budget Breakdown */}
      {currentBudgetBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Current Budget Breakdown</CardTitle>
            <p className="text-sm text-muted-foreground">
              How your latest paycheck was allocated vs. what's been spent
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {currentBudgetBreakdown.map((item) => {
                const spentPercentage = item.budgeted > 0 ? (item.spent / item.budgeted) * 100 : 0;

                return (
                  <div key={item.category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <div>
                          <span className="font-medium">{item.category}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            {item.percentage}%
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          ${item.spent.toLocaleString()} / ${item.budgeted.toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          ${item.remaining.toLocaleString()} remaining
                        </div>
                      </div>
                    </div>
                    <Progress
                      value={Math.min(spentPercentage, 100)}
                      className="h-2"
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total Allocated</span>
                <span className="font-bold">
                  ${currentBudgetBreakdown.reduce((sum, item) => sum + item.budgeted, 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="font-medium">Total Spent</span>
                <span className="font-bold">
                  ${currentBudgetBreakdown.reduce((sum, item) => sum + item.spent, 0).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cumulative Breakdown Widget */}
      <CumulativeBreakdown
        lifetimeAllocations={data.lifetimeAllocations || []}
        latestPaycheckAllocations={data.latestPaycheck?.allocations}
      />

      {/* Income Trends */}
      {incomeTrendsData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Income Trends</CardTitle>
            <p className="text-sm text-muted-foreground">
              Your paycheck amounts over the last {incomeTrendsData.length} periods
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeTrendsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(value) => `$${value}`} />
                  <Tooltip
                    formatter={(value: number | undefined) => [value ? `$${value.toLocaleString()}` : '$0', 'Amount']}
                  />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Allocation Status (if no paycheck yet or if categories aren't fully allocated) */}
      {(!data.hasBudgetVersion || data.unallocated > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Budget Setup Status
              <Badge variant={data.totalAllocated === 100 ? "default" : "destructive"}>
                {data.totalAllocated}% Allocated
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={data.totalAllocated} className="mb-4" />
            <div className="flex justify-between text-sm text-muted-foreground mb-4">
              <span>{data.totalAllocated}% allocated</span>
              <span>{data.unallocated}% unallocated</span>
            </div>

            {data.unallocated > 0 && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-800 dark:text-amber-200">
                  {data.unallocated}% of your budget is unallocated. Consider adjusting your categories.
                </span>
              </div>
            )}

            {!data.hasBudgetVersion && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg mt-4">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-800 dark:text-blue-200">
                  Add your first paycheck to activate your budget and start tracking spending.
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => router.push("/paychecks/create")}
            >
              <DollarSign className="w-5 h-5" />
              Add Paycheck
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => router.push("/categories")}
            >
              <Plus className="w-5 h-5" />
              Add Category
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => router.push("/transactions")}
            >
              <TrendingUp className="w-5 h-5" />
              View Transactions
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => router.push("/analytics")}
            >
              <AlertCircle className="w-5 h-5" />
              View Analytics
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
