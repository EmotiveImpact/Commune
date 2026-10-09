-- Invitations follow their sender, pledges belong to the pledger, and create
-- commands are retry-safe (0028). Run only in an empty disposable local DB
-- built from infra/local/bootstrap.sql, every migration and after-core.sql
-- (app_auth stands in for Neon Auth). Everything is rolled back.
BEGIN;

DO $$
DECLARE v_home uuid; v_money uuid;
BEGIN
  INSERT INTO app_auth.users (id, name, email, email_verified)
    VALUES ('00000000-0000-4000-8000-0000000000a1', 'Avery', 'avery@pledge.test', true),
           ('00000000-0000-4000-8000-0000000000b2', 'Blake', 'blake@pledge.test', true),
           ('00000000-0000-4000-8000-0000000000c3', 'Casey', 'casey@pledge.test', true),
           ('00000000-0000-4000-8000-0000000000d4', 'Drew', 'drew@pledge.test', true),
           ('00000000-0000-4000-8000-0000000000e5', 'Eli', 'eli@pledge.test', true),
           ('00000000-0000-4000-8000-0000000000f6', 'Fern', 'fern@pledge.test', true),
           ('00000000-0000-4000-8000-0000000000a7', 'Gale', 'gale@pledge.test', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000a1', 'role', 'authenticated')::text, true);
  v_home := public.create_commune('Invite home', 'household', 'GBP');
  v_money := public.create_commune('Money home', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role)
    VALUES (v_home, '00000000-0000-4000-8000-0000000000b2', 'admin'), (v_home, '00000000-0000-4000-8000-0000000000c3', 'member'),
           (v_home, '00000000-0000-4000-8000-0000000000a7', 'admin'),
           (v_money, '00000000-0000-4000-8000-0000000000b2', 'member'), (v_money, '00000000-0000-4000-8000-0000000000c3', 'member');
  PERFORM set_config('test.home', v_home::text, true);
  PERFORM set_config('test.money', v_money::text, true);
END;
$$;

-- 1. Invitations follow their sender.
SET ROLE authenticated;
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  a text := '00000000-0000-4000-8000-0000000000a1';
  b text := '00000000-0000-4000-8000-0000000000b2';
  c text := '00000000-0000-4000-8000-0000000000c3';
  d text := '00000000-0000-4000-8000-0000000000d4';
  e text := '00000000-0000-4000-8000-0000000000e5';
  g text := '00000000-0000-4000-8000-0000000000a7';
  v_token text; v_invite record;
BEGIN
  -- The reported takeover: an admin invites another account as admin, is
  -- removed, and that invitation must not let anyone back in.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  v_token := public.create_commune_invite(v_home, 'drew@pledge.test', 'admin');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  PERFORM public.manage_commune_member(v_home, b, 'remove');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  IF EXISTS (SELECT 1 FROM public.preview_commune_invite(v_token)) THEN
    RAISE EXCEPTION 'A removed admin''s invitation still previews';
  END IF;
  BEGIN
    PERFORM public.accept_commune_invite(v_token);
    RAISE EXCEPTION 'A removed admin''s invitation was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- The admin list shows it revoked, and who sent it.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SELECT * INTO v_invite FROM public.list_commune_invites(v_home) WHERE email = 'drew@pledge.test';
  IF v_invite.revoked_at IS NULL OR v_invite.invited_by <> b OR v_invite.invited_by_name <> 'Blake' THEN
    RAISE EXCEPTION 'Removed admin''s invitation was not revoked or its sender is missing: %', row_to_json(v_invite);
  END IF;
  IF EXISTS (SELECT 1 FROM public.commune_members WHERE commune_id = v_home AND user_id = d) THEN
    RAISE EXCEPTION 'The invitee joined';
  END IF;

  -- Leaving revokes the open invitations the leaver sent.
  PERFORM public.manage_commune_member(v_home, c, 'admin');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  v_token := public.create_commune_invite(v_home, 'eli@pledge.test', 'member');
  PERFORM public.manage_commune_member(v_home, c, 'leave');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.accept_commune_invite(v_token);
    RAISE EXCEPTION 'A departed admin''s invitation was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Demotion to member revokes them too; the other admin's stay open, and a
  -- later promotion does not bring the revoked ones back.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
  PERFORM public.create_commune_invite(v_home, 'fern@pledge.test', 'admin');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  PERFORM public.create_commune_invite(v_home, 'kept@pledge.test', 'member');
  PERFORM public.manage_commune_member(v_home, g, 'member');
  PERFORM public.manage_commune_member(v_home, g, 'admin');
  IF (SELECT revoked_at FROM public.list_commune_invites(v_home) WHERE email = 'fern@pledge.test') IS NULL THEN
    RAISE EXCEPTION 'A demoted admin''s invitation stayed open';
  END IF;
  IF (SELECT revoked_at FROM public.list_commune_invites(v_home) WHERE email = 'kept@pledge.test') IS NOT NULL THEN
    RAISE EXCEPTION 'Another admin''s invitation was revoked';
  END IF;
  IF (SELECT invited_by_name FROM public.list_commune_invites(v_home) WHERE email = 'kept@pledge.test') <> 'Avery' THEN
    RAISE EXCEPTION 'Invitation sender name missing';
  END IF;

  -- An invitation from an active admin still works.
  v_token := public.create_commune_invite(v_home, 'eli@pledge.test', 'member');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  IF NOT EXISTS (SELECT 1 FROM public.preview_commune_invite(v_token)) THEN
    RAISE EXCEPTION 'A valid invitation did not preview';
  END IF;
  IF public.accept_commune_invite(v_token) <> v_home THEN RAISE EXCEPTION 'A valid invitation was not accepted'; END IF;
END;
$$;
RESET ROLE;

-- An invitation left open while its sender stopped being an admin (as before
-- this migration): it cannot be previewed or accepted, and the clean-up the
-- migration ran revokes it, but not expired ones or an active admin's.
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  a text := '00000000-0000-4000-8000-0000000000a1';
  f text := '00000000-0000-4000-8000-0000000000f6';
  g text := '00000000-0000-4000-8000-0000000000a7';
  v_stale text; v_late text; v_count integer;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', g, 'role', 'authenticated')::text, true);
  v_stale := public.create_commune_invite(v_home, 'fern@pledge.test', 'member');
  v_late := public.create_commune_invite(v_home, 'late@pledge.test', 'member');
  UPDATE public.commune_invites SET created_at = now() - interval '9 days', expires_at = now() - interval '2 days'
    WHERE token_hash = digest(v_late, 'sha256');
  -- Demoted without the membership command, as an older database could hold.
  UPDATE public.commune_members SET role = 'member' WHERE commune_id = v_home AND user_id = g;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', f, 'role', 'authenticated')::text, true);
  IF EXISTS (SELECT 1 FROM public.preview_commune_invite(v_stale)) THEN
    RAISE EXCEPTION 'An invitation from a non-admin previews';
  END IF;
  BEGIN
    PERFORM public.accept_commune_invite(v_stale);
    RAISE EXCEPTION 'An invitation from a non-admin was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  v_count := commune_private.revoke_orphaned_invites(NULL);
  IF v_count <> 1 OR (SELECT revoked_at FROM public.commune_invites WHERE token_hash = digest(v_stale, 'sha256')) IS NULL THEN
    RAISE EXCEPTION 'Clean-up revoked % invitations, expected only the stale one', v_count;
  END IF;
  IF (SELECT revoked_at FROM public.commune_invites WHERE token_hash = digest(v_late, 'sha256')) IS NOT NULL
     OR (SELECT revoked_at FROM public.commune_invites WHERE commune_id = v_home AND email = 'kept@pledge.test') IS NOT NULL THEN
    RAISE EXCEPTION 'Clean-up revoked an expired invitation or an active admin''s';
  END IF;
  IF pg_get_function_result('public.list_commune_invites(uuid)'::regprocedure) NOT LIKE
     'TABLE(id uuid, email text, role text, created_at timestamp with time zone, expires_at timestamp with time zone, accepted_at timestamp with time zone, revoked_at timestamp with time zone, %' THEN
    RAISE EXCEPTION 'list_commune_invites changed its earlier columns';
  END IF;
END;
$$;

-- 2. Retry-safe create commands.
SET ROLE authenticated;
DO $$
DECLARE
  v_money uuid := current_setting('test.money')::uuid;
  a text := '00000000-0000-4000-8000-0000000000a1';
  b text := '00000000-0000-4000-8000-0000000000b2';
  c text := '00000000-0000-4000-8000-0000000000c3';
  d text := '00000000-0000-4000-8000-0000000000d4';
  v_request uuid := gen_random_uuid();
  v_shares jsonb; v_result jsonb; v_id uuid; v_other uuid; v_fund uuid; v_pledge uuid; v_case text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  v_shares := jsonb_build_array(jsonb_build_object('user_id', a, 'amount_minor', 1500), jsonb_build_object('user_id', b, 'amount_minor', 1500));
  v_result := public.create_expense_command(v_money, ' Groceries ', 3000, v_shares, current_date, NULL, 'Groceries', v_request);
  v_id := (v_result->>'id')::uuid;
  IF v_id IS NULL OR (v_result->>'duplicate')::boolean THEN RAISE EXCEPTION 'First expense attempt: %', v_result; END IF;
  -- The same decision again (shares listed in another order) is the same expense.
  v_result := public.create_expense_command(v_money, 'Groceries', 3000,
    jsonb_build_array(v_shares->1, v_shares->0), current_date, a, 'Groceries', v_request);
  IF (v_result->>'id')::uuid <> v_id OR NOT (v_result->>'duplicate')::boolean THEN
    RAISE EXCEPTION 'Expense retry was not recognised: %', v_result;
  END IF;
  IF (SELECT count(*) FROM public.expenses WHERE commune_id = v_money) <> 1 THEN
    RAISE EXCEPTION 'An expense retry recorded a second expense';
  END IF;
  FOREACH v_case IN ARRAY ARRAY['title', 'amount', 'date', 'category', 'split'] LOOP
    BEGIN
      PERFORM public.create_expense_command(v_money, CASE WHEN v_case = 'title' THEN 'Snacks' ELSE 'Groceries' END,
        CASE WHEN v_case = 'amount' THEN 3002 ELSE 3000 END,
        CASE v_case WHEN 'amount' THEN jsonb_build_array(jsonb_build_object('user_id', a, 'amount_minor', 1501), jsonb_build_object('user_id', b, 'amount_minor', 1501))
          WHEN 'split' THEN jsonb_build_array(jsonb_build_object('user_id', a, 'amount_minor', 1000), jsonb_build_object('user_id', b, 'amount_minor', 2000))
          ELSE v_shares END,
        CASE WHEN v_case = 'date' THEN current_date + 1 ELSE current_date END, NULL,
        CASE WHEN v_case = 'category' THEN 'Other' ELSE 'Groceries' END, v_request);
      RAISE EXCEPTION 'A reused expense request was accepted: %', v_case;
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM <> 'This request was already used for a different change' THEN RAISE; END IF;
    END;
  END LOOP;
  BEGIN
    PERFORM public.create_expense_command(v_money, 'Groceries', 3000, v_shares, NULL, NULL, 'Groceries', NULL);
    RAISE EXCEPTION 'An expense without a request id was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  -- Request ids belong to the person acting: Blake's id cannot collide with Avery's.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  v_result := public.create_expense_command(v_money, 'Taxi', 1000,
    jsonb_build_array(jsonb_build_object('user_id', b, 'amount_minor', 1000)), NULL, NULL, 'Travel', v_request);
  IF (v_result->>'id')::uuid = v_id OR (v_result->>'duplicate')::boolean THEN RAISE EXCEPTION 'Request ids collided across people'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.create_expense_command(v_money, 'Groceries', 3000, v_shares, NULL, NULL, 'Groceries', gen_random_uuid());
    RAISE EXCEPTION 'An outsider recorded an expense';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- Once voided, the expense no longer stands as the request made it.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  PERFORM public.void_expense(v_id, 1, 'Entered twice', gen_random_uuid());
  BEGIN
    PERFORM public.create_expense_command(v_money, 'Groceries', 3000, v_shares, current_date, NULL, 'Groceries', v_request);
    RAISE EXCEPTION 'A retry reported a voided expense as saved';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  -- The older RPC still records an expense.
  IF public.create_expense(v_money, 'Legacy bill', 1000, jsonb_build_array(jsonb_build_object('user_id', a, 'amount_minor', 1000))) IS NULL THEN
    RAISE EXCEPTION 'The older expense RPC failed';
  END IF;

  -- Funds.
  v_request := gen_random_uuid();
  v_result := public.create_fund_command(v_money, ' Boiler fund ', 50000, v_request);
  v_fund := (v_result->>'id')::uuid;
  IF (v_result->>'duplicate')::boolean THEN RAISE EXCEPTION 'First fund attempt reported as a duplicate'; END IF;
  v_result := public.create_fund_command(v_money, 'Boiler fund', 50000, v_request);
  IF (v_result->>'id')::uuid <> v_fund OR NOT (v_result->>'duplicate')::boolean THEN
    RAISE EXCEPTION 'Fund retry was not recognised: %', v_result;
  END IF;
  BEGIN
    PERFORM public.create_fund_command(v_money, 'Boiler fund', 60000, v_request);
    RAISE EXCEPTION 'A reused fund request was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'This request was already used for a different change' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.funds WHERE commune_id = v_money AND name = 'Boiler fund') <> 1 THEN
    RAISE EXCEPTION 'A fund retry created a second fund';
  END IF;
  v_other := public.create_fund(v_money, 'Spare fund');
  IF (SELECT request_id FROM public.funds WHERE id = v_other) IS NULL THEN RAISE EXCEPTION 'The older fund RPC skipped the command'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.create_fund_command(v_money, 'Member fund', NULL, gen_random_uuid());
    RAISE EXCEPTION 'A member created a fund';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Pledges.
  v_request := gen_random_uuid();
  v_result := public.pledge_fund_command(v_fund, 10000, current_date + 30, v_request);
  v_pledge := (v_result->>'id')::uuid;
  IF (v_result->>'duplicate')::boolean THEN RAISE EXCEPTION 'First pledge attempt reported as a duplicate'; END IF;
  v_result := public.pledge_fund_command(v_fund, 10000, current_date + 30, v_request);
  IF (v_result->>'id')::uuid <> v_pledge OR NOT (v_result->>'duplicate')::boolean THEN
    RAISE EXCEPTION 'Pledge retry was not recognised: %', v_result;
  END IF;
  BEGIN
    PERFORM public.pledge_fund_command(v_fund, 9000, current_date + 30, v_request);
    RAISE EXCEPTION 'A reused pledge request was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'This request was already used for a different change' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.pledge_fund_command(v_fund, 9000, current_date + 30, gen_random_uuid());
    RAISE EXCEPTION 'A second pledge was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'You already have a pledge; edit it instead' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.fund_commitments WHERE fund_id = v_fund AND user_id = b) <> 1 THEN
    RAISE EXCEPTION 'A pledge retry created a second pledge';
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  IF public.pledge_fund(v_fund, 3000, current_date + 30) IS NULL THEN RAISE EXCEPTION 'The older pledge RPC failed'; END IF;

  -- Contributions.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  v_request := gen_random_uuid();
  v_result := public.record_fund_contribution_command(v_pledge, 4000, v_request);
  v_id := (v_result->>'id')::uuid;
  IF (v_result->>'duplicate')::boolean THEN RAISE EXCEPTION 'First contribution attempt reported as a duplicate'; END IF;
  v_result := public.record_fund_contribution_command(v_pledge, 4000, v_request);
  IF (v_result->>'id')::uuid <> v_id OR NOT (v_result->>'duplicate')::boolean THEN
    RAISE EXCEPTION 'Contribution retry was not recognised: %', v_result;
  END IF;
  BEGIN
    PERFORM public.record_fund_contribution_command(v_pledge, 4500, v_request);
    RAISE EXCEPTION 'A reused contribution request was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'This request was already used for a different change' THEN RAISE; END IF;
  END;
  IF public.record_fund_contribution(v_pledge, 1000) IS NULL THEN RAISE EXCEPTION 'The older contribution RPC failed'; END IF;
  IF (SELECT sum(amount_minor) FROM public.fund_contributions WHERE commitment_id = v_pledge) <> 5000 THEN
    RAISE EXCEPTION 'A contribution retry recorded money twice';
  END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.record_fund_contribution_command(v_pledge, 100, gen_random_uuid());
    RAISE EXCEPTION 'A member confirmed a contribution';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('test.fund', v_fund::text, true);
  PERFORM set_config('test.pledge', v_pledge::text, true);
END;
$$;

-- 3. Only the pledger raises a pledge or brings it forward.
DO $$
DECLARE
  v_money uuid := current_setting('test.money')::uuid;
  v_pledge uuid := current_setting('test.pledge')::uuid;
  v_fund uuid := current_setting('test.fund')::uuid;
  a text := '00000000-0000-4000-8000-0000000000a1';
  b text := '00000000-0000-4000-8000-0000000000b2';
  c text := '00000000-0000-4000-8000-0000000000c3';
  v_case text; v_casey uuid; v_snapshot jsonb; v_notices jsonb;
BEGIN
  -- Blake's pledge: 100.00 due in 30 days, 50.00 recorded. Blake may raise it
  -- and bring it forward, and nobody is told about their own change.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  PERFORM public.update_fund_pledge(v_pledge, 12000, current_date + 10);

  -- An admin cannot raise it or bring it forward, alone or with a fair change.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  FOREACH v_case IN ARRAY ARRAY['raise', 'earlier', 'raise-later', 'lower-earlier'] LOOP
    BEGIN
      PERFORM public.update_fund_pledge(v_pledge,
        CASE WHEN v_case IN ('raise', 'raise-later') THEN 12500 WHEN v_case = 'lower-earlier' THEN 11000 ELSE 12000 END,
        CASE WHEN v_case IN ('earlier', 'lower-earlier') THEN current_date + 5 WHEN v_case = 'raise-later' THEN current_date + 20 ELSE current_date + 10 END);
      RAISE EXCEPTION 'An admin changed someone''s pledge: %', v_case;
    EXCEPTION WHEN insufficient_privilege THEN
      IF SQLERRM <> 'Only the person who made this pledge can raise it or bring its due date forward' THEN RAISE; END IF;
    END;
  END LOOP;
  -- Never below what is already recorded.
  BEGIN
    PERFORM public.update_fund_pledge(v_pledge, 4000, current_date + 10);
    RAISE EXCEPTION 'A pledge went below its recorded contributions';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  -- Lowering and moving later are allowed, and each is reported to Blake.
  PERFORM public.update_fund_pledge(v_pledge, 11000, current_date + 10);
  PERFORM public.update_fund_pledge(v_pledge, 11000, current_date + 20);
  -- Saving it unchanged tells nobody anything.
  PERFORM public.update_fund_pledge(v_pledge, 11000, current_date + 20);
  IF (SELECT row(amount_minor, due_on) FROM public.fund_commitments WHERE id = v_pledge) IS DISTINCT FROM row(11000::bigint, current_date + 20) THEN
    RAISE EXCEPTION 'The admin''s change was not saved';
  END IF;

  -- A member who is not the pledger cannot change it at all.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.update_fund_pledge(v_pledge, 10000, current_date + 20);
    RAISE EXCEPTION 'A member changed someone else''s pledge';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'Only the pledger or an admin can change this pledge' THEN RAISE; END IF;
  END;
  SELECT id INTO v_casey FROM public.fund_commitments WHERE fund_id = v_fund AND user_id = c;

  -- An admin cancels Casey's pledge; cancelling again tells Casey only once.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  PERFORM public.update_fund_pledge(v_casey, NULL, NULL, true);
  PERFORM public.update_fund_pledge(v_casey, NULL, NULL, true);
  IF EXISTS (SELECT 1 FROM public.notifications) THEN RAISE EXCEPTION 'Avery was told about their own changes'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  v_snapshot := public.commune_snapshot(v_money);
  SELECT coalesce(jsonb_agg(n ORDER BY n->>'detail'), '[]'::jsonb) INTO v_notices
    FROM jsonb_array_elements(v_snapshot->'notifications') n WHERE n->>'kind' LIKE 'pledge-%';
  IF jsonb_array_length(v_notices) <> 2 THEN RAISE EXCEPTION 'Blake should have two pledge notices: %', v_notices; END IF;
  IF v_notices->0->>'kind' <> 'pledge-changed' OR v_notices->0->>'sourceId' <> v_pledge::text
     OR v_notices->0->>'title' <> 'Boiler fund' OR v_notices->0->>'senderUserId' <> a
     OR v_notices->0->>'detail' <> format('Due date moved from %s to %s.', to_char(current_date + 10, 'FMDD Mon YYYY'), to_char(current_date + 20, 'FMDD Mon YYYY'))
     OR v_notices->1->>'detail' <> 'Lowered from £120.00 to £110.00.' OR (v_notices->1->>'amountMinor')::bigint <> 11000 THEN
    RAISE EXCEPTION 'Pledge notices do not say who changed what: %', v_notices;
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  v_snapshot := public.commune_snapshot(v_money);
  SELECT coalesce(jsonb_agg(n), '[]'::jsonb) INTO v_notices
    FROM jsonb_array_elements(v_snapshot->'notifications') n WHERE n->>'kind' LIKE 'pledge-%';
  IF jsonb_array_length(v_notices) <> 1 OR v_notices->0->>'kind' <> 'pledge-cancelled' OR v_notices->0->>'sourceId' <> v_casey::text
     OR (v_notices->0->>'amountMinor')::bigint <> 3000 OR v_notices->0->>'senderUserId' <> a THEN
    RAISE EXCEPTION 'Casey should have one cancellation notice: %', v_notices;
  END IF;
END;
$$;
RESET ROLE;

-- Members run the commands; the helpers are private.
DO $$
DECLARE v_name text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'public.create_expense_command(uuid,text,bigint,jsonb,date,text,text,uuid)',
    'public.create_fund_command(uuid,text,bigint,uuid)',
    'public.pledge_fund_command(uuid,bigint,date,uuid)',
    'public.record_fund_contribution_command(uuid,bigint,uuid)',
    'public.list_commune_invites(uuid)'
  ] LOOP
    IF has_function_privilege('anonymous', v_name, 'EXECUTE') OR has_function_privilege('public', v_name, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_name, 'EXECUTE') THEN
      RAISE EXCEPTION 'Unexpected execution grant on %', v_name;
    END IF;
  END LOOP;
  FOREACH v_name IN ARRAY ARRAY[
    'commune_private.revoke_orphaned_invites(uuid)',
    'commune_private.notify_pledge(uuid,text,text,uuid,text,bigint,text)'
  ] LOOP
    IF has_function_privilege('authenticated', v_name, 'EXECUTE') OR has_function_privilege('anonymous', v_name, 'EXECUTE') THEN
      RAISE EXCEPTION 'Private helper is callable by a client: %', v_name;
    END IF;
  END LOOP;
END;
$$;
ROLLBACK;
