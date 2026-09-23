-- Managed Neon Auth stores user.id as uuid. Commune stores JWT subject IDs as
-- text because auth.user_id() returns text. Normalize only at the boundary;
-- never cast user-controlled IDs to uuid inside authorization policies.
BEGIN;

CREATE OR REPLACE FUNCTION public.member_profiles(p_commune_id uuid)
RETURNS TABLE (id text, name text, email text, role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_commune_member(p_commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT u.id::text, u.name, u.email, m.role
  FROM public.commune_members m
  JOIN neon_auth."user" u ON u.id::text = m.user_id
  WHERE m.commune_id = p_commune_id
  ORDER BY m.joined_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_commune_invite(
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
  PERFORM 1 FROM public.communes WHERE id = p_commune_id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.commune_members m
    JOIN neon_auth."user" u ON u.id::text = m.user_id
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

CREATE OR REPLACE FUNCTION public.preview_commune_invite(p_token text)
RETURNS TABLE (commune_name text, role text, expires_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_email text;
BEGIN
  SELECT lower(u.email) INTO v_email
  FROM neon_auth."user" u
  WHERE u.id::text = auth.user_id() AND u."emailVerified" IS TRUE;
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

CREATE OR REPLACE FUNCTION public.accept_commune_invite(p_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_invite public.commune_invites%ROWTYPE;
  v_email text;
BEGIN
  SELECT lower(u.email) INTO v_email
  FROM neon_auth."user" u
  WHERE u.id::text = auth.user_id() AND u."emailVerified" IS TRUE;
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

COMMIT;
