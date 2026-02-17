-- Create expenses table (if not already created via Supabase dashboard)
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor TEXT NOT NULL,
  date TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  tax NUMERIC,
  memo TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on expenses
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (no auth system in Phase 1)
CREATE POLICY "allow_all_expenses" ON expenses
  FOR ALL USING (true) WITH CHECK (true);

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
