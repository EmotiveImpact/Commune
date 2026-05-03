-- Fix: fn_add_owner_as_admin lost SECURITY DEFINER when proration migration
-- (20260322260000) recreated it. Without SECURITY DEFINER, the trigger cannot
-- insert into group_members due to RLS policies, causing group creation to fail.

CREATE OR REPLACE FUNCTION fn_add_owner_as_admin()
RETURNS trigger AS $$
BEGIN
  INSERT INTO group_members (group_id, user_id, role, status, effective_from)
  VALUES (NEW.id, NEW.owner_id, 'admin', 'active', CURRENT_DATE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
