-- Clean up analytics function from database
-- This removes the problematic get_analytics_data function to prevent future RPC errors

-- Drop all possible signatures of the analytics function
DROP FUNCTION IF EXISTS get_analytics_data();
DROP FUNCTION IF EXISTS get_analytics_data(uuid);
DROP FUNCTION IF EXISTS get_analytics_data(UUID);

-- Note: This migration is optional and keeps the database clean
-- The app will function normally without this function
