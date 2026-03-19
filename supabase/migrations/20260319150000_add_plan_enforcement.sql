-- ============================================================================
-- Plan Enforcement: Server-side triggers to enforce subscription plan limits
-- ============================================================================
-- Mirrors the client-side limits in use-plan-limits.ts:
--   standard (default): 1 group,  5 members per group
--   pro:                3 groups, 15 members per group
--   agency:             unlimited groups, unlimited members
-- ============================================================================

-- ─── Helper: resolve the effective plan for a user ─────────────────────────
-- Returns 'standard', 'pro', or 'agency'. Defaults to 'standard' when no
-- subscription row exists or the subscription is not in an active state.

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
BEGIN
  SELECT s.plan, s.status
    INTO v_plan, v_status
    FROM subscriptions s
   WHERE s.user_id = p_user_id
   LIMIT 1;

  -- No subscription row, or cancelled/past_due → standard limits
  IF v_plan IS NULL OR v_status NOT IN ('active', 'trialing') THEN
    RETURN 'standard';
  END IF;

  RETURN v_plan;
END;
$$;

-- ─── Helper: group limit for a plan ────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_plan_group_limit(p_plan subscription_plan)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE p_plan
    WHEN 'standard' THEN RETURN 1;
    WHEN 'pro'      THEN RETURN 3;
    WHEN 'agency'   THEN RETURN NULL;  -- NULL = unlimited
  END CASE;
  RETURN 1;  -- fallback
END;
$$;

-- ─── Helper: member limit for a plan ───────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_plan_member_limit(p_plan subscription_plan)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE p_plan
    WHEN 'standard' THEN RETURN 5;
    WHEN 'pro'      THEN RETURN 15;
    WHEN 'agency'   THEN RETURN NULL;  -- NULL = unlimited
  END CASE;
  RETURN 5;  -- fallback
END;
$$;

-- ─── 1. Group limit check ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_check_group_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan        subscription_plan;
  v_max_groups  int;
  v_current     int;
BEGIN
  -- Determine the inserting user's effective plan
  v_plan := fn_get_effective_plan(NEW.owner_id);

  -- Get the limit for that plan
  v_max_groups := fn_plan_group_limit(v_plan);

  -- NULL means unlimited (agency)
  IF v_max_groups IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count groups already owned by this user
  SELECT count(*)
    INTO v_current
    FROM groups g
   WHERE g.owner_id = NEW.owner_id;

  IF v_current >= v_max_groups THEN
    RAISE EXCEPTION 'Group limit reached for your plan. Please upgrade.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_group_limit
  BEFORE INSERT ON groups
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_group_limit();

-- ─── 2. Member limit check ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_check_member_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id     uuid;
  v_plan         subscription_plan;
  v_max_members  int;
  v_current      int;
BEGIN
  -- Look up the group's owner to determine which subscription to check
  SELECT g.owner_id
    INTO v_owner_id
    FROM groups g
   WHERE g.id = NEW.group_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Group not found'
      USING ERRCODE = 'P0002';
  END IF;

  -- Determine the owner's effective plan
  v_plan := fn_get_effective_plan(v_owner_id);

  -- Get the limit for that plan
  v_max_members := fn_plan_member_limit(v_plan);

  -- NULL means unlimited (agency)
  IF v_max_members IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count active + invited members already in this group (exclude 'removed')
  SELECT count(*)
    INTO v_current
    FROM group_members gm
   WHERE gm.group_id = NEW.group_id
     AND gm.status IN ('active', 'invited');

  IF v_current >= v_max_members THEN
    RAISE EXCEPTION 'Member limit reached for this group. Please upgrade.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_member_limit
  BEFORE INSERT ON group_members
  FOR EACH ROW
  EXECUTE FUNCTION fn_check_member_limit();
