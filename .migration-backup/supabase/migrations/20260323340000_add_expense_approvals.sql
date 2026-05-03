-- Expense approval workflow
-- Expenses above the group threshold require admin approval before becoming active.

-- Add approval fields to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
  CHECK (approval_status IN ('approved', 'pending', 'rejected'));
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Add threshold to groups (null = no approval needed)
ALTER TABLE groups ADD COLUMN IF NOT EXISTS approval_threshold numeric DEFAULT NULL;
