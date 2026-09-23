-- A real commune requires two verified users. Invite links carry a random
-- bearer token; only its SHA-256 digest is stored. No client writes members.
-- Requires Managed Better Auth's neon_auth."user" table.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.commune_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id uuid NOT NULL REFERENCES public.communes(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  token_hash bytea NOT NULL UNIQUE,
  invited_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by text,
  revoked_at timestamptz,
  CHECK ((accepted_at IS NULL) = (accepted_by IS NULL)),
  CHECK (accepted_at IS NULL OR revoked_at IS NULL),
  FOREIGN KEY (commune_id, invited_by)
    REFERENCES public.commune_members (commune_id, user_id)
);
CREATE INDEX commune_invites_commune_idx ON public.commune_invites
  (commune_id, created_at DESC);
CREATE INDEX commune_invites_email_idx ON public.commune_invites
  (email, expires_at DESC) WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.commune_invites ENABLE ROW LEVEL SECURITY;
-- No direct client table privileges or policies. All invite access goes
-- through vetted functions, so token digests and acceptance cannot be edited.

CREATE FUNCTION public.create_commune_invite(
  p_commune_id uuid, p_email text, p_role text DEFAULT 'member'
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text;
BEGIN
  IF NOT public.is_commune_admin(p_commune_id) THEN
    RAISE EXCEPTION 'Only a commune admin can invite members'
      USING ERRCODE = '42501';
  END IF;
  IF length(v_email) > 254 OR
     v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     OR p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invalid invite details' USING ERRCODE = '22023';
  END IF;
  -- Serializes simultaneous invites for this commune and prevents duplicate
  -- unexpired links for one email, including when two admins click together.
  PERFORM 1 FROM public.communes WHERE id = p_commune_id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.commune_members m
    JOIN neon_auth."user" u ON u.id = m.user_id
    WHERE m.commune_id = p_commune_id AND lower(u.email) = v_email
  ) THEN
    RAISE EXCEPTION 'This person is already a member' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.commune_invites
    SET revoked_at = now()
    WHERE commune_id = p_commune_id AND email = v_email
      AND accepted_at IS NULL AND revoked_at IS NULL;
  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.commune_invites
    (commune_id, email, role, token_hash, invited_by)
    VALUES (p_commune_id, v_email, p_role,
      digest(v_token, 'sha256'), auth.user_id());
  RETURN v_token;
END;
$$;
REVOKE ALL ON FUNCTION public.create_commune_invite(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_commune_invite(uuid, text, text)
  TO authenticated;

CREATE FUNCTION public.list_commune_invites(p_commune_id uuid)
RETURNS TABLE (
  id uuid, email text, role text, created_at timestamptz,
  expires_at timestamptz, accepted_at timestamptz, revoked_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_commune_admin(p_commune_id) THEN
    RAISE EXCEPTION 'Only a commune admin can view invites'
      USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT i.id, i.email, i.role, i.created_at, i.expires_at,
    i.accepted_at, i.revoked_at
  FROM public.commune_invites i WHERE i.commune_id = p_commune_id
  ORDER BY i.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.list_commune_invites(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_commune_invites(uuid) TO authenticated;

CREATE FUNCTION public.preview_commune_invite(p_token text)
RETURNS TABLE (commune_name text, role text, expires_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_email text;
BEGIN
  SELECT lower(u.email) INTO v_email
  FROM neon_auth."user" u
  WHERE u.id = auth.user_id() AND u."emailVerified" IS TRUE;
  IF v_email IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT c.name, i.role, i.expires_at
  FROM public.commune_invites i
  JOIN public.communes c ON c.id = i.commune_id
  WHERE i.token_hash = digest(p_token, 'sha256')
    AND i.email = v_email AND i.expires_at > now()
    AND i.accepted_at IS NULL AND i.revoked_at IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.preview_commune_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_commune_invite(text) TO authenticated;

CREATE FUNCTION public.accept_commune_invite(p_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_invite public.commune_invites%ROWTYPE;
  v_email text;
BEGIN
  SELECT lower(u.email) INTO v_email
  FROM neon_auth."user" u
  WHERE u.id = auth.user_id() AND u."emailVerified" IS TRUE;
  IF v_email IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invite unavailable for this verified account'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_invite FROM public.commune_invites
    WHERE token_hash = digest(p_token, 'sha256') FOR UPDATE;
  IF NOT FOUND OR v_invite.email <> v_email
     OR v_invite.expires_at <= now()
     OR v_invite.accepted_at IS NOT NULL
     OR v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite unavailable for this verified account'
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.commune_members m
    WHERE m.commune_id = v_invite.commune_id
      AND m.user_id = auth.user_id()
  ) THEN
    RAISE EXCEPTION 'Already a member of this commune' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.commune_members (commune_id, user_id, role)
    VALUES (v_invite.commune_id, auth.user_id(), v_invite.role);
  UPDATE public.commune_invites
    SET accepted_at = now(), accepted_by = auth.user_id()
    WHERE id = v_invite.id;
  RETURN v_invite.commune_id;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_commune_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_commune_invite(text) TO authenticated;

CREATE FUNCTION public.revoke_commune_invite(p_invite_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_invite public.commune_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite FROM public.commune_invites
    WHERE id = p_invite_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_commune_admin(v_invite.commune_id) THEN
    RAISE EXCEPTION 'Only a commune admin can revoke this invite'
      USING ERRCODE = '42501';
  END IF;
  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Accepted invites cannot be revoked'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.commune_invites SET revoked_at = coalesce(revoked_at, now())
    WHERE id = p_invite_id;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_commune_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_commune_invite(uuid) TO authenticated;

COMMIT;
