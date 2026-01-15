-- Epic 4: Transaction Tracking - Database Schema
-- This file creates the transactions table and spending update logic

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW') NOT NULL
);

-- Add RLS policies
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_transactions_user_id_date ON public.transactions(user_id, date DESC);
CREATE INDEX idx_transactions_category_id ON public.transactions(category_id);
CREATE INDEX idx_transactions_user_category ON public.transactions(user_id, category_id);

-- Add updated_at trigger
CREATE TRIGGER handle_updated_at_transactions
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Function to update allocation spending when transactions change
CREATE OR REPLACE FUNCTION update_allocation_spending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_allocation_id UUID;
  v_total_spent DECIMAL(10,2);
BEGIN
  -- Determine which allocation this affects
  -- Find the most recent allocation for this category
  SELECT a.id INTO v_allocation_id
  FROM allocations a
  JOIN paychecks p ON a.paycheck_id = p.id
  WHERE a.category_id = COALESCE(NEW.category_id, OLD.category_id)
    AND p.user_id = COALESCE(NEW.user_id, OLD.user_id)
  ORDER BY p.date DESC, p.created_at DESC
  LIMIT 1;

  -- If we found an allocation, recalculate total spent
  IF v_allocation_id IS NOT NULL THEN
    -- Sum all transactions for this allocation's category
    SELECT COALESCE(SUM(t.amount), 0) INTO v_total_spent
    FROM transactions t
    WHERE t.category_id = COALESCE(NEW.category_id, OLD.category_id)
      AND t.user_id = COALESCE(NEW.user_id, OLD.user_id);

    -- Update the allocation's spent amount
    UPDATE allocations
    SET spent_amount = v_total_spent
    WHERE id = v_allocation_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers for INSERT, UPDATE, DELETE on transactions
CREATE TRIGGER update_allocation_spending_insert
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION update_allocation_spending();

CREATE TRIGGER update_allocation_spending_update
  AFTER UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION update_allocation_spending();

CREATE TRIGGER update_allocation_spending_delete
  AFTER DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION update_allocation_spending();
