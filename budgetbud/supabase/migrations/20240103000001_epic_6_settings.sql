-- Epic 6: Settings & Data Management - Reset User Data Function
-- This file adds the reset_user_data RPC function

-- RPC function to completely reset user data
CREATE OR REPLACE FUNCTION reset_user_data(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_counts JSON;
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Start transaction - all or nothing
  BEGIN
    -- Delete in correct order to handle foreign keys
    -- 1. Delete transactions (no dependencies)
    DELETE FROM transactions WHERE user_id = p_user_id;

    -- 2. Delete allocations (depends on paychecks and categories)
    DELETE FROM allocations WHERE paycheck_id IN (
      SELECT id FROM paychecks WHERE user_id = p_user_id
    );

    -- 3. Delete paychecks (depends on budget_versions)
    DELETE FROM paychecks WHERE user_id = p_user_id;

    -- 4. Delete budget version categories (junction table)
    DELETE FROM budget_version_categories WHERE budget_version_id IN (
      SELECT id FROM budget_versions WHERE user_id = p_user_id
    );

    -- 5. Delete budget versions
    DELETE FROM budget_versions WHERE user_id = p_user_id;

    -- 6. Delete categories
    DELETE FROM categories WHERE user_id = p_user_id;

    -- 7. Reset profile to defaults (keep PIN, reset theme)
    UPDATE profiles
    SET
      display_name = NULL,
      theme = 'system',
      updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_user_id;

    -- Return success with counts (for confirmation)
    RETURN json_build_object(
      'success', true,
      'message', 'All user data has been reset successfully',
      'user_id', p_user_id
    );

  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback transaction on any error
      RETURN json_build_object(
        'success', false,
        'error', 'Failed to reset data: ' || SQLERRM
      );
  END;
END;
$$;

-- RPC function to delete only paycheck-related data (not categories/transactions)
CREATE OR REPLACE FUNCTION delete_user_paycheck_data(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_paychecks INTEGER;
  v_deleted_allocations INTEGER;
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Start transaction - all or nothing
  BEGIN
    -- Get counts before deletion for confirmation
    SELECT COUNT(*) INTO v_deleted_allocations
    FROM allocations
    WHERE paycheck_id IN (
      SELECT id FROM paychecks WHERE user_id = p_user_id
    );

    SELECT COUNT(*) INTO v_deleted_paychecks
    FROM paychecks WHERE user_id = p_user_id;

    -- Delete in correct order to handle foreign keys (child tables first)
    -- 1. Delete allocations (depends on paychecks)
    DELETE FROM allocations WHERE paycheck_id IN (
      SELECT id FROM paychecks WHERE user_id = p_user_id
    );

    -- 2. Delete paychecks (depends on budget_versions)
    DELETE FROM paychecks WHERE user_id = p_user_id;

    -- 3. Delete budget version categories (junction table)
    DELETE FROM budget_version_categories WHERE budget_version_id IN (
      SELECT id FROM budget_versions WHERE user_id = p_user_id
    );

    -- 4. Delete budget versions (now safe to delete)
    DELETE FROM budget_versions WHERE user_id = p_user_id;

    -- Return success with deletion counts
    RETURN json_build_object(
      'success', true,
      'message', 'Paycheck data deleted successfully',
      'deleted_paychecks', v_deleted_paychecks,
      'deleted_allocations', v_deleted_allocations
    );

  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback transaction on any error
      RETURN json_build_object(
        'success', false,
        'error', 'Failed to delete paycheck data: ' || SQLERRM
      );
  END;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION reset_user_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_paycheck_data(UUID) TO authenticated;
