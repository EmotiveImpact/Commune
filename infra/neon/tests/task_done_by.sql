-- Who did a task (0041). Run only in an empty disposable local DB built from
-- infra/local/bootstrap.sql, every migration and after-core.sql (app_auth
-- stands in for Neon Auth). Everything is rolled back.
BEGIN;

DO $$
DECLARE v_home uuid;
BEGIN
  INSERT INTO app_auth.users (id, name, email, email_verified)
    VALUES ('00000000-0000-4000-8000-0000000000a1', 'Ama Owusu', 'ama@doneby.test', true),
           ('00000000-0000-4000-8000-0000000000b2', 'Ben', 'ben@doneby.test', true),
           ('00000000-0000-4000-8000-0000000000c3', 'Cleo', 'cleo@doneby.test', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000a1', 'role', 'authenticated')::text, true);
  v_home := public.create_commune('Done by home', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role)
    VALUES (v_home, '00000000-0000-4000-8000-0000000000b2', 'member'), (v_home, '00000000-0000-4000-8000-0000000000c3', 'member');
  PERFORM set_config('test.home', v_home::text, true);
END;
$$;

SET ROLE authenticated;
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  a text := '00000000-0000-4000-8000-0000000000a1';
  b text := '00000000-0000-4000-8000-0000000000b2';
  c text := '00000000-0000-4000-8000-0000000000c3';
  v_op uuid; v_once uuid; v_loose uuid; v_result jsonb; v_row public.commune_operations%ROWTYPE;
  v_history jsonb; v_failed boolean;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  v_op := (public.create_operation(v_home, 'task', 'chore', 'Bins', current_date, NULL, true, a, jsonb_build_array(a, b, c),
    'weekly', '', gen_random_uuid())->>'id')::uuid;

  -- Ben marks Ama's turn done without saying who did it: refused, nothing moves.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  v_failed := false;
  BEGIN
    PERFORM public.record_operation_occurrence(v_op, 'completed', current_date, current_date, gen_random_uuid());
  EXCEPTION WHEN invalid_parameter_value THEN
    v_failed := SQLERRM = 'This is Ama''s turn. Say whether you did it or they did.';
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'Someone else''s task was marked done without saying who did it'; END IF;
  IF EXISTS (SELECT 1 FROM public.operation_occurrences WHERE operation_id = v_op) THEN
    RAISE EXCEPTION 'A refused completion left an occurrence';
  END IF;

  -- Any other answer, or an answer with a skip, is refused.
  FOREACH v_result IN ARRAY ARRAY['"someone"'::jsonb, '"skip"'::jsonb] LOOP
    v_failed := false;
    BEGIN
      IF v_result #>> '{}' = 'skip' THEN
        PERFORM public.record_operation_occurrence(v_op, 'skipped', current_date, current_date, gen_random_uuid(), NULL, 'me');
      ELSE
        PERFORM public.record_operation_occurrence(v_op, 'completed', current_date, current_date, gen_random_uuid(), NULL, v_result #>> '{}');
      END IF;
    EXCEPTION WHEN invalid_parameter_value THEN v_failed := true;
    END;
    IF NOT v_failed THEN RAISE EXCEPTION 'A wrong done-by answer was accepted: %', v_result; END IF;
  END LOOP;

  -- Ben says Ama did it: Ama is credited, Ben is named as marking it, and
  -- the turn passes to Ben as usual.
  v_result := public.record_operation_occurrence(v_op, 'completed', current_date, current_date, gen_random_uuid(), NULL, 'assignee');
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_op;
  IF v_row.last_done <> jsonb_build_object('by', 'Ama Owusu', 'date', current_date, 'markedBy', 'Ben') OR v_row.assignee_id <> b THEN
    RAISE EXCEPTION 'Marking done for the holder went wrong: %', row_to_json(v_row);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.operation_occurrences WHERE id = (v_result->>'id')::uuid AND actor_id = b AND done_by_id = a) THEN
    RAISE EXCEPTION 'The occurrence did not keep who did it';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.commune_events WHERE entity_id = v_op AND actor_id = b AND description = 'Marked done for Ama Owusu. Next: Ben') THEN
    RAISE EXCEPTION 'Activity did not say it was marked done for Ama';
  END IF;
  SELECT o->'history' INTO v_history FROM jsonb_array_elements(public.commune_snapshot(v_home)->'operations') o WHERE o->>'id' = v_op::text;
  IF v_history->0->>'doneById' <> a OR v_history->0->>'actorId' <> b THEN
    RAISE EXCEPTION 'The history did not carry who did it: %', v_history;
  END IF;

  -- Undo puts the earlier credit back.
  PERFORM public.undo_operation_occurrence((v_result->>'id')::uuid);
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_op;
  IF v_row.last_done IS NOT NULL OR v_row.assignee_id <> a THEN
    RAISE EXCEPTION 'Undo did not restore the task: %', row_to_json(v_row);
  END IF;

  -- Ben did Ama's turn himself: Ben is credited, covering Ama. The turn
  -- still moves on from Ama's place.
  v_result := public.record_operation_occurrence(v_op, 'completed', current_date, current_date, gen_random_uuid(), NULL, 'me');
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_op;
  IF v_row.last_done <> jsonb_build_object('by', 'Ben', 'date', current_date, 'covering', 'Ama Owusu') OR v_row.assignee_id <> b THEN
    RAISE EXCEPTION 'Covering the holder went wrong: %', row_to_json(v_row);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.operation_occurrences WHERE id = (v_result->>'id')::uuid AND done_by_id = b)
     OR NOT EXISTS (SELECT 1 FROM public.commune_events WHERE entity_id = v_op AND description = 'Completed, covering Ama Owusu. Next: Ben') THEN
    RAISE EXCEPTION 'Covering was not recorded';
  END IF;

  -- Ben's own turn needs no answer and credits Ben alone.
  v_result := public.record_operation_occurrence(v_op, 'completed', v_row.date, current_date, gen_random_uuid());
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_op;
  IF v_row.last_done <> jsonb_build_object('by', 'Ben', 'date', current_date) OR v_row.assignee_id <> c THEN
    RAISE EXCEPTION 'Completing your own turn went wrong: %', row_to_json(v_row);
  END IF;

  -- A one-off task works the same way.
  v_once := (public.create_operation(v_home, 'task', 'chore', 'Return the key', current_date, NULL, true, c, NULL,
    'none', '', gen_random_uuid())->>'id')::uuid;
  PERFORM public.record_operation_occurrence(v_once, 'completed', current_date, current_date, gen_random_uuid(), NULL, 'assignee');
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_once;
  IF v_row.status <> 'done' OR v_row.last_done <> jsonb_build_object('by', 'Cleo', 'date', current_date, 'markedBy', 'Ben') THEN
    RAISE EXCEPTION 'A one-off marked done for its holder went wrong: %', row_to_json(v_row);
  END IF;

  -- A task nobody holds is done by whoever marks it, and cannot be credited
  -- to a holder it does not have.
  v_loose := (public.create_operation(v_home, 'task', 'chore', 'Descale the kettle', current_date, NULL, true, NULL, NULL,
    'none', '', gen_random_uuid())->>'id')::uuid;
  v_failed := false;
  BEGIN
    PERFORM public.record_operation_occurrence(v_loose, 'completed', current_date, current_date, gen_random_uuid(), NULL, 'assignee');
  EXCEPTION WHEN invalid_parameter_value THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'A task nobody holds was credited to its holder'; END IF;
  PERFORM public.record_operation_occurrence(v_loose, 'completed', current_date, current_date, gen_random_uuid());
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_loose;
  IF v_row.last_done <> jsonb_build_object('by', 'Ben', 'date', current_date) THEN
    RAISE EXCEPTION 'An unheld task was not credited to whoever marked it: %', row_to_json(v_row);
  END IF;

  -- last_done takes only these names, each a short piece of text.
  IF public.valid_operation_last_done(jsonb_build_object('by', 'Ben', 'date', current_date, 'markedBy', ''))
     OR public.valid_operation_last_done(jsonb_build_object('by', 'Ben', 'date', current_date, 'covering', 3))
     OR public.valid_operation_last_done(jsonb_build_object('by', 'Ben', 'date', current_date, 'note', 'x')) THEN
    RAISE EXCEPTION 'last_done accepted a malformed name';
  END IF;
END;
$$;

-- A task still held by a name with no account keeps crediting that name and
-- says who marked it.
RESET ROLE;
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  v_op uuid; v_row public.commune_operations%ROWTYPE;
BEGIN
  -- Rows like this predate member ids (0020), so the checks on new rows are
  -- bypassed to make one.
  SET LOCAL session_replication_role = replica;
  INSERT INTO public.commune_operations (commune_id, kind, category, title, date, repeat, assignee, created_by)
    VALUES (v_home, 'task', 'chore', 'Plants', current_date, 'weekly', 'Grandma', '00000000-0000-4000-8000-0000000000a1')
    RETURNING id INTO v_op;
  SET LOCAL session_replication_role = origin;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000b2', 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.record_operation_occurrence(v_op, 'completed', current_date, current_date, gen_random_uuid());
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_op;
  IF v_row.last_done <> jsonb_build_object('by', 'Grandma', 'date', current_date, 'markedBy', 'Ben') THEN
    RAISE EXCEPTION 'A named holder lost the credit: %', row_to_json(v_row);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.operation_occurrences WHERE operation_id = v_op AND done_by_id IS NULL) THEN
    RAISE EXCEPTION 'A completion claimed to know who a named holder was';
  END IF;
END;
$$;

SELECT 'task_done_by ok';
ROLLBACK;
