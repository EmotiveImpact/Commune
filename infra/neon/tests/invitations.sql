-- Run only in an empty disposable local DB after local_auth_stub.sql and
-- migrations 0001 through 0003. Production verification also needs real JWTs.
BEGIN;
DO $$
DECLARE
  v_commune uuid;
  v_token text;
  v_old_token text;
  v_new_token text;
  v_count integer;
  v_id uuid;
BEGIN
  INSERT INTO neon_auth."user" (id, name, email, "emailVerified")
    VALUES ('invite-alice', 'Alice', 'alice@example.test', true),
           ('invite-bob', 'Bob', 'bob@example.test', false),
           ('invite-charlie', 'Charlie', 'charlie@example.test', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'invite-alice', 'role', 'authenticated')::text, true);
  v_commune := public.create_commune('Invitation test', 'household', 'GBP');
  v_token := public.create_commune_invite(
    v_commune, ' BOB@example.test ', 'member');
  IF length(v_token) <> 64 THEN
    RAISE EXCEPTION 'Invite token has insufficient entropy';
  END IF;
  SELECT count(*) INTO v_count FROM public.commune_invites
    WHERE commune_id = v_commune AND email = 'bob@example.test'
      AND token_hash = digest(v_token, 'sha256');
  IF v_count <> 1 THEN RAISE EXCEPTION 'Invite was not hashed'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'invite-charlie', 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_count FROM public.preview_commune_invite(v_token);
  IF v_count <> 0 THEN RAISE EXCEPTION 'Wrong email previewed invite'; END IF;
  BEGIN
    PERFORM public.accept_commune_invite(v_token);
    RAISE EXCEPTION 'Wrong email accepted invite';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'invite-bob', 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_count FROM public.preview_commune_invite(v_token);
  IF v_count <> 0 THEN RAISE EXCEPTION 'Unverified email previewed invite'; END IF;
  BEGIN
    PERFORM public.accept_commune_invite(v_token);
    RAISE EXCEPTION 'Unverified email accepted invite';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  UPDATE neon_auth."user" SET "emailVerified" = true WHERE id = 'invite-bob';
  SELECT count(*) INTO v_count FROM public.preview_commune_invite(v_token)
    WHERE commune_name = 'Invitation test' AND role = 'member';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Verified invite preview failed'; END IF;
  v_id := public.accept_commune_invite(v_token);
  IF v_id <> v_commune THEN RAISE EXCEPTION 'Joined wrong commune'; END IF;
  SELECT count(*) INTO v_count FROM public.commune_members
    WHERE commune_id = v_commune AND user_id = 'invite-bob' AND role = 'member';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Invite did not add the member'; END IF;
  BEGIN
    PERFORM public.accept_commune_invite(v_token);
    RAISE EXCEPTION 'Invite replay succeeded';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  BEGIN
    PERFORM public.create_commune_invite(
      v_commune, 'charlie@example.test', 'member');
    RAISE EXCEPTION 'Non-admin created an invite';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'invite-alice', 'role', 'authenticated')::text, true);
  v_old_token := public.create_commune_invite(
    v_commune, 'charlie@example.test', 'member');
  v_new_token := public.create_commune_invite(
    v_commune, 'charlie@example.test', 'admin');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'invite-charlie', 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_count FROM public.preview_commune_invite(v_old_token);
  IF v_count <> 0 THEN RAISE EXCEPTION 'Superseded invite still works'; END IF;
  v_id := public.accept_commune_invite(v_new_token);
  SELECT count(*) INTO v_count FROM public.commune_members
    WHERE commune_id = v_id AND user_id = 'invite-charlie' AND role = 'admin';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Admin role not retained'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'invite-alice', 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_count FROM public.list_commune_invites(v_commune);
  IF v_count <> 3 THEN RAISE EXCEPTION 'Invite audit list is incomplete'; END IF;
END;
$$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', 'invite-bob', 'role', 'authenticated')::text, true);
DO $$
BEGIN
  BEGIN
    INSERT INTO public.commune_members
      (commune_id, user_id, role) VALUES (gen_random_uuid(), 'fake', 'admin');
    RAISE EXCEPTION 'Client inserted a membership';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.commune_invites LIMIT 1;
    RAISE EXCEPTION 'Client read invite hashes';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
END;
$$;
RESET ROLE;
ROLLBACK;
