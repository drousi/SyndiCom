-- ============================================================
-- SQL Migration: Add Type (Category) to Expense Templates
-- ============================================================

-- 1. Add type column to expense_templates
ALTER TABLE expense_templates ADD COLUMN IF NOT EXISTS type TEXT;

-- 2. Update the automated generation function to use the type
CREATE OR REPLACE FUNCTION generate_monthly_expenses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  template RECORD;
  current_month_date DATE := date_trunc('month', NOW())::DATE;
BEGIN
  -- Loop through all active templates
  FOR template IN
    SELECT * FROM expense_templates WHERE active = TRUE
  LOOP
    -- Check if an expense for this template already exists this month
    IF NOT EXISTS (
      SELECT 1 FROM expenses 
      WHERE template_id = template.id 
      AND date >= current_month_date 
      AND date < current_month_date + INTERVAL '1 month'
    ) THEN
      -- Insert the new expense
      INSERT INTO expenses (
        residence_id, 
        template_id,
        date, 
        type, 
        description, 
        amount, 
        status,
        created_by
      ) VALUES (
        template.residence_id,
        template.id,
        current_month_date + (template.recurrence_day - 1 || ' days')::INTERVAL,
        COALESCE(template.type, 'Récurrent'),
        template.title,
        CASE WHEN template.amount_type = 'fixed' THEN template.default_amount ELSE 0 END,
        CASE WHEN template.amount_type = 'fixed' THEN 'pending_payment' ELSE 'pending_amount' END,
        template.created_by
      );
    END IF;
  END LOOP;
END;
$$;
