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

-- The invitations an admin sees keep an accepted one's address only while the
-- person who accepted it is still a member, and say who that was.
DO $$
DECLARE v_home uuid; v_token text; v_row record;
BEGIN
  INSERT INTO neon_auth."user" (id, name, email, "emailVerified") VALUES
    ('invited-alice', 'Alice', 'alice@invited.test', true), ('invited-bea', 'Bea', 'bea@invited.test', true),
    ('invited-cal', 'Cal', 'cal@invited.test', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'invited-alice', 'role', 'authenticated')::text, true);
  v_home := public.create_commune('Invited home', 'household', 'GBP');
  v_token := public.create_commune_invite(v_home, 'bea@invited.test', 'member');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'invited-bea', 'role', 'authenticated')::text, true);
  PERFORM public.accept_commune_invite(v_token);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'invited-alice', 'role', 'authenticated')::text, true);
  IF (SELECT i.email FROM public.list_commune_invites(v_home) i WHERE i.accepted_by = 'invited-bea') IS DISTINCT FROM 'bea@invited.test' THEN
    RAISE EXCEPTION 'A member''s accepted invitation lost its address';
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'invited-bea', 'role', 'authenticated')::text, true);
  PERFORM public.manage_commune_member(v_home, 'invited-bea', 'leave');
  -- Cal is invited as an admin after Bea has left; one more invitation stays open.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'invited-alice', 'role', 'authenticated')::text, true);
  v_token := public.create_commune_invite(v_home, 'cal@invited.test', 'admin');
  PERFORM public.create_commune_invite(v_home, 'dee@invited.test', 'member');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'invited-cal', 'role', 'authenticated')::text, true);
  PERFORM public.accept_commune_invite(v_token);

  SELECT * INTO v_row FROM public.list_commune_invites(v_home) i WHERE i.accepted_by = 'invited-bea';
  IF v_row.id IS NULL OR v_row.email IS NOT NULL OR v_row.accepted_at IS NULL THEN
    RAISE EXCEPTION 'A former member''s invitation still shows their address: %', row_to_json(v_row);
  END IF;
  IF (SELECT i.email FROM public.list_commune_invites(v_home) i WHERE i.accepted_by = 'invited-cal') IS DISTINCT FROM 'cal@invited.test'
     OR NOT EXISTS (SELECT 1 FROM public.list_commune_invites(v_home) i WHERE i.accepted_by IS NULL AND i.email = 'dee@invited.test') THEN
    RAISE EXCEPTION 'A current member''s or an open invitation lost its address';
  END IF;
  -- Members names her from the snapshot instead.
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.commune_snapshot(v_home)->'members') m
      WHERE m->>'userId' = 'invited-bea' AND m->>'name' = 'Bea' AND m->>'email' IS NULL) THEN
    RAISE EXCEPTION 'The snapshot should still name the former member';
  END IF;
END;
$$;

ROLLBACK;
