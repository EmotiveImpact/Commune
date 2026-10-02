-- One bounded, membership-scoped search for the web quick finder and full page.
-- No table grants are widened. Note facts and sensitive note bodies never enter
-- the index or the search response; member email addresses are not searchable.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE FUNCTION commune_private.note_search_excerpt(p_pill text, p_body text, p_lede text, p_facts jsonb)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = pg_catalog AS $$
  SELECT CASE
    WHEN p_pill = 'Wi-Fi' THEN 'Network and password. Open to view connection details.'
    WHEN p_pill = 'Keys / door' THEN 'Access details. Open to view.'
    WHEN p_pill IN ('Contacts', 'Landlord', 'Emergency') THEN 'Contact details. Open to view.'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(p_facts) f
      WHERE f->>0 ~* 'password|passcode|door code|access code|pin code')
      THEN 'Shared details. Open to view.'
    ELSE left(coalesce(nullif(p_body, ''), p_lede, ''), 160)
  END;
$$;
REVOKE ALL ON FUNCTION commune_private.note_search_excerpt(text,text,text,jsonb) FROM PUBLIC;
-- Inserts/updates maintain this expression index as the authenticated role.
-- The immutable helper only transforms its arguments; it cannot read any table.
GRANT EXECUTE ON FUNCTION commune_private.note_search_excerpt(text,text,text,jsonb) TO authenticated;

CREATE INDEX expenses_search_idx ON public.expenses USING gin
  ((title || ' ' || category) public.gin_trgm_ops);
CREATE INDEX notes_search_idx ON public.commune_notes USING gin
  ((title || ' ' || CASE WHEN pill = 'Landlord' THEN 'Contacts' ELSE pill END || ' ' ||
    commune_private.note_search_excerpt(pill,body,lede,facts)) public.gin_trgm_ops);
CREATE INDEX operations_search_idx ON public.commune_operations USING gin
  ((title || ' ' || category) public.gin_trgm_ops);
CREATE INDEX funds_search_idx ON public.funds USING gin (name public.gin_trgm_ops)
  WHERE archived_at IS NULL;
CREATE INDEX recurring_search_idx ON public.recurring_bills USING gin (title public.gin_trgm_ops);
CREATE INDEX templates_search_idx ON public.split_templates USING gin
  ((name || ' ' || method) public.gin_trgm_ops) WHERE archived_at IS NULL;

CREATE FUNCTION public.search_commune_records(p_query text, p_commune_id uuid DEFAULT NULL, p_limit integer DEFAULT 8)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
      NULL::bigint AS amount_minor, co.currency, co.name || ' ' || co.kind AS searchable
      FROM allowed co
    UNION ALL
    SELECT 'expense', e.id::text, co.id, co.name, e.title, e.category,
      CASE WHEN EXISTS(SELECT 1 FROM public.expense_shares s WHERE s.expense_id=e.id AND s.settled_minor<s.amount_minor)
        THEN 'Open' ELSE 'Settled' END, e.amount_minor, co.currency, e.title || ' ' || e.category
      FROM public.expenses e JOIN allowed co ON co.id=e.commune_id
    UNION ALL
    SELECT 'note', n.id::text, co.id, co.name, n.title,
      commune_private.note_search_excerpt(n.pill,n.body,n.lede,n.facts),
      CASE WHEN n.pill='Landlord' THEN 'Contacts' ELSE n.pill END,
      NULL::bigint, co.currency, n.title || ' ' || CASE WHEN n.pill='Landlord' THEN 'Contacts' ELSE n.pill END || ' ' ||
        commune_private.note_search_excerpt(n.pill,n.body,n.lede,n.facts)
      FROM public.commune_notes n JOIN allowed co ON co.id=n.commune_id
    UNION ALL
    SELECT 'operation', o.id::text, co.id, co.name, o.title, o.category,
      initcap(o.kind) || ' · ' || o.date::text, NULL::bigint, co.currency, o.title || ' ' || o.category
      FROM public.commune_operations o JOIN allowed co ON co.id=o.commune_id
    UNION ALL
    SELECT 'fund', f.id::text, co.id, co.name, f.name, 'Shared fund',
      CASE WHEN f.target_minor IS NULL THEN 'No target' ELSE 'Target' END,
      f.target_minor, co.currency, f.name
      FROM public.funds f JOIN allowed co ON co.id=f.commune_id WHERE f.archived_at IS NULL
    UNION ALL
    SELECT 'recurring', b.id::text, co.id, co.name, b.title, initcap(b.frequency),
      CASE WHEN b.paused THEN 'Paused' ELSE 'Due ' || b.next_due_on::text END,
      b.amount_minor, co.currency, b.title
      FROM public.recurring_bills b JOIN allowed co ON co.id=b.commune_id
    UNION ALL
    SELECT 'member', m.user_id, co.id, co.name, coalesce(u.name,'Member'), 'Commune member',
      initcap(m.role), NULL::bigint, co.currency, coalesce(u.name,'')
      FROM public.commune_members m JOIN allowed co ON co.id=m.commune_id
      LEFT JOIN neon_auth."user" u ON u.id::text=m.user_id WHERE m.active
    UNION ALL
    SELECT 'template', t.id::text, co.id, co.name, t.name, 'Saved split',
      t.method, NULL::bigint, co.currency, t.name || ' ' || t.method
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
      'meta',meta,'amountMinor',amount_minor,'currency',currency) ORDER BY kind,position)
      FROM ranked WHERE position<=p_limit),'[]'::jsonb),
    'total',(SELECT count(*) FROM matches),
    'hasMore',EXISTS(SELECT 1 FROM ranked WHERE position>p_limit)) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.search_commune_records(text,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_commune_records(text,uuid,integer) TO authenticated;
COMMIT;
