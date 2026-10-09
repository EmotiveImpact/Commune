-- Invitation emails led with the commune's name, which anyone can choose, and
-- never said who sent them: a commune called "Bank: card locked, call 020 7946
-- 0000" produced exactly that subject from Commune's address. The email now
-- names the inviter and quotes the commune (apps/reminder-worker), and a
-- commune can no longer be named, or renamed, with a link, an email address or
-- a phone number. Existing names are not changed; the email sender refuses an
-- invitation that carries one. Bounces and spam complaints reported by the
-- email provider are kept in email_suppressions, and Commune sends those
-- addresses no more email. Apply after 0032, then deploy the reminder worker,
-- which reads email_suppressions.
BEGIN;

-- True when the text holds something a reader could follow or contact: "://"
-- or "www.", an email-like x@y, a domain-like token ending in a common
-- top-level domain, or a phone-like run of 7 or more digits joined only by
-- spaces, dots, dashes or brackets. The text is compared after NFKC
-- normalisation and without invisible format characters, so full-width forms
-- and zero-width spaces do not hide one. apps/reminder-worker/src/invitations.ts
-- applies the same rule to the names in an invitation email.
CREATE FUNCTION commune_private.looks_like_contact(p_text text)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public, pg_temp AS $$
  SELECT coalesce(n.v ~* '://|www\.|[^[:space:]@]@[^[:space:]@]'
    OR n.v ~* '[^[:space:].]\.(com|net|org|io|co|uk|me|app|info|biz|xyz|link|ly|ru|top|site|online|shop)([^a-z0-9]|$)'
    OR n.v ~ '[0-9]([[:space:].()\u2010-\u2015\u2212-]*[0-9]){6}', false)
  FROM (SELECT regexp_replace(normalize(p_text, NFKC),
    '[\u00ad\u034f\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufe00-\ufe0f\ufeff]', '', 'g') AS v) n;
$$;
REVOKE ALL ON FUNCTION commune_private.looks_like_contact(text) FROM PUBLIC;

-- Creating a commune and renaming one refuse such a name. An edit that keeps
-- the current name is not a rename, so a commune named before this migration
-- can still change its other details.
DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('public.create_commune(text,text,text)'::regprocedure);
  v_source := replace(v_original, '  INSERT INTO public.communes (name, kind, currency, created_by)',
    $patch$  IF commune_private.looks_like_contact(p_name) THEN
    RAISE EXCEPTION 'Commune names can''t include links, email addresses or phone numbers.'
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.communes (name, kind, currency, created_by)$patch$);
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported definition of public.create_commune'; END IF;
  EXECUTE v_source;

  v_original := pg_get_functiondef('public.update_commune_details(uuid,text,text,text)'::regprocedure);
  v_source := replace(v_original, '  IF p_currency <> v_currency AND (',
    $patch$  IF btrim(p_name) IS DISTINCT FROM (SELECT c.name FROM public.communes c WHERE c.id = p_commune_id)
     AND commune_private.looks_like_contact(p_name) THEN
    RAISE EXCEPTION 'Commune names can''t include links, email addresses or phone numbers.'
      USING ERRCODE = '22023';
  END IF;
  IF p_currency <> v_currency AND ($patch$);
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported definition of public.update_commune_details'; END IF;
  EXECUTE v_source;
END;
$$;

-- Addresses the email provider reported as bouncing or as marking Commune's
-- email as spam. Written only by the reminder worker's signed webhook, one row
-- per address (lower case); a replayed event changes nothing. Invitations to
-- these addresses are refused and reminder emails to them are skipped. No
-- client role can read or change this table.
CREATE TABLE public.email_suppressions (
  email text PRIMARY KEY CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 320),
  reason text NOT NULL CHECK (reason IN ('bounce', 'complaint')),
  provider_event_id text NOT NULL CHECK (length(provider_event_id) BETWEEN 1 AND 256),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_suppressions FROM PUBLIC, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
