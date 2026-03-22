-- ─── Group Budgets ──────────────────────────────────────────────────────────
-- Monthly budget targets per group. Used by the dashboard budget widget
-- to show spend-vs-budget progress.

CREATE TABLE IF NOT EXISTS group_budgets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  month           date NOT NULL,
  budget_amount   numeric(12,2) NOT NULL CHECK (budget_amount > 0),
  currency        text NOT NULL DEFAULT 'GBP',
  created_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_group_budget_month UNIQUE (group_id, month)
);

-- Index for fast lookup by group
CREATE INDEX idx_group_budgets_group_id ON group_budgets(group_id);
CREATE INDEX idx_group_budgets_month ON group_budgets(group_id, month);

-- Enable Row Level Security
ALTER TABLE group_budgets ENABLE ROW LEVEL SECURITY;

-- SELECT: any active member of the group can view budgets
CREATE POLICY "Group members can view budgets"
  ON group_budgets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_budgets.group_id
        AND group_members.user_id = auth.uid()
        AND group_members.status = 'active'
    )
  );

-- INSERT: only group admins can create budgets
CREATE POLICY "Group admins can create budgets"
  ON group_budgets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_budgets.group_id
        AND group_members.user_id = auth.uid()
        AND group_members.status = 'active'
        AND group_members.role = 'admin'
    )
    AND created_by = auth.uid()
  );

-- UPDATE: only group admins can update budgets
CREATE POLICY "Group admins can update budgets"
  ON group_budgets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_budgets.group_id
        AND group_members.user_id = auth.uid()
        AND group_members.status = 'active'
        AND group_members.role = 'admin'
    )
  );

-- DELETE: only group admins can delete budgets
CREATE POLICY "Group admins can delete budgets"
  ON group_budgets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_budgets.group_id
        AND group_members.user_id = auth.uid()
        AND group_members.status = 'active'
        AND group_members.role = 'admin'
    )
  );

-- Auto-update updated_at on modification
CREATE OR REPLACE FUNCTION fn_update_group_budget_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_group_budget_updated_at
  BEFORE UPDATE ON group_budgets
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_group_budget_timestamp();
