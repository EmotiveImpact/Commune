-- Add pinned message / announcement to groups
ALTER TABLE groups ADD COLUMN IF NOT EXISTS pinned_message text DEFAULT NULL;
