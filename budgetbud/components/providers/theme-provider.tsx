"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";

const supabase = createClient();

interface BudgetBudThemeProviderProps {
  children: React.ReactNode;
  attribute?: string;
  defaultTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = true,
  ...props
}: BudgetBudThemeProviderProps) {
  const [userTheme, setUserTheme] = React.useState<string | null>(null);

  // Load user theme from Supabase
  useEffect(() => {
    const loadUserTheme = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("theme")
          .eq("id", user.id)
          .single();

        if (profile?.theme) {
          setUserTheme(profile.theme);
        }
      }
    };

    loadUserTheme();
  }, []);

  // Update theme in Supabase when it changes
  const updateUserTheme = async (theme: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ theme }).eq("id", user.id);
    }
  };

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      value={userTheme || undefined}
      onThemeChange={updateUserTheme}
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
