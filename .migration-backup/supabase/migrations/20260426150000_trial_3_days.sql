-- ============================================================================
-- Shorten the auto-created Pro trial from 7 days to 3 days.
--
-- This re-creates handle_new_user() with `interval '3 days'`. Existing rows in
-- subscriptions.trial_ends_at are NOT touched — current trialers keep their
-- 7-day window so we don't burn trust. New signups (or any insert into
-- auth.users from this migration onward) get a 3-day trial.
--
-- Stripe-side trial_period_days is updated separately in
-- supabase/functions/create-checkout-session/index.ts (7 → 3).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite_code text;
  v_invite      RECORD;
BEGIN
  -- Insert profile row (idempotent on re-runs).
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name')
  ON CONFLICT (id) DO NOTHING;

  -- If the user signed up via a free-member invite code, skip the trial.
  v_invite_code := NEW.raw_user_meta_data->>'invite_code';

  IF v_invite_code IS NOT NULL THEN
    SELECT * INTO v_invite
    FROM public.free_member_invites
    WHERE code = v_invite_code AND expires_at > now() AND used_at IS NULL
    LIMIT 1;

    IF FOUND THEN
      -- Free-member path: no trial; mark invite consumed.
      UPDATE public.free_member_invites
      SET used_at = now(), used_by = NEW.id
      WHERE id = v_invite.id;

      INSERT INTO public.subscriptions (user_id, plan, status)
      VALUES (NEW.id, 'free_member', 'active')
      ON CONFLICT (user_id) DO NOTHING;

      RETURN NEW;
    END IF;
  END IF;

  -- Regular signup: 3-day Pro trial.
  INSERT INTO public.subscriptions (
    user_id, plan, status, trial_ends_at, current_period_start, current_period_end
  )
  VALUES (
    NEW.id, 'pro', 'trialing', now() + interval '3 days', now(), now() + interval '3 days'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
