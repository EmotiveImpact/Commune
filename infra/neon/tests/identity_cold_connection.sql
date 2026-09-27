-- Run on a disposable Neon branch, in a NEW direct database connection.
-- Do not call auth.* before this script: first-use initialization is the test.
-- No rows are changed; all request settings are transaction-local.
BEGIN;
DO $$
DECLARE m record;
BEGIN
  SELECT commune_id, user_id INTO STRICT m FROM public.commune_members LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', m.user_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('commune.test_id', m.commune_id::text, true);
END $$;
SET LOCAL ROLE authenticated;
SELECT public.is_commune_member(current_setting('commune.test_id')::uuid) AS membership_first_call;
RESET ROLE;
SELECT auth.user_id() IS NOT NULL AS identity_present,
       auth.user_id() = (current_setting('request.jwt.claims', true)::jsonb ->> 'sub') AS identity_matches_claims,
       public.is_commune_member(current_setting('commune.test_id')::uuid) AS membership_second_call;
ROLLBACK;
