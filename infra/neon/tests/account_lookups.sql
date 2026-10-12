-- Account lookups (0030). Run only in an empty disposable local DB built from
-- infra/neon/tests/local_auth_stub.sql and every migration. The stub keys
-- accounts by text; part way through, this test turns its ids into uuids, as
-- Managed Neon Auth keys them. Everything is rolled back.
BEGIN;
-- Any lookup that can use the account key now does. One that still reads
-- every account shows up as a sequential scan below.
SET LOCAL enable_seqscan = off;

DO $$
DECLARE
  v_alice constant text := '0a000000-0000-4000-8000-000000000001';
  v_bea constant text := '0b000000-0000-4000-8000-000000000002';
  v_cal constant text := '0c000000-0000-4000-8000-000000000003';
  v_gone constant text := '0d000000-0000-4000-8000-000000000004';
  v_home uuid; v_task uuid; v_tasks jsonb;
BEGIN
  INSERT INTO neon_auth."user" (id, name, email, "emailVerified")
    SELECT gen_random_uuid()::text, 'Someone ' || g, 'someone' || g || '@lookup.test', true FROM generate_series(1, 2000) g;
  INSERT INTO neon_auth."user" (id, name, email, "emailVerified") VALUES
    (v_alice, 'Alice', 'alice@lookup.test', true), (v_bea, 'Bea', 'bea@lookup.test', true),
    (v_cal, 'Cal', 'cal@lookup.test', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_alice, 'role', 'authenticated')::text, true);
  v_home := public.create_commune('Lookup home', 'household', 'GBP');
  -- The last member's account no longer exists.
  INSERT INTO public.commune_members (commune_id, user_id, role)
    VALUES (v_home, v_bea, 'member'), (v_home, v_cal, 'member'), (v_home, v_gone, 'member');
  INSERT INTO public.commune_operations (commune_id, kind, category, title, date, repeat, assignee_id, rotation_ids, created_by)
    VALUES (v_home, 'task', 'chore', 'Bins', current_date, 'weekly', v_bea, jsonb_build_array(v_alice, v_bea, v_cal), v_alice)
    RETURNING id INTO v_task;
  INSERT INTO public.commune_operations (commune_id, kind, category, title, date, assignee_id, created_by)
    VALUES (v_home, 'task', 'chore', 'Plants', current_date, v_gone, v_alice);
  -- Alice marks Bea's turn done for her, it passes to Cal, then Cal leaves.
  PERFORM public.record_operation_occurrence(v_task, 'completed', current_date, current_date, gen_random_uuid(), NULL, 'assignee');
  PERFORM public.manage_commune_member(v_home, v_cal, 'remove');
  PERFORM set_config('test.home', v_home::text, true);

  -- Text ids, as the local adapter and older stub tests use.
  v_tasks := public.commune_snapshot(v_home)->'operations';
  IF (SELECT t->>'assignee' FROM jsonb_array_elements(v_tasks) t WHERE t->>'title' = 'Bins') <> 'Alice'
     OR (SELECT t->'history'->0->>'nextAssignee' FROM jsonb_array_elements(v_tasks) t WHERE t->>'title' = 'Bins') <> 'Cal' THEN
    RAISE EXCEPTION 'Task names were wrong with text ids: %', v_tasks;
  END IF;
END;
$$;

ALTER TABLE neon_auth."user" ALTER COLUMN id TYPE uuid USING id::uuid;

DO $$
DECLARE
  v_alice constant text := '0a000000-0000-4000-8000-000000000001';
  v_home uuid := current_setting('test.home')::uuid;
  v_snapshot jsonb; v_bins jsonb; v_plants jsonb; v_members jsonb;
  v_seq bigint; v_idx bigint; v_stray text;
BEGIN
  SELECT seq_scan, idx_scan INTO v_seq, v_idx FROM pg_stat_xact_user_tables WHERE relid = 'neon_auth."user"'::regclass;

  v_snapshot := public.commune_snapshot(v_home);
  v_members := v_snapshot->'members';
  SELECT t INTO v_bins FROM jsonb_array_elements(v_snapshot->'operations') t WHERE t->>'title' = 'Bins';
  SELECT t INTO v_plants FROM jsonb_array_elements(v_snapshot->'operations') t WHERE t->>'title' = 'Plants';
  IF (SELECT string_agg(m->>'name', ',' ORDER BY m->>'name') FROM jsonb_array_elements(v_members) m) <> 'Alice,Bea,Cal,Former member' THEN
    RAISE EXCEPTION 'Member names were wrong: %', v_members;
  END IF;
  -- Cal left: the task passed back to Alice, and its history still names Cal.
  IF v_bins->>'assignee' <> 'Alice' OR v_bins->'rotation' <> '["Alice", "Bea"]'::jsonb
     OR v_bins->'history'->0->>'nextAssignee' <> 'Cal' OR v_bins->'history'->0->>'assignee' <> 'Bea' THEN
    RAISE EXCEPTION 'Task names were wrong: %', v_bins;
  END IF;
  IF v_plants->>'assignee' <> 'Member' THEN
    RAISE EXCEPTION 'A person with no account was not shown as Member: %', v_plants;
  END IF;
  IF (public.search_commune_records('Bea', v_home, 8)->'items'->0->>'title') IS DISTINCT FROM 'Bea' THEN
    RAISE EXCEPTION 'Search did not find a member by name';
  END IF;
  IF (SELECT count(*) FROM public.member_profiles(v_home)) <> 3 THEN
    RAISE EXCEPTION 'Member profiles did not load';
  END IF;
  IF commune_private.member_by_name(v_home, 'Bea') <> '0b000000-0000-4000-8000-000000000002' THEN
    RAISE EXCEPTION 'A member was not found by name';
  END IF;
  PERFORM public.create_commune_invite(v_home, 'dee@lookup.test', 'member');
  IF (SELECT string_agg(i.invited_by_name, ',') FROM public.list_commune_invites(v_home) i) IS DISTINCT FROM 'Alice' THEN
    RAISE EXCEPTION 'An invitation did not name its sender';
  END IF;
  -- Cal left, and the other person never had an account.
  IF commune_private.recurring_departed_names(v_home, '0c000000-0000-4000-8000-000000000003',
      '[{"user_id":"0e000000-0000-4000-8000-000000000005"},{"user_id":"0b000000-0000-4000-8000-000000000002"}]'::jsonb)
      IS DISTINCT FROM ARRAY['Cal', 'A former member'] THEN
    RAISE EXCEPTION 'A recurring bill did not name the people who left';
  END IF;

  IF (SELECT seq_scan FROM pg_stat_xact_user_tables WHERE relid = 'neon_auth."user"'::regclass) <> v_seq THEN
    RAISE EXCEPTION 'A lookup read every account';
  END IF;
  IF (SELECT idx_scan FROM pg_stat_xact_user_tables WHERE relid = 'neon_auth."user"'::regclass) <= v_idx THEN
    RAISE EXCEPTION 'Lookups did not use the account key';
  END IF;

  -- An id that is not a uuid finds no one and never raises.
  IF commune_private.member_name('not-a-uuid') <> 'Member' OR commune_private.member_name(NULL) <> 'Member' THEN
    RAISE EXCEPTION 'A malformed id did not fall back to Member';
  END IF;
  IF (SELECT count(*) FROM commune_private.accounts(ARRAY['not-a-uuid', NULL, upper(v_alice), v_alice])) <> 1 THEN
    RAISE EXCEPTION 'Only the exact id should match';
  END IF;

  -- Every other function looks accounts up through commune_private.accounts.
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO v_stray
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'commune_private') AND p.prosrc LIKE '%neon_auth%'
      AND p.oid <> 'commune_private.accounts(text[])'::regprocedure;
  IF v_stray IS NOT NULL THEN
    RAISE EXCEPTION 'These functions still read neon_auth directly: %', v_stray;
  END IF;
END;
$$;

-- Only the database owner can call the lookup functions.
SET ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM * FROM commune_private.accounts(ARRAY['0a000000-0000-4000-8000-000000000001']);
    RAISE EXCEPTION 'A signed-in person could list accounts';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM commune_private.member_names(current_setting('test.home')::uuid);
    RAISE EXCEPTION 'A signed-in person could list member names';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;

ROLLBACK;
