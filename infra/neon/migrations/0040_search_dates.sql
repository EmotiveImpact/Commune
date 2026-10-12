-- The quick finder writes dates the way every screen does (app review
-- finding 47). search_commune_records put dates in its text as the database
-- writes them: "Due 2026-11-04" for a recurring bill, "Task · 2026-11-04" for
-- a task or event. Each result now also carries:
--   label  its words without the date ("Due", "Task", "Open", "Target")
--   date   the date on its own, YYYY-MM-DD, or null
-- so the app writes the date as it does everywhere else ("4 Nov", with the
-- year when it is not this year). meta keeps the old text, unchanged, for the
-- app versions released before this one; a later migration can drop it once
-- no client reads it. The function is otherwise as 0030 left it (the latest
-- definition, written out in full). Apply after 0039.
BEGIN;

CREATE OR REPLACE FUNCTION public.search_commune_records(p_query text, p_commune_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 8)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_query text := btrim(coalesce(p_query, ''));
  v_pattern text;
  v_result jsonb;
BEGIN
  IF v_actor IS NULL OR v_actor = '' THEN
    RAISE EXCEPTION 'Sign in to search' USING ERRCODE = '42501';
  END IF;
  IF p_commune_id IS NOT NULL AND NOT public.is_commune_member(p_commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  IF length(v_query) > 80 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 25 THEN
    RAISE EXCEPTION 'Invalid search query or result limit' USING ERRCODE = '22023';
  END IF;
  IF length(v_query) < 2 THEN
    RETURN jsonb_build_object('query',v_query,'items','[]'::jsonb,'total',0,'hasMore',false);
  END IF;
  -- Treat %, _ and backslash as literal user text, never SQL wildcards.
  v_pattern := '%' || replace(replace(replace(v_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  WITH allowed AS MATERIALIZED (
    SELECT co.id, co.name, co.kind, co.currency FROM public.communes co
    JOIN public.commune_members m ON m.commune_id = co.id
    WHERE m.user_id = v_actor AND m.active
      AND (p_commune_id IS NULL OR co.id = p_commune_id)
  ), records AS NOT MATERIALIZED (
    SELECT 'commune'::text AS kind, co.id::text AS id, co.id AS commune_id, co.name AS commune_name,
      co.name AS title, initcap(co.kind) AS subtitle, 'Commune'::text AS meta,
      'Commune'::text AS label, NULL::date AS on_date,
      NULL::bigint AS amount_minor, co.currency, co.name || ' ' || co.kind AS searchable
      FROM allowed co
    UNION ALL
    SELECT 'expense', e.id::text, co.id, co.name, e.title, e.category,
      CASE WHEN e.voided_at IS NOT NULL THEN 'Voided' WHEN EXISTS(SELECT 1 FROM public.expense_shares s WHERE s.expense_id=e.id AND s.settled_minor<s.amount_minor)
        THEN 'Open' ELSE 'Settled' END,
      CASE WHEN e.voided_at IS NOT NULL THEN 'Voided' WHEN EXISTS(SELECT 1 FROM public.expense_shares s WHERE s.expense_id=e.id AND s.settled_minor<s.amount_minor)
        THEN 'Open' ELSE 'Settled' END, NULL::date,
      e.amount_minor, co.currency, e.title || ' ' || e.category
      FROM public.expenses e JOIN allowed co ON co.id=e.commune_id
    UNION ALL
    SELECT 'note', n.id::text, co.id, co.name, n.title,
      commune_private.note_search_excerpt(n.pill,n.body,n.lede,n.facts),
      CASE WHEN n.pill='Landlord' THEN 'Contacts' ELSE n.pill END,
      CASE WHEN n.pill='Landlord' THEN 'Contacts' ELSE n.pill END, NULL::date,
      NULL::bigint, co.currency, n.title || ' ' || CASE WHEN n.pill='Landlord' THEN 'Contacts' ELSE n.pill END || ' ' ||
        commune_private.note_search_excerpt(n.pill,n.body,n.lede,n.facts)
      FROM public.commune_notes n JOIN allowed co ON co.id=n.commune_id WHERE n.deleted_at IS NULL
    UNION ALL
    SELECT 'operation', o.id::text, co.id, co.name, o.title, o.category,
      initcap(o.kind) || ' · ' || o.date::text, initcap(o.kind), o.date,
      NULL::bigint, co.currency, o.title || ' ' || o.category
      FROM public.commune_operations o JOIN allowed co ON co.id=o.commune_id WHERE o.deleted_at IS NULL
    UNION ALL
    SELECT 'fund', f.id::text, co.id, co.name, f.name, 'Shared fund',
      CASE WHEN f.target_minor IS NULL THEN 'No target' ELSE 'Target' END,
      CASE WHEN f.target_minor IS NULL THEN 'No target' ELSE 'Target' END, NULL::date,
      f.target_minor, co.currency, f.name
      FROM public.funds f JOIN allowed co ON co.id=f.commune_id WHERE f.archived_at IS NULL
    UNION ALL
    SELECT 'recurring', b.id::text, co.id, co.name, b.title, initcap(b.frequency),
      CASE WHEN b.paused THEN 'Paused' ELSE 'Due ' || b.next_due_on::text END,
      CASE WHEN b.paused THEN 'Paused' ELSE 'Due' END, CASE WHEN b.paused THEN NULL ELSE b.next_due_on END,
      b.amount_minor, co.currency, b.title
      FROM public.recurring_bills b JOIN allowed co ON co.id=b.commune_id
    UNION ALL
    SELECT 'member', m.user_id, co.id, co.name, coalesce(u.name,'Member'), 'Commune member',
      initcap(m.role), initcap(m.role), NULL::date, NULL::bigint, co.currency, coalesce(u.name,'')
      FROM public.commune_members m JOIN allowed co ON co.id=m.commune_id
      LEFT JOIN commune_private.accounts(ARRAY(SELECT x.user_id FROM public.commune_members x JOIN allowed a ON a.id=x.commune_id WHERE x.active)) u ON u.id=m.user_id WHERE m.active
    UNION ALL
    SELECT 'template', t.id::text, co.id, co.name, t.name, 'Saved split',
      t.method, t.method, NULL::date, NULL::bigint, co.currency, t.name || ' ' || t.method
      FROM public.split_templates t JOIN allowed co ON co.id=t.commune_id WHERE t.archived_at IS NULL
  ), matches AS MATERIALIZED (
    SELECT *, CASE WHEN lower(title)=lower(v_query) THEN 0
      WHEN starts_with(lower(title),lower(v_query)) THEN 1
      WHEN title ILIKE v_pattern ESCAPE E'\\' THEN 2 ELSE 3 END AS rank
      FROM records WHERE searchable ILIKE v_pattern ESCAPE E'\\'
  ), ranked AS (
    SELECT *, row_number() OVER(PARTITION BY kind ORDER BY rank,title,commune_name,id,commune_id) AS position FROM matches
  )
  SELECT jsonb_build_object('query',v_query,
    'items',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',kind,'id',id,
      'communeId',commune_id,'communeName',commune_name,'title',title,'subtitle',subtitle,
      'meta',meta,'label',label,'date',to_char(on_date,'YYYY-MM-DD'),
      'amountMinor',amount_minor,'currency',currency) ORDER BY kind,position)
      FROM ranked WHERE position<=p_limit),'[]'::jsonb),
    'total',(SELECT count(*) FROM matches),
    'hasMore',EXISTS(SELECT 1 FROM ranked WHERE position>p_limit)) INTO v_result;
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.search_commune_records(text,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_commune_records(text,uuid,integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
