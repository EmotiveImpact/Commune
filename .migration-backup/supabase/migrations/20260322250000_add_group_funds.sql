-- ─── Group Funds / Shared Pot ────────────────────────────────────────────────
-- Allows group members to pool money into shared funds, track contributions
-- and record expenses against the pot.

-- ─── group_funds ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_funds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name            text NOT NULL,
  target_amount   numeric(12,2),
  currency        text NOT NULL,
  created_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_funds_group_id ON group_funds(group_id);

ALTER TABLE group_funds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group members can view funds"
  ON group_funds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_funds.group_id
        AND group_members.user_id = auth.uid()
        AND group_members.status = 'active'
    )
  );

CREATE POLICY "Group members can create funds"
  ON group_funds FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_funds.group_id
        AND group_members.user_id = auth.uid()
        AND group_members.status = 'active'
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins can delete funds"
  ON group_funds FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_funds.group_id
        AND group_members.user_id = auth.uid()
        AND group_members.status = 'active'
        AND group_members.role = 'admin'
    )
  );

-- ─── fund_contributions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fund_contributions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id         uuid NOT NULL REFERENCES group_funds(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  contributed_at  timestamptz NOT NULL DEFAULT now(),
  note            text
);

CREATE INDEX idx_fund_contributions_fund_id ON fund_contributions(fund_id);

ALTER TABLE fund_contributions ENABLE ROW LEVEL SECURITY;

-- SELECT: active members of the fund's group can view contributions
CREATE POLICY "Group members can view contributions"
  ON fund_contributions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_funds
      JOIN group_members ON group_members.group_id = group_funds.group_id
      WHERE group_funds.id = fund_contributions.fund_id
        AND group_members.user_id = auth.uid()
        AND group_members.status = 'active'
    )
  );

-- INSERT: active members of the fund's group can add contributions
CREATE POLICY "Group members can add contributions"
  ON fund_contributions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_funds
      JOIN group_members ON group_members.group_id = group_funds.group_id
      WHERE group_funds.id = fund_contributions.fund_id
        AND group_members.user_id = auth.uid()
        AND group_members.status = 'active'
    )
    AND user_id = auth.uid()
  );

-- DELETE: only admins can delete contributions
CREATE POLICY "Admins can delete contributions"
  ON fund_contributions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_funds
      JOIN group_members ON group_members.group_id = group_funds.group_id
      WHERE group_funds.id = fund_contributions.fund_id
        AND group_members.user_id = auth.uid()
        AND group_members.status = 'active'
        AND group_members.role = 'admin'
    )
  );

-- ─── fund_expenses ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fund_expenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id         uuid NOT NULL REFERENCES group_funds(id) ON DELETE CASCADE,
  description     text NOT NULL,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  spent_by        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spent_at        timestamptz NOT NULL DEFAULT now(),
  receipt_url     text
);

CREATE INDEX idx_fund_expenses_fund_id ON fund_expenses(fund_id);

ALTER TABLE fund_expenses ENABLE ROW LEVEL SECURITY;

-- SELECT: active members of the fund's group can view expenses
CREATE POLICY "Group members can view fund expenses"
  ON fund_expenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_funds
      JOIN group_members ON group_members.group_id = group_funds.group_id
      WHERE group_funds.id = fund_expenses.fund_id
        AND group_members.user_id = auth.uid()
        AND group_members.status = 'active'
    )
  );

-- INSERT: active members of the fund's group can add expenses
CREATE POLICY "Group members can add fund expenses"
  ON fund_expenses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_funds
      JOIN group_members ON group_members.group_id = group_funds.group_id
      WHERE group_funds.id = fund_expenses.fund_id
        AND group_members.user_id = auth.uid()
        AND group_members.status = 'active'
    )
    AND spent_by = auth.uid()
  );

-- DELETE: only admins can delete fund expenses
CREATE POLICY "Admins can delete fund expenses"
  ON fund_expenses FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM group_funds
      JOIN group_members ON group_members.group_id = group_funds.group_id
      WHERE group_funds.id = fund_expenses.fund_id
        AND group_members.user_id = auth.uid()
        AND group_members.status = 'active'
        AND group_members.role = 'admin'
    )
  );
