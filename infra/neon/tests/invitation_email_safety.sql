-- Invitation email safety (0033). Run only in an empty disposable local DB
-- built from infra/neon/tests/local_auth_stub.sql and every migration.
-- Everything is rolled back.
BEGIN;

DO $$
DECLARE
  v_name text; v_home uuid; v_failed boolean;
  v_refusal constant text := 'Commune names can''t include links, email addresses or phone numbers.';
BEGIN
  -- Ordinary names are allowed.
  FOREACH v_name IN ARRAY ARRAY['12 Park Street', 'Flat 3B, 2026', 'St. Mary''s House', 'No.5 Studio',
    'Smith & Co.', 'Flat 2, 14-16 Park Road', 'Tom @ Home', 'Apt. 4B', 'Café Olé', '123456', 'example.company'] LOOP
    IF commune_private.looks_like_contact(v_name) THEN
      RAISE EXCEPTION 'An ordinary name was taken for contact details: %', v_name;
    END IF;
  END LOOP;
  -- Links, email addresses and phone numbers are caught, also in full-width
  -- characters or split by zero-width spaces.
  FOREACH v_name IN ARRAY ARRAY['Bank: card locked, call 020 7946 0000', '+44 (0)20 7946 0000',
    'Call 07700-900-123', '020–7946–0000', '０２０ ７９４６ ００００', '020' || chr(8203) || '7946' || chr(8203) || '0000',
    'example.com', 'Visit EXAMPLE.CO.UK', 'paypal-help.net/login', 'bit.ly/abc', 'www.example', 'https://x',
    'help@bank', 'help＠bank', 'ｗｗｗ．example'] LOOP
    IF NOT commune_private.looks_like_contact(v_name) THEN
      RAISE EXCEPTION 'Contact details were not caught: %', v_name;
    END IF;
  END LOOP;
  IF commune_private.looks_like_contact(NULL) THEN RAISE EXCEPTION 'No name is not contact details'; END IF;

  -- Creating a commune with such a name is refused, with or without a place.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'safety-alice', 'role', 'authenticated')::text, true);
  v_failed := false;
  BEGIN
    PERFORM public.create_commune('Bank: card locked, call 020 7946 0000', 'household', 'GBP');
  EXCEPTION WHEN SQLSTATE '22023' THEN v_failed := SQLERRM = v_refusal;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'A commune was created with a phone number in its name'; END IF;
  v_failed := false;
  BEGIN
    PERFORM public.create_commune_with_location('www.example.com', 'trip', 'GBP', '', 'Lisbon', '', '');
  EXCEPTION WHEN SQLSTATE '22023' THEN v_failed := SQLERRM = v_refusal;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'A commune was created with a link in its name'; END IF;
  IF EXISTS (SELECT 1 FROM public.communes WHERE created_by = 'safety-alice') THEN
    RAISE EXCEPTION 'A refused commune was saved';
  END IF;

  -- Renaming to such a name is refused and changes nothing.
  v_home := public.create_commune('St. Mary''s House', 'household', 'GBP');
  v_failed := false;
  BEGIN
    PERFORM public.update_commune_details(v_home, 'help@bank.com', 'household', 'GBP');
  EXCEPTION WHEN SQLSTATE '22023' THEN v_failed := SQLERRM = v_refusal;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'A commune was renamed to an email address'; END IF;
  v_failed := false;
  BEGIN
    PERFORM public.update_commune_with_location(v_home, 'Call 020 7946 0000', 'household', 'GBP', '1 Main Street', '', '', '');
  EXCEPTION WHEN SQLSTATE '22023' THEN v_failed := SQLERRM = v_refusal;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'A commune was renamed to a phone number'; END IF;
  IF (SELECT name || '|' || address FROM public.communes WHERE id = v_home) <> 'St. Mary''s House|' THEN
    RAISE EXCEPTION 'A refused rename changed the commune';
  END IF;
  PERFORM public.update_commune_details(v_home, 'No.5 Studio', 'household', 'GBP');
  IF (SELECT name FROM public.communes WHERE id = v_home) <> 'No.5 Studio' THEN
    RAISE EXCEPTION 'An ordinary rename was not saved';
  END IF;

  -- A name saved before 0033 stays. Keeping it is not a rename, so its other
  -- details can still change; changing it to another such name is refused.
  UPDATE public.communes SET name = 'Flat 2 020 7946 0000' WHERE id = v_home;
  PERFORM public.update_commune_with_location(v_home, 'Flat 2 020 7946 0000', 'household', 'EUR', '1 Main Street', '', '', '');
  IF (SELECT name || '|' || currency || '|' || address FROM public.communes WHERE id = v_home)
     <> 'Flat 2 020 7946 0000|EUR|1 Main Street' THEN
    RAISE EXCEPTION 'An existing name blocked an edit of other details';
  END IF;
  v_failed := false;
  BEGIN
    PERFORM public.update_commune_details(v_home, 'Flat 2 020 7946 0001', 'household', 'EUR');
  EXCEPTION WHEN SQLSTATE '22023' THEN v_failed := SQLERRM = v_refusal;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'A rename to another phone number was saved'; END IF;

  -- The suppression list belongs to the email worker: no client role can
  -- read or change it, and neither can call the name rule directly.
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.email_suppressions'::regclass) THEN
    RAISE EXCEPTION 'RLS is disabled on public.email_suppressions';
  END IF;
  FOREACH v_name IN ARRAY ARRAY['public', 'authenticated', 'anonymous'] LOOP
    IF has_table_privilege(v_name, 'public.email_suppressions', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
       OR has_function_privilege(v_name, 'commune_private.looks_like_contact(text)', 'EXECUTE') THEN
      RAISE EXCEPTION 'Unexpected % grant on the suppression list or name rule', v_name;
    END IF;
  END LOOP;

  -- One lower-case row per address, for a bounce or a complaint only.
  v_failed := false;
  BEGIN
    INSERT INTO public.email_suppressions (email, reason, provider_event_id) VALUES ('Mixed@Example.test', 'bounce', 'msg_1');
  EXCEPTION WHEN check_violation THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'A suppression kept an upper-case address'; END IF;
  v_failed := false;
  BEGIN
    INSERT INTO public.email_suppressions (email, reason, provider_event_id) VALUES ('x@example.test', 'delivered', 'msg_2');
  EXCEPTION WHEN check_violation THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'A suppression accepted a reason other than bounce or complaint'; END IF;
END;
$$;

-- A signed-in client is refused a direct read of the list.
SET ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM 1 FROM public.email_suppressions;
    RAISE EXCEPTION 'authenticated read public.email_suppressions';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;
RESET ROLE;

ROLLBACK;
