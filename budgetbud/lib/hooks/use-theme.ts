import { useTheme as useNextTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const supabase = createClient();

export function useTheme() {
  const { theme, setTheme, ...rest } = useNextTheme();
  const [accentColor, setAccentColor] = useState("#3B82F6");

  // Load accent color from user profile
  useEffect(() => {
    const loadAccentColor = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // For now, we'll use a default accent. In the future, this could be stored in profiles
        // const { data: profile } = await supabase...
        setAccentColor("#3B82F6"); // Default blue
      }
    };

    loadAccentColor();
  }, []);

  const updateAccentColor = async (color: string) => {
    setAccentColor(color);
    // TODO: Store in user profile when we add accent color field
  };

  return {
    ...rest,
    theme,
    setTheme,
    accentColor,
    setAccentColor: updateAccentColor,
  };
}
