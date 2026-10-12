-- Smaller hardening, each low risk today:
-- 1. pgcrypto and pg_trgm put their functions in public, where any role could
--    run them and the Data API offered those it can call as RPCs (eight, such
--    as gen_salt and show_trgm). Only Commune's own definer functions use
--    them (invitation tokens), and those run as the owner, so no one else may
--    call them. Only the functions' owner can take that away, so when the
--    role applying this is not their owner it warns and names them instead
--    (see infra/neon/README.md). Search indexes keep working: an index never
--    checks who may call its functions.
-- 2. An admin could confirm contributions to their own pledge. When the
--    commune has another admin, that admin confirms them instead.
-- 3. The snapshot's activity was the latest 100 events, so a burst of edits
--    could push a void or correction out of sight. It now also carries the
--    last 90 days' voids and corrections (at most 50) and, separately, their
--    receipt reversals (at most 50), so reversing receipts again and again
--    cannot push a void out either.
-- 4. Email delivery records kept addresses and message bodies for ever. The
--    worker's scheduled run now trims those older than 30 days. A reminder is
--    never retried after 23 hours, an invitation expires after 7 days and the
--    sending limits look back one day, so nothing still needs them.
-- Notices, activity, reminders and invitations themselves are what people see
-- in Commune, and are kept. Apply after 0033.
BEGIN;

DO $$
DECLARE
  v_function regprocedure; v_roles text := 'PUBLIC, authenticated'; v_open text;
  v_anonymous boolean := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anonymous');
BEGIN
  IF v_anonymous THEN v_roles := v_roles || ', anonymous'; END IF;
  FOR v_function IN
    SELECT p.oid::regprocedure FROM pg_proc p
      JOIN pg_depend d ON d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
      JOIN pg_extension e ON e.oid = d.refobjid
      WHERE e.extname IN ('pgcrypto', 'pg_trgm')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %s', v_function, v_roles);
  END LOOP;
  -- Only a function's owner (or a superuser) can take EXECUTE away from it;
  -- anyone else gets a warning per function and nothing changes. When a role
  -- that is not a superuser installs a trusted extension such as these, the
  -- bootstrap superuser owns its functions, so say at once which ones clients
  -- can still run. tests/grants.sql fails on them too.
  SELECT string_agg(p.oid::regprocedure::text, ', ' ORDER BY p.oid::regprocedure::text) INTO v_open
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_depend d ON d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
    WHERE n.nspname = 'public' AND (has_function_privilege('public', p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
      OR CASE WHEN v_anonymous THEN has_function_privilege('anonymous', p.oid, 'EXECUTE') ELSE false END);
  IF v_open IS NOT NULL THEN
    RAISE WARNING 'Clients can still run these extension functions in public: %', v_open
      USING HINT = 'The role running this migration does not own them, so it could not revoke EXECUTE. See 0034 in infra/neon/README.md before releasing.';
  END IF;
END;
$$;

-- Which reserve of the activity log a money correction is kept in, or NULL
-- for any other event. Voids and corrections have one reserve and receipt
-- reversals the other: anyone owed money can record and reverse a receipt as
-- often as they like, so reversals must not use up the room a void needs. The
-- index and the snapshot use the same test, so the index serves the snapshot.
CREATE FUNCTION commune_private.money_correction_reserve(p_kind text, p_description text, p_details jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT CASE
    WHEN p_description IN ('Expense voided', 'Expense corrected', 'Contribution corrected') THEN 'correction'
    WHEN p_kind = 'expenses' AND p_details ->> 'reversed' = 'true' THEN 'reversal'
  END;
$$;
REVOKE ALL ON FUNCTION commune_private.money_correction_reserve(text, text, jsonb) FROM PUBLIC;
CREATE INDEX commune_events_corrections_idx ON public.commune_events
  (commune_id, (commune_private.money_correction_reserve(kind, description, details)), created_at DESC)
  WHERE commune_private.money_correction_reserve(kind, description, details) IS NOT NULL;

DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('public.commune_snapshot(uuid)'::regprocedure);
  v_source := replace(v_original,
    'FROM (SELECT * FROM public.commune_events ev WHERE ev.commune_id=co.id ORDER BY ev.created_at DESC LIMIT 100) a',
    'FROM ((SELECT ev.id, ev.actor_id, ev.kind, ev.entity_id, ev.title, ev.description, ev.created_at
        FROM public.commune_events ev WHERE ev.commune_id=co.id ORDER BY ev.created_at DESC LIMIT 100)
      UNION (SELECT ev.id, ev.actor_id, ev.kind, ev.entity_id, ev.title, ev.description, ev.created_at
        FROM public.commune_events ev WHERE ev.commune_id=co.id
          AND commune_private.money_correction_reserve(ev.kind, ev.description, ev.details) = ''correction''
          AND ev.created_at > now() - interval ''90 days'' ORDER BY ev.created_at DESC LIMIT 50)
      UNION (SELECT ev.id, ev.actor_id, ev.kind, ev.entity_id, ev.title, ev.description, ev.created_at
        FROM public.commune_events ev WHERE ev.commune_id=co.id
          AND commune_private.money_correction_reserve(ev.kind, ev.description, ev.details) = ''reversal''
          AND ev.created_at > now() - interval ''90 days'' ORDER BY ev.created_at DESC LIMIT 50)) a');
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported snapshot activity definition'; END IF;
  EXECUTE v_source;

  v_original := pg_get_functiondef('public.record_fund_contribution_command(uuid,bigint,uuid)'::regprocedure);
  v_source := replace(v_original,
    '  SELECT coalesce(sum(amount_minor),0) INTO v_paid FROM public.fund_contributions WHERE commitment_id=p_commitment_id AND voided_at IS NULL;',
    '  -- Someone else confirms money towards an admin''s own pledge whenever the
  -- commune has another admin. A commune with one admin still works.
  IF v_row.user_id = v_actor AND EXISTS (SELECT 1 FROM public.commune_members m
      WHERE m.commune_id = v_commune AND m.active AND m.role = ''admin'' AND m.user_id <> v_actor) THEN
    RAISE EXCEPTION ''Ask another admin to confirm contributions to your own pledge'' USING ERRCODE = ''42501'';
  END IF;
  SELECT coalesce(sum(amount_minor),0) INTO v_paid FROM public.fund_contributions WHERE commitment_id=p_commitment_id AND voided_at IS NULL;');
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported contribution definition'; END IF;
  EXECUTE v_source;
END;
$$;

CREATE INDEX reminder_email_outbox_payload_idx ON public.reminder_email_outbox (created_at) WHERE payload IS NOT NULL;
CREATE INDEX invitation_email_created_idx ON public.invitation_email_deliveries (created_at);

-- Only the worker calls this, as the database owner.
CREATE FUNCTION commune_private.prune_delivery_records()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_payloads integer; v_invitations integer;
BEGIN
  UPDATE public.reminder_email_outbox SET payload = NULL, payload_amount_minor = NULL
    WHERE payload IS NOT NULL AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_payloads = ROW_COUNT;
  DELETE FROM public.invitation_email_deliveries
    WHERE created_at < now() - interval '30 days' AND status IN ('sent', 'failed', 'sending');
  GET DIAGNOSTICS v_invitations = ROW_COUNT;
  RETURN jsonb_build_object('reminderPayloads', v_payloads, 'invitationEmails', v_invitations);
END;
$$;
REVOKE ALL ON FUNCTION commune_private.prune_delivery_records() FROM PUBLIC;

NOTIFY pgrst, 'reload schema';
COMMIT;
