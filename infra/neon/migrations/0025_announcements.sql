-- Announcements: an admin posts a short notice to everyone in the commune
-- ("Boiler service on Thursday, please be in from 8"). An important one can
-- ask members to confirm they have seen it, and everyone can see who has.
-- A notice is never edited after posting; it is taken down instead, and the
-- record stays. Apply after 0024. Release with the matching web client.
BEGIN;

CREATE TABLE public.commune_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id uuid NOT NULL REFERENCES public.communes(id) ON DELETE CASCADE,
  author_id text NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 80),
  body text NOT NULL CHECK (length(body) <= 1000),
  needs_acknowledgement boolean NOT NULL DEFAULT false,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  archived_by text,
  CHECK ((archived_at IS NULL) = (archived_by IS NULL)),
  UNIQUE (author_id, request_id)
);
CREATE INDEX commune_announcements_active_idx
  ON public.commune_announcements (commune_id, created_at DESC) WHERE archived_at IS NULL;

CREATE TABLE public.announcement_acknowledgements (
  announcement_id uuid NOT NULL REFERENCES public.commune_announcements(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

ALTER TABLE public.commune_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_acknowledgements ENABLE ROW LEVEL SECURITY;
CREATE POLICY announcement_read ON public.commune_announcements FOR SELECT TO authenticated
  USING (public.is_commune_member(commune_id));
CREATE POLICY announcement_acknowledgement_read ON public.announcement_acknowledgements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.commune_announcements a
    WHERE a.id = announcement_id AND public.is_commune_member(a.commune_id)));
GRANT SELECT ON public.commune_announcements, public.announcement_acknowledgements TO authenticated;
-- Deliberately no write grant: announcements change only through the RPCs below.

CREATE FUNCTION commune_private.announcement_result(p_id uuid, p_duplicate boolean)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object('id', a.id, 'duplicate', p_duplicate, 'archived', a.archived_at IS NOT NULL)
  FROM public.commune_announcements a WHERE a.id = p_id;
$$;
REVOKE ALL ON FUNCTION commune_private.announcement_result(uuid, boolean) FROM PUBLIC;

-- Admins post. A retry with the same request id returns the same notice.
CREATE FUNCTION public.post_announcement(p_commune_id uuid, p_title text, p_body text,
  p_needs_acknowledgement boolean, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_existing public.commune_announcements%ROWTYPE;
  v_id uuid;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to post an announcement' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_commune_admin(p_commune_id) THEN
    RAISE EXCEPTION 'Only an admin can post an announcement' USING ERRCODE = '42501';
  END IF;
  -- Serialise posts in one commune so the active limit holds.
  PERFORM 1 FROM public.communes WHERE id = p_commune_id FOR UPDATE;
  SELECT * INTO v_existing FROM public.commune_announcements WHERE author_id = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.commune_id <> p_commune_id OR v_existing.title <> v_title THEN
      RAISE EXCEPTION 'This request was already used for a different announcement' USING ERRCODE = '22023';
    END IF;
    RETURN commune_private.announcement_result(v_existing.id, true);
  END IF;
  IF length(v_title) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Give the announcement a title of up to 80 characters' USING ERRCODE = '22023';
  END IF;
  IF length(v_body) > 1000 THEN
    RAISE EXCEPTION 'Keep the announcement to 1000 characters' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.commune_announcements
      WHERE commune_id = p_commune_id AND archived_at IS NULL) >= 20 THEN
    RAISE EXCEPTION 'There are already 20 announcements up. Take one down first.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.commune_announcements (commune_id, author_id, title, body, needs_acknowledgement, request_id)
    VALUES (p_commune_id, v_actor, v_title, v_body, coalesce(p_needs_acknowledgement, false), p_request_id)
    RETURNING id INTO v_id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (p_commune_id, v_actor, 'announcements', v_id, v_title,
      CASE WHEN coalesce(p_needs_acknowledgement, false) THEN 'Posted. Please confirm you have seen it' ELSE 'Posted' END);
  RETURN commune_private.announcement_result(v_id, false);
END;
$$;

-- A member confirms they have seen an important notice. Repeating it is harmless.
CREATE FUNCTION public.acknowledge_announcement(p_announcement_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_announcement public.commune_announcements%ROWTYPE;
  v_inserted integer;
BEGIN
  SELECT * INTO v_announcement FROM public.commune_announcements WHERE id = p_announcement_id;
  IF v_announcement.id IS NULL OR NOT public.is_commune_member(v_announcement.commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  IF NOT v_announcement.needs_acknowledgement THEN
    RAISE EXCEPTION 'This announcement does not ask for confirmation' USING ERRCODE = '22023';
  END IF;
  IF v_announcement.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This announcement has been taken down' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.announcement_acknowledgements (announcement_id, user_id)
    VALUES (p_announcement_id, v_actor) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN commune_private.announcement_result(p_announcement_id, v_inserted = 0);
END;
$$;

-- The author or an admin takes a notice down. The record and who saw it remain.
CREATE FUNCTION public.archive_announcement(p_announcement_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_announcement public.commune_announcements%ROWTYPE;
BEGIN
  SELECT * INTO v_announcement FROM public.commune_announcements WHERE id = p_announcement_id FOR UPDATE;
  IF v_announcement.id IS NULL OR NOT public.is_commune_member(v_announcement.commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  IF v_announcement.author_id <> v_actor AND NOT public.is_commune_admin(v_announcement.commune_id) THEN
    RAISE EXCEPTION 'Only the person who posted it or an admin can take it down' USING ERRCODE = '42501';
  END IF;
  IF v_announcement.archived_at IS NOT NULL THEN
    RETURN commune_private.announcement_result(p_announcement_id, true);
  END IF;
  UPDATE public.commune_announcements SET archived_at = now(), archived_by = v_actor WHERE id = p_announcement_id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_announcement.commune_id, v_actor, 'announcements', p_announcement_id, v_announcement.title, 'Taken down');
  RETURN commune_private.announcement_result(p_announcement_id, false);
END;
$$;

CREATE FUNCTION commune_private.snapshot_announcements(p_commune_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'body', a.body, 'authorId', a.author_id,
      'createdAt', a.created_at, 'needsAcknowledgement', a.needs_acknowledgement,
      'acknowledgements', coalesce((SELECT jsonb_agg(jsonb_build_object('userId', k.user_id, 'acknowledgedAt', k.acknowledged_at)
        ORDER BY k.acknowledged_at) FROM public.announcement_acknowledgements k WHERE k.announcement_id = a.id), '[]'::jsonb))
    ORDER BY a.created_at DESC), '[]'::jsonb)
  FROM public.commune_announcements a WHERE a.commune_id = p_commune_id AND a.archived_at IS NULL;
$$;
REVOKE ALL ON FUNCTION commune_private.snapshot_announcements(uuid) FROM PUBLIC;

DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('public.commune_snapshot(uuid)'::regprocedure);
  v_source := replace(v_original, '''operations'',commune_private.snapshot_operations(co.id),',
    '''operations'',commune_private.snapshot_operations(co.id),
    ''announcements'',commune_private.snapshot_announcements(co.id),');
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported snapshot definition'; END IF;
  EXECUTE v_source;
END;
$$;

REVOKE ALL ON FUNCTION public.post_announcement(uuid, text, text, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_announcement(uuid, text, text, boolean, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.acknowledge_announcement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acknowledge_announcement(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.archive_announcement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_announcement(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
