-- Apply after all Neon migrations in a disposable local database only.
-- Production uses public.send_reminder and an outbound email worker instead.
BEGIN;

-- Local development has no outbound email provider. A reminder really creates
-- a notification for the recipient, but its email job must not linger and be
-- delivered unexpectedly if a provider is connected later.
CREATE FUNCTION public.send_local_reminder(p_kind text, p_source_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  v_id := public.send_reminder(p_kind, p_source_id);
  UPDATE public.reminder_email_outbox
    SET status = 'suppressed', last_error = 'Email delivery not configured locally',
      updated_at = now()
    WHERE reminder_id = v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.send_local_reminder(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_local_reminder(text, uuid)
  TO authenticated;

COMMIT;
