-- Commune's fresh Neon schema. Run after Managed Better Auth and the Data API
-- are enabled so auth.user_id() and the authenticated database role exist.
-- Money is stored in minor units; the app never sends a reminder amount.
BEGIN;

CREATE TABLE public.communes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  kind text NOT NULL CHECK (kind IN ('household', 'workspace', 'trip')),
  currency text NOT NULL CHECK (currency IN ('GBP', 'USD', 'EUR')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.commune_members (
  commune_id uuid NOT NULL REFERENCES public.communes(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (commune_id, user_id)
);
CREATE INDEX commune_members_user_idx ON public.commune_members (user_id, commune_id);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id uuid NOT NULL REFERENCES public.communes(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  paid_by_user_id text NOT NULL,
  due_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (commune_id, paid_by_user_id)
    REFERENCES public.commune_members (commune_id, user_id)
);
CREATE INDEX expenses_commune_idx ON public.expenses (commune_id, created_at DESC);

CREATE TABLE public.expense_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  settled_minor bigint NOT NULL DEFAULT 0
    CHECK (settled_minor >= 0 AND settled_minor <= amount_minor),
  settled_at timestamptz,
  UNIQUE (expense_id, user_id)
);
CREATE INDEX expense_shares_user_idx ON public.expense_shares (user_id, expense_id);

CREATE TABLE public.funds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id uuid NOT NULL REFERENCES public.communes(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  target_minor bigint CHECK (target_minor > 0),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (commune_id, created_by)
    REFERENCES public.commune_members (commune_id, user_id)
);
CREATE INDEX funds_commune_idx ON public.funds (commune_id, created_at DESC);

-- A Chase can only be sent against a member's own explicit pledge.
CREATE TABLE public.fund_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id uuid NOT NULL REFERENCES public.funds(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  due_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fund_id, user_id)
);
CREATE INDEX fund_commitments_user_idx ON public.fund_commitments (user_id, fund_id);

-- Contributions are confirmations recorded by a commune admin, not payments
-- taken by Commune. This distinction is explicit until Stripe is integrated.
CREATE TABLE public.fund_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commitment_id uuid NOT NULL REFERENCES public.fund_commitments(id) ON DELETE CASCADE,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  recorded_by text NOT NULL,
  contributed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fund_contributions_commitment_idx
  ON public.fund_contributions (commitment_id, contributed_at DESC);

CREATE OR REPLACE FUNCTION public.is_commune_member(p_commune_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.commune_members m
    WHERE m.commune_id = p_commune_id AND m.user_id = auth.user_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_commune_admin(p_commune_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.commune_members m
    WHERE m.commune_id = p_commune_id
      AND m.user_id = auth.user_id() AND m.role = 'admin'
  );
$$;

ALTER TABLE public.communes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commune_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY commune_read ON public.communes FOR SELECT TO authenticated
  USING (public.is_commune_member(id));
CREATE POLICY member_read ON public.commune_members FOR SELECT TO authenticated
  USING (public.is_commune_member(commune_id));
CREATE POLICY expense_read ON public.expenses FOR SELECT TO authenticated
  USING (public.is_commune_member(commune_id));
CREATE POLICY expense_share_read ON public.expense_shares FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.expenses e
    WHERE e.id = expense_id AND public.is_commune_member(e.commune_id)
  ));
CREATE POLICY fund_read ON public.funds FOR SELECT TO authenticated
  USING (public.is_commune_member(commune_id));
CREATE POLICY fund_commitment_read ON public.fund_commitments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.funds f
    WHERE f.id = fund_id AND public.is_commune_member(f.commune_id)
  ));
CREATE POLICY fund_contribution_read ON public.fund_contributions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.fund_commitments c
    JOIN public.funds f ON f.id = c.fund_id
    WHERE c.id = commitment_id AND public.is_commune_member(f.commune_id)
  ));

-- Authenticated clients only read RLS-filtered data and call validated RPCs.
-- No direct INSERT/UPDATE/DELETE grants are given for money or membership.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.communes, public.commune_members,
  public.expenses, public.expense_shares, public.funds,
  public.fund_commitments, public.fund_contributions TO authenticated;
REVOKE ALL ON FUNCTION public.is_commune_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_commune_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_commune_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_commune_admin(uuid) TO authenticated;

CREATE FUNCTION public.create_commune(
  p_name text, p_kind text, p_currency text DEFAULT 'GBP'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_user text := auth.user_id();
  v_id uuid;
BEGIN
  IF v_user IS NULL OR v_user = '' THEN
    RAISE EXCEPTION 'Sign in to create a commune' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_name, ''))) NOT BETWEEN 1 AND 80
     OR p_kind NOT IN ('household', 'workspace', 'trip')
     OR p_currency NOT IN ('GBP', 'USD', 'EUR') THEN
    RAISE EXCEPTION 'Invalid commune details' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.communes (name, kind, currency, created_by)
    VALUES (btrim(p_name), p_kind, p_currency, v_user)
    RETURNING id INTO v_id;
  INSERT INTO public.commune_members (commune_id, user_id, role)
    VALUES (v_id, v_user, 'admin');
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_commune(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_commune(text, text, text) TO authenticated;

-- All split arithmetic and membership checks happen before any row is saved.
CREATE FUNCTION public.create_expense(
  p_commune_id uuid, p_title text, p_amount_minor bigint,
  p_shares jsonb, p_due_on date DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_user text := auth.user_id();
  v_expense_id uuid;
  v_count integer;
  v_distinct integer;
  v_sum numeric;
BEGIN
  IF v_user IS NULL OR NOT public.is_commune_member(p_commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_title, ''))) NOT BETWEEN 1 AND 160
     OR p_amount_minor IS NULL OR p_amount_minor <= 0
     OR jsonb_typeof(p_shares) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid expense details' USING ERRCODE = '22023';
  END IF;
  SELECT count(*), count(DISTINCT s.user_id), sum(s.amount_minor)
    INTO v_count, v_distinct, v_sum
  FROM jsonb_to_recordset(p_shares) AS s(user_id text, amount_minor bigint);
  IF v_count = 0 OR v_count <> v_distinct OR v_sum <> p_amount_minor
     OR NOT EXISTS (
       SELECT 1 FROM jsonb_to_recordset(p_shares)
         AS s(user_id text, amount_minor bigint)
       WHERE s.user_id = v_user AND s.amount_minor > 0
     ) OR EXISTS (
       SELECT 1 FROM jsonb_to_recordset(p_shares)
         AS s(user_id text, amount_minor bigint)
       WHERE s.user_id IS NULL OR s.amount_minor IS NULL
          OR s.amount_minor <= 0
          OR NOT EXISTS (
            SELECT 1 FROM public.commune_members m
            WHERE m.commune_id = p_commune_id AND m.user_id = s.user_id
          )
     ) THEN
    RAISE EXCEPTION 'Shares must be positive, unique, belong to members, and total the expense'
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.expenses
    (commune_id, title, amount_minor, paid_by_user_id, due_on)
    VALUES (p_commune_id, btrim(p_title), p_amount_minor, v_user, p_due_on)
    RETURNING id INTO v_expense_id;
  INSERT INTO public.expense_shares
    (expense_id, user_id, amount_minor, settled_minor, settled_at)
    SELECT v_expense_id, s.user_id, s.amount_minor,
      CASE WHEN s.user_id = v_user THEN s.amount_minor ELSE 0 END,
      CASE WHEN s.user_id = v_user THEN now() ELSE NULL END
    FROM jsonb_to_recordset(p_shares) AS s(user_id text, amount_minor bigint);
  RETURN v_expense_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_expense(uuid, text, bigint, jsonb, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_expense(uuid, text, bigint, jsonb, date) TO authenticated;

-- The person who paid the bill confirms receipt; a debtor cannot erase debt.
CREATE FUNCTION public.confirm_expense_share(p_share_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_share public.expense_shares%ROWTYPE;
  v_payer text;
BEGIN
  SELECT * INTO v_share FROM public.expense_shares
    WHERE id = p_share_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share not found' USING ERRCODE = '22023';
  END IF;
  SELECT paid_by_user_id INTO v_payer FROM public.expenses
    WHERE id = v_share.expense_id;
  IF auth.user_id() IS DISTINCT FROM v_payer
     OR v_share.user_id = v_payer THEN
    RAISE EXCEPTION 'Only the bill payer can confirm an outstanding share'
      USING ERRCODE = '42501';
  END IF;
  UPDATE public.expense_shares
    SET settled_minor = amount_minor, settled_at = now()
    WHERE id = p_share_id;
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_expense_share(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_expense_share(uuid) TO authenticated;

CREATE FUNCTION public.create_fund(
  p_commune_id uuid, p_name text, p_target_minor bigint DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_commune_admin(p_commune_id) THEN
    RAISE EXCEPTION 'Only a commune admin can create a fund' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_name, ''))) NOT BETWEEN 1 AND 120
     OR (p_target_minor IS NOT NULL AND p_target_minor <= 0) THEN
    RAISE EXCEPTION 'Invalid fund details' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.funds (commune_id, name, target_minor, created_by)
    VALUES (p_commune_id, btrim(p_name), p_target_minor, auth.user_id())
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_fund(uuid, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_fund(uuid, text, bigint) TO authenticated;

CREATE FUNCTION public.pledge_fund(
  p_fund_id uuid, p_amount_minor bigint, p_due_on date
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_commune_id uuid;
  v_id uuid;
BEGIN
  SELECT commune_id INTO v_commune_id FROM public.funds WHERE id = p_fund_id;
  IF v_commune_id IS NULL OR NOT public.is_commune_member(v_commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 OR p_due_on IS NULL THEN
    RAISE EXCEPTION 'Invalid pledge' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.fund_commitments (fund_id, user_id, amount_minor, due_on)
    VALUES (p_fund_id, auth.user_id(), p_amount_minor, p_due_on)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.pledge_fund(uuid, bigint, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pledge_fund(uuid, bigint, date) TO authenticated;

CREATE FUNCTION public.record_fund_contribution(
  p_commitment_id uuid, p_amount_minor bigint
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_commitment public.fund_commitments%ROWTYPE;
  v_commune_id uuid;
  v_paid numeric;
  v_id uuid;
BEGIN
  SELECT * INTO v_commitment FROM public.fund_commitments
    WHERE id = p_commitment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pledge not found' USING ERRCODE = '22023';
  END IF;
  SELECT commune_id INTO v_commune_id FROM public.funds
    WHERE id = v_commitment.fund_id;
  IF NOT public.is_commune_admin(v_commune_id) THEN
    RAISE EXCEPTION 'Only a commune admin can confirm a contribution'
      USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(sum(amount_minor), 0) INTO v_paid
    FROM public.fund_contributions WHERE commitment_id = p_commitment_id;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0
     OR v_paid + p_amount_minor > v_commitment.amount_minor THEN
    RAISE EXCEPTION 'Contribution exceeds the outstanding pledge'
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.fund_contributions
    (commitment_id, amount_minor, recorded_by)
    VALUES (p_commitment_id, p_amount_minor, auth.user_id())
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_fund_contribution(uuid, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_fund_contribution(uuid, bigint) TO authenticated;

COMMIT;
