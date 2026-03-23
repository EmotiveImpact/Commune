-- Fix Critical Bug 1: fn_handle_new_user inserts into generated column 'name'
-- The 20260322200000 migration regressed this function back to writing 'name' directly.
-- Must use first_name/last_name since 'name' is GENERATED ALWAYS.
CREATE OR REPLACE FUNCTION fn_handle_new_user()
RETURNS trigger AS $$
DECLARE
  full_name text;
  fname text;
  lname text;
  has_invite boolean;
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

  -- Create user profile
  INSERT INTO public.users (id, first_name, last_name, email, avatar_url)
  VALUES (
    NEW.id,
    fname,
    lname,
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

-- Fix Critical Bug 2: invite_group_member inserts into generated column 'name'
DROP FUNCTION IF EXISTS public.invite_group_member(uuid, text);

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
  full_name text;
  fname text;
  lname text;
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
    -- Derive name parts
    full_name := COALESCE(
      NULLIF(invited_auth_user.raw_user_meta_data ->> 'name', ''),
      NULLIF(invited_auth_user.raw_user_meta_data ->> 'full_name', ''),
      split_part(invited_auth_user.email, '@', 1)
    );

    IF position(' ' in full_name) > 0 THEN
      fname := left(full_name, position(' ' in full_name) - 1);
      lname := substring(full_name from position(' ' in full_name) + 1);
    ELSE
      fname := full_name;
      lname := '';
    END IF;

    -- Ensure public.users profile exists
    INSERT INTO public.users (id, first_name, last_name, email, avatar_url)
    VALUES (
      invited_auth_user.id,
      fname,
      lname,
      invited_auth_user.email,
      invited_auth_user.raw_user_meta_data ->> 'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.group_members (group_id, user_id, role, status)
    VALUES (target_group_id, invited_auth_user.id, 'member', 'invited')
    ON CONFLICT (group_id, user_id) DO UPDATE
    SET status = CASE
      WHEN public.group_members.status = 'removed' THEN 'invited'
      ELSE public.group_members.status
    END;
  END IF;

  RETURN json_build_object(
    'invite_id', invite_row.id,
    'token', invite_row.token,
    'email', invite_row.email,
    'group_name', v_group_name,
    'inviter_name', v_inviter_name,
    'user_exists', invited_auth_user.id IS NOT NULL
  );
END;
$$;

-- Fix Critical Bug 3: user_payment_methods RLS — co-members need to see payment links
CREATE POLICY "Co-members can view payment methods"
  ON user_payment_methods FOR SELECT
  USING (
    user_id IN (
      SELECT gm.user_id FROM group_members gm
      WHERE gm.group_id IN (
        SELECT gm2.group_id FROM group_members gm2
        WHERE gm2.user_id = auth.uid()
          AND gm2.status = 'active'
      )
      AND gm.status = 'active'
    )
  );

-- Fix High Bug 4: fn_plan_member_limit missing free plan case
CREATE OR REPLACE FUNCTION fn_plan_member_limit(p_plan subscription_plan)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE p_plan
    WHEN 'free' THEN RETURN 8;
    WHEN 'standard' THEN RETURN 8;
    WHEN 'pro' THEN RETURN 15;
    WHEN 'agency' THEN RETURN 999;
  END CASE;
  RETURN 8;
END;
$$;

-- Fix Medium Bug 6: payment_nudges — admins can view all group nudges
CREATE POLICY "Admins can view group nudges"
  ON payment_nudges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = payment_nudges.group_id
        AND gm.user_id = auth.uid()
        AND gm.role = 'admin'
        AND gm.status = 'active'
    )
  );

-- Fix Medium Bug 7: group_funds missing UPDATE policy
CREATE POLICY "Admins can update group funds"
  ON group_funds FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_funds.group_id
        AND gm.user_id = auth.uid()
        AND gm.role = 'admin'
        AND gm.status = 'active'
    )
  );

-- Fix Medium Bug 8a: fund_contributions missing UPDATE policy
CREATE POLICY "Contributors can update own contributions"
  ON fund_contributions FOR UPDATE
  USING (contributed_by = auth.uid());

-- Fix Medium Bug 8b: fund_expenses missing UPDATE policy
CREATE POLICY "Admins can update fund expenses"
  ON fund_expenses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM group_funds gf
      JOIN group_members gm ON gm.group_id = gf.group_id
      WHERE gf.id = fund_expenses.fund_id
        AND gm.user_id = auth.uid()
        AND gm.role = 'admin'
        AND gm.status = 'active'
    )
  );
