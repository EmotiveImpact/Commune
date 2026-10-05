-- Recurring bill periods. Each period is now a record: recorded (with the
-- amount actually paid, which may differ from the usual amount) or skipped
-- (with a reason). A retry of the same period is recognised instead of
-- failing, and the snapshot carries each bill's recent periods.
-- A different amount scales the saved split proportionally, deterministically
-- (largest remainder, ties by saved order); the client previews the same rule.
-- Apply after 0021. Release with the matching web client.
BEGIN;

ALTER TABLE public.recurring_bill_occurrences
  ALTER COLUMN expense_id DROP NOT NULL,
  ADD COLUMN status text NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'skipped')),
  ADD COLUMN amount_minor bigint CHECK (amount_minor IS NULL OR amount_minor > 0),
  ADD COLUMN actor_id text,
  ADD COLUMN acted_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN note text CHECK (note IS NULL OR length(note) BETWEEN 3 AND 240),
  ADD CONSTRAINT recurring_occurrence_shape CHECK (
    (status = 'recorded' AND expense_id IS NOT NULL)
    OR (status = 'skipped' AND expense_id IS NULL AND note IS NOT NULL));

-- Earlier periods: the amount, time and recorder come from their expense.
UPDATE public.recurring_bill_occurrences o SET amount_minor = e.amount_minor, acted_at = e.created_at,
    actor_id = e.recorded_by
  FROM public.expenses e WHERE e.id = o.expense_id;

-- Recording or skipping a period writes its own history line; the generic
-- "Updated" line for the schedule row would only repeat it vaguely.
DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('commune_private.record_commune_change()'::regprocedure);
  v_source := replace(v_original,
    'IF TG_TABLE_NAME=''commune_operations'' AND current_setting(''commune.occurrence_event'', true)=''on'' THEN RETURN NEW; END IF;',
    'IF TG_TABLE_NAME IN (''commune_operations'',''recurring_bills'') AND current_setting(''commune.occurrence_event'', true)=''on'' THEN RETURN NEW; END IF;');
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported change history definition'; END IF;
  EXECUTE v_source;
END;
$$;

-- The saved split scaled to a different total. Shares that round to nothing
-- are left out; the payer's own share is scaled like any other.
CREATE FUNCTION commune_private.scale_recurring_shares(p_shares jsonb, p_amount_minor bigint)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  WITH s AS (
    SELECT e.ord, e.value->>'user_id' AS user_id, (e.value->>'amount_minor')::numeric AS amt
    FROM jsonb_array_elements(p_shares) WITH ORDINALITY e(value, ord)
  ), t AS (SELECT sum(amt) AS total FROM s),
  f AS (
    SELECT s.ord, s.user_id, floor(p_amount_minor::numeric * s.amt / t.total) AS base,
      mod(p_amount_minor::numeric * s.amt, t.total) AS rem
    FROM s, t
  ), spare AS (SELECT p_amount_minor - sum(base) AS n FROM f),
  ranked AS (SELECT f.*, row_number() OVER (ORDER BY rem DESC, ord) AS rk FROM f)
  SELECT jsonb_agg(jsonb_build_object('user_id', user_id, 'amount_minor', amount) ORDER BY ord)
  FROM (SELECT ranked.ord, ranked.user_id, (base + CASE WHEN rk <= spare.n THEN 1 ELSE 0 END)::bigint AS amount
        FROM ranked, spare) scaled
  WHERE amount > 0;
$$;
REVOKE ALL ON FUNCTION commune_private.scale_recurring_shares(jsonb, bigint) FROM PUBLIC;

-- The period after this one, keeping a monthly bill on its day of the month.
CREATE FUNCTION commune_private.recurring_next_due(p_frequency text, p_due date, p_anchor_day integer)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT CASE WHEN p_frequency = 'weekly' THEN p_due + 7
    ELSE (date_trunc('month', p_due) + interval '1 month')::date
      + (least(p_anchor_day, extract(day FROM (date_trunc('month', p_due) + interval '2 month - 1 day'))::integer) - 1) END;
$$;
REVOKE ALL ON FUNCTION commune_private.recurring_next_due(text, date, integer) FROM PUBLIC;

CREATE FUNCTION commune_private.recurring_period_result(p_bill_id uuid, p_due date, p_duplicate boolean)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object('status', o.status, 'expenseId', o.expense_id, 'amountMinor', o.amount_minor,
    'dueOn', o.due_on, 'nextDueOn', b.next_due_on, 'duplicate', p_duplicate)
  FROM public.recurring_bill_occurrences o JOIN public.recurring_bills b ON b.id = o.bill_id
  WHERE o.bill_id = p_bill_id AND o.due_on = p_due;
$$;
REVOKE ALL ON FUNCTION commune_private.recurring_period_result(uuid, date, boolean) FROM PUBLIC;

-- Record the period as paid, at the usual amount or the amount actually paid.
CREATE FUNCTION public.record_recurring_period(p_id uuid, p_expected_due_on date, p_amount_minor bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_bill public.recurring_bills%ROWTYPE;
  v_done public.recurring_bill_occurrences%ROWTYPE;
  v_amount bigint; v_shares jsonb; v_id uuid; v_currency text;
BEGIN
  PERFORM 1 FROM public.communes co JOIN public.recurring_bills b ON b.commune_id = co.id WHERE b.id = p_id FOR UPDATE OF co;
  SELECT * INTO v_bill FROM public.recurring_bills WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_commune_member(v_bill.commune_id) OR
     (v_bill.paid_by_user_id <> v_actor AND NOT public.is_commune_admin(v_bill.commune_id)) THEN
    RAISE EXCEPTION 'Only the payer or an admin can record this bill' USING ERRCODE = '42501';
  END IF;
  v_amount := coalesce(p_amount_minor, v_bill.amount_minor);
  -- The same period sent again: report what was recorded, never twice.
  SELECT * INTO v_done FROM public.recurring_bill_occurrences WHERE bill_id = p_id AND due_on = p_expected_due_on;
  IF FOUND THEN
    IF v_done.status = 'recorded' AND v_done.amount_minor IS NOT DISTINCT FROM v_amount THEN
      RETURN commune_private.recurring_period_result(p_id, p_expected_due_on, true);
    END IF;
    RAISE EXCEPTION 'This period was already %. Refresh the schedule.',
      CASE v_done.status WHEN 'skipped' THEN 'skipped' ELSE 'recorded with a different amount' END USING ERRCODE = 'P0001';
  END IF;
  IF v_bill.next_due_on IS DISTINCT FROM p_expected_due_on OR v_bill.paused OR v_bill.next_due_on > current_date + 1 THEN
    RAISE EXCEPTION 'This bill is not due, is paused, or has already been recorded. Refresh the schedule.' USING ERRCODE = 'P0001';
  END IF;
  IF v_amount NOT BETWEEN 1 AND 1000000000000 THEN
    RAISE EXCEPTION 'Enter the amount paid, greater than zero' USING ERRCODE = '22023';
  END IF;
  v_shares := CASE WHEN v_amount = v_bill.amount_minor THEN v_bill.shares
    ELSE commune_private.scale_recurring_shares(v_bill.shares, v_amount) END;
  v_id := public.create_expense_for(v_bill.commune_id, v_bill.title, v_amount, v_shares, v_bill.next_due_on, v_bill.paid_by_user_id, 'Bills');
  INSERT INTO public.recurring_bill_occurrences (bill_id, due_on, expense_id, status, amount_minor, actor_id, acted_at)
    VALUES (p_id, v_bill.next_due_on, v_id, 'recorded', v_amount, v_actor, clock_timestamp());
  PERFORM set_config('commune.occurrence_event', 'on', true);
  UPDATE public.recurring_bills SET next_due_on = commune_private.recurring_next_due(frequency, next_due_on, anchor_day), updated_at = now()
    WHERE id = p_id;
  PERFORM set_config('commune.occurrence_event', 'off', true);
  SELECT currency INTO v_currency FROM public.communes WHERE id = v_bill.commune_id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_bill.commune_id, v_actor, 'recurring', p_id, v_bill.title,
      'Recorded for ' || to_char(v_bill.next_due_on, 'FMDD Mon') || ' · ' || commune_private.format_money(v_amount, v_currency)
      || CASE WHEN v_amount <> v_bill.amount_minor THEN ' (usually ' || commune_private.format_money(v_bill.amount_minor, v_currency) || ')' ELSE '' END);
  RETURN commune_private.recurring_period_result(p_id, p_expected_due_on, false);
END;
$$;

-- Skip one period with a reason: nothing is charged to anyone for it. A
-- period can be skipped ahead of time (for example, a month away).
CREATE FUNCTION public.skip_recurring_period(p_id uuid, p_expected_due_on date, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_bill public.recurring_bills%ROWTYPE;
  v_done public.recurring_bill_occurrences%ROWTYPE;
  v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
  PERFORM 1 FROM public.communes co JOIN public.recurring_bills b ON b.commune_id = co.id WHERE b.id = p_id FOR UPDATE OF co;
  SELECT * INTO v_bill FROM public.recurring_bills WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_commune_member(v_bill.commune_id) OR
     (v_bill.paid_by_user_id <> v_actor AND NOT public.is_commune_admin(v_bill.commune_id)) THEN
    RAISE EXCEPTION 'Only the payer or an admin can skip this bill' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_done FROM public.recurring_bill_occurrences WHERE bill_id = p_id AND due_on = p_expected_due_on;
  IF FOUND THEN
    IF v_done.status = 'skipped' THEN
      RETURN commune_private.recurring_period_result(p_id, p_expected_due_on, true);
    END IF;
    RAISE EXCEPTION 'This period was already recorded. Void its expense instead if it was a mistake.' USING ERRCODE = 'P0001';
  END IF;
  IF v_bill.next_due_on IS DISTINCT FROM p_expected_due_on OR v_bill.paused THEN
    RAISE EXCEPTION 'This period has moved on or the bill is paused. Refresh the schedule.' USING ERRCODE = 'P0001';
  END IF;
  IF length(v_reason) NOT BETWEEN 3 AND 240 THEN
    RAISE EXCEPTION 'Say why this period is skipped (3 to 240 characters)' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.recurring_bill_occurrences (bill_id, due_on, expense_id, status, actor_id, acted_at, note)
    VALUES (p_id, v_bill.next_due_on, NULL, 'skipped', v_actor, clock_timestamp(), v_reason);
  PERFORM set_config('commune.occurrence_event', 'on', true);
  UPDATE public.recurring_bills SET next_due_on = commune_private.recurring_next_due(frequency, next_due_on, anchor_day), updated_at = now()
    WHERE id = p_id;
  PERFORM set_config('commune.occurrence_event', 'off', true);
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_bill.commune_id, v_actor, 'recurring', p_id, v_bill.title,
      left('Skipped ' || to_char(v_bill.next_due_on, 'FMDD Mon') || ': ' || v_reason, 240));
  RETURN commune_private.recurring_period_result(p_id, p_expected_due_on, false);
END;
$$;

-- The original command keeps working for older clients, through the new one.
CREATE OR REPLACE FUNCTION public.record_recurring_bill(p_id uuid, p_expected_due_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
  -- This command never had a retry contract: a second call for the same
  -- period (even one that waited on the lock) is refused, as before.
  v_result := public.record_recurring_period(p_id, p_expected_due_on, NULL);
  IF (v_result->>'duplicate')::boolean THEN
    RAISE EXCEPTION 'This bill is not due, is paused, or has already been recorded. Refresh the schedule.' USING ERRCODE = 'P0001';
  END IF;
  RETURN (v_result->>'expenseId')::uuid;
END;
$$;

-- Each bill carries its latest periods, newest first.
DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('public.commune_snapshot(uuid)'::regprocedure);
  v_source := replace(v_original,
    '''paused'',b.paused,''createdBy'',b.created_by)',
    '''paused'',b.paused,''createdBy'',b.created_by,
      ''history'',coalesce((SELECT jsonb_agg(jsonb_build_object(''dueOn'',h.due_on,''status'',h.status,''amountMinor'',h.amount_minor,''expenseId'',h.expense_id,
        ''actorId'',h.actor_id,''actedAt'',h.acted_at,''note'',h.note) ORDER BY h.due_on DESC)
        FROM (SELECT * FROM public.recurring_bill_occurrences x WHERE x.bill_id=b.id ORDER BY x.due_on DESC LIMIT 12) h),''[]''::jsonb))');
  IF v_source = v_original OR position('''history'',coalesce((SELECT jsonb_agg(jsonb_build_object(''dueOn'',h.due_on' IN v_source) = 0 THEN
    RAISE EXCEPTION 'Unsupported snapshot definition';
  END IF;
  EXECUTE v_source;
END;
$$;

REVOKE ALL ON FUNCTION public.record_recurring_period(uuid, date, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_recurring_period(uuid, date, bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.skip_recurring_period(uuid, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.skip_recurring_period(uuid, date, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
