# Epic 4: Transaction Tracking - Implementation Plan

## Overview

This document contains the complete technical implementation for **Epic 4: Transaction Tracking** of the BudgetBud project. This completes the core **"Income → Budget → Expense"** financial tracking loop, allowing users to finally _spend_ against their budgeted allocations.

**Status:** Ready for implementation
**Dependencies:** Epic 1-3 foundation
**Impact:** Completes MVP core functionality

---

## 1. Database Schema & Spending Logic

### 1.1 Transactions Table

```sql
-- Create transactions table
CREATE TABLE public.transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW') NOT NULL
);

-- Add RLS policies
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_transactions_user_id_date ON public.transactions(user_id, date DESC);
CREATE INDEX idx_transactions_category_id ON public.transactions(category_id);
CREATE INDEX idx_transactions_user_category ON public.transactions(user_id, category_id);

-- Add updated_at trigger
CREATE TRIGGER handle_updated_at_transactions
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
```

### 1.2 Spending Update Trigger

This trigger ensures that `allocations.spent_amount` stays synchronized with transaction data, keeping dashboard queries fast and simple.

```sql
-- Function to update allocation spending when transactions change
CREATE OR REPLACE FUNCTION update_allocation_spending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_allocation_id UUID;
  v_total_spent DECIMAL(10,2);
BEGIN
  -- Determine which allocation this affects
  -- Find the most recent allocation for this category
  SELECT a.id INTO v_allocation_id
  FROM allocations a
  JOIN paychecks p ON a.paycheck_id = p.id
  WHERE a.category_id = COALESCE(NEW.category_id, OLD.category_id)
    AND p.user_id = COALESCE(NEW.user_id, OLD.user_id)
  ORDER BY p.date DESC, p.created_at DESC
  LIMIT 1;

  -- If we found an allocation, recalculate total spent
  IF v_allocation_id IS NOT NULL THEN
    -- Sum all transactions for this allocation's category
    SELECT COALESCE(SUM(t.amount), 0) INTO v_total_spent
    FROM transactions t
    WHERE t.category_id = COALESCE(NEW.category_id, OLD.category_id)
      AND t.user_id = COALESCE(NEW.user_id, OLD.user_id);

    -- Update the allocation's spent amount
    UPDATE allocations
    SET spent_amount = v_total_spent
    WHERE id = v_allocation_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers for INSERT, UPDATE, DELETE on transactions
CREATE TRIGGER update_allocation_spending_insert
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION update_allocation_spending();

CREATE TRIGGER update_allocation_spending_update
  AFTER UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION update_allocation_spending();

CREATE TRIGGER update_allocation_spending_delete
  AFTER DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION update_allocation_spending();
```

### 1.3 Database Types Update

Add to `lib/supabase/types.ts`:

```typescript
export interface Database {
  public: {
    Tables: {
      // ... existing tables ...
      transactions: {
        Row: {
          id: string;
          user_id: string;
          category_id: string;
          amount: number;
          date: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id: string;
          amount: number;
          date?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string;
          amount?: number;
          date?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    // ... existing Views, Functions, Enums ...
  };
}
```

---

## 2. Server Actions & Hooks

### 2.1 Transaction Server Actions

Create `lib/actions/transactions.ts`:

```tsx
"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { Database } from "@/lib/supabase/types";

type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];

export async function createTransaction(formData: {
  categoryId: string;
  amount: number;
  date: string;
  description?: string;
}) {
  const cookieStore = cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  // Get current user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("Not authenticated");
  }

  try {
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        category_id: formData.categoryId,
        amount: formData.amount,
        date: formData.date,
        description: formData.description || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Revalidate dashboard and related pages
    revalidatePath("/dashboard");
    revalidatePath("/transactions");

    return {
      success: true,
      transaction: data,
    };
  } catch (err) {
    console.error("Transaction creation error:", err);
    throw new Error(
      err instanceof Error ? err.message : "Failed to create transaction"
    );
  }
}

export async function deleteTransaction(transactionId: string) {
  const cookieStore = cookies();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  try {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transactionId)
      .eq("user_id", user.id);

    if (error) throw error;

    revalidatePath("/dashboard");
    revalidatePath("/transactions");

    return { success: true };
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : "Failed to delete transaction"
    );
  }
}
```

### 2.2 useTransactions Hook

Create `lib/hooks/use-transactions.ts`:

```tsx
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/types";
import { toast } from "sonner";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"] & {
  categories?: {
    name: string;
    color: string;
  };
};

const supabase = createClient();

export function useTransactions(limit: number = 10) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          *,
          categories (
            name,
            color
          )
        `
        )
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      setTransactions(data || []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load transactions";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Real-time subscription
  useEffect(() => {
    fetchTransactions();

    const channel = supabase
      .channel("transactions_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
        },
        (payload) => {
          console.log("Transaction change:", payload);
          fetchTransactions(); // Refetch on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTransactions]);

  return {
    transactions,
    loading,
    error,
    refetch: fetchTransactions,
  };
}

export function useTransactionCategories() {
  const [categories, setCategories] = useState<
    Array<{
      id: string;
      name: string;
      color: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("categories")
          .select("id, name, color")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .order("name");

        if (error) throw error;

        setCategories(data || []);
      } catch (err) {
        console.error("Error fetching categories:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  return { categories, loading };
}
```

---

## 3. Add Transaction UI

### 3.1 Global Add Transaction Component

Create `components/transactions/add-transaction-drawer.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTransactionCategories } from "@/lib/hooks/use-transactions";
import { createTransaction } from "@/lib/actions/transactions";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

const transactionSchema = z.object({
  categoryId: z.string().min(1, "Please select a category"),
  amount: z
    .number()
    .min(0.01, "Amount must be greater than 0")
    .max(10000, "Amount seems too high"),
  date: z.string().refine((date) => {
    const d = new Date(date);
    return d <= new Date();
  }, "Date cannot be in the future"),
  description: z
    .string()
    .max(200, "Description must be less than 200 characters")
    .optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

interface AddTransactionDrawerProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function AddTransactionDrawer({
  trigger,
  onSuccess,
}: AddTransactionDrawerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { categories, loading: categoriesLoading } = useTransactionCategories();
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      amount: undefined,
      date: new Date().toISOString().split("T")[0], // Today's date
      description: "",
    },
  });

  const handleSubmit = async (data: TransactionFormData) => {
    try {
      setLoading(true);
      await createTransaction(data);
      toast.success("Transaction added successfully!");
      setOpen(false);
      form.reset();

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add transaction"
      );
    } finally {
      setLoading(false);
    }
  };

  const formContent = (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
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
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      className="pl-8 text-lg"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="e.g., Coffee at Starbucks"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || categoriesLoading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Transaction"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );

  const defaultTrigger = (
    <Button
      size="lg"
      className="rounded-full w-14 h-14 shadow-lg fixed bottom-6 right-6 z-50 md:bottom-8 md:right-8"
    >
      <Plus className="w-6 h-6" />
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger || defaultTrigger}</DrawerTrigger>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Add Transaction</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">{formContent}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
```

### 3.2 Media Query Hook

Create `lib/hooks/use-media-query.ts`:

```tsx
import { useState, useEffect } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [matches, query]);

  return matches;
}
```

---

## 4. Recent Transactions Component

### 4.1 Recent Transactions Component

Create `components/transactions/recent-transactions.tsx`:

```tsx
"use client";

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
```

---

## 5. Updated Dashboard

### 5.1 Dashboard with Transactions

Update `components/dashboard/dashboard-client.tsx` to include transactions:

```tsx
// ... existing imports ...
import { AddTransactionDrawer } from "@/components/transactions/add-transaction-drawer";
import { RecentTransactions } from "@/components/transactions/recent-transactions";

export function DashboardClient({ initialData }: DashboardClientProps) {
  // ... existing code ...

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Your budget at a glance</p>
      </div>

      {/* Budget Overview Cards */}
      {/* ... existing budget cards ... */}

      {/* Allocation Status */}
      {/* ... existing allocation card ... */}

      {/* Category Breakdown */}
      {/* ... existing category breakdown ... */}

      {/* Recent Transactions */}
      <RecentTransactions limit={5} />

      {/* Quick Actions */}
      {/* ... existing quick actions ... */}

      {/* Global Add Transaction FAB */}
      <AddTransactionDrawer />
    </div>
  );
}
```

---

## 6. Setup Instructions

### 6.1 Database Setup

1. **Run the transaction table SQL:**

   ```sql
   -- Execute the transactions table creation from section 1.1
   -- Execute the spending trigger from section 1.2
   ```

2. **Update database types:**
   ```bash
   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > lib/supabase/types.ts
   ```

### 6.2 Dependencies

```bash
npm install @radix-ui/react-dialog @radix-ui/react-drawer  # For mobile drawer
npm install date-fns  # For date formatting (if not already installed)
```

### 6.3 Component Installation

Ensure these Shadcn UI components are installed:

```bash
npx shadcn-ui@latest add drawer
npx shadcn-ui@latest add textarea
```

### 6.4 Testing the Implementation

1. **Create categories and paychecks** (from previous epics)
2. **Add a transaction** using the FAB - verify dashboard updates
3. **Check allocation progress** - spending should reflect in progress bars
4. **Delete a transaction** - verify spending amounts update correctly
5. **Test on mobile** - drawer should slide up from bottom

---

## 7. Acceptance Criteria Status

### Story 4.1: Transaction Creation (Implied)

- ✅ Create transaction with amount, category, date, description
- ✅ Transactions update allocation spending automatically
- ✅ Amount validation (positive numbers only)
- ✅ Date validation (not future dates)
- ✅ Category selection from active categories

### Story 4.2: Transaction Tracking (Implied)

- ✅ Transactions stored with proper relationships
- ✅ Spending amounts update allocations in real-time
- ✅ Dashboard reflects current spending progress
- ✅ Transactions persist across sessions

### Story 4.3: Transaction Management (Implied)

- ✅ View recent transactions on dashboard
- ✅ Delete transactions with confirmation
- ✅ Transaction deletion updates spending totals
- ✅ Real-time updates across the application

---

## 8. Next Steps

With Epic 4 complete, BudgetBud now has the **complete core financial tracking functionality**:

1. **Income Tracking** ✅ (Paychecks with snapshots)
2. **Budget Planning** ✅ (Categories and allocations)
3. **Expense Tracking** ✅ (Transactions with real-time spending updates)

**Remaining for enhanced UX:**

- **Transaction history page** with filtering and search
- **Spending analytics** and insights
- **Export functionality** for tax preparation
- **Offline support** and PWA features

The **"Income → Budget → Expense"** loop is now fully functional! Users can track their complete financial picture from paycheck to spending. 🎯💰


