-- Who did a task. Anyone in a commune can mark any task done, and the
-- history already recorded who pressed the button, but the task's "last
-- done" credited the person whose turn it was, so a task could be marked
-- done for someone without their name and the tapper's sitting together.
--
-- Marking done a task that someone else holds now has to say who did it:
--   'me'        the person marking it did it, covering the holder's turn
--   'assignee'  the holder did it, and the person marking it says so
-- record_operation_occurrence refuses the completion without an answer.
-- On a task the caller holds, or one nobody holds, no answer is needed.
--
-- last_done names the person who did it (by) and, as well, whoever marked it
-- for them (markedBy) or whose turn they covered (covering). A task held by
-- a name with no account keeps crediting that name, with the person who
-- marked it when that is someone else. Each completion stores the member it
-- credits (done_by_id), and the snapshot's task history carries it as
-- doneById. The rotation moves on exactly as before: from the holder's turn.
--
-- record_operation_occurrence gains an optional p_done_by; a client that
-- calls it without one keeps working on its own tasks. The functions are
-- written out in full, as 0040 left them apart from the done-by parts.
-- Apply after 0040. Release with the matching web client.
BEGIN;

ALTER TABLE public.operation_occurrences
  ADD COLUMN done_by_id text CHECK (done_by_id IS NULL OR length(done_by_id) BETWEEN 1 AND 128);

-- The last completion: who did it, when, and who marked it for them or whose
-- turn they covered.
CREATE OR REPLACE FUNCTION public.valid_operation_last_done(p_last_done jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
    SET search_path TO 'pg_catalog'
    AS $_$
DECLARE
  v_date text;
  v_year integer;
  v_month integer;
  v_day integer;
  v_days_in_month integer;
BEGIN
  IF p_last_done IS NULL THEN
    RETURN true;
  END IF;
  IF jsonb_typeof(p_last_done) <> 'object'
     OR jsonb_typeof(p_last_done->'by') IS DISTINCT FROM 'string'
     OR jsonb_typeof(p_last_done->'date') IS DISTINCT FROM 'string'
     OR length(btrim(p_last_done->>'by')) NOT BETWEEN 1 AND 80 THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_last_done) AS field(key)
    WHERE field.key NOT IN ('by', 'date', 'markedBy', 'covering')
  ) THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(p_last_done) AS field(key, value)
    WHERE field.key IN ('markedBy', 'covering')
      AND (jsonb_typeof(field.value) <> 'string' OR length(btrim(field.value #>> '{}')) NOT BETWEEN 1 AND 80)
  ) THEN
    RETURN false;
  END IF;
  v_date := p_last_done->>'date';
  IF v_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RETURN false;
  END IF;
  v_year := substring(v_date, 1, 4)::integer;
  v_month := substring(v_date, 6, 2)::integer;
  v_day := substring(v_date, 9, 2)::integer;
  IF v_year = 0 OR v_month NOT BETWEEN 1 AND 12 OR v_day < 1 THEN
    RETURN false;
  END IF;
  v_days_in_month := CASE
    WHEN v_month IN (4, 6, 9, 11) THEN 30
    WHEN v_month = 2 THEN CASE
      WHEN mod(v_year, 400) = 0 OR
        (mod(v_year, 4) = 0 AND mod(v_year, 100) <> 0) THEN 29
      ELSE 28 END
    ELSE 31 END;
  RETURN v_day <= v_days_in_month;
END;
$_$;

DROP FUNCTION public.record_operation_occurrence(uuid, text, date, date, uuid, text);
CREATE FUNCTION public.record_operation_occurrence(p_operation_id uuid, p_action text, p_expected_date date, p_today date, p_request_id uuid, p_reason text DEFAULT NULL::text, p_done_by text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_commune_id uuid;
  v_op public.commune_operations%ROWTYPE;
  v_replay public.operation_occurrences%ROWTYPE;
  v_actor_name text;
  v_date date; v_assignee text; v_assignee_id text; v_turn_owner_id text; v_status text; v_last_done jsonb;
  v_id uuid; v_description text; v_reason text;
  v_holder_name text; v_held_by_name text; v_done_by_id text;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to update a task' USING ERRCODE = '22023';
  END IF;
  -- The commune first, then the task, as in update_operation: the order a
  -- member leaving takes them in. The other order lets the two wait on each
  -- other until one fails as a deadlock.
  SELECT commune_id INTO v_commune_id FROM public.commune_operations WHERE id = p_operation_id;
  PERFORM 1 FROM public.communes WHERE id = v_commune_id FOR UPDATE;
  -- The row lock serialises two people acting on the same task.
  SELECT * INTO v_op FROM public.commune_operations WHERE id = p_operation_id FOR UPDATE;
  IF v_op.id IS NULL OR NOT public.is_commune_member(v_op.commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_replay FROM public.operation_occurrences WHERE actor_id = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_replay.operation_id <> p_operation_id OR v_replay.action IS DISTINCT FROM p_action THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    RETURN commune_private.occurrence_result(v_replay.id, true, p_operation_id);
  END IF;
  IF v_op.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This task has been removed' USING ERRCODE = 'P0001';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('completed', 'skipped', 'reopened') THEN
    RAISE EXCEPTION 'Unknown task action' USING ERRCODE = '22023';
  END IF;
  v_reason := commune_private.occurrence_reason(p_reason);
  IF v_reason IS NOT NULL AND p_action <> 'skipped' THEN
    RAISE EXCEPTION 'Only a skip or a handover takes a reason' USING ERRCODE = '22023';
  END IF;
  IF p_done_by IS NOT NULL AND (p_done_by NOT IN ('me', 'assignee') OR p_action <> 'completed') THEN
    RAISE EXCEPTION 'Only marking a task done says who did it: you, or the person who has it' USING ERRCODE = '22023';
  END IF;
  -- A commune has no time zone, so the member's own date decides "today".
  -- It may differ from the server's UTC date by at most one day.
  IF p_today IS NULL OR p_today NOT BETWEEN current_date - 1 AND current_date + 1 THEN
    RAISE EXCEPTION 'Check the date on this device and try again' USING ERRCODE = '22023';
  END IF;
  IF v_op.kind <> 'task' THEN
    RAISE EXCEPTION 'Only tasks can be completed, skipped or reopened' USING ERRCODE = '22023';
  END IF;
  IF p_expected_date IS DISTINCT FROM v_op.date THEN
    RAISE EXCEPTION 'This task has already moved on. Refresh to see who has it now.' USING ERRCODE = 'P0001';
  END IF;
  SELECT coalesce(u.name, 'Member') INTO v_actor_name FROM commune_private.accounts(ARRAY[v_actor]) u;
  v_actor_name := left(coalesce(v_actor_name, 'Member'), 80);
  v_date := v_op.date; v_assignee := v_op.assignee; v_assignee_id := v_op.assignee_id;
  v_turn_owner_id := v_op.turn_owner_id; v_status := v_op.status; v_last_done := v_op.last_done;

  IF p_action = 'completed' THEN
    IF v_op.status <> 'open' THEN
      RAISE EXCEPTION 'This task is already done' USING ERRCODE = 'P0001';
    END IF;
    -- Who did it. Someone else's task needs an answer, so nothing is marked
    -- done for a person without both names on it.
    IF v_op.assignee_id IS NOT NULL THEN
      v_holder_name := commune_private.member_name(v_op.assignee_id);
    END IF;
    IF v_op.assignee_id IS NOT NULL AND v_op.assignee_id <> v_actor THEN
      IF p_done_by IS NULL THEN
        RAISE EXCEPTION 'This is %''s turn. Say whether you did it or they did.', split_part(v_holder_name, ' ', 1) USING ERRCODE = '22023';
      END IF;
      v_done_by_id := CASE p_done_by WHEN 'me' THEN v_actor ELSE v_op.assignee_id END;
    ELSIF p_done_by = 'assignee' AND v_op.assignee_id IS NULL THEN
      RAISE EXCEPTION 'Nobody has this task. Mark it done as yourself.' USING ERRCODE = '22023';
    ELSE
      v_held_by_name := left(nullif(btrim(coalesce(v_op.assignee, '')), ''), 80);
      -- A task held by a name with no account cannot say who that was.
      v_done_by_id := CASE WHEN v_op.assignee_id IS NULL AND v_held_by_name IS NOT NULL THEN NULL ELSE v_actor END;
    END IF;
    v_last_done := CASE
      WHEN v_done_by_id IS NULL THEN jsonb_strip_nulls(jsonb_build_object('by', v_held_by_name, 'date', p_today,
        'markedBy', CASE WHEN v_held_by_name <> v_actor_name THEN v_actor_name END))
      WHEN v_done_by_id <> v_actor THEN jsonb_build_object('by', v_holder_name, 'date', p_today, 'markedBy', v_actor_name)
      WHEN v_op.assignee_id IS NOT NULL AND v_op.assignee_id <> v_actor THEN
        jsonb_build_object('by', v_actor_name, 'date', p_today, 'covering', v_holder_name)
      ELSE jsonb_build_object('by', v_actor_name, 'date', p_today) END;
    IF v_op.repeat = 'none' THEN
      v_status := 'done';
    ELSE
      -- Next occurrence strictly after today.
      LOOP
        IF v_op.repeat = 'weekly' THEN
          v_date := v_date + 7;
        ELSE
          -- Step month by month from the anchor day, clamped to each month's
          -- length, so 31 January goes to 28 February and back to 31 March.
          v_date := (date_trunc('month', v_date) + interval '1 month')::date
            + (least(coalesce(v_op.anchor_day, extract(day FROM v_op.date)::int),
                extract(day FROM (date_trunc('month', v_date) + interval '2 month - 1 day'))::int) - 1);
        END IF;
        EXIT WHEN v_date > p_today;
      END LOOP;
      IF v_op.rotation_ids IS NOT NULL THEN
        -- The turn moves on from whoever's turn it was, not from the person
        -- covering it. Members who have left are passed over.
        v_assignee_id := coalesce(
          commune_private.next_in_rotation(v_op.commune_id, v_op.rotation_ids, coalesce(v_op.turn_owner_id, v_op.assignee_id)),
          v_op.turn_owner_id, v_op.assignee_id);
        v_assignee := CASE WHEN v_assignee_id IS NULL THEN v_op.assignee ELSE commune_private.member_name(v_assignee_id) END;
      ELSIF v_op.turn_owner_id IS NOT NULL THEN
        v_assignee_id := v_op.turn_owner_id;
        v_assignee := commune_private.member_name(v_assignee_id);
      END IF;
    END IF;
    -- A cover lasts for one occurrence.
    v_turn_owner_id := NULL;
    v_description := CASE WHEN v_last_done ? 'markedBy' THEN 'Marked done for ' || (v_last_done->>'by')
        WHEN v_last_done ? 'covering' THEN 'Completed, covering ' || (v_last_done->>'covering')
        ELSE 'Completed' END
      || CASE WHEN v_op.repeat = 'none' THEN ''
        WHEN v_assignee_id IS DISTINCT FROM v_op.assignee_id AND v_assignee IS NOT NULL THEN '. Next: ' || v_assignee
        ELSE '. Next due ' || to_char(v_date, 'FMDD Mon') END;
  ELSIF p_action = 'skipped' THEN
    IF v_op.status <> 'open' OR v_op.repeat = 'none' THEN
      RAISE EXCEPTION 'Only an open repeating task can be skipped' USING ERRCODE = 'P0001';
    END IF;
    v_date := greatest(v_op.date, p_today) + 7;
    v_description := 'Skipped to ' || to_char(v_date, 'FMDD Mon') || coalesce(': ' || v_reason, '');
  ELSE
    IF v_op.status <> 'done' THEN
      RAISE EXCEPTION 'This task is already open' USING ERRCODE = 'P0001';
    END IF;
    v_status := 'open';
    v_description := 'Reopened';
  END IF;

  PERFORM set_config('commune.occurrence_event', 'on', true);
  UPDATE public.commune_operations SET date = v_date, assignee = v_assignee, assignee_id = v_assignee_id,
    turn_owner_id = v_turn_owner_id, status = v_status, last_done = v_last_done, updated_at = now()
    WHERE id = p_operation_id;
  PERFORM set_config('commune.occurrence_event', 'off', true);
  -- clock_timestamp(), taken while the row lock is held, orders occurrences
  -- by when they were recorded rather than when their transaction began.
  INSERT INTO public.operation_occurrences (operation_id, commune_id, action, due_on, assignee, actor_id, acted_on, acted_at, request_id,
      prev_date, prev_assignee, prev_status, prev_last_done, next_date, next_assignee, next_status, next_last_done,
      assignee_id, prev_assignee_id, next_assignee_id, reason, prev_turn_owner_id, next_turn_owner_id, done_by_id)
    VALUES (p_operation_id, v_op.commune_id, p_action, v_op.date, v_op.assignee, v_actor, p_today, clock_timestamp(), p_request_id,
      v_op.date, v_op.assignee, v_op.status, v_op.last_done, v_date, v_assignee, v_status, v_last_done,
      v_op.assignee_id, v_op.assignee_id, v_assignee_id, v_reason, v_op.turn_owner_id, v_turn_owner_id, v_done_by_id)
    RETURNING id INTO v_id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_op.commune_id, v_actor, 'operations', p_operation_id, v_op.title, left(v_description, 240));
  RETURN commune_private.occurrence_result(v_id, false, p_operation_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_operation_occurrence(uuid, text, date, date, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_operation_occurrence(uuid, text, date, date, uuid, text, text) TO authenticated;

-- The task history says who each completion credits.
CREATE OR REPLACE FUNCTION commune_private.snapshot_operations(p_commune_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  WITH names AS MATERIALIZED (SELECT commune_private.member_names(p_commune_id) AS map)
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'hubId',o.commune_id,'kind',o.kind,'category',o.category,'title',o.title,'date',o.date,'time',o.time,'allDay',o.all_day,
      'version',o.version,'createdBy',o.created_by,
      'assignee',CASE WHEN o.assignee_id IS NULL THEN o.assignee ELSE coalesce(names.map->>o.assignee_id, commune_private.member_name(o.assignee_id)) END,
      'assigneeId',o.assignee_id,
      'turnOwnerId',o.turn_owner_id,
      'turnOwner',CASE WHEN o.turn_owner_id IS NULL THEN NULL ELSE coalesce(names.map->>o.turn_owner_id, commune_private.member_name(o.turn_owner_id)) END,
      'rotation',CASE WHEN o.rotation_ids IS NULL THEN o.rotation ELSE
        (SELECT jsonb_agg(coalesce(names.map->>e.value, commune_private.member_name(e.value)) ORDER BY e.ord) FROM jsonb_array_elements_text(o.rotation_ids) WITH ORDINALITY e(value, ord)) END,
      'rotationIds',o.rotation_ids,
      'lastDone',o.last_done,'repeat',o.repeat,'anchorDay',o.anchor_day,'status',o.status,'notes',o.notes,
      -- The latest action, only while the task is still exactly as it left it.
      'undoOccurrenceId',(SELECT u.id FROM public.operation_occurrences u WHERE u.operation_id=o.id AND u.undone_at IS NULL
        AND u.next_date=o.date AND u.next_assignee_id IS NOT DISTINCT FROM o.assignee_id
        AND (o.assignee_id IS NOT NULL OR u.next_assignee IS NOT DISTINCT FROM o.assignee)
        AND u.next_turn_owner_id IS NOT DISTINCT FROM o.turn_owner_id
        AND u.next_status=o.status AND u.next_last_done IS NOT DISTINCT FROM o.last_done
        AND NOT EXISTS(SELECT 1 FROM public.operation_occurrences later WHERE later.operation_id=o.id AND later.undone_at IS NULL AND later.id<>u.id AND later.acted_at>=u.acted_at)
        ORDER BY u.acted_at DESC LIMIT 1),
      'history',coalesce((SELECT jsonb_agg(jsonb_build_object('id',h.id,'action',h.action,'dueOn',h.due_on,
          'assignee',CASE WHEN h.assignee_id IS NULL THEN h.assignee ELSE coalesce(names.map->>h.assignee_id, commune_private.member_name(h.assignee_id)) END,'assigneeId',h.assignee_id,
          'actorId',h.actor_id,'actedOn',h.acted_on,'actedAt',h.acted_at,'nextDate',h.next_date,
          'nextAssignee',CASE WHEN h.next_assignee_id IS NULL THEN h.next_assignee ELSE coalesce(names.map->>h.next_assignee_id, commune_private.member_name(h.next_assignee_id)) END,'nextAssigneeId',h.next_assignee_id,
          'reason',h.reason,'doneById',h.done_by_id,
          'undoneAt',h.undone_at,'undoneBy',h.undone_by) ORDER BY h.acted_at DESC, h.id)
        FROM (SELECT * FROM public.operation_occurrences x WHERE x.operation_id=o.id ORDER BY x.acted_at DESC, x.id LIMIT 12) h),'[]'::jsonb)
    ) ORDER BY o.date,o.time),'[]'::jsonb)
    FROM public.commune_operations o CROSS JOIN names WHERE o.commune_id=p_commune_id AND o.deleted_at IS NULL;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
