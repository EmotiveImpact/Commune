-- Run after 0011 on an isolated Neon branch in a NEW direct connection.
-- Do not warm up auth.*: membership must work on the very first request.
-- No test data is written. The fixture comes from an existing membership.
BEGIN;
DO $$
DECLARE m record;
BEGIN
  SELECT commune_id, user_id INTO STRICT m FROM public.commune_members LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', m.user_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('commune.test_id', m.commune_id::text, true);
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE member_count integer;
BEGIN
  IF public.is_commune_member(current_setting('commune.test_id')::uuid) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Cold connection rejected a real member';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.communes WHERE id = current_setting('commune.test_id')::uuid) THEN
    RAISE EXCEPTION 'Cold connection returned a false empty commune list';
  END IF;
  SELECT count(*) INTO member_count FROM public.member_profiles(current_setting('commune.test_id')::uuid);
  IF member_count < 1 THEN RAISE EXCEPTION 'Member profiles were unavailable'; END IF;
  PERFORM * FROM public.list_reminder_targets(current_setting('commune.test_id')::uuid);

  -- A different, nonmember identity still sees nothing and cannot call RPCs.
  PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
  IF public.is_commune_member(current_setting('commune.test_id')::uuid) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Nonmember gained membership';
  END IF;
  IF EXISTS (SELECT 1 FROM public.communes) THEN RAISE EXCEPTION 'Nonmember gained row access'; END IF;
  BEGIN
    PERFORM * FROM public.member_profiles(current_setting('commune.test_id')::uuid);
    RAISE EXCEPTION 'Nonmember gained profile access';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM * FROM public.list_reminder_targets(current_setting('commune.test_id')::uuid);
    RAISE EXCEPTION 'Nonmember gained reminder access';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Missing identity must fail, not return an apparently successful [].
  PERFORM set_config('request.jwt.claims', '{}', true);
  BEGIN
    PERFORM commune_private.data_api_user_id();
    RAISE EXCEPTION 'Missing identity was accepted';
  EXCEPTION WHEN invalid_authorization_specification THEN NULL;
  END;
  IF has_function_privilege('anonymous', 'commune_private.data_api_user_id()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous role can execute private identity reader';
  END IF;
  IF has_table_privilege('authenticated', 'public.expenses', 'INSERT') THEN
    RAISE EXCEPTION 'Direct money-table writes were enabled';
  END IF;
END $$;
ROLLBACK;
