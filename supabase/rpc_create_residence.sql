-- ==============================================================================
-- UPDATE FOR PUBLIC SIGNUPS
-- Allows an authenticated user to create a new residence and become its admin.
-- ==============================================================================

-- Create a SECURITY DEFINER function to bypass RLS for this specific atomic operation
CREATE OR REPLACE FUNCTION public.create_new_residence_with_admin(
    p_name TEXT,
    p_address TEXT,
    p_currency TEXT,
    p_monthly_fee NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with superuser privileges to bypass RLS
SET search_path = public
AS $$
DECLARE
    v_residence_id UUID;
    v_user_id UUID;
BEGIN
    -- Obtenir l'ID de l'utilisateur authentifié
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Non authentifié';
    END IF;

    -- 1. Insérer la nouvelle résidence
    INSERT INTO residences (name, address, currency, monthly_fee, apartment_count)
    VALUES (p_name, p_address, COALESCE(p_currency, 'DH'), COALESCE(p_monthly_fee, 0), 0)
    RETURNING id INTO v_residence_id;

    -- 2. Lier l'utilisateur en tant qu'admin
    INSERT INTO user_residences (user_id, residence_id, role)
    VALUES (v_user_id, v_residence_id, 'admin');

    RETURN v_residence_id;
END;
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_new_residence_with_admin TO authenticated;
