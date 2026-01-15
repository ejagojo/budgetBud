-- Fix Analytics Crash: Create missing get_analytics_data function
-- This resolves the RPC error on the Analytics page

-- Drop any existing function with this signature
DROP FUNCTION IF EXISTS get_analytics_data(uuid);

-- Create the analytics function with proper signature
CREATE OR REPLACE FUNCTION get_analytics_data(p_user_id UUID)
RETURNS TABLE (
  category_name text,
  category_color text,
  total_budgeted numeric,
  total_spent numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- CRITICAL: Exit if no user ID provided
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.name as category_name,
    MAX(c.color) as category_color,
    COALESCE(SUM(a.budgeted_amount), 0) as total_budgeted,
    0 as total_spent  -- Placeholder until transactions table is fully linked
  FROM categories c
  LEFT JOIN allocations a ON c.id = a.category_id
  LEFT JOIN paychecks p ON a.paycheck_id = p.id AND p.user_id = p_user_id
  WHERE c.user_id = p_user_id
    AND c.is_active = true
  GROUP BY c.name
  ORDER BY COALESCE(SUM(a.budgeted_amount), 0) DESC;
END;
$$;

-- Grant permissions to authenticated users only
GRANT EXECUTE ON FUNCTION get_analytics_data(UUID) TO authenticated;
