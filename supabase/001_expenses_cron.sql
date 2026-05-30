-- ============================================================
-- SQL Setup: Expense Templates & pg_cron Automated Generation
-- ============================================================

-- 1. Enable pg_cron extension (This must be done by Supabase Admin if not already active)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create the expense_templates table
CREATE TABLE IF NOT EXISTS expense_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  residence_id UUID NOT NULL REFERENCES residences(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount_type TEXT NOT NULL CHECK(amount_type IN ('fixed', 'variable')),
  default_amount NUMERIC(10,2) DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  recurrence_day INTEGER DEFAULT 1,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for expense_templates
ALTER TABLE expense_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expense_templates_select" ON expense_templates
  FOR SELECT USING (is_superuser() OR user_has_residence_access(residence_id));
CREATE POLICY "expense_templates_insert" ON expense_templates
  FOR INSERT WITH CHECK (is_superuser() OR user_can_write(residence_id));
CREATE POLICY "expense_templates_update" ON expense_templates
  FOR UPDATE USING (is_superuser() OR user_can_write(residence_id));
CREATE POLICY "expense_templates_delete" ON expense_templates
  FOR DELETE USING (is_superuser() OR user_can_write(residence_id));

CREATE TRIGGER update_expense_templates_updated_at
  BEFORE UPDATE ON expense_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Modify the expenses table
-- First add template_id
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES expense_templates(id) ON DELETE SET NULL;
-- Add status ('paid', 'pending_amount', 'pending_payment')
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'paid' CHECK(status IN ('paid', 'pending_amount', 'pending_payment'));
-- Update existing expenses to 'paid' (they were already entered manually)
UPDATE expenses SET status = 'paid' WHERE status IS NULL;

-- 4. Create the automated generation function
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

-- 5. Schedule the cron job
-- 5. Schedule the cron job
-- Schedule to run on the 1st of every month at 00:00 (Midnight)
SELECT cron.schedule(
  'generate-expenses-monthly',
  '0 0 1 * *', 
  $$ SELECT generate_monthly_expenses(); $$
);
