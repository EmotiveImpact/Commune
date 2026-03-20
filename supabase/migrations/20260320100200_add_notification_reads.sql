-- Track which notifications a user has read.
-- notification_id is a virtual ID like "expense-<uuid>" or "payment-<uuid>"
-- since notifications are derived, not stored as rows themselves.

CREATE TABLE IF NOT EXISTS notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id text NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, notification_id)
);

-- Index for fast lookup by user
CREATE INDEX idx_notification_reads_user ON notification_reads (user_id);

-- RLS
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_read_own_notification_reads"
  ON notification_reads FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_can_insert_own_notification_reads"
  ON notification_reads FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_can_delete_own_notification_reads"
  ON notification_reads FOR DELETE
  USING (user_id = auth.uid());
