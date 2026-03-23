-- Add configurable alert threshold to group budgets
ALTER TABLE group_budgets
ADD COLUMN IF NOT EXISTS alert_threshold integer NOT NULL DEFAULT 80;
