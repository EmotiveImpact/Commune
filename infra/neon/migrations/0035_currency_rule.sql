-- The settings screen and the database disagreed about when a commune's
-- currency may change, and both missed some amounts. The database refused a
-- change once any expense or fund existed, voided and archived ones included;
-- the screen counted only live ones, so with every expense voided it offered a
-- change the save then refused. Neither counted recurring bills or exact split
-- templates, so a commune with only those could switch from pounds to dollars
-- and a £90 bill became $90.
--
-- Now one rule decides, in commune_private.currency_locked_by: the currency is
-- fixed once the commune has an expense, fund, recurring bill or exact split
-- template, voided or archived ones included, since they all keep their
-- amounts. update_commune_details enforces it, and the snapshot reports which
-- of those the commune has (commune.currencyLockedBy), so the settings screen
-- follows the same rule and can say why. Apply after 0034.
BEGIN;

CREATE FUNCTION commune_private.currency_locked_by(p_commune_id uuid)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN EXISTS (SELECT 1 FROM public.expenses WHERE commune_id = p_commune_id) THEN 'expenses' END,
    CASE WHEN EXISTS (SELECT 1 FROM public.funds WHERE commune_id = p_commune_id) THEN 'funds' END,
    CASE WHEN EXISTS (SELECT 1 FROM public.recurring_bills WHERE commune_id = p_commune_id) THEN 'recurringBills' END,
    CASE WHEN EXISTS (SELECT 1 FROM public.split_templates WHERE commune_id = p_commune_id AND method = 'Exact')
      THEN 'exactSplitTemplates' END
  ], NULL);
$$;
REVOKE ALL ON FUNCTION commune_private.currency_locked_by(uuid) FROM PUBLIC;

DO $$
DECLARE v_original text; v_source text;
BEGIN
  -- The commune row is already locked here, and adding an expense, fund, bill
  -- or template waits for that lock, so the rule cannot be raced.
  v_original := pg_get_functiondef('public.update_commune_details(uuid,text,text,text)'::regprocedure);
  v_source := replace(v_original,
'  IF p_currency <> v_currency AND (
    EXISTS (SELECT 1 FROM public.expenses WHERE commune_id = p_commune_id)
    OR EXISTS (SELECT 1 FROM public.funds WHERE commune_id = p_commune_id)
  ) THEN
    RAISE EXCEPTION ''Currency cannot change after expenses or funds exist''
      USING ERRCODE = ''22023'';
  END IF;',
'  IF p_currency <> v_currency AND cardinality(commune_private.currency_locked_by(p_commune_id)) > 0 THEN
    RAISE EXCEPTION ''The currency cannot change once this commune has an expense, fund, recurring bill or exact split template, even a voided or archived one''
      USING ERRCODE = ''22023'';
  END IF;');
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported commune details definition'; END IF;
  EXECUTE v_source;

  v_original := pg_get_functiondef('public.commune_snapshot(uuid)'::regprocedure);
  v_source := replace(v_original,
    '''memberCount'',(SELECT count(*) FROM public.commune_members cm WHERE cm.commune_id=co.id AND cm.active)),',
    '''memberCount'',(SELECT count(*) FROM public.commune_members cm WHERE cm.commune_id=co.id AND cm.active),
      ''currencyLockedBy'',to_jsonb(commune_private.currency_locked_by(co.id))),');
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported snapshot commune definition'; END IF;
  EXECUTE v_source;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
