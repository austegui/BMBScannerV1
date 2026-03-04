-- Phase 7: QuickBooks Desktop integration tables
-- Replaces QBO OAuth with QBWC poll-based architecture

-- QBD connection config (replaces qbo_connection for new installs)
CREATE TABLE IF NOT EXISTS qbd_connection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT UNIQUE NOT NULL,
  company_name TEXT,
  soap_password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_interval_minutes INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- deny-all RLS (only service_role can access)
ALTER TABLE qbd_connection ENABLE ROW LEVEL SECURITY;

-- Sync queue: all requests to/from QBD go through this table
CREATE TABLE IF NOT EXISTS qbd_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT REFERENCES qbd_connection(company_id),
  request_type TEXT NOT NULL,
  qbxml_request TEXT,
  qbxml_response TEXT,
  status TEXT DEFAULT 'pending',
  related_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- deny-all RLS
ALTER TABLE qbd_sync_queue ENABLE ROW LEVEL SECURITY;

-- Index for SOAP server polling (find pending items quickly)
CREATE INDEX idx_qbd_sync_queue_pending
  ON qbd_sync_queue (company_id, status)
  WHERE status IN ('pending', 'sent');

-- Add entity full names to expenses (QBD uses FullName strings, not numeric IDs)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS qbo_vendor_name TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS qbo_account_full_name TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS qbo_payment_account_name TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS qbo_class_name TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS qbd_queue_id UUID;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS qbd_sync_status TEXT DEFAULT 'pending';
