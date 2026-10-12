-- The address an invitation was sent to, masked (0038). Run only in an empty
-- disposable local DB built from infra/neon/tests/local_auth_stub.sql and
-- every migration. Everything is rolled back.
BEGIN;

DO $$
DECLARE v_case text[];
BEGIN
  FOREACH v_case SLICE 1 IN ARRAY ARRAY[
    ['emma@gmail.com', 'e•••@g•••.com'],
    ['x@outlook.co.uk', 'x•••@o•••.co.uk'],
    ['a@mail.example.com', 'a•••@m•••.com'],
    ['a@students.ox.ac.uk', 'a•••@s•••.ac.uk'],
    ['a@news.bbc.com', 'a•••@n•••.com'],
    ['sam@x.com.au', 's•••@x•••.com.au'],
    ['é@exämple.de', 'é•••@e•••.de']
  ] LOOP
    IF commune_private.masked_address(v_case[1]) IS DISTINCT FROM v_case[2] THEN
      RAISE EXCEPTION '% was masked as %, not %', v_case[1], commune_private.masked_address(v_case[1]), v_case[2];
    END IF;
  END LOOP;
  IF num_nonnulls(commune_private.masked_address('no-domain'), commune_private.masked_address('a@localhost'),
      commune_private.masked_address('@example.com'), commune_private.masked_address('a@.com'),
      commune_private.masked_address('a@example.'), commune_private.masked_address(NULL)) > 0 THEN
    RAISE EXCEPTION 'Something that is not an address was masked';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.invite_address_hint(text)', 'EXECUTE')
    OR has_function_privilege('anonymous', 'public.invite_address_hint(text)', 'EXECUTE')
    OR has_function_privilege('public', 'public.invite_address_hint(text)', 'EXECUTE')
    OR has_function_privilege('authenticated', 'commune_private.masked_address(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected grants on the address hint';
  END IF;
END;
$$;

DO $$
DECLARE v_home uuid; v_token text; v_other text; v_failed boolean := false;
BEGIN
  INSERT INTO neon_auth."user" (id, name, email, "emailVerified") VALUES
    ('hint-alice', 'Alice', 'alice@hint.test', true),
    ('hint-bob', 'Bob', 'Bob.Smith@Example.co.uk', true),
    ('hint-cara', 'Cara', 'cara@hint.test', true),
    ('hint-dan', 'Dan', 'dan@hint.test', false);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'hint-alice', 'role', 'authenticated')::text, true);
  v_home := public.create_commune('Hint home', 'household', 'GBP');
  v_token := public.create_commune_invite(v_home, 'bob.smith@example.co.uk', 'member');
  v_other := public.create_commune_invite(v_home, 'dan@hint.test', 'member');

  -- Someone with the link, signed in with another address, is told which one.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'hint-cara', 'role', 'authenticated')::text, true);
  IF public.invite_address_hint(v_token) IS DISTINCT FROM 'b•••@e•••.co.uk' THEN
    RAISE EXCEPTION 'Another account was not told which address to use: %', public.invite_address_hint(v_token);
  END IF;
  IF EXISTS (SELECT 1 FROM public.preview_commune_invite(v_token)) THEN
    RAISE EXCEPTION 'Another account could preview the invitation';
  END IF;
  -- Without the token there is nothing to tell.
  IF num_nonnulls(public.invite_address_hint(repeat('0', 64)), public.invite_address_hint('not-a-token'),
      public.invite_address_hint(NULL), public.invite_address_hint(upper(v_token))) > 0 THEN
    RAISE EXCEPTION 'A hint came without the invitation''s token';
  END IF;

  -- The invited account itself gets the preview, never a hint, whatever the
  -- case of its address.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'hint-bob', 'role', 'authenticated')::text, true);
  IF public.invite_address_hint(v_token) IS NOT NULL OR NOT EXISTS (SELECT 1 FROM public.preview_commune_invite(v_token)) THEN
    RAISE EXCEPTION 'The invited account was given a hint instead of the invitation';
  END IF;
  -- So does an account with the invited address that still needs verifying.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'hint-dan', 'role', 'authenticated')::text, true);
  IF public.invite_address_hint(v_other) IS NOT NULL THEN
    RAISE EXCEPTION 'An unverified account with the invited address was given a hint';
  END IF;

  -- An invitation that can no longer be accepted gives no hint: once used,
  -- withdrawn or expired.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'hint-bob', 'role', 'authenticated')::text, true);
  PERFORM public.accept_commune_invite(v_token);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'hint-cara', 'role', 'authenticated')::text, true);
  IF public.invite_address_hint(v_token) IS NOT NULL THEN RAISE EXCEPTION 'A used invitation gave a hint'; END IF;
  IF public.invite_address_hint(v_other) IS DISTINCT FROM 'd•••@h•••.test' THEN RAISE EXCEPTION 'An open invitation gave no hint'; END IF;
  UPDATE public.commune_invites SET expires_at = now() - interval '1 minute' WHERE email = 'dan@hint.test';
  IF public.invite_address_hint(v_other) IS NOT NULL THEN RAISE EXCEPTION 'An expired invitation gave a hint'; END IF;
  UPDATE public.commune_invites SET expires_at = now() + interval '1 day', revoked_at = now() WHERE email = 'dan@hint.test';
  IF public.invite_address_hint(v_other) IS NOT NULL THEN RAISE EXCEPTION 'A withdrawn invitation gave a hint'; END IF;

  -- Only a signed-in account is told anything.
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    PERFORM public.invite_address_hint(v_token);
  EXCEPTION WHEN SQLSTATE '28000' THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'A hint was given without a sign-in'; END IF;
END;
$$;

ROLLBACK;
