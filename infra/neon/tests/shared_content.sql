-- Run only in an empty disposable local DB after local_auth_stub.sql and
-- every migration. Real Neon verification must use signed JWTs. Notes and
-- tasks are written only through their commands (0027).
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
  v_case text;
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

  v_note := (public.create_note(v_home, 'Home note', '', '', '', '',
    '[["Key", "Value"]]'::jsonb, gen_random_uuid())->>'id')::uuid;
  v_operation := (public.create_operation(v_home, 'task', 'chore', 'Take bins out',
    current_date, NULL, true, 'content-alice', '["content-alice", "content-bob"]'::jsonb,
    'weekly', '', gen_random_uuid())->>'id')::uuid;
  PERFORM set_config('test.content_note', v_note::text, true);
  PERFORM set_config('test.content_operation', v_operation::text, true);

  -- The commands keep the table's limits and say what is wrong.
  SELECT jsonb_agg(jsonb_build_array('key', 'value'))
    INTO v_many_facts FROM generate_series(1, 31);
  FOREACH v_case IN ARRAY ARRAY['facts object', 'pill', 'title', 'blank title', 'kicker',
      'lede', 'body', 'many facts', 'one-part fact', 'number fact', 'long fact'] LOOP
    BEGIN
      PERFORM public.create_note(v_home,
        CASE v_case WHEN 'title' THEN repeat('t', 81) WHEN 'blank title' THEN '   ' ELSE 'Bad note' END,
        CASE WHEN v_case = 'pill' THEN repeat('p', 81) ELSE '' END,
        CASE WHEN v_case = 'kicker' THEN repeat('k', 121) ELSE '' END,
        CASE WHEN v_case = 'lede' THEN repeat('l', 201) ELSE '' END,
        CASE WHEN v_case = 'body' THEN repeat('b', 2001) ELSE '' END,
        CASE v_case WHEN 'facts object' THEN '{}'::jsonb WHEN 'many facts' THEN v_many_facts
          WHEN 'one-part fact' THEN '[["one"]]'::jsonb WHEN 'number fact' THEN '[["key", 5]]'::jsonb
          WHEN 'long fact' THEN jsonb_build_array(jsonb_build_array('key', repeat('v', 121)))
          ELSE '[]'::jsonb END,
        gen_random_uuid());
      RAISE EXCEPTION 'Invalid note was accepted: %', v_case;
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
  END LOOP;

  -- People are current members of this commune, by id, and only tasks have them.
  SELECT jsonb_agg('content-alice'::text) INTO v_many_rotation
    FROM generate_series(1, 51);
  FOREACH v_case IN ARRAY ARRAY['title', 'notes', 'kind', 'category', 'repeat', 'many rotators',
      'rotator type', 'outsider', 'unknown', 'event people', 'outside rotation'] LOOP
    BEGIN
      PERFORM public.create_operation(v_home,
        CASE v_case WHEN 'kind' THEN 'chore' WHEN 'event people' THEN 'event' ELSE 'task' END,
        CASE v_case WHEN 'category' THEN 'party' WHEN 'event people' THEN 'visit' ELSE 'chore' END,
        CASE WHEN v_case = 'title' THEN repeat('t', 81) ELSE 'Bad task' END,
        current_date, NULL, true,
        CASE v_case WHEN 'outsider' THEN 'content-carol' WHEN 'unknown' THEN 'nobody'
          WHEN 'outside rotation' THEN 'content-alice' ELSE 'content-bob' END,
        CASE v_case WHEN 'many rotators' THEN v_many_rotation WHEN 'rotator type' THEN '[3]'::jsonb
          WHEN 'outside rotation' THEN '["content-bob"]'::jsonb ELSE NULL END,
        CASE WHEN v_case = 'repeat' THEN 'daily' ELSE 'weekly' END,
        CASE WHEN v_case = 'notes' THEN repeat('n', 1001) ELSE '' END,
        gen_random_uuid());
      RAISE EXCEPTION 'Invalid task was accepted: %', v_case;
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
  END LOOP;
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

  -- Any member edits shared content; status is not something an edit sets.
  PERFORM public.update_note(v_note, 1, 'Edited by Bob', '', '', '', '', '[["Key", "Value"]]'::jsonb);
  PERFORM public.update_operation(v_operation, 1, 'task', 'chore', 'Take bins out on Tuesday',
    current_date, NULL, true, 'content-alice', '["content-alice", "content-bob"]'::jsonb, 'weekly', '');
  IF (SELECT title FROM public.commune_notes WHERE id = v_note) <> 'Edited by Bob'
     OR (SELECT status FROM public.commune_operations WHERE id = v_operation) <> 'open' THEN
    RAISE EXCEPTION 'Member cannot edit shared content';
  END IF;

  -- Identity and commune ownership cannot be rewritten by a client, and
  -- nothing is written to the tables directly.
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
  BEGIN
    PERFORM public.remove_note(v_note);
    RAISE EXCEPTION 'Member removed a note someone else added';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  v_bob_note := (public.create_note(v_home, 'Bob note', '', '', '', '', '[]'::jsonb,
    gen_random_uuid())->>'id')::uuid;
  v_bob_operation := (public.create_operation(v_home, 'event', 'visit', 'Bob visit',
    current_date, NULL, true, NULL, NULL, 'none', '', gen_random_uuid())->>'id')::uuid;
  IF (SELECT created_by FROM public.commune_notes WHERE id = v_bob_note) <> 'content-bob' THEN
    RAISE EXCEPTION 'Note author is not the caller';
  END IF;
  PERFORM public.remove_note(v_bob_note);
  PERFORM public.remove_operation(v_bob_operation);
  SELECT count(*) INTO v_count FROM public.commune_notes WHERE id = v_bob_note;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Member cannot remove their own note'; END IF;
  SELECT count(*) INTO v_count FROM public.commune_operations WHERE id = v_bob_operation;
  IF v_count <> 0 THEN RAISE EXCEPTION 'Member cannot remove their own operation'; END IF;
END;
$$;

SELECT set_config('request.jwt.claims', json_build_object('sub', 'content-carol', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  v_home uuid := current_setting('test.content_home')::uuid;
  v_note uuid := current_setting('test.content_note')::uuid;
  v_operation uuid := current_setting('test.content_operation')::uuid;
  v_count integer;
  v_case text;
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
  FOREACH v_case IN ARRAY ARRAY['add note', 'add operation', 'edit note', 'edit operation',
      'remove note', 'remove operation', 'insert note'] LOOP
    BEGIN
      CASE v_case
        WHEN 'add note' THEN PERFORM public.create_note(v_home, 'Intrusion', '', '', '', '', '[]'::jsonb, gen_random_uuid());
        WHEN 'add operation' THEN PERFORM public.create_operation(v_home, 'task', 'chore', 'Intrusion',
          current_date, NULL, true, NULL, NULL, 'none', '', gen_random_uuid());
        WHEN 'edit note' THEN PERFORM public.update_note(v_note, 2, 'Intrusion', '', '', '', '', '[]'::jsonb);
        WHEN 'edit operation' THEN PERFORM public.update_operation(v_operation, 2, 'task', 'chore', 'Intrusion',
          current_date, NULL, true, NULL, NULL, 'none', '');
        WHEN 'remove note' THEN PERFORM public.remove_note(v_note);
        WHEN 'remove operation' THEN PERFORM public.remove_operation(v_operation);
        ELSE INSERT INTO public.commune_notes (commune_id, title, created_by) VALUES (v_home, 'Intrusion', auth.user_id());
      END CASE;
      RAISE EXCEPTION 'Outsider could %', v_case;
    EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
    END;
  END LOOP;
END;
$$;

RESET ROLE;
ROLLBACK;
