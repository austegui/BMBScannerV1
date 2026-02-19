-- Add approval_status column for current-month vs previous-month rule
-- Values: 'auto_ok' (current month, can submit), 'pending_approval' (previous month, needs admin),
--         'approved' (admin approved), 'rejected' (admin rejected)
-- Existing rows get 'auto_ok' for backwards compatibility
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'auto_ok';

-- Index for admin queue (pending approval list)
CREATE INDEX IF NOT EXISTS idx_expenses_approval_status
  ON expenses (approval_status)
  WHERE approval_status = 'pending_approval';
