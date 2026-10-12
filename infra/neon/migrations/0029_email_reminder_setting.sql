-- Email reminders setting. Reminder emails have always pointed people to a
-- setting in Commune; this adds the command behind the new Settings switch.
-- The preference table and its read policy come from 0002. Its column grants
-- cannot express "insert or update my own row" through the Data API (an
-- upsert also updates user_id), so the app saves through this function.
-- The email worker's one-click unsubscribe writes the same row directly.
-- Apply after 0028. Release with the matching web client and email worker.
BEGIN;

CREATE FUNCTION public.set_email_reminders(p_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor text := commune_private.data_api_user_id();
BEGIN
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'Choose whether to get reminder emails' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.notification_preferences (user_id, email_reminders)
    VALUES (v_actor, p_enabled)
  ON CONFLICT (user_id) DO UPDATE
    SET email_reminders = EXCLUDED.email_reminders, updated_at = now();
  RETURN p_enabled;
END;
$$;
REVOKE ALL ON FUNCTION public.set_email_reminders(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_email_reminders(boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
