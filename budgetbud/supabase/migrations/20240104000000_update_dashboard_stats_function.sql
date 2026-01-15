-- Update get_dashboard_stats function to accept explicit user_id parameter
-- This fixes the "Empty Dashboard" issue by ensuring proper user data isolation

-- Drop the old function signature
DROP FUNCTION IF EXISTS get_dashboard_stats();

-- Create new function with user_id parameter
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  lifetime_allocations_data JSON;
  income_trends_data JSON;
  latest_paycheck_data JSON;
BEGIN
  -- CRITICAL: Exit if no user ID provided
  IF p_user_id IS NULL THEN
    RETURN json_build_object('error', 'No user ID provided');
  END IF;

  -- Get lifetime allocations aggregated by category NAME (allows merging)
  -- ONLY for current user's paychecks and categories
  SELECT json_agg(
    json_build_object(
      'category_id', category_id,
      'category_name', category_name,
      'category_color', category_color,
      'total_amount', total_amount
    )
  ) INTO lifetime_allocations_data
  FROM (
    SELECT
      mode() within group (order by c.id) as category_id,  -- Get most common category ID
      COALESCE(c.name, 'Archived Category') as category_name,
      mode() within group (order by c.color) as category_color,  -- Get most common color
      SUM(a.budgeted_amount) as total_amount
    FROM public.allocations a
    INNER JOIN public.paychecks p ON a.paycheck_id = p.id AND p.user_id = p_user_id
    LEFT JOIN public.categories c ON a.category_id = c.id AND c.user_id = p_user_id
    GROUP BY c.name
    ORDER BY SUM(a.budgeted_amount) DESC
  ) lifetime;

  -- Get recent paychecks for income trends (last 10)
  -- ONLY for current user
  SELECT json_agg(
    json_build_object(
      'id', id,
      'amount', amount,
      'date', date,
      'frequency', frequency,
      'description', description
    )
  ) INTO income_trends_data
  FROM (
    SELECT id, amount, date, frequency, description
    FROM public.paychecks
    WHERE user_id = p_user_id
    ORDER BY date DESC
    LIMIT 10
  ) trends;

  -- Get latest paycheck with allocations
  -- ONLY for current user
  SELECT json_build_object(
    'id', p.id,
    'amount', p.amount,
    'date', p.date,
    'frequency', p.frequency,
    'description', p.description,
    'allocations', (
      SELECT json_agg(
        json_build_object(
          'category_id', a.category_id,
          'category_name', COALESCE(c.name, 'Unknown'),
          'category_color', COALESCE(c.color, '#6B7280'),
          'amount', a.budgeted_amount,
          'spent_amount', a.spent_amount,
          'percentage', CASE
            WHEN p.amount > 0 THEN (a.budgeted_amount / p.amount) * 100
            ELSE 0
          END
        )
      )
      FROM public.allocations a
      LEFT JOIN public.categories c ON a.category_id = c.id AND c.user_id = p_user_id
      WHERE a.paycheck_id = p.id
    )
  ) INTO latest_paycheck_data
  FROM public.paychecks p
  WHERE p.user_id = p_user_id
  ORDER BY p.date DESC
  LIMIT 1;

  -- Build final result
  result := json_build_object(
    'lifetime_allocations', COALESCE(lifetime_allocations_data, '[]'::json),
    'income_trends', COALESCE(income_trends_data, '[]'::json),
    'latest_paycheck', latest_paycheck_data
  );

  RETURN result;
END;
$$;

-- Grant permissions to authenticated users only
GRANT EXECUTE ON FUNCTION get_dashboard_stats(UUID) TO authenticated;
