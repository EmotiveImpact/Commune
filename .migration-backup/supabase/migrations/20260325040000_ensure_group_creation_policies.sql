-- Ensure all group creation policies exist
-- This migration is idempotent — it drops and recreates the critical policies

-- 1. Owner can always read their own groups (needed for INSERT + SELECT return)
DROP POLICY IF EXISTS "groups_owner_can_read" ON groups;
CREATE POLICY "groups_owner_can_read"
  ON groups FOR SELECT
  USING (owner_id = auth.uid());

-- 2. Authenticated users can create groups (where they are the owner)
DROP POLICY IF EXISTS "groups_auth_users_can_create" ON groups;
CREATE POLICY "groups_auth_users_can_create"
  ON groups FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- 3. Ensure the owner trigger is SECURITY DEFINER (can bypass RLS to insert member)
CREATE OR REPLACE FUNCTION fn_add_owner_as_admin()
RETURNS trigger AS $$
BEGIN
  INSERT INTO group_members (group_id, user_id, role, status, effective_from)
  VALUES (NEW.id, NEW.owner_id, 'admin', 'active', CURRENT_DATE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Ensure the trigger exists
DROP TRIGGER IF EXISTS trg_add_owner_as_admin ON groups;
CREATE TRIGGER trg_add_owner_as_admin
  AFTER INSERT ON groups
  FOR EACH ROW
  EXECUTE FUNCTION fn_add_owner_as_admin();
