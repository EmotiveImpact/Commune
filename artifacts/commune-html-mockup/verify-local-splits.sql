-- Local acceptance check only; every write rolls back.
BEGIN;
DO $$
DECLARE
  commune_id uuid;
  members text[];
  expense_id uuid;
  actual bigint[];
BEGIN
  SELECT m.commune_id, array_agg(m.user_id::text ORDER BY m.user_id)
    INTO commune_id, members FROM public.commune_members m
    GROUP BY m.commune_id HAVING count(*) >= 2 LIMIT 1;
  IF commune_id IS NULL THEN RAISE EXCEPTION 'Need a local household with two members'; END IF;
  PERFORM set_config('request.jwt.sub', members[1], true);
  SET LOCAL ROLE authenticated;
  expense_id := public.create_expense(commune_id, 'Rollback-only allocation check', 1000,
    jsonb_build_array(jsonb_build_object('user_id',members[1],'amount_minor',425),jsonb_build_object('user_id',members[2],'amount_minor',575)), NULL);
  SELECT array_agg(amount_minor ORDER BY amount_minor) INTO actual FROM public.expense_shares WHERE expense_shares.expense_id = expense_id;
  IF actual IS DISTINCT FROM ARRAY[425,575]::bigint[] THEN RAISE EXCEPTION 'Incorrect stored allocations'; END IF;
  RAISE NOTICE 'Exact allocations stored correctly under authenticated role; rolling back.';
END $$;
ROLLBACK;
