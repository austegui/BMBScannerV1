-- Staff accounts: track which staff member created each expense.
-- Staff can upload; admin receives previous-month ones via Pending Approval list.
-- Admin = user_metadata.role='admin' OR VITE_ADMIN_EMAIL; everyone else = staff.
--
-- Run this file in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/lgodlepuythshpzayzba/sql

-- user_id: links to auth.users (who created this expense - staff member)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- created_by_email: staff email for display (e.g. "Uploaded by staff@company.com")
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS created_by_email TEXT;

-- Index for admin queries (expenses by user)
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses (user_id);
