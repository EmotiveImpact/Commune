-- Notice limits (0032). Run only in an empty disposable local DB built from
-- infra/neon/tests/local_auth_stub.sql and every migration. Everything is
-- rolled back.
BEGIN;

DO $$
DECLARE
  v_home uuid; v_expense uuid; v_share uuid; v_report jsonb; v_notices jsonb;
  v_count integer; v_failed boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'notice-alice', 'role', 'authenticated')::text, true);
  v_home := public.create_commune('Notice home', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role) VALUES (v_home, 'notice-bea', 'member');
  v_expense := public.create_expense(v_home, 'Gas', 3000,
    '[{"user_id":"notice-alice","amount_minor":1500},{"user_id":"notice-bea","amount_minor":1500}]'::jsonb, current_date);
  SELECT id INTO v_share FROM public.expense_shares WHERE expense_id = v_expense AND user_id = 'notice-bea';

  -- Bea reports and withdraws three times: Alice has one notice, the latest.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'notice-bea', 'role', 'authenticated')::text, true);
  FOR i IN 1..3 LOOP
    v_report := public.report_share_payment(v_share, 100 * i, current_date, NULL, gen_random_uuid());
    PERFORM public.withdraw_share_payment_report((v_report->>'id')::uuid);
  END LOOP;
  SELECT count(*) INTO v_count FROM public.notifications WHERE recipient_user_id = 'notice-alice';
  IF v_count <> 1 OR (SELECT amount_minor FROM public.notifications WHERE recipient_user_id = 'notice-alice') <> 300 THEN
    RAISE EXCEPTION 'Repeated reports should leave one up-to-date notice, found %', v_count;
  END IF;

  -- Once Alice has read it, the next report is new news.
  UPDATE public.notifications SET read_at = now() WHERE recipient_user_id = 'notice-alice';
  v_report := public.report_share_payment(v_share, 400, current_date, NULL, gen_random_uuid());
  PERFORM public.withdraw_share_payment_report((v_report->>'id')::uuid);
  IF (SELECT count(*) FROM public.notifications WHERE recipient_user_id = 'notice-alice' AND read_at IS NULL) <> 1
     OR (SELECT count(*) FROM public.notifications WHERE recipient_user_id = 'notice-alice') <> 2 THEN
    RAISE EXCEPTION 'A report after the notice was read should add a new notice';
  END IF;

  -- A share can be reported at most 10 times a day.
  FOR i IN 5..10 LOOP
    v_report := public.report_share_payment(v_share, 100, current_date, NULL, gen_random_uuid());
    PERFORM public.withdraw_share_payment_report((v_report->>'id')::uuid);
  END LOOP;
  BEGIN
    PERFORM public.report_share_payment(v_share, 100, current_date, NULL, gen_random_uuid());
  EXCEPTION WHEN SQLSTATE 'P0001' THEN v_failed := SQLERRM LIKE 'You have reported this share 10 times today%';
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'An eleventh report in a day was accepted'; END IF;

  -- The bell carries the latest 100 notices, unread ones first.
  INSERT INTO public.notifications (commune_id, recipient_user_id, notice_kind, expense_id, actor_user_id, amount_minor, created_at, read_at)
    SELECT v_home, 'notice-alice', 'expense_corrected', v_expense, 'notice-bea', g, now() + make_interval(secs => g), now()
    FROM generate_series(1, 150) g;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'notice-alice', 'role', 'authenticated')::text, true);
  v_notices := public.commune_snapshot(v_home)->'notifications';
  IF jsonb_array_length(v_notices) <> 100
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_notices) n WHERE n->>'readAt' IS NULL AND n->>'kind' = 'payment-reported') THEN
    RAISE EXCEPTION 'The bell should carry 100 notices including the unread one, got %', jsonb_array_length(v_notices);
  END IF;
END;
$$;

ROLLBACK;
