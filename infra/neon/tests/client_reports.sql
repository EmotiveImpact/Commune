-- Error reports and speed figures from the web app (0038). Run only in an
-- empty disposable local DB built from infra/neon/tests/local_auth_stub.sql
-- and every migration. Everything is rolled back.
BEGIN;

DO $$
DECLARE v_bad text[]; v_failed boolean; v_row commune_private.client_reports%ROWTYPE; v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'report-alice', 'role', 'authenticated')::text, true);

  -- An error keeps its message and stack, with anything like a record id, an
  -- email address or a link's query taken out.
  IF NOT public.report_client_event('error', 'a1b2c3d4e5f6', '/expenses/:id', 'chrome',
      'TypeError: no expense 0F8FE1A5-1234-4abc-9def-0123456789ab for emma.j+home@gmail.co.uk',
      E'    at render (https://commune.test/assets/index-abc.js?v=3#top:1:2)\n    at commit (https://commune.test/assets/index-abc.js:1:9)') THEN
    RAISE EXCEPTION 'An error report was not kept';
  END IF;
  SELECT * INTO v_row FROM commune_private.client_reports WHERE user_id = 'report-alice';
  IF v_row.kind <> 'error' OR v_row.release <> 'a1b2c3d4e5f6' OR v_row.route <> '/expenses/:id' OR v_row.browser <> 'chrome'
    OR v_row.message <> 'TypeError: no expense :id for [email]'
    OR v_row.stack <> E'    at render (https://commune.test/assets/index-abc.js)\n    at commit (https://commune.test/assets/index-abc.js:1:9)'
    OR num_nonnulls(v_row.lcp_ms, v_row.inp_ms, v_row.cls) > 0 THEN
    RAISE EXCEPTION 'The error report was not kept as expected: %', row_to_json(v_row);
  END IF;
  -- Firefox and Safari write a frame as name@address, which is no email.
  PERFORM public.report_client_event('error', 'local', '/', 'firefox', 'Error: failed', 'render@https://commune.test/assets/index.js:1:2');
  IF (SELECT stack FROM commune_private.client_reports WHERE browser = 'firefox') <> 'render@https://commune.test/assets/index.js:1:2' THEN
    RAISE EXCEPTION 'A stack frame was taken for an email address';
  END IF;
  -- Long text is cut short.
  PERFORM public.report_client_event('error', 'local', '/settings', 'edge', repeat('m', 5000), repeat('s', 50000));
  IF (SELECT length(message) || '/' || length(stack) FROM commune_private.client_reports WHERE browser = 'edge') <> '300/2000' THEN
    RAISE EXCEPTION 'Report text was not cut short';
  END IF;

  -- Speed figures: any of the three, with no message.
  IF NOT public.report_client_event('speed', 'local', '/', 'safari', p_lcp_ms => 2300, p_cls => 0.12345) THEN
    RAISE EXCEPTION 'Speed figures were not kept';
  END IF;
  SELECT * INTO v_row FROM commune_private.client_reports WHERE kind = 'speed';
  IF v_row.lcp_ms <> 2300 OR v_row.inp_ms IS NOT NULL OR v_row.cls <> 0.1235 OR v_row.route <> '/' OR num_nonnulls(v_row.message, v_row.stack) > 0 THEN
    RAISE EXCEPTION 'Speed figures were not kept as expected: %', row_to_json(v_row);
  END IF;

  -- Anything else is refused and nothing is kept.
  SELECT count(*) INTO v_count FROM commune_private.client_reports;
  FOREACH v_bad SLICE 1 IN ARRAY ARRAY[
    -- kind, release, route, browser, message, lcp
    ['crash', 'local', '/', 'chrome', 'Error', NULL],
    ['error', '', '/', 'chrome', 'Error', NULL],
    ['error', 'local; drop', '/', 'chrome', 'Error', NULL],
    ['error', 'local', '/expenses/0f8fe1a5-1234-4abc-9def-0123456789ab', 'chrome', 'Error', NULL],
    ['error', 'local', '/expenses/expense1', 'chrome', 'Error', NULL],
    ['error', 'local', '/expenses?commune=home', 'chrome', 'Error', NULL],
    ['error', 'local', '/expenses#top', 'chrome', 'Error', NULL],
    ['error', 'local', 'https://evil.example/', 'chrome', 'Error', NULL],
    ['error', 'local', '//evil.example', 'chrome', 'Error', NULL],
    ['error', 'local', '/expenses/', 'chrome', 'Error', NULL],
    ['error', 'local', '/Expenses', 'chrome', 'Error', NULL],
    ['error', 'local', 'expenses', 'chrome', 'Error', NULL],
    ['error', 'local', '/' || repeat('a', 80), 'chrome', 'Error', NULL],
    ['error', 'local', '/', 'netscape', 'Error', NULL],
    ['error', 'local', '/', 'chrome', NULL, NULL],
    ['error', 'local', '/', 'chrome', '   ', NULL],
    ['error', 'local', '/', 'chrome', 'Error', '1200'],
    ['speed', 'local', '/', 'chrome', NULL, NULL],
    ['speed', 'local', '/', 'chrome', 'Error', '1200'],
    ['speed', 'local', '/', 'chrome', NULL, '-1'],
    ['speed', 'local', '/', 'chrome', NULL, '600001']
  ] LOOP
    v_failed := false;
    BEGIN
      PERFORM public.report_client_event(v_bad[1], v_bad[2], v_bad[3], v_bad[4], v_bad[5], NULL, v_bad[6]::integer);
    EXCEPTION WHEN SQLSTATE '22023' THEN v_failed := true;
    END;
    IF NOT v_failed THEN RAISE EXCEPTION 'A report was accepted: %', v_bad; END IF;
  END LOOP;
  v_failed := false;
  BEGIN
    PERFORM public.report_client_event('speed', 'local', '/', 'chrome', p_cls => 1000.5);
  EXCEPTION WHEN SQLSTATE '22023' THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'A layout shift score out of range was accepted'; END IF;
  IF (SELECT count(*) FROM commune_private.client_reports) <> v_count THEN
    RAISE EXCEPTION 'A refused report was kept';
  END IF;

  -- Only a signed-in account can report.
  PERFORM set_config('request.jwt.claims', '', true);
  v_failed := false;
  BEGIN
    PERFORM public.report_client_event('error', 'local', '/', 'chrome', 'Error');
  EXCEPTION WHEN SQLSTATE '28000' THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'A report was taken without a sign-in'; END IF;
END;
$$;

-- 20 reports an hour and 100 a day for each account; more are dropped, not
-- refused, and other accounts are unaffected.
DO $$
DECLARE v_kept integer := 0; v_index integer;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'report-bob', 'role', 'authenticated')::text, true);
  FOR v_index IN 1..25 LOOP
    IF public.report_client_event('error', 'local', '/notes/:id/edit', 'samsung', 'Error ' || v_index) THEN v_kept := v_kept + 1; END IF;
  END LOOP;
  IF v_kept <> 20 OR (SELECT count(*) FROM commune_private.client_reports WHERE user_id = 'report-bob') <> 20 THEN
    RAISE EXCEPTION 'The hourly limit kept % reports', v_kept;
  END IF;
  -- An hour on, there is room again until the day's 100.
  UPDATE commune_private.client_reports SET created_at = now() - interval '2 hours' WHERE user_id = 'report-bob';
  INSERT INTO commune_private.client_reports (user_id, kind, release, route, browser, message, created_at)
    SELECT 'report-bob', 'error', 'local', '/', 'other', 'Earlier', now() - interval '3 hours' FROM generate_series(1, 79);
  IF NOT public.report_client_event('speed', 'local', '/', 'other', p_inp_ms => 180) THEN
    RAISE EXCEPTION 'The 100th report of the day was dropped';
  END IF;
  IF public.report_client_event('speed', 'local', '/', 'other', p_inp_ms => 180) THEN
    RAISE EXCEPTION 'The daily limit let a 101st report through';
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'report-cara', 'role', 'authenticated')::text, true);
  IF NOT public.report_client_event('speed', 'local', '/', 'other', p_inp_ms => 180) THEN
    RAISE EXCEPTION 'One account''s limit stopped another''s reports';
  END IF;
END;
$$;

-- No client can read or write the reports, or call the private helpers; a
-- signed-in person can only send one.
DO $$
BEGIN
  IF has_table_privilege('authenticated', 'commune_private.client_reports', 'SELECT')
    OR has_table_privilege('authenticated', 'commune_private.client_reports', 'INSERT')
    OR has_table_privilege('anonymous', 'commune_private.client_reports', 'SELECT')
    OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'commune_private.client_reports'::regclass)
    OR has_function_privilege('authenticated', 'commune_private.report_text(text,integer)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.report_client_event(text,text,text,text,text,text,integer,integer,numeric)', 'EXECUTE')
    OR has_function_privilege('anonymous', 'public.report_client_event(text,text,text,text,text,text,integer,integer,numeric)', 'EXECUTE')
    OR has_function_privilege('public', 'public.report_client_event(text,text,text,text,text,text,integer,integer,numeric)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected grants on client reports';
  END IF;
END;
$$;
SET ROLE authenticated;
DO $$
DECLARE v_failed boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'report-dee', 'role', 'authenticated')::text, true);
  IF NOT public.report_client_event('error', 'local', '/', 'chrome', 'Error: from a client') THEN
    RAISE EXCEPTION 'A signed-in person could not send a report';
  END IF;
  BEGIN
    PERFORM count(*) FROM commune_private.client_reports;
  EXCEPTION WHEN insufficient_privilege THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'A signed-in person could read the reports'; END IF;
END;
$$;
RESET ROLE;

-- The worker's scheduled run deletes reports after 30 days.
DO $$
DECLARE v_pruned jsonb;
BEGIN
  DELETE FROM commune_private.client_reports;
  INSERT INTO commune_private.client_reports (user_id, kind, release, route, browser, message, created_at) VALUES
    ('report-old', 'error', 'local', '/', 'other', 'Old', now() - interval '31 days'),
    ('report-new', 'error', 'local', '/', 'other', 'Recent', now() - interval '29 days');
  v_pruned := commune_private.prune_delivery_records();
  IF (v_pruned->>'clientReports')::integer <> 1
    OR (SELECT array_agg(user_id) FROM commune_private.client_reports) <> ARRAY['report-new'] THEN
    RAISE EXCEPTION 'Old reports were not deleted as expected: %', v_pruned;
  END IF;
  IF (commune_private.prune_delivery_records()->>'clientReports')::integer <> 0 THEN
    RAISE EXCEPTION 'A second run should find no reports to delete';
  END IF;
END;
$$;

ROLLBACK;
