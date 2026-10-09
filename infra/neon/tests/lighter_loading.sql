-- Lighter loading (0036): change marks, the commune list and its row checks,
-- creation limits, the bounded snapshot, paged history and the overview
-- summary. Run only in an empty disposable local DB built from
-- infra/neon/tests/local_auth_stub.sql and every migration. Everything is
-- rolled back. infra/neon/tests/change_mark_order.mjs covers two real
-- transactions committing in the reverse order of their change rows.
BEGIN;

CREATE FUNCTION pg_temp.act(p_user text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
END;
$$;
-- This test runs in one transaction. Forgetting the communes already noted
-- makes the next write look like the first of a new transaction.
CREATE FUNCTION pg_temp.next_transaction() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('commune.changed_communes', '', true);
END;
$$;
CREATE FUNCTION pg_temp.changes(p_commune uuid) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM commune_private.commune_changes WHERE commune_id = p_commune;
$$;
CREATE FUNCTION pg_temp.refused(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE || ' ' || SQLERRM;
END;
$$;

-- Ann and Ben share a home; Cat has her own; Dee used to be in Ann's.
DO $$
DECLARE
  v_home uuid; v_other uuid; v_expense uuid; v_share uuid; v_reported uuid; v_report_share uuid;
  v_fund jsonb; v_pledge jsonb; v_note jsonb; v_task jsonb; v_notice jsonb; v_bill uuid; v_reminder uuid;
BEGIN
  PERFORM pg_temp.act('ll-ann');
  v_home := public.create_commune('Lighter home', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role) VALUES (v_home, 'll-ben', 'member'), (v_home, 'll-dee', 'member');
  v_expense := public.create_expense(v_home, 'Gas', 2000,
    '[{"user_id":"ll-ann","amount_minor":1000},{"user_id":"ll-ben","amount_minor":1000}]'::jsonb, current_date);
  SELECT id INTO v_share FROM public.expense_shares WHERE expense_id = v_expense AND user_id = 'll-ben';
  PERFORM public.record_share_receipt(v_share, 400, current_date, NULL, gen_random_uuid());
  PERFORM public.correct_expense(v_expense, 1, 'Gas bill', 2000,
    '[{"user_id":"ll-ann","amount_minor":1000},{"user_id":"ll-ben","amount_minor":1000}]'::jsonb, current_date,
    'll-ann', 'Utilities', 'Clearer title', gen_random_uuid());
  v_reported := public.create_expense(v_home, 'Water', 2000,
    '[{"user_id":"ll-ann","amount_minor":1000},{"user_id":"ll-ben","amount_minor":1000}]'::jsonb, current_date);
  SELECT id INTO v_report_share FROM public.expense_shares WHERE expense_id = v_reported AND user_id = 'll-ben';
  v_fund := public.create_fund_command(v_home, 'Boiler', 50000, gen_random_uuid());
  v_pledge := public.pledge_fund_command((v_fund->>'id')::uuid, 5000, current_date + 30, gen_random_uuid());
  PERFORM public.record_fund_contribution_command((v_pledge->>'id')::uuid, 1000, gen_random_uuid());
  v_note := public.create_note(v_home, 'Wifi', 'Wi-Fi', 'Everyone', 'Router in the hall', 'Restart it first', '[]'::jsonb, gen_random_uuid());
  PERFORM public.update_note((v_note->>'id')::uuid, 1, 'Wifi', 'Wi-Fi', 'Everyone', 'Router in the hall', 'Restart it twice', '[]'::jsonb);
  v_task := public.create_operation(v_home, 'task', 'chore', 'Bins', current_date, NULL, true, 'll-ann', NULL, 'weekly', '', gen_random_uuid());
  PERFORM public.record_operation_occurrence((v_task->>'id')::uuid, 'completed', current_date, current_date, gen_random_uuid());
  v_notice := public.post_announcement(v_home, 'Boiler service', 'Friday morning', true, gen_random_uuid());
  v_bill := public.save_recurring_bill(v_home, 'Rent', 2000, 'll-ann',
    '[{"user_id":"ll-ann","amount_minor":1000},{"user_id":"ll-ben","amount_minor":1000}]'::jsonb, 'monthly', current_date,
    NULL, NULL, gen_random_uuid(), NULL);
  PERFORM public.record_recurring_period(v_bill, current_date);
  PERFORM public.save_split_template(v_home, 'Halves', 'Equal', '[{"user_id":"ll-ann","value":""},{"user_id":"ll-ben","value":""}]'::jsonb);
  PERFORM public.create_commune_invite(v_home, 'eve@lighter.test', 'member');
  INSERT INTO public.reminders (commune_id, kind, source_id, sender_user_id, recipient_user_id, amount_minor)
    VALUES (v_home, 'nudge', v_share, 'll-ann', 'll-ben', 600) RETURNING id INTO v_reminder;
  INSERT INTO public.reminder_email_outbox (reminder_id, payload) VALUES (v_reminder, '{"to": ["ben@lighter.test"]}');

  PERFORM pg_temp.act('ll-ben');
  PERFORM public.report_share_payment(v_report_share, 1000, current_date, NULL, gen_random_uuid());
  PERFORM public.acknowledge_announcement((v_notice->>'id')::uuid);

  PERFORM pg_temp.act('ll-cat');
  v_other := public.create_commune('Other home', 'household', 'GBP');

  PERFORM set_config('test.home', v_home::text, true);
  PERFORM set_config('test.other', v_other::text, true);
  PERFORM set_config('test.expense', v_expense::text, true);
  PERFORM set_config('test.share', v_share::text, true);
  PERFORM set_config('test.report_share', v_report_share::text, true);
  PERFORM set_config('test.fund', v_fund->>'id', true);
  PERFORM set_config('test.pledge', v_pledge->>'id', true);
  PERFORM set_config('test.notice', v_notice->>'id', true);
  PERFORM set_config('test.bill', v_bill::text, true);
  PERFORM set_config('test.reminder', v_reminder::text, true);
END;
$$;

-- 1. Every kind of write moves the mark of its own commune, and only that.
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  v_other uuid := current_setting('test.other')::uuid;
  v_write record; v_home_before bigint; v_other_before bigint; v_mark text; v_other_mark text;
BEGIN
  PERFORM pg_temp.act('ll-ann');
  FOR v_write IN SELECT * FROM (VALUES
    ('communes', 'name', format('id = %L', v_home)),
    ('commune_members', 'role', format('commune_id = %L AND user_id = %L', v_home, 'll-ben')),
    ('commune_invites', 'role', format('commune_id = %L', v_home)),
    ('expenses', 'title', format('commune_id = %L', v_home)),
    ('expense_shares', 'amount_minor', format('id = %L', current_setting('test.share'))),
    ('expense_share_receipts', 'reference', format('share_id = %L', current_setting('test.share'))),
    ('expense_share_payment_reports', 'reference', format('share_id = %L', current_setting('test.report_share'))),
    ('expense_revisions', 'reason', format('expense_id = %L', current_setting('test.expense'))),
    ('funds', 'name', format('commune_id = %L', v_home)),
    ('fund_commitments', 'amount_minor', format('fund_id = %L', current_setting('test.fund'))),
    ('fund_contributions', 'amount_minor', format('commitment_id = %L', current_setting('test.pledge'))),
    ('fund_pledge_requests', 'amount_minor', format('commitment_id = %L', current_setting('test.pledge'))),
    ('notifications', 'detail', format('commune_id = %L', v_home)),
    ('reminders', 'amount_minor', format('commune_id = %L', v_home)),
    ('reminder_email_outbox', 'status', format('reminder_id = %L', current_setting('test.reminder'))),
    ('commune_notes', 'title', format('commune_id = %L', v_home)),
    ('note_revisions', 'title', format('commune_id = %L', v_home)),
    ('commune_operations', 'title', format('commune_id = %L', v_home)),
    ('operation_occurrences', 'reason', format('commune_id = %L', v_home)),
    ('commune_announcements', 'title', format('commune_id = %L', v_home)),
    ('announcement_acknowledgements', 'user_id', format('announcement_id = %L', current_setting('test.notice'))),
    ('recurring_bills', 'title', format('commune_id = %L', v_home)),
    ('recurring_bill_occurrences', 'note', format('bill_id = %L', current_setting('test.bill'))),
    ('split_templates', 'name', format('commune_id = %L', v_home)),
    ('commune_events', 'title', format('commune_id = %L', v_home))
  ) AS w(table_name, column_name, condition) LOOP
    PERFORM pg_temp.next_transaction();
    v_home_before := pg_temp.changes(v_home);
    v_other_before := pg_temp.changes(v_other);
    v_mark := commune_private.change_mark(v_home);
    v_other_mark := commune_private.change_mark(v_other);
    EXECUTE format('UPDATE public.%I SET %I = %I WHERE %s', v_write.table_name, v_write.column_name, v_write.column_name, v_write.condition);
    IF pg_temp.changes(v_home) <> v_home_before + 1 OR commune_private.change_mark(v_home) = v_mark THEN
      RAISE EXCEPTION 'A write to % did not move its commune''s mark', v_write.table_name;
    END IF;
    IF pg_temp.changes(v_other) <> v_other_before OR commune_private.change_mark(v_other) <> v_other_mark THEN
      RAISE EXCEPTION 'A write to % moved another commune''s mark', v_write.table_name;
    END IF;
  END LOOP;

  -- Inserting and deleting count too; trimming an old email payload does not.
  PERFORM pg_temp.next_transaction();
  v_home_before := pg_temp.changes(v_home);
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_home, 'll-ann', 'notes', gen_random_uuid(), 'Wifi', 'Updated');
  PERFORM pg_temp.next_transaction();
  DELETE FROM public.commune_events WHERE commune_id = v_home AND title = 'Wifi' AND description = 'Updated';
  PERFORM pg_temp.next_transaction();
  UPDATE public.reminder_email_outbox SET payload = NULL WHERE reminder_id = current_setting('test.reminder')::uuid;
  IF pg_temp.changes(v_home) <> v_home_before + 2 THEN
    RAISE EXCEPTION 'Expected one change for the insert and one for the delete, and none for trimming a payload, got %',
      pg_temp.changes(v_home) - v_home_before;
  END IF;
END;
$$;

-- 2. One change row per commune per transaction, however many rows a command
-- writes; a rolled-back part of a transaction takes its change row with it.
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  v_other uuid := current_setting('test.other')::uuid;
  v_before bigint; v_other_before bigint;
BEGIN
  PERFORM pg_temp.act('ll-ann');
  PERFORM pg_temp.next_transaction();
  v_before := pg_temp.changes(v_home);
  v_other_before := pg_temp.changes(v_other);
  PERFORM public.create_expense_command(v_home, 'Big shop', 9000,
    '[{"user_id":"ll-ann","amount_minor":3000},{"user_id":"ll-ben","amount_minor":3000},{"user_id":"ll-dee","amount_minor":3000}]'::jsonb,
    NULL, NULL, 'Groceries', gen_random_uuid());
  PERFORM public.record_share_receipt(current_setting('test.share')::uuid, 100, current_date, NULL, gen_random_uuid());
  PERFORM public.update_commune_details(v_home, 'Lighter house', 'household', 'GBP');
  IF pg_temp.changes(v_home) <> v_before + 1 THEN
    RAISE EXCEPTION 'A transaction with many writes should add one change row, added %', pg_temp.changes(v_home) - v_before;
  END IF;
  -- A second commune in the same transaction gets its own row.
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_other, 'll-cat', 'notes', gen_random_uuid(), 'Keys', 'Created');
  IF pg_temp.changes(v_other) <> v_other_before + 1 OR pg_temp.changes(v_home) <> v_before + 1 THEN
    RAISE EXCEPTION 'Each commune written to should have one change row';
  END IF;

  PERFORM pg_temp.next_transaction();
  v_before := pg_temp.changes(v_home);
  BEGIN
    INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
      VALUES (v_home, 'll-ann', 'notes', gen_random_uuid(), 'Bins', 'Created');
    RAISE EXCEPTION 'roll this part back';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  IF pg_temp.changes(v_home) <> v_before THEN RAISE EXCEPTION 'A rolled-back write left a change row'; END IF;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_home, 'll-ann', 'notes', gen_random_uuid(), 'Bins', 'Created');
  IF pg_temp.changes(v_home) <> v_before + 1 THEN
    RAISE EXCEPTION 'A write after a rolled-back one should still be noted';
  END IF;
END;
$$;

-- 3. What a mark counts: rows since the start of yesterday (UTC), so a lower
-- id committing late still moves it, and pruning never reaches them.
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  v_mark text; v_yesterday timestamptz := (date_trunc('day', now() AT TIME ZONE 'UTC') - interval '1 day') AT TIME ZONE 'UTC';
  v_pruned jsonb;
BEGIN
  v_mark := commune_private.change_mark(v_home);
  IF split_part(v_mark, ':', 1) <> to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD') THEN
    RAISE EXCEPTION 'A mark starts with today''s UTC date, got %', v_mark;
  END IF;
  -- A transaction that took a lower id commits after the mark was read.
  INSERT INTO commune_private.commune_changes (id, commune_id) OVERRIDING SYSTEM VALUE
    VALUES ((SELECT min(id) - 1 FROM commune_private.commune_changes), v_home);
  IF commune_private.change_mark(v_home) = v_mark THEN
    RAISE EXCEPTION 'A change with a lower id that commits late must move the mark';
  END IF;
  v_mark := commune_private.change_mark(v_home);
  INSERT INTO commune_private.commune_changes (commune_id, changed_at) VALUES (v_home, v_yesterday - interval '1 second');
  IF commune_private.change_mark(v_home) <> v_mark THEN
    RAISE EXCEPTION 'A change from before yesterday is outside the mark';
  END IF;
  INSERT INTO commune_private.commune_changes (commune_id, changed_at) VALUES (v_home, v_yesterday);
  IF commune_private.change_mark(v_home) = v_mark THEN
    RAISE EXCEPTION 'A change from the start of yesterday is inside the mark';
  END IF;
  v_mark := commune_private.change_mark(v_home);
  INSERT INTO commune_private.commune_changes (commune_id, changed_at) VALUES
    (v_home, now() - interval '2 days 1 second'), (v_home, now() - interval '3 days');
  v_pruned := commune_private.prune_delivery_records();
  IF (v_pruned->>'changeMarks')::int <> 2 OR commune_private.change_mark(v_home) <> v_mark
     OR NOT EXISTS (SELECT 1 FROM commune_private.commune_changes WHERE commune_id = v_home AND changed_at = v_yesterday - interval '1 second') THEN
    RAISE EXCEPTION 'Pruning should remove only changes older than 2 days, got %', v_pruned;
  END IF;
END;
$$;

-- 4. The commune list: the caller's own communes, newest first, with marks.
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  v_other uuid := current_setting('test.other')::uuid;
  v_list jsonb; v_second uuid;
BEGIN
  PERFORM pg_temp.act('ll-ann');
  v_second := public.create_commune('Ann''s workspace', 'workspace', 'EUR');
  UPDATE public.communes SET created_at = created_at + interval '1 minute' WHERE id = v_second;
  v_list := public.my_communes();
  IF jsonb_array_length(v_list) <> 2 OR (v_list->0->>'id')::uuid <> v_second OR (v_list->1->>'id')::uuid <> v_home THEN
    RAISE EXCEPTION 'Ann should see her two communes, newest first: %', v_list;
  END IF;
  IF v_list->1->>'name' <> 'Lighter house' OR v_list->1->>'kind' <> 'household' OR v_list->1->>'currency' <> 'GBP'
     OR v_list->1->>'role' <> 'admin' OR (v_list->1->>'memberCount')::int <> 3 OR v_list->1->>'address' <> ''
     OR NOT (v_list->1 ?& ARRAY['destination', 'stayName', 'stayAddress'])
     OR v_list->1->>'changeMark' <> commune_private.change_mark(v_home)
     OR v_list->1->>'changeMark' <> public.commune_snapshot(v_home)->>'changeMark' THEN
    RAISE EXCEPTION 'The list should carry the commune''s details and the same mark as its snapshot: %', v_list->1;
  END IF;
  PERFORM pg_temp.act('ll-cat');
  v_list := public.my_communes();
  IF jsonb_array_length(v_list) <> 1 OR (v_list->0->>'id')::uuid <> v_other OR v_list->0->>'role' <> 'admin' THEN
    RAISE EXCEPTION 'Cat should see only her own commune: %', v_list;
  END IF;
  -- Someone who left sees nothing of the commune.
  UPDATE public.commune_members SET active = false, left_at = now() WHERE commune_id = v_home AND user_id = 'll-dee';
  PERFORM pg_temp.act('ll-dee');
  IF public.my_communes() <> '[]'::jsonb THEN RAISE EXCEPTION 'A former member still lists the commune'; END IF;
  PERFORM pg_temp.act('ll-ann');
  IF (public.my_communes()->1->>'memberCount')::int <> 2 THEN RAISE EXCEPTION 'A former member is still counted'; END IF;
END;
$$;

-- 5. The row checks on communes and commune_members still let a member read
-- their own communes and nobody else's, now looked up once per query.
SELECT pg_temp.act('ll-ann');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.communes) <> 2
     OR EXISTS (SELECT 1 FROM public.communes WHERE id = current_setting('test.other')::uuid)
     OR (SELECT count(*) FROM public.commune_members WHERE commune_id = current_setting('test.home')::uuid) <> 3
     OR EXISTS (SELECT 1 FROM public.commune_members WHERE commune_id = current_setting('test.other')::uuid) THEN
    RAISE EXCEPTION 'Ann should read her own communes and their members only';
  END IF;
END;
$$;
RESET ROLE;
SELECT pg_temp.act('ll-dee');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.communes) OR EXISTS (SELECT 1 FROM public.commune_members) THEN
    RAISE EXCEPTION 'A former member can still read the commune';
  END IF;
END;
$$;
RESET ROLE;
SELECT pg_temp.act('ll-cat');
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.communes) <> 1
     OR (SELECT count(*) FROM public.commune_members) <> 1
     OR EXISTS (SELECT 1 FROM public.communes WHERE id = current_setting('test.home')::uuid) THEN
    RAISE EXCEPTION 'Cat should read only her own commune';
  END IF;
END;
$$;
RESET ROLE;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'communes' AND policyname = 'commune_read'
      AND qual LIKE '%my_commune_ids%')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'commune_members' AND policyname = 'member_read'
      AND qual LIKE '%my_commune_ids%') THEN
    RAISE EXCEPTION 'The row checks should look the caller''s communes up once per query';
  END IF;
  IF has_function_privilege('anonymous', 'commune_private.my_commune_ids()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Only a signed-in person''s row checks use the helper';
  END IF;
END;
$$;

-- 6. Creating communes is limited to 10 an hour, 30 a day and 100 in all.
DO $$
DECLARE v_error text; i integer;
BEGIN
  PERFORM pg_temp.act('ll-maker');
  FOR i IN 1..10 LOOP PERFORM public.create_commune('Maker ' || i, 'household', 'GBP'); END LOOP;
  v_error := pg_temp.refused($sql$SELECT public.create_commune('One more', 'household', 'GBP')$sql$);
  IF v_error IS DISTINCT FROM 'P0001 You have created 10 communes in the last hour. Try again later.' THEN
    RAISE EXCEPTION 'An eleventh commune in an hour: %', v_error;
  END IF;
  -- The other way of creating one is held to the same limit.
  v_error := pg_temp.refused($sql$SELECT public.create_commune_with_location('One more', 'household', 'GBP', '', '', '', '')$sql$);
  IF v_error NOT LIKE 'P0001 You have created 10 communes in the last hour%' THEN
    RAISE EXCEPTION 'Creating with a location skipped the limit: %', v_error;
  END IF;
  UPDATE public.communes SET created_at = now() - interval '3 hours' WHERE created_by = 'll-maker';
  FOR i IN 11..20 LOOP PERFORM public.create_commune('Maker ' || i, 'household', 'GBP'); END LOOP;
  UPDATE public.communes SET created_at = now() - interval '2 hours' WHERE created_by = 'll-maker' AND created_at = now();
  FOR i IN 21..30 LOOP PERFORM public.create_commune('Maker ' || i, 'household', 'GBP'); END LOOP;
  UPDATE public.communes SET created_at = now() - interval '90 minutes' WHERE created_by = 'll-maker' AND created_at = now();
  v_error := pg_temp.refused($sql$SELECT public.create_commune('One more', 'household', 'GBP')$sql$);
  IF v_error IS DISTINCT FROM 'P0001 You have created 30 communes in the last day. Try again tomorrow.' THEN
    RAISE EXCEPTION 'A 31st commune in a day: %', v_error;
  END IF;
  UPDATE public.communes SET created_at = now() - interval '2 days' WHERE created_by = 'll-maker';
  INSERT INTO public.communes (name, kind, currency, created_by, created_at)
    SELECT 'Older ' || g, 'household', 'GBP', 'll-maker', now() - interval '30 days' FROM generate_series(1, 69) g;
  PERFORM public.create_commune('The hundredth', 'household', 'GBP');
  v_error := pg_temp.refused($sql$SELECT public.create_commune('One more', 'household', 'GBP')$sql$);
  IF v_error IS DISTINCT FROM 'P0001 You have created 100 communes, which is the most one account can create.' THEN
    RAISE EXCEPTION 'A 101st commune: %', v_error;
  END IF;
  -- Someone else is not affected.
  PERFORM pg_temp.act('ll-fresh');
  PERFORM public.create_commune('Fresh start', 'household', 'GBP');
END;
$$;

-- 7. The snapshot carries open expenses and those created or changed since
-- the start of last month (UTC); expenseHistory says how many it left out.
CREATE FUNCTION pg_temp.expense(p_home uuid, p_title text, p_settle boolean) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  v_id := public.create_expense(p_home, p_title, 2000,
    '[{"user_id":"ll-ann","amount_minor":1000},{"user_id":"ll-ben","amount_minor":1000}]'::jsonb, current_date);
  IF p_settle THEN
    PERFORM public.record_share_receipt((SELECT id FROM public.expense_shares WHERE expense_id = v_id AND user_id = 'll-ben'),
      1000, current_date, NULL, gen_random_uuid());
  END IF;
  RETURN v_id;
END;
$$;
-- When each part of an expense happened, as if recorded then.
CREATE FUNCTION pg_temp.age(p_expense uuid, p_created timestamptz, p_changed timestamptz) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);
  UPDATE public.expenses SET created_at = p_created,
      updated_at = CASE WHEN updated_at IS NULL THEN NULL ELSE p_changed END,
      voided_at = CASE WHEN voided_at IS NULL THEN NULL ELSE p_changed END
    WHERE id = p_expense;
  UPDATE public.expense_shares SET settled_at = CASE WHEN settled_at IS NULL THEN NULL ELSE p_changed END WHERE expense_id = p_expense;
  UPDATE public.expense_share_receipts r SET recorded_at = p_changed
    FROM public.expense_shares s WHERE s.id = r.share_id AND s.expense_id = p_expense;
  UPDATE public.expense_revisions SET created_at = p_changed WHERE expense_id = p_expense;
  PERFORM set_config('session_replication_role', 'origin', true);
END;
$$;

DO $$
DECLARE
  v_home uuid; v_window timestamptz := commune_private.expense_window_start();
  v_old timestamptz := commune_private.expense_window_start() - interval '3 months';
  v_recent timestamptz := now() - interval '1 hour';
  v_open uuid; v_quiet uuid; v_new uuid; v_settled uuid; v_voided uuid; v_quiet_void uuid; v_edited uuid; v_edge_in uuid; v_edge_out uuid;
  v_snapshot jsonb; v_ids uuid[]; v_history jsonb;
BEGIN
  PERFORM pg_temp.act('ll-ann');
  v_home := public.create_commune('History home', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role) VALUES (v_home, 'll-ben', 'member');
  v_open := pg_temp.expense(v_home, 'Old and open', false);
  v_quiet := pg_temp.expense(v_home, 'Old and settled', true);
  v_new := pg_temp.expense(v_home, 'New and settled', true);
  v_settled := pg_temp.expense(v_home, 'Old, settled lately', true);
  v_voided := pg_temp.expense(v_home, 'Old, voided lately', false);
  PERFORM public.void_expense(v_voided, 1, 'Entered twice', gen_random_uuid());
  v_quiet_void := pg_temp.expense(v_home, 'Old and voided', false);
  PERFORM public.void_expense(v_quiet_void, 1, 'Entered twice', gen_random_uuid());
  v_edited := pg_temp.expense(v_home, 'Old, edited lately', true);
  PERFORM public.correct_expense(v_edited, 1, 'Old, edited lately', 2000,
    '[{"user_id":"ll-ann","amount_minor":1000},{"user_id":"ll-ben","amount_minor":1000}]'::jsonb, current_date,
    'll-ann', 'Utilities', 'Right category', gen_random_uuid());
  v_edge_in := pg_temp.expense(v_home, 'First moment of the window', true);
  v_edge_out := pg_temp.expense(v_home, 'Last moment before it', true);
  PERFORM pg_temp.age(v_open, v_old, v_old);
  PERFORM pg_temp.age(v_quiet, v_old, v_old);
  PERFORM pg_temp.age(v_new, v_recent, v_recent);
  PERFORM pg_temp.age(v_settled, v_old, v_recent);
  PERFORM pg_temp.age(v_voided, v_old, v_recent);
  PERFORM pg_temp.age(v_quiet_void, v_old, v_old);
  PERFORM pg_temp.age(v_edited, v_old, v_old);
  UPDATE public.expenses SET updated_at = v_recent WHERE id = v_edited;
  PERFORM pg_temp.age(v_edge_in, v_window, v_window);
  PERFORM pg_temp.age(v_edge_out, v_window - interval '1 second', v_window - interval '1 second');

  v_snapshot := public.commune_snapshot(v_home);
  SELECT array_agg((e->>'id')::uuid) INTO v_ids FROM jsonb_array_elements(v_snapshot->'expenses') e;
  IF NOT v_ids @> ARRAY[v_open, v_new, v_settled, v_voided, v_edited, v_edge_in] OR v_ids && ARRAY[v_quiet, v_quiet_void, v_edge_out]
     OR cardinality(v_ids) <> 6 THEN
    RAISE EXCEPTION 'The snapshot carried the wrong expenses: %', v_snapshot->'expenses';
  END IF;
  v_history := v_snapshot->'expenseHistory';
  IF v_history <> jsonb_build_object('since', to_char(v_window AT TIME ZONE 'UTC', 'YYYY-MM-DD'), 'olderCount', 3, 'olderVoidedCount', 1) THEN
    RAISE EXCEPTION 'expenseHistory should count the three left out, one of them voided: %', v_history;
  END IF;
  IF to_char(v_window AT TIME ZONE 'UTC', 'DD HH24:MI:SS') <> '01 00:00:00'
     OR v_window <> (date_trunc('month', (date_trunc('month', now() AT TIME ZONE 'UTC') - interval '1 day')) AT TIME ZONE 'UTC') THEN
    RAISE EXCEPTION 'The window should start at midnight UTC on the first day of last month, got %', v_window;
  END IF;
  -- Every other part of the snapshot keeps its shape.
  IF NOT v_snapshot ?& ARRAY['commune', 'members', 'expenses', 'funds', 'notifications', 'reminderTargets', 'sentReminders',
      'notes', 'operations', 'announcements', 'recurringBills', 'splitTemplates', 'activityEvents', 'expenseHistory', 'changeMark'] THEN
    RAISE EXCEPTION 'The snapshot lost a part: %', (SELECT array_agg(k) FROM jsonb_object_keys(v_snapshot) k);
  END IF;
  -- One builder: an expense looks the same however it is fetched.
  IF (SELECT e FROM jsonb_array_elements(v_snapshot->'expenses') e WHERE (e->>'id')::uuid = v_open)
     <> public.commune_expense_records(v_home, ARRAY[v_open])->'expenses'->0 THEN
    RAISE EXCEPTION 'The snapshot and the record of one expense differ';
  END IF;
  PERFORM set_config('test.history_home', v_home::text, true);
  PERFORM set_config('test.quiet', v_quiet::text, true);
  PERFORM set_config('test.quiet_void', v_quiet_void::text, true);
  PERFORM set_config('test.edge_out', v_edge_out::text, true);
  PERFORM set_config('test.history_open', v_open::text, true);
END;
$$;

-- 8. Pages of older expenses, a month or more at a time, and named records.
DO $$
DECLARE
  v_home uuid := current_setting('test.history_home')::uuid;
  v_window timestamptz := commune_private.expense_window_start();
  v_page jsonb; v_ids uuid[]; v_error text; v_other_expense uuid;
BEGIN
  PERFORM pg_temp.act('ll-ben');
  -- The month before the window holds the one from its last second.
  v_page := public.commune_expense_page(v_home, NULL, 1);
  SELECT array_agg((e->>'id')::uuid) INTO v_ids FROM jsonb_array_elements(v_page->'expenses') e;
  IF v_ids IS DISTINCT FROM ARRAY[current_setting('test.edge_out')::uuid]
     OR v_page->>'before' <> to_char(v_window AT TIME ZONE 'UTC', 'YYYY-MM-DD')
     OR v_page->>'from' <> to_char((v_window - interval '1 month') AT TIME ZONE 'UTC', 'YYYY-MM-DD')
     OR (v_page->>'olderCount')::int <> 2 OR (v_page->>'olderVoidedCount')::int <> 1 THEN
    RAISE EXCEPTION 'First page: %', v_page;
  END IF;
  -- The next month is empty, so the page reaches back to the month that has some.
  v_page := public.commune_expense_page(v_home, (v_page->>'from')::date, 1);
  SELECT array_agg((e->>'id')::uuid ORDER BY e->>'title') INTO v_ids FROM jsonb_array_elements(v_page->'expenses') e;
  IF NOT v_ids @> ARRAY[current_setting('test.quiet')::uuid, current_setting('test.quiet_void')::uuid] OR cardinality(v_ids) <> 2
     OR v_page->>'from' <> to_char((v_window - interval '3 months') AT TIME ZONE 'UTC', 'YYYY-MM-DD')
     OR (v_page->>'olderCount')::int <> 0 THEN
    RAISE EXCEPTION 'Second page should skip the empty month: %', v_page;
  END IF;
  -- Nothing older: an empty page with no start.
  v_page := public.commune_expense_page(v_home, (v_page->>'from')::date, 1);
  IF v_page->'expenses' <> '[]'::jsonb OR v_page->'from' <> 'null'::jsonb OR (v_page->>'olderCount')::int <> 0 THEN
    RAISE EXCEPTION 'Past the beginning: %', v_page;
  END IF;
  -- Everything before the window at once, for a statement or an export.
  v_page := public.commune_expense_page(v_home, NULL, NULL);
  IF jsonb_array_length(v_page->'expenses') <> 3 OR v_page->'from' <> 'null'::jsonb OR (v_page->>'olderCount')::int <> 0 THEN
    RAISE EXCEPTION 'All older expenses: %', v_page;
  END IF;
  -- An open expense is always in the snapshot, never in a page.
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_page->'expenses') e WHERE (e->>'id')::uuid = current_setting('test.history_open')::uuid) THEN
    RAISE EXCEPTION 'A page repeated an open expense';
  END IF;
  v_error := pg_temp.refused(format('SELECT public.commune_expense_page(%L, NULL, 0)', v_home));
  IF v_error NOT LIKE '22023 %' THEN RAISE EXCEPTION 'Zero months: %', v_error; END IF;
  v_error := pg_temp.refused(format('SELECT public.commune_expense_page(%L, NULL, 13)', v_home));
  IF v_error NOT LIKE '22023 %' THEN RAISE EXCEPTION 'Thirteen months: %', v_error; END IF;

  -- Named records: only this commune's, at most 50 at a time.
  SELECT e.id INTO v_other_expense FROM public.expenses e WHERE e.commune_id = current_setting('test.home')::uuid LIMIT 1;
  v_page := public.commune_expense_records(v_home, ARRAY[current_setting('test.quiet')::uuid, v_other_expense, gen_random_uuid()]);
  IF jsonb_array_length(v_page->'expenses') <> 1 OR (v_page->'expenses'->0->>'id')::uuid <> current_setting('test.quiet')::uuid THEN
    RAISE EXCEPTION 'Records should hold only this commune''s expense: %', v_page;
  END IF;
  v_error := pg_temp.refused(format('SELECT public.commune_expense_records(%L, %L::uuid[])', v_home,
    (SELECT array_agg(gen_random_uuid()) FROM generate_series(1, 51))));
  IF v_error NOT LIKE '22023 %' THEN RAISE EXCEPTION 'Fifty-one ids: %', v_error; END IF;
  v_error := pg_temp.refused(format('SELECT public.commune_expense_records(%L, ''{}''::uuid[])', v_home));
  IF v_error NOT LIKE '22023 %' THEN RAISE EXCEPTION 'No ids: %', v_error; END IF;
END;
$$;

-- 9. The overview summary: the same parts, less the detail of the commune's
-- own screens, and marked as a summary.
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  v_full jsonb; v_summary jsonb;
BEGIN
  PERFORM pg_temp.act('ll-ann');
  v_full := public.commune_snapshot(v_home);
  v_summary := public.commune_summary(v_home);
  IF v_summary->>'detail' <> 'summary' OR v_full ? 'detail'
     OR (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(v_summary - 'detail') k)
       <> (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(v_full) k) THEN
    RAISE EXCEPTION 'A summary should have the snapshot''s parts and say it is one';
  END IF;
  IF (SELECT array_agg(e->>'id') FROM jsonb_array_elements(v_summary->'expenses') e)
       <> (SELECT array_agg(e->>'id') FROM jsonb_array_elements(v_full->'expenses') e)
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_summary->'expenses') e, jsonb_array_elements(e->'shares') s
       WHERE e->'revisions' <> '[]'::jsonb OR s->'receipts' <> '[]'::jsonb OR s->'paymentReports' <> '[]'::jsonb)
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_full->'expenses') e, jsonb_array_elements(e->'shares') s
       WHERE s->'receipts' <> '[]'::jsonb) THEN
    RAISE EXCEPTION 'Summary expenses should keep their shares without repayment, report or correction history';
  END IF;
  IF v_summary->'notes'->0->>'body' <> '' OR v_summary->'notes'->0->>'title' <> 'Wifi'
     OR v_summary->'operations'->0->'history' <> '[]'::jsonb OR v_summary->'operations'->0->>'title' <> 'Bins'
     OR v_summary->'recurringBills'->0->'history' <> '[]'::jsonb
     OR v_summary->'announcements' <> '[]'::jsonb OR v_summary->'splitTemplates' <> '[]'::jsonb
     OR v_summary->'sentReminders' <> '[]'::jsonb OR v_summary->'notifications' <> '[]'::jsonb
     OR v_summary->'commune' <> v_full->'commune' OR v_summary->'members' <> v_full->'members'
     OR v_summary->'activityEvents' <> v_full->'activityEvents' OR v_summary->'funds' <> v_full->'funds'
     OR v_summary->'expenseHistory' <> v_full->'expenseHistory' OR v_summary->>'changeMark' <> v_full->>'changeMark' THEN
    RAISE EXCEPTION 'The summary dropped or kept the wrong parts';
  END IF;
END;
$$;

-- 10. Someone outside a commune, or who left it, gets none of it.
DO $$
DECLARE v_home uuid := current_setting('test.history_home')::uuid; v_user text; v_call text; v_error text;
BEGIN
  INSERT INTO public.commune_members (commune_id, user_id, role, active, left_at) VALUES (v_home, 'll-dee', 'member', false, now());
  FOREACH v_user IN ARRAY ARRAY['ll-cat', 'll-dee'] LOOP
    PERFORM pg_temp.act(v_user);
    FOREACH v_call IN ARRAY ARRAY[
      format('SELECT public.commune_snapshot(%L)', v_home),
      format('SELECT public.commune_summary(%L)', v_home),
      format('SELECT public.commune_expense_page(%L, NULL, 1)', v_home),
      format('SELECT public.commune_expense_page(%L, NULL, NULL)', v_home),
      format('SELECT public.commune_expense_records(%L, ARRAY[%L]::uuid[])', v_home, current_setting('test.quiet'))
    ] LOOP
      v_error := pg_temp.refused(v_call);
      IF v_error NOT LIKE '42501 %' THEN RAISE EXCEPTION '% was not refused for %: %', v_call, v_user, v_error; END IF;
    END LOOP;
  END LOOP;
  FOREACH v_call IN ARRAY ARRAY['public.my_communes()', 'public.commune_summary(uuid)',
      'public.commune_expense_page(uuid,date,integer)', 'public.commune_expense_records(uuid,uuid[])'] LOOP
    IF has_function_privilege('anonymous', v_call, 'EXECUTE') OR has_function_privilege('public', v_call, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_call, 'EXECUTE') THEN
      RAISE EXCEPTION 'Unexpected execution grant on %', v_call;
    END IF;
  END LOOP;
END;
$$;

ROLLBACK;
