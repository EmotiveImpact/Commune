CREATE OR REPLACE FUNCTION public.accept_group_invite(target_group_id uuid)
RETURNS public.group_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  accepted_member public.group_members%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.group_members
  SET
    status = 'active',
    joined_at = COALESCE(joined_at, timezone('utc', now()))
  WHERE group_id = target_group_id
    AND user_id = current_user_id
    AND status = 'invited'
  RETURNING * INTO accepted_member;

  IF accepted_member.id IS NULL THEN
    RAISE EXCEPTION 'Invite not found or already accepted';
  END IF;

  RETURN accepted_member;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_group_invite(uuid) TO authenticated;
