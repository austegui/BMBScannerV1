-- QBO connection table
-- Stores tokens directly (protected by deny-all RLS — only service_role can access)
-- Vault extension not available on this Supabase plan, so tokens are stored in-table.
CREATE TABLE IF NOT EXISTS qbo_connection (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id                 TEXT NOT NULL UNIQUE,
  company_name             TEXT,
  access_token             TEXT NOT NULL,
  refresh_token            TEXT NOT NULL,
  token_expires_at         TIMESTAMPTZ NOT NULL,
  token_issued_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  connected_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active                BOOLEAN NOT NULL DEFAULT true
);

-- RLS: deny all access to non-service_role callers
-- Tokens are ONLY accessible server-side via the Edge Function's service_role client
ALTER TABLE qbo_connection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all_users" ON qbo_connection
  FOR ALL USING (false);
