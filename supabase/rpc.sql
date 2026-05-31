-- Fichier à exécuter dans le SQL Editor de Supabase

-- 1. Total des contributions
CREATE OR REPLACE FUNCTION get_total_contributions(p_residence_id uuid)
RETURNS numeric AS $$
DECLARE
  total numeric;
BEGIN
  SELECT SUM(amount) INTO total
  FROM contributions
  WHERE residence_id = p_residence_id;
  
  RETURN COALESCE(total, 0);
END;
$$ LANGUAGE plpgsql;

-- 2. Total des dépenses
CREATE OR REPLACE FUNCTION get_total_expenses(p_residence_id uuid)
RETURNS numeric AS $$
DECLARE
  total numeric;
BEGIN
  SELECT SUM(amount) INTO total
  FROM expenses
  WHERE residence_id = p_residence_id AND deleted = false;
  
  RETURN COALESCE(total, 0);
END;
$$ LANGUAGE plpgsql;
