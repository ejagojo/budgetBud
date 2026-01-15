"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { CategoryForm } from "@/components/forms/category-form";
import { useCategories } from "@/lib/hooks/use-categories";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Database } from "@/lib/supabase/types";

type Category = Database["public"]["Tables"]["categories"]["Row"];

export function CategoryList() {
  const {
    categories,
    loading,
    totalPercentage,
    unallocatedPercentage,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useCategories();

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-1/3"></div>
            </CardHeader>
            <CardContent>
              <div className="h-2 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
          <Plus className="w-12 h-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No categories yet</h3>
        <p className="text-muted-foreground mb-4">
          Create your first budget category to start tracking your spending.
        </p>
        <CategoryForm
          totalPercentage={totalPercentage}
          onSubmit={addCategory}
          trigger={
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add First Category
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Total Allocation Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Budget Allocation
            <Badge
              variant={totalPercentage === 100 ? "default" : "destructive"}
            >
              {totalPercentage}% Allocated
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={totalPercentage} className="mb-2" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{totalPercentage}% allocated</span>
            <span>{unallocatedPercentage}% remaining</span>
          </div>
        </CardContent>
      </Card>

      {/* Categories List */}
      <div className="space-y-3">
        {categories.map((category) => (
          <Card key={category.id} className="relative">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <h3 className="font-medium">{category.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{category.percentage}%</Badge>
                  <CategoryForm
                    category={category}
                    totalPercentage={totalPercentage}
                    onSubmit={(data) => updateCategory(category.id, data)}
                    trigger={
                      <Button variant="ghost" size="sm">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    }
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Category</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{category.name}"?
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteCategory(category.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <Progress value={category.percentage} className="h-2" />
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  );
}


