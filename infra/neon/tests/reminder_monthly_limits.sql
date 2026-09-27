-- Run after local_auth_stub.sql and migrations 0001-0009 in an empty local DB.
-- All fixtures are rolled back.
BEGIN;
DO $$
DECLARE
  v_commune uuid;
  v_expense uuid;
  v_bob_share uuid;
  v_second_bob_share uuid;
  v_charlie_share uuid;
  v_david_share uuid;
  v_eighth uuid;
  v_sixtieth uuid;
  v_message text;
  v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'alice', 'role', 'authenticated')::text, true);
  v_commune := public.create_commune('Reminder limits', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role)
    VALUES (v_commune, 'bob', 'member'),
           (v_commune, 'charlie', 'member'),
           (v_commune, 'david', 'member');

  v_expense := public.create_expense(v_commune, 'First bill', 100,
    '[{"user_id":"alice","amount_minor":50},{"user_id":"bob","amount_minor":50}]'::jsonb,
    current_date);
  SELECT id INTO v_bob_share FROM public.expense_shares
    WHERE expense_id = v_expense AND user_id = 'bob';
  v_expense := public.create_expense(v_commune, 'Second bill', 100,
    '[{"user_id":"alice","amount_minor":50},{"user_id":"bob","amount_minor":50}]'::jsonb,
    current_date);
  SELECT id INTO v_second_bob_share FROM public.expense_shares
    WHERE expense_id = v_expense AND user_id = 'bob';
  v_expense := public.create_expense(v_commune, 'Third bill', 100,
    '[{"user_id":"alice","amount_minor":50},{"user_id":"charlie","amount_minor":50}]'::jsonb,
    current_date);
  SELECT id INTO v_charlie_share FROM public.expense_shares
    WHERE expense_id = v_expense AND user_id = 'charlie';
  v_expense := public.create_expense(v_commune, 'Fourth bill', 100,
    '[{"user_id":"alice","amount_minor":50},{"user_id":"david","amount_minor":50}]'::jsonb,
    current_date);
  SELECT id INTO v_david_share FROM public.expense_shares
    WHERE expense_id = v_expense AND user_id = 'david';

  -- Seven accepted actions in the window, mixed across Nudge and Chase.
  -- A reminder older than the rolling window must not count.
  INSERT INTO public.reminders
    (commune_id, kind, source_id, sender_user_id, recipient_user_id,
     amount_minor, created_at)
  SELECT v_commune,
    CASE WHEN i % 2 = 0 THEN 'nudge' ELSE 'chase' END,
    gen_random_uuid(), 'alice', 'bob', 50,
    now() - (i * interval '2 days')
  FROM generate_series(1, 7) AS i;
  INSERT INTO public.reminders
    (commune_id, kind, source_id, sender_user_id, recipient_user_id,
     amount_minor, created_at)
  VALUES (v_commune, 'nudge', gen_random_uuid(), 'alice', 'bob', 50,
    now() - interval '31 days');

  INSERT INTO public.notification_preferences (user_id, email_reminders)
    VALUES ('bob', false);
  v_eighth := public.send_reminder('nudge', v_bob_share);
  SELECT count(*) INTO v_count FROM public.reminder_email_outbox
    WHERE reminder_id = v_eighth AND status = 'suppressed';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'The eighth reminder ignored email opt-out';
  END IF;
  -- Avoid the daily cap so this request specifically exercises the monthly cap.
  UPDATE public.reminders SET created_at = now() - interval '2 days'
    WHERE id = v_eighth;
  BEGIN
    PERFORM public.send_reminder('nudge', v_second_bob_share);
    RAISE EXCEPTION 'The per-person monthly limit did not block the ninth reminder'
      USING ERRCODE = 'XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'You have reached the limit of 8 reminders to this person in 30 days' THEN
      RAISE EXCEPTION 'Wrong per-person limit error: %', v_message;
    END IF;
  END;

  -- 8 to Bob plus 51 other recipients = 59 in the rolling window.
  INSERT INTO public.reminders
    (commune_id, kind, source_id, sender_user_id, recipient_user_id,
     amount_minor, created_at)
  SELECT v_commune,
    CASE WHEN i % 2 = 0 THEN 'nudge' ELSE 'chase' END,
    gen_random_uuid(), 'alice', 'fixture-recipient-' || i, 50,
    now() - interval '2 days'
  FROM generate_series(1, 51) AS i;
  v_sixtieth := public.send_reminder('nudge', v_charlie_share);
  IF v_sixtieth IS NULL THEN
    RAISE EXCEPTION 'The sixtieth reminder should have been accepted';
  END IF;
  BEGIN
    PERFORM public.send_reminder('nudge', v_david_share);
    RAISE EXCEPTION 'The sender monthly limit did not block the sixty-first reminder'
      USING ERRCODE = 'XX000';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT;
    IF v_message <> 'You have reached the limit of 60 reminders in 30 days' THEN
      RAISE EXCEPTION 'Wrong sender limit error: %', v_message;
    END IF;
  END;
  SELECT count(*) INTO v_count FROM public.reminders
    WHERE sender_user_id = 'alice' AND created_at > now() - interval '30 days';
  IF v_count <> 60 THEN
    RAISE EXCEPTION 'Denied reminders changed the monthly total: %', v_count;
  END IF;
END;
$$;
ROLLBACK;
