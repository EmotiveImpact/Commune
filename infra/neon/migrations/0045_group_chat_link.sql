-- Group chat link: Commune leaves the chatting to the WhatsApp group a house
-- already has. An admin pastes the group's invite link
-- (https://chat.whatsapp.com/...) and every member gets "Open group chat".
-- Only WhatsApp group invite links are accepted, so the field cannot carry
-- any other address. Members read it from my_communes() and the snapshot;
-- it is never shown to anyone outside the commune.
-- Numbered 0045 so it cannot collide with 0044 (join codes, on its own
-- branch). It restates my_communes() (0039) and commune_snapshot() (0042)
-- in full with the one new field.
BEGIN;

ALTER TABLE public.communes ADD COLUMN chat_link text NOT NULL DEFAULT ''
  CONSTRAINT communes_chat_link_check
  CHECK (chat_link = '' OR chat_link ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]{10,40}$');

-- Set the group chat link, or pass an empty one to remove it. Accepts what
-- people paste: with or without https://, with a trailing ?mode=... or a
-- slash. Saving the same link again is harmless. Returns the link as stored.
CREATE FUNCTION public.set_commune_chat_link(p_commune_id uuid, p_link text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_link text := btrim(coalesce(p_link, ''));
  v_code text;
BEGIN
  IF NOT public.is_commune_admin(p_commune_id) THEN
    RAISE EXCEPTION 'Only a commune admin can change the group chat link' USING ERRCODE = '42501';
  END IF;
  IF v_link <> '' THEN
    v_code := substring(v_link FROM '^(?:https?://)?(?:www\.)?chat\.whatsapp\.com/(?:invite/)?([A-Za-z0-9]{10,40})/?(?:[?#].*)?$');
    IF v_code IS NULL THEN
      RAISE EXCEPTION 'Paste a WhatsApp group invite link. It starts with https://chat.whatsapp.com/' USING ERRCODE = '22023';
    END IF;
    v_link := 'https://chat.whatsapp.com/' || v_code;
  END IF;
  UPDATE public.communes SET chat_link = v_link
    WHERE id = p_commune_id AND chat_link IS DISTINCT FROM v_link;
  RETURN v_link;
END;
$$;

-- The caller's communes, now with the group chat link.
CREATE OR REPLACE FUNCTION public.my_communes()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'kind', c.kind, 'currency', c.currency,
      'address', c.address, 'destination', c.destination, 'stayName', c.stay_name, 'stayAddress', c.stay_address,
      'chatLink', c.chat_link,
      'role', m.role, 'memberCount', (SELECT count(*) FROM public.commune_members cm WHERE cm.commune_id = c.id AND cm.active),
      'changeMark', commune_private.change_mark(c.id),
      'unreadNotices', commune_private.unread_notice_count(c.id, m.user_id)) ORDER BY c.created_at DESC, c.id), '[]'::jsonb)
    FROM public.commune_members m JOIN public.communes c ON c.id = m.commune_id
    WHERE m.user_id = commune_private.data_api_user_id() AND m.active;
$$;

-- The open commune's snapshot carries it too, in full as before with one
-- field added: 'chatLink' beside the location.
CREATE OR REPLACE FUNCTION public.commune_snapshot(p_commune_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_actor text:=commune_private.data_api_user_id();v_result jsonb;
BEGIN
  IF NOT public.is_commune_member(p_commune_id) THEN RAISE EXCEPTION 'Not a commune member' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object(
    'commune',jsonb_build_object('id',co.id,'name',co.name,'kind',co.kind,'currency',co.currency,'address',co.address,'destination',co.destination,'stayName',co.stay_name,'stayAddress',co.stay_address,'chatLink',co.chat_link,'role',m.role,
      'memberCount',(SELECT count(*) FROM public.commune_members cm WHERE cm.commune_id=co.id AND cm.active),
      'currencyLockedBy',to_jsonb(commune_private.currency_locked_by(co.id)),
      'unreadNotices',commune_private.unread_notice_count(co.id,v_actor)),
    'members',coalesce((SELECT jsonb_agg(jsonb_build_object('userId',mp.id,'name',mp.name,'email',mp.email,'role',mp.role,'active',mp.active)) FROM public.member_profiles_with_status(co.id) mp),'[]'::jsonb),
    'expenses',commune_private.snapshot_expenses(co.id),
    'expenseHistory',commune_private.expense_history(co.id),'changeMark',commune_private.change_mark(co.id),
    'funds',coalesce((SELECT jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'targetMinor',f.target_minor,'createdBy',f.created_by,'archivedAt',f.archived_at,
      'commitments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'userId',c.user_id,'amountMinor',c.amount_minor,'dueOn',c.due_on,'cancelledAt',c.cancelled_at,
        'contributedMinor',(SELECT coalesce(sum(fc.amount_minor),0) FROM public.fund_contributions fc WHERE fc.commitment_id=c.id AND fc.voided_at IS NULL),
        'contributions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',fc.id,'amountMinor',fc.amount_minor,'contributedAt',fc.contributed_at,'voidedAt',fc.voided_at,'voidReason',fc.void_reason) ORDER BY fc.contributed_at DESC) FROM public.fund_contributions fc WHERE fc.commitment_id=c.id),'[]'::jsonb)) ORDER BY c.created_at) FROM public.fund_commitments c WHERE c.fund_id=f.id),'[]'::jsonb)) ORDER BY f.created_at DESC) FROM public.funds f WHERE f.commune_id=co.id),'[]'::jsonb),
    'notifications',commune_private.snapshot_notifications(co.id,v_actor),
    'reminderTargets',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',rt.kind,'sourceId',rt.source_id,'recipientUserId',rt.recipient_user_id,'amountMinor',rt.amount_minor,'currency',rt.currency,'label',rt.label,'dueOn',rt.due_on,'lastSentAt',rt.last_sent_at)) FROM public.list_reminder_targets(co.id) rt),'[]'::jsonb),
    'sentReminders',commune_private.snapshot_sent_reminders(co.id,v_actor),
    'notes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'title',n.title,'pill',n.pill,'kicker',n.kicker,'lede',n.lede,'body',n.body,'facts',n.facts,
      'version',n.version,'createdBy',n.created_by,'updatedBy',n.updated_by,'updatedAt',n.updated_at,
      'revisions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'version',r.version,'title',r.title,'editedBy',r.edited_by,'editedAt',r.edited_at,
          'replacedBy',r.replaced_by,'replacedAt',r.replaced_at) ORDER BY r.version DESC)
        FROM (SELECT * FROM public.note_revisions x WHERE x.note_id=n.id ORDER BY x.version DESC LIMIT 10) r),'[]'::jsonb)) ORDER BY n.created_at DESC) FROM public.commune_notes n WHERE n.commune_id=co.id AND n.deleted_at IS NULL),'[]'::jsonb),
    'operations',commune_private.snapshot_operations(co.id),
    'announcements',commune_private.snapshot_announcements(co.id),
    'payLinks',commune_private.snapshot_pay_links(co.id),
    'recurringBills',coalesce((SELECT jsonb_agg(jsonb_build_object('id',b.id,'title',b.title,'amountMinor',b.amount_minor,'paidByUserId',b.paid_by_user_id,'allocations',(SELECT jsonb_agg(jsonb_build_object('userId',s->>'user_id','amountMinor',(s->>'amount_minor')::bigint)) FROM jsonb_array_elements(b.shares) s),'frequency',b.frequency,'nextDueOn',b.next_due_on,'paused',b.paused,'createdBy',b.created_by,'version',b.version,'archivedAt',b.archived_at,
      'history',coalesce((SELECT jsonb_agg(jsonb_build_object('dueOn',h.due_on,'status',h.status,'amountMinor',h.amount_minor,'expenseId',h.expense_id,
        'actorId',h.actor_id,'actedAt',h.acted_at,'note',h.note) ORDER BY h.due_on DESC)
        FROM (SELECT * FROM public.recurring_bill_occurrences x WHERE x.bill_id=b.id ORDER BY x.due_on DESC LIMIT 12) h),'[]'::jsonb)) ORDER BY b.next_due_on) FROM public.recurring_bills b WHERE b.commune_id=co.id),'[]'::jsonb),
    'splitTemplates',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'method',t.method,'participants',(SELECT jsonb_agg(jsonb_build_object('userId',p->>'user_id','value',coalesce(p->>'value',''))) FROM jsonb_array_elements(t.participants) p),'createdBy',t.created_by,'archivedAt',t.archived_at) ORDER BY t.created_at DESC) FROM public.split_templates t WHERE t.commune_id=co.id),'[]'::jsonb),
    'activityEvents',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'actorId',a.actor_id,'kind',a.kind,'entityId',a.entity_id,'title',a.title,'description',a.description,'createdAt',a.created_at,'recordType',commune_private.activity_record_type(a.id)) ORDER BY a.created_at DESC) FROM ((SELECT ev.id, ev.actor_id, ev.kind, ev.entity_id, ev.title, ev.description, ev.created_at
        FROM public.commune_events ev WHERE ev.commune_id=co.id ORDER BY ev.created_at DESC LIMIT 100)
      UNION (SELECT ev.id, ev.actor_id, ev.kind, ev.entity_id, ev.title, ev.description, ev.created_at
        FROM public.commune_events ev WHERE ev.commune_id=co.id
          AND commune_private.money_correction_reserve(ev.kind, ev.description, ev.details) = 'correction'
          AND ev.created_at > now() - interval '90 days' ORDER BY ev.created_at DESC LIMIT 50)
      UNION (SELECT ev.id, ev.actor_id, ev.kind, ev.entity_id, ev.title, ev.description, ev.created_at
        FROM public.commune_events ev WHERE ev.commune_id=co.id
          AND commune_private.money_correction_reserve(ev.kind, ev.description, ev.details) = 'reversal'
          AND ev.created_at > now() - interval '90 days' ORDER BY ev.created_at DESC LIMIT 50)) a),'[]'::jsonb)
  ) INTO v_result FROM public.communes co JOIN public.commune_members m ON m.commune_id=co.id AND m.user_id=v_actor AND m.active WHERE co.id=p_commune_id;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Commune not found' USING ERRCODE='42501'; END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.my_communes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_communes() TO authenticated;
REVOKE ALL ON FUNCTION public.commune_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commune_snapshot(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.set_commune_chat_link(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_commune_chat_link(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
