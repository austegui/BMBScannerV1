-- Backfill profiles for all existing auth.users who don't have one yet
INSERT INTO profiles (id, email, full_name, role, is_active)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data ->> 'full_name', ''),
  COALESCE(u.raw_app_meta_data ->> 'role', 'user'),
  true
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL;
