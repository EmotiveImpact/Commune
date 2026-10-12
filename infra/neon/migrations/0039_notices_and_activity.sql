-- Notices, activity and "Needs you" across communes.
-- 1. The bell counted only the open commune's unread notices, so a notice
--    from another commune showed nothing, even on Home. The commune list
--    (public.my_communes) and the snapshot's commune now carry
--    unreadNotices, the reader's unread count in that commune, so the
--    minute check that already reads the list keeps the bell right for every
--    commune. public.my_unread_notices() returns the unread notices of every
--    commune the caller belongs to, in the snapshot's shape with the
--    sender's name and a pledge notice's fund, for Notices to list under
--    each commune's name. The app reads it only when Notices opens.
-- 2. Activity said "Created" without saying what was created. Each activity
--    event in the snapshot now names its record type (recordType): expense,
--    repayment, fund, pledge, contribution, recurring, template, task,
--    event, note, member or announcement. An event records only its area,
--    so the type comes from what each command records with it.
-- 3. "Needs you" lists first the payments someone says they have sent,
--    which only the bill payer can confirm, on Home as on This Hub. Home
--    shows the communes that are not open from the overview summary, which
--    left out every payment report; it now keeps the pending ones.
-- The shared functions are patched in place, so changes other migrations
-- make to them stay. The web app released with this reads the new fields
-- and shows what it showed before while they are missing. Apply after 0038.
BEGIN;

-- 1. Unread notices across communes -----------------------------------------

-- The count reads only unread rows.
CREATE INDEX notifications_unread_idx ON public.notifications (recipient_user_id, commune_id) WHERE read_at IS NULL;

CREATE FUNCTION commune_private.unread_notice_count(p_commune_id uuid, p_user_id text)
RETURNS integer LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT count(*)::integer FROM public.notifications n
    WHERE n.recipient_user_id = p_user_id AND n.commune_id = p_commune_id AND n.read_at IS NULL;
$$;
REVOKE ALL ON FUNCTION commune_private.unread_notice_count(uuid, text) FROM PUBLIC;

-- 2. The record type of an activity event ------------------------------------

-- A repayment's event carries its receipt, a pledge's or contribution's the
-- row it changed (a pledge names its fund, a contribution its pledge), and a
-- task or event keeps its kind after it is removed. Events written before
-- their details were kept fall back to the words each command uses.
CREATE FUNCTION commune_private.activity_record_type(p_event_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT CASE e.kind
    WHEN 'expenses' THEN CASE WHEN e.details ? 'receiptId' OR e.description LIKE 'Repayment %'
      OR e.description = 'Share confirmed received' THEN 'repayment' ELSE 'expense' END
    WHEN 'funds' THEN CASE WHEN e.details -> 'after' ? 'commitment_id' OR e.description LIKE 'Contribution %' THEN 'contribution'
      WHEN e.details -> 'after' ? 'fund_id' OR e.description LIKE 'Pledge %' THEN 'pledge' ELSE 'fund' END
    WHEN 'operations' THEN coalesce((SELECT o.kind FROM public.commune_operations o WHERE o.id = e.entity_id), 'task')
    WHEN 'recurring' THEN 'recurring'
    WHEN 'templates' THEN 'template'
    WHEN 'notes' THEN 'note'
    WHEN 'members' THEN 'member'
    WHEN 'announcements' THEN 'announcement'
  END
  FROM public.commune_events e WHERE e.id = p_event_id;
$$;
REVOKE ALL ON FUNCTION commune_private.activity_record_type(uuid) FROM PUBLIC;

-- Each patch must apply.
DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('public.my_communes()'::regprocedure);
  v_source := replace(v_original, $old$'changeMark', commune_private.change_mark(c.id))$old$,
    $new$'changeMark', commune_private.change_mark(c.id),
      'unreadNotices', commune_private.unread_notice_count(c.id, m.user_id))$new$);
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported commune list definition'; END IF;
  EXECUTE v_source;

  v_original := pg_get_functiondef('public.commune_snapshot(uuid)'::regprocedure);
  v_source := replace(v_original, $old$'currencyLockedBy',to_jsonb(commune_private.currency_locked_by(co.id))),$old$,
    $new$'currencyLockedBy',to_jsonb(commune_private.currency_locked_by(co.id)),
      'unreadNotices',commune_private.unread_notice_count(co.id,v_actor)),$new$);
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported snapshot commune definition'; END IF;
  v_original := v_source;
  v_source := replace(v_original, $old$'description',a.description,'createdAt',a.created_at)$old$,
    $new$'description',a.description,'createdAt',a.created_at,'recordType',commune_private.activity_record_type(a.id))$new$);
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported snapshot activity definition'; END IF;
  EXECUTE v_source;

  -- 3. A summary keeps a share's pending payment report, the one thing about
  -- it that the bill payer has to act on. Repayments and answered reports
  -- stay on the commune's own screens.
  v_original := pg_get_functiondef('public.commune_summary(uuid)'::regprocedure);
  v_source := replace(v_original, $old$y.item || '{"receipts": [], "paymentReports": []}'::jsonb$old$,
    $new$y.item || jsonb_build_object('receipts', '[]'::jsonb, 'paymentReports',
            coalesce((SELECT jsonb_agg(r.report ORDER BY r.ord) FROM jsonb_array_elements(y.item -> 'paymentReports') WITH ORDINALITY r(report, ord)
              WHERE r.report ->> 'status' = 'pending'), '[]'::jsonb))$new$);
  IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported summary definition'; END IF;
  EXECUTE v_source;
END;
$$;

-- Unread notices in every commune the caller belongs to, newest first, at
-- most 100 a commune (as the snapshot carries). Read only for communes that
-- have one. A pledge notice names the fund holding the pledge while the fund
-- is open, as the reader may not have that commune's records loaded.
CREATE FUNCTION public.my_unread_notices()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(n.notice || jsonb_build_object(
      'senderName', names.value ->> (n.notice ->> 'senderUserId'),
      'fundId', (SELECT f.id FROM public.fund_commitments c JOIN public.funds f ON f.id = c.fund_id
        WHERE n.notice ->> 'kind' IN ('pledge-changed', 'pledge-cancelled') AND c.id = (n.notice ->> 'sourceId')::uuid
          AND f.archived_at IS NULL))
    ORDER BY (n.notice ->> 'createdAt')::timestamptz DESC, n.notice ->> 'id'), '[]'::jsonb)
  FROM public.commune_members m
  CROSS JOIN LATERAL (SELECT commune_private.member_names(m.commune_id) AS value) names
  CROSS JOIN LATERAL jsonb_array_elements(commune_private.snapshot_notifications(m.commune_id, m.user_id)) n(notice)
  WHERE m.user_id = commune_private.data_api_user_id() AND m.active
    AND commune_private.unread_notice_count(m.commune_id, m.user_id) > 0
    AND n.notice ->> 'readAt' IS NULL;
$$;
REVOKE ALL ON FUNCTION public.my_unread_notices() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_unread_notices() TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
