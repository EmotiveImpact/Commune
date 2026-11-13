-- Who lives there, for the joining page (8 November 2026). Someone signed in
-- with the address an invitation was sent to sees the inviter's name and the
-- first names of the commune's current members before they join, so the
-- page can show the house's faces. Only the account the invitation is for
-- can read it, under the same checks as preview_commune_invite: a verified
-- address that matches, an invitation that is open, and an inviter who is
-- still an admin. Never open to anonymous callers. First names only, no
-- addresses, ids or money. Depends on 0038 (and so on 0011 and 0030).
-- Local only until released; numbered after 0044 to 0046 on open branches.
BEGIN;

CREATE FUNCTION public.invite_people(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_email text;
  v_commune uuid;
  v_inviter text;
BEGIN
  SELECT lower(u.email) INTO v_email
  FROM commune_private.accounts(ARRAY[commune_private.data_api_user_id()]) u
  WHERE u."emailVerified" IS TRUE;
  IF v_email IS NULL OR p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN NULL;
  END IF;
  SELECT i.commune_id, i.invited_by INTO v_commune, v_inviter
  FROM public.commune_invites i
  WHERE i.token_hash = digest(p_token, 'sha256')
    AND i.email = v_email AND i.expires_at > now()
    AND i.accepted_at IS NULL AND i.revoked_at IS NULL
    AND EXISTS (SELECT 1 FROM public.commune_members m WHERE m.commune_id = i.commune_id
      AND m.user_id = i.invited_by AND m.active AND m.role = 'admin');
  IF v_commune IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'inviter', (SELECT nullif(split_part(btrim(u.name), ' ', 1), '')
      FROM commune_private.accounts(ARRAY[v_inviter]) u),
    'members', coalesce((
      SELECT jsonb_agg(p.first_name ORDER BY p.is_inviter DESC, p.joined_at, p.user_id)
      FROM (
        SELECT m.user_id, m.joined_at, m.user_id = v_inviter AS is_inviter,
          coalesce(nullif(split_part(btrim(u.name), ' ', 1), ''), 'Member') AS first_name
        FROM public.commune_members m
        LEFT JOIN commune_private.accounts(ARRAY(SELECT x.user_id FROM public.commune_members x
          WHERE x.commune_id = v_commune AND x.active)) u ON u.id = m.user_id
        WHERE m.commune_id = v_commune AND m.active
        ORDER BY m.user_id = v_inviter DESC, m.joined_at, m.user_id
        LIMIT 12
      ) p), '[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.invite_people(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_people(text) TO authenticated;

COMMIT;
