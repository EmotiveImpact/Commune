-- Operations hold people by member id, not by display name. A rename no
-- longer breaks an assignment, two members with the same name stay distinct,
-- and the database (not the browser) decides who is next in a rotation.
-- When a member leaves, their tasks pass to the next person in the rotation
-- (or become unassigned) and they leave every rotation, with a history line.
--
-- The name columns stay as a denormalised copy so older clients keep working:
-- a write that sends only names is resolved to ids when the name is unique
-- among active members. Apply after 0019. Release with the matching client.
BEGIN;

CREATE FUNCTION public.valid_operation_member_ids(p_ids jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog AS $$
  SELECT p_ids IS NULL OR (jsonb_typeof(p_ids) = 'array' AND jsonb_array_length(p_ids) BETWEEN 1 AND 50
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_ids) e
      WHERE jsonb_typeof(e.value) <> 'string' OR length(e.value #>> '{}') NOT BETWEEN 1 AND 128)
    AND (SELECT count(DISTINCT e.value) FROM jsonb_array_elements(p_ids) e) = jsonb_array_length(p_ids));
$$;
REVOKE ALL ON FUNCTION public.valid_operation_member_ids(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valid_operation_member_ids(jsonb) TO authenticated;

ALTER TABLE public.commune_operations
  ADD COLUMN assignee_id text CHECK (assignee_id IS NULL OR length(assignee_id) BETWEEN 1 AND 128),
  ADD COLUMN rotation_ids jsonb CHECK (public.valid_operation_member_ids(rotation_ids));
ALTER TABLE public.operation_occurrences
  ADD COLUMN assignee_id text, ADD COLUMN prev_assignee_id text, ADD COLUMN next_assignee_id text;

GRANT INSERT (assignee_id, rotation_ids) ON public.commune_operations TO authenticated;
GRANT UPDATE (assignee_id, rotation_ids) ON public.commune_operations TO authenticated;

-- A member's current name in this commune, as the snapshot shows it.
CREATE FUNCTION commune_private.member_name(p_user_id text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT left(coalesce((SELECT u.name FROM neon_auth."user" u WHERE u.id::text = p_user_id), 'Member'), 80);
$$;
REVOKE ALL ON FUNCTION commune_private.member_name(text) FROM PUBLIC;

-- The only active member of a commune with exactly this name, or NULL.
CREATE FUNCTION commune_private.member_by_name(p_commune_id uuid, p_name text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE WHEN count(*) = 1 THEN min(m.user_id) END
  FROM public.commune_members m JOIN neon_auth."user" u ON u.id::text = m.user_id
  WHERE m.commune_id = p_commune_id AND m.active AND btrim(u.name) = btrim(p_name);
$$;
REVOKE ALL ON FUNCTION commune_private.member_by_name(uuid, text) FROM PUBLIC;

-- Backfill: resolve names that match exactly one active member. Anything
-- ambiguous or unknown keeps its name and shows as needing a person.
SELECT set_config('commune.occurrence_event', 'on', true);
UPDATE public.commune_operations o SET assignee_id = commune_private.member_by_name(o.commune_id, o.assignee)
  WHERE o.assignee IS NOT NULL AND btrim(o.assignee) <> '';
UPDATE public.commune_operations o SET rotation_ids = r.ids
  FROM (SELECT x.id, jsonb_agg(commune_private.member_by_name(x.commune_id, e.value) ORDER BY e.ord) AS ids,
          bool_and(commune_private.member_by_name(x.commune_id, e.value) IS NOT NULL) AS complete
        FROM public.commune_operations x, jsonb_array_elements_text(x.rotation) WITH ORDINALITY e(value, ord)
        WHERE x.kind = 'task' AND jsonb_typeof(x.rotation) = 'array' AND jsonb_array_length(x.rotation) > 0
        GROUP BY x.id) r
  WHERE o.id = r.id AND r.complete AND public.valid_operation_member_ids(r.ids)
    AND (o.assignee_id IS NULL OR r.ids ? o.assignee_id);
SELECT set_config('commune.occurrence_event', 'off', true);
UPDATE public.operation_occurrences h SET
  assignee_id = commune_private.member_by_name(h.commune_id, h.assignee),
  prev_assignee_id = commune_private.member_by_name(h.commune_id, h.prev_assignee),
  next_assignee_id = commune_private.member_by_name(h.commune_id, h.next_assignee);

-- Ids are the truth; names are copied from them. A member's own write is
-- checked: every person named must be an active member of this commune.
CREATE FUNCTION commune_private.set_operation_people()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_command boolean := coalesce(current_setting('commune.occurrence_event', true), '') = 'on';
  v_id text;
BEGIN
  IF NOT v_command THEN
    -- An older client sends names only. On an update the id columns carry
    -- over unchanged, so a changed name with an unchanged id is such a write.
    IF nullif(btrim(NEW.assignee), '') IS NOT NULL AND (
        (TG_OP = 'INSERT' AND NEW.assignee_id IS NULL)
        OR (TG_OP = 'UPDATE' AND NEW.assignee IS DISTINCT FROM OLD.assignee
            AND NEW.assignee_id IS NOT DISTINCT FROM OLD.assignee_id)) THEN
      NEW.assignee_id := commune_private.member_by_name(NEW.commune_id, NEW.assignee);
      IF NEW.assignee_id IS NULL THEN
        RAISE EXCEPTION 'Choose a current member of this commune' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF jsonb_typeof(NEW.rotation) = 'array' AND jsonb_array_length(NEW.rotation) > 0 AND (
        (TG_OP = 'INSERT' AND NEW.rotation_ids IS NULL)
        OR (TG_OP = 'UPDATE' AND NEW.rotation IS DISTINCT FROM OLD.rotation
            AND NEW.rotation_ids IS NOT DISTINCT FROM OLD.rotation_ids)) THEN
      SELECT jsonb_agg(commune_private.member_by_name(NEW.commune_id, e.value) ORDER BY e.ord) INTO NEW.rotation_ids
        FROM jsonb_array_elements_text(NEW.rotation) WITH ORDINALITY e(value, ord);
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.rotation_ids) e WHERE e.value = 'null'::jsonb)
         OR NOT public.valid_operation_member_ids(NEW.rotation_ids) THEN
        RAISE EXCEPTION 'Choose current members of this commune for the rotation' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF NEW.kind <> 'task' AND (NEW.assignee_id IS NOT NULL OR NEW.rotation_ids IS NOT NULL) THEN
      RAISE EXCEPTION 'Only tasks have people' USING ERRCODE = '22023';
    END IF;
    IF NEW.assignee_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id)
       AND NOT EXISTS (SELECT 1 FROM public.commune_members m
         WHERE m.commune_id = NEW.commune_id AND m.user_id = NEW.assignee_id AND m.active) THEN
      RAISE EXCEPTION 'Choose a current member of this commune' USING ERRCODE = '22023';
    END IF;
    IF NEW.rotation_ids IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.rotation_ids IS DISTINCT FROM OLD.rotation_ids) THEN
      IF NOT public.valid_operation_member_ids(NEW.rotation_ids) THEN
        RAISE EXCEPTION 'Choose each person in the rotation once' USING ERRCODE = '22023';
      END IF;
      FOR v_id IN SELECT jsonb_array_elements_text(NEW.rotation_ids) LOOP
        IF NOT EXISTS (SELECT 1 FROM public.commune_members m
            WHERE m.commune_id = NEW.commune_id AND m.user_id = v_id AND m.active) THEN
          RAISE EXCEPTION 'Choose current members of this commune for the rotation' USING ERRCODE = '22023';
        END IF;
      END LOOP;
    END IF;
    IF NEW.rotation_ids IS NOT NULL AND NEW.assignee_id IS NOT NULL AND NOT NEW.rotation_ids ? NEW.assignee_id THEN
      RAISE EXCEPTION 'The person it is with now must be in the rotation' USING ERRCODE = '22023';
    END IF;
  END IF;
  -- Copy names from ids so older readers stay correct. A write that clears
  -- an id clears the copied name with it.
  IF NEW.assignee_id IS NOT NULL THEN
    NEW.assignee := commune_private.member_name(NEW.assignee_id);
  ELSIF NOT v_command AND TG_OP = 'UPDATE' AND OLD.assignee_id IS NOT NULL THEN
    NEW.assignee := NULL;
  END IF;
  IF NEW.rotation_ids IS NOT NULL THEN
    SELECT jsonb_agg(commune_private.member_name(e.value) ORDER BY e.ord) INTO NEW.rotation
      FROM jsonb_array_elements_text(NEW.rotation_ids) WITH ORDINALITY e(value, ord);
  ELSIF NOT v_command AND TG_OP = 'UPDATE' AND OLD.rotation_ids IS NOT NULL THEN
    NEW.rotation := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION commune_private.set_operation_people() FROM PUBLIC;
CREATE TRIGGER operation_people BEFORE INSERT OR UPDATE ON public.commune_operations
  FOR EACH ROW EXECUTE FUNCTION commune_private.set_operation_people();

-- The rotation step: the next active member after the current one, by id.
CREATE FUNCTION commune_private.next_in_rotation(p_commune_id uuid, p_rotation jsonb, p_current text)
RETURNS text LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  WITH r AS (
    SELECT e.value AS user_id, e.ord FROM jsonb_array_elements_text(p_rotation) WITH ORDINALITY e(value, ord)
    WHERE EXISTS (SELECT 1 FROM public.commune_members m WHERE m.commune_id = p_commune_id AND m.user_id = e.value AND m.active)
  ), here AS (
    SELECT coalesce((SELECT e.ord FROM jsonb_array_elements_text(p_rotation) WITH ORDINALITY e(value, ord)
      WHERE e.value = p_current LIMIT 1), 0) AS ord
  )
  SELECT coalesce(
    (SELECT r.user_id FROM r, here WHERE r.ord > here.ord ORDER BY r.ord LIMIT 1),
    (SELECT r.user_id FROM r ORDER BY r.ord LIMIT 1));
$$;
REVOKE ALL ON FUNCTION commune_private.next_in_rotation(uuid, jsonb, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION commune_private.occurrence_result(p_id uuid, p_duplicate boolean, p_operation_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object('id', p_id, 'duplicate', p_duplicate, 'date', o.date,
    'assignee', CASE WHEN o.assignee_id IS NULL THEN o.assignee ELSE commune_private.member_name(o.assignee_id) END,
    'assigneeId', o.assignee_id, 'status', o.status)
  FROM public.commune_operations o WHERE o.id = p_operation_id;
$$;

-- record_operation_occurrence and undo_operation_occurrence advance and
-- restore the person by id. The edits are checked so drift fails loudly.
DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('public.record_operation_occurrence(uuid,text,date,date,uuid)'::regprocedure);
  v_source := replace(v_original, 'v_date date; v_assignee text;', 'v_date date; v_assignee text; v_assignee_id text;');
  v_source := replace(v_source, 'v_date := v_op.date; v_assignee := v_op.assignee;',
    'v_date := v_op.date; v_assignee := v_op.assignee; v_assignee_id := v_op.assignee_id;');
  v_source := replace(v_source,
    'IF jsonb_typeof(v_op.rotation) = ''array'' AND jsonb_array_length(v_op.rotation) > 0 THEN
        SELECT r.ord INTO v_position FROM jsonb_array_elements_text(v_op.rotation) WITH ORDINALITY AS r(name, ord)
          WHERE r.name = v_op.assignee ORDER BY r.ord LIMIT 1;
        v_assignee := v_op.rotation ->> (coalesce(v_position, 0) % jsonb_array_length(v_op.rotation))::integer;
      END IF;',
    'IF v_op.rotation_ids IS NOT NULL THEN
        -- Members who have left are passed over.
        v_assignee_id := coalesce(commune_private.next_in_rotation(v_op.commune_id, v_op.rotation_ids, v_op.assignee_id), v_op.assignee_id);
        v_assignee := CASE WHEN v_assignee_id IS NULL THEN v_op.assignee ELSE commune_private.member_name(v_assignee_id) END;
      END IF;');
  v_source := replace(v_source,
    'v_last_done := jsonb_build_object(''by'', coalesce(nullif(btrim(v_op.assignee), ''''), v_actor_name), ''date'', p_today);',
    'v_last_done := jsonb_build_object(''by'', coalesce(CASE WHEN v_op.assignee_id IS NOT NULL THEN commune_private.member_name(v_op.assignee_id) END,
        nullif(btrim(v_op.assignee), ''''), v_actor_name), ''date'', p_today);');
  v_source := replace(v_source, 'WHEN v_assignee IS DISTINCT FROM v_op.assignee AND v_assignee IS NOT NULL THEN',
    'WHEN v_assignee_id IS DISTINCT FROM v_op.assignee_id AND v_assignee IS NOT NULL THEN');
  v_source := replace(v_source, 'SET date = v_date, assignee = v_assignee, status = v_status,',
    'SET date = v_date, assignee = v_assignee, assignee_id = v_assignee_id, status = v_status,');
  v_source := replace(v_source,
    'prev_date, prev_assignee, prev_status, prev_last_done, next_date, next_assignee, next_status, next_last_done)',
    'prev_date, prev_assignee, prev_status, prev_last_done, next_date, next_assignee, next_status, next_last_done,
      assignee_id, prev_assignee_id, next_assignee_id)');
  v_source := replace(v_source,
    'v_op.date, v_op.assignee, v_op.status, v_op.last_done, v_date, v_assignee, v_status, v_last_done)',
    'v_op.date, v_op.assignee, v_op.status, v_op.last_done, v_date, v_assignee, v_status, v_last_done,
      v_op.assignee_id, v_op.assignee_id, v_assignee_id)');
  IF v_source = v_original OR position('next_in_rotation' IN v_source) = 0
     OR position('assignee_id = v_assignee_id' IN v_source) = 0
     OR position('v_op.assignee_id, v_op.assignee_id, v_assignee_id' IN v_source) = 0
     OR position('v_assignee_id IS DISTINCT FROM v_op.assignee_id' IN v_source) = 0
     OR position('member_name(v_op.assignee_id)' IN v_source) = 0
     OR position('jsonb_array_length(v_op.rotation)' IN v_source) > 0 THEN
    RAISE EXCEPTION 'Unsupported occurrence definition';
  END IF;
  EXECUTE v_source;

  v_original := pg_get_functiondef('public.undo_operation_occurrence(uuid)'::regprocedure);
  v_source := replace(v_original, 'OR v_op.assignee IS DISTINCT FROM v_occurrence.next_assignee',
    'OR v_op.assignee_id IS DISTINCT FROM v_occurrence.next_assignee_id
     OR (v_op.assignee_id IS NULL AND v_op.assignee IS DISTINCT FROM v_occurrence.next_assignee)');
  v_source := replace(v_source, 'assignee = v_occurrence.prev_assignee,',
    'assignee = v_occurrence.prev_assignee, assignee_id = v_occurrence.prev_assignee_id,');
  IF v_source = v_original OR position('next_assignee_id' IN v_source) = 0
     OR position('assignee_id = v_occurrence.prev_assignee_id' IN v_source) = 0 THEN
    RAISE EXCEPTION 'Unsupported undo definition';
  END IF;
  EXECUTE v_source;
END;
$$;

-- Names are read live from ids, so a rename shows everywhere at once.
CREATE OR REPLACE FUNCTION commune_private.snapshot_operations(p_commune_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'hubId',o.commune_id,'kind',o.kind,'category',o.category,'title',o.title,'date',o.date,'time',o.time,'allDay',o.all_day,
      'assignee',CASE WHEN o.assignee_id IS NULL THEN o.assignee ELSE commune_private.member_name(o.assignee_id) END,
      'assigneeId',o.assignee_id,
      'rotation',CASE WHEN o.rotation_ids IS NULL THEN o.rotation ELSE
        (SELECT jsonb_agg(commune_private.member_name(e.value) ORDER BY e.ord) FROM jsonb_array_elements_text(o.rotation_ids) WITH ORDINALITY e(value, ord)) END,
      'rotationIds',o.rotation_ids,
      'lastDone',o.last_done,'repeat',o.repeat,'anchorDay',o.anchor_day,'status',o.status,'notes',o.notes,
      -- The latest action, only while the task is still exactly as it left it.
      'undoOccurrenceId',(SELECT u.id FROM public.operation_occurrences u WHERE u.operation_id=o.id AND u.undone_at IS NULL
        AND u.next_date=o.date AND u.next_assignee_id IS NOT DISTINCT FROM o.assignee_id
        AND (o.assignee_id IS NOT NULL OR u.next_assignee IS NOT DISTINCT FROM o.assignee)
        AND u.next_status=o.status AND u.next_last_done IS NOT DISTINCT FROM o.last_done
        AND NOT EXISTS(SELECT 1 FROM public.operation_occurrences later WHERE later.operation_id=o.id AND later.undone_at IS NULL AND later.id<>u.id AND later.acted_at>=u.acted_at)
        ORDER BY u.acted_at DESC LIMIT 1),
      'history',coalesce((SELECT jsonb_agg(jsonb_build_object('id',h.id,'action',h.action,'dueOn',h.due_on,
          'assignee',CASE WHEN h.assignee_id IS NULL THEN h.assignee ELSE commune_private.member_name(h.assignee_id) END,'assigneeId',h.assignee_id,
          'actorId',h.actor_id,'actedOn',h.acted_on,'actedAt',h.acted_at,'nextDate',h.next_date,
          'nextAssignee',CASE WHEN h.next_assignee_id IS NULL THEN h.next_assignee ELSE commune_private.member_name(h.next_assignee_id) END,'nextAssigneeId',h.next_assignee_id,
          'undoneAt',h.undone_at,'undoneBy',h.undone_by) ORDER BY h.acted_at DESC, h.id)
        FROM (SELECT * FROM public.operation_occurrences x WHERE x.operation_id=o.id ORDER BY x.acted_at DESC, x.id LIMIT 12) h),'[]'::jsonb)
    ) ORDER BY o.date,o.time),'[]'::jsonb)
    FROM public.commune_operations o WHERE o.commune_id=p_commune_id;
$$;

-- When a member leaves or is removed, nobody is left holding a task for a
-- person who is gone. Their tasks pass to the next active person in the
-- rotation, or become unassigned, and they leave every rotation.
CREATE FUNCTION commune_private.reassign_departed_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_op public.commune_operations%ROWTYPE;
  v_rotation jsonb; v_next text; v_name text := commune_private.member_name(NEW.user_id);
  v_actor text := coalesce(nullif(commune_private.data_api_user_id(), ''), NEW.user_id);
BEGIN
  FOR v_op IN SELECT * FROM public.commune_operations o WHERE o.commune_id = NEW.commune_id
      AND (o.assignee_id = NEW.user_id OR o.rotation_ids ? NEW.user_id) ORDER BY o.id FOR UPDATE LOOP
    SELECT jsonb_agg(e.value ORDER BY e.ord) INTO v_rotation
      FROM jsonb_array_elements_text(v_op.rotation_ids) WITH ORDINALITY e(value, ord) WHERE e.value <> NEW.user_id;
    v_next := v_op.assignee_id;
    IF v_op.assignee_id = NEW.user_id THEN
      v_next := CASE WHEN v_op.rotation_ids IS NULL THEN NULL
        ELSE commune_private.next_in_rotation(v_op.commune_id, v_op.rotation_ids, NEW.user_id) END;
    END IF;
    PERFORM set_config('commune.occurrence_event', 'on', true);
    UPDATE public.commune_operations SET assignee_id = v_next,
        assignee = CASE WHEN v_next IS NULL THEN NULL ELSE commune_private.member_name(v_next) END,
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
REVOKE ALL ON FUNCTION commune_private.reassign_departed_member() FROM PUBLIC;
CREATE TRIGGER member_departure_operations AFTER UPDATE OF active ON public.commune_members
  FOR EACH ROW WHEN (OLD.active AND NOT NEW.active)
  EXECUTE FUNCTION commune_private.reassign_departed_member();

NOTIFY pgrst, 'reload schema';
COMMIT;
