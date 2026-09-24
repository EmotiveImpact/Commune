-- Run on a disposable local DB after local_auth_stub.sql and migrations
-- 0001 through 0007. Never apply this test or stub to Neon.
BEGIN;

DO $$
DECLARE
  v_home uuid;
BEGIN
  INSERT INTO neon_auth."user" (id, name, email, "emailVerified")
    VALUES ('atomic-alice', 'Alice', 'alice@atomic.test', true),
           ('atomic-bob', 'Bob', 'bob@atomic.test', true),
           ('atomic-outsider', 'Outsider', 'outsider@atomic.test', true);
  PERFORM set_config('request.jwt.sub', 'atomic-alice', true);
  v_home := public.create_commune_with_location(
    '  Alder House  ', 'household', 'GBP',
    '  22 Orchard Lane  ', '', '', ''
  );
  INSERT INTO public.commune_members (commune_id, user_id, role)
    VALUES (v_home, 'atomic-bob', 'member');
  PERFORM set_config('test.atomic_home', v_home::text, true);
END;
$$;

SET ROLE authenticated;
SELECT set_config('request.jwt.sub', 'atomic-alice', true);
DO $$
DECLARE
  v_home uuid := current_setting('test.atomic_home')::uuid;
  v_trip uuid;
  v_before integer;
  v_after integer;
  v_fund uuid;
BEGIN
  -- An authenticated user can create both a commune and its location in
  -- one call. Trimming and membership are retained from the existing RPCs.
  SELECT count(*) INTO v_before FROM public.communes;
  v_trip := public.create_commune_with_location(
    'September Trip', 'trip', 'EUR', '', 'Lisbon', 'Hotel Aurora',
    'Praça do Comércio 1'
  );
  SELECT count(*) INTO v_after FROM public.communes;
  IF v_after <> v_before + 1 OR NOT EXISTS (
    SELECT 1 FROM public.communes c
    JOIN public.commune_members m ON m.commune_id = c.id
    WHERE c.id = v_trip AND c.kind = 'trip' AND c.currency = 'EUR'
      AND c.address = '' AND c.destination = 'Lisbon'
      AND c.stay_name = 'Hotel Aurora'
      AND c.stay_address = 'Praça do Comércio 1'
      AND m.user_id = 'atomic-alice' AND m.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Atomic create did not persist location and membership';
  END IF;

  -- The first nested RPC inserts the commune/member; the second rejects the
  -- invalid trip address. Neither insert may survive the one failed call.
  BEGIN
    PERFORM public.create_commune_with_location(
      'Must not exist', 'trip', 'GBP', 'invalid address', 'York', '', ''
    );
    RAISE EXCEPTION 'Invalid create was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  SELECT count(*) INTO v_after FROM public.communes;
  IF v_after <> v_before + 1 OR EXISTS (
    SELECT 1 FROM public.commune_members m
    JOIN public.communes c ON c.id = m.commune_id
    WHERE c.name = 'Must not exist'
  ) THEN
    RAISE EXCEPTION 'Invalid create left a partial commune or member';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.communes
    WHERE id = v_home AND name = 'Alder House'
      AND address = '22 Orchard Lane'
  ) THEN RAISE EXCEPTION 'Initial household details were not saved'; END IF;

  -- Switching kind and replacing location is one all-or-nothing edit.
  PERFORM public.update_commune_with_location(
    v_home, 'Autumn Away', 'trip', 'GBP', '', 'Edinburgh',
    'Station Hotel', '1 Station Road'
  );
  IF NOT EXISTS (
    SELECT 1 FROM public.communes WHERE id = v_home
      AND name = 'Autumn Away' AND kind = 'trip' AND currency = 'GBP'
      AND address = '' AND destination = 'Edinburgh'
      AND stay_name = 'Station Hotel' AND stay_address = '1 Station Road'
  ) THEN RAISE EXCEPTION 'Atomic kind/location update failed'; END IF;

  -- Details update would clear the trip location, but the second nested RPC
  -- rejects a household with destination. No intermediate state may persist.
  BEGIN
    PERFORM public.update_commune_with_location(
      v_home, 'Wrong Type', 'household', 'GBP',
      '22 Orchard Lane', 'Edinburgh', '', ''
    );
    RAISE EXCEPTION 'Invalid edit was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  IF NOT EXISTS (
    SELECT 1 FROM public.communes WHERE id = v_home
      AND name = 'Autumn Away' AND kind = 'trip'
      AND destination = 'Edinburgh' AND stay_name = 'Station Hotel'
  ) THEN RAISE EXCEPTION 'Invalid edit left partial settings'; END IF;

  v_fund := public.create_fund(v_home, 'Travel fund', 10000);
  IF v_fund IS NULL THEN RAISE EXCEPTION 'Test fund was not created'; END IF;
  BEGIN
    PERFORM public.update_commune_with_location(
      v_home, 'Repriced Trip', 'trip', 'USD',
      '', 'Edinburgh', 'Station Hotel', '1 Station Road'
    );
    RAISE EXCEPTION 'Currency changed after fund creation';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  IF NOT EXISTS (
    SELECT 1 FROM public.communes WHERE id = v_home
      AND name = 'Autumn Away' AND currency = 'GBP'
  ) THEN RAISE EXCEPTION 'Rejected currency change modified settings'; END IF;
END;
$$;

SELECT set_config('request.jwt.sub', 'atomic-bob', true);
DO $$
DECLARE
  v_home uuid := current_setting('test.atomic_home')::uuid;
BEGIN
  BEGIN
    PERFORM public.update_commune_with_location(
      v_home, 'Bob Changed It', 'trip', 'GBP', '', 'Paris', '', ''
    );
    RAISE EXCEPTION 'Non-admin changed commune details';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  IF NOT EXISTS (
    SELECT 1 FROM public.communes WHERE id = v_home
      AND name = 'Autumn Away' AND destination = 'Edinburgh'
  ) THEN RAISE EXCEPTION 'Rejected member edit modified settings'; END IF;
END;
$$;

SELECT set_config('request.jwt.sub', 'atomic-outsider', true);
DO $$
BEGIN
  BEGIN
    PERFORM public.update_commune_with_location(
      current_setting('test.atomic_home')::uuid,
      'Outsider Changed It', 'trip', 'GBP', '', 'Paris', '', ''
    );
    RAISE EXCEPTION 'Outsider changed commune details';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END;
$$;

SELECT set_config('request.jwt.sub', '', true);
DO $$
BEGIN
  BEGIN
    PERFORM public.create_commune_with_location(
      'Anonymous', 'household', 'GBP', '', '', '', ''
    );
    RAISE EXCEPTION 'Anonymous commune creation succeeded';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END;
$$;

RESET ROLE;
ROLLBACK;
