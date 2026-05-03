-- ============================================================================
-- Commune: Recurring Expense Log
-- ============================================================================

CREATE TABLE recurring_expense_log (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_expense_id   uuid        NOT NULL REFERENCES expenses (id) ON DELETE CASCADE,
  generated_expense_id uuid       NOT NULL REFERENCES expenses (id) ON DELETE CASCADE,
  generated_for_month text        NOT NULL,  -- format: 'YYYY-MM'
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_expense_id, generated_for_month)
);

CREATE INDEX idx_recurring_expense_log_source ON recurring_expense_log (source_expense_id);
CREATE INDEX idx_recurring_expense_log_month  ON recurring_expense_log (generated_for_month);

-- ─── Row-Level Security ─────────────────────────────────────────────────────

ALTER TABLE recurring_expense_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_expense_log_members_can_read"
  ON recurring_expense_log FOR SELECT
  USING (
    source_expense_id IN (
      SELECT e.id FROM expenses e
      WHERE e.group_id IN (
        SELECT gm.group_id FROM group_members gm
        WHERE gm.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "recurring_expense_log_admins_can_insert"
  ON recurring_expense_log FOR INSERT
  WITH CHECK (
    source_expense_id IN (
      SELECT e.id FROM expenses e
      WHERE e.group_id IN (
        SELECT gm.group_id FROM group_members gm
        WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
      )
    )
  );
