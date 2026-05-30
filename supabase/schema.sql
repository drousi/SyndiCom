-- ============================================================
-- SyndiCom – Supabase PostgreSQL Schema + RLS Policies
-- Version: 2.0.0 – Multi-Tenant (Superuser / Admin / Manager / Resident)
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Profiles ─────────────────────────────────────────────────────────────────
-- Extends auth.users with app-level metadata
-- system_role: 'superuser' | 'user' (building-level role is in user_residences)

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  push_token TEXT,               -- Expo push notification token (Phase 3)
  system_role TEXT NOT NULL DEFAULT 'user'
    CHECK(system_role IN ('superuser', 'user')),
  force_password_change BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Residences ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS residences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  currency TEXT DEFAULT 'DH',
  apartment_count INTEGER DEFAULT 0,
  monthly_fee NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── User ↔ Residence (roles per building) ────────────────────────────────────
-- role: 'admin' | 'manager' | 'resident'
-- A user can be admin of multiple residences
-- A user can be manager of exactly one residence at a time
-- A resident is linked to one apartment in one residence

CREATE TABLE IF NOT EXISTS user_residences (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  residence_id UUID NOT NULL REFERENCES residences(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'resident')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, residence_id)
);

-- ─── Apartments ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS apartments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  residence_id UUID NOT NULL REFERENCES residences(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  floor INTEGER,
  owner_name TEXT,
  phone TEXT,
  email TEXT,                    -- Pour invitation résident
  whatsapp TEXT,                 -- Pour notifications WhatsApp (Phase 3)
  resident_user_id UUID REFERENCES profiles(id),  -- Compte résident lié
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Contributions ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  residence_id UUID NOT NULL REFERENCES residences(id) ON DELETE CASCADE,
  apartment_id UUID NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  comment TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(apartment_id, month, year)
);

-- ─── Payment Declarations (résident déclare un paiement) ─────────────────────

CREATE TABLE IF NOT EXISTS payment_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  residence_id UUID NOT NULL REFERENCES residences(id) ON DELETE CASCADE,
  apartment_id UUID NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  declared_by UUID NOT NULL REFERENCES profiles(id),
  amount NUMERIC(10,2) NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'validated', 'rejected')),
  validated_by UUID REFERENCES profiles(id),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Expenses ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  residence_id UUID NOT NULL REFERENCES residences(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  receipt_url TEXT,
  deleted BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Activity Log ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  residence_id UUID REFERENCES residences(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_apartments_residence ON apartments(residence_id);
CREATE INDEX IF NOT EXISTS idx_apartments_resident_user ON apartments(resident_user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_residence ON contributions(residence_id);
CREATE INDEX IF NOT EXISTS idx_contributions_apartment ON contributions(apartment_id);
CREATE INDEX IF NOT EXISTS idx_contributions_year_month ON contributions(year, month);
CREATE INDEX IF NOT EXISTS idx_expenses_residence ON expenses(residence_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_user_residences_user ON user_residences(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_declarations_apartment ON payment_declarations(apartment_id);
CREATE INDEX IF NOT EXISTS idx_payment_declarations_status ON payment_declarations(status);
CREATE INDEX IF NOT EXISTS idx_activity_log_residence ON activity_log(residence_id);

-- ─── Helper Functions ─────────────────────────────────────────────────────────

-- Is current user the superuser?
CREATE OR REPLACE FUNCTION is_superuser()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND system_role = 'superuser'
  )
$$;

-- Does user have access to a residence?
CREATE OR REPLACE FUNCTION user_has_residence_access(res_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_residences
    WHERE user_id = auth.uid() AND residence_id = res_id
  )
$$;

-- Get user role for a residence
CREATE OR REPLACE FUNCTION user_residence_role(res_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM user_residences
  WHERE user_id = auth.uid() AND residence_id = res_id
  LIMIT 1
$$;

-- Is user admin or manager of residence?
CREATE OR REPLACE FUNCTION user_can_write(res_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT user_residence_role(res_id) IN ('admin', 'manager') OR is_superuser()
$$;

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE residences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_residences ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- ─── Profiles RLS ─────────────────────────────────────────────────────────────

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid() OR is_superuser());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "profiles_superuser_all" ON profiles
  FOR ALL USING (is_superuser());

-- ─── Residences RLS ───────────────────────────────────────────────────────────

CREATE POLICY "residences_select" ON residences
  FOR SELECT USING (is_superuser() OR user_has_residence_access(id));

CREATE POLICY "residences_insert" ON residences
  FOR INSERT WITH CHECK (is_superuser());

CREATE POLICY "residences_update" ON residences
  FOR UPDATE USING (is_superuser() OR user_residence_role(id) = 'admin');

CREATE POLICY "residences_delete" ON residences
  FOR DELETE USING (is_superuser());

-- ─── User Residences RLS ──────────────────────────────────────────────────────

CREATE POLICY "user_residences_select" ON user_residences
  FOR SELECT USING (is_superuser() OR user_id = auth.uid() OR
    user_residence_role(residence_id) = 'admin');

CREATE POLICY "user_residences_insert" ON user_residences
  FOR INSERT WITH CHECK (is_superuser() OR user_residence_role(residence_id) = 'admin');

CREATE POLICY "user_residences_update" ON user_residences
  FOR UPDATE USING (is_superuser() OR user_residence_role(residence_id) = 'admin');

CREATE POLICY "user_residences_delete" ON user_residences
  FOR DELETE USING (is_superuser() OR user_residence_role(residence_id) = 'admin');

-- ─── Apartments RLS ───────────────────────────────────────────────────────────

CREATE POLICY "apartments_select" ON apartments
  FOR SELECT USING (is_superuser() OR user_has_residence_access(residence_id));

CREATE POLICY "apartments_insert" ON apartments
  FOR INSERT WITH CHECK (is_superuser() OR user_residence_role(residence_id) = 'admin');

CREATE POLICY "apartments_update" ON apartments
  FOR UPDATE USING (is_superuser() OR user_residence_role(residence_id) = 'admin');

CREATE POLICY "apartments_delete" ON apartments
  FOR DELETE USING (is_superuser() OR user_residence_role(residence_id) = 'admin');

-- ─── Contributions RLS ────────────────────────────────────────────────────────

CREATE POLICY "contributions_select" ON contributions
  FOR SELECT USING (is_superuser() OR user_has_residence_access(residence_id));

CREATE POLICY "contributions_insert" ON contributions
  FOR INSERT WITH CHECK (is_superuser() OR user_can_write(residence_id));

CREATE POLICY "contributions_update" ON contributions
  FOR UPDATE USING (is_superuser() OR user_can_write(residence_id));

-- ─── Payment Declarations RLS ─────────────────────────────────────────────────

-- Residents can insert declarations for their own apartment
CREATE POLICY "declarations_select" ON payment_declarations
  FOR SELECT USING (
    is_superuser() OR
    user_has_residence_access(residence_id) OR
    declared_by = auth.uid()
  );

CREATE POLICY "declarations_insert" ON payment_declarations
  FOR INSERT WITH CHECK (
    declared_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM apartments
      WHERE id = apartment_id AND resident_user_id = auth.uid()
    )
  );

-- Admin/Manager can update status (validate/reject)
CREATE POLICY "declarations_update" ON payment_declarations
  FOR UPDATE USING (is_superuser() OR user_can_write(residence_id));

-- ─── Expenses RLS ─────────────────────────────────────────────────────────────

CREATE POLICY "expenses_select" ON expenses
  FOR SELECT USING (is_superuser() OR user_has_residence_access(residence_id));

CREATE POLICY "expenses_insert" ON expenses
  FOR INSERT WITH CHECK (is_superuser() OR user_can_write(residence_id));

CREATE POLICY "expenses_update" ON expenses
  FOR UPDATE USING (is_superuser() OR user_can_write(residence_id));

CREATE POLICY "expenses_delete" ON expenses
  FOR DELETE USING (is_superuser() OR user_residence_role(residence_id) = 'admin');

-- ─── Activity Log RLS ─────────────────────────────────────────────────────────

CREATE POLICY "activity_log_select" ON activity_log
  FOR SELECT USING (is_superuser() OR user_has_residence_access(residence_id));

CREATE POLICY "activity_log_insert" ON activity_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ─── Updated At Triggers ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_residences_updated_at
  BEFORE UPDATE ON residences FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_user_residences_updated_at
  BEFORE UPDATE ON user_residences FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_apartments_updated_at
  BEFORE UPDATE ON apartments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_contributions_updated_at
  BEFORE UPDATE ON contributions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Initial Setup ────────────────────────────────────────────────────────────
-- Run ONCE after creating the superuser account in Supabase Auth:
--
-- UPDATE profiles SET system_role = 'superuser' WHERE email = 'superuser@syndicom.ma';
