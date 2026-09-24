-- Run after the local auth stub and migrations 0001-0010. Roll back fixtures.
BEGIN;
DO $$
DECLARE
  v_commune uuid;
  v_total integer;
  v_limit integer;
  v_recipient_limit integer;
  v_usage jsonb;
  v_next timestamptz;
BEGIN
  PERFORM set_config('request.jwt.sub', 'usage-alice', true);
  v_commune := public.create_commune('Usage test', 'household', 'GBP');
  INSERT INTO public.reminders
    (commune_id, kind, source_id, sender_user_id, recipient_user_id,
     amount_minor, created_at)
  VALUES
    (v_commune, 'nudge', gen_random_uuid(), 'usage-alice', 'usage-bob', 100,
      now() - interval '1 day'),
    (v_commune, 'chase', gen_random_uuid(), 'usage-alice', 'usage-bob', 100,
      now() - interval '4 days'),
    (v_commune, 'nudge', gen_random_uuid(), 'usage-alice', 'usage-carol', 100,
      now() - interval '5 days'),
    (v_commune, 'nudge', gen_random_uuid(), 'usage-alice', 'usage-bob', 100,
      now() - interval '31 days'),
    (v_commune, 'nudge', gen_random_uuid(), 'other-sender', 'usage-bob', 100,
      now() - interval '1 day');
  SELECT total_used, total_limit, recipient_limit, recipient_usage, next_slot_at
    INTO v_total, v_limit, v_recipient_limit, v_usage, v_next
    FROM public.reminder_usage();
  IF v_total <> 3 OR v_limit <> 60 OR v_recipient_limit <> 8
     OR v_usage <> '{"usage-bob": 2, "usage-carol": 1}'::jsonb
     OR v_next IS NOT NULL THEN
    RAISE EXCEPTION 'Wrong rolling usage: %, %, %, %, %',
      v_total, v_limit, v_recipient_limit, v_usage, v_next;
  END IF;

  -- The returned next slot is the oldest accepted reminder's expiry only
  -- once the sender has reached the cap.
  INSERT INTO public.reminders
    (commune_id, kind, source_id, sender_user_id, recipient_user_id,
     amount_minor, created_at)
  VALUES (v_commune, 'nudge', gen_random_uuid(), 'usage-alice',
    'oldest-recipient', 100, now() - interval '20 days');
  INSERT INTO public.reminders
    (commune_id, kind, source_id, sender_user_id, recipient_user_id,
     amount_minor, created_at)
  SELECT v_commune, 'nudge', gen_random_uuid(), 'usage-alice',
    'fixture-' || i, 100, now() - interval '6 days'
  FROM generate_series(1, 56) AS i;
  SELECT total_used, next_slot_at INTO v_total, v_next
    FROM public.reminder_usage();
  IF v_total <> 60 OR v_next < now() + interval '10 days' - interval '1 minute'
     OR v_next > now() + interval '10 days' + interval '1 minute' THEN
    RAISE EXCEPTION 'Wrong full-cap usage or next slot: %, %', v_total, v_next;
  END IF;
  -- Simulate legacy sends that predate the cap. One expiry is not enough to
  -- open a slot while 61 reminders remain in the rolling window.
  INSERT INTO public.reminders
    (commune_id, kind, source_id, sender_user_id, recipient_user_id,
     amount_minor)
  VALUES (v_commune, 'chase', gen_random_uuid(), 'usage-alice',
    'legacy-recipient', 100);
  SELECT total_used, next_slot_at INTO v_total, v_next
    FROM public.reminder_usage();
  IF v_total <> 61 OR v_next < now() + interval '24 days' - interval '1 minute'
     OR v_next > now() + interval '24 days' + interval '1 minute' THEN
    RAISE EXCEPTION 'Wrong over-cap next slot: %, %', v_total, v_next;
  END IF;

  PERFORM set_config('request.jwt.sub', 'usage-bob', true);
  SELECT total_used, recipient_usage INTO v_total, v_usage
    FROM public.reminder_usage();
  IF v_total <> 0 OR v_usage <> '{}'::jsonb THEN
    RAISE EXCEPTION 'One sender could read another sender''s usage';
  END IF;
  PERFORM set_config('request.jwt.sub', '', true);
  BEGIN
    PERFORM public.reminder_usage();
    RAISE EXCEPTION 'Unsigned caller read reminder usage' USING ERRCODE = 'XX000';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END;
$$;
ROLLBACK;
