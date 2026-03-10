-- Phase 1: Profiles table + user_id on expenses + role-aware RLS
-- ============================================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS: users read own, admins read all
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR (auth.jwt() ->> 'role' = 'authenticated'
        AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  );

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can update any profile
CREATE POLICY profiles_admin_update ON profiles
  FOR UPDATE USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Only service_role inserts profiles (via edge function)
-- No INSERT policy for regular users

-- 2. Add user_id to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 3. Backfill existing expenses to admin user
-- Find the admin user by email and assign all current expenses
DO $$
DECLARE
  admin_uid UUID;
BEGIN
  SELECT id INTO admin_uid FROM auth.users WHERE email = 'gustavo@targetdial.co' LIMIT 1;
  IF admin_uid IS NOT NULL THEN
    UPDATE expenses SET user_id = admin_uid WHERE user_id IS NULL;
  END IF;
END $$;

-- 4. Make user_id NOT NULL after backfill
ALTER TABLE expenses ALTER COLUMN user_id SET NOT NULL;

-- 5. Replace allow_all RLS on expenses with role-aware policies
-- First drop existing policies
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'expenses'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON expenses', pol.policyname);
  END LOOP;
END $$;

-- Users SELECT own expenses only
CREATE POLICY expenses_select ON expenses
  FOR SELECT USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Users INSERT own expenses only
CREATE POLICY expenses_insert ON expenses
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

-- Users UPDATE own expenses; admins can update any
CREATE POLICY expenses_update ON expenses
  FOR UPDATE USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- NO DELETE policy (per security requirement)

-- 6. Seed admin profile
INSERT INTO profiles (id, email, full_name, role, is_active)
SELECT id, email, COALESCE(raw_user_meta_data ->> 'full_name', 'Admin'), 'admin', true
FROM auth.users
WHERE email = 'gustavo@targetdial.co'
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 7. Auto-create profile on new user signup (trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_app_meta_data ->> 'role', 'user'),
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Updated_at trigger for profiles
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
