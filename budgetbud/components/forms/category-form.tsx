"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Database } from "@/lib/supabase/types";

type Category = Database["public"]["Tables"]["categories"]["Row"];

const categorySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(50, "Name must be less than 50 characters"),
  percentage: z
    .number()
    .min(0.1, "Percentage must be at least 0.1")
    .max(100, "Percentage cannot exceed 100"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color"),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryFormProps {
  category?: Category;
  totalPercentage: number;
  onSubmit: (data: CategoryFormData) => Promise<void>;
  trigger: React.ReactNode;
}

export function CategoryForm({
  category,
  totalPercentage,
  onSubmit,
  trigger,
}: CategoryFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name || "",
      percentage: category?.percentage || 10,
      color: category?.color || "#3B82F6",
    },
  });

  const watchedPercentage = form.watch("percentage");
  const remainingPercentage =
    100 - totalPercentage + (category?.percentage || 0);
  const wouldExceed = watchedPercentage > remainingPercentage;

  const handleSubmit = async (data: CategoryFormData) => {
    try {
      setLoading(true);
      await onSubmit(data);
      setOpen(false);
      form.reset();
    } catch (error) {
      // Error is handled in the hook
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {category ? "Edit Category" : "Add Category"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Groceries" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="percentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Percentage ({remainingPercentage}% remaining)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="100"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  {wouldExceed && (
                    <p className="text-sm text-destructive">
                      This would exceed 100% total allocation
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        {...field}
                        className="w-12 h-10 p-1"
                      />
                      <Input
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="#3B82F6"
                        className="flex-1"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || wouldExceed}>
                {loading ? "Saving..." : category ? "Update" : "Add"} Category
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
