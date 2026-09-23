-- One read-only, server-clock view of the rolling reminder allowance. The
-- send_reminder function remains the only authority that accepts or rejects a
-- send; this is for display, never client-side enforcement alone.
BEGIN;

CREATE OR REPLACE FUNCTION public.reminder_usage()
RETURNS TABLE (
  total_used integer,
  total_limit integer,
  recipient_limit integer,
  recipient_usage jsonb,
  next_slot_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_sender text := auth.user_id();
BEGIN
  IF v_sender IS NULL OR v_sender = '' THEN
    RAISE EXCEPTION 'Sign in to see reminder usage' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH recent AS (
    SELECT r.recipient_user_id, r.created_at
    FROM public.reminders r
    WHERE r.sender_user_id = v_sender
      AND r.created_at > now() - interval '30 days'
  ), by_recipient AS (
    SELECT recent.recipient_user_id, count(*)::integer AS used
    FROM recent GROUP BY recent.recipient_user_id
  ), ranked AS (
    SELECT recent.created_at,
      row_number() OVER (ORDER BY recent.created_at) AS position,
      count(*) OVER () AS total
    FROM recent
  )
  SELECT
    (SELECT count(*)::integer FROM recent),
    60,
    8,
    (SELECT coalesce(jsonb_object_agg(recipient_user_id, used), '{}'::jsonb)
       FROM by_recipient),
    (SELECT created_at + interval '30 days'
       FROM ranked WHERE position = total - 59);
END;
$$;

REVOKE ALL ON FUNCTION public.reminder_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reminder_usage() TO authenticated;

COMMIT;
