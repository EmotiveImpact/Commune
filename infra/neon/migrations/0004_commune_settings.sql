-- Shared commune details are editable only by an administrator. A currency
-- change is allowed only before any money has been recorded, so old amounts
-- can never be silently reinterpreted as a different currency.
BEGIN;

CREATE OR REPLACE FUNCTION public.update_commune_details(
  p_commune_id uuid, p_name text, p_kind text, p_currency text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_currency text;
BEGIN
  IF NOT public.is_commune_admin(p_commune_id) THEN
    RAISE EXCEPTION 'Only a commune admin can change its settings'
      USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_name, ''))) NOT BETWEEN 1 AND 48
     OR p_kind NOT IN ('household', 'workspace', 'trip')
     OR p_currency NOT IN ('GBP', 'USD', 'EUR') THEN
    RAISE EXCEPTION 'Invalid commune details' USING ERRCODE = '22023';
  END IF;

  SELECT currency INTO v_currency FROM public.communes
    WHERE id = p_commune_id FOR UPDATE;
  IF v_currency IS NULL THEN
    RAISE EXCEPTION 'Commune not found' USING ERRCODE = '22023';
  END IF;
  IF p_currency <> v_currency AND (
    EXISTS (SELECT 1 FROM public.expenses WHERE commune_id = p_commune_id)
    OR EXISTS (SELECT 1 FROM public.funds WHERE commune_id = p_commune_id)
  ) THEN
    RAISE EXCEPTION 'Currency cannot change after expenses or funds exist'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.communes
    SET name = btrim(p_name), kind = p_kind, currency = p_currency
    WHERE id = p_commune_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_commune_details(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_commune_details(uuid, text, text, text)
  TO authenticated;

COMMIT;
