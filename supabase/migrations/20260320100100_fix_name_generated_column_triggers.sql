-- Fix: fn_handle_new_user and invite_group_member both write to the "name"
-- column which is now GENERATED ALWAYS. This breaks new user signup and
-- the invite flow. Update both to write first_name/last_name instead.

-- 1. Fix the new-user trigger
CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS trigger AS $$
DECLARE
  full_name text;
  fname text;
  lname text;
BEGIN
  full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'user_name', ''),
    split_part(NEW.email, '@', 1)
  );

  IF position(' ' in full_name) > 0 THEN
    fname := left(full_name, position(' ' in full_name) - 1);
    lname := substring(full_name from position(' ' in full_name) + 1);
  ELSE
    fname := full_name;
    lname := '';
  END IF;

  INSERT INTO public.users (id, first_name, last_name, email, avatar_url)
  VALUES (
    NEW.id,
    fname,
    lname,
    NEW.email,
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix the invite RPC
CREATE OR REPLACE FUNCTION public.invite_group_member(
  target_group_id uuid,
  target_email text
)
RETURNS public.group_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  invited_auth_user auth.users%ROWTYPE;
  invited_member public.group_members%ROWTYPE;
  full_name text;
  fname text;
  lname text;
  derived_avatar text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_group_admin(target_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only group admins can invite members';
  END IF;

  SELECT *
  INTO invited_auth_user
  FROM auth.users
  WHERE lower(email) = lower(target_email)
  LIMIT 1;

  IF invited_auth_user.id IS NULL THEN
    RAISE EXCEPTION 'User not found with that email';
  END IF;

  full_name := COALESCE(
    NULLIF(invited_auth_user.raw_user_meta_data ->> 'name', ''),
    NULLIF(invited_auth_user.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(invited_auth_user.raw_user_meta_data ->> 'user_name', ''),
    split_part(invited_auth_user.email, '@', 1)
  );
  derived_avatar := invited_auth_user.raw_user_meta_data ->> 'avatar_url';

  IF position(' ' in full_name) > 0 THEN
    fname := left(full_name, position(' ' in full_name) - 1);
    lname := substring(full_name from position(' ' in full_name) + 1);
  ELSE
    fname := full_name;
    lname := '';
  END IF;

  INSERT INTO public.users (id, first_name, last_name, email, avatar_url)
  VALUES (
    invited_auth_user.id,
    fname,
    lname,
    invited_auth_user.email,
    derived_avatar
  )
  ON CONFLICT (id) DO UPDATE
  SET
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), public.users.first_name),
    last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), public.users.last_name),
    email = EXCLUDED.email,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url);

  INSERT INTO public.group_members (group_id, user_id, role, status)
  VALUES (target_group_id, invited_auth_user.id, 'member', 'invited')
  ON CONFLICT (group_id, user_id) DO UPDATE
  SET status = CASE
    WHEN public.group_members.status = 'removed' THEN 'invited'
    ELSE public.group_members.status
  END
  RETURNING * INTO invited_member;

  RETURN invited_member;
END;
$$;

-- 3. Add DELETE policy for payment_records (Bug 3 — orphaned records on expense edit)
CREATE POLICY "payment_records_admins_can_delete"
  ON payment_records FOR DELETE
  USING (
    expense_id IN (
      SELECT e.id FROM expenses e
      WHERE e.group_id IN (
        SELECT gm.group_id FROM group_members gm
        WHERE gm.user_id = auth.uid() AND gm.role = 'admin'
      )
    )
  );

-- Also allow the expense creator to delete payment records
CREATE POLICY "payment_records_creator_can_delete"
  ON payment_records FOR DELETE
  USING (
    expense_id IN (
      SELECT e.id FROM expenses e
      WHERE e.created_by = auth.uid()
    )
  );

-- 4. Fix soft_delete_account to transfer ownership before leaving (Bug 13 & 19)
CREATE OR REPLACE FUNCTION soft_delete_account()
RETURNS void AS $$
DECLARE
  _uid uuid := auth.uid();
  _group record;
  _new_owner uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Transfer ownership of owned groups to another active admin, or soft-delete group
  FOR _group IN
    SELECT id FROM groups WHERE owner_id = _uid
  LOOP
    SELECT gm.user_id INTO _new_owner
    FROM group_members gm
    WHERE gm.group_id = _group.id
      AND gm.user_id != _uid
      AND gm.role = 'admin'
      AND gm.status = 'active'
    LIMIT 1;

    IF _new_owner IS NOT NULL THEN
      UPDATE groups SET owner_id = _new_owner WHERE id = _group.id;
    ELSE
      -- No other admin — try any active member
      SELECT gm.user_id INTO _new_owner
      FROM group_members gm
      WHERE gm.group_id = _group.id
        AND gm.user_id != _uid
        AND gm.status = 'active'
      LIMIT 1;

      IF _new_owner IS NOT NULL THEN
        UPDATE group_members SET role = 'admin' WHERE group_id = _group.id AND user_id = _new_owner;
        UPDATE groups SET owner_id = _new_owner WHERE id = _group.id;
      END IF;
      -- If no members at all, the group becomes orphaned but harmless
    END IF;
  END LOOP;

  -- Anonymise the user profile
  UPDATE users
  SET
    first_name = 'Deleted',
    last_name  = 'User',
    email      = _uid::text || '@deleted.commune.app',
    avatar_url = NULL
  WHERE id = _uid;

  -- Mark all group memberships as removed
  UPDATE group_members
  SET status = 'removed'
  WHERE user_id = _uid AND status != 'removed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
