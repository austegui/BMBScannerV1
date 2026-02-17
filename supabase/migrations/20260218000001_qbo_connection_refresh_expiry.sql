-- Phase 2: Add refresh_token_expires_at to track refresh token expiry
-- Intuit refresh tokens expire after ~100 days (sandbox) or up to 5 years (production).
-- This column enables proactive warnings and prevents silent token death.

ALTER TABLE qbo_connection
  ADD COLUMN refresh_token_expires_at TIMESTAMPTZ;

-- Backfill existing rows with a conservative estimate (token_issued_at + 100 days)
UPDATE qbo_connection
  SET refresh_token_expires_at = token_issued_at + INTERVAL '100 days'
  WHERE refresh_token_expires_at IS NULL;

-- Now make it NOT NULL for all future inserts
ALTER TABLE qbo_connection
  ALTER COLUMN refresh_token_expires_at SET NOT NULL;
