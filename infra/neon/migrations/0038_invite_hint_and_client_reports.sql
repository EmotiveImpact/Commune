-- Someone signed in with one address who opened an invitation sent to
-- another saw only "Invitation unavailable". public.invite_address_hint gives
-- whoever holds a working invitation's link a masked form of the address it
-- was sent to ("e•••@g•••.com"), and only when the account signed in has a
-- different one, so they know which account to use. The web app released
-- with this calls it, so apply it first. Apply after 0037.
BEGIN;

-- "emma@gmail.com" as "e•••@g•••.com": the first character of the name and of
-- the domain, and the domain's ending (".co.uk" for "o•••.co.uk"), enough to
-- tell which of one's addresses it is.
CREATE FUNCTION commune_private.masked_address(p_email text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  v_name text := split_part(p_email, '@', 1);
  v_labels text[] := string_to_array(split_part(p_email, '@', 2), '.');
  v_count integer;
  v_ending integer := 1;
BEGIN
  v_count := coalesce(cardinality(v_labels), 0);
  IF v_name = '' OR v_count < 2 OR v_labels[1] = '' OR v_labels[v_count] = '' THEN RETURN NULL; END IF;
  -- Where names are registered under a second level, as in co.uk or com.au.
  IF v_count > 2 AND v_labels[v_count - 1] IN ('ac', 'co', 'com', 'edu', 'gov', 'ltd', 'net', 'nhs', 'org', 'plc', 'sch') THEN
    v_ending := 2;
  END IF;
  RETURN left(v_name, 1) || '•••@' || left(v_labels[1], 1) || '•••.'
    || array_to_string(v_labels[v_count - v_ending + 1 : v_count], '.');
END;
$$;
REVOKE ALL ON FUNCTION commune_private.masked_address(text) FROM PUBLIC;

-- NULL when the invitation could not be accepted by anyone (used, withdrawn,
-- expired, or its sender is no longer an admin) and when it was sent to the
-- account's own address: the preview shows it then, or the address still
-- needs verifying. Only someone holding the link has the token.
CREATE FUNCTION public.invite_address_hint(p_token text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_account text; v_invited text;
BEGIN
  SELECT lower(u.email) INTO v_account
  FROM commune_private.accounts(ARRAY[commune_private.data_api_user_id()]) u;
  IF v_account IS NULL OR p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN NULL;
  END IF;
  SELECT lower(i.email) INTO v_invited
  FROM public.commune_invites i
  WHERE i.token_hash = digest(p_token, 'sha256')
    AND i.expires_at > now() AND i.accepted_at IS NULL AND i.revoked_at IS NULL
    AND EXISTS (SELECT 1 FROM public.commune_members m WHERE m.commune_id = i.commune_id
      AND m.user_id = i.invited_by AND m.active AND m.role = 'admin');
  IF v_invited IS NULL OR v_invited = v_account THEN
    RETURN NULL;
  END IF;
  RETURN commune_private.masked_address(v_invited);
END;
$$;
REVOKE ALL ON FUNCTION public.invite_address_hint(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_address_hint(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
