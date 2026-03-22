-- ============================================================================
-- F24: Increase Standard plan member limit from 5 to 8
-- ============================================================================
-- Updates the fn_plan_member_limit helper so that the server-side trigger
-- (fn_check_member_limit) enforces 8 members for the standard plan.
-- The original migration (20260319150000_add_plan_enforcement.sql) set it to 5.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_plan_member_limit(p_plan subscription_plan)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE p_plan
    WHEN 'standard' THEN RETURN 8;
    WHEN 'pro'      THEN RETURN 15;
    WHEN 'agency'   THEN RETURN NULL;  -- NULL = unlimited
  END CASE;
  RETURN 8;  -- fallback
END;
$$;
