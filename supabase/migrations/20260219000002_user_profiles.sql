-- User profiles for staff: full name, initials, role.
-- Profiles are created on first login or signup.
-- Set role='admin' for Adam via: UPDATE user_profiles SET role = 'admin' WHERE ...;

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  initials TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('staff', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Index for fast lookup by user_id (auth session)
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- RLS: users can read their own profile; service role for all writes.
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- No INSERT/UPDATE via anon/authenticated; app will use service role or a secured RPC.
-- For signup flow, we need a way to create profiles. Option: allow authenticated insert for own user_id.
CREATE POLICY "users_insert_own_profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own_profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add created_by to expenses for audit (who entered the transaction)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);

-- Trigger: create profile on signup when metadata includes full_name/initials.
-- Client signUp passes options: { data: { full_name, initials } }.
-- If client insert fails (e.g. email confirmation), this ensures profile exists.
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn TEXT;
  inits TEXT;
BEGIN
  fn := COALESCE(
    nullif(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(COALESCE(NEW.email, ''), '@', 1),
    'User'
  );
  inits := COALESCE(
    nullif(trim(NEW.raw_user_meta_data->>'initials'), ''),
    upper(left(regexp_replace(fn, '\s+', ' ', 'g'), 2)),
    'U'
  );
  INSERT INTO public.user_profiles (user_id, full_name, initials, role)
  VALUES (NEW.id, fn, inits, 'staff')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();
