-- Recurring bill commands (0026). Run only in an empty disposable local DB
-- built from infra/local/bootstrap.sql, every migration and after-core.sql
-- (app_auth stands in for Neon Auth). Everything is rolled back.
BEGIN;

CREATE FUNCTION pg_temp.act_as(p_user text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
-- Each attempt returns 'ok', or the SQLSTATE and message it was refused with.
CREATE FUNCTION pg_temp.try_save(p_commune uuid, p_title text, p_amount bigint, p_payer text, p_shares jsonb,
  p_frequency text, p_due date, p_id uuid DEFAULT NULL, p_version integer DEFAULT NULL,
  p_request uuid DEFAULT gen_random_uuid(), p_paused boolean DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.save_recurring_bill(p_commune, p_title, p_amount, p_payer, p_shares, p_frequency, p_due, p_id, p_version,
    CASE WHEN p_id IS NULL THEN p_request END, p_paused);
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE || ' ' || SQLERRM;
END;
$$;
CREATE FUNCTION pg_temp.try_command(p_command text, p_id uuid, p_flag boolean DEFAULT NULL, p_due date DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  CASE p_command
    WHEN 'pause' THEN PERFORM public.set_recurring_bill_paused(p_id, p_flag);
    WHEN 'archive' THEN PERFORM public.set_recurring_bill_archived(p_id, p_flag);
    WHEN 'record' THEN PERFORM public.record_recurring_period(p_id, p_due, NULL);
    WHEN 'skip' THEN PERFORM public.skip_recurring_period(p_id, p_due, p_reason);
  END CASE;
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE || ' ' || SQLERRM;
END;
$$;
CREATE FUNCTION pg_temp.expect(p_got text, p_pattern text, p_case text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_got IS NULL OR p_got NOT LIKE p_pattern THEN
    RAISE EXCEPTION '%: expected "%", got "%"', p_case, p_pattern, p_got;
  END IF;
END;
$$;
CREATE FUNCTION pg_temp.split(VARIADIC p_parts text[]) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_agg(jsonb_build_object('user_id', p_parts[i], 'amount_minor', p_parts[i + 1]::bigint) ORDER BY i)
  FROM generate_series(1, cardinality(p_parts), 2) i;
$$;
CREATE FUNCTION pg_temp.bill(p_id uuid) RETURNS public.recurring_bills LANGUAGE sql AS $$
  SELECT * FROM public.recurring_bills WHERE id = p_id;
$$;

DO $$
DECLARE v_home uuid; v_other uuid;
BEGIN
  INSERT INTO app_auth.users (id, name, email, email_verified)
    VALUES ('00000000-0000-4000-8000-0000000000a1', 'Avery Admin', 'avery@bills.test', true),
           ('00000000-0000-4000-8000-0000000000b2', 'Blake Payer', 'blake@bills.test', true),
           ('00000000-0000-4000-8000-0000000000c3', 'Casey Member', 'casey@bills.test', true),
           ('00000000-0000-4000-8000-0000000000d4', 'Dana Leaver', 'dana@bills.test', true),
           ('00000000-0000-4000-8000-0000000000f6', 'Finley Leaver', 'finley@bills.test', true),
           ('00000000-0000-4000-8000-0000000000a7', 'Gale Member', 'gale@bills.test', true),
           ('00000000-0000-4000-8000-0000000000e5', 'Eve Outsider', 'eve@bills.test', true);
  PERFORM pg_temp.act_as('00000000-0000-4000-8000-0000000000a1');
  v_home := public.create_commune('Bill house', 'household', 'GBP');
  v_other := public.create_commune('Second house', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role)
    SELECT v_home, u, 'member' FROM unnest(ARRAY['00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000c3',
      '00000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-0000000000f6', '00000000-0000-4000-8000-0000000000a7']) u;
  PERFORM set_config('test.home', v_home::text, true);
  PERFORM set_config('test.other', v_other::text, true);
END;
$$;

SET ROLE authenticated;
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  v_other uuid := current_setting('test.other')::uuid;
  a text := '00000000-0000-4000-8000-0000000000a1';
  b text := '00000000-0000-4000-8000-0000000000b2';
  c text := '00000000-0000-4000-8000-0000000000c3';
  g text := '00000000-0000-4000-8000-0000000000a7';
  e text := '00000000-0000-4000-8000-0000000000e5';
  v_bill uuid; v_next date; v_result jsonb; v_row public.recurring_bills%ROWTYPE; v_request uuid := gen_random_uuid(); v_snapshot jsonb;
  v_someone text;
BEGIN
  -- Blake adds a bill he pays. His screen loads version 1: £90, due three days ago.
  PERFORM pg_temp.act_as(b);
  v_bill := public.save_recurring_bill(v_home, ' Broadband ', 9000, b, pg_temp.split(b, '4500', c, '4500'), 'monthly',
    current_date - 3, p_request_id => v_request);
  IF (pg_temp.bill(v_bill)).version <> 1 OR (pg_temp.bill(v_bill)).title <> 'Broadband' THEN RAISE EXCEPTION 'New bill is wrong'; END IF;
  -- A retried add returns the same bill; the request cannot add a bill elsewhere; an add needs a request id.
  IF public.save_recurring_bill(v_home, 'Broadband', 9000, b, pg_temp.split(b, '4500', c, '4500'), 'monthly',
       current_date - 3, p_request_id => v_request) <> v_bill
     OR (SELECT count(*) FROM public.recurring_bills WHERE commune_id = v_home) <> 1 THEN
    RAISE EXCEPTION 'A retried add made a second bill';
  END IF;
  PERFORM pg_temp.act_as(a);
  PERFORM pg_temp.expect(pg_temp.try_save(v_other, 'Broadband', 9000, a, pg_temp.split(a, '9000'), 'monthly', current_date,
    p_request => v_request), 'ok', 'Another person may use the same request id');
  PERFORM pg_temp.act_as(b);
  PERFORM pg_temp.expect(pg_temp.try_save(v_home, 'Broadband', 9000, b, pg_temp.split(b, '9000'), 'monthly', current_date,
    p_request => NULL), '22023 A request id is required%', 'Add without a request id');

  -- Meanwhile Avery raises it to £96 and records this month's bill.
  PERFORM pg_temp.act_as(a);
  PERFORM public.save_recurring_bill(v_home, 'Broadband', 9600, b, pg_temp.split(b, '4800', c, '4800'), 'monthly',
    current_date - 3, v_bill, 1);
  v_result := public.record_recurring_period(v_bill, current_date - 3);
  v_next := (v_result->>'nextDueOn')::date;
  IF (pg_temp.bill(v_bill)).version <> 3 OR v_next <= current_date THEN RAISE EXCEPTION 'Edit and record did not each make a version'; END IF;

  -- Blake's stale Pause changes only the flag: not the amount, not the due date.
  PERFORM pg_temp.act_as(b);
  v_result := public.set_recurring_bill_paused(v_bill, true);
  v_row := pg_temp.bill(v_bill);
  IF v_row.amount_minor <> 9600 OR v_row.next_due_on <> v_next OR NOT v_row.paused OR v_row.version <> 4
     OR (v_result->>'duplicate')::boolean OR (v_result->>'version')::integer <> 4 THEN
    RAISE EXCEPTION 'A stale pause rewrote the bill: %', to_jsonb(v_row);
  END IF;
  -- His stale Edit is refused and changes nothing; his stale Record is the period already recorded.
  PERFORM pg_temp.expect(pg_temp.try_save(v_home, 'Broadband', 9000, b, pg_temp.split(b, '4500', c, '4500'), 'monthly',
    current_date - 3, v_bill, 1), 'P0001 This recurring bill was changed by someone else.%', 'Stale edit');
  IF (pg_temp.bill(v_bill)).amount_minor <> 9600 OR (pg_temp.bill(v_bill)).version <> 4 THEN RAISE EXCEPTION 'A stale edit changed the bill'; END IF;
  IF NOT (public.record_recurring_period(v_bill, current_date - 3)->>'duplicate')::boolean THEN
    RAISE EXCEPTION 'A repeated record was not reported as already recorded';
  END IF;

  -- Pause and resume are idempotent, and write their own history line once.
  v_result := public.set_recurring_bill_paused(v_bill, true);
  IF NOT (v_result->>'duplicate')::boolean OR (pg_temp.bill(v_bill)).version <> 4 THEN RAISE EXCEPTION 'A repeated pause changed the bill'; END IF;
  v_result := public.set_recurring_bill_paused(v_bill, false);
  IF (v_result->>'duplicate')::boolean OR (v_result->>'paused')::boolean OR (pg_temp.bill(v_bill)).version <> 5 THEN
    RAISE EXCEPTION 'Resume did not resume: %', v_result;
  END IF;
  IF NOT (public.set_recurring_bill_paused(v_bill, false)->>'duplicate')::boolean THEN RAISE EXCEPTION 'A repeated resume was not a no-op'; END IF;
  PERFORM pg_temp.expect(pg_temp.try_command('pause', v_bill, NULL), '22023 Choose pause or resume', 'Pause without a state');
  IF (SELECT array_agg(description ORDER BY description) FROM public.commune_events WHERE entity_id = v_bill AND description IN ('Paused', 'Resumed', 'Updated'))
     <> ARRAY['Paused', 'Resumed', 'Updated'] THEN
    RAISE EXCEPTION 'Pause and resume history is wrong';
  END IF;
  -- An edit never pauses or resumes.
  PERFORM pg_temp.expect(pg_temp.try_save(v_home, 'Broadband', 9600, b, pg_temp.split(b, '4800', c, '4800'), 'monthly',
    v_next, v_bill, 5, p_paused => true), '22023 An edit cannot pause or resume a bill.%', 'Pause through an edit');

  -- Avery makes Casey the payer. Blake added the bill but no longer pays it,
  -- so he cannot edit it either way, but he can still pause and resume it.
  PERFORM pg_temp.act_as(a);
  PERFORM public.save_recurring_bill(v_home, 'Broadband', 9600, c, pg_temp.split(b, '4800', c, '4800'), 'monthly', v_next, v_bill, 5);
  PERFORM pg_temp.act_as(b);
  PERFORM pg_temp.expect(pg_temp.try_save(v_home, 'Broadband', 9600, c, pg_temp.split(b, '4800', c, '4800'), 'monthly', v_next, v_bill, 6),
    '42501 Only an admin can schedule another member as payer', 'Creator edits keeping another payer');
  PERFORM pg_temp.expect(pg_temp.try_save(v_home, 'Broadband', 9600, b, pg_temp.split(b, '4800', c, '4800'), 'monthly', v_next, v_bill, 6),
    '42501 Only an admin, or the member who added this bill and pays it, can edit it', 'Creator takes the bill back');
  PERFORM pg_temp.expect(pg_temp.try_command('pause', v_bill, true), 'ok', 'Creator pauses');
  PERFORM pg_temp.expect(pg_temp.try_command('pause', v_bill, false), 'ok', 'Creator resumes');
  -- Casey pays it but did not add it: pause yes, edit no.
  PERFORM pg_temp.act_as(c);
  PERFORM pg_temp.expect(pg_temp.try_command('pause', v_bill, true), 'ok', 'Payer pauses');
  PERFORM pg_temp.expect(pg_temp.try_command('pause', v_bill, false), 'ok', 'Payer resumes');
  PERFORM pg_temp.expect(pg_temp.try_save(v_home, 'Broadband', 9600, c, pg_temp.split(b, '4800', c, '4800'), 'monthly', v_next, v_bill,
    (pg_temp.bill(v_bill)).version), '42501 Only an admin, or the member who added this bill and pays it%', 'Payer edits');
  -- Gale is only in the commune; Eve is not in it at all.
  FOREACH v_someone IN ARRAY ARRAY[g, e] LOOP
    PERFORM pg_temp.act_as(v_someone);
    PERFORM pg_temp.expect(pg_temp.try_command('pause', v_bill, true), '42501 %', 'Another member pauses');
    PERFORM pg_temp.expect(pg_temp.try_command('archive', v_bill, true), '42501 %', 'Another member archives');
  END LOOP;
  PERFORM pg_temp.act_as(e);
  PERFORM pg_temp.expect(pg_temp.try_save(v_home, 'Broadband', 9600, e, pg_temp.split(e, '9600'), 'monthly', v_next, v_bill,
    (pg_temp.bill(v_bill)).version), '42501 %', 'Outsider edits');

  -- Archive: Blake added it, so he may. It pauses the bill and leaves due lists.
  PERFORM pg_temp.act_as(b);
  v_result := public.set_recurring_bill_archived(v_bill, true);
  v_row := pg_temp.bill(v_bill);
  IF v_row.archived_at IS NULL OR NOT v_row.paused OR (v_result->>'duplicate')::boolean THEN RAISE EXCEPTION 'Archive did not archive'; END IF;
  IF NOT (public.set_recurring_bill_archived(v_bill, true)->>'duplicate')::boolean OR (pg_temp.bill(v_bill)).version <> v_row.version THEN
    RAISE EXCEPTION 'A repeated archive changed the bill';
  END IF;
  v_snapshot := (SELECT x FROM jsonb_array_elements(public.commune_snapshot(v_home)->'recurringBills') x WHERE x->>'id' = v_bill::text);
  IF v_snapshot->>'archivedAt' IS NULL OR (v_snapshot->>'version')::integer <> v_row.version OR NOT (v_snapshot->>'paused')::boolean THEN
    RAISE EXCEPTION 'Snapshot does not show the archived bill: %', v_snapshot;
  END IF;
  -- An archived bill cannot be recorded, skipped, paused, resumed or edited.
  PERFORM pg_temp.act_as(c);
  PERFORM pg_temp.expect(pg_temp.try_command('record', v_bill, NULL, v_next), 'P0001 This bill is archived.%', 'Record archived');
  PERFORM pg_temp.expect(pg_temp.try_command('skip', v_bill, NULL, v_next, 'Away'), 'P0001 This bill is archived.%', 'Skip archived');
  PERFORM pg_temp.expect(pg_temp.try_command('pause', v_bill, true), 'P0001 This bill is archived.%', 'Pause archived');
  PERFORM pg_temp.expect(pg_temp.try_command('pause', v_bill, false), 'P0001 This bill is archived.%', 'Resume archived');
  PERFORM pg_temp.act_as(a);
  PERFORM pg_temp.expect(pg_temp.try_save(v_home, 'Broadband', 9600, c, pg_temp.split(b, '4800', c, '4800'), 'monthly', v_next, v_bill,
    v_row.version), 'P0001 This bill is archived.%', 'Edit archived');
  -- Casey pays it, so he may restore it. It comes back paused, then resumes.
  PERFORM pg_temp.act_as(c);
  v_result := public.set_recurring_bill_archived(v_bill, false);
  IF (v_result->>'archivedAt') IS NOT NULL OR NOT (v_result->>'paused')::boolean OR (v_result->>'duplicate')::boolean THEN
    RAISE EXCEPTION 'Restore is wrong: %', v_result;
  END IF;
  IF NOT (public.set_recurring_bill_archived(v_bill, false)->>'duplicate')::boolean THEN RAISE EXCEPTION 'A repeated restore was not a no-op'; END IF;
  PERFORM pg_temp.expect(pg_temp.try_command('pause', v_bill, false), 'ok', 'Resume a restored bill');
  IF (SELECT count(*) FROM public.commune_events WHERE entity_id = v_bill AND description IN ('Archived', 'Restored, still paused')) <> 2
     OR (SELECT count(*) FROM public.commune_events WHERE entity_id = v_bill AND description = 'Updated') <> 2 THEN
    RAISE EXCEPTION 'Archive history is wrong';
  END IF;
  PERFORM set_config('test.bill', v_bill::text, true);
END;
$$;

-- People who left: resuming names them; taking them out of the split (and
-- choosing a new payer) lets the bill resume.
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  a text := '00000000-0000-4000-8000-0000000000a1';
  c text := '00000000-0000-4000-8000-0000000000c3';
  d text := '00000000-0000-4000-8000-0000000000d4';
  f text := '00000000-0000-4000-8000-0000000000f6';
  g text := '00000000-0000-4000-8000-0000000000a7';
  v_split uuid; v_payer uuid; v_phone uuid;
BEGIN
  PERFORM pg_temp.act_as(a);
  v_split := public.save_recurring_bill(v_home, 'Cleaner', 9000, a, pg_temp.split(c, '3000', d, '3000', f, '3000'), 'monthly',
    current_date + 5, p_request_id => gen_random_uuid());
  v_payer := public.save_recurring_bill(v_home, 'Gym', 4000, d, pg_temp.split(d, '2000', c, '2000'), 'weekly',
    current_date + 2, p_request_id => gen_random_uuid());
  -- Leaving is blocked by an active bill that includes the person.
  PERFORM pg_temp.act_as(d);
  BEGIN
    PERFORM public.manage_commune_member(v_home, d, 'leave');
    RAISE EXCEPTION 'Left while an active bill includes them';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Pause or update recurring bills%' THEN RAISE; END IF;
  END;
  PERFORM pg_temp.act_as(a);
  PERFORM public.set_recurring_bill_paused(v_split, true);
  PERFORM public.set_recurring_bill_paused(v_payer, true);
  PERFORM pg_temp.act_as(d);
  PERFORM public.manage_commune_member(v_home, d, 'leave');
  PERFORM pg_temp.act_as(f);
  PERFORM public.manage_commune_member(v_home, f, 'leave');

  PERFORM pg_temp.act_as(a);
  PERFORM pg_temp.expect(pg_temp.try_command('pause', v_split, false),
    'P0001 Dana Leaver and Finley Leaver have left the commune. Update the payer and split before resuming this bill.', 'Resume with two gone');
  PERFORM pg_temp.expect(pg_temp.try_command('pause', v_payer, false), 'P0001 Dana Leaver has left the commune.%', 'Resume with the payer gone');
  -- Pausing again is still fine.
  PERFORM pg_temp.expect(pg_temp.try_command('pause', v_split, true), 'ok', 'Pause a bill with people gone');
  PERFORM pg_temp.expect(pg_temp.try_save(v_home, 'Cleaner', 9000, a, pg_temp.split(c, '3000', d, '6000'), 'monthly', current_date + 5,
    v_split, (pg_temp.bill(v_split)).version), '22023 Shares must be positive, unique, belong to active members%', 'Keep a former member');
  PERFORM public.save_recurring_bill(v_home, 'Cleaner', 9000, a, pg_temp.split(c, '4500', a, '4500'), 'monthly', current_date + 5,
    v_split, (pg_temp.bill(v_split)).version);
  IF (pg_temp.bill(v_split)).paused IS NOT TRUE THEN RAISE EXCEPTION 'An edit resumed the bill'; END IF;
  PERFORM pg_temp.expect(pg_temp.try_command('pause', v_split, false), 'ok', 'Resume after the split is fixed');
  PERFORM pg_temp.expect(pg_temp.try_save(v_home, 'Gym', 4000, d, pg_temp.split(c, '4000'), 'weekly', current_date + 2,
    v_payer, (pg_temp.bill(v_payer)).version), '22023 Choose a payer who is a member of this commune', 'Keep a former payer');
  PERFORM public.save_recurring_bill(v_home, 'Gym', 4000, c, pg_temp.split(c, '4000'), 'weekly', current_date + 2,
    v_payer, (pg_temp.bill(v_payer)).version);
  PERFORM pg_temp.expect(pg_temp.try_command('pause', v_payer, false), 'ok', 'Resume after a new payer');

  -- An archived bill no longer blocks leaving.
  v_phone := public.save_recurring_bill(v_home, 'Phone', 2000, a, pg_temp.split(g, '2000'), 'monthly', current_date + 3,
    p_request_id => gen_random_uuid());
  PERFORM pg_temp.act_as(g);
  BEGIN
    PERFORM public.manage_commune_member(v_home, g, 'leave');
    RAISE EXCEPTION 'Left while an active bill includes them';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Pause or update recurring bills%' THEN RAISE; END IF;
  END;
  PERFORM pg_temp.act_as(a);
  PERFORM public.set_recurring_bill_archived(v_phone, true);
  PERFORM pg_temp.act_as(g);
  PERFORM public.manage_commune_member(v_home, g, 'leave');
END;
$$;

-- Due dates: never a period already recorded or skipped (or anything before
-- the latest one), and within a year back and two years ahead.
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  a text := '00000000-0000-4000-8000-0000000000a1';
  v_water uuid; v_version integer;
BEGIN
  PERFORM pg_temp.act_as(a);
  v_water := public.save_recurring_bill(v_home, 'Water', 3000, a, pg_temp.split(a, '3000'), 'weekly', current_date - 14,
    p_request_id => gen_random_uuid());
  PERFORM public.record_recurring_period(v_water, current_date - 14);
  PERFORM public.skip_recurring_period(v_water, current_date - 7, 'Away that week');
  v_version := (pg_temp.bill(v_water)).version;
  PERFORM pg_temp.expect(pg_temp.try_save(v_home, 'Water', 3000, a, pg_temp.split(a, '3000'), 'weekly', current_date - 7, v_water, v_version),
    'P0001 The % period was already skipped. Choose a next due date after it.', 'Due date on a skipped period');
  PERFORM pg_temp.expect(pg_temp.try_save(v_home, 'Water', 3000, a, pg_temp.split(a, '3000'), 'weekly', current_date - 14, v_water, v_version),
    'P0001 The % period was already skipped.%', 'Due date on a recorded period');
  PERFORM pg_temp.expect(pg_temp.try_save(v_home, 'Water', 3000, a, pg_temp.split(a, '3000'), 'weekly', current_date - 10, v_water, v_version),
    'P0001 The % period was already skipped.%', 'Due date before the latest period');
  IF (pg_temp.bill(v_water)).next_due_on <> current_date OR (pg_temp.bill(v_water)).version <> v_version THEN
    RAISE EXCEPTION 'A refused due date changed the bill';
  END IF;
  PERFORM public.save_recurring_bill(v_home, 'Water', 3000, a, pg_temp.split(a, '3000'), 'weekly', current_date - 6, v_water, v_version);
  IF (pg_temp.bill(v_water)).anchor_day <> extract(day FROM current_date - 6) THEN RAISE EXCEPTION 'The new date did not set the day'; END IF;

  PERFORM pg_temp.expect(pg_temp.try_save(v_home, 'Old', 1000, a, pg_temp.split(a, '1000'), 'monthly', (current_date - interval '1 year')::date - 1),
    '22023 Choose a next due date between % and %', 'More than a year back');
  PERFORM pg_temp.expect(pg_temp.try_save(v_home, 'Far', 1000, a, pg_temp.split(a, '1000'), 'monthly', (current_date + interval '2 years')::date + 1),
    '22023 Choose a next due date between % and %', 'More than two years ahead');
  PERFORM pg_temp.expect(pg_temp.try_save(v_home, 'Old', 1000, a, pg_temp.split(a, '1000'), 'monthly', (current_date - interval '1 year')::date),
    'ok', 'A year back');
  PERFORM pg_temp.expect(pg_temp.try_save(v_home, 'Far', 1000, a, pg_temp.split(a, '1000'), 'monthly', (current_date + interval '2 years')::date),
    'ok', 'Two years ahead');
  -- A new bill may start paused.
  IF NOT (pg_temp.bill(public.save_recurring_bill(v_home, 'Later', 1000, a, pg_temp.split(a, '1000'), 'monthly', current_date,
      p_request_id => gen_random_uuid(), p_paused => true))).paused THEN
    RAISE EXCEPTION 'A new bill did not start paused';
  END IF;
  PERFORM set_config('test.water', v_water::text, true);
END;
$$;

-- Bills left with an old date (a long pause, or the command before 0026,
-- which could put a due date back). Set up as the table owner.
RESET ROLE;
DO $$
DECLARE v_garden uuid;
BEGIN
  PERFORM pg_temp.act_as('00000000-0000-4000-8000-0000000000a1');
  UPDATE public.recurring_bills SET next_due_on = current_date - 800, paused = true WHERE id = current_setting('test.water')::uuid;
  v_garden := public.save_recurring_bill(current_setting('test.home')::uuid, 'Garden', 2000, '00000000-0000-4000-8000-0000000000a1',
    pg_temp.split('00000000-0000-4000-8000-0000000000a1', '2000'), 'monthly', current_date, p_request_id => gen_random_uuid(), p_paused => true);
  UPDATE public.recurring_bills SET next_due_on = current_date - 800 WHERE id = v_garden;
  PERFORM set_config('test.garden', v_garden::text, true);
END;
$$;
SET ROLE authenticated;
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  a text := '00000000-0000-4000-8000-0000000000a1';
  v_water uuid := current_setting('test.water')::uuid;
  v_garden uuid := current_setting('test.garden')::uuid;
BEGIN
  PERFORM pg_temp.act_as(a);
  -- An unchanged old date is not range checked, so the bill can still be edited...
  PERFORM pg_temp.expect(pg_temp.try_save(v_home, 'Garden help', 2000, a, pg_temp.split(a, '2000'), 'monthly', current_date - 800, v_garden,
    (pg_temp.bill(v_garden)).version), 'ok', 'Rename keeping an old date');
  PERFORM pg_temp.expect(pg_temp.try_save(v_home, 'Garden help', 2000, a, pg_temp.split(a, '2000'), 'monthly', current_date - 799, v_garden,
    (pg_temp.bill(v_garden)).version), '22023 Choose a next due date between%', 'Move to another old date');
  -- ...but a date behind the bill's own periods must still move on.
  PERFORM pg_temp.expect(pg_temp.try_save(v_home, 'Water rates', 3000, a, pg_temp.split(a, '3000'), 'weekly', current_date - 800, v_water,
    (pg_temp.bill(v_water)).version), 'P0001 The % period was already skipped.%', 'Keep a date before recorded periods');
END;
$$;

-- Skips reach at most one period ahead and at most 12 a day per bill.
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  a text := '00000000-0000-4000-8000-0000000000a1';
  v_weekly uuid; v_monthly uuid; v_backlog uuid; v_due date; i integer;
BEGIN
  PERFORM pg_temp.act_as(a);
  v_weekly := public.save_recurring_bill(v_home, 'Milk', 1000, a, pg_temp.split(a, '1000'), 'weekly', current_date + 3,
    p_request_id => gen_random_uuid());
  PERFORM pg_temp.expect(pg_temp.try_command('skip', v_weekly, NULL, current_date + 3, 'Away this week'), 'ok', 'Skip the next week');
  PERFORM pg_temp.expect(pg_temp.try_command('skip', v_weekly, NULL, current_date + 10, 'Away next week too'),
    'P0001 It is too early to skip the % period. You can skip it from %.', 'Skip two weeks ahead');
  v_monthly := public.save_recurring_bill(v_home, 'Rent', 50000, a, pg_temp.split(a, '50000'), 'monthly', current_date + 20,
    p_request_id => gen_random_uuid());
  PERFORM pg_temp.expect(pg_temp.try_command('skip', v_monthly, NULL, current_date + 20, 'Rent holiday'), 'ok', 'Skip the next month');
  v_due := (pg_temp.bill(v_monthly)).next_due_on;
  PERFORM pg_temp.expect(pg_temp.try_command('skip', v_monthly, NULL, v_due, 'Another holiday'), 'P0001 It is too early%', 'Skip two months ahead');

  v_backlog := public.save_recurring_bill(v_home, 'Paper', 500, a, pg_temp.split(a, '500'), 'weekly', current_date - 140,
    p_request_id => gen_random_uuid());
  FOR i IN 0..11 LOOP
    PERFORM public.skip_recurring_period(v_backlog, current_date - 140 + 7 * i, 'Catching up');
  END LOOP;
  PERFORM pg_temp.expect(pg_temp.try_command('skip', v_backlog, NULL, current_date - 56, 'One more'),
    'P0001 This bill has had 12 periods skipped in the last day.%', 'Thirteenth skip in a day');
  -- Recording is not limited, and editing the due date still moves it on.
  PERFORM pg_temp.expect(pg_temp.try_command('record', v_backlog, NULL, current_date - 56), 'ok', 'Record after the skip limit');
  PERFORM public.save_recurring_bill(v_home, 'Paper', 500, a, pg_temp.split(a, '500'), 'weekly', current_date, v_backlog,
    (pg_temp.bill(v_backlog)).version);
  IF (SELECT count(*) FROM public.recurring_bill_occurrences WHERE bill_id = v_backlog) <> 13 THEN RAISE EXCEPTION 'Wrong period count'; END IF;
END;
$$;

-- The index, the grants and the helpers.
RESET ROLE;
DO $$
DECLARE v_signature text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'recurring_bill_occurrences'
      AND indexdef LIKE '%(expense_id) WHERE (expense_id IS NOT NULL)') THEN
    RAISE EXCEPTION 'The per-expense period lookup has no index';
  END IF;
  FOREACH v_signature IN ARRAY ARRAY['public.save_recurring_bill(uuid,text,bigint,text,jsonb,text,date,uuid,integer,uuid,boolean)',
    'public.set_recurring_bill_paused(uuid,boolean)', 'public.set_recurring_bill_archived(uuid,boolean)',
    'public.record_recurring_period(uuid,date,bigint)', 'public.skip_recurring_period(uuid,date,text)'] LOOP
    IF has_function_privilege('anonymous', v_signature, 'EXECUTE') OR has_function_privilege('public', v_signature, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'Unexpected execution grant on %', v_signature;
    END IF;
  END LOOP;
  FOREACH v_signature IN ARRAY ARRAY['commune_private.bump_recurring_bill_version()',
    'commune_private.recurring_departed_names(uuid,text,jsonb)', 'commune_private.recurring_bill_result(uuid,boolean)'] LOOP
    IF has_function_privilege('authenticated', v_signature, 'EXECUTE') OR has_function_privilege('anonymous', v_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'Private helper % is callable by a client role', v_signature;
    END IF;
  END LOOP;
  IF to_regprocedure('public.save_recurring_bill(uuid,text,bigint,text,jsonb,text,date,boolean,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'The old save command, which could rewrite a bill from a stale screen, still exists';
  END IF;
  IF has_table_privilege('authenticated', 'public.recurring_bills', 'UPDATE') THEN
    RAISE EXCEPTION 'Clients can write recurring bills directly';
  END IF;
  -- The leave check passes over paused bills; an archived bill can never be unpaused.
  IF NOT EXISTS (SELECT 1 FROM public.recurring_bills WHERE archived_at IS NOT NULL) THEN RAISE EXCEPTION 'No archived bill to check'; END IF;
  BEGIN
    UPDATE public.recurring_bills SET paused = false WHERE archived_at IS NOT NULL;
    RAISE EXCEPTION 'An archived bill was unpaused';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END;
$$;

SELECT 'recurring bill commands ok';
ROLLBACK;
