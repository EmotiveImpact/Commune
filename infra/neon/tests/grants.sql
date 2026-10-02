-- Run after migrations in an isolated database. This tests database grants,
-- not the Neon Data API's runtime role mapping or signed-JWT RLS behavior.
BEGIN;

DO $$
DECLARE
  table_name text;
  denied_tables text[] := ARRAY[
    'communes', 'commune_members', 'expenses', 'expense_shares',
    'funds', 'fund_commitments', 'fund_contributions',
    'reminders', 'notifications', 'reminder_email_outbox',
    'commune_invites', 'recurring_bills', 'recurring_bill_occurrences',
    'split_templates', 'commune_events'
  ];
BEGIN
  FOREACH table_name IN ARRAY denied_tables LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class
      WHERE oid = format('public.%I', table_name)::regclass) THEN
      RAISE EXCEPTION 'RLS is disabled on public.%', table_name;
    END IF;
    IF has_table_privilege('authenticated',
        format('public.%I', table_name), 'INSERT')
      OR has_table_privilege('authenticated',
        format('public.%I', table_name), 'UPDATE')
      OR has_table_privilege('authenticated',
        format('public.%I', table_name), 'DELETE') THEN
      RAISE EXCEPTION 'Direct authenticated write grant on public.%', table_name;
    END IF;
  END LOOP;

  IF has_function_privilege('anonymous', 'public.commune_snapshot(uuid)', 'EXECUTE')
    OR NOT has_function_privilege('authenticated', 'public.commune_snapshot(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected snapshot execution grant';
  END IF;
  IF has_function_privilege('anonymous', 'public.create_expense_for(uuid,text,bigint,jsonb,date,text,text)', 'EXECUTE')
    OR has_function_privilege('anonymous', 'public.manage_commune_member(uuid,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous workflow execution grant';
  END IF;

  FOREACH table_name IN ARRAY ARRAY['commune_notes', 'commune_operations'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class
      WHERE oid = format('public.%I', table_name)::regclass) THEN
      RAISE EXCEPTION 'RLS is disabled on public.%', table_name;
    END IF;
    IF has_table_privilege('authenticated',
        format('public.%I', table_name), 'INSERT')
      OR has_table_privilege('authenticated',
        format('public.%I', table_name), 'UPDATE') THEN
      RAISE EXCEPTION 'Broad authenticated write grant on public.%', table_name;
    END IF;
    IF NOT has_column_privilege('authenticated',
        format('public.%I', table_name), 'title', 'INSERT')
      OR NOT has_column_privilege('authenticated',
        format('public.%I', table_name), 'title', 'UPDATE')
      OR has_column_privilege('authenticated',
        format('public.%I', table_name), 'commune_id', 'UPDATE')
      OR has_column_privilege('authenticated',
        format('public.%I', table_name), 'created_by', 'UPDATE') THEN
      RAISE EXCEPTION 'Unexpected column grants on public.%', table_name;
    END IF;
  END LOOP;
END;
$$;

ROLLBACK;
