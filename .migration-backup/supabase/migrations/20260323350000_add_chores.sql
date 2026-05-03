-- Chores / shared tasks system (F41)

CREATE TABLE IF NOT EXISTS chores (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title           text        NOT NULL,
  description     text,
  frequency       text        NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'once')),
  assigned_to     uuid        REFERENCES users(id) ON DELETE SET NULL,
  rotation_order  jsonb,
  next_due        date        NOT NULL DEFAULT CURRENT_DATE,
  created_by      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chore_completions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  chore_id        uuid        NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
  completed_by    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chores_group_id ON chores(group_id);
CREATE INDEX IF NOT EXISTS idx_chore_completions_chore_id ON chore_completions(chore_id);

-- RLS
ALTER TABLE chores ENABLE ROW LEVEL SECURITY;
ALTER TABLE chore_completions ENABLE ROW LEVEL SECURITY;

-- Active group members can view chores
CREATE POLICY "Group members can view chores"
  ON chores FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = chores.group_id AND gm.user_id = auth.uid() AND gm.status = 'active'
  ));

-- Active group members can create chores
CREATE POLICY "Group members can create chores"
  ON chores FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = chores.group_id AND gm.user_id = auth.uid() AND gm.status = 'active'
  ));

-- Admins can update/delete chores
CREATE POLICY "Admins can update chores"
  ON chores FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = chores.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
  ));

CREATE POLICY "Admins can delete chores"
  ON chores FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = chores.group_id AND gm.user_id = auth.uid() AND gm.role = 'admin'
  ));

-- Completion policies
CREATE POLICY "Group members can view completions"
  ON chore_completions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM chores c
    JOIN group_members gm ON gm.group_id = c.group_id
    WHERE c.id = chore_completions.chore_id AND gm.user_id = auth.uid() AND gm.status = 'active'
  ));

CREATE POLICY "Group members can insert completions"
  ON chore_completions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM chores c
    JOIN group_members gm ON gm.group_id = c.group_id
    WHERE c.id = chore_completions.chore_id AND gm.user_id = auth.uid() AND gm.status = 'active'
  ));
