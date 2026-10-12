-- Operations people by member id (0020). Run only in an empty disposable
-- local DB built from infra/local/bootstrap.sql, every migration and after-core.sql (app_auth stands in for Neon Auth).
-- Everything is rolled back.
BEGIN;

DO $$
DECLARE v_home uuid; v_other uuid;
BEGIN
  INSERT INTO app_auth.users (id, name, email, email_verified)
    VALUES ('00000000-0000-4000-8000-0000000000a1', 'Alice', 'alice@ops.test', true),
           ('00000000-0000-4000-8000-0000000000b2', 'Sam', 'bob@ops.test', true),
           ('00000000-0000-4000-8000-0000000000c3', 'Sam', 'carol@ops.test', true),
           ('00000000-0000-4000-8000-0000000000d4', 'Dan', 'dan@ops.test', true),
           ('00000000-0000-4000-8000-0000000000e5', 'Eve', 'eve@ops.test', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000a1', 'role', 'authenticated')::text, true);
  v_home := public.create_commune('Ops home', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role)
    VALUES (v_home, '00000000-0000-4000-8000-0000000000b2', 'member'), (v_home, '00000000-0000-4000-8000-0000000000c3', 'member'), (v_home, '00000000-0000-4000-8000-0000000000d4', 'member');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000e5', 'role', 'authenticated')::text, true);
  v_other := public.create_commune('Elsewhere', 'household', 'GBP');
  PERFORM set_config('test.home', v_home::text, true);
  PERFORM set_config('test.other', v_other::text, true);
END;
$$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000a1', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  v_op uuid; v_once uuid; v_result jsonb; v_row public.commune_operations%ROWTYPE; v_snapshot jsonb;
  v_failed boolean;
  v_turns jsonb := '["00000000-0000-4000-8000-0000000000a1","00000000-0000-4000-8000-0000000000c3","00000000-0000-4000-8000-0000000000b2"]';
BEGIN
  -- Two members share the name "Sam"; ids keep them apart.
  v_op := (public.create_operation(v_home, 'task', 'chore', 'Bins', current_date, NULL, true,
    '00000000-0000-4000-8000-0000000000c3', v_turns, 'weekly', '', gen_random_uuid())->>'id')::uuid;
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_op;
  IF v_row.assignee <> 'Sam' OR v_row.rotation <> '["Alice","Sam","Sam"]'::jsonb THEN
    RAISE EXCEPTION 'Names were not copied from ids: % %', v_row.assignee, v_row.rotation;
  END IF;

  -- Completing passes it to the next id, not the first "Sam".
  v_result := public.record_operation_occurrence(v_op, 'completed', current_date, current_date, gen_random_uuid());
  IF v_result->>'assigneeId' <> '00000000-0000-4000-8000-0000000000b2' THEN
    RAISE EXCEPTION 'Rotation did not advance by id: %', v_result;
  END IF;
  v_result := public.undo_operation_occurrence((v_result->>'id')::uuid);
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_op;
  IF v_row.assignee_id <> '00000000-0000-4000-8000-0000000000c3' OR v_row.date <> current_date THEN
    RAISE EXCEPTION 'Undo did not restore the person by id';
  END IF;

  -- People must be current members of this commune. An edit names the
  -- version it started from (0027).
  FOREACH v_result IN ARRAY ARRAY['"00000000-0000-4000-8000-0000000000e5"'::jsonb, '"nobody"'::jsonb] LOOP
    v_failed := false;
    BEGIN
      PERFORM public.update_operation(v_op, (SELECT version FROM public.commune_operations WHERE id = v_op), 'task', 'chore', 'Bins',
        current_date, NULL, true, v_result #>> '{}', NULL, 'weekly', '');
    EXCEPTION WHEN invalid_parameter_value THEN v_failed := true;
    END;
    IF NOT v_failed THEN RAISE EXCEPTION 'Assigned a non-member: %', v_result; END IF;
  END LOOP;
  v_failed := false;
  BEGIN
    PERFORM public.update_operation(v_op, (SELECT version FROM public.commune_operations WHERE id = v_op), 'task', 'chore', 'Bins',
      current_date, NULL, true, '00000000-0000-4000-8000-0000000000a1',
      '["00000000-0000-4000-8000-0000000000a1","00000000-0000-4000-8000-0000000000a1"]', 'weekly', '');
  EXCEPTION WHEN invalid_parameter_value THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Accepted a person twice in a rotation'; END IF;
  v_failed := false;
  BEGIN
    PERFORM public.update_operation(v_op, (SELECT version FROM public.commune_operations WHERE id = v_op), 'task', 'chore', 'Bins',
      current_date, NULL, true, '00000000-0000-4000-8000-0000000000d4', v_turns, 'weekly', '');
  EXCEPTION WHEN invalid_parameter_value THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Assigned someone outside the rotation'; END IF;

  -- Names cannot be written by a client any more, only ids.
  BEGIN
    INSERT INTO public.commune_operations (commune_id, kind, category, title, date, assignee, created_by)
      VALUES (v_home, 'task', 'chore', 'Legacy', current_date, 'Dan', '00000000-0000-4000-8000-0000000000a1');
    RAISE EXCEPTION 'A client wrote a task directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- Clearing the person clears the copied name with it.
  v_once := (public.create_operation(v_home, 'task', 'chore', 'Return the key', current_date, NULL, true,
    '00000000-0000-4000-8000-0000000000d4', NULL, 'none', '', gen_random_uuid())->>'id')::uuid;
  IF (SELECT assignee FROM public.commune_operations WHERE id = v_once) <> 'Dan' THEN
    RAISE EXCEPTION 'The name was not copied from the id';
  END IF;
  PERFORM public.update_operation(v_once, 1, 'task', 'chore', 'Return the key', current_date, NULL, true, NULL, NULL, 'none', '');
  IF (SELECT assignee FROM public.commune_operations WHERE id = v_once) IS NOT NULL THEN
    RAISE EXCEPTION 'Clearing the id left a name behind';
  END IF;
  -- Editing other fields leaves the people alone.
  PERFORM public.update_operation(v_op, (SELECT version FROM public.commune_operations WHERE id = v_op), 'task', 'chore', 'Bins and recycling',
    current_date, NULL, true, '00000000-0000-4000-8000-0000000000c3', v_turns, 'weekly', '');
  IF (SELECT assignee_id FROM public.commune_operations WHERE id = v_op) <> '00000000-0000-4000-8000-0000000000c3'
     OR (SELECT title FROM public.commune_operations WHERE id = v_op) <> 'Bins and recycling' THEN
    RAISE EXCEPTION 'An unrelated edit changed the assignee';
  END IF;

  -- A rename shows everywhere at once.
  RESET ROLE;
  UPDATE app_auth.users SET name = 'Caroline' WHERE id = '00000000-0000-4000-8000-0000000000c3';
  v_snapshot := commune_private.snapshot_operations(v_home);
  SET ROLE authenticated;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_snapshot) o
      WHERE o->>'id' = v_op::text AND o->>'assignee' = 'Caroline' AND o->>'assigneeId' = '00000000-0000-4000-8000-0000000000c3'
        AND o->'rotation' = '["Alice","Caroline","Sam"]'::jsonb) THEN
    RAISE EXCEPTION 'The snapshot did not read names live: %', v_snapshot;
  END IF;
  PERFORM set_config('test.op', v_op::text, true);
END;
$$;

-- Carol leaves: Bins passes to the next person in the rotation and she
-- leaves the rotation. Bob leaves next and Bins skips nobody.
RESET ROLE;
DO $$
DECLARE v_home uuid := current_setting('test.home')::uuid; v_op uuid := current_setting('test.op')::uuid;
  v_row public.commune_operations%ROWTYPE; v_result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000a1', 'role', 'authenticated')::text, true);
  UPDATE public.commune_members SET active = false WHERE commune_id = v_home AND user_id = '00000000-0000-4000-8000-0000000000c3';
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_op;
  IF v_row.assignee_id <> '00000000-0000-4000-8000-0000000000b2' OR v_row.rotation_ids <> '["00000000-0000-4000-8000-0000000000a1","00000000-0000-4000-8000-0000000000b2"]'::jsonb THEN
    RAISE EXCEPTION 'Departure did not reassign: % %', v_row.assignee_id, v_row.rotation_ids;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.commune_events WHERE entity_id = v_op AND description = 'Caroline left. Now with Sam') THEN
    RAISE EXCEPTION 'Departure did not record who has it now';
  END IF;
  UPDATE public.commune_members SET active = false WHERE commune_id = v_home AND user_id = '00000000-0000-4000-8000-0000000000b2';
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_op;
  IF v_row.assignee_id <> '00000000-0000-4000-8000-0000000000a1' OR v_row.rotation_ids <> '["00000000-0000-4000-8000-0000000000a1"]'::jsonb THEN
    RAISE EXCEPTION 'Second departure did not reassign';
  END IF;
  UPDATE public.commune_members SET active = false WHERE commune_id = v_home AND user_id = '00000000-0000-4000-8000-0000000000d4';
  -- A completion with one person left keeps it with them.
  SET LOCAL ROLE authenticated;
  v_result := public.record_operation_occurrence(v_op, 'completed', current_date, current_date, gen_random_uuid());
  IF v_result->>'assigneeId' <> '00000000-0000-4000-8000-0000000000a1' THEN RAISE EXCEPTION 'Single-person rotation moved: %', v_result; END IF;
END;
$$;

SELECT 'operation_people ok';
ROLLBACK;
