-- ============================================================
-- SQL Migration: Add Periodicity to Expense Templates
-- ============================================================

-- 1. Add new columns to expense_templates
ALTER TABLE expense_templates 
ADD COLUMN IF NOT EXISTS periodicity TEXT DEFAULT 'monthly' CHECK(periodicity IN ('monthly', 'quarterly', 'yearly'));

ALTER TABLE expense_templates 
ADD COLUMN IF NOT EXISTS recurrence_month INTEGER DEFAULT 1 CHECK(recurrence_month BETWEEN 1 AND 12);

-- 2. Update the automated generation function to handle periodicity
CREATE OR REPLACE FUNCTION generate_monthly_expenses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  template RECORD;
  current_month_date DATE := date_trunc('month', NOW())::DATE;
  current_month_num INTEGER := EXTRACT(month FROM NOW())::INTEGER;
BEGIN
  -- Loop through all active templates
  FOR template IN
    SELECT * FROM expense_templates 
    WHERE active = TRUE
    AND (
      periodicity = 'monthly' OR
      (periodicity = 'quarterly' AND current_month_num % 3 = template.recurrence_month % 3) OR
      (periodicity = 'yearly' AND current_month_num = template.recurrence_month)
    )
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
        'Récurrent',
        template.title,
        CASE WHEN template.amount_type = 'fixed' THEN template.default_amount ELSE 0 END,
        CASE WHEN template.amount_type = 'fixed' THEN 'pending_payment' ELSE 'pending_amount' END,
        template.created_by
      );
    END IF;
  END LOOP;
END;
$$;
