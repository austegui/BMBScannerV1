-- Phase 3: Entity cache tables for QBO accounts, classes, vendors
-- All tables use deny-all RLS (same pattern as qbo_connection) — only service_role access.

-- ============================================================================
-- 1. qbo_entity_accounts — Expense + Credit Card accounts from QBO
-- ============================================================================
CREATE TABLE IF NOT EXISTS qbo_entity_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id TEXT NOT NULL,
  qbo_id TEXT NOT NULL,
  name TEXT NOT NULL,
  fully_qualified_name TEXT,
  account_type TEXT NOT NULL,       -- 'Expense' or 'Credit Card'
  account_sub_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(realm_id, qbo_id)
);

ALTER TABLE qbo_entity_accounts ENABLE ROW LEVEL SECURITY;
-- Deny-all: no policies = no access via anon/authenticated roles

-- ============================================================================
-- 2. qbo_entity_classes — QBO classes (job/project tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS qbo_entity_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id TEXT NOT NULL,
  qbo_id TEXT NOT NULL,
  name TEXT NOT NULL,
  fully_qualified_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(realm_id, qbo_id)
);

ALTER TABLE qbo_entity_classes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. qbo_entity_vendors — QBO vendors
-- ============================================================================
CREATE TABLE IF NOT EXISTS qbo_entity_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id TEXT NOT NULL,
  qbo_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(realm_id, qbo_id)
);

ALTER TABLE qbo_entity_vendors ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. Add QBO ID columns to expenses table (used in Phase 4 for Purchase creation)
-- ============================================================================
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS qbo_vendor_id TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS qbo_account_id TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS qbo_account_name TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS qbo_payment_account_id TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS qbo_class_id TEXT;
