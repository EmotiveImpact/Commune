-- A member could fill another's notices by repeating an action: reporting and
-- withdrawing a payment 2,000 times left the payer 2,000 notices, all sent on
-- every load. A repeat now brings the person's unread notice up to date
-- instead of adding another, the bell carries the latest 100 notices (unread
-- first), and a share can be reported at most 10 times a day. Apply after 0031.
BEGIN;

-- One unread notice per expense, kind and person who acted.
CREATE OR REPLACE FUNCTION commune_private.notify_ledger(p_commune_id uuid, p_recipient text, p_kind text,
  p_expense_id uuid, p_actor text, p_amount_minor bigint, p_detail text)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF p_recipient IS NULL OR p_actor IS NULL OR p_recipient = p_actor OR NOT EXISTS (SELECT 1 FROM public.commune_members m
      WHERE m.commune_id = p_commune_id AND m.user_id = p_recipient AND m.active) THEN
    RETURN;
  END IF;
  UPDATE public.notifications SET amount_minor = p_amount_minor, detail = left(p_detail, 240), created_at = now()
    WHERE recipient_user_id = p_recipient AND commune_id = p_commune_id AND expense_id = p_expense_id
      AND notice_kind = p_kind AND actor_user_id = p_actor AND read_at IS NULL;
  IF NOT FOUND THEN
    INSERT INTO public.notifications (commune_id, recipient_user_id, notice_kind, expense_id, actor_user_id, amount_minor, detail)
      VALUES (p_commune_id, p_recipient, p_kind, p_expense_id, p_actor, p_amount_minor, left(p_detail, 240));
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION commune_private.notify_ledger(uuid, text, text, uuid, text, bigint, text) FROM PUBLIC;

DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('commune_private.snapshot_notifications(uuid,text)'::regprocedure);
  v_source := replace(v_original, 'FROM public.notifications n LEFT JOIN public.reminders r ON r.id=n.reminder_id',
    'FROM (SELECT * FROM public.notifications x WHERE x.commune_id=p_commune_id AND x.recipient_user_id=p_actor
      ORDER BY x.read_at IS NULL DESC, x.created_at DESC LIMIT 100) n LEFT JOIN public.reminders r ON r.id=n.reminder_id');
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported notices snapshot definition'; END IF;
  EXECUTE v_source;

  v_original := pg_get_functiondef('public.report_share_payment(uuid,bigint,date,text,uuid)'::regprocedure);
  v_source := replace(v_original,
    '  INSERT INTO public.expense_share_payment_reports (share_id, reported_by, amount_minor, sent_on, reference, request_id)',
    '  IF (SELECT count(*) FROM public.expense_share_payment_reports WHERE share_id = p_share_id
      AND reported_by = v_actor AND reported_at > now() - interval ''1 day'') >= 10 THEN
    RAISE EXCEPTION ''You have reported this share 10 times today. Try again tomorrow, or ask the bill payer to record it.''
      USING ERRCODE = ''P0001'';
  END IF;
  INSERT INTO public.expense_share_payment_reports (share_id, reported_by, amount_minor, sent_on, reference, request_id)');
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported payment report definition'; END IF;
  EXECUTE v_source;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
