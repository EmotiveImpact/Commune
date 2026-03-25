-- V4 Stage 8: Space Essentials 2.0 and shared operations board fields

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS space_essentials jsonb;

ALTER TABLE chores
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('cleaning', 'supplies', 'admin', 'setup', 'shutdown', 'maintenance', 'other')),
  ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'recurring'
    CHECK (task_type IN ('recurring', 'one_off', 'checklist')),
  ADD COLUMN IF NOT EXISTS checklist_items jsonb,
  ADD COLUMN IF NOT EXISTS escalation_days integer
    CHECK (escalation_days IS NULL OR escalation_days >= 0);
