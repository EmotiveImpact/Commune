-- Completing, skipping, reopening, handing over and undoing a task now lock
-- the commune before the task, as editing and removing have since 0027. A
-- member leaving locks the commune and then each of their tasks. These
-- commands locked the task first and needed the commune later, when the
-- occurrence or activity line they add takes a key-share lock on it through
-- its foreign key. So when a member left while someone acted on one of their
-- tasks, each waited on the other until PostgreSQL cancelled one as a
-- deadlock, and the action or the departure failed. Now the command waits
-- for the departure to finish, then finds the task as the departure left it
-- and goes ahead or is refused with its usual message.
--
-- Only the start of each function changes, so each is patched in place: the
-- task's commune is read without a lock and locked, then the task (for undo,
-- the task through its occurrence, then the occurrence) is locked and read
-- as before. A task never moves to another commune, so that commune is still
-- the task's once the locks are held, and every check runs on the task as it
-- is then. Nothing else locks a task or an occurrence before its commune:
-- adding a task locks the commune first, and the snapshot and search only
-- read. No client change. Apply after 0036.
BEGIN;

-- Each patch must apply, and leave the commune as the first row its
-- function locks.
DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('public.record_operation_occurrence(uuid,text,date,date,uuid,text)'::regprocedure);
  v_source := replace(v_original, '  v_op public.commune_operations%ROWTYPE;',
    '  v_commune_id uuid;
  v_op public.commune_operations%ROWTYPE;');
  v_source := replace(v_source,
    '  -- The row lock serialises two people acting on the same task.
  SELECT * INTO v_op FROM public.commune_operations WHERE id = p_operation_id FOR UPDATE;',
    '  -- The commune first, then the task, as in update_operation: the order a
  -- member leaving takes them in. The other order lets the two wait on each
  -- other until one fails as a deadlock.
  SELECT commune_id INTO v_commune_id FROM public.commune_operations WHERE id = p_operation_id;
  PERFORM 1 FROM public.communes WHERE id = v_commune_id FOR UPDATE;
  -- The row lock serialises two people acting on the same task.
  SELECT * INTO v_op FROM public.commune_operations WHERE id = p_operation_id FOR UPDATE;');
  IF position('  v_commune_id uuid;' IN v_source) = 0
     OR split_part(v_source, ' FOR UPDATE', 1) !~ 'PERFORM 1 FROM public\.communes WHERE id = v_commune_id$' THEN
    RAISE EXCEPTION 'Unsupported occurrence definition';
  END IF;
  EXECUTE v_source;

  v_original := pg_get_functiondef('public.hand_over_operation(uuid,text,date,text,date,text,uuid)'::regprocedure);
  v_source := replace(v_original, '  v_op public.commune_operations%ROWTYPE;',
    '  v_commune_id uuid;
  v_op public.commune_operations%ROWTYPE;');
  v_source := replace(v_source,
    '  SELECT * INTO v_op FROM public.commune_operations WHERE id = p_operation_id FOR UPDATE;',
    '  -- The commune first, then the task, as in update_operation.
  SELECT commune_id INTO v_commune_id FROM public.commune_operations WHERE id = p_operation_id;
  PERFORM 1 FROM public.communes WHERE id = v_commune_id FOR UPDATE;
  SELECT * INTO v_op FROM public.commune_operations WHERE id = p_operation_id FOR UPDATE;');
  IF position('  v_commune_id uuid;' IN v_source) = 0
     OR split_part(v_source, ' FOR UPDATE', 1) !~ 'PERFORM 1 FROM public\.communes WHERE id = v_commune_id$' THEN
    RAISE EXCEPTION 'Unsupported handover definition';
  END IF;
  EXECUTE v_source;

  v_original := pg_get_functiondef('public.undo_operation_occurrence(uuid)'::regprocedure);
  v_source := replace(v_original, '  v_op public.commune_operations%ROWTYPE;',
    '  v_commune_id uuid;
  v_op public.commune_operations%ROWTYPE;');
  v_source := replace(v_source,
    '  SELECT o.* INTO v_op FROM public.commune_operations o
    JOIN public.operation_occurrences h ON h.operation_id = o.id WHERE h.id = p_occurrence_id FOR UPDATE OF o;',
    '  -- The commune first, then the task, then the occurrence, as in
  -- update_operation.
  SELECT o.commune_id INTO v_commune_id FROM public.commune_operations o
    JOIN public.operation_occurrences h ON h.operation_id = o.id WHERE h.id = p_occurrence_id;
  PERFORM 1 FROM public.communes WHERE id = v_commune_id FOR UPDATE;
  SELECT o.* INTO v_op FROM public.commune_operations o
    JOIN public.operation_occurrences h ON h.operation_id = o.id WHERE h.id = p_occurrence_id FOR UPDATE OF o;');
  IF position('  v_commune_id uuid;' IN v_source) = 0
     OR split_part(v_source, ' FOR UPDATE', 1) !~ 'PERFORM 1 FROM public\.communes WHERE id = v_commune_id$' THEN
    RAISE EXCEPTION 'Unsupported undo definition';
  END IF;
  EXECUTE v_source;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
