-- Compose the existing, vetted detail and location RPCs in a single Data API
-- call. PostgreSQL executes each function call as one statement: if either
-- step raises, the created commune/membership or edited details roll back.
BEGIN;

CREATE FUNCTION public.create_commune_with_location(
  p_name text,
  p_kind text,
  p_currency text,
  p_address text,
  p_destination text,
  p_stay_name text,
  p_stay_address text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_commune_id uuid;
BEGIN
  v_commune_id := public.create_commune(p_name, p_kind, p_currency);
  PERFORM public.update_commune_location(
    v_commune_id, p_address, p_destination, p_stay_name, p_stay_address
  );
  RETURN v_commune_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_commune_with_location(
  text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_commune_with_location(
  text, text, text, text, text, text, text) TO authenticated;

CREATE FUNCTION public.update_commune_with_location(
  p_commune_id uuid,
  p_name text,
  p_kind text,
  p_currency text,
  p_address text,
  p_destination text,
  p_stay_name text,
  p_stay_address text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.update_commune_details(
    p_commune_id, p_name, p_kind, p_currency
  );
  PERFORM public.update_commune_location(
    p_commune_id, p_address, p_destination, p_stay_name, p_stay_address
  );
END;
$$;
REVOKE ALL ON FUNCTION public.update_commune_with_location(
  uuid, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_commune_with_location(
  uuid, text, text, text, text, text, text, text) TO authenticated;

COMMIT;
