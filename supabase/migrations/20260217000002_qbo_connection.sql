-- Enable Vault extension (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS vault WITH SCHEMA vault;

-- QBO connection metadata table
-- Stores realm_id and Vault secret UUIDs (NOT the tokens themselves)
CREATE TABLE IF NOT EXISTS qbo_connection (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id                 TEXT NOT NULL UNIQUE,
  company_name             TEXT,
  token_vault_id           UUID NOT NULL,
  refresh_token_vault_id   UUID NOT NULL,
  token_expires_at         TIMESTAMPTZ NOT NULL,
  token_issued_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  connected_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active                BOOLEAN NOT NULL DEFAULT true
);

-- RLS: deny all access to non-service_role callers
ALTER TABLE qbo_connection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all_users" ON qbo_connection
  FOR ALL USING (false);

-- Vault wrapper functions (SECURITY DEFINER, service_role only)
-- These allow Edge Functions to call vault operations via .rpc()

CREATE OR REPLACE FUNCTION create_vault_secret(secret TEXT, name TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result UUID;
BEGIN
  SELECT id INTO result FROM vault.create_secret(secret, name);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION create_vault_secret(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_vault_secret(TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION read_vault_secret(secret_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT decrypted_secret INTO result
  FROM vault.decrypted_secrets
  WHERE id = secret_id;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION read_vault_secret(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION read_vault_secret(UUID) TO service_role;

-- update_vault_secret: Provisioned for Phase 2 token rotation.
-- No Phase 1 caller expected -- this function will be used when
-- implementing automatic token refresh in Phase 2.
CREATE OR REPLACE FUNCTION update_vault_secret(secret_id UUID, new_secret TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM vault.update_secret(secret_id, new_secret);
END;
$$;
REVOKE ALL ON FUNCTION update_vault_secret(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_vault_secret(UUID, TEXT) TO service_role;
