-- Group memories — shared moments and culture layer
CREATE TABLE IF NOT EXISTS group_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  photo_url text,
  memory_date date,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_memories_group ON group_memories(group_id);
ALTER TABLE group_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active members can view memories"
  ON group_memories FOR SELECT TO authenticated
  USING (group_id IN (
    SELECT gm.group_id FROM group_members gm
    WHERE gm.user_id = auth.uid() AND gm.status = 'active'
  ));

CREATE POLICY "Active members can add memories"
  ON group_memories FOR INSERT TO authenticated
  WITH CHECK (group_id IN (
    SELECT gm.group_id FROM group_members gm
    WHERE gm.user_id = auth.uid() AND gm.status = 'active'
  ));

CREATE POLICY "Creator or admin can delete memories"
  ON group_memories FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_group_admin(group_id, auth.uid())
  );
