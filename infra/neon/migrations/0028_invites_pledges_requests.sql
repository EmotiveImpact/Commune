-- Invitations that follow their sender, pledges that belong to the pledger,
-- and retry-safe create commands.
-- 1. An open invitation is only as good as the admin who sent it. When an
--    admin leaves, is removed or becomes a member, the invitations they sent
--    that are still open are revoked. An invitation whose sender is no longer
--    an active admin cannot be previewed or accepted, and the admin list
--    shows who sent each one.
-- 2. Expenses, funds, pledges and contributions are created through commands
--    that take a request id. A retry returns the record it already created;
--    the same id for a different change is refused. The older RPCs keep their
--    signatures for clients that do not send an id.
-- 3. Someone other than the pledger (an admin) can lower a pledge, never below
--    what is already recorded, move its due date later, or cancel it. Only the
--    pledger can raise it or bring the date forward. The pledger is told about
--    a change someone else makes. A change can name the amount and date it
--    was based on, and is refused if the pledge has changed since.
-- Apply after 0027 (it depends on nothing after 0025). Release with the
-- matching web client.
BEGIN;

-- 1. Invitations -------------------------------------------------------------

-- Revokes the still-open invitations (in one commune, or in every commune when
-- p_commune_id is null) whose sender is no longer an active admin there.
-- Expired ones are left as they are: they can no longer be accepted.
CREATE FUNCTION commune_private.revoke_orphaned_invites(p_commune_id uuid)
RETURNS integer LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.commune_invites i SET revoked_at = now()
    WHERE (p_commune_id IS NULL OR i.commune_id = p_commune_id)
      AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
      AND NOT EXISTS (SELECT 1 FROM public.commune_members m WHERE m.commune_id = i.commune_id
        AND m.user_id = i.invited_by AND m.active AND m.role = 'admin');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION commune_private.revoke_orphaned_invites(uuid) FROM PUBLIC;

-- Invitations already left open by an admin who has gone or been demoted.
DO $$ BEGIN PERFORM commune_private.revoke_orphaned_invites(NULL); END $$;

-- Membership ends, or an admin becomes a member: their open invitations go
-- with it. Only the two final updates are extended, so the checks above them
-- (outstanding money, recurring bills, the last admin) stay as they are.
DO $$
DECLARE v_source text; v_original text;
BEGIN
  v_original := pg_get_functiondef('public.manage_commune_member(uuid,text,text)'::regprocedure);
  v_source := replace(v_original,
    'UPDATE public.commune_members SET active=false,left_at=now() WHERE commune_id=p_commune_id AND user_id=p_user_id;',
    'UPDATE public.commune_members SET active=false,left_at=now() WHERE commune_id=p_commune_id AND user_id=p_user_id;
    PERFORM commune_private.revoke_orphaned_invites(p_commune_id);');
  v_source := replace(v_source,
    'UPDATE public.commune_members SET role=p_action WHERE commune_id=p_commune_id AND user_id=p_user_id;',
    'UPDATE public.commune_members SET role=p_action WHERE commune_id=p_commune_id AND user_id=p_user_id;
    IF v_member.role=''admin'' AND p_action=''member'' THEN PERFORM commune_private.revoke_orphaned_invites(p_commune_id); END IF;');
  IF (length(v_source) - length(replace(v_source, 'revoke_orphaned_invites', ''))) / length('revoke_orphaned_invites') <> 2 THEN
    RAISE EXCEPTION 'Unsupported manage_commune_member definition';
  END IF;
  EXECUTE v_source;
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
  -- The sender must still be an active admin of this commune.
  IF NOT EXISTS(SELECT 1 FROM public.commune_members m WHERE m.commune_id=v_invite.commune_id AND m.user_id=v_invite.invited_by AND m.active AND m.role='admin') THEN
    RAISE EXCEPTION 'Invite unavailable for this verified account' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.commune_members WHERE commune_id=v_invite.commune_id AND user_id=v_actor AND active) THEN
    RAISE EXCEPTION 'Already a member of this commune' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.commune_members(commune_id,user_id,role) VALUES(v_invite.commune_id,v_actor,v_invite.role)
    ON CONFLICT(commune_id,user_id) DO UPDATE SET role=excluded.role,active=true,left_at=NULL,joined_at=now();
  UPDATE public.commune_invites SET accepted_at=now(),accepted_by=v_actor WHERE id=v_invite.id;
  RETURN v_invite.commune_id;
END;
$$;

-- An invitation that cannot be accepted is not shown as available either.
CREATE OR REPLACE FUNCTION public.preview_commune_invite(p_token text)
RETURNS TABLE (commune_name text, role text, expires_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_email text;
BEGIN
  SELECT lower(u.email) INTO v_email
  FROM neon_auth."user" u
  WHERE u.id::text = commune_private.data_api_user_id() AND u."emailVerified" IS TRUE;
  IF v_email IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT c.name, i.role, i.expires_at
  FROM public.commune_invites i
  JOIN public.communes c ON c.id = i.commune_id
  WHERE i.token_hash = digest(p_token, 'sha256')
    AND i.email = v_email AND i.expires_at > now()
    AND i.accepted_at IS NULL AND i.revoked_at IS NULL
    AND EXISTS (SELECT 1 FROM public.commune_members m WHERE m.commune_id = i.commune_id
      AND m.user_id = i.invited_by AND m.active AND m.role = 'admin');
END;
$$;

-- The admin list names who sent each invitation. The earlier columns keep
-- their order, so an older client still reads it.
DROP FUNCTION public.list_commune_invites(uuid);
CREATE FUNCTION public.list_commune_invites(p_commune_id uuid)
RETURNS TABLE (id uuid, email text, role text, created_at timestamptz,
  expires_at timestamptz, accepted_at timestamptz, revoked_at timestamptz,
  invited_by text, invited_by_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_commune_admin(p_commune_id) THEN
    RAISE EXCEPTION 'Only a commune admin can view invites'
      USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT i.id, i.email, i.role, i.created_at, i.expires_at,
    i.accepted_at, i.revoked_at, i.invited_by, u.name
  FROM public.commune_invites i
  LEFT JOIN neon_auth."user" u ON u.id::text = i.invited_by
  WHERE i.commune_id = p_commune_id
  ORDER BY i.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.list_commune_invites(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_commune_invites(uuid) TO authenticated;

-- 2. Retry-safe create commands ------------------------------------------------

-- As reminders (0015): the id is unique per person who acted.
ALTER TABLE public.expenses ADD COLUMN request_id uuid;
CREATE UNIQUE INDEX expenses_recorder_request_idx
  ON public.expenses (recorded_by, request_id) WHERE request_id IS NOT NULL;
ALTER TABLE public.funds ADD COLUMN request_id uuid;
CREATE UNIQUE INDEX funds_creator_request_idx
  ON public.funds (created_by, request_id) WHERE request_id IS NOT NULL;
ALTER TABLE public.fund_contributions ADD COLUMN request_id uuid;
CREATE UNIQUE INDEX fund_contributions_recorder_request_idx
  ON public.fund_contributions (recorded_by, request_id) WHERE request_id IS NOT NULL;
-- A pledge can be cancelled and made again, so one row cannot hold its
-- requests. Each request keeps its own row: what it asked for and which pledge
-- it made. Only the pledge commands read or write it.
CREATE TABLE public.fund_pledge_requests (
  user_id text NOT NULL,
  request_id uuid NOT NULL,
  commitment_id uuid NOT NULL REFERENCES public.fund_commitments(id) ON DELETE CASCADE,
  amount_minor bigint NOT NULL,
  due_on date NOT NULL,
  seq bigint GENERATED ALWAYS AS IDENTITY,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);
CREATE INDEX fund_pledge_requests_commitment_idx ON public.fund_pledge_requests (commitment_id, seq);
ALTER TABLE public.fund_pledge_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fund_pledge_requests FROM PUBLIC, authenticated;

-- Each command takes a lock on its request id first, so a retry waits for the
-- attempt it repeats. A repeat returns the record only while it still stands
-- as that request made it; anything else is refused, so a retry never creates
-- a second record and never reports a changed or withdrawn one as saved.

-- The expense rules stay in create_expense_for, which recurring bills share.
CREATE FUNCTION public.create_expense_command(p_commune_id uuid, p_title text, p_amount_minor bigint,
  p_shares jsonb, p_due_on date, p_paid_by text, p_category text, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_existing public.expenses%ROWTYPE;
  v_request jsonb;
  v_id uuid;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to record an expense' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'commune-expense-request:' || v_actor || ':' || p_request_id::text, 0));
  IF NOT public.is_commune_member(p_commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_existing FROM public.expenses WHERE recorded_by = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.commune_id <> p_commune_id OR v_existing.voided_at IS NOT NULL
       OR jsonb_typeof(p_shares) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    v_request := jsonb_build_object('title', btrim(coalesce(p_title, '')), 'amountMinor', p_amount_minor,
      'paidByUserId', coalesce(p_paid_by, v_actor), 'category', btrim(coalesce(p_category, 'Other')), 'dueOn', p_due_on,
      'shares', (SELECT coalesce(jsonb_agg(jsonb_build_object('userId', s.user_id, 'amountMinor', s.amount_minor) ORDER BY s.user_id), '[]'::jsonb)
        FROM jsonb_to_recordset(p_shares) AS s(user_id text, amount_minor bigint)));
    IF commune_private.expense_state(v_existing.id) IS DISTINCT FROM v_request THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'duplicate', true);
  END IF;
  v_id := public.create_expense_for(p_commune_id, p_title, p_amount_minor, p_shares, p_due_on,
    p_paid_by, coalesce(p_category, 'Other'));
  UPDATE public.expenses SET request_id = p_request_id WHERE id = v_id;
  RETURN jsonb_build_object('id', v_id, 'duplicate', false);
END;
$$;
REVOKE ALL ON FUNCTION public.create_expense_command(uuid, text, bigint, jsonb, date, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_expense_command(uuid, text, bigint, jsonb, date, text, text, uuid) TO authenticated;

-- Fund records carry an audit trigger, so the id is written with the record
-- itself, never stamped on afterwards.
CREATE FUNCTION public.create_fund_command(p_commune_id uuid, p_name text, p_target_minor bigint, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_existing public.funds%ROWTYPE;
  v_id uuid;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to create a fund' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'commune-fund-request:' || v_actor || ':' || p_request_id::text, 0));
  IF NOT public.is_commune_admin(p_commune_id) THEN
    RAISE EXCEPTION 'Only a commune admin can create a fund' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_existing FROM public.funds WHERE created_by = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.commune_id <> p_commune_id OR v_existing.archived_at IS NOT NULL
       OR v_existing.name IS DISTINCT FROM btrim(coalesce(p_name, ''))
       OR v_existing.target_minor IS DISTINCT FROM p_target_minor THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'duplicate', true);
  END IF;
  IF length(btrim(coalesce(p_name, ''))) NOT BETWEEN 1 AND 120
     OR (p_target_minor IS NOT NULL AND p_target_minor <= 0) THEN
    RAISE EXCEPTION 'Invalid fund details' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.funds (commune_id, name, target_minor, created_by, request_id)
    VALUES (p_commune_id, btrim(p_name), p_target_minor, v_actor, p_request_id)
    RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'duplicate', false);
END;
$$;
REVOKE ALL ON FUNCTION public.create_fund_command(uuid, text, bigint, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_fund_command(uuid, text, bigint, uuid) TO authenticated;

CREATE FUNCTION public.pledge_fund_command(p_fund_id uuid, p_amount_minor bigint, p_due_on date, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_request public.fund_pledge_requests%ROWTYPE;
  v_existing public.fund_commitments%ROWTYPE;
  v_commune uuid; v_archived timestamptz; v_id uuid; v_cancelled timestamptz;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to make a pledge' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'commune-pledge-request:' || v_actor || ':' || p_request_id::text, 0));
  PERFORM commune_private.lock_fund_membership(p_fund_id);
  SELECT commune_id, archived_at INTO v_commune, v_archived FROM public.funds WHERE id = p_fund_id FOR UPDATE;
  IF NOT public.is_commune_member(v_commune) THEN RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501'; END IF;
  -- A repeat returns the pledge only while it stands as this request left it:
  -- same fund and figures, not cancelled, unchanged, and not made again since
  -- by a later request.
  SELECT * INTO v_request FROM public.fund_pledge_requests WHERE user_id = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    SELECT * INTO v_existing FROM public.fund_commitments WHERE id = v_request.commitment_id;
    IF v_existing.fund_id IS DISTINCT FROM p_fund_id OR v_archived IS NOT NULL OR v_existing.cancelled_at IS NOT NULL
       OR v_request.amount_minor IS DISTINCT FROM p_amount_minor OR v_request.due_on IS DISTINCT FROM p_due_on
       OR v_existing.amount_minor IS DISTINCT FROM v_request.amount_minor OR v_existing.due_on IS DISTINCT FROM v_request.due_on
       OR EXISTS (SELECT 1 FROM public.fund_pledge_requests r
         WHERE r.commitment_id = v_request.commitment_id AND r.seq > v_request.seq) THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'duplicate', true);
  END IF;
  IF v_archived IS NOT NULL OR p_amount_minor IS NULL OR p_amount_minor NOT BETWEEN 1 AND 1000000000000 OR p_due_on IS NULL THEN
    RAISE EXCEPTION 'Invalid pledge or archived fund' USING ERRCODE = '22023'; END IF;
  SELECT id, cancelled_at INTO v_id, v_cancelled FROM public.fund_commitments WHERE fund_id = p_fund_id AND user_id = v_actor FOR UPDATE;
  IF FOUND THEN
    IF v_cancelled IS NULL THEN RAISE EXCEPTION 'You already have a pledge; edit it instead' USING ERRCODE = 'P0001'; END IF;
    UPDATE public.fund_commitments SET amount_minor = p_amount_minor, due_on = p_due_on, cancelled_at = NULL WHERE id = v_id;
  ELSE
    INSERT INTO public.fund_commitments (fund_id, user_id, amount_minor, due_on)
      VALUES (p_fund_id, v_actor, p_amount_minor, p_due_on) RETURNING id INTO v_id;
  END IF;
  INSERT INTO public.fund_pledge_requests (user_id, request_id, commitment_id, amount_minor, due_on)
    VALUES (v_actor, p_request_id, v_id, p_amount_minor, p_due_on);
  RETURN jsonb_build_object('id', v_id, 'duplicate', false);
END;
$$;
REVOKE ALL ON FUNCTION public.pledge_fund_command(uuid, bigint, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pledge_fund_command(uuid, bigint, date, uuid) TO authenticated;

CREATE FUNCTION public.record_fund_contribution_command(p_commitment_id uuid, p_amount_minor bigint, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_existing public.fund_contributions%ROWTYPE;
  v_row public.fund_commitments%ROWTYPE; v_commune uuid; v_archived timestamptz; v_paid bigint; v_id uuid;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to record a contribution' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'commune-contribution-request:' || v_actor || ':' || p_request_id::text, 0));
  PERFORM commune_private.lock_fund_membership((SELECT fund_id FROM public.fund_commitments WHERE id=p_commitment_id));
  SELECT f.commune_id,f.archived_at INTO v_commune,v_archived FROM public.funds f JOIN public.fund_commitments c ON c.fund_id=f.id WHERE c.id=p_commitment_id FOR UPDATE OF f;
  SELECT * INTO v_row FROM public.fund_commitments WHERE id=p_commitment_id FOR UPDATE;
  IF NOT public.is_commune_admin(v_commune) THEN RAISE EXCEPTION 'Only an admin can confirm a contribution' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_existing FROM public.fund_contributions WHERE recorded_by = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.commitment_id <> p_commitment_id OR v_existing.voided_at IS NOT NULL
       OR v_existing.amount_minor IS DISTINCT FROM p_amount_minor THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'duplicate', true);
  END IF;
  SELECT coalesce(sum(amount_minor),0) INTO v_paid FROM public.fund_contributions WHERE commitment_id=p_commitment_id AND voided_at IS NULL;
  IF v_row.id IS NULL OR v_row.cancelled_at IS NOT NULL OR v_archived IS NOT NULL OR p_amount_minor IS NULL OR p_amount_minor <= 0 OR v_paid+p_amount_minor > v_row.amount_minor THEN
    RAISE EXCEPTION 'Contribution exceeds the active outstanding pledge' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.fund_contributions (commitment_id, amount_minor, recorded_by, request_id)
    VALUES (p_commitment_id, p_amount_minor, v_actor, p_request_id) RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'duplicate', false);
END;
$$;
REVOKE ALL ON FUNCTION public.record_fund_contribution_command(uuid, bigint, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_fund_contribution_command(uuid, bigint, uuid) TO authenticated;

-- The RPCs earlier clients call keep their signatures and run the same rules
-- (as record_recurring_bill does through record_recurring_period, 0022).
-- Each call is its own request, so they have no retry protection.
CREATE OR REPLACE FUNCTION public.create_fund(p_commune_id uuid, p_name text, p_target_minor bigint DEFAULT NULL)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT (public.create_fund_command(p_commune_id, p_name, p_target_minor, gen_random_uuid()) ->> 'id')::uuid;
$$;
CREATE OR REPLACE FUNCTION public.pledge_fund(p_fund_id uuid, p_amount_minor bigint, p_due_on date)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT (public.pledge_fund_command(p_fund_id, p_amount_minor, p_due_on, gen_random_uuid()) ->> 'id')::uuid;
$$;
CREATE OR REPLACE FUNCTION public.record_fund_contribution(p_commitment_id uuid, p_amount_minor bigint)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT (public.record_fund_contribution_command(p_commitment_id, p_amount_minor, gen_random_uuid()) ->> 'id')::uuid;
$$;

-- 3. Pledges -----------------------------------------------------------------

-- A pledge notice names the pledge instead of an expense. The existing rule
-- is extended rather than restated, so every notice allowed before still is.
ALTER TABLE public.notifications ADD COLUMN commitment_id uuid REFERENCES public.fund_commitments(id) ON DELETE CASCADE;
DO $$
DECLARE v_check text;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO v_check FROM pg_constraint c
    WHERE c.conrelid = 'public.notifications'::regclass AND c.conname = 'notifications_source_check';
  IF v_check IS NULL OR v_check !~ '^CHECK \(.*\)$' THEN
    RAISE EXCEPTION 'Unsupported notifications_source_check definition';
  END IF;
  ALTER TABLE public.notifications DROP CONSTRAINT notifications_source_check;
  EXECUTE format('ALTER TABLE public.notifications ADD CONSTRAINT notifications_source_check CHECK ((%s) OR (%s))',
    substr(v_check, 8, length(v_check) - 8),
    'reminder_id IS NULL AND expense_id IS NULL AND commitment_id IS NOT NULL AND actor_user_id IS NOT NULL'
      || ' AND notice_kind IN (''pledge_changed'', ''pledge_cancelled'')');
END;
$$;

CREATE FUNCTION commune_private.notify_pledge(p_commune_id uuid, p_recipient text, p_kind text,
  p_commitment_id uuid, p_actor text, p_amount_minor bigint, p_detail text)
RETURNS void LANGUAGE sql SET search_path = public, pg_temp AS $$
  INSERT INTO public.notifications (commune_id, recipient_user_id, notice_kind, commitment_id, actor_user_id, amount_minor, detail)
  SELECT p_commune_id, p_recipient, p_kind, p_commitment_id, p_actor, p_amount_minor, left(p_detail, 240)
  WHERE p_recipient <> p_actor AND EXISTS (SELECT 1 FROM public.commune_members m
    WHERE m.commune_id = p_commune_id AND m.user_id = p_recipient AND m.active);
$$;
REVOKE ALL ON FUNCTION commune_private.notify_pledge(uuid, text, text, uuid, text, bigint, text) FROM PUBLIC;

-- Pledge notices carry the pledge as their source and the fund as their title.
DO $$
DECLARE v_source text; v_original text;
BEGIN
  v_original := pg_get_functiondef('commune_private.snapshot_notifications(uuid,text)'::regprocedure);
  v_source := replace(v_original, '''sourceId'',coalesce(r.source_id,n.expense_id)',
    '''sourceId'',coalesce(r.source_id,n.expense_id,n.commitment_id)');
  v_source := replace(v_source, '''title'',e.title', '''title'',coalesce(e.title,pf.name)');
  v_source := replace(v_source, 'LEFT JOIN public.expenses e ON e.id=n.expense_id',
    'LEFT JOIN public.expenses e ON e.id=n.expense_id
    LEFT JOIN public.fund_commitments pc ON pc.id=n.commitment_id LEFT JOIN public.funds pf ON pf.id=pc.fund_id');
  IF position('coalesce(r.source_id,n.expense_id,n.commitment_id)' IN v_source) = 0
     OR position('coalesce(e.title,pf.name)' IN v_source) = 0
     OR position('pf.id=pc.fund_id' IN v_source) = 0 THEN
    RAISE EXCEPTION 'Unsupported snapshot_notifications definition';
  END IF;
  EXECUTE v_source;
END;
$$;

-- Only the pledger can raise a pledge or bring its date forward, so nobody
-- can enlarge someone's promise and chase them for it straight away. A change
-- can name the amount and date it was based on; if the pledge no longer has
-- them, someone changed it meanwhile and nothing is saved, so an edit made
-- from an older screen cannot undo theirs.
DROP FUNCTION public.update_fund_pledge(uuid, bigint, date, boolean);
CREATE FUNCTION public.update_fund_pledge(p_commitment_id uuid, p_amount_minor bigint, p_due_on date,
  p_cancel boolean DEFAULT false, p_expected_amount_minor bigint DEFAULT NULL, p_expected_due_on date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_row public.fund_commitments%ROWTYPE; v_commune uuid; v_archived timestamptz; v_paid bigint;
  v_currency text; v_changes text[] := ARRAY[]::text[];
BEGIN
  -- Match fund -> pledge lock order used by pledge/archive/contribution.
  PERFORM commune_private.lock_fund_membership((SELECT fund_id FROM public.fund_commitments WHERE id=p_commitment_id));
  SELECT f.commune_id, f.archived_at INTO v_commune, v_archived FROM public.funds f
    JOIN public.fund_commitments c ON c.fund_id = f.id WHERE c.id = p_commitment_id FOR UPDATE OF f;
  SELECT * INTO v_row FROM public.fund_commitments WHERE id = p_commitment_id FOR UPDATE;
  IF v_row.id IS NULL OR NOT public.is_commune_member(v_commune) OR
    (v_row.user_id <> v_actor AND NOT public.is_commune_admin(v_commune)) THEN
    RAISE EXCEPTION 'Only the pledger or an admin can change this pledge' USING ERRCODE = '42501'; END IF;
  IF (p_expected_amount_minor IS NOT NULL AND p_expected_amount_minor IS DISTINCT FROM v_row.amount_minor)
     OR (p_expected_due_on IS NOT NULL AND p_expected_due_on IS DISTINCT FROM v_row.due_on)
     OR (p_cancel IS NOT TRUE AND v_row.cancelled_at IS NOT NULL
       AND (p_expected_amount_minor IS NOT NULL OR p_expected_due_on IS NOT NULL)) THEN
    RAISE EXCEPTION 'This pledge changed while you were editing. Nothing was saved. Check it again.' USING ERRCODE = 'P0001';
  END IF;
  SELECT coalesce(sum(amount_minor),0) INTO v_paid FROM public.fund_contributions WHERE commitment_id = p_commitment_id AND voided_at IS NULL;
  IF p_cancel IS TRUE THEN
    IF v_paid > 0 THEN RAISE EXCEPTION 'A contributed pledge cannot be cancelled; change its total or correct the contribution first' USING ERRCODE = 'P0001'; END IF;
    -- Cancelling again (a retry, a second tab) changes nothing and tells no one twice.
    IF v_row.cancelled_at IS NOT NULL THEN RETURN; END IF;
    UPDATE public.fund_commitments SET cancelled_at = now() WHERE id = p_commitment_id;
    PERFORM commune_private.notify_pledge(v_commune, v_row.user_id, 'pledge_cancelled', p_commitment_id, v_actor, v_row.amount_minor, NULL);
  ELSE
    IF v_archived IS NOT NULL OR v_row.cancelled_at IS NOT NULL OR p_amount_minor IS NULL OR p_amount_minor NOT BETWEEN 1 AND 1000000000000 OR p_amount_minor < v_paid OR p_due_on IS NULL THEN
      RAISE EXCEPTION 'Pledge must cover recorded contributions and belong to an active fund' USING ERRCODE = '22023'; END IF;
    IF v_row.user_id <> v_actor AND (p_amount_minor > v_row.amount_minor OR p_due_on < v_row.due_on) THEN
      RAISE EXCEPTION 'Only the person who made this pledge can raise it or bring its due date forward' USING ERRCODE = '42501'; END IF;
    UPDATE public.fund_commitments SET amount_minor = p_amount_minor, due_on = p_due_on WHERE id = p_commitment_id;
    IF v_row.user_id <> v_actor THEN
      SELECT currency INTO v_currency FROM public.communes WHERE id = v_commune;
      IF p_amount_minor <> v_row.amount_minor THEN
        v_changes := v_changes || format('Lowered from %s to %s.', commune_private.format_money(v_row.amount_minor, v_currency),
          commune_private.format_money(p_amount_minor, v_currency));
      END IF;
      IF p_due_on <> v_row.due_on THEN
        v_changes := v_changes || format('Due date moved from %s to %s.', to_char(v_row.due_on, 'FMDD Mon YYYY'),
          to_char(p_due_on, 'FMDD Mon YYYY'));
      END IF;
      IF cardinality(v_changes) > 0 THEN
        PERFORM commune_private.notify_pledge(v_commune, v_row.user_id, 'pledge_changed', p_commitment_id, v_actor,
          p_amount_minor, array_to_string(v_changes, ' '));
      END IF;
    END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.update_fund_pledge(uuid, bigint, date, boolean, bigint, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_fund_pledge(uuid, bigint, date, boolean, bigint, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
