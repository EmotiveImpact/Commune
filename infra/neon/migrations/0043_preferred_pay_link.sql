-- A favourite way to be paid. A person may mark one of their pay links as the
-- one they prefer; people who owe them then get a single button that opens
-- it, with the others a tap away. Marking none is fine: they see all of them.
-- Depends on 0042.
BEGIN;

ALTER TABLE public.member_pay_links ADD COLUMN preferred boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX member_pay_links_one_preferred ON public.member_pay_links (user_id) WHERE preferred;

-- The favourite first, then the usual order.
CREATE OR REPLACE FUNCTION commune_private.pay_links_for(p_user_id text)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('provider', l.provider, 'handle', l.handle,
      'accountName', l.account_name, 'sortCode', l.sort_code, 'accountNumber', l.account_number,
      'preferred', l.preferred, 'updatedAt', l.updated_at)
    ORDER BY l.preferred DESC, array_position(ARRAY['monzo', 'paypal', 'revolut', 'bank'], l.provider)), '[]'::jsonb)
  FROM public.member_pay_links l WHERE l.user_id = p_user_id;
$$;
REVOKE ALL ON FUNCTION commune_private.pay_links_for(text) FROM PUBLIC;

-- Mark one of your own links as the favourite, or pass nothing to have none.
-- Marking the one already marked is harmless.
CREATE FUNCTION public.set_preferred_pay_link(p_provider text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_provider text := nullif(lower(btrim(coalesce(p_provider, ''))), '');
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in to change how people pay you' USING ERRCODE = '42501';
  END IF;
  IF v_provider IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.member_pay_links WHERE user_id = v_actor AND provider = v_provider
  ) THEN
    RAISE EXCEPTION 'Add that way to be paid before making it your favourite' USING ERRCODE = '22023';
  END IF;
  UPDATE public.member_pay_links SET preferred = false
    WHERE user_id = v_actor AND preferred AND provider IS DISTINCT FROM v_provider;
  IF v_provider IS NOT NULL THEN
    UPDATE public.member_pay_links SET preferred = true
      WHERE user_id = v_actor AND provider = v_provider AND NOT preferred;
  END IF;
  RETURN commune_private.pay_links_for(v_actor);
END;
$$;

REVOKE ALL ON FUNCTION public.set_preferred_pay_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_preferred_pay_link(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
