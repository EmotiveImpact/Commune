-- Shared content previously existed only in the local adapter.
-- Managed Better Auth must already provide neon_auth."user" and auth.user_id().
-- The disposable local bootstrap uses the same schema; its after-core file
-- adds only send_local_reminder.
BEGIN;

-- Member details are private to the commune. The authenticated role does not
-- receive access to neon_auth."user"; this function returns only fellow members.
CREATE FUNCTION public.member_profiles(p_commune_id uuid)
RETURNS TABLE (id text, name text, email text, role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_commune_member(p_commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT u.id, u.name, u.email, m.role
  FROM public.commune_members m
  JOIN neon_auth."user" u ON u.id = m.user_id
  WHERE m.commune_id = p_commune_id
  ORDER BY m.joined_at;
END;
$$;
REVOKE ALL ON FUNCTION public.member_profiles(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.member_profiles(uuid) TO authenticated;

-- Notes and operations are commune-collaborative, unlike money or membership.
-- RLS checks the currently authenticated user on every read and write. The
-- following immutable validators also enforce the API's JSON limits when a
-- client writes through the Data API instead of the local HTTP adapter.
CREATE FUNCTION public.valid_note_facts(p_facts jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog AS $$
DECLARE
  v_fact jsonb;
  v_part jsonb;
BEGIN
  IF p_facts IS NULL OR jsonb_typeof(p_facts) <> 'array' THEN
    RETURN false;
  END IF;
  IF jsonb_array_length(p_facts) > 30 THEN
    RETURN false;
  END IF;
  FOR v_fact IN SELECT value FROM jsonb_array_elements(p_facts) LOOP
    IF jsonb_typeof(v_fact) <> 'array' THEN
      RETURN false;
    END IF;
    IF jsonb_array_length(v_fact) <> 2 THEN
      RETURN false;
    END IF;
    FOR v_part IN SELECT value FROM jsonb_array_elements(v_fact) LOOP
      IF jsonb_typeof(v_part) <> 'string'
         OR length(v_part #>> '{}') > 120 THEN
        RETURN false;
      END IF;
    END LOOP;
  END LOOP;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.valid_note_facts(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valid_note_facts(jsonb) TO authenticated;

CREATE FUNCTION public.valid_operation_rotation(p_rotation jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog AS $$
DECLARE
  v_member jsonb;
BEGIN
  IF p_rotation IS NULL THEN
    RETURN true;
  END IF;
  IF jsonb_typeof(p_rotation) <> 'array' THEN
    RETURN false;
  END IF;
  IF jsonb_array_length(p_rotation) > 50 THEN
    RETURN false;
  END IF;
  FOR v_member IN SELECT value FROM jsonb_array_elements(p_rotation) LOOP
    IF jsonb_typeof(v_member) <> 'string'
       OR length(v_member #>> '{}') > 80 THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.valid_operation_rotation(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valid_operation_rotation(jsonb) TO authenticated;

CREATE FUNCTION public.valid_operation_last_done(p_last_done jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = pg_catalog AS $$
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
    WHERE field.key NOT IN ('by', 'date')
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
$$;
REVOKE ALL ON FUNCTION public.valid_operation_last_done(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valid_operation_last_done(jsonb) TO authenticated;

CREATE TABLE public.commune_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id uuid NOT NULL REFERENCES public.communes(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 80),
  pill text NOT NULL DEFAULT '' CHECK (length(pill) <= 80),
  kicker text NOT NULL DEFAULT '' CHECK (length(kicker) <= 120),
  lede text NOT NULL DEFAULT '' CHECK (length(lede) <= 200),
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 2000),
  facts jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (public.valid_note_facts(facts)),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (commune_id, created_by)
    REFERENCES public.commune_members(commune_id, user_id)
);
CREATE INDEX commune_notes_commune_idx
  ON public.commune_notes(commune_id, created_at DESC);
ALTER TABLE public.commune_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY commune_notes_read ON public.commune_notes FOR SELECT TO authenticated
  USING (public.is_commune_member(commune_id));
CREATE POLICY commune_notes_insert ON public.commune_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_commune_member(commune_id) AND created_by = auth.user_id());
CREATE POLICY commune_notes_update ON public.commune_notes FOR UPDATE TO authenticated
  USING (public.is_commune_member(commune_id))
  WITH CHECK (public.is_commune_member(commune_id));
CREATE POLICY commune_notes_delete ON public.commune_notes FOR DELETE TO authenticated
  USING (public.is_commune_member(commune_id));
REVOKE ALL ON public.commune_notes FROM PUBLIC;
GRANT SELECT, DELETE ON public.commune_notes TO authenticated;
GRANT INSERT (commune_id, title, pill, kicker, lede, body, facts, created_by)
  ON public.commune_notes TO authenticated;
-- Neither commune_id nor created_by can be changed by a client.
GRANT UPDATE (title, pill, kicker, lede, body, facts, updated_at)
  ON public.commune_notes TO authenticated;

CREATE TABLE public.commune_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id uuid NOT NULL REFERENCES public.communes(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('task', 'event')),
  category text NOT NULL CHECK (category IN ('chore', 'delivery', 'visit', 'appointment', 'other')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 80),
  date date NOT NULL,
  time time,
  all_day boolean NOT NULL DEFAULT true,
  assignee text CHECK (assignee IS NULL OR length(assignee) <= 80),
  rotation jsonb CHECK (public.valid_operation_rotation(rotation)),
  last_done jsonb CHECK (public.valid_operation_last_done(last_done)),
  repeat text NOT NULL DEFAULT 'none' CHECK (repeat IN ('none', 'weekly', 'monthly')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 1000),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (commune_id, created_by)
    REFERENCES public.commune_members(commune_id, user_id)
);
CREATE INDEX commune_operations_commune_date_idx
  ON public.commune_operations(commune_id, date, time);
ALTER TABLE public.commune_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY commune_operations_read ON public.commune_operations FOR SELECT TO authenticated
  USING (public.is_commune_member(commune_id));
CREATE POLICY commune_operations_insert ON public.commune_operations FOR INSERT TO authenticated
  WITH CHECK (public.is_commune_member(commune_id) AND created_by = auth.user_id());
CREATE POLICY commune_operations_update ON public.commune_operations FOR UPDATE TO authenticated
  USING (public.is_commune_member(commune_id))
  WITH CHECK (public.is_commune_member(commune_id));
CREATE POLICY commune_operations_delete ON public.commune_operations FOR DELETE TO authenticated
  USING (public.is_commune_member(commune_id));
REVOKE ALL ON public.commune_operations FROM PUBLIC;
GRANT SELECT, DELETE ON public.commune_operations TO authenticated;
GRANT INSERT (commune_id, kind, category, title, date, time, all_day,
  assignee, rotation, last_done, repeat, status, notes, created_by)
  ON public.commune_operations TO authenticated;
GRANT UPDATE (kind, category, title, date, time, all_day, assignee,
  rotation, last_done, repeat, status, notes, updated_at)
  ON public.commune_operations TO authenticated;

COMMIT;
