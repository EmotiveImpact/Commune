-- Lighter loading. The app read every commune's whole snapshot once a minute
-- in every open tab, and a snapshot carried every expense ever recorded with
-- its repayments, reports and corrections: about 1.8 MB for a busy household's
-- year. The commune list read two tables whose row checks ran once per row,
-- so it slowed as the platform grew, and anyone could create communes without
-- limit.
-- 1. Change marks. Every write that a snapshot, the commune list or an
--    invitation list shows adds a row to commune_private.commune_changes, at
--    most one per commune per transaction. A commune's mark summarises its
--    recent rows; the app compares marks (one small request) and reads a
--    snapshot only when its mark has moved. The worker's scheduled run prunes
--    rows older than 2 days.
-- 2. public.my_communes() is the commune list with each commune's mark. The
--    communes and commune_members row checks look the caller's communes up
--    once per query. create_commune refuses an 11th commune in an hour, a 31st
--    in a day and a 101st in all.
-- 3. The snapshot carries the expenses still open, those created or changed
--    since the start of last month (UTC) and the five newest that are not
--    voided, plus expenseHistory, which says from when and how many older
--    ones were left out. Older ones come a month or more at a time from
--    public.commune_expense_page, and named ones from
--    public.commune_expense_records, in the same shape.
-- The web app released with this needs it applied first. Apply after 0035.
BEGIN;

-- 1. Change marks --------------------------------------------------------

-- Rows are only ever inserted. A shared counter row would make every write in
-- a commune wait for the one before it, and with the commune lock that money
-- commands take first it could deadlock. No foreign key either: one would take
-- a key-share lock on the commune row from every write.
CREATE TABLE commune_private.commune_changes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  commune_id uuid NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX commune_changes_recent_idx ON commune_private.commune_changes (commune_id, changed_at) INCLUDE (id);
CREATE INDEX commune_changes_age_idx ON commune_private.commune_changes (changed_at);
ALTER TABLE commune_private.commune_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON commune_private.commune_changes FROM PUBLIC, authenticated;

-- The trigger's argument names the column that leads to the commune. The
-- communes already noted in this transaction are kept in a transaction-local
-- setting, so a command that writes twenty rows adds one change row. A
-- subtransaction that rolls back takes its change row and its note with it.
CREATE FUNCTION commune_private.note_commune_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_key uuid := (to_jsonb(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END) ->> TG_ARGV[0])::uuid;
  v_noted text := coalesce(current_setting('commune.changed_communes', true), '');
  v_commune uuid;
BEGIN
  v_commune := CASE TG_ARGV[0]
    WHEN 'id' THEN v_key
    WHEN 'commune_id' THEN v_key
    WHEN 'expense_id' THEN (SELECT e.commune_id FROM public.expenses e WHERE e.id = v_key)
    WHEN 'share_id' THEN (SELECT e.commune_id FROM public.expense_shares s
      JOIN public.expenses e ON e.id = s.expense_id WHERE s.id = v_key)
    WHEN 'fund_id' THEN (SELECT f.commune_id FROM public.funds f WHERE f.id = v_key)
    WHEN 'commitment_id' THEN (SELECT f.commune_id FROM public.fund_commitments c
      JOIN public.funds f ON f.id = c.fund_id WHERE c.id = v_key)
    WHEN 'reminder_id' THEN (SELECT r.commune_id FROM public.reminders r WHERE r.id = v_key)
    WHEN 'announcement_id' THEN (SELECT a.commune_id FROM public.commune_announcements a WHERE a.id = v_key)
    WHEN 'bill_id' THEN (SELECT b.commune_id FROM public.recurring_bills b WHERE b.id = v_key)
  END;
  -- A row whose parent went first, as in a cascading delete, was noted with
  -- its parent.
  IF v_commune IS NULL OR strpos(v_noted, v_commune::text) > 0 THEN
    RETURN NULL;
  END IF;
  INSERT INTO commune_private.commune_changes (commune_id) VALUES (v_commune);
  PERFORM set_config('commune.changed_communes', v_noted || v_commune::text || ' ', true);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION commune_private.note_commune_change() FROM PUBLIC;

CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.communes
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.commune_members
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.commune_invites
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.expense_shares
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('expense_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.expense_share_receipts
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('share_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.expense_share_payment_reports
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('share_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.expense_revisions
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('expense_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.funds
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.fund_commitments
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('fund_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.fund_contributions
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commitment_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.fund_pledge_requests
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commitment_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');
-- A sent reminder shows whether an email may have gone (reminder_email_state),
-- which only the status and the error decide. Trimming old payloads is not a
-- change anyone sees.
CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE OF status, last_error ON public.reminder_email_outbox
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('reminder_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.commune_notes
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.note_revisions
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.commune_operations
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.operation_occurrences
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.commune_announcements
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.announcement_acknowledgements
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('announcement_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.recurring_bills
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.recurring_bill_occurrences
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('bill_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.split_templates
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');
CREATE TRIGGER change_mark AFTER INSERT OR UPDATE OR DELETE ON public.commune_events
  FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');

-- A commune's mark: today's date (UTC), then the count and the highest id of
-- its change rows since the start of yesterday (UTC). Ids are handed out when
-- a row is inserted, not when it commits, so a write can commit with a lower
-- id than one already seen; the count still moves. Within a day rows only
-- join the window, so the count moves with every commit, and the window
-- reaches back a day so that a write which began just before midnight and
-- committed after it still counts. The date makes every mark move once a day,
-- which also refreshes what the snapshot works out from the date (reminders
-- that are due, the expense window). Pruning after 2 days never touches it.
CREATE FUNCTION commune_private.change_mark(p_commune_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD') || ':' || count(*) || ':' || coalesce(max(c.id), 0)
    FROM commune_private.commune_changes c
    WHERE c.commune_id = p_commune_id
      AND c.changed_at >= (date_trunc('day', now() AT TIME ZONE 'UTC') - interval '1 day') AT TIME ZONE 'UTC';
$$;
REVOKE ALL ON FUNCTION commune_private.change_mark(uuid) FROM PUBLIC;

-- Only the worker calls this, as the database owner.
CREATE OR REPLACE FUNCTION commune_private.prune_delivery_records()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_payloads integer; v_invitations integer; v_changes integer;
BEGIN
  UPDATE public.reminder_email_outbox SET payload = NULL, payload_amount_minor = NULL
    WHERE payload IS NOT NULL AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_payloads = ROW_COUNT;
  DELETE FROM public.invitation_email_deliveries
    WHERE created_at < now() - interval '30 days' AND status IN ('sent', 'failed', 'sending');
  GET DIAGNOSTICS v_invitations = ROW_COUNT;
  -- Marks look back to the start of yesterday at most.
  DELETE FROM commune_private.commune_changes WHERE changed_at < now() - interval '2 days';
  GET DIAGNOSTICS v_changes = ROW_COUNT;
  RETURN jsonb_build_object('reminderPayloads', v_payloads, 'invitationEmails', v_invitations, 'changeMarks', v_changes);
END;
$$;
REVOKE ALL ON FUNCTION commune_private.prune_delivery_records() FROM PUBLIC;

-- 2. The commune list and creating communes --------------------------------

-- The caller's communes, looked up once per query by the row checks below.
-- The row checks run as the caller, so it may run this helper; the Data API
-- offers only public, so it is not an RPC.
CREATE FUNCTION commune_private.my_commune_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(array_agg(m.commune_id), '{}') FROM public.commune_members m
    WHERE m.user_id = commune_private.data_api_user_id() AND m.active;
$$;
REVOKE ALL ON FUNCTION commune_private.my_commune_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION commune_private.my_commune_ids() TO authenticated;

ALTER POLICY commune_read ON public.communes
  USING (id = ANY ((SELECT commune_private.my_commune_ids())::uuid[]));
ALTER POLICY member_read ON public.commune_members
  USING (commune_id = ANY ((SELECT commune_private.my_commune_ids())::uuid[]));

CREATE FUNCTION public.my_communes()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'kind', c.kind, 'currency', c.currency,
      'address', c.address, 'destination', c.destination, 'stayName', c.stay_name, 'stayAddress', c.stay_address,
      'role', m.role, 'memberCount', (SELECT count(*) FROM public.commune_members cm WHERE cm.commune_id = c.id AND cm.active),
      'changeMark', commune_private.change_mark(c.id)) ORDER BY c.created_at DESC, c.id), '[]'::jsonb)
    FROM public.commune_members m JOIN public.communes c ON c.id = m.commune_id
    WHERE m.user_id = commune_private.data_api_user_id() AND m.active;
$$;
REVOKE ALL ON FUNCTION public.my_communes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_communes() TO authenticated;

CREATE INDEX communes_created_by_idx ON public.communes (created_by, created_at);

-- One person's creations are counted one at a time, so two at once cannot
-- both slip under a limit.
DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('public.create_commune(text,text,text)'::regprocedure);
  v_source := replace(v_original, '  INSERT INTO public.communes (name, kind, currency, created_by)',
    $patch$  PERFORM pg_advisory_xact_lock(hashtextextended('commune-create:' || v_user, 0));
  IF (SELECT count(*) FROM public.communes WHERE created_by = v_user AND created_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'You have created 10 communes in the last hour. Try again later.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.communes WHERE created_by = v_user AND created_at > now() - interval '1 day') >= 30 THEN
    RAISE EXCEPTION 'You have created 30 communes in the last day. Try again tomorrow.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.communes WHERE created_by = v_user) >= 100 THEN
    RAISE EXCEPTION 'You have created 100 communes, which is the most one account can create.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.communes (name, kind, currency, created_by)$patch$);
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported definition of public.create_commune'; END IF;
  EXECUTE v_source;
END;
$$;

-- 3. A bounded snapshot and paged expense history ---------------------------

-- Where a snapshot's expense history starts: the first day of last month, UTC.
CREATE FUNCTION commune_private.expense_window_start()
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT (date_trunc('month', now() AT TIME ZONE 'UTC') - interval '1 month') AT TIME ZONE 'UTC';
$$;
REVOKE ALL ON FUNCTION commune_private.expense_window_start() FROM PUBLIC;

-- The expenses a snapshot carries: every open one (not voided, a share still
-- owed), every one created, corrected or voided since the window start or
-- with a share settled since then, and the five newest that are not voided,
-- so a commune that has gone quiet still shows its latest. A repayment, its
-- reversal and a payment report either leave a share owed or settle it, and
-- a correction or void sets updated_at, so these cover them all. Ties on
-- created_at go by id, so every caller leaves out the same ones. The
-- commune's expenses are read through expenses_commune_idx and each one's
-- shares through their (expense_id, user_id) key.
CREATE FUNCTION commune_private.snapshot_expense_ids(p_commune_id uuid, p_since timestamptz)
RETURNS SETOF uuid LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT e.id FROM public.expenses e
    WHERE e.commune_id = p_commune_id
      AND (e.created_at >= p_since OR e.updated_at >= p_since
        OR EXISTS (SELECT 1 FROM public.expense_shares s WHERE s.expense_id = e.id
          AND ((e.voided_at IS NULL AND s.settled_minor < s.amount_minor) OR s.settled_at >= p_since)))
  UNION
  (SELECT e.id FROM public.expenses e WHERE e.commune_id = p_commune_id AND e.voided_at IS NULL
    ORDER BY e.created_at DESC, e.id DESC LIMIT 5);
$$;
REVOKE ALL ON FUNCTION commune_private.snapshot_expense_ids(uuid, timestamptz) FROM PUBLIC;

-- Every path builds an expense the same way, newest first.
CREATE FUNCTION commune_private.expense_records(p_ids uuid[])
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'category',e.category,'amountMinor',e.amount_minor,'paidByUserId',e.paid_by_user_id,'recordedBy',e.recorded_by,'dueOn',e.due_on,'createdAt',e.created_at,
      'version',e.version,'updatedAt',e.updated_at,'voidedAt',e.voided_at,'voidedBy',e.voided_by,'voidReason',e.void_reason,
      'recurring',EXISTS(SELECT 1 FROM public.recurring_bill_occurrences o WHERE o.expense_id=e.id),
      'revisions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id,'version',v.version,'action',v.action,'actorId',v.actor_id,'reason',v.reason,'before',v.before,'after',v.after,'createdAt',v.created_at) ORDER BY v.version DESC)
        FROM (SELECT * FROM public.expense_revisions rv WHERE rv.expense_id=e.id ORDER BY rv.version DESC LIMIT 20) v),'[]'::jsonb),
      'shares',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'userId',s.user_id,'amountMinor',s.amount_minor,'settledMinor',s.settled_minor,'settledAt',s.settled_at,
        'receipts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'amountMinor',r.amount_minor,'receivedOn',r.received_on,'reference',r.reference,'recordedBy',r.recorded_by,'recordedAt',r.recorded_at,'origin',r.origin,
          'reversedAt',r.reversed_at,'reversedBy',r.reversed_by,'reversalReason',r.reversal_reason) ORDER BY r.recorded_at DESC, r.id) FROM public.expense_share_receipts r WHERE r.share_id=s.id),'[]'::jsonb),
        'paymentReports',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'reportedBy',p.reported_by,'amountMinor',p.amount_minor,'sentOn',p.sent_on,'reference',p.reference,
          'reportedAt',p.reported_at,'status',p.status,'resolvedAt',p.resolved_at,'resolvedBy',p.resolved_by,'note',p.resolution_note,'receiptId',p.receipt_id) ORDER BY p.reported_at DESC, p.id)
          FROM (SELECT * FROM public.expense_share_payment_reports x WHERE x.share_id=s.id ORDER BY x.reported_at DESC, x.id LIMIT 10) p),'[]'::jsonb)) ORDER BY s.user_id) FROM public.expense_shares s WHERE s.expense_id=e.id),'[]'::jsonb)) ORDER BY e.created_at DESC, e.id DESC),'[]'::jsonb)
    FROM public.expenses e WHERE e.id = ANY (p_ids);
$$;
REVOKE ALL ON FUNCTION commune_private.expense_records(uuid[]) FROM PUBLIC;

CREATE OR REPLACE FUNCTION commune_private.snapshot_expenses(p_commune_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT commune_private.expense_records(ARRAY(
    SELECT commune_private.snapshot_expense_ids(p_commune_id, commune_private.expense_window_start())));
$$;
REVOKE ALL ON FUNCTION commune_private.snapshot_expenses(uuid) FROM PUBLIC;

-- From when the snapshot's expenses are complete (every expense created on or
-- after that day is in it), and how many older ones it leaves out.
CREATE FUNCTION commune_private.expense_history(p_commune_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE v_since timestamptz := commune_private.expense_window_start();
BEGIN
  RETURN (SELECT jsonb_build_object('since', to_char(v_since AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
      'olderCount', count(*), 'olderVoidedCount', count(*) FILTER (WHERE e.voided_at IS NOT NULL))
    FROM public.expenses e
    WHERE e.commune_id = p_commune_id AND e.created_at < v_since
      AND e.id NOT IN (SELECT commune_private.snapshot_expense_ids(p_commune_id, v_since)));
END;
$$;
REVOKE ALL ON FUNCTION commune_private.expense_history(uuid) FROM PUBLIC;

-- The snapshot is STABLE, so the mark is read with the same view of the data
-- as everything else in it.
DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('public.commune_snapshot(uuid)'::regprocedure);
  v_source := replace(v_original, $anchor$'expenses',commune_private.snapshot_expenses(co.id),$anchor$,
    $patch$'expenses',commune_private.snapshot_expenses(co.id),
    'expenseHistory',commune_private.expense_history(co.id),'changeMark',commune_private.change_mark(co.id),$patch$);
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported snapshot expenses definition'; END IF;
  EXECUTE v_source;
END;
$$;

-- What the overview screens show of a commune that is not open: the snapshot
-- with the same keys, less the detail only its own screens use (repayment,
-- report and correction history, note bodies, task and bill history, notices,
-- templates, sent reminders and the reader's notices there). detail says so,
-- and the app never shows a commune's own screens from it.
CREATE FUNCTION public.commune_summary(p_commune_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_full jsonb := public.commune_snapshot(p_commune_id);
BEGIN
  RETURN v_full || jsonb_build_object('detail', 'summary',
    'expenses', (SELECT coalesce(jsonb_agg(x.item || jsonb_build_object('revisions', '[]'::jsonb,
        'shares', (SELECT coalesce(jsonb_agg(y.item || '{"receipts": [], "paymentReports": []}'::jsonb ORDER BY y.ord), '[]'::jsonb)
          FROM jsonb_array_elements(x.item -> 'shares') WITH ORDINALITY y(item, ord))) ORDER BY x.ord), '[]'::jsonb)
      FROM jsonb_array_elements(v_full -> 'expenses') WITH ORDINALITY x(item, ord)),
    'notes', (SELECT coalesce(jsonb_agg(x.item || '{"body": "", "revisions": []}'::jsonb ORDER BY x.ord), '[]'::jsonb)
      FROM jsonb_array_elements(v_full -> 'notes') WITH ORDINALITY x(item, ord)),
    'operations', (SELECT coalesce(jsonb_agg(x.item || '{"history": []}'::jsonb ORDER BY x.ord), '[]'::jsonb)
      FROM jsonb_array_elements(v_full -> 'operations') WITH ORDINALITY x(item, ord)),
    'recurringBills', (SELECT coalesce(jsonb_agg(x.item || '{"history": []}'::jsonb ORDER BY x.ord), '[]'::jsonb)
      FROM jsonb_array_elements(v_full -> 'recurringBills') WITH ORDINALITY x(item, ord)),
    'announcements', '[]'::jsonb, 'splitTemplates', '[]'::jsonb, 'sentReminders', '[]'::jsonb,
    'notifications', '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.commune_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commune_summary(uuid) TO authenticated;

-- Expenses the snapshot left out, created in the p_months calendar months
-- (UTC) before p_before, or all of them before it when p_months is null.
-- p_before defaults to the snapshot's window start. When those months hold
-- none, the page reaches back to the month of the newest older one, so a
-- quiet spell never ends the history early. olderCount is how many older
-- ones remain; "from" is null when the page reaches back to the beginning.
CREATE FUNCTION public.commune_expense_page(p_commune_id uuid, p_before date, p_months integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_window uuid[];
  v_before timestamptz;
  v_from timestamptz;
  v_newest timestamptz;
BEGIN
  IF NOT public.is_commune_member(p_commune_id) THEN RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501'; END IF;
  IF p_months IS NOT NULL AND p_months NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'Ask for 1 to 12 months of expenses at a time' USING ERRCODE = '22023';
  END IF;
  v_window := ARRAY(SELECT commune_private.snapshot_expense_ids(p_commune_id, commune_private.expense_window_start()));
  v_before := date_trunc('month', coalesce(p_before::timestamp, commune_private.expense_window_start() AT TIME ZONE 'UTC')) AT TIME ZONE 'UTC';
  SELECT max(e.created_at) INTO v_newest FROM public.expenses e
    WHERE e.commune_id = p_commune_id AND e.created_at < v_before AND NOT (e.id = ANY (v_window));
  v_from := CASE WHEN p_months IS NULL OR v_newest IS NULL THEN NULL
    ELSE least((date_trunc('month', v_before AT TIME ZONE 'UTC') - make_interval(months => p_months)) AT TIME ZONE 'UTC',
      date_trunc('month', v_newest AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') END;
  RETURN jsonb_build_object(
    'expenses', commune_private.expense_records(ARRAY(SELECT e.id FROM public.expenses e
      WHERE e.commune_id = p_commune_id AND e.created_at < v_before AND e.created_at >= coalesce(v_from, '-infinity')
        AND NOT (e.id = ANY (v_window)))),
    'before', to_char(v_before AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
    'from', to_char(v_from AT TIME ZONE 'UTC', 'YYYY-MM-DD'))
    || (SELECT jsonb_build_object('olderCount', count(*), 'olderVoidedCount', count(*) FILTER (WHERE e.voided_at IS NOT NULL))
      FROM public.expenses e
      WHERE e.commune_id = p_commune_id AND e.created_at < coalesce(v_from, '-infinity') AND NOT (e.id = ANY (v_window)));
END;
$$;
REVOKE ALL ON FUNCTION public.commune_expense_page(uuid, date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commune_expense_page(uuid, date, integer) TO authenticated;

-- Named expenses of one commune, for a link to an expense that is not loaded.
-- An id from elsewhere is left out, as is one that does not exist.
CREATE FUNCTION public.commune_expense_records(p_commune_id uuid, p_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_commune_member(p_commune_id) THEN RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501'; END IF;
  IF p_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Ask for 1 to 50 expenses at a time' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('expenses', commune_private.expense_records(ARRAY(SELECT e.id FROM public.expenses e
    WHERE e.commune_id = p_commune_id AND e.id = ANY (p_ids))));
END;
$$;
REVOKE ALL ON FUNCTION public.commune_expense_records(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commune_expense_records(uuid, uuid[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
