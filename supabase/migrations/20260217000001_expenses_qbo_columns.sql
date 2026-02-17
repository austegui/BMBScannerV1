-- QBO sync columns for expenses table
-- Safe: uses IF NOT EXISTS, all new columns are nullable except qbo_sync_attempts (defaults to 0)

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS qbo_purchase_id TEXT,
  ADD COLUMN IF NOT EXISTS qbo_pushed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qbo_error TEXT,
  ADD COLUMN IF NOT EXISTS qbo_sync_attempts INTEGER NOT NULL DEFAULT 0;

-- Index for efficient "unsynced expenses" queries (partial index on unpushed rows)
CREATE INDEX IF NOT EXISTS idx_expenses_qbo_sync
  ON expenses (qbo_pushed_at, qbo_sync_attempts)
  WHERE qbo_pushed_at IS NULL;
