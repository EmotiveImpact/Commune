-- Pay links: how each person likes to be paid (a Monzo, PayPal or Revolut
-- username, or UK bank details). People who share a commune with them see
-- these when they owe them, so they can open their own banking app with the
-- amount filled in and then report the payment in Commune as before.
-- Commune still never moves money; these are details a person chose to share.
-- Numbered 0042 so it cannot collide with the open review branches
-- (0026 to 0041). It depends only on 0001 and the 0025 snapshot shape.
BEGIN;

CREATE TABLE public.member_pay_links (
  user_id text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('monzo', 'paypal', 'revolut', 'bank')),
  handle text CHECK (handle ~ '^[A-Za-z0-9._-]{1,40}$'),
  account_name text CHECK (length(btrim(account_name)) BETWEEN 1 AND 60),
  sort_code text CHECK (sort_code ~ '^[0-9]{6}$'),
  account_number text CHECK (account_number ~ '^[0-9]{8}$'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider),
  CHECK (CASE WHEN provider = 'bank'
    THEN handle IS NULL AND account_name IS NOT NULL AND sort_code IS NOT NULL AND account_number IS NOT NULL
    ELSE handle IS NOT NULL AND account_name IS NULL AND sort_code IS NULL AND account_number IS NULL END)
);

ALTER TABLE public.member_pay_links ENABLE ROW LEVEL SECURITY;
-- Deliberately no grant at all: a person's own links come from my_pay_links(),
-- and other people's only through the snapshot of a commune they share.

CREATE FUNCTION commune_private.pay_links_for(p_user_id text)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('provider', l.provider, 'handle', l.handle,
      'accountName', l.account_name, 'sortCode', l.sort_code, 'accountNumber', l.account_number,
      'updatedAt', l.updated_at)
    ORDER BY array_position(ARRAY['monzo', 'paypal', 'revolut', 'bank'], l.provider)), '[]'::jsonb)
  FROM public.member_pay_links l WHERE l.user_id = p_user_id;
$$;
REVOKE ALL ON FUNCTION commune_private.pay_links_for(text) FROM PUBLIC;

CREATE FUNCTION public.my_pay_links()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in to see how people pay you' USING ERRCODE = '42501';
  END IF;
  RETURN commune_private.pay_links_for(v_actor);
END;
$$;

-- Add or replace one way to be paid. Saving the same details again is harmless.
CREATE FUNCTION public.set_pay_link(p_provider text, p_handle text, p_account_name text,
  p_sort_code text, p_account_number text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_provider text := lower(btrim(coalesce(p_provider, '')));
  v_handle text := nullif(btrim(coalesce(p_handle, '')), '');
  v_name text := nullif(btrim(coalesce(p_account_name, '')), '');
  v_sort text := nullif(regexp_replace(coalesce(p_sort_code, ''), '[\s-]', '', 'g'), '');
  v_account text := nullif(regexp_replace(coalesce(p_account_number, ''), '\s', '', 'g'), '');
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in to save how people pay you' USING ERRCODE = '42501';
  END IF;
  IF v_provider NOT IN ('monzo', 'paypal', 'revolut', 'bank') THEN
    RAISE EXCEPTION 'Choose Monzo, PayPal, Revolut or bank transfer' USING ERRCODE = '22023';
  END IF;
  IF v_provider = 'bank' THEN
    IF v_name IS NULL OR length(v_name) > 60 THEN
      RAISE EXCEPTION 'Enter the name on the account, up to 60 characters' USING ERRCODE = '22023';
    END IF;
    IF v_sort IS NULL OR v_sort !~ '^[0-9]{6}$' THEN
      RAISE EXCEPTION 'Enter a six-digit sort code, for example 20-45-77' USING ERRCODE = '22023';
    END IF;
    IF v_account IS NULL OR v_account !~ '^[0-9]{8}$' THEN
      RAISE EXCEPTION 'Enter an eight-digit account number' USING ERRCODE = '22023';
    END IF;
    v_handle := NULL;
  ELSE
    -- Accept a pasted link or an @name and keep only the username.
    v_handle := regexp_replace(coalesce(v_handle, ''), '^(https?://)?(www\.)?(monzo\.me|paypal\.me|paypal\.com/paypalme|revolut\.me)/', '', 'i');
    v_handle := regexp_replace(regexp_replace(v_handle, '^@', ''), '/.*$', '');
    IF v_handle !~ '^[A-Za-z0-9._-]{1,40}$' THEN
      RAISE EXCEPTION 'Enter your username: letters, numbers, dots, dashes or underscores, up to 40' USING ERRCODE = '22023';
    END IF;
    v_name := NULL; v_sort := NULL; v_account := NULL;
  END IF;
  INSERT INTO public.member_pay_links (user_id, provider, handle, account_name, sort_code, account_number)
    VALUES (v_actor, v_provider, v_handle, v_name, v_sort, v_account)
    ON CONFLICT (user_id, provider) DO UPDATE SET handle = EXCLUDED.handle, account_name = EXCLUDED.account_name,
      sort_code = EXCLUDED.sort_code, account_number = EXCLUDED.account_number, updated_at = now();
  RETURN commune_private.pay_links_for(v_actor);
END;
$$;

-- Stop offering one way to be paid. Removing one that is not there is harmless.
CREATE FUNCTION public.remove_pay_link(p_provider text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in to change how people pay you' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.member_pay_links WHERE user_id = v_actor AND provider = lower(btrim(coalesce(p_provider, '')));
  RETURN commune_private.pay_links_for(v_actor);
END;
$$;

-- Everyone in the commune, keyed by user id. Only current members appear,
-- so leaving a commune stops sharing your details with it.
CREATE FUNCTION commune_private.snapshot_pay_links(p_commune_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_object_agg(m.user_id, commune_private.pay_links_for(m.user_id)), '{}'::jsonb)
  FROM public.commune_members m
  WHERE m.commune_id = p_commune_id AND m.active
    AND EXISTS (SELECT 1 FROM public.member_pay_links l WHERE l.user_id = m.user_id);
$$;
REVOKE ALL ON FUNCTION commune_private.snapshot_pay_links(uuid) FROM PUBLIC;

DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('public.commune_snapshot(uuid)'::regprocedure);
  v_source := replace(v_original, '''announcements'',commune_private.snapshot_announcements(co.id),',
    '''announcements'',commune_private.snapshot_announcements(co.id),
    ''payLinks'',commune_private.snapshot_pay_links(co.id),');
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported snapshot definition'; END IF;
  EXECUTE v_source;
END;
$$;

REVOKE ALL ON FUNCTION public.my_pay_links() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_pay_links() TO authenticated;
REVOKE ALL ON FUNCTION public.set_pay_link(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_pay_link(text, text, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.remove_pay_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_pay_link(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
