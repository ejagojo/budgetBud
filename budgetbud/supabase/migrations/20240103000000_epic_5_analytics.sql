-- Epic 5: Analytics & History - RPC Functions
-- This file adds the analytics data aggregation function

-- RPC function to get analytics data for current budget
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
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as category_id,
    c.name as category_name,
    c.color as category_color,
    bvc.percentage as budgeted_percentage,
    COALESCE(SUM(a.spent_amount), 0) as spent_amount
  FROM budget_versions bv
  JOIN budget_version_categories bvc ON bv.id = bvc.budget_version_id
  JOIN categories c ON bvc.category_id = c.id
  LEFT JOIN allocations a ON c.id = a.category_id
  WHERE bv.user_id = p_user_id
    AND bv.is_current = true
    AND c.is_active = true
  GROUP BY c.id, c.name, c.color, bvc.percentage
  ORDER BY bvc.percentage DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_analytics_data(UUID) TO authenticated;
