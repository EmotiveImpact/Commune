-- Run only in an empty disposable local DB after local_auth_stub.sql and
-- migrations 0001 through 0025 and 0042. Real Neon verification must use signed JWTs.
BEGIN;

DO $$
DECLARE
  v_home uuid;
  v_other uuid;
BEGIN
  INSERT INTO neon_auth."user" (id, name, email, "emailVerified")
    VALUES ('pay-alice', 'Alice', 'alice@pay.test', true),
           ('pay-bob', 'Bob', 'bob@pay.test', true),
           ('pay-carol', 'Carol', 'carol@pay.test', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'pay-alice', 'role', 'authenticated')::text, true);
  v_home := public.create_commune('Pay home', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role) VALUES (v_home, 'pay-bob', 'member');
  PERFORM set_config('test.pay_home', v_home::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'pay-carol', 'role', 'authenticated')::text, true);
  v_other := public.create_commune('Carol home', 'household', 'GBP');
  PERFORM set_config('test.pay_other', v_other::text, true);
END;
$$;

SET ROLE authenticated;

-- Alice saves her links. Pasted links and @names keep only the username.
SELECT set_config('request.jwt.claims', json_build_object('sub', 'pay-alice', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  v_links jsonb;
BEGIN
  PERFORM public.set_pay_link('Monzo', 'https://monzo.me/alice-h/16.00', NULL, NULL, NULL);
  PERFORM public.set_pay_link('paypal', '@AliceH', 'ignored', '000000', '00000000');
  v_links := public.set_pay_link('bank', 'ignored', ' Alice Hale ', '20-45-77', '4102 9388');
  IF jsonb_array_length(v_links) <> 3 THEN RAISE EXCEPTION 'Expected three links, got %', v_links; END IF;
  IF v_links->0->>'provider' <> 'monzo' OR v_links->0->>'handle' <> 'alice-h' THEN
    RAISE EXCEPTION 'Monzo link was not reduced to its username: %', v_links->0;
  END IF;
  IF v_links->1->>'handle' <> 'AliceH' OR v_links->1->>'sortCode' IS NOT NULL THEN
    RAISE EXCEPTION 'PayPal link kept the wrong fields: %', v_links->1;
  END IF;
  IF v_links->2->>'accountName' <> 'Alice Hale' OR v_links->2->>'sortCode' <> '204577'
    OR v_links->2->>'accountNumber' <> '41029388' OR v_links->2->>'handle' IS NOT NULL THEN
    RAISE EXCEPTION 'Bank details were not normalised: %', v_links->2;
  END IF;
  -- Saving again replaces rather than duplicates.
  v_links := public.set_pay_link('monzo', 'alicehale', NULL, NULL, NULL);
  IF jsonb_array_length(v_links) <> 3 OR v_links->0->>'handle' <> 'alicehale' THEN
    RAISE EXCEPTION 'Saving again did not replace the Monzo link: %', v_links;
  END IF;

  BEGIN PERFORM public.set_pay_link('venmo', 'alice', NULL, NULL, NULL);
    RAISE EXCEPTION 'An unknown provider was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  BEGIN PERFORM public.set_pay_link('monzo', 'alice hale', NULL, NULL, NULL);
    RAISE EXCEPTION 'A username with a space was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  BEGIN PERFORM public.set_pay_link('revolut', '', NULL, NULL, NULL);
    RAISE EXCEPTION 'An empty username was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  BEGIN PERFORM public.set_pay_link('bank', NULL, 'Alice', '20457', '41029388');
    RAISE EXCEPTION 'A five-digit sort code was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  BEGIN PERFORM public.set_pay_link('bank', NULL, 'Alice', '204577', '4102938');
    RAISE EXCEPTION 'A seven-digit account number was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  BEGIN PERFORM public.set_pay_link('bank', NULL, '', '204577', '41029388');
    RAISE EXCEPTION 'A bank account without a name was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;

  -- No direct access to the table.
  BEGIN PERFORM 1 FROM public.member_pay_links;
    RAISE EXCEPTION 'The table was readable directly';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  BEGIN INSERT INTO public.member_pay_links (user_id, provider, handle) VALUES ('pay-bob', 'monzo', 'forged');
    RAISE EXCEPTION 'The table was writable directly';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
END;
$$;

-- Bob shares a commune with Alice: he sees her links, and his own list is empty.
SELECT set_config('request.jwt.claims', json_build_object('sub', 'pay-bob', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  v_home uuid := current_setting('test.pay_home')::uuid;
  v_links jsonb;
BEGIN
  v_links := public.commune_snapshot(v_home)->'payLinks';
  IF jsonb_array_length(v_links->'pay-alice') <> 3 THEN
    RAISE EXCEPTION 'A commune member did not see Alice''s links: %', v_links;
  END IF;
  IF v_links ? 'pay-bob' THEN RAISE EXCEPTION 'Bob appeared without any links'; END IF;
  IF jsonb_array_length(public.my_pay_links()) <> 0 THEN RAISE EXCEPTION 'Bob was given someone else''s links'; END IF;
  -- Bob can only change his own.
  PERFORM public.remove_pay_link('monzo');
END;
$$;

-- Carol shares no commune with Alice and cannot see her links.
SELECT set_config('request.jwt.claims', json_build_object('sub', 'pay-carol', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  v_home uuid := current_setting('test.pay_home')::uuid;
  v_other uuid := current_setting('test.pay_other')::uuid;
BEGIN
  IF public.commune_snapshot(v_other)->'payLinks' ? 'pay-alice' THEN
    RAISE EXCEPTION 'Alice''s links leaked into a commune she is not in';
  END IF;
  BEGIN
    IF public.commune_snapshot(v_home)->'payLinks' ? 'pay-alice' THEN
      RAISE EXCEPTION 'An outsider read Alice''s links';
    END IF;
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
END;
$$;

-- Alice still has all three, removes one, and leaving the commune stops sharing.
SELECT set_config('request.jwt.claims', json_build_object('sub', 'pay-alice', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  v_links jsonb;
BEGIN
  v_links := public.my_pay_links();
  IF jsonb_array_length(v_links) <> 3 OR v_links->0->>'handle' <> 'alicehale' THEN
    RAISE EXCEPTION 'Bob changed Alice''s links: %', v_links;
  END IF;
  v_links := public.remove_pay_link('paypal');
  IF jsonb_array_length(v_links) <> 2 OR v_links @> '[{"provider":"paypal"}]' THEN
    RAISE EXCEPTION 'PayPal was not removed: %', v_links;
  END IF;
  v_links := public.remove_pay_link('paypal');
  IF jsonb_array_length(v_links) <> 2 THEN RAISE EXCEPTION 'Removing twice changed something'; END IF;
END;
$$;

RESET ROLE;
-- A departure keeps the membership row, marked inactive.
UPDATE public.commune_members SET active = false, left_at = now()
  WHERE user_id = 'pay-alice' AND commune_id = current_setting('test.pay_home')::uuid;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', 'pay-bob', 'role', 'authenticated')::text, true);
DO $$
BEGIN
  IF public.commune_snapshot(current_setting('test.pay_home')::uuid)->'payLinks' ? 'pay-alice' THEN
    RAISE EXCEPTION 'Links were still shared after Alice left';
  END IF;
END;
$$;

RESET ROLE;
ROLLBACK;
