-- The Data API (PostgREST) verifies the JWT before setting transaction-local
-- request.jwt.claims. Read that verified identity directly. Loading the Neon
-- identity extension inside SECURITY DEFINER on a fresh connection can discard
-- those claims and falsely reject a member. Reproduced on a production branch.
-- https://github.com/neondatabase/pg_session_jwt/issues/51
-- https://docs.postgrest.org/en/stable/references/transactions.html
-- Neon Auth, JWT verification, RLS and business permissions remain unchanged.
BEGIN;
CREATE SCHEMA IF NOT EXISTS commune_private;
REVOKE ALL ON SCHEMA commune_private FROM PUBLIC;
GRANT USAGE ON SCHEMA commune_private TO authenticated;

CREATE OR REPLACE FUNCTION commune_private.data_api_user_id()
RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE v_claims jsonb; v_user text;
BEGIN
  v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_user := v_claims ->> 'sub';
  IF jsonb_typeof(v_claims -> 'sub') IS DISTINCT FROM 'string' OR nullif(v_user, '') IS NULL THEN
    RAISE EXCEPTION 'Request identity could not be verified' USING ERRCODE = '28000';
  END IF;
  RETURN v_user;
EXCEPTION WHEN invalid_text_representation THEN
  RAISE EXCEPTION 'Request identity could not be verified' USING ERRCODE = '28000';
END;
$$;
REVOKE ALL ON FUNCTION commune_private.data_api_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION commune_private.data_api_user_id() TO authenticated;

-- Preserve signatures, owners, grants, business rules and security settings.
-- Replace ONLY the accessor, in this explicitly audited set of functions.
DO $$
DECLARE signature text; definition text;
  targets text[] := ARRAY[
    'public.accept_commune_invite(text)',
    'public.confirm_expense_share(uuid)',
    'public.create_commune(text,text,text)',
    'public.create_commune_invite(uuid,text,text)',
    'public.create_expense(uuid,text,bigint,jsonb,date)',
    'public.create_fund(uuid,text,bigint)',
    'public.is_commune_admin(uuid)',
    'public.is_commune_member(uuid)',
    'public.list_reminder_targets(uuid)',
    'public.mark_notification_read(uuid)',
    'public.pledge_fund(uuid,bigint,date)',
    'public.preview_commune_invite(text)',
    'public.record_fund_contribution(uuid,bigint)',
    'public.reminder_usage()',
    'public.send_reminder(text,uuid)'
  ];
BEGIN
  FOREACH signature IN ARRAY targets LOOP
    definition := pg_get_functiondef(signature::regprocedure);
    IF position('auth.user_id()' IN definition) = 0
       AND position('commune_private.data_api_user_id()' IN definition) = 0 THEN
      RAISE EXCEPTION 'Unexpected identity implementation in %', signature;
    END IF;
    EXECUTE replace(definition, 'auth.user_id()', 'commune_private.data_api_user_id()');
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind='f' AND p.prosrc LIKE '%auth.user_id()%'
  ) THEN RAISE EXCEPTION 'Unmigrated identity reference in public function'; END IF;
END;
$$;

ALTER POLICY reminder_read ON public.reminders
  USING (sender_user_id = commune_private.data_api_user_id() OR recipient_user_id = commune_private.data_api_user_id());
ALTER POLICY notification_read ON public.notifications
  USING (recipient_user_id = commune_private.data_api_user_id());
ALTER POLICY preferences_read ON public.notification_preferences
  USING (user_id = commune_private.data_api_user_id());
ALTER POLICY preferences_insert ON public.notification_preferences
  WITH CHECK (user_id = commune_private.data_api_user_id());
ALTER POLICY preferences_update ON public.notification_preferences
  USING (user_id = commune_private.data_api_user_id()) WITH CHECK (user_id = commune_private.data_api_user_id());
ALTER POLICY commune_notes_insert ON public.commune_notes
  WITH CHECK (public.is_commune_member(commune_id) AND created_by = commune_private.data_api_user_id());
ALTER POLICY commune_operations_insert ON public.commune_operations
  WITH CHECK (public.is_commune_member(commune_id) AND created_by = commune_private.data_api_user_id());
NOTIFY pgrst, 'reload schema';
COMMIT;
