-- Notices, activity and "Needs you" across communes (0039). Run only in an
-- empty disposable local DB built from infra/neon/tests/local_auth_stub.sql
-- and every migration. Everything is rolled back.
BEGIN;

CREATE FUNCTION pg_temp.act(p_user text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
END;
$$;
-- The reader's count in one commune, as the commune list gives it.
CREATE FUNCTION pg_temp.listed_unread(p_commune uuid) RETURNS integer LANGUAGE sql AS $$
  SELECT (c->>'unreadNotices')::integer FROM jsonb_array_elements(public.my_communes()) c WHERE (c->>'id')::uuid = p_commune;
$$;

INSERT INTO neon_auth."user" (id, name, email) VALUES
  ('na-ann', 'Ann Archer', 'ann@notices.test'), ('na-ben', 'Ben Baker', 'ben@notices.test'),
  ('na-cat', 'Cat Cole', 'cat@notices.test'), ('na-out', 'Outsider', 'out@notices.test');

-- Ann is in two communes and has a notice in each: Ben says he paid her in
-- the house, and corrected a bill of his on the trip.
DO $$
DECLARE v_home uuid; v_trip uuid; v_expense uuid; v_share uuid; v_trip_bill uuid; v_fund uuid; v_pledge uuid;
BEGIN
  PERFORM pg_temp.act('na-ann');
  v_home := public.create_commune('Notice house', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role) VALUES (v_home, 'na-ben', 'member'), (v_home, 'na-cat', 'member');
  v_expense := public.create_expense(v_home, 'Gas', 3000,
    '[{"user_id":"na-ann","amount_minor":1000},{"user_id":"na-ben","amount_minor":1000},{"user_id":"na-cat","amount_minor":1000}]'::jsonb, current_date);
  SELECT id INTO v_share FROM public.expense_shares WHERE expense_id = v_expense AND user_id = 'na-ben';
  v_fund := public.create_fund(v_home, 'Boiler', 50000);

  PERFORM pg_temp.act('na-ben');
  PERFORM public.report_share_payment(v_share, 1000, current_date, NULL, gen_random_uuid());
  v_pledge := public.pledge_fund(v_fund, 10000, current_date + 7);
  v_trip := public.create_commune('Notice trip', 'trip', 'EUR');
  INSERT INTO public.commune_members (commune_id, user_id, role) VALUES (v_trip, 'na-ann', 'member');
  v_trip_bill := public.create_expense(v_trip, 'Ferry', 4000,
    '[{"user_id":"na-ann","amount_minor":2000},{"user_id":"na-ben","amount_minor":2000}]'::jsonb, current_date);
  PERFORM public.correct_expense(v_trip_bill, 1, 'Ferry tickets', 4000,
    '[{"user_id":"na-ann","amount_minor":2500},{"user_id":"na-ben","amount_minor":1500}]'::jsonb, current_date,
    'na-ben', 'Travel', 'Ann had the cabin', gen_random_uuid());

  -- An admin moving Ben's pledge leaves Ben a notice in the house.
  PERFORM pg_temp.act('na-ann');
  PERFORM public.update_fund_pledge(v_pledge, 10000, current_date + 14, false, NULL, NULL);

  PERFORM set_config('test.home', v_home::text, true);
  PERFORM set_config('test.trip', v_trip::text, true);
  PERFORM set_config('test.share', v_share::text, true);
  PERFORM set_config('test.fund', v_fund::text, true);
END;
$$;

-- 1. The commune list and the snapshot count each commune's unread notices.
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid; v_trip uuid := current_setting('test.trip')::uuid;
  v_notice uuid;
BEGIN
  PERFORM pg_temp.act('na-ann');
  IF pg_temp.listed_unread(v_home) IS DISTINCT FROM 1 OR pg_temp.listed_unread(v_trip) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'The list should count one unread notice in each commune: %', public.my_communes();
  END IF;
  IF (public.commune_snapshot(v_home)->'commune'->>'unreadNotices')::integer IS DISTINCT FROM 1
     OR public.commune_summary(v_trip)->'commune' <> public.commune_snapshot(v_trip)->'commune'
     OR (public.commune_summary(v_trip)->'commune'->>'unreadNotices')::integer IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'The snapshot and the summary should carry the same count';
  END IF;

  -- Reading the house notice clears only the house.
  SELECT (n->>'id')::uuid INTO v_notice FROM jsonb_array_elements(public.commune_snapshot(v_home)->'notifications') n;
  PERFORM public.mark_notification_read(v_notice);
  IF pg_temp.listed_unread(v_home) IS DISTINCT FROM 0 OR pg_temp.listed_unread(v_trip) IS DISTINCT FROM 1
     OR (public.commune_snapshot(v_home)->'commune'->>'unreadNotices')::integer IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Reading a notice should clear only its own commune';
  END IF;

  -- Someone else's notices never count.
  PERFORM pg_temp.act('na-cat');
  IF pg_temp.listed_unread(v_home) IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'Cat has no notices'; END IF;
END;
$$;

-- 2. Unread notices from every commune, in the snapshot's shape with the
-- sender's name, for the caller only.
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid; v_trip uuid := current_setting('test.trip')::uuid;
  v_notices jsonb; v_left uuid; v_expense uuid; v_report jsonb;
BEGIN
  PERFORM pg_temp.act('na-ann');
  v_notices := public.my_unread_notices();
  IF jsonb_array_length(v_notices) <> 1 OR v_notices->0->>'communeId' IS DISTINCT FROM v_trip::text
     OR v_notices->0->>'kind' IS DISTINCT FROM 'expense-corrected' OR v_notices->0->>'senderName' IS DISTINCT FROM 'Ben Baker'
     OR v_notices->0->>'title' IS DISTINCT FROM 'Ferry tickets' OR v_notices->0->>'readAt' IS NOT NULL
     OR v_notices->0->'fundId' IS DISTINCT FROM 'null'::jsonb THEN
    RAISE EXCEPTION 'Ann should get her unread trip notice only: %', v_notices;
  END IF;
  IF (v_notices->0) - 'senderName' - 'fundId' <> (SELECT n FROM jsonb_array_elements(public.commune_snapshot(v_trip)->'notifications') n) THEN
    RAISE EXCEPTION 'A notice should come in the snapshot''s shape: %', v_notices;
  END IF;

  -- A pledge notice names the fund holding the pledge while the fund is open.
  PERFORM pg_temp.act('na-ben');
  v_notices := public.my_unread_notices();
  IF jsonb_array_length(v_notices) <> 1 OR v_notices->0->>'kind' IS DISTINCT FROM 'pledge-changed'
     OR v_notices->0->>'fundId' IS DISTINCT FROM current_setting('test.fund') OR v_notices->0->>'senderName' IS DISTINCT FROM 'Ann Archer' THEN
    RAISE EXCEPTION 'Ben should get his pledge notice with its fund: %', v_notices;
  END IF;
  PERFORM pg_temp.act('na-ann');
  PERFORM public.update_fund_pledge((SELECT id FROM public.fund_commitments WHERE fund_id = current_setting('test.fund')::uuid),
    10000, current_date + 14, true, NULL, NULL);
  PERFORM public.set_fund_archived(current_setting('test.fund')::uuid, true);
  PERFORM pg_temp.act('na-ben');
  v_notices := public.my_unread_notices();
  IF (SELECT array_agg(n->>'kind' ORDER BY n->>'kind') FROM jsonb_array_elements(v_notices) n) IS DISTINCT FROM ARRAY['pledge-cancelled', 'pledge-changed']
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_notices) n WHERE n->'fundId' IS DISTINCT FROM 'null'::jsonb) THEN
    RAISE EXCEPTION 'An archived fund should not be offered: %', v_notices;
  END IF;

  -- Someone outside the communes gets nothing, and so does someone who left:
  -- Ann confirms the payment Cat reported in a third commune, then Cat leaves.
  PERFORM pg_temp.act('na-out');
  IF public.my_unread_notices() <> '[]'::jsonb THEN RAISE EXCEPTION 'An outsider should get no notices'; END IF;
  PERFORM pg_temp.act('na-ann');
  v_left := public.create_commune('Left house', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role) VALUES (v_left, 'na-cat', 'member');
  v_expense := public.create_expense(v_left, 'Milk', 400,
    '[{"user_id":"na-ann","amount_minor":200},{"user_id":"na-cat","amount_minor":200}]'::jsonb, current_date);
  PERFORM pg_temp.act('na-cat');
  v_report := public.report_share_payment((SELECT id FROM public.expense_shares WHERE expense_id = v_expense AND user_id = 'na-cat'),
    200, current_date, NULL, gen_random_uuid());
  PERFORM pg_temp.act('na-ann');
  PERFORM public.resolve_share_payment_report((v_report->>'id')::uuid, 'confirm', NULL, gen_random_uuid());
  PERFORM pg_temp.act('na-cat');
  IF (SELECT array_agg(n->>'kind') FROM jsonb_array_elements(public.my_unread_notices()) n) IS DISTINCT FROM ARRAY['payment-confirmed'] THEN
    RAISE EXCEPTION 'Cat should have the confirmation: %', public.my_unread_notices();
  END IF;
  PERFORM public.manage_commune_member(v_left, 'na-cat', 'leave');
  IF public.my_unread_notices() <> '[]'::jsonb
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(public.my_communes()) c WHERE (c->>'id')::uuid = v_left) THEN
    RAISE EXCEPTION 'Notices from a commune Cat left should stay out of reach';
  END IF;

  -- Only members can call it, never anonymous visitors.
  IF has_function_privilege('anonymous', 'public.my_unread_notices()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.my_unread_notices()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected grants on my_unread_notices';
  END IF;
END;
$$;

-- 3. Every activity event names the kind of record it is about.
DO $$
DECLARE
  v_place uuid; v_expense uuid; v_share uuid; v_fund jsonb; v_pledge jsonb; v_task jsonb; v_event jsonb;
  v_types jsonb; v_expected jsonb;
BEGIN
  PERFORM pg_temp.act('na-ann');
  v_place := public.create_commune('Activity house', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role) VALUES (v_place, 'na-ben', 'member');
  v_expense := public.create_expense(v_place, 'Broadband', 3000,
    '[{"user_id":"na-ann","amount_minor":1500},{"user_id":"na-ben","amount_minor":1500}]'::jsonb, current_date);
  SELECT id INTO v_share FROM public.expense_shares WHERE expense_id = v_expense AND user_id = 'na-ben';
  PERFORM public.record_share_receipt(v_share, 500, current_date, NULL, gen_random_uuid());
  PERFORM public.correct_expense(v_expense, 1, 'Broadband bill', 3000,
    '[{"user_id":"na-ann","amount_minor":1500},{"user_id":"na-ben","amount_minor":1500}]'::jsonb, current_date,
    'na-ann', 'Utilities', 'Clearer title', gen_random_uuid());
  v_fund := public.create_fund_command(v_place, 'Sofa', 40000, gen_random_uuid());
  v_pledge := public.pledge_fund_command((v_fund->>'id')::uuid, 5000, current_date + 30, gen_random_uuid());
  PERFORM public.record_fund_contribution_command((v_pledge->>'id')::uuid, 1000, gen_random_uuid());
  PERFORM public.create_note(v_place, 'Router', 'Wi-Fi', 'Everyone', 'In the hall', 'Restart it first', '[]'::jsonb, gen_random_uuid());
  v_task := public.create_operation(v_place, 'task', 'chore', 'Bins', current_date, NULL, true, 'na-ann', NULL, 'weekly', '', gen_random_uuid());
  PERFORM public.remove_operation((v_task->>'id')::uuid);
  v_event := public.create_operation(v_place, 'event', 'visit', 'Inspection', current_date + 2, '10:00', false, NULL, NULL, 'none', '', gen_random_uuid());
  PERFORM public.post_announcement(v_place, 'Boiler service', 'Friday morning', false, gen_random_uuid());
  PERFORM public.save_recurring_bill(v_place, 'Rent', 2000, 'na-ann',
    '[{"user_id":"na-ann","amount_minor":1000},{"user_id":"na-ben","amount_minor":1000}]'::jsonb, 'monthly', current_date,
    NULL, NULL, gen_random_uuid(), NULL);
  PERFORM public.save_split_template(v_place, 'Halves', 'Equal', '[{"user_id":"na-ann","value":""},{"user_id":"na-ben","value":""}]'::jsonb);

  SELECT jsonb_object_agg(a->>'title' || ': ' || (a->>'description'), a->>'recordType')
    INTO v_types FROM jsonb_array_elements(public.commune_snapshot(v_place)->'activityEvents') a;
  v_expected := jsonb_build_object(
    'Ben Baker: Joined the commune', 'member',
    'Broadband: Repayment of £5.00 recorded', 'repayment',
    'Broadband bill: Expense corrected', 'expense',
    'Sofa: Created', 'fund',
    'Sofa: Pledge made', 'pledge',
    'Sofa: Contribution recorded', 'contribution',
    'Router: Created', 'note',
    'Bins: Created', 'task',
    'Bins: Removed', 'task',
    'Inspection: Created', 'event',
    'Boiler service: Posted', 'announcement',
    'Rent: Created', 'recurring',
    'Halves: Created', 'template');
  IF NOT v_types @> v_expected THEN
    RAISE EXCEPTION 'Unexpected record types: %', v_types;
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each_text(v_types) t WHERE t.value IS NULL) THEN
    RAISE EXCEPTION 'Every event should have a record type: %', v_types;
  END IF;
END;
$$;

-- 4. The overview summary keeps a share's pending payment report, and no
-- repayments or answered reports.
DO $$
DECLARE v_home uuid := current_setting('test.home')::uuid; v_reports jsonb;
BEGIN
  PERFORM pg_temp.act('na-ann');
  SELECT s->'paymentReports' INTO v_reports
    FROM jsonb_array_elements(public.commune_summary(v_home)->'expenses') e, jsonb_array_elements(e->'shares') s
    WHERE s->>'id' = current_setting('test.share');
  IF jsonb_array_length(v_reports) IS DISTINCT FROM 1 OR v_reports->0->>'status' IS DISTINCT FROM 'pending'
     OR (v_reports->0->>'amountMinor')::bigint IS DISTINCT FROM 1000 THEN
    RAISE EXCEPTION 'The summary should keep the pending report: %', v_reports;
  END IF;
  PERFORM public.resolve_share_payment_report((v_reports->0->>'id')::uuid, 'decline', 'Not arrived yet', gen_random_uuid());
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(public.commune_summary(v_home)->'expenses') e, jsonb_array_elements(e->'shares') s
      WHERE s->'paymentReports' <> '[]'::jsonb OR s->'receipts' <> '[]'::jsonb) THEN
    RAISE EXCEPTION 'An answered report should stay out of the summary';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.commune_snapshot(v_home)->'expenses') e, jsonb_array_elements(e->'shares') s
      WHERE s->'paymentReports'->0->>'status' = 'declined') THEN
    RAISE EXCEPTION 'The full snapshot should still carry the answered report';
  END IF;
END;
$$;

ROLLBACK;
