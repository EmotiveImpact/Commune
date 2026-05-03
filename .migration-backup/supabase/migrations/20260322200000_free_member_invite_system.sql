-- ============================================================================
-- Free Member Tier + Invite Token System
-- ============================================================================
-- 1. Adds 'free' subscription plan for invited members
-- 2. Creates group_invites table with token-based invite system
-- 3. Rewrites invite_group_member to support non-existing users
-- 4. Creates accept_invite_by_token for token-based acceptance
-- 5. Creates validate_invite_token for public invite page
-- 6. Updates fn_handle_new_user to assign free plan to invited signups
-- 7. Updates fn_get_effective_plan to handle free plan
-- ============================================================================

-- 0. Ensure pgcrypto extension is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Add 'free' to subscription_plan enum
ALTER TYPE subscription_plan ADD VALUE IF NOT EXISTS 'free';

-- 2. Create group_invites table
CREATE TABLE IF NOT EXISTS group_invites (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  email      text        NOT NULL,
  token      text        NOT NULL UNIQUE,
  invited_by uuid        NOT NULL REFERENCES users(id),
  status     text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_invites_token ON group_invites(token);
CREATE INDEX IF NOT EXISTS idx_group_invites_email ON group_invites(email);
CREATE INDEX IF NOT EXISTS idx_group_invites_group_id ON group_invites(group_id);

ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;

-- Group admins can read their group's invites
CREATE POLICY "group_invites_admins_can_read"
  ON group_invites FOR SELECT
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.role = 'admin' AND gm.status = 'active'
    )
  );

-- Authenticated users can read invites sent to their email
CREATE POLICY "group_invites_user_can_read_own"
  ON group_invites FOR SELECT
  USING (
    lower(email) = lower(
      (SELECT u.email FROM users u WHERE u.id = auth.uid())
    )
  );

-- 3. validate_invite_token — public RPC for the invite page (no auth required)
CREATE OR REPLACE FUNCTION public.validate_invite_token(p_token text)
RETURNS TABLE (
  invite_id uuid,
  group_id uuid,
  group_name text,
  email text,
  invited_by_name text,
  status text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    gi.id,
    gi.group_id,
    g.name,
    gi.email,
    u.name,
    gi.status,
    gi.expires_at
  FROM group_invites gi
  JOIN groups g ON g.id = gi.group_id
  JOIN users u ON u.id = gi.invited_by
  WHERE gi.token = p_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_invite_token(text) TO anon, authenticated;

-- 4. Drop old invite_group_member (return type changed from group_members to json)
DROP FUNCTION IF EXISTS public.invite_group_member(uuid, text);

-- Rewrite invite_group_member — now supports non-existing users
CREATE OR REPLACE FUNCTION public.invite_group_member(
  target_group_id uuid,
  target_email text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  invited_auth_user auth.users%ROWTYPE;
  invite_row public.group_invites%ROWTYPE;
  v_token text;
  v_group_name text;
  v_inviter_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_group_admin(target_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only group admins can invite members';
  END IF;

  -- Check for existing pending invite
  SELECT * INTO invite_row
  FROM public.group_invites
  WHERE group_id = target_group_id
    AND lower(email) = lower(target_email)
    AND status = 'pending'
    AND expires_at > now()
  LIMIT 1;

  IF invite_row.id IS NOT NULL THEN
    RAISE EXCEPTION 'A pending invite already exists for this email';
  END IF;

  -- Get group name and inviter name for the response
  SELECT g.name INTO v_group_name FROM public.groups g WHERE g.id = target_group_id;
  SELECT u.name INTO v_inviter_name FROM public.users u WHERE u.id = auth.uid();

  -- Generate token
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  -- Create invite record
  INSERT INTO public.group_invites (group_id, email, token, invited_by)
  VALUES (target_group_id, lower(target_email), v_token, auth.uid())
  RETURNING * INTO invite_row;

  -- If user already exists in auth.users, also create group_members row
  SELECT * INTO invited_auth_user
  FROM auth.users
  WHERE lower(email) = lower(target_email)
  LIMIT 1;

  IF invited_auth_user.id IS NOT NULL THEN
    -- Ensure public.users profile exists
    INSERT INTO public.users (id, name, email, avatar_url)
    VALUES (
      invited_auth_user.id,
      COALESCE(
        NULLIF(invited_auth_user.raw_user_meta_data ->> 'name', ''),
        NULLIF(invited_auth_user.raw_user_meta_data ->> 'full_name', ''),
        split_part(invited_auth_user.email, '@', 1)
      ),
      invited_auth_user.email,
      invited_auth_user.raw_user_meta_data ->> 'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.group_members (group_id, user_id, role, status)
    VALUES (target_group_id, invited_auth_user.id, 'member', 'invited')
    ON CONFLICT (group_id, user_id) DO UPDATE
    SET status = CASE
      WHEN group_members.status = 'removed' THEN 'invited'
      ELSE group_members.status
    END;
  END IF;

  -- Return invite details (needed for email sending)
  RETURN json_build_object(
    'invite_id', invite_row.id,
    'token', invite_row.token,
    'email', invite_row.email,
    'group_id', invite_row.group_id,
    'group_name', v_group_name,
    'inviter_name', v_inviter_name,
    'existing_user', invited_auth_user.id IS NOT NULL
  );
END;
$$;

-- 5. accept_invite_by_token — token-based acceptance
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

  -- Insert or update group_members
  INSERT INTO public.group_members (group_id, user_id, role, status)
  VALUES (v_invite.group_id, auth.uid(), 'member', 'active')
  ON CONFLICT (group_id, user_id) DO UPDATE
  SET status = 'active', joined_at = now()
  RETURNING * INTO v_member;

  RETURN v_member;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invite_by_token(text) TO authenticated;

-- 6. Update fn_handle_new_user — free plan for invited signups
CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS trigger AS $$
DECLARE
  full_name text;
  has_invite boolean;
BEGIN
  full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'user_name', ''),
    split_part(NEW.email, '@', 1)
  );

  -- Create user profile
  INSERT INTO public.users (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    full_name,
    NEW.email,
    NEW.raw_user_meta_data ->> 'avatar_url'
  );

  -- Check if this user has pending invites
  SELECT EXISTS(
    SELECT 1 FROM public.group_invites
    WHERE lower(email) = lower(NEW.email) AND status = 'pending'
  ) INTO has_invite;

  IF has_invite THEN
    -- Invited user gets a free plan (no trial, no paywall)
    INSERT INTO public.subscriptions (
      user_id, plan, status, trial_ends_at, current_period_start, current_period_end
    ) VALUES (
      NEW.id, 'free', 'active', '2099-12-31'::timestamptz, now(), '2099-12-31'::timestamptz
    );
  ELSE
    -- Regular signup: 7-day Pro trial
    INSERT INTO public.subscriptions (
      user_id, plan, status, trial_ends_at, current_period_start, current_period_end
    ) VALUES (
      NEW.id, 'pro', 'trialing', now() + interval '7 days', now(), now() + interval '7 days'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Update fn_get_effective_plan — handle free plan
CREATE OR REPLACE FUNCTION fn_get_effective_plan(p_user_id uuid)
RETURNS subscription_plan
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan   subscription_plan;
  v_status subscription_status;
  v_trial_ends timestamptz;
BEGIN
  SELECT s.plan, s.status, s.trial_ends_at
    INTO v_plan, v_status, v_trial_ends
    FROM subscriptions s
   WHERE s.user_id = p_user_id
   LIMIT 1;

  -- No subscription at all → standard (locked out)
  IF v_plan IS NULL THEN RETURN 'standard'; END IF;

  -- Free plan is always valid when active
  IF v_plan = 'free' AND v_status = 'active' THEN RETURN 'free'; END IF;

  -- Cancelled or past_due → standard (locked out)
  IF v_status IN ('cancelled', 'past_due') THEN RETURN 'standard'; END IF;

  -- Trialing but expired → standard (locked out)
  IF v_status = 'trialing' AND v_trial_ends < now() THEN RETURN 'standard'; END IF;

  -- Active or valid trial → return their plan
  RETURN v_plan;
END;
$$;
