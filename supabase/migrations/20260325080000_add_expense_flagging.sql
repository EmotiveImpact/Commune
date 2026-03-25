-- Add expense flagging/query mechanism for trust layer
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS flagged_by uuid[] DEFAULT '{}';
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS flagged_reason text DEFAULT NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS flagged_at timestamptz DEFAULT NULL;
