-- Create get_analytics_data function for spending analytics
-- This provides category-wise spending vs budget analysis

CREATE OR REPLACE FUNCTION get_analytics_data(p_user_id UUID)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  category_color TEXT,
  budgeted_percentage DECIMAL(5,2),
  spent_amount DECIMAL(10,2)
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
    c.id as category_id,
    c.name as category_name,
    c.color as category_color,
    COALESCE(bvc.percentage, 0) as budgeted_percentage,
    COALESCE(SUM(a.spent_amount), 0) as spent_amount
  FROM categories c
  LEFT JOIN budget_version_categories bvc ON c.id = bvc.category_id
  LEFT JOIN budget_versions bv ON bvc.budget_version_id = bv.id AND bv.user_id = p_user_id
  LEFT JOIN allocations a ON c.id = a.category_id
  LEFT JOIN paychecks p ON a.paycheck_id = p.id AND p.user_id = p_user_id
  WHERE c.user_id = p_user_id
    AND c.is_active = true
  GROUP BY c.id, c.name, c.color, bvc.percentage
  ORDER BY COALESCE(SUM(a.spent_amount), 0) DESC;
END;
$$;

-- Grant permissions to authenticated users only
GRANT EXECUTE ON FUNCTION get_analytics_data(UUID) TO authenticated;
