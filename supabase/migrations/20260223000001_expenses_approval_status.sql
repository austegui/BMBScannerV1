-- Approval workflow: current-month transactions saved as approved;
-- previous-month transactions require ADAM admin approval before appearing in main list.
--
-- Run this file in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/lgodlepuythshpzayzba/sql
--
-- After running: Add VITE_ADMIN_EMAIL=adam@yourcompany.com to .env
-- (ADAM admin sees "Pending Approval" list and can approve previous-month expenses)

-- Add approval_status column
-- 'approved' = appears in main expense list (current month or admin-approved)
-- 'pending_approval' = waiting for ADAM admin approval (previous month)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (approval_status IN ('approved', 'pending_approval'));

-- Index for pending approval queries (admin list)
CREATE INDEX IF NOT EXISTS idx_expenses_approval_status
  ON expenses (approval_status)
  WHERE approval_status = 'pending_approval';
