-- Apply after infra/neon/migrations/0001-0003. Local-only adapter functions.
BEGIN;

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

-- Local development has no outbound email provider. A reminder really creates
-- a notification for the recipient, but its email job must not linger and be
-- delivered unexpectedly if a provider is connected later.
CREATE FUNCTION public.send_local_reminder(p_kind text, p_source_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  v_id := public.send_reminder(p_kind, p_source_id);
  UPDATE public.reminder_email_outbox
    SET status = 'suppressed', last_error = 'Email delivery not configured locally',
      updated_at = now()
    WHERE reminder_id = v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.send_local_reminder(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_local_reminder(text, uuid)
  TO authenticated;

-- Shared household content is persisted and visible only to commune members.
-- These are not money records, so collaborative CRUD is allowed through RLS.
CREATE TABLE public.commune_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id uuid NOT NULL REFERENCES public.communes(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  pill text NOT NULL DEFAULT '',
  kicker text NOT NULL DEFAULT '',
  lede text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  facts jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(facts) = 'array'),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (commune_id, created_by)
    REFERENCES public.commune_members(commune_id, user_id)
);
CREATE INDEX commune_notes_commune_idx ON public.commune_notes(commune_id, created_at DESC);
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
GRANT SELECT, DELETE ON public.commune_notes TO authenticated;
GRANT INSERT (commune_id, title, pill, kicker, lede, body, facts, created_by)
  ON public.commune_notes TO authenticated;
GRANT UPDATE (title, pill, kicker, lede, body, facts, updated_at)
  ON public.commune_notes TO authenticated;

CREATE TABLE public.commune_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id uuid NOT NULL REFERENCES public.communes(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('task', 'event')),
  category text NOT NULL CHECK (category IN ('chore', 'delivery', 'visit', 'appointment', 'other')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  date date NOT NULL,
  time time,
  all_day boolean NOT NULL DEFAULT true,
  assignee text,
  rotation jsonb CHECK (rotation IS NULL OR jsonb_typeof(rotation) = 'array'),
  last_done jsonb CHECK (last_done IS NULL OR jsonb_typeof(last_done) = 'object'),
  repeat text NOT NULL DEFAULT 'none' CHECK (repeat IN ('none', 'weekly', 'monthly')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  notes text NOT NULL DEFAULT '',
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
GRANT SELECT, DELETE ON public.commune_operations TO authenticated;
GRANT INSERT (commune_id, kind, category, title, date, time, all_day,
  assignee, rotation, last_done, repeat, status, notes, created_by)
  ON public.commune_operations TO authenticated;
GRANT UPDATE (kind, category, title, date, time, all_day, assignee,
  rotation, last_done, repeat, status, notes, updated_at)
  ON public.commune_operations TO authenticated;

COMMIT;
