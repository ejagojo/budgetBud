import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Database } from "@/lib/supabase/types";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Category = Database["public"]["Tables"]["categories"]["Row"];
type CategoryInsert = Database["public"]["Tables"]["categories"]["Insert"];
type CategoryUpdate = Database["public"]["Tables"]["categories"]["Update"];

const supabase = createClient();

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Calculate total percentage
  const totalPercentage = categories.reduce(
    (sum, cat) => sum + cat.percentage,
    0
  );
  const unallocatedPercentage = 100 - totalPercentage;

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setCategories(data || []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load categories";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Add category with validation
  const addCategory = useCallback(
    async (category: Omit<CategoryInsert, "user_id">) => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // Check if adding this category would exceed 100%
        const newTotal = totalPercentage + category.percentage;
        if (newTotal > 100) {
          throw new Error(
            `Total allocation would be ${newTotal}%. Must not exceed 100%.`
          );
        }

        const { data, error } = await supabase
          .from("categories")
          .insert({
            ...category,
            user_id: user.id,
          })
          .select()
          .single();

        if (error) throw error;

        setCategories((prev) => [...prev, data]);
        toast.success("Category added successfully");

        return data;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to add category";
        toast.error(message);
        throw err;
      }
    },
    [totalPercentage]
  );

  // Update category with validation
  const updateCategory = useCallback(
    async (id: string, updates: CategoryUpdate) => {
      try {
        // Calculate new total if percentage is being updated
        const currentCategory = categories.find((c) => c.id === id);
        if (!currentCategory) throw new Error("Category not found");

        let newTotal = totalPercentage;
        if (updates.percentage !== undefined) {
          newTotal =
            totalPercentage - currentCategory.percentage + updates.percentage;
          if (newTotal > 100) {
            throw new Error(
              `Total allocation would be ${newTotal}%. Must not exceed 100%.`
            );
          }
        }

        const { data, error } = await supabase
          .from("categories")
          .update(updates)
          .eq("id", id)
          .select()
          .single();

        if (error) throw error;

        setCategories((prev) =>
          prev.map((cat) => (cat.id === id ? data : cat))
        );
        toast.success("Category updated successfully");

        return data;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update category";
        toast.error(message);
        throw err;
      }
    },
    [categories, totalPercentage]
  );

  // Delete category
  const deleteCategory = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from("categories").delete().eq("id", id);

      if (error) throw error;

      setCategories((prev) => prev.filter((cat) => cat.id !== id));
      toast.success("Category deleted successfully");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete category";
      toast.error(message);
      throw err;
    }
  }, []);

  // Validate percentages
  const validatePercentages = useCallback(() => {
    return {
      isValid: totalPercentage <= 100,
      totalPercentage,
      unallocatedPercentage,
    };
  }, [totalPercentage, unallocatedPercentage]);

  // Real-time subscription
  useEffect(() => {
    fetchCategories();

    const channel = supabase
      .channel("categories_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "categories",
        },
        (payload) => {
          console.log("Categories change:", payload);
          fetchCategories(); // Refetch on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCategories]);

  return {
    categories,
    loading,
    error,
    totalPercentage,
    unallocatedPercentage,
    validatePercentages,
    addCategory,
    updateCategory,
    deleteCategory,
    refetch: fetchCategories,
  };
}
