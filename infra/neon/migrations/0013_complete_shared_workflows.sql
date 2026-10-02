-- Additive workflow completion. Apply after 0011 (verified request identity)
-- and 0012. Keep financial and membership history; never delete it to hide a
-- balance. Recurring bills are explicitly confirmed, not automatically paid.
BEGIN;

ALTER TABLE public.commune_members ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE public.commune_members ADD COLUMN left_at timestamptz;
ALTER TABLE public.expenses ADD COLUMN category text NOT NULL DEFAULT 'Other'
  CHECK (length(btrim(category)) BETWEEN 1 AND 40);
ALTER TABLE public.expenses ADD COLUMN recorded_by text;
UPDATE public.expenses SET recorded_by = paid_by_user_id;
ALTER TABLE public.expenses ALTER COLUMN recorded_by SET NOT NULL;
ALTER TABLE public.funds ADD COLUMN archived_at timestamptz;
ALTER TABLE public.fund_commitments ADD COLUMN cancelled_at timestamptz;
ALTER TABLE public.fund_contributions ADD COLUMN voided_at timestamptz;
ALTER TABLE public.fund_contributions ADD COLUMN voided_by text;
ALTER TABLE public.fund_contributions ADD COLUMN void_reason text;

CREATE OR REPLACE FUNCTION public.is_commune_member(p_commune_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.commune_members m WHERE m.commune_id = p_commune_id
    AND m.user_id = commune_private.data_api_user_id() AND m.active);
$$;
CREATE OR REPLACE FUNCTION public.is_commune_admin(p_commune_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.commune_members m WHERE m.commune_id = p_commune_id
    AND m.user_id = commune_private.data_api_user_id() AND m.active AND m.role = 'admin');
$$;

CREATE FUNCTION public.member_profiles_with_status(p_commune_id uuid)
RETURNS TABLE (id text, name text, email text, role text, active boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_commune_member(p_commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT m.user_id, coalesce(u.name, 'Former member'), u.email, m.role, m.active
    FROM public.commune_members m LEFT JOIN neon_auth."user" u ON u.id::text = m.user_id
    WHERE m.commune_id = p_commune_id ORDER BY m.joined_at;
END;
$$;

CREATE FUNCTION commune_private.validate_expense_split(p_commune_id uuid, p_amount bigint, p_shares jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_count integer; v_distinct integer; v_sum numeric;
BEGIN
  IF p_amount IS NULL OR p_amount NOT BETWEEN 1 AND 1000000000000
     OR jsonb_typeof(p_shares) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid expense amount or split' USING ERRCODE = '22023';
  END IF;
  SELECT count(*), count(DISTINCT s.user_id), sum(s.amount_minor)
    INTO v_count, v_distinct, v_sum FROM jsonb_to_recordset(p_shares) AS s(user_id text, amount_minor bigint);
  IF v_count NOT BETWEEN 1 AND 100 OR v_count <> v_distinct OR v_sum IS DISTINCT FROM p_amount
    OR EXISTS (SELECT 1 FROM jsonb_to_recordset(p_shares) AS s(user_id text, amount_minor bigint)
      WHERE s.amount_minor IS NULL OR s.amount_minor <= 0 OR NOT EXISTS (
        SELECT 1 FROM public.commune_members m WHERE m.commune_id = p_commune_id
          AND m.user_id = s.user_id AND m.active)) THEN
    RAISE EXCEPTION 'Shares must be positive, unique, belong to active members, and total the expense' USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION commune_private.validate_expense_split(uuid, bigint, jsonb) FROM PUBLIC;

CREATE FUNCTION commune_private.lock_fund_membership(p_fund_id uuid)
RETURNS void LANGUAGE sql SET search_path=public,pg_temp AS $$
  SELECT 1 FROM public.communes co JOIN public.funds f ON f.commune_id=co.id
    WHERE f.id=p_fund_id FOR UPDATE OF co;
$$;
REVOKE ALL ON FUNCTION commune_private.lock_fund_membership(uuid) FROM PUBLIC;

CREATE FUNCTION public.create_expense_for(p_commune_id uuid, p_title text, p_amount_minor bigint,
  p_shares jsonb, p_due_on date DEFAULT NULL, p_paid_by text DEFAULT NULL, p_category text DEFAULT 'Other')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor text := commune_private.data_api_user_id(); v_payer text := coalesce(p_paid_by, v_actor); v_id uuid;
BEGIN
  -- The commune lock serializes membership changes and split validation.
  PERFORM 1 FROM public.communes WHERE id = p_commune_id FOR UPDATE;
  IF NOT public.is_commune_member(p_commune_id) OR
    (v_payer <> v_actor AND NOT public.is_commune_admin(p_commune_id)) THEN
    RAISE EXCEPTION 'Only an admin can record an expense paid by another member' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.commune_members WHERE commune_id = p_commune_id AND user_id = v_payer AND active)
    OR length(btrim(coalesce(p_title, ''))) NOT BETWEEN 1 AND 80
    OR length(btrim(coalesce(p_category, ''))) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Invalid payer or expense details' USING ERRCODE = '22023';
  END IF;
  PERFORM commune_private.validate_expense_split(p_commune_id, p_amount_minor, p_shares);
  INSERT INTO public.expenses (commune_id, title, amount_minor, paid_by_user_id, recorded_by, category, due_on)
    VALUES (p_commune_id, btrim(p_title), p_amount_minor, v_payer, v_actor, btrim(p_category), p_due_on) RETURNING id INTO v_id;
  INSERT INTO public.expense_shares (expense_id, user_id, amount_minor, settled_minor, settled_at)
    SELECT v_id, s.user_id, s.amount_minor, CASE WHEN s.user_id = v_payer THEN s.amount_minor ELSE 0 END,
      CASE WHEN s.user_id = v_payer THEN now() ELSE NULL END
    FROM jsonb_to_recordset(p_shares) AS s(user_id text, amount_minor bigint);
  RETURN v_id;
END;
$$;
-- Preserve the old RPC for clients upgrading; route it through the same rules.
CREATE OR REPLACE FUNCTION public.create_expense(p_commune_id uuid, p_title text, p_amount_minor bigint, p_shares jsonb, p_due_on date DEFAULT NULL)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.create_expense_for(p_commune_id, p_title, p_amount_minor, p_shares, p_due_on);
$$;

CREATE FUNCTION public.update_fund(p_fund_id uuid, p_name text, p_target_minor bigint DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_commune uuid;
BEGIN
  PERFORM commune_private.lock_fund_membership(p_fund_id);
  SELECT commune_id INTO v_commune FROM public.funds WHERE id = p_fund_id FOR UPDATE;
  IF NOT public.is_commune_admin(v_commune) THEN RAISE EXCEPTION 'Only an admin can edit a fund' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_name, ''))) NOT BETWEEN 1 AND 80 OR (p_target_minor IS NOT NULL AND p_target_minor NOT BETWEEN 1 AND 1000000000000) THEN
    RAISE EXCEPTION 'Invalid fund details' USING ERRCODE = '22023'; END IF;
  UPDATE public.funds SET name = btrim(p_name), target_minor = p_target_minor WHERE id = p_fund_id;
END;
$$;
CREATE FUNCTION public.set_fund_archived(p_fund_id uuid, p_archived boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_commune uuid;
BEGIN
  PERFORM commune_private.lock_fund_membership(p_fund_id);
  SELECT commune_id INTO v_commune FROM public.funds WHERE id = p_fund_id FOR UPDATE;
  IF NOT public.is_commune_admin(v_commune) THEN RAISE EXCEPTION 'Only an admin can archive a fund' USING ERRCODE = '42501'; END IF;
  IF p_archived IS NULL THEN RAISE EXCEPTION 'Choose archive or restore' USING ERRCODE = '22023'; END IF;
  IF p_archived AND EXISTS (SELECT 1 FROM public.fund_commitments c WHERE c.fund_id = p_fund_id AND c.cancelled_at IS NULL
    AND c.amount_minor > (SELECT coalesce(sum(fc.amount_minor),0) FROM public.fund_contributions fc WHERE fc.commitment_id = c.id AND fc.voided_at IS NULL)) THEN
    RAISE EXCEPTION 'Resolve or cancel outstanding pledges before archiving this fund' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.funds SET archived_at = CASE WHEN p_archived THEN now() ELSE NULL END WHERE id = p_fund_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.pledge_fund(p_fund_id uuid, p_amount_minor bigint, p_due_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_commune uuid; v_archived timestamptz; v_id uuid; v_cancelled timestamptz;
BEGIN
  PERFORM commune_private.lock_fund_membership(p_fund_id);
  SELECT commune_id, archived_at INTO v_commune, v_archived FROM public.funds WHERE id = p_fund_id FOR UPDATE;
  IF NOT public.is_commune_member(v_commune) THEN RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501'; END IF;
  IF v_archived IS NOT NULL OR p_amount_minor IS NULL OR p_amount_minor NOT BETWEEN 1 AND 1000000000000 OR p_due_on IS NULL THEN
    RAISE EXCEPTION 'Invalid pledge or archived fund' USING ERRCODE = '22023'; END IF;
  SELECT id, cancelled_at INTO v_id, v_cancelled FROM public.fund_commitments WHERE fund_id = p_fund_id AND user_id = commune_private.data_api_user_id() FOR UPDATE;
  IF FOUND THEN
    IF v_cancelled IS NULL THEN RAISE EXCEPTION 'You already have a pledge; edit it instead' USING ERRCODE = 'P0001'; END IF;
    UPDATE public.fund_commitments SET amount_minor = p_amount_minor, due_on = p_due_on, cancelled_at = NULL WHERE id = v_id;
  ELSE
    INSERT INTO public.fund_commitments (fund_id,user_id,amount_minor,due_on) VALUES (p_fund_id,commune_private.data_api_user_id(),p_amount_minor,p_due_on) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;
CREATE FUNCTION public.update_fund_pledge(p_commitment_id uuid, p_amount_minor bigint, p_due_on date, p_cancel boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_row public.fund_commitments%ROWTYPE; v_commune uuid; v_archived timestamptz; v_paid bigint;
BEGIN
  -- Match fund -> pledge lock order used by pledge/archive/contribution.
  PERFORM commune_private.lock_fund_membership((SELECT fund_id FROM public.fund_commitments WHERE id=p_commitment_id));
  SELECT f.commune_id, f.archived_at INTO v_commune, v_archived FROM public.funds f
    JOIN public.fund_commitments c ON c.fund_id = f.id WHERE c.id = p_commitment_id FOR UPDATE OF f;
  SELECT * INTO v_row FROM public.fund_commitments WHERE id = p_commitment_id FOR UPDATE;
  IF v_row.id IS NULL OR NOT public.is_commune_member(v_commune) OR
    (v_row.user_id <> commune_private.data_api_user_id() AND NOT public.is_commune_admin(v_commune)) THEN
    RAISE EXCEPTION 'Only the pledger or an admin can change this pledge' USING ERRCODE = '42501'; END IF;
  SELECT coalesce(sum(amount_minor),0) INTO v_paid FROM public.fund_contributions WHERE commitment_id = p_commitment_id AND voided_at IS NULL;
  IF p_cancel IS TRUE THEN
    IF v_paid > 0 THEN RAISE EXCEPTION 'A contributed pledge cannot be cancelled; change its total or correct the contribution first' USING ERRCODE = 'P0001'; END IF;
    UPDATE public.fund_commitments SET cancelled_at = now() WHERE id = p_commitment_id;
  ELSE
    IF v_archived IS NOT NULL OR v_row.cancelled_at IS NOT NULL OR p_amount_minor IS NULL OR p_amount_minor NOT BETWEEN 1 AND 1000000000000 OR p_amount_minor < v_paid OR p_due_on IS NULL THEN
      RAISE EXCEPTION 'Pledge must cover recorded contributions and belong to an active fund' USING ERRCODE = '22023'; END IF;
    UPDATE public.fund_commitments SET amount_minor = p_amount_minor, due_on = p_due_on WHERE id = p_commitment_id;
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.record_fund_contribution(p_commitment_id uuid, p_amount_minor bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_row public.fund_commitments%ROWTYPE; v_commune uuid; v_archived timestamptz; v_paid bigint; v_id uuid;
BEGIN
  PERFORM commune_private.lock_fund_membership((SELECT fund_id FROM public.fund_commitments WHERE id=p_commitment_id));
  SELECT f.commune_id,f.archived_at INTO v_commune,v_archived FROM public.funds f JOIN public.fund_commitments c ON c.fund_id=f.id WHERE c.id=p_commitment_id FOR UPDATE OF f;
  SELECT * INTO v_row FROM public.fund_commitments WHERE id=p_commitment_id FOR UPDATE;
  IF NOT public.is_commune_admin(v_commune) THEN RAISE EXCEPTION 'Only an admin can confirm a contribution' USING ERRCODE = '42501'; END IF;
  SELECT coalesce(sum(amount_minor),0) INTO v_paid FROM public.fund_contributions WHERE commitment_id=p_commitment_id AND voided_at IS NULL;
  IF v_row.id IS NULL OR v_row.cancelled_at IS NOT NULL OR v_archived IS NOT NULL OR p_amount_minor IS NULL OR p_amount_minor <= 0 OR v_paid+p_amount_minor > v_row.amount_minor THEN
    RAISE EXCEPTION 'Contribution exceeds the active outstanding pledge' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.fund_contributions (commitment_id,amount_minor,recorded_by) VALUES (p_commitment_id,p_amount_minor,commune_private.data_api_user_id()) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
CREATE FUNCTION public.void_fund_contribution(p_contribution_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_commune uuid; v_commitment uuid; v_archived timestamptz;
BEGIN
  PERFORM commune_private.lock_fund_membership((SELECT c.fund_id FROM public.fund_contributions fc JOIN public.fund_commitments c ON c.id=fc.commitment_id WHERE fc.id=p_contribution_id));
  SELECT f.commune_id,fc.commitment_id,f.archived_at INTO v_commune,v_commitment,v_archived FROM public.fund_contributions fc
    JOIN public.fund_commitments c ON c.id=fc.commitment_id JOIN public.funds f ON f.id=c.fund_id WHERE fc.id=p_contribution_id FOR UPDATE OF f;
  IF NOT public.is_commune_admin(v_commune) THEN RAISE EXCEPTION 'Only an admin can correct a contribution' USING ERRCODE = '42501'; END IF;
  IF v_archived IS NOT NULL OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 240 THEN
    RAISE EXCEPTION 'Restore the fund and enter a correction reason (3 to 240 characters)' USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.fund_commitments WHERE id=v_commitment FOR UPDATE;
  -- A new debt cannot be reintroduced after the member has left.
  IF NOT EXISTS (SELECT 1 FROM public.fund_commitments c JOIN public.commune_members m ON m.user_id=c.user_id
    WHERE c.id=v_commitment AND m.commune_id=v_commune AND m.active) THEN
    RAISE EXCEPTION 'Cannot reopen an obligation for a former member' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.fund_contributions SET voided_at=now(), voided_by=commune_private.data_api_user_id(),void_reason=btrim(p_reason)
    WHERE id=p_contribution_id AND voided_at IS NULL;
END;
$$;

CREATE TABLE public.recurring_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), commune_id uuid NOT NULL REFERENCES public.communes(id),
  title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 80), amount_minor bigint NOT NULL CHECK(amount_minor BETWEEN 1 AND 1000000000000),
  paid_by_user_id text NOT NULL, shares jsonb NOT NULL CHECK(jsonb_typeof(shares)='array'),
  frequency text NOT NULL CHECK(frequency IN ('weekly','monthly')), next_due_on date NOT NULL,
  anchor_day integer NOT NULL CHECK(anchor_day BETWEEN 1 AND 31), paused boolean NOT NULL DEFAULT false,
  created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(commune_id,paid_by_user_id) REFERENCES public.commune_members(commune_id,user_id)
);
CREATE INDEX recurring_bills_commune_idx ON public.recurring_bills(commune_id,next_due_on);
CREATE TABLE public.recurring_bill_occurrences (
  bill_id uuid NOT NULL REFERENCES public.recurring_bills(id), due_on date NOT NULL,
  expense_id uuid NOT NULL REFERENCES public.expenses(id), PRIMARY KEY(bill_id,due_on)
);
ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_bill_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY recurring_read ON public.recurring_bills FOR SELECT TO authenticated USING(public.is_commune_member(commune_id));
CREATE POLICY occurrence_read ON public.recurring_bill_occurrences FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.recurring_bills b WHERE b.id=bill_id AND public.is_commune_member(b.commune_id)));
GRANT SELECT ON public.recurring_bills,public.recurring_bill_occurrences TO authenticated;

CREATE FUNCTION public.save_recurring_bill(p_commune_id uuid,p_title text,p_amount_minor bigint,p_paid_by text,p_shares jsonb,p_frequency text,p_next_due_on date,p_paused boolean DEFAULT false,p_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_id uuid; v_existing public.recurring_bills%ROWTYPE; v_actor text:=commune_private.data_api_user_id();
BEGIN
  PERFORM 1 FROM public.communes WHERE id=p_commune_id FOR UPDATE;
  IF NOT public.is_commune_member(p_commune_id) OR (p_paid_by IS DISTINCT FROM v_actor AND NOT public.is_commune_admin(p_commune_id)) THEN
    RAISE EXCEPTION 'Only an admin can schedule another member as payer' USING ERRCODE='42501'; END IF;
  IF p_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.recurring_bills WHERE id=p_id FOR UPDATE;
    IF NOT FOUND OR v_existing.commune_id<>p_commune_id OR (v_existing.created_by<>v_actor AND NOT public.is_commune_admin(p_commune_id)) THEN
      RAISE EXCEPTION 'Only the creator or an admin can edit this recurring bill' USING ERRCODE='42501'; END IF;
  END IF;
  IF length(btrim(coalesce(p_title,''))) NOT BETWEEN 1 AND 80 OR p_frequency IS NULL OR p_frequency NOT IN ('weekly','monthly') OR p_next_due_on IS NULL OR p_paused IS NULL OR
    NOT EXISTS(SELECT 1 FROM public.commune_members WHERE commune_id=p_commune_id AND user_id=p_paid_by AND active) THEN
    RAISE EXCEPTION 'Invalid recurring bill' USING ERRCODE='22023'; END IF;
  PERFORM commune_private.validate_expense_split(p_commune_id,p_amount_minor,p_shares);
  IF p_id IS NULL THEN
    INSERT INTO public.recurring_bills(commune_id,title,amount_minor,paid_by_user_id,shares,frequency,next_due_on,anchor_day,paused,created_by)
      VALUES(p_commune_id,btrim(p_title),p_amount_minor,p_paid_by,p_shares,p_frequency,p_next_due_on,extract(day FROM p_next_due_on),p_paused,v_actor) RETURNING id INTO v_id;
  ELSE
    UPDATE public.recurring_bills SET title=btrim(p_title),amount_minor=p_amount_minor,paid_by_user_id=p_paid_by,shares=p_shares,frequency=p_frequency,next_due_on=p_next_due_on,
      anchor_day=CASE WHEN next_due_on=p_next_due_on AND frequency=p_frequency THEN anchor_day ELSE extract(day FROM p_next_due_on) END,paused=p_paused,updated_at=now() WHERE id=p_id RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;
CREATE FUNCTION public.record_recurring_bill(p_id uuid,p_expected_due_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_bill public.recurring_bills%ROWTYPE; v_id uuid; v_next date; v_month date;
BEGIN
  PERFORM 1 FROM public.communes co JOIN public.recurring_bills b ON b.commune_id=co.id WHERE b.id=p_id FOR UPDATE OF co;
  SELECT * INTO v_bill FROM public.recurring_bills WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_commune_member(v_bill.commune_id) OR
    (v_bill.paid_by_user_id<>commune_private.data_api_user_id() AND NOT public.is_commune_admin(v_bill.commune_id)) THEN
    RAISE EXCEPTION 'Only the payer or an admin can record this bill' USING ERRCODE='42501'; END IF;
  IF v_bill.next_due_on IS DISTINCT FROM p_expected_due_on OR v_bill.paused OR v_bill.next_due_on>current_date THEN
    RAISE EXCEPTION 'This bill is not due, is paused, or has already been recorded. Refresh the schedule.' USING ERRCODE='P0001'; END IF;
  v_id:=public.create_expense_for(v_bill.commune_id,v_bill.title,v_bill.amount_minor,v_bill.shares,v_bill.next_due_on,v_bill.paid_by_user_id,'Bills');
  INSERT INTO public.recurring_bill_occurrences(bill_id,due_on,expense_id) VALUES(p_id,v_bill.next_due_on,v_id);
  IF v_bill.frequency='weekly' THEN v_next:=v_bill.next_due_on+7;
  ELSE
    v_month:=(date_trunc('month',v_bill.next_due_on)+interval '1 month')::date;
    v_next:=v_month+(least(v_bill.anchor_day,extract(day FROM (v_month+interval '1 month - 1 day'))::integer)-1);
  END IF;
  UPDATE public.recurring_bills SET next_due_on=v_next,updated_at=now() WHERE id=p_id;
  RETURN v_id;
END;
$$;

CREATE TABLE public.split_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), commune_id uuid NOT NULL REFERENCES public.communes(id),
  name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 60), method text NOT NULL CHECK(method IN ('Equal','Exact','Percentage','Shares')),
  participants jsonb NOT NULL CHECK(jsonb_typeof(participants)='array'),created_by text NOT NULL,
  archived_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX split_templates_commune_idx ON public.split_templates(commune_id);
ALTER TABLE public.split_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY template_read ON public.split_templates FOR SELECT TO authenticated USING(public.is_commune_member(commune_id));
GRANT SELECT ON public.split_templates TO authenticated;
CREATE FUNCTION public.save_split_template(p_commune_id uuid,p_name text,p_method text,p_participants jsonb,p_id uuid DEFAULT NULL,p_archived boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid; v_actor text:=commune_private.data_api_user_id(); v_existing public.split_templates%ROWTYPE; v_count integer; v_distinct integer;
BEGIN
  PERFORM 1 FROM public.communes WHERE id=p_commune_id FOR UPDATE;
  IF NOT public.is_commune_member(p_commune_id) THEN RAISE EXCEPTION 'Not a commune member' USING ERRCODE='42501'; END IF;
  IF p_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.split_templates WHERE id=p_id FOR UPDATE;
    IF NOT FOUND OR v_existing.commune_id<>p_commune_id OR (v_existing.created_by<>v_actor AND NOT public.is_commune_admin(p_commune_id)) THEN
      RAISE EXCEPTION 'Only the creator or an admin can edit this template' USING ERRCODE='42501'; END IF;
    IF p_archived IS TRUE THEN
      UPDATE public.split_templates SET archived_at=now() WHERE id=p_id;
      RETURN p_id;
    END IF;
  END IF;
  IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 1 AND 60 OR p_method IS NULL OR p_method NOT IN ('Equal','Exact','Percentage','Shares') OR p_archived IS NULL OR jsonb_typeof(p_participants) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid split template' USING ERRCODE='22023'; END IF;
  SELECT count(*),count(DISTINCT s.user_id) INTO v_count,v_distinct FROM jsonb_to_recordset(p_participants) AS s(user_id text,value text);
  IF v_count NOT BETWEEN 1 AND 100 OR v_count<>v_distinct OR EXISTS(SELECT 1 FROM jsonb_to_recordset(p_participants) AS s(user_id text,value text)
    WHERE length(coalesce(s.value,''))>20 OR NOT EXISTS(SELECT 1 FROM public.commune_members m WHERE m.commune_id=p_commune_id AND m.user_id=s.user_id AND m.active)) THEN
    RAISE EXCEPTION 'Choose unique active members for this template' USING ERRCODE='22023'; END IF;
  IF p_method<>'Equal' THEN
    IF EXISTS(SELECT 1 FROM jsonb_to_recordset(p_participants) AS s(user_id text,value text)
      WHERE coalesce(s.value,'') !~ CASE WHEN p_method='Shares' THEN '^[0-9]+$' ELSE '^[0-9]+(\.[0-9]{1,2})?$' END) THEN
      RAISE EXCEPTION 'Enter valid split values for every participant' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_to_recordset(p_participants) AS s(user_id text,value text) WHERE s.value::numeric<=0) OR
      (p_method='Percentage' AND (SELECT sum(s.value::numeric) FROM jsonb_to_recordset(p_participants) AS s(user_id text,value text))<>100) THEN
      RAISE EXCEPTION 'Split values must be positive and percentages total 100' USING ERRCODE='22023'; END IF;
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.split_templates(commune_id,name,method,participants,created_by) VALUES(p_commune_id,btrim(p_name),p_method,p_participants,v_actor) RETURNING id INTO v_id;
  ELSE
    UPDATE public.split_templates SET name=btrim(p_name),method=p_method,participants=p_participants,archived_at=CASE WHEN p_archived THEN now() ELSE NULL END WHERE id=p_id RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.manage_commune_member(p_commune_id uuid,p_user_id text,p_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor text:=commune_private.data_api_user_id(); v_member public.commune_members%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.communes WHERE id=p_commune_id FOR UPDATE;
  SELECT * INTO v_member FROM public.commune_members WHERE commune_id=p_commune_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR NOT v_member.active OR NOT public.is_commune_member(p_commune_id) OR
    (NOT public.is_commune_admin(p_commune_id) AND NOT (p_user_id=v_actor AND p_action='leave')) THEN
    RAISE EXCEPTION 'Only an admin can change other members' USING ERRCODE='42501'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('admin','member','leave','remove') OR (p_action='leave' AND p_user_id<>v_actor) THEN
    RAISE EXCEPTION 'Invalid membership action' USING ERRCODE='22023'; END IF;
  IF v_member.role='admin' AND p_action<>'admin' AND NOT EXISTS(SELECT 1 FROM public.commune_members WHERE commune_id=p_commune_id AND active AND role='admin' AND user_id<>p_user_id) THEN
    RAISE EXCEPTION 'Keep at least one admin. Promote another member first.' USING ERRCODE='P0001'; END IF;
  IF p_action IN ('leave','remove') THEN
    IF EXISTS(SELECT 1 FROM public.expense_shares s JOIN public.expenses e ON e.id=s.expense_id WHERE e.commune_id=p_commune_id AND s.settled_minor<s.amount_minor AND (s.user_id=p_user_id OR e.paid_by_user_id=p_user_id)) OR
      EXISTS(SELECT 1 FROM public.fund_commitments c JOIN public.funds f ON f.id=c.fund_id WHERE f.commune_id=p_commune_id AND c.user_id=p_user_id AND c.cancelled_at IS NULL AND c.amount_minor>(SELECT coalesce(sum(fc.amount_minor),0) FROM public.fund_contributions fc WHERE fc.commitment_id=c.id AND fc.voided_at IS NULL)) THEN
      RAISE EXCEPTION 'Resolve outstanding shares and pledges before this member leaves' USING ERRCODE='P0001'; END IF;
    IF EXISTS(SELECT 1 FROM public.recurring_bills b WHERE b.commune_id=p_commune_id AND NOT b.paused AND (b.paid_by_user_id=p_user_id OR EXISTS(SELECT 1 FROM jsonb_array_elements(b.shares) s WHERE s->>'user_id'=p_user_id))) THEN
      RAISE EXCEPTION 'Pause or update recurring bills that include this member first' USING ERRCODE='P0001'; END IF;
    UPDATE public.commune_members SET active=false,left_at=now() WHERE commune_id=p_commune_id AND user_id=p_user_id;
  ELSE
    UPDATE public.commune_members SET role=p_action WHERE commune_id=p_commune_id AND user_id=p_user_id;
  END IF;
END;
$$;

-- Re-invitations reactivate the historical membership row rather than breaking
-- foreign keys from old expenses. An active member cannot accept a stale role.
CREATE OR REPLACE FUNCTION public.create_commune_invite(p_commune_id uuid,p_email text,p_role text DEFAULT 'member')
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_email text:=lower(btrim(coalesce(p_email,'')));v_token text;
BEGIN
  PERFORM 1 FROM public.communes WHERE id=p_commune_id FOR UPDATE;
  IF NOT public.is_commune_admin(p_commune_id) THEN RAISE EXCEPTION 'Only an admin can invite members' USING ERRCODE='42501'; END IF;
  IF length(v_email)>254 OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' OR p_role IS NULL OR p_role NOT IN ('admin','member') THEN
    RAISE EXCEPTION 'Invalid invite details' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.commune_members m JOIN neon_auth."user" u ON u.id::text=m.user_id WHERE m.commune_id=p_commune_id AND m.active AND lower(u.email)=v_email) THEN
    RAISE EXCEPTION 'This person is already a member' USING ERRCODE='P0001'; END IF;
  UPDATE public.commune_invites SET revoked_at=now() WHERE commune_id=p_commune_id AND email=v_email AND accepted_at IS NULL AND revoked_at IS NULL;
  v_token:=encode(gen_random_bytes(32),'hex');
  INSERT INTO public.commune_invites(commune_id,email,role,token_hash,invited_by) VALUES(p_commune_id,v_email,p_role,digest(v_token,'sha256'),commune_private.data_api_user_id());
  RETURN v_token;
END;
$$;
CREATE OR REPLACE FUNCTION public.accept_commune_invite(p_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_invite public.commune_invites%ROWTYPE;v_actor text:=commune_private.data_api_user_id();v_email text;
BEGIN
  SELECT lower(email) INTO v_email FROM neon_auth."user" WHERE id::text=v_actor AND "emailVerified" IS TRUE;
  IF v_email IS NULL OR p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invite unavailable for this verified account' USING ERRCODE='42501'; END IF;
  -- Use the same commune -> invitation order as invitation creation.
  PERFORM 1 FROM public.communes co JOIN public.commune_invites i ON i.commune_id=co.id WHERE i.token_hash=digest(p_token,'sha256') FOR UPDATE OF co;
  SELECT * INTO v_invite FROM public.commune_invites WHERE token_hash=digest(p_token,'sha256') FOR UPDATE;
  IF NOT FOUND OR v_invite.email<>v_email OR v_invite.expires_at<=now() OR v_invite.accepted_at IS NOT NULL OR v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite unavailable for this verified account' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.commune_members WHERE commune_id=v_invite.commune_id AND user_id=v_actor AND active) THEN
    RAISE EXCEPTION 'Already a member of this commune' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.commune_members(commune_id,user_id,role) VALUES(v_invite.commune_id,v_actor,v_invite.role)
    ON CONFLICT(commune_id,user_id) DO UPDATE SET role=excluded.role,active=true,left_at=NULL,joined_at=now();
  UPDATE public.commune_invites SET accepted_at=now(),accepted_by=v_actor WHERE id=v_invite.id;
  RETURN v_invite.commune_id;
END;
$$;

-- Extend the audited reminder functions without changing their quota/cooldown
-- logic. Assert source matches, so incompatible installations fail atomically.
DO $$
DECLARE v_source text;v_original text;
BEGIN
  v_original:=pg_get_functiondef('public.list_reminder_targets(uuid)'::regprocedure);
  v_source:=replace(v_original,'AND s.settled_minor < s.amount_minor','AND m.active AND s.settled_minor < s.amount_minor');
  v_source:=replace(v_source,'FROM public.fund_contributions fc WHERE fc.commitment_id = c.id','FROM public.fund_contributions fc WHERE fc.commitment_id = c.id AND fc.voided_at IS NULL');
  v_source:=replace(v_source,'AND c.due_on <= current_date','AND m.active AND f.archived_at IS NULL AND c.cancelled_at IS NULL AND c.due_on <= current_date');
  IF v_source=v_original OR position('fc.voided_at IS NULL' IN v_source)=0 THEN RAISE EXCEPTION 'Unsupported reminder target definition'; END IF;
  EXECUTE v_source;
  v_original:=pg_get_functiondef('public.send_reminder(text,uuid)'::regprocedure);
  v_source:=replace(v_original,'WHERE c.id = p_source_id FOR UPDATE OF c','WHERE c.id = p_source_id AND c.cancelled_at IS NULL AND f.archived_at IS NULL FOR UPDATE OF c');
  v_source:=replace(v_source,'LEFT JOIN public.fund_contributions fc ON fc.commitment_id = c.id','LEFT JOIN public.fund_contributions fc ON fc.commitment_id = c.id AND fc.voided_at IS NULL');
  v_source:=replace(v_source,'AND m.user_id = v_recipient','AND m.user_id = v_recipient AND m.active');
  v_source:=replace(v_source,'IF v_recipient = v_sender OR v_amount IS NULL OR v_amount <= 0','IF NOT public.is_commune_member(v_commune_id) OR v_recipient = v_sender OR v_amount IS NULL OR v_amount <= 0');
  IF v_source=v_original OR position('fc.voided_at IS NULL' IN v_source)=0 OR position('c.cancelled_at IS NULL' IN v_source)=0 THEN RAISE EXCEPTION 'Unsupported reminder sender definition'; END IF;
  EXECUTE v_source;
END;
$$;

-- Append-only change history. Credentials/private note bodies are deliberately
-- excluded; financial edits retain before/after values for accountability.
CREATE TABLE public.commune_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),commune_id uuid NOT NULL REFERENCES public.communes(id) ON DELETE CASCADE,
  actor_id text NOT NULL,kind text NOT NULL,entity_id uuid NOT NULL,title text NOT NULL,
  description text NOT NULL,details jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX commune_events_recent_idx ON public.commune_events(commune_id,created_at DESC);
ALTER TABLE public.commune_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_read ON public.commune_events FOR SELECT TO authenticated USING(public.is_commune_member(commune_id));
GRANT SELECT ON public.commune_events TO authenticated;
CREATE FUNCTION commune_private.record_commune_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_commune uuid;v_title text;v_entity uuid;v_kind text;v_description text;v_details jsonb:='{}';
BEGIN
  v_kind:=CASE TG_TABLE_NAME WHEN 'fund_commitments' THEN 'funds' WHEN 'fund_contributions' THEN 'funds' WHEN 'commune_members' THEN 'members'
    WHEN 'recurring_bills' THEN 'recurring' WHEN 'split_templates' THEN 'templates' WHEN 'commune_notes' THEN 'notes' WHEN 'commune_operations' THEN 'operations' WHEN 'expense_shares' THEN 'expenses' ELSE 'funds' END;
  IF TG_TABLE_NAME='fund_commitments' THEN
    SELECT f.commune_id,f.name INTO v_commune,v_title FROM public.funds f WHERE f.id=NEW.fund_id;v_entity:=NEW.fund_id;
    v_description:=CASE WHEN TG_OP='INSERT' THEN 'Pledge made' WHEN NEW.cancelled_at IS NOT NULL THEN 'Pledge cancelled' ELSE 'Pledge updated' END;
  ELSIF TG_TABLE_NAME='fund_contributions' THEN
    SELECT f.commune_id,f.name,f.id INTO v_commune,v_title,v_entity FROM public.fund_commitments c JOIN public.funds f ON f.id=c.fund_id WHERE c.id=NEW.commitment_id;
    v_description:=CASE WHEN NEW.voided_at IS NOT NULL THEN 'Contribution corrected' ELSE 'Contribution recorded' END;
  ELSIF TG_TABLE_NAME='commune_members' THEN
    v_commune:=NEW.commune_id;v_entity:=NEW.commune_id;
    SELECT coalesce(u.name,'Member') INTO v_title FROM neon_auth."user" u WHERE u.id::text=NEW.user_id;
    v_description:=CASE WHEN NOT NEW.active THEN 'Membership ended' WHEN TG_OP='INSERT' THEN 'Joined the commune' ELSE 'Membership updated' END;
  ELSIF TG_TABLE_NAME='expense_shares' THEN
    IF NEW.settled_minor=OLD.settled_minor THEN RETURN NEW; END IF;
    SELECT e.commune_id,e.title,e.id INTO v_commune,v_title,v_entity FROM public.expenses e WHERE e.id=NEW.expense_id;v_description:='Share confirmed received';
  ELSE
    v_commune:=NEW.commune_id;v_entity:=NEW.id;
    IF TG_TABLE_NAME IN ('funds','split_templates') THEN v_title:=NEW.name;
    ELSE v_title:=NEW.title; END IF;
    v_description:=CASE WHEN TG_OP='INSERT' THEN 'Created' ELSE 'Updated' END;
  END IF;
  IF TG_TABLE_NAME NOT IN ('commune_notes','commune_operations') THEN
    v_details:=jsonb_build_object('before',CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,'after',to_jsonb(NEW));
  END IF;
  INSERT INTO public.commune_events(commune_id,actor_id,kind,entity_id,title,description,details)
    VALUES(v_commune,commune_private.data_api_user_id(),v_kind,v_entity,coalesce(v_title,'Shared record'),v_description,v_details);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION commune_private.record_commune_change() FROM PUBLIC;
DO $$ DECLARE v_table text;BEGIN
  FOREACH v_table IN ARRAY ARRAY['funds','fund_commitments','fund_contributions','commune_members','recurring_bills','split_templates','commune_notes','commune_operations'] LOOP
    EXECUTE format('CREATE TRIGGER commune_change AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION commune_private.record_commune_change()',v_table);
  END LOOP;
END;$$;
CREATE TRIGGER commune_share_change AFTER UPDATE ON public.expense_shares FOR EACH ROW EXECUTE FUNCTION commune_private.record_commune_change();

-- One authenticated, scoped read replaces the browser's multi-round-trip
-- snapshot waterfall. The guard is mandatory because this function is definer.
CREATE FUNCTION public.commune_snapshot(p_commune_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor text:=commune_private.data_api_user_id();v_result jsonb;
BEGIN
  IF NOT public.is_commune_member(p_commune_id) THEN RAISE EXCEPTION 'Not a commune member' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object(
    'commune',jsonb_build_object('id',co.id,'name',co.name,'kind',co.kind,'currency',co.currency,'address',co.address,'destination',co.destination,'stayName',co.stay_name,'stayAddress',co.stay_address,'role',m.role,
      'memberCount',(SELECT count(*) FROM public.commune_members cm WHERE cm.commune_id=co.id AND cm.active)),
    'members',coalesce((SELECT jsonb_agg(jsonb_build_object('userId',mp.id,'name',mp.name,'email',mp.email,'role',mp.role,'active',mp.active)) FROM public.member_profiles_with_status(co.id) mp),'[]'::jsonb),
    'expenses',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'category',e.category,'amountMinor',e.amount_minor,'paidByUserId',e.paid_by_user_id,'dueOn',e.due_on,'createdAt',e.created_at,
      'recurring',EXISTS(SELECT 1 FROM public.recurring_bill_occurrences o WHERE o.expense_id=e.id),
      'shares',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'userId',s.user_id,'amountMinor',s.amount_minor,'settledMinor',s.settled_minor) ORDER BY s.user_id) FROM public.expense_shares s WHERE s.expense_id=e.id),'[]'::jsonb)) ORDER BY e.created_at DESC) FROM public.expenses e WHERE e.commune_id=co.id),'[]'::jsonb),
    'funds',coalesce((SELECT jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'targetMinor',f.target_minor,'createdBy',f.created_by,'archivedAt',f.archived_at,
      'commitments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'userId',c.user_id,'amountMinor',c.amount_minor,'dueOn',c.due_on,'cancelledAt',c.cancelled_at,
        'contributedMinor',(SELECT coalesce(sum(fc.amount_minor),0) FROM public.fund_contributions fc WHERE fc.commitment_id=c.id AND fc.voided_at IS NULL),
        'contributions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',fc.id,'amountMinor',fc.amount_minor,'contributedAt',fc.contributed_at,'voidedAt',fc.voided_at,'voidReason',fc.void_reason) ORDER BY fc.contributed_at DESC) FROM public.fund_contributions fc WHERE fc.commitment_id=c.id),'[]'::jsonb)) ORDER BY c.created_at) FROM public.fund_commitments c WHERE c.fund_id=f.id),'[]'::jsonb)) ORDER BY f.created_at DESC) FROM public.funds f WHERE f.commune_id=co.id),'[]'::jsonb),
    'notifications',coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'communeId',n.commune_id,'kind',r.kind,'sourceId',r.source_id,'amountMinor',r.amount_minor,'senderUserId',r.sender_user_id,'createdAt',n.created_at,'readAt',n.read_at) ORDER BY n.created_at DESC) FROM public.notifications n JOIN public.reminders r ON r.id=n.reminder_id WHERE n.commune_id=co.id AND n.recipient_user_id=v_actor),'[]'::jsonb),
    'reminderTargets',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',rt.kind,'sourceId',rt.source_id,'recipientUserId',rt.recipient_user_id,'amountMinor',rt.amount_minor,'currency',rt.currency,'label',rt.label,'dueOn',rt.due_on,'lastSentAt',rt.last_sent_at)) FROM public.list_reminder_targets(co.id) rt),'[]'::jsonb),
    'notes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'title',n.title,'pill',n.pill,'kicker',n.kicker,'lede',n.lede,'body',n.body,'facts',n.facts) ORDER BY n.created_at DESC) FROM public.commune_notes n WHERE n.commune_id=co.id),'[]'::jsonb),
    'operations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.id,'hubId',o.commune_id,'kind',o.kind,'category',o.category,'title',o.title,'date',o.date,'time',o.time,'allDay',o.all_day,'assignee',o.assignee,'rotation',o.rotation,'lastDone',o.last_done,'repeat',o.repeat,'status',o.status,'notes',o.notes) ORDER BY o.date,o.time) FROM public.commune_operations o WHERE o.commune_id=co.id),'[]'::jsonb),
    'recurringBills',coalesce((SELECT jsonb_agg(jsonb_build_object('id',b.id,'title',b.title,'amountMinor',b.amount_minor,'paidByUserId',b.paid_by_user_id,'allocations',(SELECT jsonb_agg(jsonb_build_object('userId',s->>'user_id','amountMinor',(s->>'amount_minor')::bigint)) FROM jsonb_array_elements(b.shares) s),'frequency',b.frequency,'nextDueOn',b.next_due_on,'paused',b.paused,'createdBy',b.created_by) ORDER BY b.next_due_on) FROM public.recurring_bills b WHERE b.commune_id=co.id),'[]'::jsonb),
    'splitTemplates',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'method',t.method,'participants',(SELECT jsonb_agg(jsonb_build_object('userId',p->>'user_id','value',coalesce(p->>'value',''))) FROM jsonb_array_elements(t.participants) p),'createdBy',t.created_by,'archivedAt',t.archived_at) ORDER BY t.created_at DESC) FROM public.split_templates t WHERE t.commune_id=co.id),'[]'::jsonb),
    'activityEvents',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'actorId',a.actor_id,'kind',a.kind,'entityId',a.entity_id,'title',a.title,'description',a.description,'createdAt',a.created_at) ORDER BY a.created_at DESC) FROM (SELECT * FROM public.commune_events ev WHERE ev.commune_id=co.id ORDER BY ev.created_at DESC LIMIT 100) a),'[]'::jsonb)
  ) INTO v_result FROM public.communes co JOIN public.commune_members m ON m.commune_id=co.id AND m.user_id=v_actor AND m.active WHERE co.id=p_commune_id;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Commune not found' USING ERRCODE='42501'; END IF;
  RETURN v_result;
END;
$$;

-- New RPCs are opt-in, never exposed to PUBLIC/anonymous clients.
DO $$ DECLARE v_signature text; BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.member_profiles_with_status(uuid)',
    'public.commune_snapshot(uuid)',
    'public.create_expense_for(uuid,text,bigint,jsonb,date,text,text)',
    'public.update_fund(uuid,text,bigint)','public.set_fund_archived(uuid,boolean)',
    'public.update_fund_pledge(uuid,bigint,date,boolean)','public.void_fund_contribution(uuid,text)',
    'public.save_recurring_bill(uuid,text,bigint,text,jsonb,text,date,boolean,uuid)',
    'public.record_recurring_bill(uuid,date)','public.save_split_template(uuid,text,text,jsonb,uuid,boolean)',
    'public.manage_commune_member(uuid,text,text)'
  ] LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION '||v_signature||' FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION '||v_signature||' TO authenticated';
  END LOOP;
END; $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
