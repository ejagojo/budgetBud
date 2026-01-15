-- Epic 3: Paycheck Logic & History - RPC Functions
-- This file contains the crucial snapshot logic for paychecks

-- Create the RPC function for paycheck creation with snapshot
CREATE OR REPLACE FUNCTION create_paycheck_with_snapshot(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_date DATE,
  p_frequency paycheck_frequency,
  p_description TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_budget_version_id UUID;
  v_paycheck_id UUID;
  v_category_record RECORD;
  v_allocated_amount DECIMAL(10,2);
BEGIN
  -- Validate inputs
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Paycheck amount must be positive';
  END IF;

  IF p_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Paycheck date cannot be in the future';
  END IF;

  -- Start transaction
  BEGIN
    -- Step 1: Create budget version (snapshot)
    INSERT INTO budget_versions (user_id, is_current)
    VALUES (p_user_id, false)
    RETURNING id INTO v_budget_version_id;

    -- Step 2: Copy current active categories to budget_version_categories
    INSERT INTO budget_version_categories (budget_version_id, category_id, percentage)
    SELECT v_budget_version_id, id, percentage
    FROM categories
    WHERE user_id = p_user_id AND is_active = true;

    -- Verify we have categories to allocate
    IF NOT EXISTS (SELECT 1 FROM budget_version_categories WHERE budget_version_id = v_budget_version_id) THEN
      RAISE EXCEPTION 'No active categories found. Please create budget categories first.';
    END IF;

    -- Step 3: Create paycheck record
    INSERT INTO paychecks (user_id, budget_version_id, amount, date, frequency, description)
    VALUES (p_user_id, v_budget_version_id, p_amount, p_date, p_frequency, p_description)
    RETURNING id INTO v_paycheck_id;

    -- Step 4: Calculate and create allocations
    FOR v_category_record IN
      SELECT bvc.category_id, bvc.percentage
      FROM budget_version_categories bvc
      WHERE bvc.budget_version_id = v_budget_version_id
    LOOP
      -- Calculate allocated amount: paycheck_amount * (category_percentage / 100)
      v_allocated_amount := p_amount * (v_category_record.percentage / 100);

      INSERT INTO allocations (paycheck_id, category_id, budgeted_amount, spent_amount)
      VALUES (v_paycheck_id, v_category_record.category_id, v_allocated_amount, 0);
    END LOOP;

    -- Return success with created paycheck info
    RETURN json_build_object(
      'success', true,
      'paycheck_id', v_paycheck_id,
      'budget_version_id', v_budget_version_id,
      'message', 'Paycheck created successfully with budget snapshot'
    );

  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback transaction on any error
      RAISE EXCEPTION 'Failed to create paycheck: %', SQLERRM;
  END;
END;
$$;

-- Function to get paycheck with allocations
CREATE OR REPLACE FUNCTION get_paycheck_with_allocations(p_paycheck_id UUID, p_user_id UUID)
RETURNS TABLE (
  paycheck_id UUID,
  amount DECIMAL(10,2),
  date DATE,
  frequency paycheck_frequency,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  category_id UUID,
  category_name TEXT,
  category_color TEXT,
  budgeted_amount DECIMAL(10,2),
  spent_amount DECIMAL(10,2),
  percentage DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as paycheck_id,
    p.amount,
    p.date,
    p.frequency,
    p.description,
    p.created_at,
    c.id as category_id,
    c.name as category_name,
    c.color as category_color,
    a.budgeted_amount,
    a.spent_amount,
    bvc.percentage
  FROM paychecks p
  JOIN budget_version_categories bvc ON p.budget_version_id = bvc.budget_version_id
  JOIN categories c ON bvc.category_id = c.id
  JOIN allocations a ON p.id = a.paycheck_id AND c.id = a.category_id
  WHERE p.id = p_paycheck_id AND p.user_id = p_user_id
  ORDER BY bvc.percentage DESC;
END;
$$;

-- Function to get lifetime allocation totals across all paychecks
CREATE OR REPLACE FUNCTION get_lifetime_allocations()
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  category_color TEXT,
  total_amount DECIMAL(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.category_id,
    COALESCE(c.name, 'Archived Category') as category_name,
    COALESCE(c.color, '#6B7280') as category_color,
    SUM(a.budgeted_amount) as total_amount
  FROM allocations a
  LEFT JOIN categories c ON a.category_id = c.id
  GROUP BY a.category_id, c.name, c.color
  ORDER BY SUM(a.budgeted_amount) DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_paycheck_with_snapshot(UUID, DECIMAL, DATE, paycheck_frequency, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_paycheck_with_allocations(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_lifetime_allocations() TO authenticated;
