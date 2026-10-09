-- Notes and tasks change only through commands, as announcements do (0025).
-- Until now a member's browser wrote both tables directly: it could set a
-- task's status, completion and timestamps, delete a note or task outright,
-- and save over an edit someone made in the meantime.
--
-- * Adding carries a request id, so a retry returns what it already added,
--   or says it has since been removed.
-- * Editing names the version it was based on, and a stale edit is refused.
--   Every change to a task moves it to its next version, so an edit opened
--   before a completion, skip or handover cannot quietly undo it. An edit
--   changes what a task is, when it happens and who does it; never its
--   status, its completion or its timestamps.
-- * Removing hides the row and its history (a note's earlier versions, a
--   task's occurrences) and keeps both. Only the person who added it or an
--   admin can remove it, and the activity history says so.
-- * A commune holds up to 500 notes and 1,000 tasks and events.
--
-- The client write grants and policies are dropped. A client that writes the
-- tables directly, as every web client before this release does, stops
-- working. Apply after 0026. Release with the matching web client.
BEGIN;

ALTER TABLE public.commune_notes
  ADD COLUMN request_id uuid,
  -- What the add sent, so a retry is recognised even after later edits.
  ADD COLUMN request_digest text,
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by text,
  ADD CONSTRAINT commune_notes_removed_check CHECK ((deleted_at IS NULL) = (deleted_by IS NULL));
ALTER TABLE public.commune_operations
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  ADD COLUMN request_id uuid,
  ADD COLUMN request_digest text,
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by text,
  ADD CONSTRAINT commune_operations_removed_check CHECK ((deleted_at IS NULL) = (deleted_by IS NULL));
-- Rows added before this migration have no request id.
CREATE UNIQUE INDEX commune_notes_request_idx
  ON public.commune_notes (created_by, request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX commune_operations_request_idx
  ON public.commune_operations (created_by, request_id) WHERE request_id IS NOT NULL;

-- Members read what has not been removed. There is deliberately no write
-- grant or policy: notes and tasks change only through the commands below.
-- Revoking a table privilege also revokes it on every column (0006, 0020).
DROP POLICY commune_notes_insert ON public.commune_notes;
DROP POLICY commune_notes_update ON public.commune_notes;
DROP POLICY commune_notes_delete ON public.commune_notes;
DROP POLICY commune_operations_insert ON public.commune_operations;
DROP POLICY commune_operations_update ON public.commune_operations;
DROP POLICY commune_operations_delete ON public.commune_operations;
REVOKE INSERT, UPDATE, DELETE ON public.commune_notes, public.commune_operations FROM authenticated;
ALTER POLICY commune_notes_read ON public.commune_notes
  USING (public.is_commune_member(commune_id) AND deleted_at IS NULL);
ALTER POLICY commune_operations_read ON public.commune_operations
  USING (public.is_commune_member(commune_id) AND deleted_at IS NULL);
-- Removed means not shown anywhere: a removed note's earlier versions (an old
-- door code, say) and a removed task's history are hidden too, from members
-- who joined later as much as from those who were there. The rows stay.
ALTER POLICY note_revision_read ON public.note_revisions
  USING (public.is_commune_member(commune_id)
    AND EXISTS (SELECT 1 FROM public.commune_notes n WHERE n.id = note_id AND n.deleted_at IS NULL));
ALTER POLICY operation_occurrence_read ON public.operation_occurrences
  USING (public.is_commune_member(commune_id)
    AND EXISTS (SELECT 1 FROM public.commune_operations o WHERE o.id = operation_id AND o.deleted_at IS NULL));

-- Each command writes its own activity line. The generic one (0013) would
-- add a second line for the same change.
DROP TRIGGER commune_change ON public.commune_notes;
DROP TRIGGER commune_change ON public.commune_operations;

-- Any change to a task, whichever command makes it, moves it to its next
-- version, so an edit opened before a completion, skip, handover or a
-- member's departure is stale.
CREATE FUNCTION commune_private.next_operation_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION commune_private.next_operation_version() FROM PUBLIC;
CREATE TRIGGER operation_version BEFORE UPDATE ON public.commune_operations
  FOR EACH ROW EXECUTE FUNCTION commune_private.next_operation_version();

-- A note's content as it will be stored, checked against the table's limits
-- so a member sees a plain message rather than a constraint name.
CREATE FUNCTION commune_private.note_content(p_title text, p_pill text, p_kicker text, p_lede text,
  p_body text, p_facts jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE v_title text := btrim(coalesce(p_title, ''));
BEGIN
  IF length(v_title) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Give the note a title of up to 80 characters' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(p_pill, '')) > 80 OR length(coalesce(p_kicker, '')) > 120 OR length(coalesce(p_lede, '')) > 200 THEN
    RAISE EXCEPTION 'The note''s type, label or summary is too long' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(p_body, '')) > 2000 THEN
    RAISE EXCEPTION 'Keep the note to 2000 characters' USING ERRCODE = '22023';
  END IF;
  IF NOT public.valid_note_facts(coalesce(p_facts, '[]'::jsonb)) THEN
    RAISE EXCEPTION 'A note holds up to 30 details of up to 120 characters each' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('title', v_title, 'pill', coalesce(p_pill, ''), 'kicker', coalesce(p_kicker, ''),
    'lede', coalesce(p_lede, ''), 'body', coalesce(p_body, ''), 'facts', coalesce(p_facts, '[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION commune_private.note_content(text, text, text, text, text, jsonb) FROM PUBLIC;

-- A task or event as it will be stored. People are member ids; the
-- operation_people trigger (0020) checks them and copies their names.
CREATE FUNCTION commune_private.operation_content(p_kind text, p_category text, p_title text, p_date date,
  p_time time, p_all_day boolean, p_assignee_id text, p_rotation_ids jsonb, p_repeat text, p_notes text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE v_title text := btrim(coalesce(p_title, ''));
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('task', 'event') THEN
    RAISE EXCEPTION 'Choose a task or an event' USING ERRCODE = '22023';
  END IF;
  IF p_category IS NULL OR p_category NOT IN ('chore', 'delivery', 'visit', 'appointment', 'other') THEN
    RAISE EXCEPTION 'Choose what kind of event this is' USING ERRCODE = '22023';
  END IF;
  IF length(v_title) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Give it a title of up to 80 characters' USING ERRCODE = '22023';
  END IF;
  IF p_date IS NULL OR p_all_day IS NULL THEN
    RAISE EXCEPTION 'Choose a date, and all day or a time' USING ERRCODE = '22023';
  END IF;
  IF p_repeat IS NULL OR p_repeat NOT IN ('none', 'weekly', 'monthly') THEN
    RAISE EXCEPTION 'Choose how often it repeats' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(p_notes, '')) > 1000 THEN
    RAISE EXCEPTION 'Keep the details to 1000 characters' USING ERRCODE = '22023';
  END IF;
  -- Keys are the column names, so jsonb_populate_record can read it back.
  RETURN jsonb_build_object('kind', p_kind, 'category', p_category, 'title', v_title, 'date', p_date,
    'time', p_time, 'all_day', p_all_day, 'assignee_id', nullif(p_assignee_id, ''),
    'rotation_ids', CASE WHEN p_rotation_ids = '[]'::jsonb THEN NULL ELSE p_rotation_ids END,
    'repeat', p_repeat, 'notes', coalesce(p_notes, ''));
END;
$$;
REVOKE ALL ON FUNCTION commune_private.operation_content(text, text, text, date, time, boolean, text, jsonb, text, text) FROM PUBLIC;

-- Any member adds a note. A retry with the same request id returns it, unless
-- it has since been removed.
CREATE FUNCTION public.create_note(p_commune_id uuid, p_title text, p_pill text, p_kicker text,
  p_lede text, p_body text, p_facts jsonb, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_card jsonb;
  v_new public.commune_notes%ROWTYPE;
  v_existing public.commune_notes%ROWTYPE;
  v_id uuid;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to add a note' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_commune_member(p_commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  v_card := commune_private.note_content(p_title, p_pill, p_kicker, p_lede, p_body, p_facts);
  -- Serialise adds in one commune so the limit holds and a retry finds its note.
  PERFORM 1 FROM public.communes WHERE id = p_commune_id FOR UPDATE;
  SELECT * INTO v_existing FROM public.commune_notes WHERE created_by = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.commune_id <> p_commune_id OR v_existing.request_digest IS DISTINCT FROM md5(v_card::text) THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    -- A late retry must not hand back a note that has since been removed.
    IF v_existing.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'This note has been removed' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'version', v_existing.version, 'duplicate', true);
  END IF;
  IF (SELECT count(*) FROM public.commune_notes WHERE commune_id = p_commune_id AND deleted_at IS NULL) >= 500 THEN
    RAISE EXCEPTION 'This commune already has 500 notes. Remove one you no longer need first.' USING ERRCODE = 'P0001';
  END IF;
  v_new := jsonb_populate_record(NULL::public.commune_notes, v_card);
  INSERT INTO public.commune_notes (commune_id, title, pill, kicker, lede, body, facts, created_by, request_id, request_digest)
    VALUES (p_commune_id, v_new.title, v_new.pill, v_new.kicker, v_new.lede, v_new.body, v_new.facts, v_actor,
      p_request_id, md5(v_card::text))
    RETURNING id INTO v_id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (p_commune_id, v_actor, 'notes', v_id, v_new.title, 'Created');
  RETURN jsonb_build_object('id', v_id, 'version', 1, 'duplicate', false);
END;
$$;

-- Any member edits a note, naming the version the edit started from. The
-- note_revision trigger (0023) keeps the content it replaces.
CREATE FUNCTION public.update_note(p_note_id uuid, p_expected_version integer, p_title text, p_pill text,
  p_kicker text, p_lede text, p_body text, p_facts jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_note public.commune_notes%ROWTYPE;
  v_card jsonb;
  v_new public.commune_notes%ROWTYPE;
  v_version integer;
BEGIN
  SELECT * INTO v_note FROM public.commune_notes WHERE id = p_note_id FOR UPDATE;
  IF v_note.id IS NULL OR NOT public.is_commune_member(v_note.commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  IF p_expected_version IS NULL THEN
    RAISE EXCEPTION 'Say which version of the note this change is based on' USING ERRCODE = '22023';
  END IF;
  v_card := commune_private.note_content(p_title, p_pill, p_kicker, p_lede, p_body, p_facts);
  IF v_note.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This note has been removed' USING ERRCODE = 'P0001';
  END IF;
  -- Saving what is already there changes nothing. A retry of a save that
  -- went through is then not mistaken for someone else's change.
  IF v_card = jsonb_build_object('title', v_note.title, 'pill', v_note.pill, 'kicker', v_note.kicker,
      'lede', v_note.lede, 'body', v_note.body, 'facts', v_note.facts) THEN
    RETURN jsonb_build_object('id', v_note.id, 'version', v_note.version, 'duplicate', true);
  END IF;
  IF p_expected_version <> v_note.version THEN
    RAISE EXCEPTION 'This note was changed by someone else. Review the latest version before saving your changes.'
      USING ERRCODE = 'P0001';
  END IF;
  v_new := jsonb_populate_record(NULL::public.commune_notes, v_card);
  UPDATE public.commune_notes SET title = v_new.title, pill = v_new.pill, kicker = v_new.kicker, lede = v_new.lede,
      body = v_new.body, facts = v_new.facts
    WHERE id = p_note_id RETURNING version INTO v_version;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_note.commune_id, v_actor, 'notes', v_note.id, v_new.title, 'Updated');
  RETURN jsonb_build_object('id', v_note.id, 'version', v_version, 'duplicate', false);
END;
$$;

-- The person who added a note or an admin removes it. The row and its
-- revisions stay; the snapshot, search and every list leave it out.
CREATE FUNCTION public.remove_note(p_note_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_note public.commune_notes%ROWTYPE;
BEGIN
  SELECT * INTO v_note FROM public.commune_notes WHERE id = p_note_id FOR UPDATE;
  IF v_note.id IS NULL OR NOT public.is_commune_member(v_note.commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  IF v_note.created_by <> v_actor AND NOT public.is_commune_admin(v_note.commune_id) THEN
    RAISE EXCEPTION 'Only the person who added this note or an admin can remove it' USING ERRCODE = '42501';
  END IF;
  IF v_note.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_note.id, 'version', v_note.version, 'duplicate', true);
  END IF;
  UPDATE public.commune_notes SET deleted_at = now(), deleted_by = v_actor WHERE id = p_note_id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_note.commune_id, v_actor, 'notes', v_note.id, v_note.title, 'Removed');
  RETURN jsonb_build_object('id', v_note.id, 'version', v_note.version, 'duplicate', false);
END;
$$;

-- Any member adds a task or event. It starts open and not yet done; only
-- the occurrence commands (0018, 0024) complete, skip or reopen it.
CREATE FUNCTION public.create_operation(p_commune_id uuid, p_kind text, p_category text, p_title text,
  p_date date, p_time time, p_all_day boolean, p_assignee_id text, p_rotation_ids jsonb, p_repeat text,
  p_notes text, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_item jsonb;
  v_new public.commune_operations%ROWTYPE;
  v_existing public.commune_operations%ROWTYPE;
  v_id uuid;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to add a task or event' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_commune_member(p_commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  v_item := commune_private.operation_content(p_kind, p_category, p_title, p_date, p_time, p_all_day,
    p_assignee_id, p_rotation_ids, p_repeat, p_notes);
  PERFORM 1 FROM public.communes WHERE id = p_commune_id FOR UPDATE;
  SELECT * INTO v_existing FROM public.commune_operations WHERE created_by = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.commune_id <> p_commune_id OR v_existing.request_digest IS DISTINCT FROM md5(v_item::text) THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    -- A late retry must not hand back a task or event that has since been removed.
    IF v_existing.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'This % has been removed', v_existing.kind USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'version', v_existing.version, 'duplicate', true);
  END IF;
  IF (SELECT count(*) FROM public.commune_operations WHERE commune_id = p_commune_id AND deleted_at IS NULL) >= 1000 THEN
    RAISE EXCEPTION 'This commune already has 1,000 tasks and events. Remove some you no longer need first.'
      USING ERRCODE = 'P0001';
  END IF;
  v_new := jsonb_populate_record(NULL::public.commune_operations, v_item);
  INSERT INTO public.commune_operations (commune_id, kind, category, title, date, time, all_day,
      assignee_id, rotation_ids, repeat, notes, created_by, request_id, request_digest)
    VALUES (p_commune_id, v_new.kind, v_new.category, v_new.title, v_new.date, v_new.time, v_new.all_day,
      v_new.assignee_id, v_new.rotation_ids, v_new.repeat, v_new.notes, v_actor, p_request_id, md5(v_item::text))
    RETURNING id INTO v_id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (p_commune_id, v_actor, 'operations', v_id, v_new.title, 'Created');
  RETURN jsonb_build_object('id', v_id, 'version', 1, 'duplicate', false);
END;
$$;

-- Any member edits what a task or event is, when it happens and who does
-- it, naming the version the edit started from. There is no way to set its
-- status, completion or timestamps here.
CREATE FUNCTION public.update_operation(p_operation_id uuid, p_expected_version integer, p_kind text,
  p_category text, p_title text, p_date date, p_time time, p_all_day boolean, p_assignee_id text,
  p_rotation_ids jsonb, p_repeat text, p_notes text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_commune_id uuid;
  v_op public.commune_operations%ROWTYPE;
  v_item jsonb;
  v_new public.commune_operations%ROWTYPE;
  v_version integer;
BEGIN
  -- The commune first, then the task: the order a member leaving takes them
  -- in (manage_commune_member, then reassign_departed_member). The other
  -- order lets the two wait on each other until one fails as a deadlock.
  SELECT commune_id INTO v_commune_id FROM public.commune_operations WHERE id = p_operation_id;
  PERFORM 1 FROM public.communes WHERE id = v_commune_id FOR UPDATE;
  SELECT * INTO v_op FROM public.commune_operations WHERE id = p_operation_id FOR UPDATE;
  IF v_op.id IS NULL OR NOT public.is_commune_member(v_op.commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  IF p_expected_version IS NULL THEN
    RAISE EXCEPTION 'Say which version of the task this change is based on' USING ERRCODE = '22023';
  END IF;
  v_item := commune_private.operation_content(p_kind, p_category, p_title, p_date, p_time, p_all_day,
    p_assignee_id, p_rotation_ids, p_repeat, p_notes);
  IF v_op.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This % has been removed', v_op.kind USING ERRCODE = 'P0001';
  END IF;
  -- Saving what is already there changes nothing, so a retry of a save that
  -- went through is not mistaken for someone else's change. A name kept from
  -- before member ids (0020) is cleared by any save.
  IF v_item = jsonb_build_object('kind', v_op.kind, 'category', v_op.category, 'title', v_op.title, 'date', v_op.date,
      'time', v_op.time, 'all_day', v_op.all_day, 'assignee_id', v_op.assignee_id, 'rotation_ids', v_op.rotation_ids,
      'repeat', v_op.repeat, 'notes', v_op.notes)
     AND (v_op.assignee_id IS NOT NULL OR v_op.assignee IS NULL)
     AND (v_op.rotation_ids IS NOT NULL OR v_op.rotation IS NULL) THEN
    RETURN jsonb_build_object('id', v_op.id, 'version', v_op.version, 'duplicate', true);
  END IF;
  IF p_expected_version <> v_op.version THEN
    RAISE EXCEPTION 'This % was changed by someone else. Review the latest version before saving your changes.', v_op.kind
      USING ERRCODE = 'P0001';
  END IF;
  v_new := jsonb_populate_record(NULL::public.commune_operations, v_item);
  -- The operation_people trigger checks the people, copies their names and
  -- ends a cover when they change; operation_anchor resets the monthly day.
  UPDATE public.commune_operations SET kind = v_new.kind, category = v_new.category, title = v_new.title,
      date = v_new.date, time = v_new.time, all_day = v_new.all_day,
      assignee = NULL, assignee_id = v_new.assignee_id, rotation = NULL, rotation_ids = v_new.rotation_ids,
      repeat = v_new.repeat, notes = v_new.notes, updated_at = now()
    WHERE id = p_operation_id RETURNING version INTO v_version;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_op.commune_id, v_actor, 'operations', v_op.id, v_new.title, 'Updated');
  RETURN jsonb_build_object('id', v_op.id, 'version', v_version, 'duplicate', false);
END;
$$;

-- The person who added a task or event or an admin removes it. The row and
-- its occurrences stay; the snapshot, search and every list leave it out.
CREATE FUNCTION public.remove_operation(p_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_commune_id uuid;
  v_op public.commune_operations%ROWTYPE;
  v_version integer;
BEGIN
  -- The commune first, then the task, as in update_operation.
  SELECT commune_id INTO v_commune_id FROM public.commune_operations WHERE id = p_operation_id;
  PERFORM 1 FROM public.communes WHERE id = v_commune_id FOR UPDATE;
  SELECT * INTO v_op FROM public.commune_operations WHERE id = p_operation_id FOR UPDATE;
  IF v_op.id IS NULL OR NOT public.is_commune_member(v_op.commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  IF v_op.created_by <> v_actor AND NOT public.is_commune_admin(v_op.commune_id) THEN
    RAISE EXCEPTION 'Only the person who added this or an admin can remove it' USING ERRCODE = '42501';
  END IF;
  IF v_op.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_op.id, 'version', v_op.version, 'duplicate', true);
  END IF;
  -- A command write, as completion is: the people and date stay as they are.
  PERFORM set_config('commune.occurrence_event', 'on', true);
  UPDATE public.commune_operations SET deleted_at = now(), deleted_by = v_actor WHERE id = p_operation_id
    RETURNING version INTO v_version;
  PERFORM set_config('commune.occurrence_event', 'off', true);
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_op.commune_id, v_actor, 'operations', v_op.id, v_op.title, 'Removed');
  RETURN jsonb_build_object('id', v_op.id, 'version', v_version, 'duplicate', false);
END;
$$;

-- A removed task cannot be completed, skipped, reopened, handed over or
-- undone. Retries of earlier actions still return what they did. A member
-- leaving no longer touches tasks that were removed.
DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('public.record_operation_occurrence(uuid,text,date,date,uuid,text)'::regprocedure);
  v_source := replace(v_original,
    '  IF p_action IS NULL OR p_action NOT IN (''completed'', ''skipped'', ''reopened'') THEN',
    '  IF v_op.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION ''This task has been removed'' USING ERRCODE = ''P0001'';
  END IF;
  IF p_action IS NULL OR p_action NOT IN (''completed'', ''skipped'', ''reopened'') THEN');
  IF v_source = v_original OR position('v_op.deleted_at IS NOT NULL' IN v_source) = 0 THEN
    RAISE EXCEPTION 'Unsupported occurrence definition';
  END IF;
  EXECUTE v_source;

  v_original := pg_get_functiondef('public.hand_over_operation(uuid,text,date,text,date,text,uuid)'::regprocedure);
  v_source := replace(v_original,
    '  IF p_today IS NULL OR p_today NOT BETWEEN current_date - 1 AND current_date + 1 THEN',
    '  IF v_op.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION ''This task has been removed'' USING ERRCODE = ''P0001'';
  END IF;
  IF p_today IS NULL OR p_today NOT BETWEEN current_date - 1 AND current_date + 1 THEN');
  IF v_source = v_original OR position('v_op.deleted_at IS NOT NULL' IN v_source) = 0 THEN
    RAISE EXCEPTION 'Unsupported handover definition';
  END IF;
  EXECUTE v_source;

  v_original := pg_get_functiondef('public.undo_operation_occurrence(uuid)'::regprocedure);
  v_source := replace(v_original,
    '  IF EXISTS (SELECT 1 FROM public.operation_occurrences later WHERE later.operation_id = v_op.id',
    '  IF v_op.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION ''This task has been removed'' USING ERRCODE = ''P0001'';
  END IF;
  IF EXISTS (SELECT 1 FROM public.operation_occurrences later WHERE later.operation_id = v_op.id');
  IF v_source = v_original OR position('v_op.deleted_at IS NOT NULL' IN v_source) = 0 THEN
    RAISE EXCEPTION 'Unsupported undo definition';
  END IF;
  EXECUTE v_source;

  v_original := pg_get_functiondef('commune_private.reassign_departed_member()'::regprocedure);
  v_source := replace(v_original,
    'WHERE o.commune_id = NEW.commune_id
      AND (o.assignee_id = NEW.user_id',
    'WHERE o.commune_id = NEW.commune_id AND o.deleted_at IS NULL
      AND (o.assignee_id = NEW.user_id');
  IF v_source = v_original OR position('o.deleted_at IS NULL' IN v_source) = 0 THEN
    RAISE EXCEPTION 'Unsupported departure definition';
  END IF;
  EXECUTE v_source;
END;
$$;

-- The snapshot leaves removed notes out. Search leaves out removed notes and
-- tasks. Only those parts of the shared functions change.
DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('public.commune_snapshot(uuid)'::regprocedure);
  v_source := replace(v_original, 'FROM public.commune_notes n WHERE n.commune_id=co.id)',
    'FROM public.commune_notes n WHERE n.commune_id=co.id AND n.deleted_at IS NULL)');
  IF v_source = v_original OR position('n.deleted_at IS NULL' IN v_source) = 0 THEN
    RAISE EXCEPTION 'Unsupported snapshot definition';
  END IF;
  EXECUTE v_source;

  v_original := pg_get_functiondef('public.search_commune_records(text,uuid,integer)'::regprocedure);
  v_source := replace(v_original, 'FROM public.commune_notes n JOIN allowed co ON co.id=n.commune_id',
    'FROM public.commune_notes n JOIN allowed co ON co.id=n.commune_id WHERE n.deleted_at IS NULL');
  v_source := replace(v_source, 'FROM public.commune_operations o JOIN allowed co ON co.id=o.commune_id',
    'FROM public.commune_operations o JOIN allowed co ON co.id=o.commune_id WHERE o.deleted_at IS NULL');
  IF position('n.deleted_at IS NULL' IN v_source) = 0 OR position('o.deleted_at IS NULL' IN v_source) = 0 THEN
    RAISE EXCEPTION 'Unsupported search definition';
  END IF;
  EXECUTE v_source;
END;
$$;

-- Tasks in the snapshot carry their version, for edits, and who added them,
-- for removal. Removed tasks are left out. Otherwise as in 0024.
CREATE OR REPLACE FUNCTION commune_private.snapshot_operations(p_commune_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'hubId',o.commune_id,'kind',o.kind,'category',o.category,'title',o.title,'date',o.date,'time',o.time,'allDay',o.all_day,
      'version',o.version,'createdBy',o.created_by,
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
    FROM public.commune_operations o WHERE o.commune_id=p_commune_id AND o.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.create_note(uuid, text, text, text, text, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_note(uuid, text, text, text, text, text, jsonb, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.update_note(uuid, integer, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_note(uuid, integer, text, text, text, text, text, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.remove_note(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_note(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.create_operation(uuid, text, text, text, date, time, boolean, text, jsonb, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_operation(uuid, text, text, text, date, time, boolean, text, jsonb, text, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.update_operation(uuid, integer, text, text, text, date, time, boolean, text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_operation(uuid, integer, text, text, text, date, time, boolean, text, jsonb, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.remove_operation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_operation(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
