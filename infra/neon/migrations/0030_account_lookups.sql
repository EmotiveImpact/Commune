-- Names and emails are looked up by account id. Commune keeps account ids as
-- text, because auth.user_id() returns text, while Managed Neon Auth keys
-- accounts by uuid. Every lookup compared u.id::text with an id, which cannot
-- use that key, so each one read every account on the platform, and a
-- household's task list made thousands of them. Lookups now go through
-- commune_private.accounts, which compares uuid with uuid, and the task list
-- resolves its names once per snapshot. No client change is needed. The
-- reminder worker's invitation sender uses the same lookup, so deploy it
-- after this migration. Apply after 0029.
BEGIN;

-- The accounts with these ids. An id that is not a uuid matches no one and
-- never raises (0008). The local adapter and the test stub key accounts by
-- text rather than uuid, so the comparison is chosen when the lookup runs.
CREATE FUNCTION commune_private.accounts(p_ids text[])
RETURNS TABLE (id text, name text, email text, "emailVerified" boolean)
LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'neon_auth."user"'::regclass
      AND a.attname = 'id' AND a.atttypid = 'uuid'::regtype) THEN
    RETURN QUERY SELECT u.id::text, u.name::text, u.email::text, u."emailVerified"::boolean
      FROM neon_auth."user" u
      WHERE u.id = ANY (ARRAY(SELECT k.id::uuid FROM unnest(p_ids) k(id)
        WHERE k.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'));
  ELSE
    RETURN QUERY SELECT u.id::text, u.name::text, u.email::text, u."emailVerified"::boolean
      FROM neon_auth."user" u
      WHERE u.id::text = ANY (p_ids);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION commune_private.accounts(text[]) FROM PUBLIC;

-- Each function below read neon_auth."user" by id::text. Only that part
-- changes: lists look up all their people in one call, single lookups by id.
DO $$
DECLARE v_patch record; v_original text; v_source text;
BEGIN
  FOR v_patch IN SELECT * FROM (VALUES
    ('commune_private.member_name(text)',
     'FROM neon_auth."user" u WHERE u.id::text = p_user_id',
     'FROM commune_private.accounts(ARRAY[p_user_id]) u'),
    ('commune_private.member_by_name(uuid,text)',
     'JOIN neon_auth."user" u ON u.id::text = m.user_id',
     'JOIN commune_private.accounts(ARRAY(SELECT x.user_id FROM public.commune_members x WHERE x.commune_id = p_commune_id AND x.active)) u ON u.id = m.user_id'),
    ('public.member_profiles(uuid)',
     'JOIN neon_auth."user" u ON u.id::text = m.user_id',
     'JOIN commune_private.accounts(ARRAY(SELECT x.user_id FROM public.commune_members x WHERE x.commune_id = p_commune_id)) u ON u.id = m.user_id'),
    ('public.member_profiles_with_status(uuid)',
     'LEFT JOIN neon_auth."user" u ON u.id::text = m.user_id',
     'LEFT JOIN commune_private.accounts(ARRAY(SELECT x.user_id FROM public.commune_members x WHERE x.commune_id = p_commune_id)) u ON u.id = m.user_id'),
    ('public.search_commune_records(text,uuid,integer)',
     'LEFT JOIN neon_auth."user" u ON u.id::text=m.user_id WHERE m.active',
     'LEFT JOIN commune_private.accounts(ARRAY(SELECT x.user_id FROM public.commune_members x JOIN allowed a ON a.id=x.commune_id WHERE x.active)) u ON u.id=m.user_id WHERE m.active'),
    ('public.correct_expense(uuid,integer,text,bigint,jsonb,date,text,text,text,uuid)',
     'LEFT JOIN neon_auth."user" u ON u.id::text = s.user_id',
     'LEFT JOIN commune_private.accounts(ARRAY(SELECT x.user_id FROM public.expense_shares x WHERE x.expense_id = p_expense_id)) u ON u.id = s.user_id'),
    ('commune_private.record_commune_change()',
     'FROM neon_auth."user" u WHERE u.id::text=NEW.user_id',
     'FROM commune_private.accounts(ARRAY[NEW.user_id]) u'),
    ('public.record_operation_occurrence(uuid,text,date,date,uuid,text)',
     'FROM neon_auth."user" u WHERE u.id::text = v_actor',
     'FROM commune_private.accounts(ARRAY[v_actor]) u'),
    ('public.create_commune_invite(uuid,text,text)',
     'JOIN neon_auth."user" u ON u.id::text=m.user_id',
     'JOIN commune_private.accounts(ARRAY(SELECT x.user_id FROM public.commune_members x WHERE x.commune_id=p_commune_id AND x.active)) u ON u.id=m.user_id'),
    ('public.preview_commune_invite(text)',
     'FROM neon_auth."user" u',
     'FROM commune_private.accounts(ARRAY[commune_private.data_api_user_id()]) u'),
    ('public.preview_commune_invite(text)',
     'WHERE u.id::text = commune_private.data_api_user_id() AND u."emailVerified" IS TRUE',
     'WHERE u."emailVerified" IS TRUE'),
    ('public.accept_commune_invite(text)',
     'FROM neon_auth."user" WHERE id::text=v_actor AND "emailVerified" IS TRUE',
     'FROM commune_private.accounts(ARRAY[v_actor]) WHERE "emailVerified" IS TRUE')
  ) AS p(fn, old_text, new_text) LOOP
    v_original := pg_get_functiondef(v_patch.fn::regprocedure);
    v_source := replace(v_original, v_patch.old_text, v_patch.new_text);
    IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported definition of %', v_patch.fn; END IF;
    EXECUTE v_source;
  END LOOP;
END;
$$;

-- Every current and former member's name in a commune, keyed by account id,
-- from one lookup.
CREATE FUNCTION commune_private.member_names(p_commune_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_object_agg(a.id, left(coalesce(a.name, 'Member'), 80)), '{}'::jsonb)
  FROM commune_private.accounts(ARRAY(SELECT m.user_id FROM public.commune_members m WHERE m.commune_id = p_commune_id)) a;
$$;
REVOKE ALL ON FUNCTION commune_private.member_names(uuid) FROM PUBLIC;

-- The task list names each task's people, its rotation and its last twelve
-- actions. It now reads those names from member_names, made once, and looks
-- up only an id that is not there (an account that no longer exists).
DO $$
DECLARE v_original text; v_source text; v_id text; v_calls integer; v_wrapped integer;
BEGIN
  v_original := pg_get_functiondef('commune_private.snapshot_operations(uuid)'::regprocedure);
  v_source := replace(v_original, '  SELECT coalesce(jsonb_agg(jsonb_build_object(''id'',o.id,',
    '  WITH names AS MATERIALIZED (SELECT commune_private.member_names(p_commune_id) AS map)
  SELECT coalesce(jsonb_agg(jsonb_build_object(''id'',o.id,');
  v_source := replace(v_source, 'FROM public.commune_operations o WHERE o.commune_id=p_commune_id',
    'FROM public.commune_operations o CROSS JOIN names WHERE o.commune_id=p_commune_id');
  FOREACH v_id IN ARRAY ARRAY['o.assignee_id', 'o.turn_owner_id', 'e.value', 'h.assignee_id', 'h.next_assignee_id'] LOOP
    v_source := replace(v_source, format('commune_private.member_name(%s)', v_id),
      format('coalesce(names.map->>%s, commune_private.member_name(%s))', v_id, v_id));
  END LOOP;
  v_calls := (length(v_source) - length(replace(v_source, 'commune_private.member_name(', ''))) / length('commune_private.member_name(');
  v_wrapped := (length(v_source) - length(replace(v_source, 'names.map->>', ''))) / length('names.map->>');
  IF position('AS MATERIALIZED' IN v_source) = 0 OR position('CROSS JOIN names' IN v_source) = 0
     OR v_wrapped = 0 OR v_calls <> v_wrapped THEN
    RAISE EXCEPTION 'Unsupported operations snapshot definition';
  END IF;
  EXECUTE v_source;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
