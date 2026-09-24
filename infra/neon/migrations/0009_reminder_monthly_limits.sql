-- A rolling 30-day ceiling applies to accepted Nudge and Chase actions,
-- including in-app-only reminders. A sender cannot reset the budget by
-- switching communes, targets, or reminder kinds.
BEGIN;

CREATE INDEX reminders_sender_created_idx ON public.reminders
  (sender_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.send_reminder(p_kind text, p_source_id uuid)
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

  -- Serialize *all* reminders from this sender. A pair-only lock would let
  -- simultaneous requests to different people pass the sender-wide cap.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'commune-reminder-sender:' || v_sender, 0
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
  IF EXISTS (
    SELECT 1 FROM public.reminders r
    WHERE r.sender_user_id = v_sender
      AND r.recipient_user_id = v_recipient
      AND r.created_at > now() - interval '1 day'
  ) THEN
    RAISE EXCEPTION 'This member was already reminded in the last day'
      USING ERRCODE = 'P0001';
  END IF;
  IF (
    SELECT count(*) FROM public.reminders r
    WHERE r.sender_user_id = v_sender
      AND r.recipient_user_id = v_recipient
      AND r.created_at > now() - interval '30 days'
  ) >= 8 THEN
    RAISE EXCEPTION 'You have reached the limit of 8 reminders to this person in 30 days'
      USING ERRCODE = 'P0001';
  END IF;
  IF (
    SELECT count(*) FROM public.reminders r
    WHERE r.sender_user_id = v_sender
      AND r.created_at > now() - interval '30 days'
  ) >= 60 THEN
    RAISE EXCEPTION 'You have reached the limit of 60 reminders in 30 days'
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

COMMIT;
