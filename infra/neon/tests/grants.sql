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
    'split_templates', 'commune_events',
    'expense_share_receipts', 'expense_revisions', 'operation_occurrences', 'expense_share_payment_reports', 'note_revisions',
    'commune_announcements', 'announcement_acknowledgements'
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

  -- Money-lifecycle and occurrence and announcement commands (0015-0025): members only, never
  -- anonymous, and the private helpers are not callable by any client role.
  FOREACH table_name IN ARRAY ARRAY[
    'public.send_reminder_command(text,uuid,uuid)',
    'public.record_share_receipt(uuid,bigint,date,text,uuid)',
    'public.reverse_share_receipt(uuid,text)',
    'public.correct_expense(uuid,integer,text,bigint,jsonb,date,text,text,text,uuid)',
    'public.void_expense(uuid,integer,text,uuid)',
    'public.record_operation_occurrence(uuid,text,date,date,uuid,text)',
    'public.hand_over_operation(uuid,text,date,text,date,text,uuid)',
    'public.post_announcement(uuid,text,text,boolean,uuid)',
    'public.acknowledge_announcement(uuid)',
    'public.archive_announcement(uuid)',
    'public.undo_operation_occurrence(uuid)',
    'public.report_share_payment(uuid,bigint,date,text,uuid)',
    'public.withdraw_share_payment_report(uuid)',
    'public.resolve_share_payment_report(uuid,text,text,uuid)',
    'public.record_recurring_period(uuid,date,bigint)',
    'public.skip_recurring_period(uuid,date,text)'
  ] LOOP
    IF has_function_privilege('anonymous', table_name, 'EXECUTE')
      OR has_function_privilege('public', table_name, 'EXECUTE')
      OR NOT has_function_privilege('authenticated', table_name, 'EXECUTE') THEN
      RAISE EXCEPTION 'Unexpected execution grant on %', table_name;
    END IF;
  END LOOP;
  FOREACH table_name IN ARRAY ARRAY[
    'commune_private.snapshot_expenses(uuid)',
    'commune_private.snapshot_operations(uuid)',
    'commune_private.snapshot_notifications(uuid,text)',
    'commune_private.snapshot_sent_reminders(uuid,text)',
    'commune_private.reminder_email_state(uuid)',
    'commune_private.project_share_settlement(uuid)',
    'commune_private.notify_ledger(uuid,text,text,uuid,text,bigint,text)',
    'commune_private.expense_state(uuid)',
    'commune_private.expense_is_voided(uuid)',
    'commune_private.occurrence_result(uuid,boolean,uuid)',
    'commune_private.occurrence_reason(text)',
    'commune_private.announcement_result(uuid,boolean)',
    'commune_private.snapshot_announcements(uuid)',
    'commune_private.set_operation_anchor()',
    'commune_private.member_name(text)',
    'commune_private.member_by_name(uuid,text)',
    'commune_private.set_operation_people()',
    'commune_private.next_in_rotation(uuid,jsonb,text)',
    'commune_private.reassign_departed_member()',
    'commune_private.payment_report_result(uuid,boolean)',
    'commune_private.close_payment_reports()',
    'commune_private.scale_recurring_shares(jsonb,bigint)',
    'commune_private.recurring_next_due(text,date,integer)',
    'commune_private.recurring_period_result(uuid,date,boolean)',
    'commune_private.record_note_revision()',
    'commune_private.start_note_version()'
  ] LOOP
    IF has_function_privilege('authenticated', table_name, 'EXECUTE')
      OR has_function_privilege('anonymous', table_name, 'EXECUTE') THEN
      RAISE EXCEPTION 'Private helper % is callable by a client role', table_name;
    END IF;
  END LOOP;

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
    -- A note's version is the database's to set (0023).
    IF table_name = 'commune_notes' AND has_column_privilege('authenticated', 'public.commune_notes', 'version', 'UPDATE') THEN
      RAISE EXCEPTION 'Clients can set a note version';
    END IF;
    -- Operations people are written by id (0020); the trigger checks them.
    IF table_name = 'commune_operations' AND NOT (
        has_column_privilege('authenticated', 'public.commune_operations', 'assignee_id', 'UPDATE')
        AND has_column_privilege('authenticated', 'public.commune_operations', 'rotation_ids', 'INSERT')
        AND NOT has_column_privilege('authenticated', 'public.commune_operations', 'anchor_day', 'UPDATE')
        -- Who is covering whose turn is set only by the handover command (0024).
        AND NOT has_column_privilege('authenticated', 'public.commune_operations', 'turn_owner_id', 'INSERT')
        AND NOT has_column_privilege('authenticated', 'public.commune_operations', 'turn_owner_id', 'UPDATE')) THEN
      RAISE EXCEPTION 'Unexpected column grants on public.%', table_name;
    END IF;
  END LOOP;
END;
$$;

ROLLBACK;
