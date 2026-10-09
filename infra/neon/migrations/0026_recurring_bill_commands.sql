-- Recurring bill commands. Pause, resume, archive and restore have their own
-- commands and never touch the amount, split or due date. An edit names the
-- version it was based on, and every change to a bill (edit, record, skip,
-- pause, archive) makes a new version, so a screen opened before someone
-- recorded a period can no longer put back the old amount or due date. A
-- recorded or skipped period never becomes due again. Resuming checks that
-- the payer and everyone in the split are still members. Adding a bill
-- carries a request id. Skips reach at most one period ahead and are limited
-- per day, and the snapshot's per-expense period check now uses an index.
-- Apply after 0025. Release with the matching web client.
BEGIN;

ALTER TABLE public.recurring_bills
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN request_id uuid,
  -- An archived bill is never due; restoring it brings it back paused.
  ADD CONSTRAINT recurring_archived_paused CHECK (archived_at IS NULL OR paused);
-- A retried "add" returns the bill it already added.
CREATE UNIQUE INDEX recurring_bills_request_idx ON public.recurring_bills (created_by, request_id)
  WHERE request_id IS NOT NULL;
-- The snapshot asks, for every expense, whether a recurring period produced
-- it. Without this index each check read the whole table, across communes.
CREATE INDEX recurring_occurrences_expense_idx ON public.recurring_bill_occurrences (expense_id)
  WHERE expense_id IS NOT NULL;

-- Every update is a new version, whichever command made it.
CREATE FUNCTION commune_private.bump_recurring_bill_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION commune_private.bump_recurring_bill_version() FROM PUBLIC;
CREATE TRIGGER recurring_bill_version BEFORE UPDATE ON public.recurring_bills
  FOR EACH ROW EXECUTE FUNCTION commune_private.bump_recurring_bill_version();

-- The payer and split members who are no longer in the commune, payer
-- first, then in split order. Their names are kept for the message.
CREATE FUNCTION commune_private.recurring_departed_names(p_commune_id uuid, p_paid_by text, p_shares jsonb)
RETURNS text[] LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT array_agg(coalesce(u.name, 'A former member') ORDER BY p.ord)
  FROM (SELECT x.user_id, min(x.ord) AS ord FROM (
      SELECT p_paid_by AS user_id, 0::bigint AS ord
      UNION ALL SELECT e.value->>'user_id', e.ord FROM jsonb_array_elements(p_shares) WITH ORDINALITY e(value, ord)
    ) x GROUP BY x.user_id) p
  LEFT JOIN neon_auth."user" u ON u.id::text = p.user_id
  WHERE NOT EXISTS (SELECT 1 FROM public.commune_members m
    WHERE m.commune_id = p_commune_id AND m.user_id = p.user_id AND m.active);
$$;
REVOKE ALL ON FUNCTION commune_private.recurring_departed_names(uuid, text, jsonb) FROM PUBLIC;

CREATE FUNCTION commune_private.recurring_bill_result(p_id uuid, p_duplicate boolean)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object('id', b.id, 'paused', b.paused, 'archivedAt', b.archived_at,
    'version', b.version, 'duplicate', p_duplicate)
  FROM public.recurring_bills b WHERE b.id = p_id;
$$;
REVOKE ALL ON FUNCTION commune_private.recurring_bill_result(uuid, boolean) FROM PUBLIC;

-- Add a bill, or edit one from the version the editor loaded. An edit never
-- changes whether the bill is paused: that is set_recurring_bill_paused.
DROP FUNCTION public.save_recurring_bill(uuid, text, bigint, text, jsonb, text, date, boolean, uuid);
CREATE FUNCTION public.save_recurring_bill(p_commune_id uuid, p_title text, p_amount_minor bigint, p_paid_by text,
  p_shares jsonb, p_frequency text, p_next_due_on date, p_id uuid DEFAULT NULL, p_expected_version integer DEFAULT NULL,
  p_request_id uuid DEFAULT NULL, p_paused boolean DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_admin boolean;
  v_existing public.recurring_bills%ROWTYPE;
  v_last public.recurring_bill_occurrences%ROWTYPE;
  v_earliest date := (current_date - interval '1 year')::date;
  v_latest date := (current_date + interval '2 years')::date;
  v_id uuid;
BEGIN
  PERFORM 1 FROM public.communes WHERE id = p_commune_id FOR UPDATE;
  v_admin := public.is_commune_admin(p_commune_id);
  IF NOT public.is_commune_member(p_commune_id) OR (p_paid_by IS DISTINCT FROM v_actor AND NOT v_admin) THEN
    RAISE EXCEPTION 'Only an admin can schedule another member as payer' USING ERRCODE = '42501';
  END IF;
  IF p_id IS NULL THEN
    IF p_request_id IS NULL THEN
      RAISE EXCEPTION 'A request id is required to add a recurring bill' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_existing FROM public.recurring_bills WHERE created_by = v_actor AND request_id = p_request_id;
    IF FOUND THEN
      IF v_existing.commune_id <> p_commune_id THEN
        RAISE EXCEPTION 'This request was already used for a different bill' USING ERRCODE = '22023';
      END IF;
      RETURN v_existing.id;
    END IF;
  ELSE
    SELECT * INTO v_existing FROM public.recurring_bills WHERE id = p_id FOR UPDATE;
    -- Members edit only a bill they added and pay themselves.
    IF NOT FOUND OR v_existing.commune_id <> p_commune_id
       OR (NOT v_admin AND (v_existing.created_by <> v_actor OR v_existing.paid_by_user_id <> v_actor)) THEN
      RAISE EXCEPTION 'Only an admin, or the member who added this bill and pays it, can edit it' USING ERRCODE = '42501';
    END IF;
    IF p_paused IS NOT NULL THEN
      RAISE EXCEPTION 'An edit cannot pause or resume a bill. Use Pause or Resume.' USING ERRCODE = '22023';
    END IF;
    IF v_existing.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'This bill is archived. Restore it before editing it.' USING ERRCODE = 'P0001';
    END IF;
    IF p_expected_version IS DISTINCT FROM v_existing.version THEN
      RAISE EXCEPTION 'This recurring bill was changed by someone else. Review the latest version before saving your changes.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF length(btrim(coalesce(p_title, ''))) NOT BETWEEN 1 AND 80 OR p_frequency IS NULL OR p_frequency NOT IN ('weekly', 'monthly')
     OR p_next_due_on IS NULL THEN
    RAISE EXCEPTION 'Invalid recurring bill' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.commune_members WHERE commune_id = p_commune_id AND user_id = p_paid_by AND active) THEN
    RAISE EXCEPTION 'Choose a payer who is a member of this commune' USING ERRCODE = '22023';
  END IF;
  -- Far enough back to record the last few periods, not years of history,
  -- and not so far ahead that a typo hides the bill. An unchanged date is
  -- not checked again, so an old paused bill can still be edited.
  IF (p_id IS NULL OR p_next_due_on <> v_existing.next_due_on) AND p_next_due_on NOT BETWEEN v_earliest AND v_latest THEN
    RAISE EXCEPTION 'Choose a next due date between % and %', to_char(v_earliest, 'FMDD Mon YYYY'), to_char(v_latest, 'FMDD Mon YYYY')
      USING ERRCODE = '22023';
  END IF;
  PERFORM commune_private.validate_expense_split(p_commune_id, p_amount_minor, p_shares);
  IF p_id IS NULL THEN
    INSERT INTO public.recurring_bills (commune_id, title, amount_minor, paid_by_user_id, shares, frequency, next_due_on, anchor_day,
        paused, created_by, request_id)
      VALUES (p_commune_id, btrim(p_title), p_amount_minor, p_paid_by, p_shares, p_frequency, p_next_due_on, extract(day FROM p_next_due_on),
        coalesce(p_paused, false), v_actor, p_request_id) RETURNING id INTO v_id;
  ELSE
    -- A recorded or skipped period never becomes due again, and nothing
    -- before the latest one can be reopened.
    SELECT * INTO v_last FROM public.recurring_bill_occurrences WHERE bill_id = p_id ORDER BY due_on DESC LIMIT 1;
    IF FOUND AND p_next_due_on <= v_last.due_on THEN
      RAISE EXCEPTION 'The % period was already %. Choose a next due date after it.', to_char(v_last.due_on, 'FMDD Mon YYYY'), v_last.status
        USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.recurring_bills SET title = btrim(p_title), amount_minor = p_amount_minor, paid_by_user_id = p_paid_by, shares = p_shares,
        frequency = p_frequency, next_due_on = p_next_due_on,
        anchor_day = CASE WHEN next_due_on = p_next_due_on AND frequency = p_frequency THEN anchor_day ELSE extract(day FROM p_next_due_on) END,
        updated_at = now()
      WHERE id = p_id RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

-- Pause or resume, and nothing else. Asking for the state the bill is
-- already in changes nothing. A bill resumes only when its payer and
-- everyone in its split are still members.
CREATE FUNCTION public.set_recurring_bill_paused(p_id uuid, p_paused boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_bill public.recurring_bills%ROWTYPE;
  v_left text[];
BEGIN
  PERFORM 1 FROM public.communes co JOIN public.recurring_bills b ON b.commune_id = co.id WHERE b.id = p_id FOR UPDATE OF co;
  SELECT * INTO v_bill FROM public.recurring_bills WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_commune_member(v_bill.commune_id)
     OR (v_actor IS DISTINCT FROM v_bill.created_by AND v_actor IS DISTINCT FROM v_bill.paid_by_user_id
       AND NOT public.is_commune_admin(v_bill.commune_id)) THEN
    RAISE EXCEPTION 'Only the person who added this bill, its payer or an admin can pause or resume it' USING ERRCODE = '42501';
  END IF;
  IF p_paused IS NULL THEN
    RAISE EXCEPTION 'Choose pause or resume' USING ERRCODE = '22023';
  END IF;
  IF v_bill.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This bill is archived. Restore it first.' USING ERRCODE = 'P0001';
  END IF;
  IF v_bill.paused = p_paused THEN
    RETURN commune_private.recurring_bill_result(p_id, true);
  END IF;
  IF NOT p_paused THEN
    v_left := commune_private.recurring_departed_names(v_bill.commune_id, v_bill.paid_by_user_id, v_bill.shares);
    IF cardinality(v_left) > 0 THEN
      RAISE EXCEPTION '% % left the commune. Update the payer and split before resuming this bill.',
        CASE WHEN cardinality(v_left) = 1 THEN v_left[1]
          ELSE array_to_string(v_left[1:cardinality(v_left) - 1], ', ') || ' and ' || v_left[cardinality(v_left)] END,
        CASE WHEN cardinality(v_left) = 1 THEN 'has' ELSE 'have' END USING ERRCODE = 'P0001';
    END IF;
  END IF;
  -- This command writes its own history line instead of a generic "Updated".
  PERFORM set_config('commune.occurrence_event', 'on', true);
  UPDATE public.recurring_bills SET paused = p_paused, updated_at = now() WHERE id = p_id;
  PERFORM set_config('commune.occurrence_event', 'off', true);
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description, details)
    VALUES (v_bill.commune_id, v_actor, 'recurring', p_id, v_bill.title, CASE WHEN p_paused THEN 'Paused' ELSE 'Resumed' END,
      jsonb_build_object('before', jsonb_build_object('paused', v_bill.paused), 'after', jsonb_build_object('paused', p_paused)));
  RETURN commune_private.recurring_bill_result(p_id, false);
END;
$$;

-- Archive a bill nobody needs (it is paused and leaves every due list), or
-- restore it, still paused. Its recorded periods and expenses are untouched.
CREATE FUNCTION public.set_recurring_bill_archived(p_id uuid, p_archived boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_bill public.recurring_bills%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.communes co JOIN public.recurring_bills b ON b.commune_id = co.id WHERE b.id = p_id FOR UPDATE OF co;
  SELECT * INTO v_bill FROM public.recurring_bills WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_commune_member(v_bill.commune_id)
     OR (v_actor IS DISTINCT FROM v_bill.created_by AND v_actor IS DISTINCT FROM v_bill.paid_by_user_id
       AND NOT public.is_commune_admin(v_bill.commune_id)) THEN
    RAISE EXCEPTION 'Only the person who added this bill, its payer or an admin can archive or restore it' USING ERRCODE = '42501';
  END IF;
  IF p_archived IS NULL THEN
    RAISE EXCEPTION 'Choose archive or restore' USING ERRCODE = '22023';
  END IF;
  IF (v_bill.archived_at IS NOT NULL) = p_archived THEN
    RETURN commune_private.recurring_bill_result(p_id, true);
  END IF;
  PERFORM set_config('commune.occurrence_event', 'on', true);
  UPDATE public.recurring_bills SET archived_at = CASE WHEN p_archived THEN now() END,
      paused = paused OR p_archived, updated_at = now()
    WHERE id = p_id;
  PERFORM set_config('commune.occurrence_event', 'off', true);
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description, details)
    VALUES (v_bill.commune_id, v_actor, 'recurring', p_id, v_bill.title, CASE WHEN p_archived THEN 'Archived' ELSE 'Restored, still paused' END,
      jsonb_build_object('before', jsonb_build_object('paused', v_bill.paused, 'archived', v_bill.archived_at IS NOT NULL),
        'after', jsonb_build_object('paused', v_bill.paused OR p_archived, 'archived', p_archived)));
  RETURN commune_private.recurring_bill_result(p_id, false);
END;
$$;

-- 0022's command, refusing an archived bill by name.
CREATE OR REPLACE FUNCTION public.record_recurring_period(p_id uuid, p_expected_due_on date, p_amount_minor bigint DEFAULT NULL)
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
  IF v_bill.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This bill is archived. Restore and resume it before recording a period.' USING ERRCODE = 'P0001';
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

-- 0022's command, now refusing an archived bill, a period more than one
-- period ahead (a day's grace for time zones, as recording has), and more
-- than 12 skips of one bill in a day. A longer backlog is cleared by
-- editing the next due date, which stays possible.
CREATE OR REPLACE FUNCTION public.skip_recurring_period(p_id uuid, p_expected_due_on date, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_bill public.recurring_bills%ROWTYPE;
  v_done public.recurring_bill_occurrences%ROWTYPE;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_opens date;
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
  IF v_bill.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This bill is archived. Restore and resume it before skipping a period.' USING ERRCODE = 'P0001';
  END IF;
  IF v_bill.next_due_on IS DISTINCT FROM p_expected_due_on OR v_bill.paused THEN
    RAISE EXCEPTION 'This period has moved on or the bill is paused. Refresh the schedule.' USING ERRCODE = 'P0001';
  END IF;
  v_opens := CASE v_bill.frequency WHEN 'weekly' THEN v_bill.next_due_on - 7
    ELSE (v_bill.next_due_on - interval '1 month')::date END;
  IF v_opens > current_date + 1 THEN
    RAISE EXCEPTION 'It is too early to skip the % period. You can skip it from %.',
      to_char(v_bill.next_due_on, 'FMDD Mon YYYY'), to_char(v_opens, 'FMDD Mon YYYY') USING ERRCODE = 'P0001';
  END IF;
  IF length(v_reason) NOT BETWEEN 3 AND 240 THEN
    RAISE EXCEPTION 'Say why this period is skipped (3 to 240 characters)' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.recurring_bill_occurrences o
      WHERE o.bill_id = p_id AND o.status = 'skipped' AND o.acted_at > now() - interval '1 day') >= 12 THEN
    RAISE EXCEPTION 'This bill has had 12 periods skipped in the last day. To move it on further, edit its next due date.'
      USING ERRCODE = 'P0001';
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

-- The snapshot carries each bill's version and archive date. (The leave
-- check in manage_commune_member already passes over paused bills, and an
-- archived bill is always paused, so an archived bill never stops anyone
-- leaving without that function changing.)
DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('public.commune_snapshot(uuid)'::regprocedure);
  v_source := replace(v_original, '''paused'',b.paused,''createdBy'',b.created_by,',
    '''paused'',b.paused,''createdBy'',b.created_by,''version'',b.version,''archivedAt'',b.archived_at,');
  IF v_source = v_original OR position('''version'',b.version,''archivedAt'',b.archived_at' IN v_source) = 0 THEN
    RAISE EXCEPTION 'Unsupported snapshot definition';
  END IF;
  EXECUTE v_source;
END;
$$;

REVOKE ALL ON FUNCTION public.save_recurring_bill(uuid, text, bigint, text, jsonb, text, date, uuid, integer, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_recurring_bill(uuid, text, bigint, text, jsonb, text, date, uuid, integer, uuid, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.set_recurring_bill_paused(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_recurring_bill_paused(uuid, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.set_recurring_bill_archived(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_recurring_bill_archived(uuid, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
