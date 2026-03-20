CREATE TABLE IF NOT EXISTS payment_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_record_id uuid NOT NULL REFERENCES payment_records(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('upcoming', 'overdue')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_record_id, reminder_type)
);

CREATE INDEX idx_payment_reminder_log_record ON payment_reminder_log (payment_record_id);

-- No RLS needed - only accessed by service role in edge function
