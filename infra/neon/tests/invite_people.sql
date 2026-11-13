-- Who lives there, for the joining page (0047). Run only in an empty
-- disposable local DB built from infra/neon/tests/local_auth_stub.sql and
-- every migration. Everything is rolled back.
BEGIN;

DO $$
BEGIN
  IF NOT has_function_privilege('authenticated', 'public.invite_people(text)', 'EXECUTE')
    OR has_function_privilege('anonymous', 'public.invite_people(text)', 'EXECUTE')
    OR has_function_privilege('public', 'public.invite_people(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected grants on invite_people';
  END IF;
END;
$$;

DO $$
DECLARE v_home uuid; v_token text; v_other text; v_people jsonb;
BEGIN
  INSERT INTO neon_auth."user" (id, name, email, "emailVerified") VALUES
    ('ppl-maya', 'Maya Chen', 'maya@people.test', true),
    ('ppl-ama', 'Ama Owusu', 'ama@people.test', true),
    ('ppl-priya', 'Priya Nair', 'priya@people.test', true),
    ('ppl-sam', 'Sam', 'sam@people.test', true),
    ('ppl-dan', 'Dan', 'dan@people.test', false);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'ppl-maya', 'role', 'authenticated')::text, true);
  v_home := public.create_commune('14 Park Street', 'household', 'GBP');
  v_token := public.create_commune_invite(v_home, 'ama@people.test', 'member');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'ppl-ama', 'role', 'authenticated')::text, true);
  PERFORM public.accept_commune_invite(v_token);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'ppl-maya', 'role', 'authenticated')::text, true);
  v_token := public.create_commune_invite(v_home, 'Priya@People.test', 'member');
  v_other := public.create_commune_invite(v_home, 'dan@people.test', 'member');

  -- The invited account sees the inviter and first names, inviter first.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'ppl-priya', 'role', 'authenticated')::text, true);
  v_people := public.invite_people(v_token);
  IF v_people IS DISTINCT FROM '{"inviter": "Maya", "members": ["Maya", "Ama"]}'::jsonb THEN
    RAISE EXCEPTION 'The invited account saw %', v_people;
  END IF;
  -- Nothing else comes with it.
  IF v_people::text ~ '@|ppl-|Chen|Owusu' THEN
    RAISE EXCEPTION 'More than first names came back: %', v_people;
  END IF;

  -- Another account with the link sees nothing, and so does a bad token.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'ppl-sam', 'role', 'authenticated')::text, true);
  IF public.invite_people(v_token) IS NOT NULL THEN
    RAISE EXCEPTION 'Another account saw who lives there';
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'ppl-priya', 'role', 'authenticated')::text, true);
  IF num_nonnulls(public.invite_people(repeat('0', 64)), public.invite_people('not-a-token'),
      public.invite_people(NULL), public.invite_people(upper(v_token))) > 0 THEN
    RAISE EXCEPTION 'People came back without the invitation''s token';
  END IF;
  -- An unverified account with the invited address sees nothing.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'ppl-dan', 'role', 'authenticated')::text, true);
  IF public.invite_people(v_other) IS NOT NULL THEN
    RAISE EXCEPTION 'An unverified account saw who lives there';
  END IF;
  -- Without a signed-in identity the request is refused outright.
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    PERFORM public.invite_people(v_token);
    RAISE EXCEPTION 'Someone signed out was not refused';
  EXCEPTION WHEN invalid_authorization_specification OR raise_exception THEN
    IF SQLERRM = 'Someone signed out was not refused' THEN RAISE; END IF;
  END;

  -- Once used, the invitation shows nothing more.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'ppl-priya', 'role', 'authenticated')::text, true);
  PERFORM public.accept_commune_invite(v_token);
  IF public.invite_people(v_token) IS NOT NULL THEN
    RAISE EXCEPTION 'A used invitation still showed who lives there';
  END IF;
END;
$$;

ROLLBACK;
