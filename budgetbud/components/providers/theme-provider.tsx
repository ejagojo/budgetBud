"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";

interface BudgetBudThemeProviderProps {
  children: React.ReactNode;
  attribute?: string;
  defaultTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}

// Inner component that handles database theme syncing
function ThemeSync() {
  const { setTheme, theme } = useTheme();
  const [hasSynced, setHasSynced] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const syncUserTheme = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('profiles')
          .select('theme')
          .eq('id', user.id)
          .single();

        if (!error && data && (data as any).theme) {
          const dbTheme = (data as any).theme;
          // Only set theme if it's different from current and not 'system'
          if (dbTheme !== theme && dbTheme !== 'system') {
            setTheme(dbTheme);
          }
        }
      } catch (error) {
        console.error('Failed to sync user theme:', error);
      } finally {
        setHasSynced(true);
      }
    };

    if (!hasSynced) {
      syncUserTheme();
    }
  }, [hasSynced, setTheme, theme, supabase]);

  return null;
}

export function ThemeProvider({
  children,
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = true,
  ...props
}: BudgetBudThemeProviderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      themes={['light', 'dark', 'rose', 'system']}
      {...props}
    >
      <ThemeSync />
      {mounted ? children : <div style={{ visibility: 'hidden' }}>{children}</div>}
    </NextThemesProvider>
  );
}
