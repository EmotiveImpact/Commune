-- Group cycle closures / monthly close state (V4 Stage 8)

CREATE TABLE IF NOT EXISTS group_cycle_closures (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  cycle_start     date        NOT NULL,
  cycle_end       date        NOT NULL,
  closed_by       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  closed_at       timestamptz NOT NULL DEFAULT now(),
  notes           text,
  reopened_at     timestamptz,
  reopened_by     uuid        REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT group_cycle_closures_window_unique UNIQUE (group_id, cycle_start, cycle_end)
);

CREATE INDEX IF NOT EXISTS idx_group_cycle_closures_group_id
  ON group_cycle_closures(group_id);

CREATE INDEX IF NOT EXISTS idx_group_cycle_closures_group_window
  ON group_cycle_closures(group_id, cycle_start DESC);

CREATE OR REPLACE FUNCTION set_group_cycle_closures_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_group_cycle_closures_updated_at ON group_cycle_closures;
CREATE TRIGGER trg_group_cycle_closures_updated_at
  BEFORE UPDATE ON group_cycle_closures
  FOR EACH ROW
  EXECUTE FUNCTION set_group_cycle_closures_updated_at();

ALTER TABLE group_cycle_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active members can view cycle closures"
  ON group_cycle_closures FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM group_members gm
    WHERE gm.group_id = group_cycle_closures.group_id
      AND gm.user_id = auth.uid()
      AND gm.status = 'active'
  ));

CREATE POLICY "Admins can insert cycle closures"
  ON group_cycle_closures FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1
    FROM group_members gm
    WHERE gm.group_id = group_cycle_closures.group_id
      AND gm.user_id = auth.uid()
      AND gm.status = 'active'
      AND gm.role = 'admin'
  ));

CREATE POLICY "Admins can update cycle closures"
  ON group_cycle_closures FOR UPDATE
  USING (EXISTS (
    SELECT 1
    FROM group_members gm
    WHERE gm.group_id = group_cycle_closures.group_id
      AND gm.user_id = auth.uid()
      AND gm.status = 'active'
      AND gm.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM group_members gm
    WHERE gm.group_id = group_cycle_closures.group_id
      AND gm.user_id = auth.uid()
      AND gm.status = 'active'
      AND gm.role = 'admin'
  ));
