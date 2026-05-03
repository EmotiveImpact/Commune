-- ============================================================================
-- Trial Subscription System
-- ============================================================================
-- Every new user gets a 7-day Pro trial automatically.
-- After trial expires, users must choose a plan (standard, pro, agency).
-- No free tier — expired trials are locked out.
-- ============================================================================

-- 1. Allow trial subscriptions without Stripe IDs (nullable for trials)
ALTER TABLE subscriptions
  ALTER COLUMN stripe_customer_id DROP NOT NULL,
  ALTER COLUMN stripe_subscription_id DROP NOT NULL;

-- 2. Update fn_handle_new_user to auto-create a trial subscription
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

  -- Create user profile
  INSERT INTO public.users (id, first_name, last_name, email, avatar_url)
  VALUES (
    NEW.id,
    fname,
    lname,
    NEW.email,
    NEW.raw_user_meta_data ->> 'avatar_url'
  );

  -- Auto-create 7-day Pro trial subscription
  INSERT INTO public.subscriptions (
    user_id,
    plan,
    status,
    trial_ends_at,
    current_period_start,
    current_period_end
  ) VALUES (
    NEW.id,
    'pro',
    'trialing',
    now() + interval '7 days',
    now(),
    now() + interval '7 days'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update fn_get_effective_plan to lock out expired trials
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
  IF v_plan IS NULL THEN
    RETURN 'standard';
  END IF;

  -- Cancelled or past_due → standard (locked out)
  IF v_status IN ('cancelled', 'past_due') THEN
    RETURN 'standard';
  END IF;

  -- Trialing but expired → standard (locked out)
  IF v_status = 'trialing' AND v_trial_ends < now() THEN
    RETURN 'standard';
  END IF;

  -- Active or valid trial → return their plan
  RETURN v_plan;
END;
$$;

-- 4. Create trial subscriptions for existing users who don't have one
INSERT INTO subscriptions (user_id, plan, status, trial_ends_at, current_period_start, current_period_end)
SELECT u.id, 'pro', 'trialing', now() + interval '7 days', now(), now() + interval '7 days'
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s WHERE s.user_id = u.id
);

-- 5. Set emotiveimpact@gmail.com as lifetime Pro
UPDATE subscriptions
SET plan = 'pro',
    status = 'active',
    trial_ends_at = '2099-12-31'::timestamptz,
    current_period_start = now(),
    current_period_end = '2099-12-31'::timestamptz
WHERE user_id = (SELECT id FROM public.users WHERE email = 'emotiveimpact@gmail.com');
