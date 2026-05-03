-- Add sub-type for more specific group categorisation
-- Appears as a secondary selector when creating/editing a group.
ALTER TABLE groups ADD COLUMN IF NOT EXISTS subtype text DEFAULT NULL;
