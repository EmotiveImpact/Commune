-- Database hardening (0034). Run only in an empty disposable local DB built
-- from infra/neon/tests/local_auth_stub.sql and every migration. Everything
-- is rolled back.
BEGIN;

DO $$
DECLARE
  v_home uuid; v_solo uuid; v_fund uuid; v_pledge uuid; v_solo_pledge uuid; v_expense uuid; v_share uuid;
  v_activity jsonb; v_reminder_old uuid; v_reminder_new uuid; v_pruned jsonb; v_failed boolean := false;
  v_gas uuid; v_gas_share uuid; v_receipt jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'hard-alice', 'role', 'authenticated')::text, true);
  v_home := public.create_commune('Hardening home', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role)
    VALUES (v_home, 'hard-bea', 'admin'), (v_home, 'hard-cal', 'member');
  PERFORM set_config('test.home', v_home::text, true);

  -- Alice's own pledge is confirmed by Bea, the other admin.
  v_fund := public.create_fund(v_home, 'Boiler', 50000);
  v_pledge := public.pledge_fund(v_fund, 10000, current_date);
  BEGIN
    PERFORM public.record_fund_contribution(v_pledge, 2000);
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := SQLERRM = 'Ask another admin to confirm contributions to your own pledge';
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'An admin confirmed money towards their own pledge'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'hard-bea', 'role', 'authenticated')::text, true);
  PERFORM public.record_fund_contribution(v_pledge, 2000);
  -- Once Bea is no longer an admin, Alice is the only one who can.
  UPDATE public.commune_members SET role = 'member' WHERE commune_id = v_home AND user_id = 'hard-bea';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'hard-alice', 'role', 'authenticated')::text, true);
  PERFORM public.record_fund_contribution(v_pledge, 1000);
  IF (SELECT sum(amount_minor) FROM public.fund_contributions WHERE commitment_id = v_pledge) <> 3000 THEN
    RAISE EXCEPTION 'Contributions were not recorded';
  END IF;
  -- A commune with one admin still works.
  v_solo := public.create_commune('Solo home', 'household', 'GBP');
  v_solo_pledge := public.pledge_fund(public.create_fund(v_solo, 'Paint', 9000), 3000, current_date);
  PERFORM public.record_fund_contribution(v_solo_pledge, 3000);

  -- A void stays in the activity however much happens after it.
  v_expense := public.create_expense(v_home, 'Broadband', 3000,
    '[{"user_id":"hard-alice","amount_minor":1500},{"user_id":"hard-cal","amount_minor":1500}]'::jsonb, current_date);
  PERFORM public.void_expense(v_expense, 1, 'Entered twice', gen_random_uuid());
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description, created_at)
    SELECT v_home, 'hard-cal', 'notes', gen_random_uuid(), 'Wifi', 'Updated', now() + make_interval(secs => g)
    FROM generate_series(1, 150) g;
  -- An older correction is not carried, flood or not.
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description, created_at)
    VALUES (v_home, 'hard-alice', 'expenses', gen_random_uuid(), 'Old bill', 'Expense corrected', now() - interval '100 days');
  v_activity := public.commune_snapshot(v_home)->'activityEvents';
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_activity) e WHERE e->>'description' = 'Expense voided' AND e->>'title' = 'Broadband')
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_activity) e WHERE e->>'title' = 'Old bill')
     OR jsonb_array_length(v_activity) <> 101 THEN
    RAISE EXCEPTION 'The activity should keep the void among the latest 100 events, got %', jsonb_array_length(v_activity);
  END IF;
  IF commune_private.money_correction_reserve('funds', 'Contribution corrected', '{}') IS DISTINCT FROM 'correction'
     OR commune_private.money_correction_reserve('expenses', 'Expense voided', '{}') IS DISTINCT FROM 'correction'
     OR commune_private.money_correction_reserve('expenses', 'Repayment of £5.00 reversed', '{"reversed": true}') IS DISTINCT FROM 'reversal'
     OR commune_private.money_correction_reserve('expenses', 'Repayment of £5.00 recorded', '{"reversed": false}') IS NOT NULL
     OR commune_private.money_correction_reserve('notes', 'Updated', '{"reversed": true}') IS NOT NULL THEN
    RAISE EXCEPTION 'Money corrections were not told apart';
  END IF;

  -- Nor can recording and reversing a receipt again and again push the void
  -- out: reversals have a reserve of their own. Each round below happens
  -- after the void and the notes (in this one transaction now() stands
  -- still, so their times are set apart afterwards).
  v_gas := public.create_expense(v_home, 'Gas', 3000,
    '[{"user_id":"hard-alice","amount_minor":1500},{"user_id":"hard-cal","amount_minor":1500}]'::jsonb, current_date);
  SELECT id INTO v_gas_share FROM public.expense_shares WHERE expense_id = v_gas AND user_id = 'hard-cal';
  FOR i IN 1..60 LOOP
    v_receipt := public.record_share_receipt(v_gas_share, 100, current_date, NULL, gen_random_uuid());
    PERFORM public.reverse_share_receipt((v_receipt->>'id')::uuid, 'Recorded by mistake');
  END LOOP;
  UPDATE public.commune_events e SET created_at = now() + make_interval(secs => 200 + r.n)
    FROM (SELECT id, row_number() OVER (ORDER BY id) AS n FROM public.commune_events
      WHERE commune_id = v_home AND entity_id = v_gas AND details ? 'reversed') r
    WHERE e.id = r.id;
  IF (SELECT count(*) FROM public.commune_events WHERE commune_id = v_home AND entity_id = v_gas
      AND commune_private.money_correction_reserve(kind, description, details) = 'reversal') <> 60 THEN
    RAISE EXCEPTION 'Expected 60 receipt reversals';
  END IF;
  v_activity := public.commune_snapshot(v_home)->'activityEvents';
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_activity) e WHERE e->>'description' = 'Expense voided' AND e->>'title' = 'Broadband') THEN
    RAISE EXCEPTION 'Receipt reversals pushed the void out of the activity';
  END IF;

  -- Email records older than 30 days lose their addresses and bodies.
  SELECT id INTO v_share FROM public.expense_shares WHERE expense_id = v_expense AND user_id = 'hard-cal';
  INSERT INTO public.reminders (commune_id, kind, source_id, sender_user_id, recipient_user_id, amount_minor, created_at)
    VALUES (v_home, 'nudge', v_share, 'hard-alice', 'hard-cal', 1500, now() - interval '31 days') RETURNING id INTO v_reminder_old;
  INSERT INTO public.reminders (commune_id, kind, source_id, sender_user_id, recipient_user_id, amount_minor)
    VALUES (v_home, 'nudge', v_share, 'hard-alice', 'hard-cal', 1500) RETURNING id INTO v_reminder_new;
  INSERT INTO public.reminder_email_outbox (reminder_id, status, payload, payload_amount_minor, created_at) VALUES
    (v_reminder_old, 'sent', '{"to": ["cal@hardening.test"]}', 1500, now() - interval '31 days'),
    (v_reminder_new, 'sent', '{"to": ["cal@hardening.test"]}', 1500, now());
  PERFORM public.create_commune_invite(v_home, 'dee@hardening.test', 'member');
  PERFORM public.create_commune_invite(v_home, 'eve@hardening.test', 'member');
  INSERT INTO public.invitation_email_deliveries (invite_id, commune_id, sender_id, recipient_email, status, payload, created_at)
    SELECT i.id, v_home, 'hard-alice', i.email, 'sent', '{}',
      CASE i.email WHEN 'dee@hardening.test' THEN now() - interval '31 days' ELSE now() END
    FROM public.commune_invites i WHERE i.commune_id = v_home;
  v_pruned := commune_private.prune_delivery_records();
  IF v_pruned <> '{"reminderPayloads": 1, "invitationEmails": 1}'::jsonb
     OR (SELECT payload FROM public.reminder_email_outbox WHERE reminder_id = v_reminder_old) IS NOT NULL
     OR (SELECT payload_amount_minor FROM public.reminder_email_outbox WHERE reminder_id = v_reminder_old) IS NOT NULL
     OR (SELECT status FROM public.reminder_email_outbox WHERE reminder_id = v_reminder_old) <> 'sent'
     OR (SELECT payload FROM public.reminder_email_outbox WHERE reminder_id = v_reminder_new) IS NULL
     OR EXISTS (SELECT 1 FROM public.invitation_email_deliveries WHERE recipient_email = 'dee@hardening.test')
     OR NOT EXISTS (SELECT 1 FROM public.invitation_email_deliveries WHERE recipient_email = 'eve@hardening.test')
     OR NOT EXISTS (SELECT 1 FROM public.commune_invites WHERE email = 'dee@hardening.test') THEN
    RAISE EXCEPTION 'Old email records were not trimmed as expected: %', v_pruned;
  END IF;
  IF commune_private.prune_delivery_records() <> '{"reminderPayloads": 0, "invitationEmails": 0}'::jsonb THEN
    RAISE EXCEPTION 'A second run should find nothing to trim';
  END IF;
END;
$$;

-- A signed-in person cannot run the extensions' functions, while Commune's
-- own functions that use them still work.
SET ROLE authenticated;
DO $$
DECLARE v_home uuid := current_setting('test.home')::uuid; v_token text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'hard-alice', 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.gen_salt('bf', 12);
    RAISE EXCEPTION 'A signed-in person could run pgcrypto';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.similarity('broadband', 'broad');
    RAISE EXCEPTION 'A signed-in person could run pg_trgm';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM commune_private.prune_delivery_records();
    RAISE EXCEPTION 'A signed-in person could trim email records';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  v_token := public.create_commune_invite(v_home, 'fay@hardening.test', 'member');
  IF (SELECT commune_name FROM public.preview_commune_invite(v_token)) <> 'Hardening home' THEN
    RAISE EXCEPTION 'An invitation could not be previewed';
  END IF;
  IF (public.search_commune_records('Broadband', v_home, 8)->>'total')::integer < 1 THEN
    RAISE EXCEPTION 'Search stopped working';
  END IF;
END;
$$;
RESET ROLE;

ROLLBACK;
