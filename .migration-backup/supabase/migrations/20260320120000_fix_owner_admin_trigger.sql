-- Fix: fn_add_owner_as_admin must be SECURITY DEFINER to bypass RLS
-- When a new group is created, the owner isn't a member yet, so the
-- group_members INSERT policy (requires is_group_admin) blocks the trigger.

CREATE OR REPLACE FUNCTION fn_add_owner_as_admin()
RETURNS trigger AS $$
BEGIN
  INSERT INTO group_members (group_id, user_id, role, status)
  VALUES (NEW.id, NEW.owner_id, 'admin', 'active');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
