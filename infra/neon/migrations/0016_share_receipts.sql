-- Auditable repayment receipts for expense shares. The bill payer records what
-- they received (possibly in parts) and can reverse an entry with a reason.
-- expense_shares.settled_minor stays as the projection every balance reads;
-- it is now derived from this ledger and guarded at commit. Fund contribution
-- corrections (0013) are a separate ledger and are not touched here.
-- Apply after 0015. Release with the matching web client.
BEGIN;

CREATE FUNCTION commune_private.format_money(p_minor bigint, p_currency text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT CASE p_currency WHEN 'GBP' THEN '£' WHEN 'USD' THEN '$' WHEN 'EUR' THEN '€' ELSE '' END
    || to_char(p_minor / 100.0, 'FM999,999,999,999,990.00');
$$;
REVOKE ALL ON FUNCTION commune_private.format_money(bigint, text) FROM PUBLIC;

CREATE TABLE public.expense_share_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.expense_shares(id) ON DELETE CASCADE,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  received_on date NOT NULL,
  reference text CHECK (reference IS NULL OR length(reference) BETWEEN 1 AND 80),
  recorded_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  -- The client's command id. A retry of the same decision finds this row.
  request_id uuid NOT NULL,
  origin text NOT NULL DEFAULT 'recorded' CHECK (origin IN ('recorded', 'migrated')),
  reversed_at timestamptz,
  reversed_by text,
  reversal_reason text,
  CHECK ((reversed_at IS NULL AND reversed_by IS NULL AND reversal_reason IS NULL)
    OR (reversed_at IS NOT NULL AND reversed_by IS NOT NULL
      AND length(btrim(reversal_reason)) BETWEEN 3 AND 240)),
  UNIQUE (recorded_by, request_id)
);
CREATE INDEX expense_share_receipts_share_idx
  ON public.expense_share_receipts (share_id, recorded_at DESC);
ALTER TABLE public.expense_share_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY receipt_read ON public.expense_share_receipts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.expense_shares s JOIN public.expenses e ON e.id = s.expense_id
    WHERE s.id = share_id AND public.is_commune_member(e.commune_id)));
GRANT SELECT ON public.expense_share_receipts TO authenticated;
-- Deliberately no INSERT/UPDATE/DELETE grant: receipts change only via RPC.

-- Shares confirmed before this ledger existed keep their settled amount as
-- one receipt on the day it was confirmed, marked as migrated history.
INSERT INTO public.expense_share_receipts
  (share_id, amount_minor, received_on, recorded_by, recorded_at, request_id, origin)
SELECT s.id, s.settled_minor, coalesce(s.settled_at, e.created_at)::date, e.paid_by_user_id,
  coalesce(s.settled_at, e.created_at), gen_random_uuid(), 'migrated'
FROM public.expense_shares s JOIN public.expenses e ON e.id = s.expense_id
WHERE s.user_id <> e.paid_by_user_id AND s.settled_minor > 0;

-- Replaced by 0017 once an expense can be voided.
CREATE FUNCTION commune_private.expense_is_voided(p_expense_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$ SELECT false; $$;
REVOKE ALL ON FUNCTION commune_private.expense_is_voided(uuid) FROM PUBLIC;

-- settled_minor is the sum of receipts that have not been reversed.
CREATE FUNCTION commune_private.project_share_settlement(p_share_id uuid)
RETURNS bigint LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_total bigint; v_settled bigint;
BEGIN
  SELECT coalesce(sum(r.amount_minor), 0) INTO v_total FROM public.expense_share_receipts r
    WHERE r.share_id = p_share_id AND r.reversed_at IS NULL;
  UPDATE public.expense_shares s SET settled_minor = v_total,
      settled_at = CASE WHEN v_total < s.amount_minor THEN NULL
        WHEN s.settled_minor >= s.amount_minor THEN coalesce(s.settled_at, now()) ELSE now() END
    WHERE s.id = p_share_id RETURNING s.settled_minor INTO v_settled;
  RETURN v_settled;
END;
$$;
REVOKE ALL ON FUNCTION commune_private.project_share_settlement(uuid) FROM PUBLIC;

-- Commit-time guard: whatever code path wrote, a share's settled amount must
-- equal its active receipts. The payer's own share is settled by definition
-- and can never carry a repayment.
-- SECURITY DEFINER so the check reads every row, not only those the caller's
-- row-level security would show.
CREATE FUNCTION commune_private.check_share_settlement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_bad uuid; v_expense_id uuid; v_share_id uuid;
BEGIN
  -- Each branch is planned only for the table whose row type has that field.
  IF TG_TABLE_NAME = 'expenses' THEN v_expense_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'expense_shares' THEN v_share_id := NEW.id;
  ELSE v_share_id := NEW.share_id;
  END IF;
  SELECT s.id INTO v_bad FROM public.expense_shares s JOIN public.expenses e ON e.id = s.expense_id
  LEFT JOIN LATERAL (SELECT coalesce(sum(r.amount_minor), 0) AS total FROM public.expense_share_receipts r
    WHERE r.share_id = s.id AND r.reversed_at IS NULL) paid ON true
  WHERE (s.id = v_share_id OR s.expense_id = v_expense_id)
    AND (CASE WHEN s.user_id = e.paid_by_user_id
      THEN s.settled_minor <> s.amount_minor OR paid.total <> 0
      ELSE s.settled_minor <> paid.total END)
  LIMIT 1;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Share % does not match its repayment receipts', v_bad USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION commune_private.check_share_settlement() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER share_settlement_matches_receipts AFTER INSERT OR UPDATE ON public.expense_shares
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION commune_private.check_share_settlement();
CREATE CONSTRAINT TRIGGER receipt_matches_share_settlement AFTER INSERT OR UPDATE ON public.expense_share_receipts
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION commune_private.check_share_settlement();
CREATE CONSTRAINT TRIGGER expense_payer_matches_settlement AFTER UPDATE OF paid_by_user_id ON public.expenses
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION commune_private.check_share_settlement();

-- Ledger notices reuse the in-app notification list. A reminder notice keeps
-- its reminder; a ledger notice names the expense and who changed it.
ALTER TABLE public.notifications ALTER COLUMN reminder_id DROP NOT NULL;
ALTER TABLE public.notifications ADD COLUMN notice_kind text;
ALTER TABLE public.notifications ADD COLUMN expense_id uuid REFERENCES public.expenses(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN actor_user_id text;
ALTER TABLE public.notifications ADD COLUMN amount_minor bigint;
ALTER TABLE public.notifications ADD COLUMN detail text CHECK (detail IS NULL OR length(detail) <= 240);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_source_check CHECK (
  (reminder_id IS NOT NULL AND notice_kind IS NULL)
  OR (reminder_id IS NULL AND expense_id IS NOT NULL AND actor_user_id IS NOT NULL
    AND notice_kind IN ('receipt_reversed', 'expense_corrected', 'expense_voided')));

CREATE FUNCTION commune_private.notify_ledger(p_commune_id uuid, p_recipient text, p_kind text,
  p_expense_id uuid, p_actor text, p_amount_minor bigint, p_detail text)
RETURNS void LANGUAGE sql SET search_path = public, pg_temp AS $$
  INSERT INTO public.notifications (commune_id, recipient_user_id, notice_kind, expense_id, actor_user_id, amount_minor, detail)
  SELECT p_commune_id, p_recipient, p_kind, p_expense_id, p_actor, p_amount_minor, left(p_detail, 240)
  WHERE p_recipient <> p_actor AND EXISTS (SELECT 1 FROM public.commune_members m
    WHERE m.commune_id = p_commune_id AND m.user_id = p_recipient AND m.active);
$$;
REVOKE ALL ON FUNCTION commune_private.notify_ledger(uuid, text, text, uuid, text, bigint, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION commune_private.snapshot_notifications(p_commune_id uuid, p_actor text)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',n.id,'communeId',n.commune_id,
      'kind',coalesce(r.kind,replace(n.notice_kind,'_','-')),'sourceId',coalesce(r.source_id,n.expense_id),
      'amountMinor',coalesce(r.amount_minor,n.amount_minor),'senderUserId',coalesce(r.sender_user_id,n.actor_user_id),
      'expenseId',n.expense_id,'title',e.title,'detail',n.detail,'createdAt',n.created_at,'readAt',n.read_at) ORDER BY n.created_at DESC),'[]'::jsonb)
    FROM public.notifications n LEFT JOIN public.reminders r ON r.id=n.reminder_id
    LEFT JOIN public.expenses e ON e.id=n.expense_id
    WHERE n.commune_id=p_commune_id AND n.recipient_user_id=p_actor;
$$;

CREATE FUNCTION public.record_share_receipt(p_share_id uuid, p_amount_minor bigint,
  p_received_on date, p_reference text, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_share public.expense_shares%ROWTYPE;
  v_expense public.expenses%ROWTYPE;
  v_existing public.expense_share_receipts%ROWTYPE;
  v_reference text := nullif(btrim(coalesce(p_reference, '')), '');
  v_currency text; v_id uuid; v_settled bigint;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to record a repayment' USING ERRCODE = '22023';
  END IF;
  -- Commune, then share: the order every money write uses. Membership
  -- changes take the same commune lock, so a leaving member cannot race this.
  PERFORM 1 FROM public.communes co JOIN public.expenses e ON e.commune_id = co.id
    JOIN public.expense_shares s ON s.expense_id = e.id WHERE s.id = p_share_id FOR UPDATE OF co;
  SELECT * INTO v_share FROM public.expense_shares WHERE id = p_share_id FOR UPDATE;
  IF FOUND THEN SELECT * INTO v_expense FROM public.expenses WHERE id = v_share.expense_id; END IF;
  IF v_expense.id IS NULL OR NOT public.is_commune_member(v_expense.commune_id)
     OR v_actor IS DISTINCT FROM v_expense.paid_by_user_id THEN
    RAISE EXCEPTION 'Only the bill payer can record a repayment for this share' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_existing FROM public.expense_share_receipts
    WHERE recorded_by = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.share_id <> p_share_id OR v_existing.amount_minor IS DISTINCT FROM p_amount_minor
       OR v_existing.received_on IS DISTINCT FROM p_received_on OR v_existing.reference IS DISTINCT FROM v_reference THEN
      RAISE EXCEPTION 'This request was already used for a different repayment' USING ERRCODE = '22023';
    END IF;
    IF v_existing.reversed_at IS NOT NULL THEN
      RAISE EXCEPTION 'That repayment was recorded and later reversed. Record it again as a new entry.' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'duplicate', true,
      'settledMinor', v_share.settled_minor, 'outstandingMinor', v_share.amount_minor - v_share.settled_minor);
  END IF;
  SELECT currency INTO v_currency FROM public.communes WHERE id = v_expense.commune_id;
  IF v_share.user_id = v_expense.paid_by_user_id THEN
    RAISE EXCEPTION 'The payer''s own share is not a repayment' USING ERRCODE = '22023';
  END IF;
  IF commune_private.expense_is_voided(v_expense.id) THEN
    RAISE EXCEPTION 'This expense was voided. Repayments cannot be recorded against it.' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'Enter the amount received, greater than zero' USING ERRCODE = '22023';
  END IF;
  IF p_amount_minor > v_share.amount_minor - v_share.settled_minor THEN
    RAISE EXCEPTION 'Only % is still outstanding on this share',
      commune_private.format_money(v_share.amount_minor - v_share.settled_minor, v_currency) USING ERRCODE = 'P0001';
  END IF;
  -- One day of tolerance covers a member whose local date is ahead of UTC.
  IF p_received_on IS NULL OR p_received_on > current_date + 1 OR p_received_on < DATE '2000-01-01' THEN
    RAISE EXCEPTION 'Enter the date the money was received, not a future date' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(v_reference, '')) > 80 THEN
    RAISE EXCEPTION 'Keep the reference to 80 characters' USING ERRCODE = '22023';
  END IF;
  -- Everyone in the commune can read a reference. Refuse what looks like a
  -- card or account number rather than storing it.
  IF regexp_replace(coalesce(v_reference, ''), '\s', '', 'g') ~ '[0-9]{8,}' THEN
    RAISE EXCEPTION 'Leave out card or account numbers. A short note such as "bank transfer" is enough.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.expense_share_receipts (share_id, amount_minor, received_on, reference, recorded_by, request_id)
    VALUES (p_share_id, p_amount_minor, p_received_on, v_reference, v_actor, p_request_id) RETURNING id INTO v_id;
  v_settled := commune_private.project_share_settlement(p_share_id);
  RETURN jsonb_build_object('id', v_id, 'duplicate', false,
    'settledMinor', v_settled, 'outstandingMinor', v_share.amount_minor - v_settled);
END;
$$;

-- Reversing keeps the original entry and adds who, when and why. It reopens
-- the debt, so it is refused once the debtor has left the commune.
CREATE FUNCTION public.reverse_share_receipt(p_receipt_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_receipt public.expense_share_receipts%ROWTYPE;
  v_share public.expense_shares%ROWTYPE;
  v_expense public.expenses%ROWTYPE;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_currency text; v_settled bigint;
BEGIN
  PERFORM 1 FROM public.communes co JOIN public.expenses e ON e.commune_id = co.id
    JOIN public.expense_shares s ON s.expense_id = e.id
    JOIN public.expense_share_receipts r ON r.share_id = s.id WHERE r.id = p_receipt_id FOR UPDATE OF co;
  SELECT s.* INTO v_share FROM public.expense_shares s
    JOIN public.expense_share_receipts r ON r.share_id = s.id WHERE r.id = p_receipt_id FOR UPDATE OF s;
  SELECT * INTO v_receipt FROM public.expense_share_receipts WHERE id = p_receipt_id FOR UPDATE;
  IF v_share.id IS NOT NULL THEN SELECT * INTO v_expense FROM public.expenses WHERE id = v_share.expense_id; END IF;
  IF v_receipt.id IS NULL OR v_expense.id IS NULL OR NOT public.is_commune_member(v_expense.commune_id)
     OR v_actor IS DISTINCT FROM v_expense.paid_by_user_id THEN
    RAISE EXCEPTION 'Only the bill payer can reverse a repayment' USING ERRCODE = '42501';
  END IF;
  -- A repeated reversal is a no-op that reports the standing result.
  IF v_receipt.reversed_at IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_receipt.id, 'duplicate', true,
      'settledMinor', v_share.settled_minor, 'outstandingMinor', v_share.amount_minor - v_share.settled_minor);
  END IF;
  IF length(v_reason) NOT BETWEEN 3 AND 240 THEN
    RAISE EXCEPTION 'Give a reason for the reversal (3 to 240 characters)' USING ERRCODE = '22023';
  END IF;
  IF commune_private.expense_is_voided(v_expense.id) THEN
    RAISE EXCEPTION 'This expense was voided. Its repayments can no longer change.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.commune_members m
    WHERE m.commune_id = v_expense.commune_id AND m.user_id = v_share.user_id AND m.active) THEN
    RAISE EXCEPTION 'Cannot reopen an obligation for a former member' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.expense_share_receipts SET reversed_at = now(), reversed_by = v_actor, reversal_reason = v_reason
    WHERE id = p_receipt_id;
  v_settled := commune_private.project_share_settlement(v_share.id);
  SELECT currency INTO v_currency FROM public.communes WHERE id = v_expense.commune_id;
  PERFORM commune_private.notify_ledger(v_expense.commune_id, v_share.user_id, 'receipt_reversed',
    v_expense.id, v_actor, v_receipt.amount_minor, v_reason);
  RETURN jsonb_build_object('id', v_receipt.id, 'duplicate', false,
    'settledMinor', v_settled, 'outstandingMinor', v_share.amount_minor - v_settled);
END;
$$;

-- "Confirm received" keeps working for existing clients, now as one receipt
-- for the whole outstanding amount instead of an untraceable overwrite.
CREATE OR REPLACE FUNCTION public.confirm_expense_share(p_share_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor text := commune_private.data_api_user_id(); v_outstanding bigint; v_payer text; v_debtor text; v_commune uuid;
BEGIN
  PERFORM 1 FROM public.communes co JOIN public.expenses e ON e.commune_id = co.id
    JOIN public.expense_shares s ON s.expense_id = e.id WHERE s.id = p_share_id FOR UPDATE OF co;
  SELECT s.amount_minor - s.settled_minor, e.paid_by_user_id, s.user_id, e.commune_id
    INTO v_outstanding, v_payer, v_debtor, v_commune
    FROM public.expense_shares s JOIN public.expenses e ON e.id = s.expense_id WHERE s.id = p_share_id FOR UPDATE OF s;
  IF v_payer IS NULL OR NOT public.is_commune_member(v_commune)
     OR v_actor IS DISTINCT FROM v_payer OR v_debtor = v_payer THEN
    RAISE EXCEPTION 'Only the bill payer can confirm an outstanding share' USING ERRCODE = '42501';
  END IF;
  IF v_outstanding <= 0 THEN RETURN; END IF;
  PERFORM public.record_share_receipt(p_share_id, v_outstanding, current_date, NULL, gen_random_uuid());
END;
$$;

-- Lock order. The functions above lock the commune and then the share.
-- send_reminder locked the share (or pledge) first and only then took the
-- commune's key lock for its insert, which could deadlock against them. Take
-- that key lock first. It is the lock the insert needs anyway, so reminders
-- do not block each other any more than before.
DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('public.send_reminder(text,uuid)'::regprocedure);
  v_source := replace(v_original, 'IF p_kind = ''nudge'' THEN',
    'IF p_kind = ''nudge'' THEN
    PERFORM 1 FROM public.communes co JOIN public.expenses e ON e.commune_id = co.id
      JOIN public.expense_shares s ON s.expense_id = e.id WHERE s.id = p_source_id FOR KEY SHARE OF co;');
  v_source := replace(v_source, 'ELSIF p_kind = ''chase'' THEN',
    'ELSIF p_kind = ''chase'' THEN
    PERFORM 1 FROM public.communes co JOIN public.funds f ON f.commune_id = co.id
      JOIN public.fund_commitments c ON c.fund_id = f.id WHERE c.id = p_source_id FOR KEY SHARE OF co;');
  IF v_source = v_original OR position('FOR KEY SHARE OF co' IN v_source) = 0
     OR (length(v_source) - length(replace(v_source, 'FOR KEY SHARE OF co', ''))) / length('FOR KEY SHARE OF co') <> 2 THEN
    RAISE EXCEPTION 'Unsupported reminder sender definition';
  END IF;
  EXECUTE v_source;
END;
$$;

-- History comes from the ledger entry itself, with its amount, rather than a
-- generic "share confirmed" inferred from the projection changing.
DROP TRIGGER commune_share_change ON public.expense_shares;
CREATE FUNCTION commune_private.record_receipt_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_commune uuid; v_expense uuid; v_title text; v_currency text; v_description text;
BEGIN
  IF TG_OP = 'UPDATE' AND NOT (OLD.reversed_at IS NULL AND NEW.reversed_at IS NOT NULL) THEN RETURN NEW; END IF;
  SELECT e.commune_id, e.id, e.title, co.currency INTO v_commune, v_expense, v_title, v_currency
    FROM public.expense_shares s JOIN public.expenses e ON e.id = s.expense_id
    JOIN public.communes co ON co.id = e.commune_id WHERE s.id = NEW.share_id;
  v_description := 'Repayment of ' || commune_private.format_money(NEW.amount_minor, v_currency)
    || CASE WHEN TG_OP = 'INSERT' THEN ' recorded' ELSE ' reversed' END;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description, details)
    VALUES (v_commune, commune_private.data_api_user_id(), 'expenses', v_expense, v_title, v_description,
      jsonb_build_object('receiptId', NEW.id, 'shareId', NEW.share_id, 'amountMinor', NEW.amount_minor,
        'receivedOn', NEW.received_on, 'reversed', TG_OP = 'UPDATE', 'reason', NEW.reversal_reason));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION commune_private.record_receipt_event() FROM PUBLIC;
CREATE TRIGGER receipt_event AFTER INSERT OR UPDATE ON public.expense_share_receipts
  FOR EACH ROW EXECUTE FUNCTION commune_private.record_receipt_event();

CREATE OR REPLACE FUNCTION commune_private.snapshot_expenses(p_commune_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'category',e.category,'amountMinor',e.amount_minor,'paidByUserId',e.paid_by_user_id,'dueOn',e.due_on,'createdAt',e.created_at,
      'recurring',EXISTS(SELECT 1 FROM public.recurring_bill_occurrences o WHERE o.expense_id=e.id),
      'shares',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'userId',s.user_id,'amountMinor',s.amount_minor,'settledMinor',s.settled_minor,'settledAt',s.settled_at,
        'receipts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'amountMinor',r.amount_minor,'receivedOn',r.received_on,'reference',r.reference,'recordedBy',r.recorded_by,'recordedAt',r.recorded_at,'origin',r.origin,
          'reversedAt',r.reversed_at,'reversedBy',r.reversed_by,'reversalReason',r.reversal_reason) ORDER BY r.recorded_at DESC, r.id) FROM public.expense_share_receipts r WHERE r.share_id=s.id),'[]'::jsonb)) ORDER BY s.user_id) FROM public.expense_shares s WHERE s.expense_id=e.id),'[]'::jsonb)) ORDER BY e.created_at DESC),'[]'::jsonb)
    FROM public.expenses e WHERE e.commune_id=p_commune_id;
$$;

REVOKE ALL ON FUNCTION public.record_share_receipt(uuid, bigint, date, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_share_receipt(uuid, bigint, date, text, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.reverse_share_receipt(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_share_receipt(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
