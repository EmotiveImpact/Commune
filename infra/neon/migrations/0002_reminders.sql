-- Nudge = an overdue expense share owed to the bill payer.
-- Chase = an overdue, member-authored pledge to a commune fund.
-- Both create an in-app notification transactionally. Email is an outbox job,
-- never a fire-and-forget browser request or a fabricated success toast.
BEGIN;

CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id uuid NOT NULL REFERENCES public.communes(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('nudge', 'chase')),
  source_id uuid NOT NULL,
  sender_user_id text NOT NULL,
  recipient_user_id text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_user_id <> recipient_user_id)
);
CREATE INDEX reminders_cooldown_idx ON public.reminders
  (kind, source_id, recipient_user_id, created_at DESC);
CREATE INDEX reminders_recipient_idx ON public.reminders
  (recipient_user_id, created_at DESC);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id uuid NOT NULL UNIQUE REFERENCES public.reminders(id) ON DELETE CASCADE,
  commune_id uuid NOT NULL REFERENCES public.communes(id) ON DELETE CASCADE,
  recipient_user_id text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_recipient_idx ON public.notifications
  (recipient_user_id, created_at DESC);

-- Private to the delivery worker. Use reminder_id as the mail provider's
-- idempotency key so retry after a crash does not create duplicate email.
CREATE TABLE public.reminder_email_outbox (
  reminder_id uuid PRIMARY KEY REFERENCES public.reminders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'suppressed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  payload jsonb,
  payload_amount_minor bigint CHECK (payload_amount_minor > 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  provider_message_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reminder_email_outbox_pending_idx
  ON public.reminder_email_outbox (next_attempt_at)
  WHERE status IN ('pending', 'failed');

CREATE TABLE public.notification_preferences (
  user_id text PRIMARY KEY,
  email_reminders boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_email_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY reminder_read ON public.reminders FOR SELECT TO authenticated
  USING (sender_user_id = auth.user_id() OR recipient_user_id = auth.user_id());
CREATE POLICY notification_read ON public.notifications FOR SELECT TO authenticated
  USING (recipient_user_id = auth.user_id());
CREATE POLICY preferences_read ON public.notification_preferences FOR SELECT TO authenticated
  USING (user_id = auth.user_id());
CREATE POLICY preferences_insert ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.user_id());
CREATE POLICY preferences_update ON public.notification_preferences FOR UPDATE TO authenticated
  USING (user_id = auth.user_id()) WITH CHECK (user_id = auth.user_id());

GRANT SELECT ON public.reminders, public.notifications,
  public.notification_preferences TO authenticated;
GRANT INSERT (user_id, email_reminders), UPDATE (email_reminders)
  ON public.notification_preferences TO authenticated;
-- Deliberately no client grant on the outbox or reminder/notification writes.

CREATE FUNCTION public.list_reminder_targets(p_commune_id uuid)
RETURNS TABLE (
  kind text,
  source_id uuid,
  recipient_user_id text,
  amount_minor bigint,
  currency text,
  label text,
  due_on date,
  last_sent_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.is_commune_member(p_commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT 'nudge'::text, s.id, s.user_id,
    (s.amount_minor - s.settled_minor)::bigint,
    co.currency, e.title, e.due_on,
    (SELECT max(r.created_at) FROM public.reminders r
      WHERE r.kind = 'nudge' AND r.source_id = s.id
        AND r.recipient_user_id = s.user_id)
  FROM public.expense_shares s
  JOIN public.expenses e ON e.id = s.expense_id
  JOIN public.communes co ON co.id = e.commune_id
  JOIN public.commune_members m
    ON m.commune_id = co.id AND m.user_id = s.user_id
  WHERE e.commune_id = p_commune_id
    AND e.paid_by_user_id = auth.user_id()
    AND s.user_id <> auth.user_id()
    AND s.settled_minor < s.amount_minor
    AND e.due_on <= current_date
  UNION ALL
  SELECT 'chase'::text, c.id, c.user_id,
    (c.amount_minor - coalesce(paid.total, 0))::bigint,
    co.currency, f.name, c.due_on,
    (SELECT max(r.created_at) FROM public.reminders r
      WHERE r.kind = 'chase' AND r.source_id = c.id
        AND r.recipient_user_id = c.user_id)
  FROM public.fund_commitments c
  JOIN public.funds f ON f.id = c.fund_id
  JOIN public.communes co ON co.id = f.commune_id
  JOIN public.commune_members m
    ON m.commune_id = co.id AND m.user_id = c.user_id
  LEFT JOIN LATERAL (
    SELECT sum(fc.amount_minor) AS total
    FROM public.fund_contributions fc WHERE fc.commitment_id = c.id
  ) paid ON true
  WHERE f.commune_id = p_commune_id
    AND public.is_commune_admin(f.commune_id)
    AND c.user_id <> auth.user_id()
    AND c.due_on <= current_date
    AND c.amount_minor > coalesce(paid.total, 0);
END;
$$;
REVOKE ALL ON FUNCTION public.list_reminder_targets(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_reminder_targets(uuid) TO authenticated;

CREATE FUNCTION public.send_reminder(p_kind text, p_source_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_sender text := auth.user_id();
  v_recipient text;
  v_commune_id uuid;
  v_amount bigint;
  v_due_on date;
  v_payer text;
  v_reminder_id uuid;
BEGIN
  IF v_sender IS NULL OR v_sender = '' THEN
    RAISE EXCEPTION 'Sign in to send a reminder' USING ERRCODE = '42501';
  END IF;
  IF p_kind = 'nudge' THEN
    -- Serialize requests on the obligation row before checking cooldown.
    SELECT s.user_id, e.commune_id, s.amount_minor - s.settled_minor,
      e.due_on, e.paid_by_user_id
      INTO v_recipient, v_commune_id, v_amount, v_due_on, v_payer
    FROM public.expense_shares s
    JOIN public.expenses e ON e.id = s.expense_id
    WHERE s.id = p_source_id FOR UPDATE OF s;
    IF NOT FOUND OR v_sender IS DISTINCT FROM v_payer THEN
      RAISE EXCEPTION 'Only the bill payer can nudge this share'
        USING ERRCODE = '42501';
    END IF;
  ELSIF p_kind = 'chase' THEN
    SELECT c.user_id, f.commune_id, c.due_on
      INTO v_recipient, v_commune_id, v_due_on
    FROM public.fund_commitments c
    JOIN public.funds f ON f.id = c.fund_id
    WHERE c.id = p_source_id FOR UPDATE OF c;
    IF NOT FOUND OR NOT public.is_commune_admin(v_commune_id) THEN
      RAISE EXCEPTION 'Only a commune admin can chase this pledge'
        USING ERRCODE = '42501';
    END IF;
    -- record_fund_contribution takes this same pledge lock. A new statement
    -- after acquiring it sees any contribution that committed while we waited.
    SELECT c.amount_minor - coalesce(sum(fc.amount_minor), 0)
      INTO v_amount
    FROM public.fund_commitments c
    LEFT JOIN public.fund_contributions fc ON fc.commitment_id = c.id
    WHERE c.id = p_source_id
    GROUP BY c.amount_minor;
  ELSE
    RAISE EXCEPTION 'Unknown reminder type' USING ERRCODE = '22023';
  END IF;

  IF v_recipient = v_sender OR v_amount IS NULL OR v_amount <= 0
     OR v_due_on IS NULL OR v_due_on > current_date
     OR NOT EXISTS (
       SELECT 1 FROM public.commune_members m
       WHERE m.commune_id = v_commune_id AND m.user_id = v_recipient
     ) THEN
    RAISE EXCEPTION 'No due amount to remind this member about'
      USING ERRCODE = '22023';
  END IF;
  -- Serialize rate checks even when two different obligations are used.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_sender || ':' || v_recipient, 0
  ));
  IF EXISTS (
    SELECT 1 FROM public.reminders r
    WHERE r.kind = p_kind AND r.source_id = p_source_id
      AND r.recipient_user_id = v_recipient
      AND r.created_at > now() - interval '3 days'
  ) THEN
    RAISE EXCEPTION 'A reminder was already sent in the last 3 days'
      USING ERRCODE = 'P0001';
  END IF;
  -- A payer must not evade the source cooldown by making many tiny bills.
  -- One reminder per sender/recipient per day, regardless of source or kind.
  IF EXISTS (
    SELECT 1 FROM public.reminders r
    WHERE r.sender_user_id = v_sender
      AND r.recipient_user_id = v_recipient
      AND r.created_at > now() - interval '1 day'
  ) THEN
    RAISE EXCEPTION 'This member was already reminded in the last day'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.reminders
    (commune_id, kind, source_id, sender_user_id,
      recipient_user_id, amount_minor)
    VALUES (v_commune_id, p_kind, p_source_id, v_sender,
      v_recipient, v_amount)
    RETURNING id INTO v_reminder_id;
  INSERT INTO public.notifications
    (reminder_id, commune_id, recipient_user_id)
    VALUES (v_reminder_id, v_commune_id, v_recipient);
  INSERT INTO public.reminder_email_outbox (reminder_id, status)
    VALUES (v_reminder_id, CASE WHEN coalesce((
      SELECT p.email_reminders FROM public.notification_preferences p
      WHERE p.user_id = v_recipient
    ), true) THEN 'pending' ELSE 'suppressed' END);
  RETURN v_reminder_id;
END;
$$;
REVOKE ALL ON FUNCTION public.send_reminder(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_reminder(text, uuid) TO authenticated;

CREATE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.notifications SET read_at = coalesce(read_at, now())
    WHERE id = p_notification_id
      AND recipient_user_id = auth.user_id();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;

COMMIT;
