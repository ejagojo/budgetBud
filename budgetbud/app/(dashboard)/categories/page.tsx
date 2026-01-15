"use client";

import { CategoryList } from "@/components/categories/category-list";
import { CategoryForm } from "@/components/forms/category-form";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/lib/hooks/use-categories";
import { Plus } from "lucide-react";

export default function CategoriesPage() {
  const { totalPercentage, addCategory } = useCategories();
  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold">Budget Categories</h1>
            <p className="text-muted-foreground mt-1">
              Organize your spending by creating categories. Total allocation must
              equal 100%.
            </p>
          </div>
          <CategoryForm
            totalPercentage={totalPercentage}
            onSubmit={addCategory}
            trigger={
              <Button
                className="w-full sm:w-auto"
                disabled={totalPercentage >= 100}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            }
          />
        </div>
      </div>

      <CategoryList />
    </div>
  );
}
