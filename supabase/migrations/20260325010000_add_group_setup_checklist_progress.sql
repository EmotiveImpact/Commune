ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS setup_checklist_progress jsonb NOT NULL DEFAULT '{}'::jsonb;
