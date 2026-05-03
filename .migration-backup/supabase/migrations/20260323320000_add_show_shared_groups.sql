-- Add privacy control for cross-group visibility
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_shared_groups boolean NOT NULL DEFAULT true;
