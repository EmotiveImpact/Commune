-- Add group-level toggle for payment nudges (default enabled for existing groups)
ALTER TABLE groups ADD COLUMN nudges_enabled boolean NOT NULL DEFAULT true;
