-- Fix theme column constraint deadlock - DROP before UPDATE
-- This resolves the constraint violation when updating existing data

-- 1. DROP the existing constraint FIRST (removes restrictions)
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_theme_check;

-- 2. UPDATE existing data to valid values (now that constraint is gone)
UPDATE public.profiles
SET theme = 'system'
WHERE theme NOT IN ('light', 'dark', 'system', 'rose')
   OR theme IS NULL;

-- 3. ADD the column if it's missing (safe to do now)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'system';

-- 4. ADD the NEW constraint LAST (after data is clean)
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_theme_check
CHECK (theme IN ('light', 'dark', 'system', 'rose'));

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.theme IS 'User theme preference: light, dark, system, or rose';
