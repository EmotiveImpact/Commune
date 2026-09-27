-- Run only in an empty disposable local DB after local_auth_stub.sql and
-- migrations 0001 through 0006. Real Neon verification must use signed JWTs.
BEGIN;

DO $$
DECLARE
  v_home uuid;
  v_other uuid;
BEGIN
  INSERT INTO neon_auth."user" (id, name, email, "emailVerified")
    VALUES ('content-alice', 'Alice', 'alice@content.test', true),
           ('content-bob', 'Bob', 'bob@content.test', true),
           ('content-carol', 'Carol', 'carol@content.test', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'content-alice', 'role', 'authenticated')::text, true);
  v_home := public.create_commune('Content home', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role)
    VALUES (v_home, 'content-bob', 'member');
  PERFORM set_config('test.content_home', v_home::text, true);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'content-carol', 'role', 'authenticated')::text, true);
  v_other := public.create_commune('Other home', 'household', 'GBP');
  PERFORM set_config('test.content_other', v_other::text, true);
END;
$$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', 'content-alice', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  v_home uuid := current_setting('test.content_home')::uuid;
  v_note uuid;
  v_operation uuid;
  v_count integer;
  v_many_facts jsonb;
  v_many_rotation jsonb;
BEGIN
  SELECT count(*) INTO v_count FROM public.member_profiles(v_home);
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Member profiles did not return both commune members';
  END IF;
  SELECT count(*) INTO v_count FROM public.member_profiles(v_home)
    WHERE id = 'content-bob' AND email = 'bob@content.test' AND role = 'member';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Member profile omitted expected fields';
  END IF;

  INSERT INTO public.commune_notes
    (commune_id, title, facts, created_by)
    VALUES (v_home, 'Home note', '[["Key", "Value"]]'::jsonb,
      auth.user_id()) RETURNING id INTO v_note;
  INSERT INTO public.commune_operations
    (commune_id, kind, category, title, date, rotation, last_done, created_by)
    VALUES (v_home, 'task', 'chore', 'Take bins out', current_date,
      '["Alice", "Bob"]'::jsonb,
      '{"by":"Alice","date":"2024-02-29"}'::jsonb,
      auth.user_id()) RETURNING id INTO v_operation;
  PERFORM set_config('test.content_note', v_note::text, true);
  PERFORM set_config('test.content_operation', v_operation::text, true);

  BEGIN
    INSERT INTO public.commune_notes
      (commune_id, title, facts, created_by)
      VALUES (v_home, 'Bad facts', '{}'::jsonb, auth.user_id());
    RAISE EXCEPTION 'Non-array facts were accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_notes (commune_id, title, pill, created_by)
      VALUES (v_home, 'Long pill', repeat('p', 81), auth.user_id());
    RAISE EXCEPTION 'Overlong note pill was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_notes (commune_id, title, created_by)
      VALUES (v_home, repeat('t', 81), auth.user_id());
    RAISE EXCEPTION 'Overlong note title was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_notes (commune_id, title, kicker, created_by)
      VALUES (v_home, 'Long kicker', repeat('k', 121), auth.user_id());
    RAISE EXCEPTION 'Overlong note kicker was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_notes (commune_id, title, lede, created_by)
      VALUES (v_home, 'Long lede', repeat('l', 201), auth.user_id());
    RAISE EXCEPTION 'Overlong note lede was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_notes (commune_id, title, body, created_by)
      VALUES (v_home, 'Long body', repeat('b', 2001), auth.user_id());
    RAISE EXCEPTION 'Overlong note body was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  SELECT jsonb_agg(jsonb_build_array('key', 'value'))
    INTO v_many_facts FROM generate_series(1, 31);
  BEGIN
    INSERT INTO public.commune_notes (commune_id, title, facts, created_by)
      VALUES (v_home, 'Many facts', v_many_facts, auth.user_id());
    RAISE EXCEPTION 'Too many note facts were accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_notes (commune_id, title, facts, created_by)
      VALUES (v_home, 'Bad fact pair', '[["one"]]'::jsonb, auth.user_id());
    RAISE EXCEPTION 'One-part note fact was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_notes (commune_id, title, facts, created_by)
      VALUES (v_home, 'Bad fact type', '[["key", 5]]'::jsonb, auth.user_id());
    RAISE EXCEPTION 'Non-string note fact was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_notes (commune_id, title, facts, created_by)
      VALUES (v_home, 'Long fact',
        jsonb_build_array(jsonb_build_array('key', repeat('v', 121))),
        auth.user_id());
    RAISE EXCEPTION 'Overlong note fact was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;

  BEGIN
    INSERT INTO public.commune_operations
      (commune_id, kind, category, title, date, assignee, created_by)
      VALUES (v_home, 'task', 'chore', 'Long assignee', current_date,
        repeat('a', 81), auth.user_id());
    RAISE EXCEPTION 'Overlong operation assignee was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_operations
      (commune_id, kind, category, title, date, created_by)
      VALUES (v_home, 'task', 'chore', repeat('t', 81), current_date,
        auth.user_id());
    RAISE EXCEPTION 'Overlong operation title was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_operations
      (commune_id, kind, category, title, date, notes, created_by)
      VALUES (v_home, 'task', 'chore', 'Long notes', current_date,
        repeat('n', 1001), auth.user_id());
    RAISE EXCEPTION 'Overlong operation notes were accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  SELECT jsonb_agg('Alice'::text) INTO v_many_rotation
    FROM generate_series(1, 51);
  BEGIN
    INSERT INTO public.commune_operations
      (commune_id, kind, category, title, date, rotation, created_by)
      VALUES (v_home, 'task', 'chore', 'Many rotators', current_date,
        v_many_rotation, auth.user_id());
    RAISE EXCEPTION 'Oversized operation rotation was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_operations
      (commune_id, kind, category, title, date, rotation, created_by)
      VALUES (v_home, 'task', 'chore', 'Bad rotator', current_date,
        '[3]'::jsonb, auth.user_id());
    RAISE EXCEPTION 'Non-string operation rotation was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_operations
      (commune_id, kind, category, title, date, rotation, created_by)
      VALUES (v_home, 'task', 'chore', 'Long rotator', current_date,
        jsonb_build_array(repeat('r', 81)), auth.user_id());
    RAISE EXCEPTION 'Overlong operation rotator was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_operations
      (commune_id, kind, category, title, date, last_done, created_by)
      VALUES (v_home, 'task', 'chore', 'Missing done data', current_date,
        '{}'::jsonb, auth.user_id());
    RAISE EXCEPTION 'Incomplete operation last_done was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_operations
      (commune_id, kind, category, title, date, last_done, created_by)
      VALUES (v_home, 'task', 'chore', 'Empty done actor', current_date,
        '{"by":"   ","date":"2024-02-29"}'::jsonb, auth.user_id());
    RAISE EXCEPTION 'Blank operation last_done.by was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_operations
      (commune_id, kind, category, title, date, last_done, created_by)
      VALUES (v_home, 'task', 'chore', 'Long done actor', current_date,
        jsonb_build_object('by', repeat('a', 81), 'date', '2024-02-29'),
        auth.user_id());
    RAISE EXCEPTION 'Overlong operation last_done.by was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_operations
      (commune_id, kind, category, title, date, last_done, created_by)
      VALUES (v_home, 'task', 'chore', 'Bad done date', current_date,
        '{"by":"Alice","date":"2025-02-29"}'::jsonb, auth.user_id());
    RAISE EXCEPTION 'Impossible operation last_done date was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_operations
      (commune_id, kind, category, title, date, last_done, created_by)
      VALUES (v_home, 'task', 'chore', 'Extra done data', current_date,
        '{"by":"Alice","date":"2024-02-29","payload":"unexpected"}'::jsonb,
        auth.user_id());
    RAISE EXCEPTION 'Extra operation last_done fields were accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
END;
$$;

SELECT set_config('request.jwt.claims', json_build_object('sub', 'content-bob', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  v_home uuid := current_setting('test.content_home')::uuid;
  v_note uuid := current_setting('test.content_note')::uuid;
  v_operation uuid := current_setting('test.content_operation')::uuid;
  v_bob_note uuid;
  v_bob_operation uuid;
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.commune_notes WHERE commune_id = v_home;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Member cannot read shared note'; END IF;
  SELECT count(*) INTO v_count FROM public.commune_operations WHERE commune_id = v_home;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Member cannot read shared operation'; END IF;

  UPDATE public.commune_notes SET title = 'Edited by Bob' WHERE id = v_note;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member cannot edit shared note'; END IF;
  UPDATE public.commune_operations SET status = 'done' WHERE id = v_operation;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member cannot edit shared operation'; END IF;

  -- Identity and commune ownership cannot be rewritten by a client.
  BEGIN
    UPDATE public.commune_notes SET created_by = 'content-bob' WHERE id = v_note;
    RAISE EXCEPTION 'Client changed note author';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  BEGIN
    UPDATE public.commune_operations SET commune_id =
      current_setting('test.content_other')::uuid WHERE id = v_operation;
    RAISE EXCEPTION 'Client moved an operation to another commune';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_notes (commune_id, title, created_by)
      VALUES (v_home, 'Impersonated note', 'content-alice');
    RAISE EXCEPTION 'Client impersonated note author';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  INSERT INTO public.commune_notes (commune_id, title, created_by)
    VALUES (v_home, 'Bob note', auth.user_id()) RETURNING id INTO v_bob_note;
  INSERT INTO public.commune_operations
    (commune_id, kind, category, title, date, created_by)
    VALUES (v_home, 'event', 'visit', 'Bob visit', current_date,
      auth.user_id()) RETURNING id INTO v_bob_operation;
  DELETE FROM public.commune_notes WHERE id = v_bob_note;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member cannot delete shared note'; END IF;
  DELETE FROM public.commune_operations WHERE id = v_bob_operation;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member cannot delete shared operation'; END IF;
END;
$$;

SELECT set_config('request.jwt.claims', json_build_object('sub', 'content-carol', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  v_home uuid := current_setting('test.content_home')::uuid;
  v_note uuid := current_setting('test.content_note')::uuid;
  v_operation uuid := current_setting('test.content_operation')::uuid;
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.commune_notes WHERE commune_id = v_home;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Outsider read a note'; END IF;
  SELECT count(*) INTO v_count FROM public.commune_operations WHERE commune_id = v_home;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Outsider read an operation'; END IF;
  BEGIN
    PERFORM public.member_profiles(v_home);
    RAISE EXCEPTION 'Outsider read member profiles';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_notes (commune_id, title, created_by)
      VALUES (v_home, 'Intrusion', auth.user_id());
    RAISE EXCEPTION 'Outsider wrote a note';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_operations
      (commune_id, kind, category, title, date, created_by)
      VALUES (v_home, 'task', 'chore', 'Intrusion', current_date,
        auth.user_id());
    RAISE EXCEPTION 'Outsider wrote an operation';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  UPDATE public.commune_notes SET title = 'Intrusion' WHERE id = v_note;
  IF FOUND THEN RAISE EXCEPTION 'Outsider edited a note'; END IF;
  DELETE FROM public.commune_operations WHERE id = v_operation;
  IF FOUND THEN RAISE EXCEPTION 'Outsider deleted an operation'; END IF;
END;
$$;

RESET ROLE;
ROLLBACK;
