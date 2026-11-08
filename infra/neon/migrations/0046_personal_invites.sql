-- Personal invitations: an admin picks one person from their phone's contacts
-- (or types a name) and sends them a link on WhatsApp or by text. The link
-- carries no email address. It works once, for the first signed-in person who
-- opens it, for seven days, and then stops. Commune keeps the name the admin
-- gave and how they sent it, so the admin's list can say "Maya, sent on
-- WhatsApp". It never receives the phone number: that stays on the phone.
--
-- People who join this way are always ordinary members, never admins. An
-- admin can have at most 20 personal invitations open in one commune.
--
-- Email invitations are unchanged: still for one verified address. The
-- invitation email sender skips invitations without an address.
--
-- Numbered 0046 because 0044 (join codes) and 0045 (group chat link) are on
-- other branches. Local only, like 0015 onwards.
BEGIN;

ALTER TABLE public.commune_invites ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.commune_invites
  ADD COLUMN invitee_name text,
  ADD COLUMN sent_via text;
ALTER TABLE public.commune_invites
  ADD CONSTRAINT commune_invites_invitee_name_check CHECK (invitee_name IS NULL OR (
    invitee_name = btrim(invitee_name) AND length(invitee_name) BETWEEN 1 AND 80 AND invitee_name !~ '[[:cntrl:]]')),
  ADD CONSTRAINT commune_invites_sent_via_check CHECK (sent_via IS NULL OR sent_via IN ('whatsapp', 'text', 'link')),
  -- An invitation is either for an email address or for a named person, never both.
  ADD CONSTRAINT commune_invites_one_kind CHECK ((email IS NULL) = (invitee_name IS NOT NULL)),
  ADD CONSTRAINT commune_invites_personal_fields CHECK (email IS NULL OR sent_via IS NULL),
  ADD CONSTRAINT commune_invites_personal_member CHECK (email IS NOT NULL OR role = 'member');

-- ---------------------------------------------------------------------------
-- Making one: the admin's name for the person and how they will send it.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.create_personal_invite(p_commune_id uuid, p_name text, p_sent_via text DEFAULT 'link')
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_token text;
BEGIN
  -- The same commune -> invitation lock order as email invitations.
  PERFORM 1 FROM public.communes WHERE id = p_commune_id FOR UPDATE;
  IF NOT public.is_commune_admin(p_commune_id) THEN
    RAISE EXCEPTION 'Only an admin can invite members' USING ERRCODE = '42501';
  END IF;
  IF length(v_name) NOT BETWEEN 1 AND 80 OR v_name ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Give their name, up to 80 characters' USING ERRCODE = '22023';
  END IF;
  IF p_sent_via IS NULL OR p_sent_via NOT IN ('whatsapp', 'text', 'link') THEN
    RAISE EXCEPTION 'Invalid invite details' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.commune_invites i
      WHERE i.commune_id = p_commune_id AND i.invited_by = v_actor AND i.email IS NULL
        AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()) >= 20 THEN
    RAISE EXCEPTION 'You have 20 invitations waiting. Withdraw some before sending more.' USING ERRCODE = 'P0001';
  END IF;
  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.commune_invites (commune_id, email, invitee_name, sent_via, role, token_hash, invited_by)
    VALUES (p_commune_id, NULL, v_name, p_sent_via, 'member', digest(v_token, 'sha256'), v_actor);
  RETURN v_token;
END;
$$;

-- ---------------------------------------------------------------------------
-- What the link shows before joining. A personal invitation shows to anyone
-- signed in; an email invitation only to its own verified address, as before.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.preview_commune_invite(p_token text) RETURNS TABLE(commune_name text, role text, expires_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_email text;
BEGIN
  IF v_actor IS NULL OR p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM commune_private.accounts(ARRAY[v_actor])) THEN
    RETURN;
  END IF;
  SELECT lower(u.email) INTO v_email
  FROM commune_private.accounts(ARRAY[v_actor]) u
  WHERE u."emailVerified" IS TRUE;
  RETURN QUERY
  SELECT c.name, i.role, i.expires_at
  FROM public.commune_invites i
  JOIN public.communes c ON c.id = i.commune_id
  WHERE i.token_hash = digest(p_token, 'sha256')
    AND (i.email IS NULL OR i.email = v_email) AND i.expires_at > now()
    AND i.accepted_at IS NULL AND i.revoked_at IS NULL
    AND EXISTS (SELECT 1 FROM public.commune_members m WHERE m.commune_id = i.commune_id
      AND m.user_id = i.invited_by AND m.active AND m.role = 'admin');
END;
$_$;

-- ---------------------------------------------------------------------------
-- Joining. An email invitation still needs its own verified address. A
-- personal one needs only a signed-in account, and then it is used up.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_commune_invite(p_token text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE v_invite public.commune_invites%ROWTYPE;v_actor text:=commune_private.data_api_user_id();v_email text;
BEGIN
  IF v_actor IS NULL OR p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$'
    OR NOT EXISTS(SELECT 1 FROM commune_private.accounts(ARRAY[v_actor])) THEN
    RAISE EXCEPTION 'Invite unavailable for this verified account' USING ERRCODE='42501'; END IF;
  -- Use the same commune -> invitation order as invitation creation.
  PERFORM 1 FROM public.communes co JOIN public.commune_invites i ON i.commune_id=co.id WHERE i.token_hash=digest(p_token,'sha256') FOR UPDATE OF co;
  SELECT * INTO v_invite FROM public.commune_invites WHERE token_hash=digest(p_token,'sha256') FOR UPDATE;
  IF NOT FOUND OR v_invite.expires_at<=now() OR v_invite.accepted_at IS NOT NULL OR v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite unavailable for this verified account' USING ERRCODE='42501'; END IF;
  IF v_invite.email IS NOT NULL THEN
    SELECT lower(email) INTO v_email FROM commune_private.accounts(ARRAY[v_actor]) WHERE "emailVerified" IS TRUE;
    IF v_email IS NULL OR v_invite.email<>v_email THEN
      RAISE EXCEPTION 'Invite unavailable for this verified account' USING ERRCODE='42501'; END IF;
  END IF;
  -- The sender must still be an active admin of this commune.
  IF NOT EXISTS(SELECT 1 FROM public.commune_members m WHERE m.commune_id=v_invite.commune_id AND m.user_id=v_invite.invited_by AND m.active AND m.role='admin') THEN
    RAISE EXCEPTION 'Invite unavailable for this verified account' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.commune_members WHERE commune_id=v_invite.commune_id AND user_id=v_actor AND active) THEN
    RAISE EXCEPTION 'Already a member of this commune' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.commune_members(commune_id,user_id,role) VALUES(v_invite.commune_id,v_actor,v_invite.role)
    ON CONFLICT(commune_id,user_id) DO UPDATE SET role=excluded.role,active=true,left_at=NULL,joined_at=now();
  UPDATE public.commune_invites SET accepted_at=now(),accepted_by=v_actor WHERE id=v_invite.id;
  RETURN v_invite.commune_id;
END;
$_$;

-- ---------------------------------------------------------------------------
-- The admin's list gains the person's name and how it was sent. Like the
-- address, the name is hidden once the person who accepted it has left.
-- ---------------------------------------------------------------------------
DROP FUNCTION public.list_commune_invites(uuid);
CREATE FUNCTION public.list_commune_invites(p_commune_id uuid) RETURNS TABLE(id uuid, email text, role text, created_at timestamp with time zone, expires_at timestamp with time zone, accepted_at timestamp with time zone, revoked_at timestamp with time zone, invited_by text, invited_by_name text, accepted_by text, invitee_name text, sent_via text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_commune_admin(p_commune_id) THEN
    RAISE EXCEPTION 'Only a commune admin can view invites'
      USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT i.id, CASE WHEN i.accepted_by IS NULL OR EXISTS (SELECT 1 FROM public.commune_members m
      WHERE m.commune_id = i.commune_id AND m.user_id = i.accepted_by AND m.active) THEN i.email END, i.role, i.created_at, i.expires_at,
    i.accepted_at, i.revoked_at, i.invited_by, u.name, i.accepted_by,
    CASE WHEN i.accepted_by IS NULL OR EXISTS (SELECT 1 FROM public.commune_members m
      WHERE m.commune_id = i.commune_id AND m.user_id = i.accepted_by AND m.active) THEN i.invitee_name END,
    i.sent_via
  FROM public.commune_invites i
  LEFT JOIN commune_private.accounts(ARRAY(SELECT DISTINCT x.invited_by FROM public.commune_invites x WHERE x.commune_id = p_commune_id)) u ON u.id = i.invited_by
  WHERE i.commune_id = p_commune_id
  ORDER BY i.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.create_personal_invite(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_commune_invites(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_personal_invite(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_commune_invites(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
