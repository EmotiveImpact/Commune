-- Currency rule (0035). Run only in an empty disposable local DB built from
-- infra/neon/tests/local_auth_stub.sql and every migration. Everything is
-- rolled back.
BEGIN;

CREATE FUNCTION pg_temp.act_as(p_user text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
-- 'ok', or the SQLSTATE and message a change of currency was refused with.
CREATE FUNCTION pg_temp.try_currency(p_commune uuid, p_currency text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.update_commune_details(p_commune, (SELECT name FROM public.communes WHERE id = p_commune), 'household', p_currency);
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN RETURN SQLSTATE || ' ' || SQLERRM;
END;
$$;
-- What the snapshot says keeps the currency as it is.
CREATE FUNCTION pg_temp.locked_by(p_commune uuid) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.commune_snapshot(p_commune) -> 'commune' -> 'currencyLockedBy';
$$;
-- A commune in pounds, with Alice as admin and Bea as a member.
CREATE FUNCTION pg_temp.home(p_name text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_home uuid;
BEGIN
  v_home := public.create_commune(p_name, 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role) VALUES (v_home, 'currency-bea', 'member');
  RETURN v_home;
END;
$$;

DO $$
DECLARE
  v_open uuid; v_exact uuid; v_voided uuid; v_fund uuid; v_bill uuid; v_expense uuid; v_id uuid;
  v_shares jsonb := '[{"user_id":"currency-alice","amount_minor":1500},{"user_id":"currency-bea","amount_minor":1500}]';
  v_refused text := '22023 The currency cannot change once this commune has an expense, fund, recurring bill or exact split template%';
BEGIN
  PERFORM pg_temp.act_as('currency-alice');

  -- Nothing with an amount yet: the currency can change, and change back. A
  -- percentage split template holds no amounts, so it changes nothing.
  v_open := pg_temp.home('Open home');
  PERFORM public.save_split_template(v_open, 'Even', 'Percentage',
    '[{"user_id":"currency-alice","value":"50"},{"user_id":"currency-bea","value":"50"}]');
  IF pg_temp.try_currency(v_open, 'USD') <> 'ok' OR pg_temp.try_currency(v_open, 'GBP') <> 'ok' THEN
    RAISE EXCEPTION 'A commune with no amounts should be able to change currency';
  END IF;

  -- An exact split template holds amounts, and keeps them when archived.
  v_exact := pg_temp.home('Exact home');
  v_id := public.save_split_template(v_exact, 'Rent', 'Exact',
    '[{"user_id":"currency-alice","value":"600.00"},{"user_id":"currency-bea","value":"400.00"}]');
  PERFORM public.save_split_template(v_exact, 'Rent', 'Exact', '[]', v_id, true);
  IF pg_temp.try_currency(v_exact, 'EUR') NOT LIKE v_refused THEN
    RAISE EXCEPTION 'An archived exact split template should fix the currency, got %', pg_temp.try_currency(v_exact, 'EUR');
  END IF;

  -- So does a recurring bill, archived or not.
  v_bill := pg_temp.home('Bill home');
  v_id := public.save_recurring_bill(v_bill, 'Broadband', 3000, 'currency-alice', v_shares, 'monthly', current_date + 7,
    p_request_id => gen_random_uuid());
  PERFORM public.set_recurring_bill_archived(v_id, true);
  IF pg_temp.try_currency(v_bill, 'EUR') NOT LIKE v_refused THEN
    RAISE EXCEPTION 'An archived recurring bill should fix the currency, got %', pg_temp.try_currency(v_bill, 'EUR');
  END IF;

  -- An expense counts once voided, and a fund once archived: both still show
  -- their amounts.
  v_voided := pg_temp.home('Voided home');
  v_expense := public.create_expense(v_voided, 'Taxi', 3000, v_shares, NULL);
  PERFORM public.void_expense(v_expense, 1, 'Entered twice', gen_random_uuid());
  IF pg_temp.try_currency(v_voided, 'USD') NOT LIKE v_refused THEN
    RAISE EXCEPTION 'A voided expense should fix the currency, got %', pg_temp.try_currency(v_voided, 'USD');
  END IF;
  v_fund := pg_temp.home('Fund home');
  PERFORM public.set_fund_archived(public.create_fund(v_fund, 'Holiday', 50000), true);
  IF pg_temp.try_currency(v_fund, 'USD') NOT LIKE v_refused THEN
    RAISE EXCEPTION 'An archived fund should fix the currency, got %', pg_temp.try_currency(v_fund, 'USD');
  END IF;

  -- Only the currency is fixed: the rest of the details still change.
  PERFORM public.update_commune_details(v_fund, 'Fund flat', 'workspace', 'GBP');
  IF (SELECT name || ' ' || kind || ' ' || currency FROM public.communes WHERE id = v_fund) <> 'Fund flat workspace GBP' THEN
    RAISE EXCEPTION 'Other details should still change once the currency is fixed';
  END IF;

  -- The snapshot reports the same rule, so the settings screen can say why.
  PERFORM public.create_expense(v_exact, 'Deposit', 3000, v_shares, NULL);
  IF pg_temp.locked_by(v_open) IS DISTINCT FROM '[]'::jsonb
     OR pg_temp.locked_by(v_exact) IS DISTINCT FROM '["expenses", "exactSplitTemplates"]'::jsonb
     OR pg_temp.locked_by(v_bill) IS DISTINCT FROM '["recurringBills"]'::jsonb
     OR pg_temp.locked_by(v_voided) IS DISTINCT FROM '["expenses"]'::jsonb
     OR pg_temp.locked_by(v_fund) IS DISTINCT FROM '["funds"]'::jsonb THEN
    RAISE EXCEPTION 'The snapshot should report what fixes the currency, got % % % % %', pg_temp.locked_by(v_open),
      pg_temp.locked_by(v_exact), pg_temp.locked_by(v_bill), pg_temp.locked_by(v_voided), pg_temp.locked_by(v_fund);
  END IF;
  PERFORM pg_temp.act_as('currency-bea');
  IF pg_temp.locked_by(v_bill) IS DISTINCT FROM '["recurringBills"]'::jsonb THEN
    RAISE EXCEPTION 'Every member should see what fixes the currency';
  END IF;
END;
$$;

ROLLBACK;
