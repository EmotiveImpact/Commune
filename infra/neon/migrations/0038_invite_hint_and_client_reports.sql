-- Two additions for the web app; neither touches money or membership.
-- 1. Someone signed in with one address who opened an invitation sent to
--    another saw only "Invitation unavailable". public.invite_address_hint
--    gives whoever holds a working invitation's link a masked form of the
--    address it was sent to ("e•••@g•••.com"), and only when the account
--    signed in has a different one, so they know which account to use.
-- 2. A crash in the web app left a blank page and nobody found out.
--    public.report_client_event keeps a signed-in person's error reports and
--    sampled speed figures (largest contentful paint, interaction to next
--    paint, cumulative layout shift) in commune_private.client_reports, which
--    no client can read. A report names a page as a pattern such as
--    /expenses/:id, never a record or a query; it is tied to the account only
--    so that one account cannot flood it. The worker's scheduled run deletes
--    reports after 30 days.
-- The web app released with this calls both, so apply it first. Apply after
-- 0037.
BEGIN;

-- 1. The address an invitation was sent to -----------------------------------

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

-- 2. Error reports and speed figures -----------------------------------------

-- lcp_ms, inp_ms and cls are the speed figures (milliseconds, milliseconds,
-- and the browser's unitless shift score). An error has a message and
-- perhaps a stack instead.
CREATE TABLE commune_private.client_reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('error', 'speed')),
  release text NOT NULL,
  route text NOT NULL,
  browser text NOT NULL,
  message text,
  stack text,
  lcp_ms integer,
  inp_ms integer,
  cls numeric(8, 4),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (CASE kind WHEN 'error' THEN message IS NOT NULL AND num_nonnulls(lcp_ms, inp_ms, cls) = 0
    ELSE num_nulls(message, stack) = 2 AND num_nonnulls(lcp_ms, inp_ms, cls) > 0 END)
);
CREATE INDEX client_reports_account_idx ON commune_private.client_reports (user_id, created_at);
CREATE INDEX client_reports_age_idx ON commune_private.client_reports (created_at);
ALTER TABLE commune_private.client_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON commune_private.client_reports FROM PUBLIC, authenticated;

-- Report text as it is kept: at most p_limit characters, with anything that
-- looks like a record id, an email address, or a link's query or fragment
-- taken out, and NULL if nothing but spaces is left. The web app sends it
-- that way already; this makes sure.
CREATE FUNCTION commune_private.report_text(p_text text, p_limit integer)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, pg_temp AS $$
  SELECT CASE WHEN btrim(t.kept, E' \t\r\n') = '' THEN NULL ELSE t.kept END
  FROM (SELECT left(
    regexp_replace(
      regexp_replace(
        regexp_replace(left(p_text, 4 * p_limit),
          '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', ':id', 'gi'),
        '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}', '[email]', 'g'),
      '(https?://[^\s?#)]*)[?#][^\s)]*', '\1', 'gi'),
    p_limit) AS kept) t
$$;
REVOKE ALL ON FUNCTION commune_private.report_text(text, integer) FROM PUBLIC;

-- One report from the web app: an error, or one page load's speed figures.
-- A route is a page's path with :id (or another :name) in place of anything
-- that would identify a record. Each account may send 20 reports an hour and
-- 100 a day. A report over that is dropped (false) rather than refused, so a
-- page that keeps failing gets no worse for reporting it.
CREATE FUNCTION public.report_client_event(p_kind text, p_release text, p_route text, p_browser text,
  p_message text DEFAULT NULL, p_stack text DEFAULT NULL,
  p_lcp_ms integer DEFAULT NULL, p_inp_ms integer DEFAULT NULL, p_cls numeric DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_user text := commune_private.data_api_user_id(); v_message text; v_stack text;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('error', 'speed') THEN
    RAISE EXCEPTION 'Report kind must be error or speed' USING ERRCODE = '22023';
  END IF;
  IF p_release IS NULL OR p_release !~ '^[A-Za-z0-9._-]{1,40}$' THEN
    RAISE EXCEPTION 'Invalid release' USING ERRCODE = '22023';
  END IF;
  IF p_route IS NULL OR length(p_route) > 80 OR p_route !~ '^/(([a-z-]+|:[a-z]+)(/([a-z-]+|:[a-z]+))*)?$' THEN
    RAISE EXCEPTION 'A route is a page pattern such as /expenses/:id' USING ERRCODE = '22023';
  END IF;
  IF p_browser IS NULL OR p_browser NOT IN ('chrome', 'edge', 'firefox', 'safari', 'samsung', 'other') THEN
    RAISE EXCEPTION 'Invalid browser' USING ERRCODE = '22023';
  END IF;
  v_message := commune_private.report_text(p_message, 300);
  v_stack := commune_private.report_text(p_stack, 2000);
  IF p_kind = 'error' AND (v_message IS NULL OR num_nonnulls(p_lcp_ms, p_inp_ms, p_cls) > 0) THEN
    RAISE EXCEPTION 'An error report has a message and no speed figures' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'speed' AND (num_nonnulls(p_message, p_stack) > 0 OR num_nonnulls(p_lcp_ms, p_inp_ms, p_cls) = 0) THEN
    RAISE EXCEPTION 'A speed report has speed figures and no message' USING ERRCODE = '22023';
  END IF;
  IF p_lcp_ms NOT BETWEEN 0 AND 600000 OR p_inp_ms NOT BETWEEN 0 AND 600000 OR p_cls NOT BETWEEN 0 AND 1000 THEN
    RAISE EXCEPTION 'Speed figures out of range' USING ERRCODE = '22023';
  END IF;
  -- One account's reports are counted one at a time, so reports sent at
  -- once cannot all slip under the limit.
  PERFORM pg_advisory_xact_lock(hashtextextended('client-report:' || v_user, 0));
  IF (SELECT count(*) FROM commune_private.client_reports WHERE user_id = v_user AND created_at > now() - interval '1 hour') >= 20
    OR (SELECT count(*) FROM commune_private.client_reports WHERE user_id = v_user AND created_at > now() - interval '1 day') >= 100 THEN
    RETURN false;
  END IF;
  INSERT INTO commune_private.client_reports (user_id, kind, release, route, browser, message, stack, lcp_ms, inp_ms, cls)
    VALUES (v_user, p_kind, p_release, p_route, p_browser, v_message, v_stack, p_lcp_ms, p_inp_ms, round(p_cls, 4));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.report_client_event(text, text, text, text, text, text, integer, integer, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_client_event(text, text, text, text, text, text, integer, integer, numeric) TO authenticated;

-- The worker's scheduled run (0034, 0036) deletes reports after 30 days.
DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('commune_private.prune_delivery_records()'::regprocedure);
  v_source := replace(v_original, 'DECLARE v_payloads integer; v_invitations integer; v_changes integer;',
    'DECLARE v_payloads integer; v_invitations integer; v_changes integer; v_reports integer;');
  v_source := replace(v_source,
    '  RETURN jsonb_build_object(''reminderPayloads'', v_payloads, ''invitationEmails'', v_invitations, ''changeMarks'', v_changes);',
    '  DELETE FROM commune_private.client_reports WHERE created_at < now() - interval ''30 days'';
  GET DIAGNOSTICS v_reports = ROW_COUNT;
  RETURN jsonb_build_object(''reminderPayloads'', v_payloads, ''invitationEmails'', v_invitations, ''changeMarks'', v_changes,
    ''clientReports'', v_reports);');
  IF (length(v_source) - length(replace(v_source, 'v_reports', ''))) / length('v_reports') <> 3 THEN
    RAISE EXCEPTION 'Unsupported definition of commune_private.prune_delivery_records';
  END IF;
  EXECUTE v_source;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
