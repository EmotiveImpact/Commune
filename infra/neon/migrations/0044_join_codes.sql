-- Join codes: a QR code that needs no email. An admin makes a code for their
-- commune, either one to show now (it stops working an hour later) or a
-- sticker for the fridge (it works until an admin turns it off or makes a new
-- one). Whoever scans it, once signed in, sees only the commune's name, kind
-- and how many people are in it, and can ask to join.
--
-- What happens next is a setting on the commune that only an admin changes:
--   approve  (the default) the request waits until an admin approves it;
--   instant  scanning adds them straight away;
--   off      codes do not work; email invitations still do.
-- The setting covers codes only. Email invitations are unchanged.
-- People who join by code always join as ordinary members, never admins.
--
-- Codes are kept as they are (not hashed) so an admin can show the same
-- sticker again later. They are read only through admin-checked functions;
-- clients have no grants on either table.
-- Depends on 0036 (change marks). Local only, like 0015 onwards.
BEGIN;

ALTER TABLE public.communes ADD COLUMN join_mode text NOT NULL DEFAULT 'approve'
  CONSTRAINT communes_join_mode_check CHECK (join_mode IN ('approve', 'instant', 'off'));

CREATE TABLE public.commune_join_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id uuid NOT NULL REFERENCES public.communes(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('sticker', 'now')),
  token text NOT NULL UNIQUE CHECK (token ~ '^[0-9a-f]{32}$'),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by text,
  request_id uuid NOT NULL,
  CONSTRAINT commune_join_codes_expiry CHECK ((kind = 'now') = (expires_at IS NOT NULL)),
  CONSTRAINT commune_join_codes_revoked CHECK ((revoked_at IS NULL) = (revoked_by IS NULL)),
  CONSTRAINT commune_join_codes_request UNIQUE (created_by, request_id)
);
CREATE INDEX commune_join_codes_commune_idx ON public.commune_join_codes (commune_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX commune_join_codes_one_sticker ON public.commune_join_codes (commune_id)
  WHERE kind = 'sticker' AND revoked_at IS NULL;

CREATE TABLE public.commune_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id uuid NOT NULL REFERENCES public.communes(id) ON DELETE CASCADE,
  code_id uuid NOT NULL REFERENCES public.commune_join_codes(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by text,
  request_id uuid NOT NULL,
  CONSTRAINT commune_join_requests_decided CHECK ((status = 'pending') = (decided_at IS NULL)),
  CONSTRAINT commune_join_requests_request UNIQUE (user_id, request_id)
);
CREATE UNIQUE INDEX commune_join_requests_one_pending ON public.commune_join_requests (commune_id, user_id)
  WHERE status = 'pending';
CREATE INDEX commune_join_requests_user_idx ON public.commune_join_requests (user_id, created_at DESC);

ALTER TABLE public.commune_join_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commune_join_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commune_join_codes FROM PUBLIC, authenticated, anonymous;
REVOKE ALL ON public.commune_join_requests FROM PUBLIC, authenticated, anonymous;

CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.commune_join_codes
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.commune_join_requests
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');

-- A code that still works: not turned off, not past its hour, the commune
-- still takes codes, and whoever made it is still an active admin there.
CREATE FUNCTION commune_private.live_join_code(p_token text)
RETURNS public.commune_join_codes LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT j.* FROM public.commune_join_codes j JOIN public.communes c ON c.id = j.commune_id
  WHERE p_token ~ '^[0-9a-f]{32}$' AND j.token = p_token AND j.revoked_at IS NULL
    AND (j.expires_at IS NULL OR j.expires_at > now()) AND c.join_mode <> 'off'
    AND EXISTS (SELECT 1 FROM public.commune_members m WHERE m.commune_id = j.commune_id
      AND m.user_id = j.created_by AND m.active AND m.role = 'admin');
$$;
REVOKE ALL ON FUNCTION commune_private.live_join_code(text) FROM PUBLIC;

-- Add someone as an ordinary member (or bring a former member back as one).
CREATE FUNCTION commune_private.add_member_by_code(p_commune_id uuid, p_user_id text)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.commune_members (commune_id, user_id, role) VALUES (p_commune_id, p_user_id, 'member')
    ON CONFLICT (commune_id, user_id) DO UPDATE SET role = 'member', active = true, left_at = NULL, joined_at = now()
    WHERE NOT public.commune_members.active;
END;
$$;
REVOKE ALL ON FUNCTION commune_private.add_member_by_code(uuid, text) FROM PUBLIC;

-- The commune's join setting, its working codes and the people waiting.
-- Admins only; a member who is not an admin gets the setting and nothing else.
CREATE FUNCTION public.commune_join_state(p_commune_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_mode text;
BEGIN
  IF NOT public.is_commune_member(p_commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  SELECT join_mode INTO v_mode FROM public.communes WHERE id = p_commune_id;
  IF NOT public.is_commune_admin(p_commune_id) THEN
    RETURN jsonb_build_object('joinMode', v_mode, 'codes', '[]'::jsonb, 'requests', '[]'::jsonb);
  END IF;
  RETURN jsonb_build_object('joinMode', v_mode,
    'codes', coalesce((SELECT jsonb_agg(jsonb_build_object('id', j.id, 'kind', j.kind, 'token', j.token,
        'createdAt', j.created_at, 'expiresAt', j.expires_at) ORDER BY j.created_at DESC)
      FROM public.commune_join_codes j WHERE j.commune_id = p_commune_id AND j.revoked_at IS NULL
        AND (j.expires_at IS NULL OR j.expires_at > now())), '[]'::jsonb),
    'requests', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'userId', r.user_id,
        'name', coalesce(nullif(btrim(a.name), ''), 'Someone'), 'email', a.email, 'createdAt', r.created_at,
        'codeKind', j.kind) ORDER BY r.created_at)
      FROM public.commune_join_requests r JOIN public.commune_join_codes j ON j.id = r.code_id
      LEFT JOIN commune_private.accounts(ARRAY(SELECT x.user_id FROM public.commune_join_requests x
        WHERE x.commune_id = p_commune_id AND x.status = 'pending')) a ON a.id = r.user_id
      WHERE r.commune_id = p_commune_id AND r.status = 'pending'), '[]'::jsonb));
END;
$$;

-- Change how a scan joins. Setting the same value again is harmless.
-- Turning codes off also turns off every working code.
CREATE FUNCTION public.set_commune_join_mode(p_commune_id uuid, p_mode text, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_mode text := lower(btrim(coalesce(p_mode, '')));
  v_old text;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required' USING ERRCODE = '22023';
  END IF;
  IF v_mode NOT IN ('approve', 'instant', 'off') THEN
    RAISE EXCEPTION 'Choose approve, instant or off' USING ERRCODE = '22023';
  END IF;
  SELECT join_mode INTO v_old FROM public.communes WHERE id = p_commune_id FOR UPDATE;
  IF NOT public.is_commune_admin(p_commune_id) THEN
    RAISE EXCEPTION 'Only an admin can change how people join' USING ERRCODE = '42501';
  END IF;
  IF v_old IS DISTINCT FROM v_mode THEN
    UPDATE public.communes SET join_mode = v_mode WHERE id = p_commune_id;
    IF v_mode = 'off' THEN
      UPDATE public.commune_join_codes SET revoked_at = now(), revoked_by = v_actor
        WHERE commune_id = p_commune_id AND revoked_at IS NULL;
    END IF;
  END IF;
  RETURN public.commune_join_state(p_commune_id);
END;
$$;

-- Make a code. A new sticker replaces the old one, which stops working.
-- Running the same request again returns the same code.
CREATE FUNCTION public.create_join_code(p_commune_id uuid, p_kind text, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_kind text := lower(btrim(coalesce(p_kind, '')));
  v_code public.commune_join_codes%ROWTYPE;
  v_mode text;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required' USING ERRCODE = '22023';
  END IF;
  IF v_kind NOT IN ('sticker', 'now') THEN
    RAISE EXCEPTION 'Choose a sticker or a code to show now' USING ERRCODE = '22023';
  END IF;
  SELECT join_mode INTO v_mode FROM public.communes WHERE id = p_commune_id FOR UPDATE;
  IF NOT public.is_commune_admin(p_commune_id) THEN
    RAISE EXCEPTION 'Only an admin can make a join code' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_code FROM public.commune_join_codes WHERE created_by = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_code.commune_id <> p_commune_id OR v_code.kind <> v_kind THEN
      RAISE EXCEPTION 'This request was already used for a different code' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF v_mode = 'off' THEN
      RAISE EXCEPTION 'Joining by code is turned off for this commune' USING ERRCODE = 'P0001';
    END IF;
    IF (SELECT count(*) FROM public.commune_join_codes WHERE commune_id = p_commune_id
        AND created_at > now() - interval '1 hour') >= 30 THEN
      RAISE EXCEPTION 'Too many codes made in the last hour. Try again later.' USING ERRCODE = 'P0001';
    END IF;
    IF v_kind = 'sticker' THEN
      UPDATE public.commune_join_codes SET revoked_at = now(), revoked_by = v_actor
        WHERE commune_id = p_commune_id AND kind = 'sticker' AND revoked_at IS NULL;
    END IF;
    INSERT INTO public.commune_join_codes (commune_id, kind, token, created_by, expires_at, request_id)
      VALUES (p_commune_id, v_kind, encode(gen_random_bytes(16), 'hex'), v_actor,
        CASE WHEN v_kind = 'now' THEN now() + interval '1 hour' END, p_request_id)
      RETURNING * INTO v_code;
  END IF;
  RETURN jsonb_build_object('id', v_code.id, 'kind', v_code.kind, 'token', v_code.token,
    'createdAt', v_code.created_at, 'expiresAt', v_code.expires_at, 'revokedAt', v_code.revoked_at);
END;
$$;

-- Turn a code off. Turning it off twice is harmless.
CREATE FUNCTION public.revoke_join_code(p_code_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_commune uuid;
BEGIN
  SELECT commune_id INTO v_commune FROM public.commune_join_codes WHERE id = p_code_id;
  PERFORM 1 FROM public.communes WHERE id = v_commune FOR UPDATE;
  IF v_commune IS NULL OR NOT public.is_commune_admin(v_commune) THEN
    RAISE EXCEPTION 'Only an admin can turn off a join code' USING ERRCODE = '42501';
  END IF;
  UPDATE public.commune_join_codes SET revoked_at = now(), revoked_by = commune_private.data_api_user_id()
    WHERE id = p_code_id AND revoked_at IS NULL;
END;
$$;

-- What someone who scanned a code may see before joining: the commune's
-- name and kind, how many people are in it and what happens when they ask.
-- Nothing about money or members. Empty when the code does not work.
CREATE FUNCTION public.preview_join_code(p_token text)
RETURNS TABLE(commune_name text, commune_kind text, member_count integer, join_mode text, already_member boolean, waiting boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_code public.commune_join_codes%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RETURN; END IF;
  v_code := commune_private.live_join_code(p_token);
  IF v_code.id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT c.name, c.kind,
    (SELECT count(*)::integer FROM public.commune_members m WHERE m.commune_id = c.id AND m.active),
    c.join_mode,
    EXISTS (SELECT 1 FROM public.commune_members m WHERE m.commune_id = c.id AND m.user_id = v_actor AND m.active),
    EXISTS (SELECT 1 FROM public.commune_join_requests r WHERE r.commune_id = c.id AND r.user_id = v_actor AND r.status = 'pending')
  FROM public.communes c WHERE c.id = v_code.commune_id;
END;
$$;

-- Ask to join with a code. With "approve" the request waits for an admin;
-- with "instant" they are added as a member now. Asking again, or running
-- the same request again, gives the same answer. The commune id is returned
-- only once they are in.
CREATE FUNCTION public.request_to_join(p_token text, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_code public.commune_join_codes%ROWTYPE;
  v_mode text;
  v_existing public.commune_join_requests%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in to ask to join' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_existing FROM public.commune_join_requests WHERE user_id = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('status', CASE v_existing.status WHEN 'approved' THEN 'joined' ELSE v_existing.status END,
      'requestId', v_existing.id,
      'communeId', CASE WHEN v_existing.status = 'approved' THEN v_existing.commune_id END);
  END IF;
  -- Lock the commune before reading the code, as invitations do.
  PERFORM 1 FROM public.communes c JOIN public.commune_join_codes j ON j.commune_id = c.id
    WHERE p_token ~ '^[0-9a-f]{32}$' AND j.token = p_token FOR UPDATE OF c;
  v_code := commune_private.live_join_code(p_token);
  IF v_code.id IS NULL THEN
    RAISE EXCEPTION 'This code no longer works. Ask for a new one.' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (SELECT 1 FROM public.commune_members WHERE commune_id = v_code.commune_id AND user_id = v_actor AND active) THEN
    RETURN jsonb_build_object('status', 'already_member', 'communeId', v_code.commune_id);
  END IF;
  SELECT * INTO v_existing FROM public.commune_join_requests
    WHERE commune_id = v_code.commune_id AND user_id = v_actor AND status = 'pending';
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'pending', 'requestId', v_existing.id);
  END IF;
  IF (SELECT count(*) FROM public.commune_join_requests WHERE user_id = v_actor AND status = 'pending') >= 10 THEN
    RAISE EXCEPTION 'You are already waiting on 10 communes. Wait for an answer first.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.commune_join_requests WHERE commune_id = v_code.commune_id AND status = 'pending') >= 50 THEN
    RAISE EXCEPTION 'This commune has too many people waiting. Ask an admin.' USING ERRCODE = 'P0001';
  END IF;
  SELECT join_mode INTO v_mode FROM public.communes WHERE id = v_code.commune_id;
  IF v_mode = 'instant' THEN
    PERFORM commune_private.add_member_by_code(v_code.commune_id, v_actor);
    INSERT INTO public.commune_join_requests (commune_id, code_id, user_id, status, decided_at, decided_by, request_id)
      VALUES (v_code.commune_id, v_code.id, v_actor, 'approved', now(), v_code.created_by, p_request_id)
      RETURNING id INTO v_id;
    RETURN jsonb_build_object('status', 'joined', 'requestId', v_id, 'communeId', v_code.commune_id);
  END IF;
  INSERT INTO public.commune_join_requests (commune_id, code_id, user_id, request_id)
    VALUES (v_code.commune_id, v_code.id, v_actor, p_request_id) RETURNING id INTO v_id;
  RETURN jsonb_build_object('status', 'pending', 'requestId', v_id);
END;
$$;

-- An admin approves or declines someone waiting. Approving adds them as an
-- ordinary member. Deciding the same way twice is harmless; changing a
-- decision already made is refused.
CREATE FUNCTION public.decide_join_request(p_join_request_id uuid, p_decision text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_request public.commune_join_requests%ROWTYPE;
  v_commune uuid;
  v_status text;
BEGIN
  IF v_decision NOT IN ('approve', 'decline') THEN
    RAISE EXCEPTION 'Choose approve or decline' USING ERRCODE = '22023';
  END IF;
  SELECT commune_id INTO v_commune FROM public.commune_join_requests WHERE id = p_join_request_id;
  PERFORM 1 FROM public.communes WHERE id = v_commune FOR UPDATE;
  IF v_commune IS NULL OR NOT public.is_commune_admin(v_commune) THEN
    RAISE EXCEPTION 'Only an admin can answer a request to join' USING ERRCODE = '42501';
  END IF;
  v_status := CASE v_decision WHEN 'approve' THEN 'approved' ELSE 'declined' END;
  SELECT * INTO v_request FROM public.commune_join_requests WHERE id = p_join_request_id FOR UPDATE;
  IF v_request.status = 'pending' THEN
    IF v_decision = 'approve' THEN
      PERFORM commune_private.add_member_by_code(v_request.commune_id, v_request.user_id);
    END IF;
    UPDATE public.commune_join_requests
      SET status = v_status, decided_at = now(), decided_by = v_actor
      WHERE id = p_join_request_id;
  ELSIF v_request.status <> v_status THEN
    RAISE EXCEPTION 'This request was already answered' USING ERRCODE = 'P0001';
  END IF;
  RETURN public.commune_join_state(v_request.commune_id);
END;
$$;

-- Your own requests still waiting, for the "Waiting for an admin" screen,
-- and taking one back.
CREATE FUNCTION public.my_join_requests()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'communeName', c.name, 'communeKind', c.kind,
      'createdAt', r.created_at) ORDER BY r.created_at DESC), '[]'::jsonb)
  FROM public.commune_join_requests r JOIN public.communes c ON c.id = r.commune_id
  WHERE r.user_id = commune_private.data_api_user_id() AND r.status = 'pending';
$$;

CREATE FUNCTION public.cancel_join_request(p_join_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.commune_join_requests SET status = 'cancelled', decided_at = now(), decided_by = user_id
    WHERE id = p_join_request_id AND user_id = commune_private.data_api_user_id() AND status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.commune_join_state(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_commune_join_mode(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_join_code(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_join_code(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.preview_join_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_to_join(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decide_join_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_join_requests() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_join_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commune_join_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_commune_join_mode(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_join_code(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_join_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_join_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_to_join(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_join_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_join_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_join_request(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
