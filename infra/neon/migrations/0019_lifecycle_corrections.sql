-- Corrections to 0015-0018 found in review. Apply after 0018.
-- 1. Voiding no longer marks queued reminder emails in a way a sender could
--    tell apart from a recipient's own opt-out.
-- 2. A void closes repayments that can no longer be reversed (the debtor or
--    the payer has left) instead of refusing forever.
-- 3. Nudging a voided bill says so, instead of a misleading permission error.
-- 4. Monthly tasks keep their day of the month (31st stays the last day).
-- 5. The reminder allowance read reports each recipient's last reminder
--    across communes, so the one-day cooldown is explained before Send.
BEGIN;

DO $$
DECLARE v_original text; v_source text;
BEGIN
  -- (3) send_reminder: report a voided bill as its own, accurate rejection.
  v_original := pg_get_functiondef('public.send_reminder(text,uuid)'::regprocedure);
  v_source := replace(v_original, 'WHERE s.id = p_source_id AND e.voided_at IS NULL FOR UPDATE OF s;',
    'WHERE s.id = p_source_id FOR UPDATE OF s;');
  v_source := replace(v_source, 'IF NOT FOUND OR v_sender IS DISTINCT FROM v_payer OR commune_private.expense_is_voided(
        (SELECT s.expense_id FROM public.expense_shares s WHERE s.id = p_source_id)) THEN',
    'IF NOT FOUND OR v_sender IS DISTINCT FROM v_payer THEN
      RAISE EXCEPTION ''Only the bill payer can nudge this share''
        USING ERRCODE = ''42501'';
    END IF;
    -- Checked after the share lock, so a void that committed while this call
    -- waited is seen here.
    IF commune_private.expense_is_voided(
        (SELECT s.expense_id FROM public.expense_shares s WHERE s.id = p_source_id)) THEN
      RAISE EXCEPTION ''This expense was voided. There is nothing to remind about.''
        USING ERRCODE = ''P0001'';
    END IF;
    IF false THEN');
  IF v_source = v_original OR position('There is nothing to remind about' IN v_source) = 0
     OR position('AND e.voided_at IS NULL FOR UPDATE OF s' IN v_source) > 0 THEN
    RAISE EXCEPTION 'Unsupported reminder sender definition';
  END IF;
  EXECUTE v_source;

  -- (1) and (2) void_expense.
  v_original := pg_get_functiondef('public.void_expense(uuid,integer,text,uuid)'::regprocedure);
  v_source := replace(v_original,
    'UPDATE public.reminder_email_outbox q SET status = ''suppressed'', last_error = ''Expense voided'', updated_at = now()',
    'UPDATE public.reminder_email_outbox q SET status = ''suppressed'', updated_at = now()');
  -- Only repayments the payer can still reverse block a void. Others (the
  -- debtor or the payer has left) are closed by the void itself below.
  v_source := replace(v_source,
    'IF EXISTS (SELECT 1 FROM public.expense_share_receipts r JOIN public.expense_shares s ON s.id = r.share_id
    WHERE s.expense_id = p_expense_id AND r.reversed_at IS NULL) THEN
    RAISE EXCEPTION ''Repayments are recorded on this expense. Reverse them before voiding it.'' USING ERRCODE = ''P0001'';',
    'IF EXISTS (SELECT 1 FROM public.expense_share_receipts r JOIN public.expense_shares s ON s.id = r.share_id
    WHERE s.expense_id = p_expense_id AND r.reversed_at IS NULL
      AND EXISTS (SELECT 1 FROM public.commune_members m WHERE m.commune_id = v_expense.commune_id AND m.user_id = s.user_id AND m.active)
      AND EXISTS (SELECT 1 FROM public.commune_members m WHERE m.commune_id = v_expense.commune_id AND m.user_id = v_expense.paid_by_user_id AND m.active)) THEN
    RAISE EXCEPTION ''Repayments are recorded on this expense. The bill payer needs to reverse them before it can be voided.'' USING ERRCODE = ''P0001'';');
  v_source := replace(v_source,
    'PERFORM 1 FROM public.expense_shares WHERE expense_id = p_expense_id ORDER BY id FOR UPDATE;',
    'PERFORM 1 FROM public.expense_shares WHERE expense_id = p_expense_id ORDER BY id FOR UPDATE;
  -- Repayments that can no longer be reversed are closed with the void, so
  -- the record stays explained. No debt reopens: a voided bill never counts.
  UPDATE public.expense_share_receipts r SET reversed_at = now(), reversed_by = v_actor,
      reversal_reason = left(''Expense voided: '' || v_reason, 240)
    FROM public.expense_shares s
    WHERE s.id = r.share_id AND s.expense_id = p_expense_id AND r.reversed_at IS NULL;
  PERFORM commune_private.project_share_settlement(s.id) FROM public.expense_shares s
    WHERE s.expense_id = p_expense_id AND s.user_id <> v_expense.paid_by_user_id;');
  IF v_source = v_original OR position('last_error = ''Expense voided''' IN v_source) > 0
     OR position('Expense voided: ' IN v_source) = 0
     OR position('needs to reverse them before it can be voided' IN v_source) = 0 THEN
    RAISE EXCEPTION 'Unsupported void definition';
  END IF;
  EXECUTE v_source;
END;
$$;

-- (1) Rows already suppressed by a void look like any other suppression.
UPDATE public.reminder_email_outbox SET last_error = NULL
  WHERE status = 'suppressed' AND last_error = 'Expense voided';

-- (4) Monthly tasks remember the day of the month they were set for, as
-- recurring bills do (0013). The day is reset whenever someone sets the date
-- or the repeat by hand; completing, skipping and undoing leave it alone.
ALTER TABLE public.commune_operations ADD COLUMN anchor_day smallint
  CHECK (anchor_day IS NULL OR anchor_day BETWEEN 1 AND 31);
-- A backfill is not a member's change: keep it out of the activity history.
SELECT set_config('commune.occurrence_event', 'on', true);
UPDATE public.commune_operations SET anchor_day = extract(day FROM date)::smallint;
SELECT set_config('commune.occurrence_event', 'off', true);

CREATE FUNCTION commune_private.set_operation_anchor()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (coalesce(current_setting('commune.occurrence_event', true), '') <> 'on'
     AND (NEW.date IS DISTINCT FROM OLD.date OR NEW.repeat IS DISTINCT FROM OLD.repeat)) THEN
    NEW.anchor_day := extract(day FROM NEW.date)::smallint;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION commune_private.set_operation_anchor() FROM PUBLIC;
CREATE TRIGGER operation_anchor BEFORE INSERT OR UPDATE ON public.commune_operations
  FOR EACH ROW EXECUTE FUNCTION commune_private.set_operation_anchor();

DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('public.record_operation_occurrence(uuid,text,date,date,uuid)'::regprocedure);
  v_source := replace(v_original,
    'v_date := CASE WHEN v_op.repeat = ''weekly'' THEN v_date + 7 ELSE (v_date + interval ''1 month'')::date END;',
    'IF v_op.repeat = ''weekly'' THEN
          v_date := v_date + 7;
        ELSE
          -- Step month by month from the anchor day, clamped to each month''s
          -- length, so 31 January goes to 28 February and back to 31 March.
          v_date := (date_trunc(''month'', v_date) + interval ''1 month'')::date
            + (least(coalesce(v_op.anchor_day, extract(day FROM v_op.date)::int),
                extract(day FROM (date_trunc(''month'', v_date) + interval ''2 month - 1 day''))::int) - 1);
        END IF;');
  v_source := replace(v_source, '-- Next occurrence strictly after today; a month end stays a month end.',
    '-- Next occurrence strictly after today.');
  IF v_source = v_original OR position('anchor_day' IN v_source) = 0 THEN
    RAISE EXCEPTION 'Unsupported occurrence definition';
  END IF;
  EXECUTE v_source;

  -- The client previews the next date with the same rule.
  v_original := pg_get_functiondef('commune_private.snapshot_operations(uuid)'::regprocedure);
  v_source := replace(v_original, '''repeat'',o.repeat,', '''repeat'',o.repeat,''anchorDay'',o.anchor_day,');
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported operations snapshot definition'; END IF;
  EXECUTE v_source;
END;
$$;

-- (5) The one-day sender-to-recipient cooldown applies across communes, so
-- the allowance read reports the last reminder to each person across all of
-- them. Display only: send_reminder remains the authority. The return type
-- grows a column, so the function is recreated with the same grants.
DROP FUNCTION public.reminder_usage();
CREATE FUNCTION public.reminder_usage()
RETURNS TABLE (
  total_used integer,
  total_limit integer,
  recipient_limit integer,
  recipient_usage jsonb,
  next_slot_at timestamptz,
  recipient_last_sent jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_sender text := commune_private.data_api_user_id();
BEGIN
  IF v_sender IS NULL OR v_sender = '' THEN
    RAISE EXCEPTION 'Sign in to see reminder usage' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH recent AS (
    SELECT r.recipient_user_id, r.created_at
    FROM public.reminders r
    WHERE r.sender_user_id = v_sender
      AND r.created_at > now() - interval '30 days'
  ), by_recipient AS (
    SELECT recent.recipient_user_id, count(*)::integer AS used, max(recent.created_at) AS last_sent
    FROM recent GROUP BY recent.recipient_user_id
  ), ranked AS (
    SELECT recent.created_at,
      row_number() OVER (ORDER BY recent.created_at) AS position,
      count(*) OVER () AS total
    FROM recent
  )
  SELECT
    (SELECT count(*)::integer FROM recent),
    60,
    8,
    (SELECT coalesce(jsonb_object_agg(recipient_user_id, used), '{}'::jsonb)
       FROM by_recipient),
    (SELECT created_at + interval '30 days'
       FROM ranked WHERE position = total - 59),
    (SELECT coalesce(jsonb_object_agg(recipient_user_id, last_sent), '{}'::jsonb)
       FROM by_recipient WHERE last_sent > now() - interval '1 day');
END;
$$;
REVOKE ALL ON FUNCTION public.reminder_usage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reminder_usage() TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
