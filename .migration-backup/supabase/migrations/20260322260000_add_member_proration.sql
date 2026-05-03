-- ============================================================================
-- Member Proration: effective_from / effective_until for mid-cycle join/leave
-- ============================================================================
-- Adds two nullable date columns to group_members so expenses can be prorated
-- when a member joins or leaves mid-billing-cycle.
--
-- effective_from  — date from which the member is included in expense splits
-- effective_until — date after which the member is excluded (null = still active)
-- ============================================================================

-- 1. Add columns
ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS effective_from  date,
  ADD COLUMN IF NOT EXISTS effective_until date;

-- 2. Back-fill existing active members: set effective_from to their joined_at date
UPDATE group_members
SET effective_from = (joined_at AT TIME ZONE 'UTC')::date
WHERE status = 'active' AND effective_from IS NULL;

-- 3. Back-fill removed members: set effective_until to now for already-removed rows
UPDATE group_members
SET effective_until = CURRENT_DATE
WHERE status = 'removed' AND effective_until IS NULL;

-- 4. Update accept_group_invite to set effective_from on acceptance
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
    joined_at = COALESCE(joined_at, timezone('utc', now())),
    effective_from = CURRENT_DATE
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

-- 5. Update accept_invite_by_token to set effective_from on acceptance
CREATE OR REPLACE FUNCTION public.accept_invite_by_token(p_token text)
RETURNS public.group_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.group_invites%ROWTYPE;
  v_member public.group_members%ROWTYPE;
  v_user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get current user's email
  SELECT email INTO v_user_email FROM public.users WHERE id = auth.uid();

  -- Find the invite
  SELECT * INTO v_invite
  FROM public.group_invites
  WHERE token = p_token AND status = 'pending'
  LIMIT 1;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invite not found or already used';
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.group_invites SET status = 'expired' WHERE id = v_invite.id;
    RAISE EXCEPTION 'Invite has expired';
  END IF;

  -- Verify email matches (case-insensitive)
  IF lower(v_user_email) != lower(v_invite.email) THEN
    RAISE EXCEPTION 'This invite was sent to a different email address';
  END IF;

  -- Mark invite as accepted
  UPDATE public.group_invites SET status = 'accepted' WHERE id = v_invite.id;

  -- Insert or update group_members with effective_from
  INSERT INTO public.group_members (group_id, user_id, role, status, effective_from)
  VALUES (v_invite.group_id, auth.uid(), 'member', 'active', CURRENT_DATE)
  ON CONFLICT (group_id, user_id) DO UPDATE
  SET status = 'active',
      joined_at = now(),
      effective_from = CURRENT_DATE,
      effective_until = NULL
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$;

-- 6. Update fn_add_owner_as_admin to set effective_from for group creators
CREATE OR REPLACE FUNCTION fn_add_owner_as_admin()
RETURNS trigger AS $$
BEGIN
  INSERT INTO group_members (group_id, user_id, role, status, effective_from)
  VALUES (NEW.id, NEW.owner_id, 'admin', 'active', CURRENT_DATE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
