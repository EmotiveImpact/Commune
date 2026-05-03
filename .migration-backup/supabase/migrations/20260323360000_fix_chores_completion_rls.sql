-- Allow active group members to update chores (for completion advancement)
-- This is needed because completeChore() updates next_due and assigned_to after inserting a completion.
CREATE POLICY "Active members can update chores for completion"
  ON chores FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = chores.group_id AND gm.user_id = auth.uid() AND gm.status = 'active'
  ));
