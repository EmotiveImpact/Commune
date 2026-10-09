-- The quick finder's dates (0040). Run only in an empty disposable local DB
-- built from infra/neon/tests/local_auth_stub.sql and every migration.
-- Each search result carries its date on its own (date, YYYY-MM-DD or null)
-- and its words without the date (label), so the app writes the date as every
-- other screen does; meta keeps the old text for app versions released
-- before 0040. Everything is rolled back.
BEGIN;

CREATE FUNCTION pg_temp.result(p_query text, p_commune uuid, p_title text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT i FROM jsonb_array_elements(public.search_commune_records(p_query, p_commune, 25)->'items') i WHERE i->>'title' = p_title;
$$;
CREATE FUNCTION pg_temp.expect(p_item jsonb, p_label text, p_date text, p_meta text, p_case text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_item IS NULL OR NOT (p_item ? 'label' AND p_item ? 'date' AND p_item ? 'meta')
     OR p_item->>'label' IS DISTINCT FROM p_label OR p_item->>'date' IS DISTINCT FROM p_date
     OR p_item->>'meta' IS DISTINCT FROM p_meta THEN
    RAISE EXCEPTION '%: expected label %, date % and meta %, got %', p_case, p_label, coalesce(p_date, 'null'), p_meta, p_item;
  END IF;
END;
$$;

DO $$
DECLARE
  v_alice constant text := '0a000000-0000-4000-8000-0000000000d1';
  v_home uuid;
  v_shares jsonb := jsonb_build_array(jsonb_build_object('userId', '0a000000-0000-4000-8000-0000000000d1', 'amountMinor', 9000));
  v_undated jsonb;
BEGIN
  INSERT INTO neon_auth."user" (id, name, email, "emailVerified") VALUES (v_alice, 'Alice Zebra', 'alice@search-dates.test', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_alice, 'role', 'authenticated')::text, true);
  v_home := public.create_commune('Zebra house', 'household', 'GBP');
  INSERT INTO public.recurring_bills (commune_id, title, amount_minor, paid_by_user_id, shares, frequency, next_due_on, anchor_day, created_by, paused)
    VALUES (v_home, 'Zebra electricity', 9000, v_alice, v_shares, 'monthly', '2026-11-04', 4, v_alice, false),
           (v_home, 'Zebra water', 9000, v_alice, v_shares, 'monthly', '2026-12-01', 1, v_alice, true);
  INSERT INTO public.commune_operations (commune_id, kind, category, title, date, created_by)
    VALUES (v_home, 'task', 'chore', 'Zebra bins', '2026-10-20', v_alice),
           (v_home, 'event', 'visit', 'Zebra visit', '2027-01-02', v_alice);
  PERFORM public.create_expense(v_home, 'Zebra shopping', 3000,
    jsonb_build_array(jsonb_build_object('user_id', v_alice, 'amount_minor', 3000)), '2026-11-30');
  PERFORM public.create_fund(v_home, 'Zebra fund', 50000);

  -- A recurring bill that is due, and one that is paused.
  PERFORM pg_temp.expect(pg_temp.result('Zebra', v_home, 'Zebra electricity'), 'Due', '2026-11-04', 'Due 2026-11-04', 'A due bill');
  PERFORM pg_temp.expect(pg_temp.result('Zebra', v_home, 'Zebra water'), 'Paused', NULL, 'Paused', 'A paused bill');
  -- Tasks and events, this year and next.
  PERFORM pg_temp.expect(pg_temp.result('Zebra', v_home, 'Zebra bins'), 'Task', '2026-10-20', 'Task · 2026-10-20', 'A task');
  PERFORM pg_temp.expect(pg_temp.result('Zebra', v_home, 'Zebra visit'), 'Event', '2027-01-02', 'Event · 2027-01-02', 'An event');

  -- Every other kind has no date, and its label is its old text.
  SELECT jsonb_agg(i) INTO v_undated FROM jsonb_array_elements(public.search_commune_records('Zebra', NULL, 25)->'items') i
    WHERE i->>'kind' NOT IN ('recurring', 'operation');
  IF (SELECT array_agg(DISTINCT i->>'kind' ORDER BY i->>'kind') FROM jsonb_array_elements(v_undated) i) <> ARRAY['commune', 'expense', 'fund', 'member']
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_undated) i
       WHERE NOT (i ? 'date') OR jsonb_typeof(i->'date') <> 'null' OR i->>'label' IS DISTINCT FROM i->>'meta') THEN
    RAISE EXCEPTION 'Results without a date were wrong: %', v_undated;
  END IF;
END;
$$;

-- The date is written the same way whatever the session's date style.
SET LOCAL DateStyle = 'SQL, DMY';
DO $$
DECLARE
  v_bill jsonb := (SELECT i FROM jsonb_array_elements(public.search_commune_records('Zebra electricity', NULL, 8)->'items') i
    WHERE i->>'kind' = 'recurring');
BEGIN
  IF v_bill->>'date' IS DISTINCT FROM '2026-11-04' OR v_bill->>'label' IS DISTINCT FROM 'Due' THEN
    RAISE EXCEPTION 'The date depended on the date style: %', v_bill;
  END IF;
END;
$$;

ROLLBACK;
