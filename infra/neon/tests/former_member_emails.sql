-- Former members' email addresses (0031). Run only in an empty disposable
-- local DB built from infra/neon/tests/local_auth_stub.sql and every
-- migration. Everything is rolled back.
BEGIN;

DO $$
DECLARE v_home uuid; v_members jsonb;
BEGIN
  INSERT INTO neon_auth."user" (id, name, email, "emailVerified") VALUES
    ('former-alice', 'Alice', 'alice@former.test', true), ('former-bea', 'Bea', 'bea@former.test', true),
    ('former-cal', 'Cal', 'cal@former.test', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'former-alice', 'role', 'authenticated')::text, true);
  v_home := public.create_commune('Former home', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role) VALUES (v_home, 'former-bea', 'member');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'former-bea', 'role', 'authenticated')::text, true);
  PERFORM public.manage_commune_member(v_home, 'former-bea', 'leave');
  -- Cal joins after Bea has left.
  INSERT INTO public.commune_members (commune_id, user_id, role) VALUES (v_home, 'former-cal', 'member');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'former-cal', 'role', 'authenticated')::text, true);

  v_members := public.commune_snapshot(v_home)->'members';
  IF (SELECT m->>'email' FROM jsonb_array_elements(v_members) m WHERE m->>'userId' = 'former-bea') IS NOT NULL
     OR (SELECT m->>'name' FROM jsonb_array_elements(v_members) m WHERE m->>'userId' = 'former-bea') <> 'Bea' THEN
    RAISE EXCEPTION 'A former member should keep their name and lose their email: %', v_members;
  END IF;
  IF (SELECT m->>'email' FROM jsonb_array_elements(v_members) m WHERE m->>'userId' = 'former-alice') <> 'alice@former.test' THEN
    RAISE EXCEPTION 'A current member lost their email: %', v_members;
  END IF;
  IF (SELECT p.email FROM public.member_profiles(v_home) p WHERE p.id = 'former-bea') IS NOT NULL
     OR (SELECT p.email FROM public.member_profiles(v_home) p WHERE p.id = 'former-cal') <> 'cal@former.test' THEN
    RAISE EXCEPTION 'Member profiles still show a former member''s email';
  END IF;
END;
$$;

ROLLBACK;
