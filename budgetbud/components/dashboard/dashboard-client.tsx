"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Database } from "@/lib/supabase/types";
import { useRouter } from "next/navigation";
import { Plus, TrendingUp, AlertCircle } from "lucide-react";
import { RecentTransactions } from "@/components/transactions/recent-transactions";

type Category = Database["public"]["Tables"]["categories"]["Row"];

interface DashboardData {
  categories: Category[];
  totalBudget: number;
  totalAllocated: number;
  unallocated: number;
  hasBudgetVersion: boolean;
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

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Your budget at a glance</p>
      </div>

      {/* Budget Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${data.totalBudget.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Current pay period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Spent</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalSpent.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {((totalSpent / data.totalBudget) * 100).toFixed(1)}% of budget
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalRemaining.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Available to spend</p>
          </CardContent>
        </Card>
      </div>

      {/* Allocation Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Budget Allocation
            <Badge
              variant={data.totalAllocated === 100 ? "default" : "destructive"}
            >
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
                {data.unallocated}% of your budget is unallocated. Consider
                adjusting your categories.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categoriesWithSpent.map((category) => {
              const spentPercentage =
                data.totalBudget > 0
                  ? (category.spent /
                      ((data.totalBudget * category.percentage) / 100)) *
                    100
                  : 0;

              return (
                <div key={category.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="font-medium">{category.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        ${category.spent.toLocaleString()} / $
                        {(category.remaining + category.spent).toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {category.percentage}% allocated
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
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <RecentTransactions limit={5} />

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
              onClick={() => router.push("/categories")}
            >
              <Plus className="w-5 h-5" />
              Add Category
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => router.push("/paychecks")}
            >
              <TrendingUp className="w-5 h-5" />
              Add Paycheck
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => router.push("/settings")}
            >
              <AlertCircle className="w-5 h-5" />
              Settings
            </Button>
            <Button
              variant="outline"
              className="h-20 flex-col gap-2"
              onClick={() => router.push("/history")}
            >
              <AlertCircle className="w-5 h-5" />
              View History
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Global Add Transaction FAB */}
    </div>
  );
}
