-- Task occurrences: completing, skipping or reopening a task is recorded with
-- who did it and the exact state before and after, so the latest action can
-- be undone and repeats/rotation are restored precisely. The database, not
-- the browser, now advances the date and the rotation, and an expected-date
-- check stops two people completing the same occurrence twice.
-- Apply after 0017. Release with the matching web client.
BEGIN;

CREATE TABLE public.operation_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES public.commune_operations(id) ON DELETE CASCADE,
  commune_id uuid NOT NULL REFERENCES public.communes(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('completed', 'skipped', 'reopened')),
  -- The occurrence that was acted on and who held it at the time.
  due_on date NOT NULL,
  assignee text,
  actor_id text NOT NULL,
  -- The actor's local calendar date; acted_at is the server clock.
  acted_on date NOT NULL,
  acted_at timestamptz NOT NULL DEFAULT now(),
  request_id uuid NOT NULL,
  prev_date date NOT NULL, prev_assignee text, prev_status text NOT NULL, prev_last_done jsonb,
  next_date date NOT NULL, next_assignee text, next_status text NOT NULL, next_last_done jsonb,
  undone_at timestamptz,
  undone_by text,
  CHECK ((undone_at IS NULL) = (undone_by IS NULL)),
  UNIQUE (actor_id, request_id)
);
CREATE INDEX operation_occurrences_operation_idx
  ON public.operation_occurrences (operation_id, acted_at DESC);
ALTER TABLE public.operation_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY operation_occurrence_read ON public.operation_occurrences FOR SELECT TO authenticated
  USING (public.is_commune_member(commune_id));
GRANT SELECT ON public.operation_occurrences TO authenticated;
-- Deliberately no write grant: occurrences are written only by the RPCs below.

-- These RPCs write their own precise history line. Let the generic change
-- trigger stand down for that one update instead of adding a vague "Updated".
DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('commune_private.record_commune_change()'::regprocedure);
  v_source := replace(v_original, 'v_kind:=CASE TG_TABLE_NAME WHEN ''fund_commitments''',
    'IF TG_TABLE_NAME=''commune_operations'' AND current_setting(''commune.occurrence_event'', true)=''on'' THEN RETURN NEW; END IF;
  v_kind:=CASE TG_TABLE_NAME WHEN ''fund_commitments''');
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported change history definition'; END IF;
  EXECUTE v_source;
END;
$$;

CREATE FUNCTION commune_private.occurrence_result(p_id uuid, p_duplicate boolean, p_operation_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object('id', p_id, 'duplicate', p_duplicate, 'date', o.date, 'assignee', o.assignee, 'status', o.status)
  FROM public.commune_operations o WHERE o.id = p_operation_id;
$$;
REVOKE ALL ON FUNCTION commune_private.occurrence_result(uuid, boolean, uuid) FROM PUBLIC;

CREATE FUNCTION public.record_operation_occurrence(p_operation_id uuid, p_action text,
  p_expected_date date, p_today date, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_op public.commune_operations%ROWTYPE;
  v_replay public.operation_occurrences%ROWTYPE;
  v_actor_name text;
  v_date date; v_assignee text; v_status text; v_last_done jsonb;
  v_position bigint; v_id uuid; v_description text;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to update a task' USING ERRCODE = '22023';
  END IF;
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
  IF p_action IS NULL OR p_action NOT IN ('completed', 'skipped', 'reopened') THEN
    RAISE EXCEPTION 'Unknown task action' USING ERRCODE = '22023';
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
  SELECT coalesce(u.name, 'Member') INTO v_actor_name FROM neon_auth."user" u WHERE u.id::text = v_actor;
  v_actor_name := left(coalesce(v_actor_name, 'Member'), 80);
  v_date := v_op.date; v_assignee := v_op.assignee; v_status := v_op.status; v_last_done := v_op.last_done;

  IF p_action = 'completed' THEN
    IF v_op.status <> 'open' THEN
      RAISE EXCEPTION 'This task is already done' USING ERRCODE = 'P0001';
    END IF;
    IF v_op.repeat = 'none' THEN
      v_status := 'done';
      v_last_done := jsonb_build_object('by', v_actor_name, 'date', p_today);
    ELSE
      -- Next occurrence strictly after today; a month end stays a month end.
      LOOP
        v_date := CASE WHEN v_op.repeat = 'weekly' THEN v_date + 7 ELSE (v_date + interval '1 month')::date END;
        EXIT WHEN v_date > p_today;
      END LOOP;
      IF jsonb_typeof(v_op.rotation) = 'array' AND jsonb_array_length(v_op.rotation) > 0 THEN
        SELECT r.ord INTO v_position FROM jsonb_array_elements_text(v_op.rotation) WITH ORDINALITY AS r(name, ord)
          WHERE r.name = v_op.assignee ORDER BY r.ord LIMIT 1;
        v_assignee := v_op.rotation ->> (coalesce(v_position, 0) % jsonb_array_length(v_op.rotation))::integer;
      END IF;
      v_last_done := jsonb_build_object('by', coalesce(nullif(btrim(v_op.assignee), ''), v_actor_name), 'date', p_today);
    END IF;
    v_description := CASE WHEN v_op.repeat = 'none' THEN 'Completed'
      WHEN v_assignee IS DISTINCT FROM v_op.assignee AND v_assignee IS NOT NULL THEN 'Completed. Next: ' || v_assignee
      ELSE 'Completed. Next due ' || to_char(v_date, 'FMDD Mon') END;
  ELSIF p_action = 'skipped' THEN
    IF v_op.status <> 'open' OR v_op.repeat = 'none' THEN
      RAISE EXCEPTION 'Only an open repeating task can be skipped' USING ERRCODE = 'P0001';
    END IF;
    v_date := greatest(v_op.date, p_today) + 7;
    v_description := 'Skipped to ' || to_char(v_date, 'FMDD Mon');
  ELSE
    IF v_op.status <> 'done' THEN
      RAISE EXCEPTION 'This task is already open' USING ERRCODE = 'P0001';
    END IF;
    v_status := 'open';
    v_description := 'Reopened';
  END IF;

  PERFORM set_config('commune.occurrence_event', 'on', true);
  UPDATE public.commune_operations SET date = v_date, assignee = v_assignee, status = v_status,
    last_done = v_last_done, updated_at = now() WHERE id = p_operation_id;
  PERFORM set_config('commune.occurrence_event', 'off', true);
  -- clock_timestamp(), taken while the row lock is held, orders occurrences
  -- by when they were recorded rather than when their transaction began.
  INSERT INTO public.operation_occurrences (operation_id, commune_id, action, due_on, assignee, actor_id, acted_on, acted_at, request_id,
      prev_date, prev_assignee, prev_status, prev_last_done, next_date, next_assignee, next_status, next_last_done)
    VALUES (p_operation_id, v_op.commune_id, p_action, v_op.date, v_op.assignee, v_actor, p_today, clock_timestamp(), p_request_id,
      v_op.date, v_op.assignee, v_op.status, v_op.last_done, v_date, v_assignee, v_status, v_last_done)
    RETURNING id INTO v_id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_op.commune_id, v_actor, 'operations', p_operation_id, v_op.title, v_description);
  RETURN commune_private.occurrence_result(v_id, false, p_operation_id);
END;
$$;

-- Undo restores exactly what the action replaced, and only while the task is
-- still in the state that action left it in. Anything later (another
-- completion, a manual edit of the date or assignee) must not be overwritten.
CREATE FUNCTION public.undo_operation_occurrence(p_occurrence_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_op public.commune_operations%ROWTYPE;
  v_occurrence public.operation_occurrences%ROWTYPE;
BEGIN
  SELECT o.* INTO v_op FROM public.commune_operations o
    JOIN public.operation_occurrences h ON h.operation_id = o.id WHERE h.id = p_occurrence_id FOR UPDATE OF o;
  SELECT * INTO v_occurrence FROM public.operation_occurrences WHERE id = p_occurrence_id FOR UPDATE;
  IF v_op.id IS NULL OR v_occurrence.id IS NULL OR NOT public.is_commune_member(v_op.commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  IF v_occurrence.undone_at IS NOT NULL THEN
    RETURN commune_private.occurrence_result(v_occurrence.id, true, v_op.id);
  END IF;
  IF EXISTS (SELECT 1 FROM public.operation_occurrences later WHERE later.operation_id = v_op.id
      AND later.undone_at IS NULL AND later.id <> v_occurrence.id AND later.acted_at >= v_occurrence.acted_at)
     OR v_op.date <> v_occurrence.next_date OR v_op.assignee IS DISTINCT FROM v_occurrence.next_assignee
     OR v_op.status <> v_occurrence.next_status OR v_op.last_done IS DISTINCT FROM v_occurrence.next_last_done THEN
    RAISE EXCEPTION 'This task has changed since then, so it can no longer be undone. Edit the task instead.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('commune.occurrence_event', 'on', true);
  UPDATE public.commune_operations SET date = v_occurrence.prev_date, assignee = v_occurrence.prev_assignee,
    status = v_occurrence.prev_status, last_done = v_occurrence.prev_last_done, updated_at = now() WHERE id = v_op.id;
  PERFORM set_config('commune.occurrence_event', 'off', true);
  UPDATE public.operation_occurrences SET undone_at = now(), undone_by = v_actor WHERE id = v_occurrence.id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_op.commune_id, v_actor, 'operations', v_op.id, v_op.title,
      CASE v_occurrence.action WHEN 'completed' THEN 'Completion undone' WHEN 'skipped' THEN 'Skip undone' ELSE 'Reopening undone' END);
  RETURN commune_private.occurrence_result(v_occurrence.id, false, v_op.id);
END;
$$;

CREATE OR REPLACE FUNCTION commune_private.snapshot_operations(p_commune_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'hubId',o.commune_id,'kind',o.kind,'category',o.category,'title',o.title,'date',o.date,'time',o.time,'allDay',o.all_day,'assignee',o.assignee,'rotation',o.rotation,'lastDone',o.last_done,'repeat',o.repeat,'status',o.status,'notes',o.notes,
      -- The latest action, only while the task is still exactly as it left it.
      'undoOccurrenceId',(SELECT u.id FROM public.operation_occurrences u WHERE u.operation_id=o.id AND u.undone_at IS NULL
        AND u.next_date=o.date AND u.next_assignee IS NOT DISTINCT FROM o.assignee AND u.next_status=o.status AND u.next_last_done IS NOT DISTINCT FROM o.last_done
        AND NOT EXISTS(SELECT 1 FROM public.operation_occurrences later WHERE later.operation_id=o.id AND later.undone_at IS NULL AND later.id<>u.id AND later.acted_at>=u.acted_at)
        ORDER BY u.acted_at DESC LIMIT 1),
      'history',coalesce((SELECT jsonb_agg(jsonb_build_object('id',h.id,'action',h.action,'dueOn',h.due_on,'assignee',h.assignee,'actorId',h.actor_id,'actedOn',h.acted_on,'actedAt',h.acted_at,
          'nextDate',h.next_date,'nextAssignee',h.next_assignee,'undoneAt',h.undone_at,'undoneBy',h.undone_by) ORDER BY h.acted_at DESC, h.id)
        FROM (SELECT * FROM public.operation_occurrences x WHERE x.operation_id=o.id ORDER BY x.acted_at DESC, x.id LIMIT 12) h),'[]'::jsonb)
    ) ORDER BY o.date,o.time),'[]'::jsonb)
    FROM public.commune_operations o WHERE o.commune_id=p_commune_id;
$$;

REVOKE ALL ON FUNCTION public.record_operation_occurrence(uuid, text, date, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_operation_occurrence(uuid, text, date, date, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.undo_operation_occurrence(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.undo_operation_occurrence(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
