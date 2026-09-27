-- Reproduce Managed Neon Auth's real UUID user IDs against the disposable
-- local stub. Older tests use text IDs and missed the hosted type boundary.
BEGIN;
ALTER TABLE neon_auth."user" ALTER COLUMN id TYPE uuid USING id::uuid;

DO $$
DECLARE
  v_admin constant text := '11111111-1111-4111-8111-111111111111';
  v_member constant text := '22222222-2222-4222-8222-222222222222';
  v_commune uuid;
  v_token text;
  v_count integer;
BEGIN
  INSERT INTO neon_auth."user" (id, name, email, "emailVerified") VALUES
    (v_admin::uuid, 'Admin', 'uuid-admin@example.test', true),
    (v_member::uuid, 'Member', 'uuid-member@example.test', true);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_commune := public.create_commune('UUID boundary', 'household', 'GBP');
  SELECT count(*) INTO v_count FROM public.member_profiles(v_commune);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Admin profile did not load through UUID Auth ID';
  END IF;

  v_token := public.create_commune_invite(
    v_commune, 'uuid-member@example.test', 'member');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_member, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_count FROM public.preview_commune_invite(v_token);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Verified UUID Auth user could not preview invite';
  END IF;
  IF public.accept_commune_invite(v_token) IS DISTINCT FROM v_commune THEN
    RAISE EXCEPTION 'Verified UUID Auth user could not accept invite';
  END IF;
  SELECT count(*) INTO v_count FROM public.member_profiles(v_commune);
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Member profiles did not load through UUID Auth IDs';
  END IF;
END;
$$;

ROLLBACK;
