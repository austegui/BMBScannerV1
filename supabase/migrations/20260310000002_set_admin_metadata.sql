-- Set admin role in app_metadata for the admin user
-- This is needed so the JWT contains app_metadata.role = 'admin'
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'gustavo@targetdial.co';
