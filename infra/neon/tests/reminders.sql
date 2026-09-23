-- Run after local_auth_stub.sql and both migrations in an empty local DB.
-- A real Neon staging branch must additionally be tested with signed JWTs.
BEGIN;
DO $$
DECLARE
  v_commune uuid;
  v_other_commune uuid;
  v_expense uuid;
  v_second_expense uuid;
  v_share uuid;
  v_second_share uuid;
  v_fund uuid;
  v_commitment uuid;
  v_nudge uuid;
  v_chase uuid;
  v_second_chase uuid;
  v_count integer;
  v_amount bigint;
BEGIN
  PERFORM set_config('request.jwt.sub', 'alice', true);
  v_commune := public.create_commune('Park Street', 'household', 'GBP');
  PERFORM set_config('test.park_id', v_commune::text, true);
  v_other_commune := public.create_commune('Other House', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role)
    VALUES (v_commune, 'bob', 'member'),
           (v_other_commune, 'charlie', 'member');

  v_expense := public.create_expense(
    v_commune, 'Gas', 10000,
    '[{"user_id":"alice","amount_minor":5000},
      {"user_id":"bob","amount_minor":5000}]'::jsonb,
    current_date
  );
  SELECT id INTO v_share FROM public.expense_shares
    WHERE expense_id = v_expense AND user_id = 'bob';

  SELECT count(*) INTO v_count FROM public.list_reminder_targets(v_commune)
    WHERE kind = 'nudge' AND source_id = v_share AND amount_minor = 5000;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one £50 Nudge target'; END IF;

  v_nudge := public.send_reminder('nudge', v_share);
  SELECT amount_minor INTO v_amount FROM public.reminders WHERE id = v_nudge;
  IF v_amount <> 5000 THEN RAISE EXCEPTION 'Nudge amount was not derived from share'; END IF;
  SELECT count(*) INTO v_count FROM public.notifications WHERE reminder_id = v_nudge;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Nudge did not create in-app notification'; END IF;
  SELECT count(*) INTO v_count FROM public.reminder_email_outbox
    WHERE reminder_id = v_nudge AND status = 'pending';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Nudge was not queued for email'; END IF;

  BEGIN
    PERFORM public.send_reminder('nudge', v_share);
    RAISE EXCEPTION 'Cooldown did not block a duplicate Nudge';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
  END;
  v_second_expense := public.create_expense(
    v_commune, 'Water', 100,
    '[{"user_id":"alice","amount_minor":50},
      {"user_id":"bob","amount_minor":50}]'::jsonb,
    current_date
  );
  SELECT id INTO v_second_share FROM public.expense_shares
    WHERE expense_id = v_second_expense AND user_id = 'bob';
  BEGIN
    PERFORM public.send_reminder('nudge', v_second_share);
    RAISE EXCEPTION 'Different expense evaded the per-recipient daily limit';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
  END;
  v_second_expense := public.create_expense(
    v_commune, 'No due date', 100,
    '[{"user_id":"alice","amount_minor":50},
      {"user_id":"bob","amount_minor":50}]'::jsonb,
    NULL
  );
  SELECT id INTO v_second_share FROM public.expense_shares
    WHERE expense_id = v_second_expense AND user_id = 'bob';
  BEGIN
    PERFORM public.send_reminder('nudge', v_second_share);
    RAISE EXCEPTION 'Undated expense could be nudged immediately';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  PERFORM set_config('request.jwt.sub', 'bob', true);
  BEGIN
    PERFORM public.send_reminder('nudge', v_share);
    RAISE EXCEPTION 'Debtor could Nudge themself';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  PERFORM set_config('request.jwt.sub', 'charlie', true);
  BEGIN
    PERFORM public.list_reminder_targets(v_commune);
    RAISE EXCEPTION 'Other commune member saw targets';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  PERFORM set_config('request.jwt.sub', 'alice', true);
  PERFORM public.confirm_expense_share(v_share);
  SELECT count(*) INTO v_count FROM public.list_reminder_targets(v_commune)
    WHERE source_id = v_share;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Settled share remained nudgeable'; END IF;

  v_fund := public.create_fund(v_commune, 'House fund', 60000);
  -- A Chase on another obligation is allowed once the daily limit expires.
  UPDATE public.reminders SET created_at = now() - interval '2 days'
    WHERE id = v_nudge;
  PERFORM set_config('request.jwt.sub', 'bob', true);
  v_commitment := public.pledge_fund(v_fund, 18000, current_date);
  PERFORM set_config('request.jwt.sub', 'alice', true);
  SELECT count(*) INTO v_count FROM public.list_reminder_targets(v_commune)
    WHERE kind = 'chase' AND source_id = v_commitment AND amount_minor = 18000;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Expected one £180 Chase target'; END IF;
  v_chase := public.send_reminder('chase', v_commitment);
  SELECT amount_minor INTO v_amount FROM public.reminders WHERE id = v_chase;
  IF v_amount <> 18000 THEN RAISE EXCEPTION 'Chase amount not derived from pledge'; END IF;

  PERFORM public.record_fund_contribution(v_commitment, 10000);
  SELECT amount_minor INTO v_amount FROM public.list_reminder_targets(v_commune)
    WHERE source_id = v_commitment;
  IF v_amount <> 8000 THEN RAISE EXCEPTION 'Partial contribution did not reduce Chase'; END IF;
  BEGIN
    PERFORM public.send_reminder('chase', v_commitment);
    RAISE EXCEPTION 'Cooldown did not block repeated Chase';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
  END;

  -- Advance only the fixture's timestamp to exercise a later reminder.
  UPDATE public.reminders SET created_at = now() - interval '4 days'
    WHERE id = v_chase;
  INSERT INTO public.notification_preferences (user_id, email_reminders)
    VALUES ('bob', false);
  v_second_chase := public.send_reminder('chase', v_commitment);
  SELECT amount_minor INTO v_amount FROM public.reminders
    WHERE id = v_second_chase;
  IF v_amount <> 8000 THEN RAISE EXCEPTION 'Second Chase amount should be £80'; END IF;
  SELECT count(*) INTO v_count FROM public.reminder_email_outbox
    WHERE reminder_id = v_second_chase AND status = 'suppressed';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Email opt-out was ignored'; END IF;

  PERFORM public.record_fund_contribution(v_commitment, 8000);
  SELECT count(*) INTO v_count FROM public.list_reminder_targets(v_commune)
    WHERE source_id = v_commitment;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Paid pledge remained chaseable'; END IF;
  BEGIN
    PERFORM public.send_reminder('chase', v_commitment);
    RAISE EXCEPTION 'Paid pledge could be chased';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
END;
$$;

-- Row-level access through the same role used by the Neon Data API.
SET ROLE authenticated;
SELECT set_config('request.jwt.sub', 'charlie', true);
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.expenses;
  IF v_count <> 0 THEN RAISE EXCEPTION 'RLS leaked an expense'; END IF;
  SELECT count(*) INTO v_count FROM public.notifications;
  IF v_count <> 0 THEN RAISE EXCEPTION 'RLS leaked a notification'; END IF;
  BEGIN
    PERFORM public.list_reminder_targets(
      current_setting('test.park_id')::uuid);
    RAISE EXCEPTION 'Authenticated outsider saw another commune targets';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.reminders DEFAULT VALUES;
    RAISE EXCEPTION 'Client can write reminder rows directly';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  BEGIN
    UPDATE public.expense_shares SET settled_minor = amount_minor;
    RAISE EXCEPTION 'Client can erase expense shares directly';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END;
$$;
RESET ROLE;
ROLLBACK;
