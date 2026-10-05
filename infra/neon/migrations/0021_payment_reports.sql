-- "I've sent it": the member who owes a share can report a payment they made
-- outside Commune. A report is a claim, never a receipt: balances do not move
-- until the bill payer confirms it (which records an ordinary receipt) or
-- records the money themselves. The payer can also decline with a reason, and
-- the reporter can withdraw a report while it is pending.
-- Apply after 0020. Release with the matching web client.
BEGIN;

CREATE TABLE public.expense_share_payment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.expense_shares(id) ON DELETE CASCADE,
  reported_by text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  sent_on date NOT NULL,
  reference text CHECK (reference IS NULL OR length(reference) BETWEEN 1 AND 80),
  reported_at timestamptz NOT NULL DEFAULT now(),
  request_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'declined', 'withdrawn', 'closed')),
  resolved_at timestamptz,
  resolved_by text,
  -- Why it was declined, or why it closed on its own (settled or voided).
  resolution_note text CHECK (resolution_note IS NULL OR length(resolution_note) BETWEEN 3 AND 240),
  receipt_id uuid REFERENCES public.expense_share_receipts(id),
  CHECK ((status = 'pending') = (resolved_at IS NULL)),
  CHECK (status <> 'confirmed' OR receipt_id IS NOT NULL),
  CHECK (status <> 'declined' OR resolution_note IS NOT NULL),
  UNIQUE (reported_by, request_id)
);
-- One open claim per share at a time keeps the payer's decision simple.
CREATE UNIQUE INDEX expense_share_payment_reports_pending_idx
  ON public.expense_share_payment_reports (share_id) WHERE status = 'pending';
CREATE INDEX expense_share_payment_reports_share_idx
  ON public.expense_share_payment_reports (share_id, reported_at DESC);
ALTER TABLE public.expense_share_payment_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_report_read ON public.expense_share_payment_reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.expense_shares s JOIN public.expenses e ON e.id = s.expense_id
    WHERE s.id = share_id AND public.is_commune_member(e.commune_id)));
GRANT SELECT ON public.expense_share_payment_reports TO authenticated;
-- Deliberately no write grant: reports change only via the RPCs below.

ALTER TABLE public.notifications DROP CONSTRAINT notifications_source_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_source_check CHECK (
  (reminder_id IS NOT NULL AND notice_kind IS NULL)
  OR (reminder_id IS NULL AND expense_id IS NOT NULL AND actor_user_id IS NOT NULL
    AND notice_kind IN ('receipt_reversed', 'expense_corrected', 'expense_voided',
      'payment_reported', 'payment_confirmed', 'payment_declined')));

CREATE FUNCTION commune_private.payment_report_result(p_id uuid, p_duplicate boolean)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object('id', r.id, 'duplicate', p_duplicate, 'status', r.status, 'receiptId', r.receipt_id,
    'settledMinor', s.settled_minor, 'outstandingMinor', s.amount_minor - s.settled_minor)
  FROM public.expense_share_payment_reports r JOIN public.expense_shares s ON s.id = r.share_id WHERE r.id = p_id;
$$;
REVOKE ALL ON FUNCTION commune_private.payment_report_result(uuid, boolean) FROM PUBLIC;

-- The member who owes the share says they have paid.
CREATE FUNCTION public.report_share_payment(p_share_id uuid, p_amount_minor bigint,
  p_sent_on date, p_reference text, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_share public.expense_shares%ROWTYPE;
  v_expense public.expenses%ROWTYPE;
  v_existing public.expense_share_payment_reports%ROWTYPE;
  v_reference text := nullif(btrim(coalesce(p_reference, '')), '');
  v_currency text; v_id uuid; v_pending public.expense_share_payment_reports%ROWTYPE;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to report a payment' USING ERRCODE = '22023';
  END IF;
  -- Commune, then share: the order every money write uses.
  PERFORM 1 FROM public.communes co JOIN public.expenses e ON e.commune_id = co.id
    JOIN public.expense_shares s ON s.expense_id = e.id WHERE s.id = p_share_id FOR UPDATE OF co;
  SELECT * INTO v_share FROM public.expense_shares WHERE id = p_share_id FOR UPDATE;
  IF FOUND THEN SELECT * INTO v_expense FROM public.expenses WHERE id = v_share.expense_id; END IF;
  IF v_expense.id IS NULL OR NOT public.is_commune_member(v_expense.commune_id)
     OR v_actor IS DISTINCT FROM v_share.user_id THEN
    RAISE EXCEPTION 'Only the member who owes this share can report paying it' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_existing FROM public.expense_share_payment_reports
    WHERE reported_by = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.share_id <> p_share_id OR v_existing.amount_minor IS DISTINCT FROM p_amount_minor
       OR v_existing.sent_on IS DISTINCT FROM p_sent_on OR v_existing.reference IS DISTINCT FROM v_reference THEN
      RAISE EXCEPTION 'This request was already used for a different report' USING ERRCODE = '22023';
    END IF;
    RETURN commune_private.payment_report_result(v_existing.id, true);
  END IF;
  IF v_share.user_id = v_expense.paid_by_user_id THEN
    RAISE EXCEPTION 'The payer''s own share is not a repayment' USING ERRCODE = '22023';
  END IF;
  IF commune_private.expense_is_voided(v_expense.id) THEN
    RAISE EXCEPTION 'This expense was voided. There is nothing to pay.' USING ERRCODE = 'P0001';
  END IF;
  SELECT currency INTO v_currency FROM public.communes WHERE id = v_expense.commune_id;
  IF v_share.amount_minor - v_share.settled_minor <= 0 THEN
    RAISE EXCEPTION 'This share is already settled' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_pending FROM public.expense_share_payment_reports WHERE share_id = p_share_id AND status = 'pending';
  IF FOUND THEN
    RAISE EXCEPTION 'You already reported % for this share. Withdraw it first to report a different payment.',
      commune_private.format_money(v_pending.amount_minor, v_currency) USING ERRCODE = 'P0001';
  END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'Enter the amount you sent, greater than zero' USING ERRCODE = '22023';
  END IF;
  IF p_amount_minor > v_share.amount_minor - v_share.settled_minor THEN
    RAISE EXCEPTION 'Only % is still outstanding on this share',
      commune_private.format_money(v_share.amount_minor - v_share.settled_minor, v_currency) USING ERRCODE = 'P0001';
  END IF;
  IF p_sent_on IS NULL OR p_sent_on > current_date + 1 OR p_sent_on < DATE '2000-01-01' THEN
    RAISE EXCEPTION 'Enter the date you sent the money, not a future date' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(v_reference, '')) > 80 THEN
    RAISE EXCEPTION 'Keep the reference to 80 characters' USING ERRCODE = '22023';
  END IF;
  IF regexp_replace(coalesce(v_reference, ''), '\s', '', 'g') ~ '[0-9]{8,}' THEN
    RAISE EXCEPTION 'Leave out card or account numbers. A short note such as "bank transfer" is enough.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.expense_share_payment_reports (share_id, reported_by, amount_minor, sent_on, reference, request_id)
    VALUES (p_share_id, v_actor, p_amount_minor, p_sent_on, v_reference, p_request_id) RETURNING id INTO v_id;
  PERFORM commune_private.notify_ledger(v_expense.commune_id, v_expense.paid_by_user_id, 'payment_reported',
    v_expense.id, v_actor, p_amount_minor, v_reference);
  RETURN commune_private.payment_report_result(v_id, false);
END;
$$;

-- The reporter takes a pending report back (for example, it was a mistake).
CREATE FUNCTION public.withdraw_share_payment_report(p_report_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_report public.expense_share_payment_reports%ROWTYPE;
  v_commune uuid;
BEGIN
  SELECT e.commune_id INTO v_commune FROM public.expense_share_payment_reports r
    JOIN public.expense_shares s ON s.id = r.share_id JOIN public.expenses e ON e.id = s.expense_id WHERE r.id = p_report_id;
  PERFORM 1 FROM public.communes WHERE id = v_commune FOR UPDATE;
  SELECT * INTO v_report FROM public.expense_share_payment_reports WHERE id = p_report_id FOR UPDATE;
  IF v_report.id IS NULL OR NOT public.is_commune_member(v_commune) OR v_actor IS DISTINCT FROM v_report.reported_by THEN
    RAISE EXCEPTION 'Only the member who reported this payment can withdraw it' USING ERRCODE = '42501';
  END IF;
  IF v_report.status = 'withdrawn' THEN
    RETURN commune_private.payment_report_result(v_report.id, true);
  END IF;
  IF v_report.status <> 'pending' THEN
    RAISE EXCEPTION 'The bill payer has already answered this report' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.expense_share_payment_reports SET status = 'withdrawn', resolved_at = now(), resolved_by = v_actor
    WHERE id = p_report_id;
  RETURN commune_private.payment_report_result(v_report.id, false);
END;
$$;

-- The bill payer answers a report. Confirming records an ordinary receipt for
-- exactly what was reported; declining keeps the report with the reason.
CREATE FUNCTION public.resolve_share_payment_report(p_report_id uuid, p_decision text, p_note text, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_report public.expense_share_payment_reports%ROWTYPE;
  v_share public.expense_shares%ROWTYPE;
  v_expense public.expenses%ROWTYPE;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_receipt jsonb;
BEGIN
  IF p_decision IS NULL OR p_decision NOT IN ('confirm', 'decline') THEN
    RAISE EXCEPTION 'Choose to confirm or decline the report' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.communes co JOIN public.expenses e ON e.commune_id = co.id
    JOIN public.expense_shares s ON s.expense_id = e.id
    JOIN public.expense_share_payment_reports r ON r.share_id = s.id WHERE r.id = p_report_id FOR UPDATE OF co;
  SELECT s.* INTO v_share FROM public.expense_shares s
    JOIN public.expense_share_payment_reports r ON r.share_id = s.id WHERE r.id = p_report_id FOR UPDATE OF s;
  SELECT * INTO v_report FROM public.expense_share_payment_reports WHERE id = p_report_id FOR UPDATE;
  IF v_share.id IS NOT NULL THEN SELECT * INTO v_expense FROM public.expenses WHERE id = v_share.expense_id; END IF;
  IF v_report.id IS NULL OR v_expense.id IS NULL OR NOT public.is_commune_member(v_expense.commune_id)
     OR v_actor IS DISTINCT FROM v_expense.paid_by_user_id THEN
    RAISE EXCEPTION 'Only the bill payer can answer a payment report' USING ERRCODE = '42501';
  END IF;
  -- The same answer sent again reports the standing result.
  IF (p_decision = 'confirm' AND v_report.status = 'confirmed') OR (p_decision = 'decline' AND v_report.status = 'declined') THEN
    RETURN commune_private.payment_report_result(v_report.id, true);
  END IF;
  IF v_report.status = 'withdrawn' THEN
    RAISE EXCEPTION 'This report was withdrawn by the member who made it' USING ERRCODE = 'P0001';
  END IF;
  IF v_report.status <> 'pending' THEN
    RAISE EXCEPTION 'This report has already been answered' USING ERRCODE = 'P0001';
  END IF;
  IF p_decision = 'confirm' THEN
    IF p_request_id IS NULL THEN
      RAISE EXCEPTION 'A request id is required to record a repayment' USING ERRCODE = '22023';
    END IF;
    -- The receipt is checked like any other: not voided, within what is
    -- outstanding, and so on. Its errors explain themselves.
    v_receipt := public.record_share_receipt(v_share.id, v_report.amount_minor, v_report.sent_on, v_report.reference, p_request_id);
    -- A receipt that settles the share closes pending reports; this one is
    -- the confirmation itself, so it is marked confirmed, not closed.
    UPDATE public.expense_share_payment_reports SET status = 'confirmed', resolved_at = now(), resolved_by = v_actor,
        receipt_id = (v_receipt->>'id')::uuid, resolution_note = NULL
      WHERE id = p_report_id;
    PERFORM commune_private.notify_ledger(v_expense.commune_id, v_report.reported_by, 'payment_confirmed',
      v_expense.id, v_actor, v_report.amount_minor, NULL);
  ELSE
    IF v_note IS NULL OR length(v_note) NOT BETWEEN 3 AND 240 THEN
      RAISE EXCEPTION 'Say why it has not been received (3 to 240 characters)' USING ERRCODE = '22023';
    END IF;
    UPDATE public.expense_share_payment_reports SET status = 'declined', resolved_at = now(), resolved_by = v_actor,
        resolution_note = v_note
      WHERE id = p_report_id;
    PERFORM commune_private.notify_ledger(v_expense.commune_id, v_report.reported_by, 'payment_declined',
      v_expense.id, v_actor, v_report.amount_minor, v_note);
  END IF;
  RETURN commune_private.payment_report_result(v_report.id, false);
END;
$$;

-- A pending report closes on its own when nothing is left to confirm: the
-- share is settled some other way, or the expense is voided.
CREATE FUNCTION commune_private.close_payment_reports()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME = 'expense_shares' THEN
    IF NEW.settled_minor >= NEW.amount_minor THEN
      UPDATE public.expense_share_payment_reports SET status = 'closed', resolved_at = now(),
          resolution_note = 'Share settled'
        WHERE share_id = NEW.id AND status = 'pending';
    END IF;
  ELSIF NEW.voided_at IS NOT NULL THEN
    UPDATE public.expense_share_payment_reports r SET status = 'closed', resolved_at = now(),
        resolution_note = 'Expense voided'
      FROM public.expense_shares s WHERE s.id = r.share_id AND s.expense_id = NEW.id AND r.status = 'pending';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION commune_private.close_payment_reports() FROM PUBLIC;
CREATE TRIGGER share_settled_closes_reports AFTER UPDATE OF settled_minor ON public.expense_shares
  FOR EACH ROW WHEN (NEW.settled_minor >= NEW.amount_minor) EXECUTE FUNCTION commune_private.close_payment_reports();
CREATE TRIGGER expense_voided_closes_reports AFTER UPDATE OF voided_at ON public.expenses
  FOR EACH ROW WHEN (OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL) EXECUTE FUNCTION commune_private.close_payment_reports();

-- Shares carry their reports beside their receipts: any pending one and the
-- recent history.
DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('commune_private.snapshot_expenses(uuid)'::regprocedure);
  v_source := replace(v_original,
    'ORDER BY r.recorded_at DESC, r.id) FROM public.expense_share_receipts r WHERE r.share_id=s.id),''[]''::jsonb))',
    'ORDER BY r.recorded_at DESC, r.id) FROM public.expense_share_receipts r WHERE r.share_id=s.id),''[]''::jsonb),
        ''paymentReports'',coalesce((SELECT jsonb_agg(jsonb_build_object(''id'',p.id,''reportedBy'',p.reported_by,''amountMinor'',p.amount_minor,''sentOn'',p.sent_on,''reference'',p.reference,
          ''reportedAt'',p.reported_at,''status'',p.status,''resolvedAt'',p.resolved_at,''resolvedBy'',p.resolved_by,''note'',p.resolution_note,''receiptId'',p.receipt_id) ORDER BY p.reported_at DESC, p.id)
          FROM (SELECT * FROM public.expense_share_payment_reports x WHERE x.share_id=s.id ORDER BY x.reported_at DESC, x.id LIMIT 10) p),''[]''::jsonb))');
  IF v_source = v_original OR position('paymentReports' IN v_source) = 0 THEN
    RAISE EXCEPTION 'Unsupported expenses snapshot definition';
  END IF;
  EXECUTE v_source;
END;
$$;

REVOKE ALL ON FUNCTION public.report_share_payment(uuid, bigint, date, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_share_payment(uuid, bigint, date, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.withdraw_share_payment_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.withdraw_share_payment_report(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.resolve_share_payment_report(uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_share_payment_report(uuid, text, text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
