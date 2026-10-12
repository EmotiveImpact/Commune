-- Email reminders setting (0029). Run only in an empty disposable local DB
-- built from infra/local/bootstrap.sql, every migration and after-core.sql
-- (app_auth stands in for Neon Auth). Everything is rolled back.
BEGIN;

SET ROLE authenticated;
DO $$
DECLARE
  a text := '00000000-0000-4000-8000-0000000000a1';
  b text := '00000000-0000-4000-8000-0000000000b2';
BEGIN
  -- Without a verified identity nothing is saved.
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    PERFORM public.set_email_reminders(false);
    RAISE EXCEPTION 'Saved a setting with no identity';
  EXCEPTION WHEN invalid_authorization_specification THEN NULL;
  END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.set_email_reminders(NULL);
    RAISE EXCEPTION 'Accepted an empty choice';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  -- Turning reminders off creates the row; turning them on again updates it.
  IF public.set_email_reminders(false) IS DISTINCT FROM false THEN RAISE EXCEPTION 'Off was not returned'; END IF;
  IF (SELECT email_reminders FROM public.notification_preferences WHERE user_id = a) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Off was not saved';
  END IF;
  IF public.set_email_reminders(true) IS DISTINCT FROM true THEN RAISE EXCEPTION 'On was not returned'; END IF;
  IF (SELECT email_reminders FROM public.notification_preferences WHERE user_id = a) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'On was not saved';
  END IF;

  -- Someone else's setting is neither changed nor readable.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  PERFORM public.set_email_reminders(false);
  IF EXISTS (SELECT 1 FROM public.notification_preferences WHERE user_id = a) THEN
    RAISE EXCEPTION 'Read another member''s setting';
  END IF;
  IF (SELECT email_reminders FROM public.notification_preferences WHERE user_id = b) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Own setting was not saved';
  END IF;
END;
$$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT email_reminders FROM public.notification_preferences WHERE user_id = '00000000-0000-4000-8000-0000000000a1') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Another member changed this setting';
  END IF;
END;
$$;

SELECT 'email reminder setting ok';
ROLLBACK;
