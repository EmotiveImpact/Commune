-- Task handovers and skip reasons. A member can hand the current turn of a
-- task to someone else ("can you do the bins this week?"). On a task that
-- takes turns, the person covering does this one occurrence only: when they
-- complete it, the rotation carries on from the person whose turn it was, so
-- nobody loses or gains a place. A skip can now say why. Both are recorded
-- occurrences with the actor, time and state before and after, so they show
-- in the task's history and the latest one can be undone.
--
-- record_operation_occurrence gains an optional reason; an older client that
-- calls it without one keeps working. Apply after 0023. Release with the
-- matching web client.
BEGIN;

-- Whose turn it is while someone else covers it. NULL when the holder is
-- doing their own turn. Written only by the commands below: there is no
-- column grant, and a member's own edit of the people clears it.
ALTER TABLE public.commune_operations
  ADD COLUMN turn_owner_id text CHECK (turn_owner_id IS NULL OR length(turn_owner_id) BETWEEN 1 AND 128);

ALTER TABLE public.operation_occurrences DROP CONSTRAINT operation_occurrences_action_check;
ALTER TABLE public.operation_occurrences
  ADD CONSTRAINT operation_occurrences_action_check
    CHECK (action IN ('completed', 'skipped', 'reopened', 'handed_over')),
  ADD COLUMN reason text CHECK (reason IS NULL OR length(reason) BETWEEN 1 AND 200),
  ADD COLUMN prev_turn_owner_id text,
  ADD COLUMN next_turn_owner_id text;

CREATE OR REPLACE FUNCTION commune_private.occurrence_result(p_id uuid, p_duplicate boolean, p_operation_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object('id', p_id, 'duplicate', p_duplicate, 'date', o.date,
    'assignee', CASE WHEN o.assignee_id IS NULL THEN o.assignee ELSE commune_private.member_name(o.assignee_id) END,
    'assigneeId', o.assignee_id, 'turnOwnerId', o.turn_owner_id, 'status', o.status)
  FROM public.commune_operations o WHERE o.id = p_operation_id;
$$;

-- A short, optional reason. Blank means none.
CREATE FUNCTION commune_private.occurrence_reason(p_reason text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
DECLARE v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF length(v_reason) > 200 THEN
    RAISE EXCEPTION 'Keep the reason to 200 characters' USING ERRCODE = '22023';
  END IF;
  RETURN v_reason;
END;
$$;
REVOKE ALL ON FUNCTION commune_private.occurrence_reason(text) FROM PUBLIC;

-- The previous version is replaced in full rather than patched: completion
-- now advances the rotation from the person whose turn it was, and a skip
-- may carry a reason.
DROP FUNCTION public.record_operation_occurrence(uuid, text, date, date, uuid);
CREATE FUNCTION public.record_operation_occurrence(p_operation_id uuid, p_action text,
  p_expected_date date, p_today date, p_request_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_op public.commune_operations%ROWTYPE;
  v_replay public.operation_occurrences%ROWTYPE;
  v_actor_name text;
  v_date date; v_assignee text; v_assignee_id text; v_turn_owner_id text; v_status text; v_last_done jsonb;
  v_id uuid; v_description text; v_reason text;
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
  v_reason := commune_private.occurrence_reason(p_reason);
  IF v_reason IS NOT NULL AND p_action <> 'skipped' THEN
    RAISE EXCEPTION 'Only a skip or a handover takes a reason' USING ERRCODE = '22023';
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
  v_date := v_op.date; v_assignee := v_op.assignee; v_assignee_id := v_op.assignee_id;
  v_turn_owner_id := v_op.turn_owner_id; v_status := v_op.status; v_last_done := v_op.last_done;

  IF p_action = 'completed' THEN
    IF v_op.status <> 'open' THEN
      RAISE EXCEPTION 'This task is already done' USING ERRCODE = 'P0001';
    END IF;
    IF v_op.repeat = 'none' THEN
      v_status := 'done';
      v_last_done := jsonb_build_object('by', v_actor_name, 'date', p_today);
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
      -- The person who held it, the cover included, is credited.
      v_last_done := jsonb_build_object('by', coalesce(CASE WHEN v_op.assignee_id IS NOT NULL THEN commune_private.member_name(v_op.assignee_id) END,
        nullif(btrim(v_op.assignee), ''), v_actor_name), 'date', p_today);
    END IF;
    -- A cover lasts for one occurrence.
    v_turn_owner_id := NULL;
    v_description := CASE WHEN v_op.repeat = 'none' THEN 'Completed'
      WHEN v_assignee_id IS DISTINCT FROM v_op.assignee_id AND v_assignee IS NOT NULL THEN 'Completed. Next: ' || v_assignee
      ELSE 'Completed. Next due ' || to_char(v_date, 'FMDD Mon') END;
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
      assignee_id, prev_assignee_id, next_assignee_id, reason, prev_turn_owner_id, next_turn_owner_id)
    VALUES (p_operation_id, v_op.commune_id, p_action, v_op.date, v_op.assignee, v_actor, p_today, clock_timestamp(), p_request_id,
      v_op.date, v_op.assignee, v_op.status, v_op.last_done, v_date, v_assignee, v_status, v_last_done,
      v_op.assignee_id, v_op.assignee_id, v_assignee_id, v_reason, v_op.turn_owner_id, v_turn_owner_id)
    RETURNING id INTO v_id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_op.commune_id, v_actor, 'operations', p_operation_id, v_op.title, left(v_description, 240));
  RETURN commune_private.occurrence_result(v_id, false, p_operation_id);
END;
$$;

-- Hand the current occurrence to another active member. Any member may do
-- it, as any member may edit a task; the history says who did. The expected
-- date and holder reject a stale screen, as completion does.
CREATE FUNCTION public.hand_over_operation(p_operation_id uuid, p_to_member_id text,
  p_expected_date date, p_expected_assignee_id text, p_today date, p_reason text, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_op public.commune_operations%ROWTYPE;
  v_replay public.operation_occurrences%ROWTYPE;
  v_turn_owner_id text; v_to_name text; v_id uuid; v_description text;
  v_reason text := commune_private.occurrence_reason(p_reason);
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to hand over a task' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_op FROM public.commune_operations WHERE id = p_operation_id FOR UPDATE;
  IF v_op.id IS NULL OR NOT public.is_commune_member(v_op.commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_replay FROM public.operation_occurrences WHERE actor_id = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_replay.operation_id <> p_operation_id OR v_replay.action <> 'handed_over'
       OR v_replay.next_assignee_id IS DISTINCT FROM p_to_member_id THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    RETURN commune_private.occurrence_result(v_replay.id, true, p_operation_id);
  END IF;
  IF p_today IS NULL OR p_today NOT BETWEEN current_date - 1 AND current_date + 1 THEN
    RAISE EXCEPTION 'Check the date on this device and try again' USING ERRCODE = '22023';
  END IF;
  IF v_op.kind <> 'task' THEN
    RAISE EXCEPTION 'Only tasks can be handed over' USING ERRCODE = '22023';
  END IF;
  IF p_to_member_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.commune_members m
      WHERE m.commune_id = v_op.commune_id AND m.user_id = p_to_member_id AND m.active) THEN
    RAISE EXCEPTION 'Choose a current member of this commune' USING ERRCODE = '22023';
  END IF;
  IF p_expected_date IS DISTINCT FROM v_op.date OR p_expected_assignee_id IS DISTINCT FROM v_op.assignee_id THEN
    RAISE EXCEPTION 'This task has already moved on. Refresh to see who has it now.' USING ERRCODE = 'P0001';
  END IF;
  IF v_op.status <> 'open' THEN
    RAISE EXCEPTION 'This task is already done' USING ERRCODE = 'P0001';
  END IF;
  IF p_to_member_id = v_op.assignee_id THEN
    RAISE EXCEPTION 'They already have this task' USING ERRCODE = '22023';
  END IF;

  -- On a task that takes turns, remember whose turn it is. Handing it back
  -- to that person ends the cover.
  IF v_op.rotation_ids IS NOT NULL AND v_op.repeat <> 'none' THEN
    v_turn_owner_id := coalesce(v_op.turn_owner_id, v_op.assignee_id);
    IF v_turn_owner_id = p_to_member_id THEN v_turn_owner_id := NULL; END IF;
  END IF;
  v_to_name := commune_private.member_name(p_to_member_id);
  v_description := CASE
    WHEN v_op.turn_owner_id = p_to_member_id THEN 'Handed back to ' || v_to_name
    WHEN v_turn_owner_id IS NOT NULL THEN 'Handed to ' || v_to_name || ', covering for ' || commune_private.member_name(v_turn_owner_id)
    ELSE 'Handed to ' || v_to_name END || coalesce(': ' || v_reason, '');

  PERFORM set_config('commune.occurrence_event', 'on', true);
  UPDATE public.commune_operations SET assignee_id = p_to_member_id, assignee = v_to_name,
    turn_owner_id = v_turn_owner_id, updated_at = now() WHERE id = p_operation_id;
  PERFORM set_config('commune.occurrence_event', 'off', true);
  INSERT INTO public.operation_occurrences (operation_id, commune_id, action, due_on, assignee, actor_id, acted_on, acted_at, request_id,
      prev_date, prev_assignee, prev_status, prev_last_done, next_date, next_assignee, next_status, next_last_done,
      assignee_id, prev_assignee_id, next_assignee_id, reason, prev_turn_owner_id, next_turn_owner_id)
    VALUES (p_operation_id, v_op.commune_id, 'handed_over', v_op.date, v_op.assignee, v_actor, p_today, clock_timestamp(), p_request_id,
      v_op.date, v_op.assignee, v_op.status, v_op.last_done, v_op.date, v_to_name, v_op.status, v_op.last_done,
      v_op.assignee_id, v_op.assignee_id, p_to_member_id, v_reason, v_op.turn_owner_id, v_turn_owner_id)
    RETURNING id INTO v_id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_op.commune_id, v_actor, 'operations', p_operation_id, v_op.title, left(v_description, 240));
  RETURN commune_private.occurrence_result(v_id, false, p_operation_id);
END;
$$;

-- Undo restores exactly what the action replaced, the cover included, and
-- only while the task is still in the state that action left it in.
CREATE OR REPLACE FUNCTION public.undo_operation_occurrence(p_occurrence_id uuid)
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
     OR v_op.date <> v_occurrence.next_date
     OR v_op.assignee_id IS DISTINCT FROM v_occurrence.next_assignee_id
     OR (v_op.assignee_id IS NULL AND v_op.assignee IS DISTINCT FROM v_occurrence.next_assignee)
     OR v_op.turn_owner_id IS DISTINCT FROM v_occurrence.next_turn_owner_id
     OR v_op.status <> v_occurrence.next_status OR v_op.last_done IS DISTINCT FROM v_occurrence.next_last_done THEN
    RAISE EXCEPTION 'This task has changed since then, so it can no longer be undone. Edit the task instead.' USING ERRCODE = 'P0001';
  END IF;
  -- Someone being handed back a task must still be a member.
  IF v_occurrence.prev_assignee_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.commune_members m
      WHERE m.commune_id = v_op.commune_id AND m.user_id = v_occurrence.prev_assignee_id AND m.active) THEN
    RAISE EXCEPTION 'The person who had this task has left, so it can no longer be undone. Edit the task instead.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('commune.occurrence_event', 'on', true);
  UPDATE public.commune_operations SET date = v_occurrence.prev_date, assignee = v_occurrence.prev_assignee,
    assignee_id = v_occurrence.prev_assignee_id, turn_owner_id = v_occurrence.prev_turn_owner_id,
    status = v_occurrence.prev_status, last_done = v_occurrence.prev_last_done, updated_at = now() WHERE id = v_op.id;
  PERFORM set_config('commune.occurrence_event', 'off', true);
  UPDATE public.operation_occurrences SET undone_at = now(), undone_by = v_actor WHERE id = v_occurrence.id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_op.commune_id, v_actor, 'operations', v_op.id, v_op.title,
      CASE v_occurrence.action WHEN 'completed' THEN 'Completion undone' WHEN 'skipped' THEN 'Skip undone'
        WHEN 'handed_over' THEN 'Handover undone' ELSE 'Reopening undone' END);
  RETURN commune_private.occurrence_result(v_occurrence.id, false, v_op.id);
END;
$$;

-- A member's own edit of who has the task, or of who takes turns, replaces
-- any cover. While a cover holds the task, the person covering need not be
-- in the rotation: the person whose turn it is must be.
DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('commune_private.set_operation_people()'::regprocedure);
  v_source := replace(v_original,
    '    IF NEW.rotation_ids IS NOT NULL AND NEW.assignee_id IS NOT NULL AND NOT NEW.rotation_ids ? NEW.assignee_id THEN',
    '    IF TG_OP = ''INSERT'' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
       OR NEW.rotation_ids IS DISTINCT FROM OLD.rotation_ids OR NEW.repeat IS DISTINCT FROM OLD.repeat THEN
      NEW.turn_owner_id := NULL;
    END IF;
    IF NEW.rotation_ids IS NOT NULL AND NEW.assignee_id IS NOT NULL AND NOT NEW.rotation_ids ? NEW.assignee_id
       AND NOT (NEW.turn_owner_id IS NOT NULL AND NEW.rotation_ids ? NEW.turn_owner_id) THEN');
  IF v_source = v_original OR position('NEW.turn_owner_id := NULL' IN v_source) = 0 THEN
    RAISE EXCEPTION 'Unsupported operation people definition';
  END IF;
  EXECUTE v_source;
END;
$$;

-- When a member leaves: a task they were covering goes back to the person
-- whose turn it is; a task someone was covering for them stays with the
-- cover; otherwise it passes on as before (0020).
CREATE OR REPLACE FUNCTION commune_private.reassign_departed_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_op public.commune_operations%ROWTYPE;
  v_rotation jsonb; v_next text; v_turn_owner text; v_name text := commune_private.member_name(NEW.user_id);
  v_actor text := coalesce(nullif(commune_private.data_api_user_id(), ''), NEW.user_id);
BEGIN
  FOR v_op IN SELECT * FROM public.commune_operations o WHERE o.commune_id = NEW.commune_id
      AND (o.assignee_id = NEW.user_id OR o.rotation_ids ? NEW.user_id OR o.turn_owner_id = NEW.user_id)
      ORDER BY o.id FOR UPDATE LOOP
    SELECT jsonb_agg(e.value ORDER BY e.ord) INTO v_rotation
      FROM jsonb_array_elements_text(v_op.rotation_ids) WITH ORDINALITY e(value, ord) WHERE e.value <> NEW.user_id;
    v_next := v_op.assignee_id;
    v_turn_owner := CASE WHEN v_op.turn_owner_id = NEW.user_id THEN NULL ELSE v_op.turn_owner_id END;
    IF v_op.assignee_id = NEW.user_id THEN
      IF v_turn_owner IS NOT NULL THEN
        v_next := v_turn_owner;
        v_turn_owner := NULL;
      ELSE
        v_next := CASE WHEN v_op.rotation_ids IS NULL THEN NULL
          ELSE commune_private.next_in_rotation(v_op.commune_id, v_op.rotation_ids, NEW.user_id) END;
      END IF;
    END IF;
    PERFORM set_config('commune.occurrence_event', 'on', true);
    UPDATE public.commune_operations SET assignee_id = v_next,
        assignee = CASE WHEN v_next IS NULL THEN NULL ELSE commune_private.member_name(v_next) END,
        turn_owner_id = v_turn_owner,
        rotation_ids = v_rotation,
        rotation = CASE WHEN v_rotation IS NULL THEN NULL ELSE
          (SELECT jsonb_agg(commune_private.member_name(e.value) ORDER BY e.ord) FROM jsonb_array_elements_text(v_rotation) WITH ORDINALITY e(value, ord)) END,
        updated_at = now()
      WHERE id = v_op.id;
    PERFORM set_config('commune.occurrence_event', 'off', true);
    IF v_op.assignee_id = NEW.user_id THEN
      INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
        VALUES (v_op.commune_id, v_actor, 'operations', v_op.id, v_op.title,
          left(v_name || ' left. ' || CASE WHEN v_next IS NULL THEN 'Now unassigned' ELSE 'Now with ' || commune_private.member_name(v_next) END, 240));
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- The snapshot says whose turn a covered task is, and each history entry
-- carries its reason. Undo is offered only while the cover is unchanged too.
CREATE OR REPLACE FUNCTION commune_private.snapshot_operations(p_commune_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'hubId',o.commune_id,'kind',o.kind,'category',o.category,'title',o.title,'date',o.date,'time',o.time,'allDay',o.all_day,
      'assignee',CASE WHEN o.assignee_id IS NULL THEN o.assignee ELSE commune_private.member_name(o.assignee_id) END,
      'assigneeId',o.assignee_id,
      'turnOwnerId',o.turn_owner_id,
      'turnOwner',CASE WHEN o.turn_owner_id IS NULL THEN NULL ELSE commune_private.member_name(o.turn_owner_id) END,
      'rotation',CASE WHEN o.rotation_ids IS NULL THEN o.rotation ELSE
        (SELECT jsonb_agg(commune_private.member_name(e.value) ORDER BY e.ord) FROM jsonb_array_elements_text(o.rotation_ids) WITH ORDINALITY e(value, ord)) END,
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
          'assignee',CASE WHEN h.assignee_id IS NULL THEN h.assignee ELSE commune_private.member_name(h.assignee_id) END,'assigneeId',h.assignee_id,
          'actorId',h.actor_id,'actedOn',h.acted_on,'actedAt',h.acted_at,'nextDate',h.next_date,
          'nextAssignee',CASE WHEN h.next_assignee_id IS NULL THEN h.next_assignee ELSE commune_private.member_name(h.next_assignee_id) END,'nextAssigneeId',h.next_assignee_id,
          'reason',h.reason,
          'undoneAt',h.undone_at,'undoneBy',h.undone_by) ORDER BY h.acted_at DESC, h.id)
        FROM (SELECT * FROM public.operation_occurrences x WHERE x.operation_id=o.id ORDER BY x.acted_at DESC, x.id LIMIT 12) h),'[]'::jsonb)
    ) ORDER BY o.date,o.time),'[]'::jsonb)
    FROM public.commune_operations o WHERE o.commune_id=p_commune_id;
$$;

REVOKE ALL ON FUNCTION public.record_operation_occurrence(uuid, text, date, date, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_operation_occurrence(uuid, text, date, date, uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.hand_over_operation(uuid, text, date, text, date, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hand_over_operation(uuid, text, date, text, date, text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
