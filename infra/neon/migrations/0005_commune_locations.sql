-- Optional place details. A household/workspace has one primary address;
-- trips have an area/destination and may name a particular stay separately.
BEGIN;

ALTER TABLE public.communes
  ADD COLUMN address text NOT NULL DEFAULT ''
    CHECK (length(address) <= 160),
  ADD COLUMN destination text NOT NULL DEFAULT ''
    CHECK (length(destination) <= 80),
  ADD COLUMN stay_name text NOT NULL DEFAULT ''
    CHECK (length(stay_name) <= 80),
  ADD COLUMN stay_address text NOT NULL DEFAULT ''
    CHECK (length(stay_address) <= 160),
  ADD CONSTRAINT commune_location_matches_kind CHECK (
    (kind = 'trip' AND address = '') OR
    (kind IN ('household', 'workspace')
      AND destination = '' AND stay_name = '' AND stay_address = '')
  );

-- Existing settings edits must clear metadata from the previous kind in the
-- same statement, including callers that still use the original RPC.
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
    SET name = btrim(p_name), kind = p_kind, currency = p_currency,
      address = CASE WHEN p_kind = 'trip' THEN '' ELSE address END,
      destination = CASE WHEN p_kind = 'trip' THEN destination ELSE '' END,
      stay_name = CASE WHEN p_kind = 'trip' THEN stay_name ELSE '' END,
      stay_address = CASE WHEN p_kind = 'trip' THEN stay_address ELSE '' END
    WHERE id = p_commune_id;
END;
$$;

-- NULL means "leave this field unchanged"; an empty string clears it.
-- Metadata is changed only through this admin-checked RPC, never via a
-- direct table UPDATE grant to authenticated clients.
CREATE FUNCTION public.update_commune_location(
  p_commune_id uuid,
  p_address text DEFAULT NULL,
  p_destination text DEFAULT NULL,
  p_stay_name text DEFAULT NULL,
  p_stay_address text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_kind text;
  v_address text;
  v_destination text;
  v_stay_name text;
  v_stay_address text;
BEGIN
  IF NOT public.is_commune_admin(p_commune_id) THEN
    RAISE EXCEPTION 'Only a commune admin can change its location'
      USING ERRCODE = '42501';
  END IF;

  SELECT kind, address, destination, stay_name, stay_address
    INTO v_kind, v_address, v_destination, v_stay_name, v_stay_address
    FROM public.communes WHERE id = p_commune_id FOR UPDATE;
  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'Commune not found' USING ERRCODE = '22023';
  END IF;
  v_address := btrim(coalesce(p_address, v_address));
  v_destination := btrim(coalesce(p_destination, v_destination));
  v_stay_name := btrim(coalesce(p_stay_name, v_stay_name));
  v_stay_address := btrim(coalesce(p_stay_address, v_stay_address));

  IF length(v_address) > 160 OR length(v_destination) > 80
     OR length(v_stay_name) > 80 OR length(v_stay_address) > 160
     OR (v_kind = 'trip' AND v_address <> '')
     OR (v_kind <> 'trip' AND
       (v_destination <> '' OR v_stay_name <> '' OR v_stay_address <> '')) THEN
    RAISE EXCEPTION 'Invalid commune location' USING ERRCODE = '22023';
  END IF;

  UPDATE public.communes SET address = v_address,
    destination = v_destination, stay_name = v_stay_name,
    stay_address = v_stay_address WHERE id = p_commune_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_commune_location(
  uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_commune_location(
  uuid, text, text, text, text) TO authenticated;

COMMIT;
