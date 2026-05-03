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
  derived_name text;
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

  derived_name := COALESCE(
    NULLIF(invited_auth_user.raw_user_meta_data ->> 'name', ''),
    NULLIF(invited_auth_user.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(invited_auth_user.raw_user_meta_data ->> 'user_name', ''),
    split_part(invited_auth_user.email, '@', 1)
  );
  derived_avatar := invited_auth_user.raw_user_meta_data ->> 'avatar_url';

  INSERT INTO public.users (id, name, email, avatar_url)
  VALUES (
    invited_auth_user.id,
    derived_name,
    invited_auth_user.email,
    derived_avatar
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = COALESCE(NULLIF(EXCLUDED.name, ''), public.users.name),
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
