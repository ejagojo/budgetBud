-- Add theme column to profiles table for persistent theme selection
-- This allows users to have their theme preference saved across devices

-- Add theme column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'system'
CHECK (theme IN ('light', 'dark', 'system', 'rose'));

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.theme IS 'User theme preference: light, dark, system, or rose';

-- Note: This migration is safe to run multiple times due to IF NOT EXISTS
