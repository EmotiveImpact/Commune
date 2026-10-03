-- Retry-safe Nudge/Chase commands with a truthful result. Additive:
-- send_reminder keeps every quota, cooldown and authority rule; the command
-- wrapper adds an idempotency key and reports what was recorded.
-- Apply after 0014. Release with the matching web client.
BEGIN;

ALTER TABLE public.reminders ADD COLUMN request_id uuid;
CREATE UNIQUE INDEX reminders_sender_request_idx
  ON public.reminders (sender_user_id, request_id) WHERE request_id IS NOT NULL;
CREATE INDEX reminders_commune_sender_idx
  ON public.reminders (commune_id, sender_user_id, created_at DESC);

-- The outbox is private to the delivery worker, and whether an email is
-- queued depends on the recipient's own preference. Any per-reminder email
-- state (queued, accepted, failed) would let a sender read that preference,
-- so senders learn only two things: 'none' when no email can go out at all
-- (delivery is not configured, or the obligation was withdrawn), otherwise
-- 'possible'. Delivery states stay with the worker and its monitoring.
CREATE FUNCTION commune_private.reminder_email_state(p_reminder_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce((SELECT CASE
      WHEN q.status = 'suppressed' AND q.last_error IS NOT NULL THEN 'none'
      ELSE 'possible' END
    FROM public.reminder_email_outbox q WHERE q.reminder_id = p_reminder_id), 'none');
$$;
REVOKE ALL ON FUNCTION commune_private.reminder_email_state(uuid) FROM PUBLIC;

-- A repeated request (double click, network retry, second tab) returns the
-- reminder it already created instead of a misleading cooldown error.
CREATE FUNCTION public.send_reminder_command(p_kind text, p_source_id uuid, p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_existing public.reminders%ROWTYPE;
  v_id uuid;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to send a reminder' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'commune-reminder-request:' || v_actor || ':' || p_request_id::text, 0));
  SELECT * INTO v_existing FROM public.reminders
    WHERE sender_user_id = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.kind IS DISTINCT FROM p_kind OR v_existing.source_id IS DISTINCT FROM p_source_id THEN
      RAISE EXCEPTION 'This request was already used for a different reminder' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'duplicate', true,
      'emailStatus', commune_private.reminder_email_state(v_existing.id));
  END IF;
  v_id := public.send_reminder(p_kind, p_source_id);
  UPDATE public.reminders SET request_id = p_request_id WHERE id = v_id;
  RETURN jsonb_build_object('id', v_id, 'duplicate', false,
    'emailStatus', commune_private.reminder_email_state(v_id));
END;
$$;
REVOKE ALL ON FUNCTION public.send_reminder_command(text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_reminder_command(text, uuid, uuid) TO authenticated;

-- Snapshot sections that later migrations extend live in private helpers, so
-- one section can change without replacing the whole membership-guarded read.
-- They take no identity of their own: only commune_snapshot may call them.
CREATE FUNCTION commune_private.snapshot_expenses(p_commune_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'category',e.category,'amountMinor',e.amount_minor,'paidByUserId',e.paid_by_user_id,'dueOn',e.due_on,'createdAt',e.created_at,
      'recurring',EXISTS(SELECT 1 FROM public.recurring_bill_occurrences o WHERE o.expense_id=e.id),
      'shares',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'userId',s.user_id,'amountMinor',s.amount_minor,'settledMinor',s.settled_minor) ORDER BY s.user_id) FROM public.expense_shares s WHERE s.expense_id=e.id),'[]'::jsonb)) ORDER BY e.created_at DESC),'[]'::jsonb)
    FROM public.expenses e WHERE e.commune_id=p_commune_id;
$$;
CREATE FUNCTION commune_private.snapshot_operations(p_commune_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'hubId',o.commune_id,'kind',o.kind,'category',o.category,'title',o.title,'date',o.date,'time',o.time,'allDay',o.all_day,'assignee',o.assignee,'rotation',o.rotation,'lastDone',o.last_done,'repeat',o.repeat,'status',o.status,'notes',o.notes) ORDER BY o.date,o.time),'[]'::jsonb)
    FROM public.commune_operations o WHERE o.commune_id=p_commune_id;
$$;
CREATE FUNCTION commune_private.snapshot_notifications(p_commune_id uuid, p_actor text)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',n.id,'communeId',n.commune_id,'kind',r.kind,'sourceId',r.source_id,'amountMinor',r.amount_minor,'senderUserId',r.sender_user_id,'createdAt',n.created_at,'readAt',n.read_at) ORDER BY n.created_at DESC),'[]'::jsonb)
    FROM public.notifications n JOIN public.reminders r ON r.id=n.reminder_id
    WHERE n.commune_id=p_commune_id AND n.recipient_user_id=p_actor;
$$;
-- The sender's own recent reminders, so every entry point can show the same
-- "last sent" record and email state. Never another member's reminders.
CREATE FUNCTION commune_private.snapshot_sent_reminders(p_commune_id uuid, p_actor text)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'sourceId',r.source_id,'recipientUserId',r.recipient_user_id,'amountMinor',r.amount_minor,'createdAt',r.created_at,
      'emailStatus',commune_private.reminder_email_state(r.id)) ORDER BY r.created_at DESC),'[]'::jsonb)
    FROM (SELECT * FROM public.reminders sent WHERE sent.commune_id=p_commune_id AND sent.sender_user_id=p_actor
      AND sent.created_at > now() - interval '30 days' ORDER BY sent.created_at DESC LIMIT 50) r;
$$;
REVOKE ALL ON FUNCTION commune_private.snapshot_expenses(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION commune_private.snapshot_operations(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION commune_private.snapshot_notifications(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION commune_private.snapshot_sent_reminders(uuid, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.commune_snapshot(p_commune_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_actor text:=commune_private.data_api_user_id();v_result jsonb;
BEGIN
  IF NOT public.is_commune_member(p_commune_id) THEN RAISE EXCEPTION 'Not a commune member' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object(
    'commune',jsonb_build_object('id',co.id,'name',co.name,'kind',co.kind,'currency',co.currency,'address',co.address,'destination',co.destination,'stayName',co.stay_name,'stayAddress',co.stay_address,'role',m.role,
      'memberCount',(SELECT count(*) FROM public.commune_members cm WHERE cm.commune_id=co.id AND cm.active)),
    'members',coalesce((SELECT jsonb_agg(jsonb_build_object('userId',mp.id,'name',mp.name,'email',mp.email,'role',mp.role,'active',mp.active)) FROM public.member_profiles_with_status(co.id) mp),'[]'::jsonb),
    'expenses',commune_private.snapshot_expenses(co.id),
    'funds',coalesce((SELECT jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'targetMinor',f.target_minor,'createdBy',f.created_by,'archivedAt',f.archived_at,
      'commitments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'userId',c.user_id,'amountMinor',c.amount_minor,'dueOn',c.due_on,'cancelledAt',c.cancelled_at,
        'contributedMinor',(SELECT coalesce(sum(fc.amount_minor),0) FROM public.fund_contributions fc WHERE fc.commitment_id=c.id AND fc.voided_at IS NULL),
        'contributions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',fc.id,'amountMinor',fc.amount_minor,'contributedAt',fc.contributed_at,'voidedAt',fc.voided_at,'voidReason',fc.void_reason) ORDER BY fc.contributed_at DESC) FROM public.fund_contributions fc WHERE fc.commitment_id=c.id),'[]'::jsonb)) ORDER BY c.created_at) FROM public.fund_commitments c WHERE c.fund_id=f.id),'[]'::jsonb)) ORDER BY f.created_at DESC) FROM public.funds f WHERE f.commune_id=co.id),'[]'::jsonb),
    'notifications',commune_private.snapshot_notifications(co.id,v_actor),
    'reminderTargets',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',rt.kind,'sourceId',rt.source_id,'recipientUserId',rt.recipient_user_id,'amountMinor',rt.amount_minor,'currency',rt.currency,'label',rt.label,'dueOn',rt.due_on,'lastSentAt',rt.last_sent_at)) FROM public.list_reminder_targets(co.id) rt),'[]'::jsonb),
    'sentReminders',commune_private.snapshot_sent_reminders(co.id,v_actor),
    'notes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'title',n.title,'pill',n.pill,'kicker',n.kicker,'lede',n.lede,'body',n.body,'facts',n.facts) ORDER BY n.created_at DESC) FROM public.commune_notes n WHERE n.commune_id=co.id),'[]'::jsonb),
    'operations',commune_private.snapshot_operations(co.id),
    'recurringBills',coalesce((SELECT jsonb_agg(jsonb_build_object('id',b.id,'title',b.title,'amountMinor',b.amount_minor,'paidByUserId',b.paid_by_user_id,'allocations',(SELECT jsonb_agg(jsonb_build_object('userId',s->>'user_id','amountMinor',(s->>'amount_minor')::bigint)) FROM jsonb_array_elements(b.shares) s),'frequency',b.frequency,'nextDueOn',b.next_due_on,'paused',b.paused,'createdBy',b.created_by) ORDER BY b.next_due_on) FROM public.recurring_bills b WHERE b.commune_id=co.id),'[]'::jsonb),
    'splitTemplates',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'method',t.method,'participants',(SELECT jsonb_agg(jsonb_build_object('userId',p->>'user_id','value',coalesce(p->>'value',''))) FROM jsonb_array_elements(t.participants) p),'createdBy',t.created_by,'archivedAt',t.archived_at) ORDER BY t.created_at DESC) FROM public.split_templates t WHERE t.commune_id=co.id),'[]'::jsonb),
    'activityEvents',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'actorId',a.actor_id,'kind',a.kind,'entityId',a.entity_id,'title',a.title,'description',a.description,'createdAt',a.created_at) ORDER BY a.created_at DESC) FROM (SELECT * FROM public.commune_events ev WHERE ev.commune_id=co.id ORDER BY ev.created_at DESC LIMIT 100) a),'[]'::jsonb)
  ) INTO v_result FROM public.communes co JOIN public.commune_members m ON m.commune_id=co.id AND m.user_id=v_actor AND m.active WHERE co.id=p_commune_id;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Commune not found' USING ERRCODE='42501'; END IF;
  RETURN v_result;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
