-- Safe expense correction and void. Every change needs a reason, checks the
-- version the editor saw, and is kept as a before/after revision. An expense
-- with recorded repayments cannot have its amount, payer or split rewritten:
-- those repayments must be reversed explicitly first (0016). A voided expense
-- stays in the ledger with its history; nothing is hard-deleted.
-- Apply after 0016. Release with the matching web client.
BEGIN;

ALTER TABLE public.expenses ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version >= 1);
ALTER TABLE public.expenses ADD COLUMN updated_at timestamptz;
ALTER TABLE public.expenses ADD COLUMN voided_at timestamptz;
ALTER TABLE public.expenses ADD COLUMN voided_by text;
ALTER TABLE public.expenses ADD COLUMN void_reason text;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_void_check CHECK (
  (voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL)
  OR (voided_at IS NOT NULL AND voided_by IS NOT NULL AND length(btrim(void_reason)) BETWEEN 3 AND 240));

CREATE TABLE public.expense_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  -- The version this change produced. Version 1 is the expense as recorded.
  version integer NOT NULL CHECK (version >= 2),
  action text NOT NULL CHECK (action IN ('corrected', 'voided')),
  actor_id text NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 240),
  before jsonb NOT NULL,
  after jsonb NOT NULL,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (expense_id, version),
  UNIQUE (actor_id, request_id)
);
ALTER TABLE public.expense_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY expense_revision_read ON public.expense_revisions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = expense_id AND public.is_commune_member(e.commune_id)));
GRANT SELECT ON public.expense_revisions TO authenticated;
-- Deliberately no write grant: revisions are written only by the RPCs below.

CREATE OR REPLACE FUNCTION commune_private.expense_is_voided(p_expense_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce((SELECT e.voided_at IS NOT NULL FROM public.expenses e WHERE e.id = p_expense_id), false);
$$;

CREATE FUNCTION commune_private.expense_state(p_expense_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object('title', e.title, 'amountMinor', e.amount_minor, 'paidByUserId', e.paid_by_user_id,
    'category', e.category, 'dueOn', e.due_on,
    'shares', coalesce((SELECT jsonb_agg(jsonb_build_object('userId', s.user_id, 'amountMinor', s.amount_minor) ORDER BY s.user_id)
      FROM public.expense_shares s WHERE s.expense_id = e.id), '[]'::jsonb))
  FROM public.expenses e WHERE e.id = p_expense_id;
$$;
REVOKE ALL ON FUNCTION commune_private.expense_state(uuid) FROM PUBLIC;

CREATE FUNCTION public.correct_expense(p_expense_id uuid, p_expected_version integer, p_title text,
  p_amount_minor bigint, p_shares jsonb, p_due_on date, p_paid_by text, p_category text,
  p_reason text, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_expense public.expenses%ROWTYPE;
  v_replay public.expense_revisions%ROWTYPE;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_title text := btrim(coalesce(p_title, ''));
  v_category text := btrim(coalesce(p_category, ''));
  v_payer text;
  v_before jsonb; v_after jsonb; v_new_shares jsonb;
  v_financial boolean; v_admin boolean; v_blocked text; v_member record;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to correct an expense' USING ERRCODE = '22023';
  END IF;
  -- Commune, then expense, then shares: the order every money write uses.
  PERFORM 1 FROM public.communes co JOIN public.expenses e ON e.commune_id = co.id
    WHERE e.id = p_expense_id FOR UPDATE OF co;
  SELECT * INTO v_expense FROM public.expenses WHERE id = p_expense_id FOR UPDATE;
  v_admin := v_expense.id IS NOT NULL AND public.is_commune_admin(v_expense.commune_id);
  IF v_expense.id IS NULL OR NOT public.is_commune_member(v_expense.commune_id)
     OR (v_actor IS DISTINCT FROM v_expense.paid_by_user_id AND NOT v_admin) THEN
    RAISE EXCEPTION 'Only the bill payer or an admin can correct this expense' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_shares) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid expense amount or split' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('userId', s.user_id, 'amountMinor', s.amount_minor) ORDER BY s.user_id), '[]'::jsonb)
    INTO v_new_shares FROM jsonb_to_recordset(p_shares) AS s(user_id text, amount_minor bigint);
  SELECT * INTO v_replay FROM public.expense_revisions WHERE actor_id = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    -- A replay must be the same decision: same expense, reason and outcome.
    IF v_replay.expense_id <> p_expense_id OR v_replay.action <> 'corrected' OR v_replay.reason <> v_reason
       OR v_replay.after IS DISTINCT FROM jsonb_build_object('title', v_title, 'amountMinor', p_amount_minor,
         'paidByUserId', coalesce(p_paid_by, v_replay.after ->> 'paidByUserId'), 'category', v_category,
         'dueOn', p_due_on, 'shares', v_new_shares) THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('version', v_replay.version, 'duplicate', true);
  END IF;
  IF v_expense.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'This expense was voided and can no longer be changed' USING ERRCODE = 'P0001';
  END IF;
  IF p_expected_version IS DISTINCT FROM v_expense.version THEN
    RAISE EXCEPTION 'This expense was changed by someone else. Review the latest version before saving your correction.' USING ERRCODE = 'P0001';
  END IF;
  IF length(v_reason) NOT BETWEEN 3 AND 240 THEN
    RAISE EXCEPTION 'Give a reason for the correction (3 to 240 characters)' USING ERRCODE = '22023';
  END IF;
  IF length(v_title) NOT BETWEEN 1 AND 80 OR length(v_category) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Invalid expense details' USING ERRCODE = '22023';
  END IF;
  v_payer := coalesce(p_paid_by, v_expense.paid_by_user_id);
  v_before := commune_private.expense_state(p_expense_id);
  v_financial := p_amount_minor IS DISTINCT FROM v_expense.amount_minor
    OR v_payer <> v_expense.paid_by_user_id OR v_new_shares <> (v_before -> 'shares');
  IF NOT v_financial AND v_title = v_expense.title AND v_category = v_expense.category
     AND p_due_on IS NOT DISTINCT FROM v_expense.due_on THEN
    RAISE EXCEPTION 'Nothing has changed, so there is nothing to correct' USING ERRCODE = '22023';
  END IF;

  IF v_financial THEN
    IF v_payer <> v_expense.paid_by_user_id AND NOT v_admin THEN
      RAISE EXCEPTION 'Only an admin can change who paid' USING ERRCODE = '42501';
    END IF;
    -- Never move or silently absorb recorded money.
    IF EXISTS (SELECT 1 FROM public.expense_share_receipts r JOIN public.expense_shares s ON s.id = r.share_id
      WHERE s.expense_id = p_expense_id AND r.reversed_at IS NULL) THEN
      RAISE EXCEPTION 'Repayments are recorded on this expense. Reverse them before changing the amount, payer or split.' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.commune_members WHERE commune_id = v_expense.commune_id AND user_id = v_payer AND active) THEN
      RAISE EXCEPTION 'Invalid payer or expense details' USING ERRCODE = '22023';
    END IF;
    PERFORM commune_private.validate_expense_split(v_expense.commune_id, p_amount_minor, p_shares);
    -- A reversed repayment is still history that belongs to that person.
    SELECT coalesce(u.name, 'A former member') INTO v_blocked FROM public.expense_shares s
      LEFT JOIN neon_auth."user" u ON u.id::text = s.user_id
      WHERE s.expense_id = p_expense_id
        AND EXISTS (SELECT 1 FROM public.expense_share_receipts r WHERE r.share_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(p_shares) AS n(user_id text, amount_minor bigint) WHERE n.user_id = s.user_id)
      LIMIT 1;
    IF v_blocked IS NOT NULL THEN
      RAISE EXCEPTION '% has repayment history on this expense and must stay in the split. Void the expense and record it again instead.', v_blocked USING ERRCODE = 'P0001';
    END IF;
    DELETE FROM public.expense_shares s WHERE s.expense_id = p_expense_id
      AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(p_shares) AS n(user_id text, amount_minor bigint) WHERE n.user_id = s.user_id);
    -- With no active repayments, only the payer's own share is settled.
    INSERT INTO public.expense_shares (expense_id, user_id, amount_minor, settled_minor, settled_at)
      SELECT p_expense_id, n.user_id, n.amount_minor,
        CASE WHEN n.user_id = v_payer THEN n.amount_minor ELSE 0 END,
        CASE WHEN n.user_id = v_payer THEN now() ELSE NULL END
      FROM jsonb_to_recordset(p_shares) AS n(user_id text, amount_minor bigint)
    ON CONFLICT (expense_id, user_id) DO UPDATE SET amount_minor = excluded.amount_minor,
      settled_minor = excluded.settled_minor, settled_at = excluded.settled_at;
  END IF;

  UPDATE public.expenses SET title = v_title, category = v_category, due_on = p_due_on,
      amount_minor = CASE WHEN v_financial THEN p_amount_minor ELSE amount_minor END,
      paid_by_user_id = v_payer, version = version + 1, updated_at = now()
    WHERE id = p_expense_id;
  v_after := commune_private.expense_state(p_expense_id);
  INSERT INTO public.expense_revisions (expense_id, version, action, actor_id, reason, before, after, request_id)
    VALUES (p_expense_id, v_expense.version + 1, 'corrected', v_actor, v_reason, v_before, v_after, p_request_id);
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description, details)
    VALUES (v_expense.commune_id, v_actor, 'expenses', p_expense_id, v_title, 'Expense corrected',
      jsonb_build_object('version', v_expense.version + 1, 'reason', v_reason, 'before', v_before, 'after', v_after));

  IF v_financial THEN
    -- Tell everyone whose own figure moved: a changed, added or removed share,
    -- or a change of who they owe.
    FOR v_member IN
      SELECT coalesce(b.user_id, a.user_id) AS user_id, a.amount_minor
      FROM (SELECT x->>'userId' AS user_id, (x->>'amountMinor')::bigint AS amount_minor FROM jsonb_array_elements(v_before->'shares') x) b
      FULL JOIN (SELECT x->>'userId' AS user_id, (x->>'amountMinor')::bigint AS amount_minor FROM jsonb_array_elements(v_after->'shares') x) a
        ON a.user_id = b.user_id
      WHERE a.amount_minor IS DISTINCT FROM b.amount_minor OR v_payer <> v_expense.paid_by_user_id
      UNION
      SELECT p.user_id, NULL::bigint FROM (VALUES (v_payer), (v_expense.paid_by_user_id)) AS p(user_id)
        WHERE v_payer <> v_expense.paid_by_user_id
          AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_after->'shares') x WHERE x->>'userId' = p.user_id)
          AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_before->'shares') x WHERE x->>'userId' = p.user_id)
    LOOP
      PERFORM commune_private.notify_ledger(v_expense.commune_id, v_member.user_id, 'expense_corrected',
        p_expense_id, v_actor, v_member.amount_minor, v_reason);
    END LOOP;
  END IF;
  RETURN jsonb_build_object('version', v_expense.version + 1, 'duplicate', false);
END;
$$;

CREATE FUNCTION public.void_expense(p_expense_id uuid, p_expected_version integer, p_reason text, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_expense public.expenses%ROWTYPE;
  v_replay public.expense_revisions%ROWTYPE;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_before jsonb; v_member record;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to void an expense' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.communes co JOIN public.expenses e ON e.commune_id = co.id
    WHERE e.id = p_expense_id FOR UPDATE OF co;
  SELECT * INTO v_expense FROM public.expenses WHERE id = p_expense_id FOR UPDATE;
  IF v_expense.id IS NULL OR NOT public.is_commune_member(v_expense.commune_id)
     OR (v_actor IS DISTINCT FROM v_expense.paid_by_user_id AND NOT public.is_commune_admin(v_expense.commune_id)) THEN
    RAISE EXCEPTION 'Only the bill payer or an admin can void this expense' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_replay FROM public.expense_revisions WHERE actor_id = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_replay.expense_id <> p_expense_id OR v_replay.action <> 'voided' OR v_replay.reason <> v_reason THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('version', v_replay.version, 'duplicate', true);
  END IF;
  IF v_expense.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'This expense was already voided' USING ERRCODE = 'P0001';
  END IF;
  IF p_expected_version IS DISTINCT FROM v_expense.version THEN
    RAISE EXCEPTION 'This expense was changed by someone else. Review the latest version before voiding it.' USING ERRCODE = 'P0001';
  END IF;
  IF length(v_reason) NOT BETWEEN 3 AND 240 THEN
    RAISE EXCEPTION 'Give a reason for voiding this expense (3 to 240 characters)' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.expense_share_receipts r JOIN public.expense_shares s ON s.id = r.share_id
    WHERE s.expense_id = p_expense_id AND r.reversed_at IS NULL) THEN
    RAISE EXCEPTION 'Repayments are recorded on this expense. Reverse them before voiding it.' USING ERRCODE = 'P0001';
  END IF;
  -- send_reminder holds a share's row lock while it works. Taking the same
  -- locks here means a reminder either finished before this void (and its
  -- queued email is suppressed below) or waits and then sees the void.
  PERFORM 1 FROM public.expense_shares WHERE expense_id = p_expense_id ORDER BY id FOR UPDATE;
  v_before := commune_private.expense_state(p_expense_id);
  UPDATE public.expenses SET voided_at = now(), voided_by = v_actor, void_reason = v_reason,
      version = version + 1, updated_at = now() WHERE id = p_expense_id;
  INSERT INTO public.expense_revisions (expense_id, version, action, actor_id, reason, before, after, request_id)
    VALUES (p_expense_id, v_expense.version + 1, 'voided', v_actor, v_reason, v_before,
      v_before || jsonb_build_object('voided', true), p_request_id);
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description, details)
    VALUES (v_expense.commune_id, v_actor, 'expenses', p_expense_id, v_expense.title, 'Expense voided',
      jsonb_build_object('version', v_expense.version + 1, 'reason', v_reason, 'before', v_before));
  -- A queued reminder email about a voided bill must not go out later.
  UPDATE public.reminder_email_outbox q SET status = 'suppressed', last_error = 'Expense voided', updated_at = now()
    FROM public.reminders r JOIN public.expense_shares s ON s.id = r.source_id
    WHERE q.reminder_id = r.id AND r.kind = 'nudge' AND s.expense_id = p_expense_id AND q.status IN ('pending', 'failed');
  FOR v_member IN
    SELECT s.user_id, s.amount_minor FROM public.expense_shares s WHERE s.expense_id = p_expense_id
    UNION SELECT v_expense.paid_by_user_id, NULL::bigint
      WHERE NOT EXISTS (SELECT 1 FROM public.expense_shares s WHERE s.expense_id = p_expense_id AND s.user_id = v_expense.paid_by_user_id)
  LOOP
    PERFORM commune_private.notify_ledger(v_expense.commune_id, v_member.user_id, 'expense_voided',
      p_expense_id, v_actor, v_member.amount_minor, v_reason);
  END LOOP;
  RETURN jsonb_build_object('version', v_expense.version + 1, 'duplicate', false);
END;
$$;

-- A voided expense is never due, remindable, or a reason a member cannot
-- leave. Extend the audited functions in place and fail if they have drifted.
DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('public.list_reminder_targets(uuid)'::regprocedure);
  v_source := replace(v_original, 'AND m.active AND s.settled_minor < s.amount_minor',
    'AND e.voided_at IS NULL AND m.active AND s.settled_minor < s.amount_minor');
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported reminder target definition'; END IF;
  EXECUTE v_source;

  v_original := pg_get_functiondef('public.send_reminder(text,uuid)'::regprocedure);
  v_source := replace(v_original, 'WHERE s.id = p_source_id FOR UPDATE OF s',
    'WHERE s.id = p_source_id AND e.voided_at IS NULL FOR UPDATE OF s');
  -- The line above reads the expense from the statement's snapshot. Check
  -- again after the share lock is held: a void that committed while this call
  -- was waiting for that lock is visible to this new statement.
  v_source := replace(v_source, 'IF NOT FOUND OR v_sender IS DISTINCT FROM v_payer THEN',
    'IF NOT FOUND OR v_sender IS DISTINCT FROM v_payer OR commune_private.expense_is_voided(
        (SELECT s.expense_id FROM public.expense_shares s WHERE s.id = p_source_id)) THEN');
  IF v_source = v_original OR position('expense_is_voided' IN v_source) = 0
     OR position('AND e.voided_at IS NULL FOR UPDATE OF s' IN v_source) = 0 THEN
    RAISE EXCEPTION 'Unsupported reminder sender definition';
  END IF;
  EXECUTE v_source;

  v_original := pg_get_functiondef('public.manage_commune_member(uuid,text,text)'::regprocedure);
  v_source := replace(v_original, 'WHERE e.commune_id=p_commune_id AND s.settled_minor<s.amount_minor',
    'WHERE e.commune_id=p_commune_id AND e.voided_at IS NULL AND s.settled_minor<s.amount_minor');
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported membership definition'; END IF;
  EXECUTE v_source;

  v_original := pg_get_functiondef('public.search_commune_records(text,uuid,integer)'::regprocedure);
  v_source := replace(v_original, 'CASE WHEN EXISTS(SELECT 1 FROM public.expense_shares s WHERE s.expense_id=e.id AND s.settled_minor<s.amount_minor)',
    'CASE WHEN e.voided_at IS NOT NULL THEN ''Voided'' WHEN EXISTS(SELECT 1 FROM public.expense_shares s WHERE s.expense_id=e.id AND s.settled_minor<s.amount_minor)');
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported search definition'; END IF;
  EXECUTE v_source;
END;
$$;

CREATE OR REPLACE FUNCTION commune_private.snapshot_expenses(p_commune_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'category',e.category,'amountMinor',e.amount_minor,'paidByUserId',e.paid_by_user_id,'recordedBy',e.recorded_by,'dueOn',e.due_on,'createdAt',e.created_at,
      'version',e.version,'updatedAt',e.updated_at,'voidedAt',e.voided_at,'voidedBy',e.voided_by,'voidReason',e.void_reason,
      'recurring',EXISTS(SELECT 1 FROM public.recurring_bill_occurrences o WHERE o.expense_id=e.id),
      'revisions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id,'version',v.version,'action',v.action,'actorId',v.actor_id,'reason',v.reason,'before',v.before,'after',v.after,'createdAt',v.created_at) ORDER BY v.version DESC)
        FROM (SELECT * FROM public.expense_revisions rv WHERE rv.expense_id=e.id ORDER BY rv.version DESC LIMIT 20) v),'[]'::jsonb),
      'shares',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'userId',s.user_id,'amountMinor',s.amount_minor,'settledMinor',s.settled_minor,'settledAt',s.settled_at,
        'receipts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'amountMinor',r.amount_minor,'receivedOn',r.received_on,'reference',r.reference,'recordedBy',r.recorded_by,'recordedAt',r.recorded_at,'origin',r.origin,
          'reversedAt',r.reversed_at,'reversedBy',r.reversed_by,'reversalReason',r.reversal_reason) ORDER BY r.recorded_at DESC, r.id) FROM public.expense_share_receipts r WHERE r.share_id=s.id),'[]'::jsonb)) ORDER BY s.user_id) FROM public.expense_shares s WHERE s.expense_id=e.id),'[]'::jsonb)) ORDER BY e.created_at DESC),'[]'::jsonb)
    FROM public.expenses e WHERE e.commune_id=p_commune_id;
$$;

REVOKE ALL ON FUNCTION public.correct_expense(uuid, integer, text, bigint, jsonb, date, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.correct_expense(uuid, integer, text, bigint, jsonb, date, text, text, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.void_expense(uuid, integer, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_expense(uuid, integer, text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
