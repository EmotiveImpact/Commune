-- Notes and tasks through commands (0027). Run only in an empty disposable
-- local DB built from infra/local/bootstrap.sql, every migration and
-- after-core.sql (app_auth stands in for Neon Auth). Everything is rolled back.
BEGIN;

DO $$
DECLARE v_home uuid; v_cap uuid;
BEGIN
  INSERT INTO app_auth.users (id, name, email, email_verified)
    VALUES ('00000000-0000-4000-8000-0000000000a1', 'Avery', 'avery@content.test', true),
           ('00000000-0000-4000-8000-0000000000b2', 'Blake', 'blake@content.test', true),
           ('00000000-0000-4000-8000-0000000000c3', 'Casey', 'casey@content.test', true),
           ('00000000-0000-4000-8000-0000000000d4', 'Dana', 'dana@content.test', true),
           ('00000000-0000-4000-8000-0000000000e5', 'Eve', 'eve@content.test', true);
  -- Avery made the commune (admin). Blake and Dana are members; Casey is an
  -- admin. Eve is in another commune.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000a1', 'role', 'authenticated')::text, true);
  v_home := public.create_commune('Content home', 'household', 'GBP');
  v_cap := public.create_commune('Busy home', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role)
    VALUES (v_home, '00000000-0000-4000-8000-0000000000b2', 'member'), (v_home, '00000000-0000-4000-8000-0000000000c3', 'admin'),
           (v_home, '00000000-0000-4000-8000-0000000000d4', 'member');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000e5', 'role', 'authenticated')::text, true);
  PERFORM public.create_commune('Elsewhere', 'household', 'GBP');
  PERFORM set_config('test.home', v_home::text, true);
  PERFORM set_config('test.cap', v_cap::text, true);
END;
$$;

SET ROLE authenticated;
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  a text := '00000000-0000-4000-8000-0000000000a1';
  b text := '00000000-0000-4000-8000-0000000000b2';
  d text := '00000000-0000-4000-8000-0000000000d4';
  v_request uuid := gen_random_uuid(); v_task_request uuid := gen_random_uuid();
  v_result jsonb; v_note uuid; v_task uuid; v_once uuid; v_row public.commune_operations%ROWTYPE; v_before public.commune_operations%ROWTYPE;
  v_case text;
BEGIN
  -- A plain member can no longer write either table directly.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  v_note := (public.create_note(v_home, 'Wi-Fi', 'Wi-Fi', 'Everyone', '', '', '[["Network", "Home"]]', gen_random_uuid())->>'id')::uuid;
  v_task := (public.create_operation(v_home, 'task', 'chore', 'Probe', current_date, NULL, true, b, NULL, 'none', '', gen_random_uuid())->>'id')::uuid;
  FOREACH v_case IN ARRAY ARRAY['note insert', 'note update', 'note delete', 'task insert', 'task update', 'task delete', 'task status'] LOOP
    BEGIN
      CASE v_case
        WHEN 'note insert' THEN INSERT INTO public.commune_notes (commune_id, title, created_by) VALUES (v_home, 'Sneaky', b);
        WHEN 'note update' THEN UPDATE public.commune_notes SET title = 'Sneaky' WHERE id = v_note;
        WHEN 'note delete' THEN DELETE FROM public.commune_notes WHERE id = v_note;
        WHEN 'task insert' THEN INSERT INTO public.commune_operations (commune_id, kind, category, title, date, created_by)
          VALUES (v_home, 'task', 'chore', 'Sneaky', current_date, b);
        WHEN 'task update' THEN UPDATE public.commune_operations SET title = 'Sneaky' WHERE id = v_task;
        WHEN 'task delete' THEN DELETE FROM public.commune_operations WHERE id = v_task;
        ELSE UPDATE public.commune_operations SET status = 'done', last_done = NULL, updated_at = now() WHERE id = v_task;
      END CASE;
      RAISE EXCEPTION 'Direct write was accepted: %', v_case;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;

  -- Adding: a retry returns the same note, even after it was edited; the
  -- same request id with different content is refused; one is required.
  v_result := public.create_note(v_home, '  Bins  ', 'Bins', 'Everyone', 'Tuesday night', 'Tuesday night, alley', '[["Collection", "Tuesday"]]', v_request);
  v_note := (v_result->>'id')::uuid;
  IF (v_result->>'duplicate')::boolean OR (v_result->>'version')::int <> 1 THEN RAISE EXCEPTION 'New note result is wrong: %', v_result; END IF;
  v_result := public.create_note(v_home, 'Bins', 'Bins', 'Everyone', 'Tuesday night', 'Tuesday night, alley', '[["Collection", "Tuesday"]]', v_request);
  IF (v_result->>'id')::uuid <> v_note OR NOT (v_result->>'duplicate')::boolean THEN RAISE EXCEPTION 'Note retry was not recognised: %', v_result; END IF;
  FOREACH v_case IN ARRAY ARRAY['different', 'missing'] LOOP
    BEGIN
      PERFORM public.create_note(v_home, 'Bins', 'Bins', 'Everyone', 'Tuesday night', CASE v_case WHEN 'different' THEN 'Wednesday' ELSE 'Tuesday night, alley' END,
        '[["Collection", "Tuesday"]]', CASE v_case WHEN 'missing' THEN NULL ELSE v_request END);
      RAISE EXCEPTION 'Note add was not refused: %', v_case;
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
  END LOOP;
  PERFORM public.update_note(v_note, 1, 'Bins', 'Bins', 'Everyone', 'Tuesday night', 'Tuesday night, by the gate', '[["Collection", "Tuesday"]]');
  v_result := public.create_note(v_home, 'Bins', 'Bins', 'Everyone', 'Tuesday night', 'Tuesday night, alley', '[["Collection", "Tuesday"]]', v_request);
  IF (v_result->>'id')::uuid <> v_note OR NOT (v_result->>'duplicate')::boolean THEN RAISE EXCEPTION 'Note retry after an edit was refused: %', v_result; END IF;
  IF (SELECT count(*) FROM public.commune_notes WHERE commune_id = v_home AND title = 'Bins') <> 1 THEN RAISE EXCEPTION 'A retry added a second note'; END IF;

  v_result := public.create_operation(v_home, 'task', 'chore', 'Water the plants', current_date, '09:00', false, b, jsonb_build_array(b, d), 'weekly', '', v_task_request);
  v_task := (v_result->>'id')::uuid;
  IF (public.create_operation(v_home, 'task', 'chore', 'Water the plants ', current_date, '09:00', false, b, jsonb_build_array(b, d), 'weekly', '', v_task_request)->>'id')::uuid <> v_task THEN
    RAISE EXCEPTION 'Task retry was not recognised';
  END IF;
  BEGIN
    PERFORM public.create_operation(v_home, 'task', 'chore', 'Water the garden', current_date, '09:00', false, b, jsonb_build_array(b, d), 'weekly', '', v_task_request);
    RAISE EXCEPTION 'Reused task request was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  -- A new task is open, not yet done and at version 1, whatever was sent.
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_task;
  IF v_row.status <> 'open' OR v_row.last_done IS NOT NULL OR v_row.version <> 1 OR v_row.created_by <> b
     OR v_row.assignee <> 'Blake' OR v_row.rotation <> '["Blake","Dana"]'::jsonb THEN
    RAISE EXCEPTION 'New task is wrong: %', row_to_json(v_row);
  END IF;

  -- Note versions: an unchanged save keeps the version; a stale edit is
  -- refused; a retry of an edit that went through is recognised.
  v_result := public.update_note(v_note, 2, 'Bins', 'Bins', 'Everyone', 'Tuesday night', 'Tuesday night, by the gate', '[["Collection", "Tuesday"]]');
  IF NOT (v_result->>'duplicate')::boolean OR (v_result->>'version')::int <> 2 THEN RAISE EXCEPTION 'Unchanged save moved the version: %', v_result; END IF;
  BEGIN
    PERFORM public.update_note(v_note, 1, 'Bins', 'Bins', 'Everyone', 'Tuesday night', 'Black bags only', '[["Collection", "Tuesday"]]');
    RAISE EXCEPTION 'Stale note edit was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'This note was changed by someone else.%' THEN RAISE; END IF;
  END;
  v_result := public.update_note(v_note, 2, 'Bins', 'Bins', 'Everyone', 'Tuesday night', 'Black bags only', '[["Collection", "Tuesday"]]');
  IF (v_result->>'duplicate')::boolean OR (v_result->>'version')::int <> 3 THEN RAISE EXCEPTION 'Note edit result is wrong: %', v_result; END IF;
  v_result := public.update_note(v_note, 2, 'Bins', 'Bins', 'Everyone', 'Tuesday night', 'Black bags only', '[["Collection", "Tuesday"]]');
  IF NOT (v_result->>'duplicate')::boolean OR (v_result->>'version')::int <> 3 THEN RAISE EXCEPTION 'Note edit retry was not recognised: %', v_result; END IF;
  BEGIN
    PERFORM public.update_note(v_note, NULL, 'Bins', 'Bins', 'Everyone', '', 'Anything', '[]');
    RAISE EXCEPTION 'A note edit without a version was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  IF (SELECT count(*) FROM public.note_revisions WHERE note_id = v_note) <> 2
     OR (SELECT count(*) FROM public.commune_events WHERE entity_id = v_note AND description = 'Updated') <> 2
     OR (SELECT count(*) FROM public.commune_events WHERE entity_id = v_note AND description = 'Created') <> 1 THEN
    RAISE EXCEPTION 'Note history is wrong';
  END IF;

  -- Every change to a task moves its version, completion included. An edit
  -- opened before a completion is refused and the completion stays.
  v_result := public.record_operation_occurrence(v_task, 'completed', current_date, current_date, gen_random_uuid());
  SELECT * INTO v_before FROM public.commune_operations WHERE id = v_task;
  IF v_before.version <> 2 OR v_before.date <> current_date + 7 OR v_before.assignee_id <> d THEN
    RAISE EXCEPTION 'Completion did not move the task on: %', row_to_json(v_before);
  END IF;
  BEGIN
    PERFORM public.update_operation(v_task, 1, 'task', 'chore', 'Water the plants and herbs', current_date, '09:00', false, b, jsonb_build_array(b, d), 'weekly', '');
    RAISE EXCEPTION 'Stale task edit was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'This task was changed by someone else.%' THEN RAISE; END IF;
  END;
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_task;
  IF row_to_json(v_row)::jsonb <> row_to_json(v_before)::jsonb THEN RAISE EXCEPTION 'A refused edit changed the task'; END IF;
  -- A skip, a handover and an undo also make an open edit stale.
  PERFORM public.record_operation_occurrence(v_task, 'skipped', current_date + 7, current_date, gen_random_uuid());
  v_result := public.hand_over_operation(v_task, a, current_date + 14, d, current_date, NULL, gen_random_uuid());
  PERFORM public.undo_operation_occurrence((v_result->>'id')::uuid);
  IF (SELECT version FROM public.commune_operations WHERE id = v_task) <> 5 THEN RAISE EXCEPTION 'Occurrences did not move the version'; END IF;
  -- An edit from the latest version goes through; saving it again is a no-op.
  v_result := public.update_operation(v_task, 5, 'task', 'chore', 'Water the plants and herbs', current_date + 14, '09:00', false, d, jsonb_build_array(b, d), 'weekly', 'Front room too');
  IF (v_result->>'duplicate')::boolean OR (v_result->>'version')::int <> 6 THEN RAISE EXCEPTION 'Task edit result is wrong: %', v_result; END IF;
  v_result := public.update_operation(v_task, 5, 'task', 'chore', 'Water the plants and herbs', current_date + 14, '09:00', false, d, jsonb_build_array(b, d), 'weekly', 'Front room too');
  IF NOT (v_result->>'duplicate')::boolean OR (v_result->>'version')::int <> 6 THEN RAISE EXCEPTION 'Task edit retry was not recognised: %', v_result; END IF;
  IF (SELECT count(*) FROM public.commune_events WHERE entity_id = v_task AND description = 'Updated') <> 1 THEN
    RAISE EXCEPTION 'Task edits wrote the wrong activity';
  END IF;

  -- An edit cannot set status, completion or timestamps: there is no such
  -- argument, and a finished task stays finished when its details change.
  IF EXISTS (SELECT 1 FROM pg_proc p, unnest(p.proargnames) n
      WHERE p.oid IN ('public.create_operation(uuid,text,text,text,date,time,boolean,text,jsonb,text,text,uuid)'::regprocedure,
        'public.update_operation(uuid,integer,text,text,text,date,time,boolean,text,jsonb,text,text)'::regprocedure,
        'public.create_note(uuid,text,text,text,text,text,jsonb,uuid)'::regprocedure,
        'public.update_note(uuid,integer,text,text,text,text,text,jsonb)'::regprocedure)
        AND (n LIKE '%status%' OR n LIKE '%done%' OR n LIKE '%\_at' OR n IN ('p_version', 'p_created_by', 'p_updated_by'))) THEN
    RAISE EXCEPTION 'A command accepts status, completion or timestamps';
  END IF;
  v_once := (public.create_operation(v_home, 'task', 'chore', 'Return the keys', current_date, NULL, true, b, NULL, 'none', '', gen_random_uuid())->>'id')::uuid;
  PERFORM public.record_operation_occurrence(v_once, 'completed', current_date, current_date, gen_random_uuid());
  SELECT * INTO v_before FROM public.commune_operations WHERE id = v_once;
  PERFORM public.update_operation(v_once, v_before.version, 'task', 'chore', 'Return both keys', current_date + 1, '18:30', false, b, NULL, 'none', 'To the agent');
  SELECT * INTO v_row FROM public.commune_operations WHERE id = v_once;
  IF v_row.status <> 'done' OR v_row.last_done IS DISTINCT FROM v_before.last_done OR v_row.created_at <> v_before.created_at
     OR v_row.updated_at <> now() OR v_row.title <> 'Return both keys' OR v_row.time <> '18:30' THEN
    RAISE EXCEPTION 'An edit changed the task''s state: %', row_to_json(v_row);
  END IF;
  PERFORM set_config('test.note', v_note::text, true);
  PERFORM set_config('test.task', v_task::text, true);
END;
$$;

-- Removing: the person who added it or an admin, nobody else. The row and
-- its history stay, with one activity line, and both leave every view.
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  v_note uuid := current_setting('test.note')::uuid;
  v_task uuid := current_setting('test.task')::uuid;
  b text := '00000000-0000-4000-8000-0000000000b2';
  c text := '00000000-0000-4000-8000-0000000000c3';
  d text := '00000000-0000-4000-8000-0000000000d4';
  e text := '00000000-0000-4000-8000-0000000000e5';
  v_zebra_note uuid; v_zebra_task uuid; v_dana_task uuid; v_result jsonb; v_case text; v_snapshot jsonb;
  v_note_request uuid := gen_random_uuid(); v_event_request uuid := gen_random_uuid(); v_task_request uuid := gen_random_uuid();
  v_occurrence uuid;
BEGIN
  -- Blake, a plain member, adds a note, an event and a task for Dana.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  v_zebra_note := (public.create_note(v_home, 'Zebra crossing', 'Other', 'Everyone', '', 'By the school', '[]', v_note_request)->>'id')::uuid;
  v_zebra_task := (public.create_operation(v_home, 'event', 'visit', 'Zebra visit', current_date, NULL, true, NULL, NULL, 'none', '', v_event_request)->>'id')::uuid;
  v_dana_task := (public.create_operation(v_home, 'task', 'chore', 'Zebra mural', current_date, NULL, true, d, NULL, 'none', '', v_task_request)->>'id')::uuid;
  IF (public.search_commune_records('Zebra', v_home, 8)->>'total')::int <> 3 THEN RAISE EXCEPTION 'Search did not find the new records'; END IF;

  -- Dana, a plain member who did not add them, cannot remove Blake's.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  FOREACH v_case IN ARRAY ARRAY['zebra note', 'zebra task', 'bins note', 'plants task'] LOOP
    BEGIN
      CASE v_case
        WHEN 'zebra note' THEN PERFORM public.remove_note(v_zebra_note);
        WHEN 'zebra task' THEN PERFORM public.remove_operation(v_zebra_task);
        WHEN 'bins note' THEN PERFORM public.remove_note(v_note);
        ELSE PERFORM public.remove_operation(v_task);
      END CASE;
      RAISE EXCEPTION 'A member removed someone else''s record: %', v_case;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
  -- Neither can someone outside the commune, nor change anything in it.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  FOREACH v_case IN ARRAY ARRAY['remove note', 'remove task', 'edit note', 'edit task', 'add note', 'add task'] LOOP
    BEGIN
      CASE v_case
        WHEN 'remove note' THEN PERFORM public.remove_note(v_zebra_note);
        WHEN 'remove task' THEN PERFORM public.remove_operation(v_zebra_task);
        WHEN 'edit note' THEN PERFORM public.update_note(v_note, 3, 'Mine', '', '', '', '', '[]');
        WHEN 'edit task' THEN PERFORM public.update_operation(v_zebra_task, 1, 'event', 'visit', 'Mine', current_date, NULL, true, NULL, NULL, 'none', '');
        WHEN 'add note' THEN PERFORM public.create_note(v_home, 'Mine', '', '', '', '', '[]', gen_random_uuid());
        ELSE PERFORM public.create_operation(v_home, 'event', 'visit', 'Mine', current_date, NULL, true, NULL, NULL, 'none', '', gen_random_uuid());
      END CASE;
      RAISE EXCEPTION 'An outsider could %', v_case;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;

  -- Until then, members read the note's earlier versions and the task's history.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  IF (SELECT count(*) FROM public.note_revisions WHERE note_id = v_note) <> 2
     OR (SELECT count(*) FROM public.operation_occurrences WHERE operation_id = v_task) <> 3 THEN
    RAISE EXCEPTION 'A member cannot read the history before removal';
  END IF;
  v_occurrence := (SELECT id FROM public.operation_occurrences WHERE operation_id = v_task AND undone_at IS NULL ORDER BY acted_at DESC LIMIT 1);

  -- Blake removes his own; Casey, an admin, removes anyone's.
  v_result := public.remove_note(v_zebra_note);
  IF (v_result->>'duplicate')::boolean THEN RAISE EXCEPTION 'First removal reported as a repeat'; END IF;
  IF NOT (public.remove_note(v_zebra_note)->>'duplicate')::boolean THEN RAISE EXCEPTION 'Second removal was not a no-op'; END IF;
  PERFORM public.remove_operation(v_zebra_task);
  PERFORM public.remove_operation(v_dana_task);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  PERFORM public.remove_note(v_note);
  PERFORM public.remove_operation(v_task);
  IF NOT (public.remove_operation(v_task)->>'duplicate')::boolean THEN RAISE EXCEPTION 'Second task removal was not a no-op'; END IF;

  -- Gone from the snapshot, search and a direct read, history included.
  v_snapshot := public.commune_snapshot(v_home);
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_snapshot->'notes') x WHERE (x->>'id')::uuid IN (v_note, v_zebra_note))
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_snapshot->'operations') x WHERE (x->>'id')::uuid IN (v_task, v_zebra_task, v_dana_task)) THEN
    RAISE EXCEPTION 'A removed record is still in the snapshot';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_snapshot->'operations') x WHERE x->>'title' = 'Return both keys' AND (x->>'version')::int = 3 AND x->>'createdBy' = b) THEN
    RAISE EXCEPTION 'The snapshot lost a task or its version: %', v_snapshot->'operations';
  END IF;
  IF (public.search_commune_records('Zebra', v_home, 8)->>'total')::int <> 0 OR (public.search_commune_records('Bins', v_home, 8)->>'total')::int <> 0
     OR (public.search_commune_records('Water the plants', v_home, 8)->>'total')::int <> 0 THEN
    RAISE EXCEPTION 'Search still finds removed records';
  END IF;
  IF EXISTS (SELECT 1 FROM public.commune_notes WHERE id IN (v_note, v_zebra_note))
     OR EXISTS (SELECT 1 FROM public.commune_operations WHERE id IN (v_task, v_zebra_task, v_dana_task)) THEN
    RAISE EXCEPTION 'A member can still read a removed record';
  END IF;
  -- A removed note's earlier versions (an old door code, say) and a removed
  -- task's history are not shown to anyone, the admin who removed them included.
  IF EXISTS (SELECT 1 FROM public.note_revisions WHERE note_id = v_note)
     OR EXISTS (SELECT 1 FROM public.operation_occurrences WHERE operation_id = v_task) THEN
    RAISE EXCEPTION 'A removed record''s history can still be read';
  END IF;
  IF (SELECT count(*) FROM public.commune_events WHERE entity_id IN (v_note, v_zebra_note, v_task, v_zebra_task, v_dana_task) AND description = 'Removed') <> 5
     OR NOT EXISTS (SELECT 1 FROM public.commune_events WHERE entity_id = v_task AND description = 'Removed' AND actor_id = c AND title = 'Water the plants and herbs') THEN
    RAISE EXCEPTION 'Removing did not write one activity line each';
  END IF;

  -- A removed record cannot be edited, completed, skipped, handed over or undone.
  FOREACH v_case IN ARRAY ARRAY['edit note', 'edit task', 'complete', 'skip', 'hand over', 'undo'] LOOP
    BEGIN
      CASE v_case
        WHEN 'edit note' THEN PERFORM public.update_note(v_note, 3, 'Bins', 'Bins', 'Everyone', '', 'Changed', '[]');
        WHEN 'edit task' THEN PERFORM public.update_operation(v_task, 7, 'task', 'chore', 'Changed', current_date, NULL, true, NULL, NULL, 'none', '');
        WHEN 'complete' THEN PERFORM public.record_operation_occurrence(v_task, 'completed', current_date + 14, current_date, gen_random_uuid());
        WHEN 'skip' THEN PERFORM public.record_operation_occurrence(v_task, 'skipped', current_date + 14, current_date, gen_random_uuid());
        WHEN 'hand over' THEN PERFORM public.hand_over_operation(v_task, b, current_date + 14, d, current_date, NULL, gen_random_uuid());
        ELSE PERFORM public.undo_operation_occurrence(v_occurrence);
      END CASE;
      RAISE EXCEPTION 'A removed record accepted: %', v_case;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT IN ('This note has been removed', 'This task has been removed') THEN RAISE; END IF;
    END;
  END LOOP;

  -- Blake retries his adds after they were removed: each is refused rather
  -- than handing back the hidden record. The history stays out of his sight.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  FOREACH v_case IN ARRAY ARRAY['note', 'event', 'task'] LOOP
    BEGIN
      CASE v_case
        WHEN 'note' THEN v_result := public.create_note(v_home, 'Zebra crossing', 'Other', 'Everyone', '', 'By the school', '[]', v_note_request);
        WHEN 'event' THEN v_result := public.create_operation(v_home, 'event', 'visit', 'Zebra visit', current_date, NULL, true, NULL, NULL, 'none', '', v_event_request);
        ELSE v_result := public.create_operation(v_home, 'task', 'chore', 'Zebra mural', current_date, NULL, true, d, NULL, 'none', '', v_task_request);
      END CASE;
      RAISE EXCEPTION 'A retried add returned a removed %: %', v_case, v_result;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> format('This %s has been removed', v_case) THEN RAISE; END IF;
    END;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.note_revisions WHERE note_id = v_note)
     OR EXISTS (SELECT 1 FROM public.operation_occurrences WHERE operation_id = v_task) THEN
    RAISE EXCEPTION 'A member can still read a removed record''s history';
  END IF;
  PERFORM set_config('test.dana_task', v_dana_task::text, true);
END;
$$;

-- As the owner: removed rows and their history are kept, with who removed
-- them. When Dana leaves, a removed task of hers is left alone and adds no
-- history line.
RESET ROLE;
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  v_dana_task uuid := current_setting('test.dana_task')::uuid;
BEGIN
  IF (SELECT count(*) FROM public.commune_notes WHERE commune_id = v_home AND deleted_at IS NOT NULL AND deleted_by IS NOT NULL) <> 2
     OR (SELECT count(*) FROM public.commune_operations WHERE commune_id = v_home AND deleted_at IS NOT NULL AND deleted_by IS NOT NULL) <> 3 THEN
    RAISE EXCEPTION 'Removed rows were not kept';
  END IF;
  IF (SELECT count(*) FROM public.note_revisions WHERE note_id = current_setting('test.note')::uuid) <> 2
     OR (SELECT count(*) FROM public.operation_occurrences WHERE operation_id = current_setting('test.task')::uuid) <> 3 THEN
    RAISE EXCEPTION 'Removing lost the history';
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000a1', 'role', 'authenticated')::text, true);
  UPDATE public.commune_members SET active = false WHERE commune_id = v_home AND user_id = '00000000-0000-4000-8000-0000000000d4';
  IF (SELECT assignee_id FROM public.commune_operations WHERE id = v_dana_task) <> '00000000-0000-4000-8000-0000000000d4'
     OR EXISTS (SELECT 1 FROM public.commune_events WHERE entity_id = v_dana_task AND description LIKE 'Dana left.%') THEN
    RAISE EXCEPTION 'A departure changed a removed task';
  END IF;

  -- Fill the busy commune to one below each limit.
  INSERT INTO public.commune_notes (commune_id, title, created_by)
    SELECT current_setting('test.cap')::uuid, 'Note ' || i, '00000000-0000-4000-8000-0000000000a1' FROM generate_series(1, 499) i;
  INSERT INTO public.commune_operations (commune_id, kind, category, title, date, created_by)
    SELECT current_setting('test.cap')::uuid, 'event', 'visit', 'Visit ' || i, current_date, '00000000-0000-4000-8000-0000000000a1' FROM generate_series(1, 999) i;
END;
$$;

-- Limits: 500 notes and 1,000 tasks and events that are not removed.
SET ROLE authenticated;
DO $$
DECLARE
  v_cap uuid := current_setting('test.cap')::uuid;
  v_last_note uuid; v_last_task uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000a1', 'role', 'authenticated')::text, true);
  v_last_note := (public.create_note(v_cap, 'Note 500', '', '', '', 'The last one', '[]', gen_random_uuid())->>'id')::uuid;
  v_last_task := (public.create_operation(v_cap, 'event', 'visit', 'Visit 1000', current_date, NULL, true, NULL, NULL, 'none', '', gen_random_uuid())->>'id')::uuid;
  BEGIN
    PERFORM public.create_note(v_cap, 'Note 501', '', '', '', 'One too many', '[]', gen_random_uuid());
    RAISE EXCEPTION 'A 501st note was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'This commune already has 500 notes. Remove one you no longer need first.' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.create_operation(v_cap, 'event', 'visit', 'Visit 1001', current_date, NULL, true, NULL, NULL, 'none', '', gen_random_uuid());
    RAISE EXCEPTION 'A 1,001st task was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'This commune already has 1,000 tasks and events. Remove some you no longer need first.' THEN RAISE; END IF;
  END;
  -- Removing one makes room again.
  PERFORM public.remove_note(v_last_note);
  PERFORM public.remove_operation(v_last_task);
  PERFORM public.create_note(v_cap, 'Note 501', '', '', '', 'Room again', '[]', gen_random_uuid());
  PERFORM public.create_operation(v_cap, 'event', 'visit', 'Visit 1001', current_date, NULL, true, NULL, NULL, 'none', '', gen_random_uuid());
END;
$$;

RESET ROLE;
SELECT 'note_and_task_commands ok';
ROLLBACK;
