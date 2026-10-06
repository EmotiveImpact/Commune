-- Task handovers and skip reasons (0024). Run only in an empty disposable
-- local DB built from infra/local/bootstrap.sql, every migration and
-- after-core.sql (app_auth stands in for Neon Auth). Everything is rolled back.
BEGIN;

DO $$
DECLARE v_home uuid; v_other uuid;
BEGIN
  INSERT INTO app_auth.users (id, name, email, email_verified)
    VALUES ('00000000-0000-4000-8000-0000000000a1', 'Avery', 'avery@handover.test', true),
           ('00000000-0000-4000-8000-0000000000b2', 'Blake', 'blake@handover.test', true),
           ('00000000-0000-4000-8000-0000000000c3', 'Casey', 'casey@handover.test', true),
           ('00000000-0000-4000-8000-0000000000d4', 'Dana', 'dana@handover.test', true),
           ('00000000-0000-4000-8000-0000000000e5', 'Eve', 'eve@handover.test', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000a1', 'role', 'authenticated')::text, true);
  v_home := public.create_commune('Handover home', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role)
    VALUES (v_home, '00000000-0000-4000-8000-0000000000b2', 'member'), (v_home, '00000000-0000-4000-8000-0000000000c3', 'member'),
           (v_home, '00000000-0000-4000-8000-0000000000d4', 'member');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000e5', 'role', 'authenticated')::text, true);
  v_other := public.create_commune('Elsewhere', 'household', 'GBP');
  PERFORM set_config('test.home', v_home::text, true);
END;
$$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000a1', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  a text := '00000000-0000-4000-8000-0000000000a1';
  b text := '00000000-0000-4000-8000-0000000000b2';
  c text := '00000000-0000-4000-8000-0000000000c3';
  d text := '00000000-0000-4000-8000-0000000000d4';
  e text := '00000000-0000-4000-8000-0000000000e5';
  v_op uuid; v_once uuid; v_result jsonb; v_row public.commune_operations%ROWTYPE; v_snapshot jsonb;
  v_request uuid := gen_random_uuid(); v_failed text; v_handover jsonb;
BEGIN
  INSERT INTO public.commune_operations (commune_id, kind, category, title, date, repeat, assignee_id, rotation_ids, created_by)
    VALUES (v_home, 'task', 'chore', 'Bins', current_date, 'weekly', a, jsonb_build_array(a, b, c), a) RETURNING id INTO v_op;

  -- Refusals: unknown or outside members, the current holder, a stale screen,
  -- an overlong reason, no request id.
  FOREACH v_failed IN ARRAY ARRAY['outsider', 'nobody', 'holder', 'stale-date', 'stale-holder', 'long', 'request'] LOOP
    BEGIN
      PERFORM public.hand_over_operation(v_op,
        CASE v_failed WHEN 'outsider' THEN e WHEN 'nobody' THEN 'nobody' WHEN 'holder' THEN a ELSE b END,
        CASE WHEN v_failed = 'stale-date' THEN current_date - 7 ELSE current_date END,
        CASE WHEN v_failed = 'stale-holder' THEN b ELSE a END,
        current_date, CASE WHEN v_failed = 'long' THEN repeat('x', 201) END,
        CASE WHEN v_failed = 'request' THEN NULL ELSE gen_random_uuid() END);
      RAISE EXCEPTION 'Handover was not refused: %', v_failed;
    EXCEPTION WHEN invalid_parameter_value OR raise_exception THEN
      IF SQLERRM LIKE 'Handover was not refused%' THEN RAISE; END IF;
    END;
  END LOOP;

  -- Dana, who is not in the rotation, covers Avery's turn.
  v_handover := public.hand_over_operation(v_op, d, current_date, a, current_date, '  Away at a wedding  ', v_request);
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_op;
  IF v_row.assignee_id <> d OR v_row.assignee <> 'Dana' OR v_row.turn_owner_id <> a OR v_row.date <> current_date THEN
    RAISE EXCEPTION 'Handover did not record the cover: %', row_to_json(v_row);
  END IF;
  -- A retry returns the same handover; reusing the id for another change is refused.
  v_result := public.hand_over_operation(v_op, d, current_date, a, current_date, NULL, v_request);
  IF (v_result->>'duplicate')::boolean IS NOT TRUE OR v_result->>'id' <> v_handover->>'id' THEN
    RAISE EXCEPTION 'Retry was not idempotent: %', v_result;
  END IF;
  BEGIN
    PERFORM public.hand_over_operation(v_op, b, current_date, d, current_date, NULL, v_request);
    RAISE EXCEPTION 'Reused request was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  v_snapshot := (SELECT x FROM jsonb_array_elements(public.commune_snapshot(v_home)->'operations') x WHERE x->>'id' = v_op::text);
  IF v_snapshot->>'turnOwnerId' <> a OR v_snapshot->>'turnOwner' <> 'Avery' OR v_snapshot->>'assignee' <> 'Dana'
     OR v_snapshot->'history'->0->>'action' <> 'handed_over' OR v_snapshot->'history'->0->>'reason' <> 'Away at a wedding'
     OR v_snapshot->>'undoOccurrenceId' <> v_handover->>'id' THEN
    RAISE EXCEPTION 'Snapshot does not show the cover: %', v_snapshot;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.commune_events WHERE entity_id = v_op
      AND description = 'Handed to Dana, covering for Avery: Away at a wedding') THEN
    RAISE EXCEPTION 'Handover history line missing';
  END IF;

  -- A member's edit of other fields keeps the cover, although Dana is not in
  -- the rotation; editing the people ends it.
  UPDATE public.commune_operations SET title = 'Bins out' WHERE id = v_op;
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_op;
  IF v_row.turn_owner_id IS DISTINCT FROM a OR v_row.assignee_id <> d THEN
    RAISE EXCEPTION 'A title edit dropped the cover';
  END IF;
  BEGIN
    UPDATE public.commune_operations SET turn_owner_id = b WHERE id = v_op;
    RAISE EXCEPTION 'A member wrote the turn owner directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Undo restores Avery. Hand over again, then complete: Dana is credited
  -- and the turn passes to Blake, after Avery, not to whoever is after Dana.
  PERFORM public.undo_operation_occurrence((v_handover->>'id')::uuid);
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_op;
  IF v_row.assignee_id <> a OR v_row.turn_owner_id IS NOT NULL THEN
    RAISE EXCEPTION 'Undo did not restore the holder: %', row_to_json(v_row);
  END IF;
  PERFORM public.hand_over_operation(v_op, d, current_date, a, current_date, NULL, gen_random_uuid());
  v_result := public.record_operation_occurrence(v_op, 'completed', current_date, current_date, gen_random_uuid());
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_op;
  IF v_row.assignee_id <> b OR v_row.turn_owner_id IS NOT NULL OR v_row.last_done->>'by' <> 'Dana' OR v_row.date <> current_date + 7 THEN
    RAISE EXCEPTION 'Completion after a cover went wrong: %', row_to_json(v_row);
  END IF;
  -- Undoing the completion brings back the cover exactly.
  PERFORM public.undo_operation_occurrence((v_result->>'id')::uuid);
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_op;
  IF v_row.assignee_id <> d OR v_row.turn_owner_id <> a THEN
    RAISE EXCEPTION 'Undoing the completion lost the cover: %', row_to_json(v_row);
  END IF;

  -- Handing it back to the person whose turn it is ends the cover. A second
  -- handover within the rotation keeps the original turn owner.
  PERFORM public.hand_over_operation(v_op, c, current_date, d, current_date, NULL, gen_random_uuid());
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_op;
  IF v_row.assignee_id <> c OR v_row.turn_owner_id <> a THEN
    RAISE EXCEPTION 'A second handover lost whose turn it is: %', row_to_json(v_row);
  END IF;
  PERFORM public.hand_over_operation(v_op, a, current_date, c, current_date, NULL, gen_random_uuid());
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_op;
  IF v_row.assignee_id <> a OR v_row.turn_owner_id IS NOT NULL THEN
    RAISE EXCEPTION 'Handing back did not end the cover: %', row_to_json(v_row);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.commune_events WHERE entity_id = v_op AND description = 'Handed back to Avery') THEN
    RAISE EXCEPTION 'Hand-back history line missing';
  END IF;

  -- Editing who has it replaces a cover; someone outside the rotation is
  -- then refused as before.
  PERFORM public.hand_over_operation(v_op, d, current_date, a, current_date, NULL, gen_random_uuid());
  UPDATE public.commune_operations SET assignee_id = b WHERE id = v_op;
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_op;
  IF v_row.assignee_id <> b OR v_row.turn_owner_id IS NOT NULL THEN
    RAISE EXCEPTION 'Editing the holder did not end the cover: %', row_to_json(v_row);
  END IF;
  BEGIN
    UPDATE public.commune_operations SET assignee_id = d WHERE id = v_op;
    RAISE EXCEPTION 'Someone outside the rotation was made holder by an edit';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  -- A skip can say why, and only a skip takes a reason.
  v_result := public.record_operation_occurrence(v_op, 'skipped', current_date, current_date, gen_random_uuid(), 'Bins not collected this week');
  IF NOT EXISTS (SELECT 1 FROM public.operation_occurrences WHERE id = (v_result->>'id')::uuid AND reason = 'Bins not collected this week') THEN
    RAISE EXCEPTION 'Skip reason was not kept';
  END IF;
  BEGIN
    PERFORM public.record_operation_occurrence(v_op, 'completed', current_date + 7, current_date, gen_random_uuid(), 'Because');
    RAISE EXCEPTION 'A completion took a reason';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  -- A task without turns is simply handed over, with no turn owner.
  INSERT INTO public.commune_operations (commune_id, kind, category, title, date, repeat, assignee_id, created_by)
    VALUES (v_home, 'task', 'chore', 'Return the key', current_date, 'none', a, a) RETURNING id INTO v_once;
  PERFORM public.hand_over_operation(v_once, c, current_date, a, current_date, NULL, gen_random_uuid());
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_once;
  IF v_row.assignee_id <> c OR v_row.turn_owner_id IS NOT NULL THEN
    RAISE EXCEPTION 'Plain handover went wrong: %', row_to_json(v_row);
  END IF;

  PERFORM set_config('test.op', v_op::text, true);
END;
$$;

-- Departures. Dana covers Blake's turn and leaves: it goes back to Blake.
-- Casey covers Blake's turn and Blake leaves: Casey keeps it, with no turn
-- owner left behind.
RESET ROLE;
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  v_op uuid := current_setting('test.op')::uuid;
  a text := '00000000-0000-4000-8000-0000000000a1';
  b text := '00000000-0000-4000-8000-0000000000b2';
  c text := '00000000-0000-4000-8000-0000000000c3';
  d text := '00000000-0000-4000-8000-0000000000d4';
  v_row public.commune_operations%ROWTYPE; v_handover jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_op;
  PERFORM public.hand_over_operation(v_op, d, v_row.date, b, current_date, NULL, gen_random_uuid());
  UPDATE public.commune_members SET active = false WHERE commune_id = v_home AND user_id = d;
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_op;
  IF v_row.assignee_id <> b OR v_row.turn_owner_id IS NOT NULL THEN
    RAISE EXCEPTION 'A departed cover did not hand back: %', row_to_json(v_row);
  END IF;

  v_handover := public.hand_over_operation(v_op, c, v_row.date, b, current_date, NULL, gen_random_uuid());
  UPDATE public.commune_members SET active = false WHERE commune_id = v_home AND user_id = b;
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_op;
  IF v_row.assignee_id <> c OR v_row.turn_owner_id IS NOT NULL OR v_row.rotation_ids ? b THEN
    RAISE EXCEPTION 'A departed turn owner was left behind: %', row_to_json(v_row);
  END IF;
  -- The earlier handover cannot be undone onto someone who has left.
  BEGIN
    PERFORM public.undo_operation_occurrence((v_handover->>'id')::uuid);
    RAISE EXCEPTION 'Undo handed a task to a former member';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'Undo handed%' THEN RAISE; END IF;
  END;
END;
$$;

SELECT 'operation_handovers ok';
ROLLBACK;
