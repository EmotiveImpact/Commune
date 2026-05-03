-- ─── Split Templates ─────────────────────────────────────────────────────────
-- Allows users to save reusable split configurations (participants + method)
-- that can be applied when creating new expenses.

CREATE TABLE IF NOT EXISTS split_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name            text NOT NULL,
  split_method    split_method NOT NULL DEFAULT 'equal',
  participants    jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by group
CREATE INDEX idx_split_templates_group_id ON split_templates(group_id);

-- Enable Row Level Security
ALTER TABLE split_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: any active member of the group can view templates
CREATE POLICY "Group members can view templates"
  ON split_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = split_templates.group_id
        AND group_members.user_id = auth.uid()
        AND group_members.status = 'active'
    )
  );

-- INSERT: any active member of the group can create templates
CREATE POLICY "Group members can create templates"
  ON split_templates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = split_templates.group_id
        AND group_members.user_id = auth.uid()
        AND group_members.status = 'active'
    )
    AND created_by = auth.uid()
  );

-- UPDATE: only the creator or a group admin can update
CREATE POLICY "Creator or admin can update templates"
  ON split_templates FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = split_templates.group_id
        AND group_members.user_id = auth.uid()
        AND group_members.status = 'active'
        AND group_members.role = 'admin'
    )
  );

-- DELETE: only the creator or a group admin can delete
CREATE POLICY "Creator or admin can delete templates"
  ON split_templates FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = split_templates.group_id
        AND group_members.user_id = auth.uid()
        AND group_members.status = 'active'
        AND group_members.role = 'admin'
    )
  );
