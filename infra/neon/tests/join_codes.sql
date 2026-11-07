-- Run only in an empty disposable local DB after local_auth_stub.sql and
-- every migration through 0044. Real Neon verification must use signed JWTs.
BEGIN;

DO $$
DECLARE
  v_home uuid;
BEGIN
  INSERT INTO neon_auth."user" (id, name, email, "emailVerified")
    VALUES ('jc-admin', 'Ada Admin', 'ada@join.test', true),
           ('jc-member', 'Max Member', 'max@join.test', true),
           ('jc-priya', 'Priya Shah', 'priya@join.test', true),
           ('jc-sam', 'Sam Stranger', 'sam@join.test', true),
           ('jc-tom', 'Tom Late', 'tom@join.test', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'jc-admin', 'role', 'authenticated')::text, true);
  v_home := public.create_commune('Join home', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role) VALUES (v_home, 'jc-member', 'member');
  PERFORM set_config('test.home', v_home::text, true);
END;
$$;

SET ROLE authenticated;

-- The default is "approve", a member who is not an admin cannot change it,
-- make a code, or see codes and requests.
SELECT set_config('request.jwt.claims', json_build_object('sub', 'jc-member', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  v_state jsonb;
BEGIN
  v_state := public.commune_join_state(v_home);
  IF v_state->>'joinMode' <> 'approve' OR jsonb_array_length(v_state->'codes') <> 0 THEN
    RAISE EXCEPTION 'A member saw the wrong join state: %', v_state;
  END IF;
  BEGIN PERFORM public.set_commune_join_mode(v_home, 'instant', gen_random_uuid());
    RAISE EXCEPTION 'A member changed the join setting';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  BEGIN PERFORM public.create_join_code(v_home, 'sticker', gen_random_uuid());
    RAISE EXCEPTION 'A member made a join code';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
END;
$$;

-- The admin makes a sticker; the same request returns the same code, and a
-- new sticker turns the old one off.
SELECT set_config('request.jwt.claims', json_build_object('sub', 'jc-admin', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  v_request uuid := gen_random_uuid();
  v_first jsonb; v_again jsonb; v_second jsonb; v_now jsonb;
BEGIN
  v_first := public.create_join_code(v_home, 'sticker', v_request);
  v_again := public.create_join_code(v_home, 'sticker', v_request);
  IF v_first->>'token' <> v_again->>'token' OR v_first->>'expiresAt' IS NOT NULL THEN
    RAISE EXCEPTION 'Replaying the request gave a different sticker: % %', v_first, v_again;
  END IF;
  v_second := public.create_join_code(v_home, 'sticker', gen_random_uuid());
  IF v_second->>'token' = v_first->>'token' THEN RAISE EXCEPTION 'A new sticker kept the old code'; END IF;
  v_now := public.create_join_code(v_home, 'now', gen_random_uuid());
  IF (v_now->>'expiresAt')::timestamptz NOT BETWEEN now() + interval '59 minutes' AND now() + interval '61 minutes' THEN
    RAISE EXCEPTION 'A code to show now should last an hour: %', v_now;
  END IF;
  PERFORM set_config('test.old_sticker', v_first->>'token', true);
  PERFORM set_config('test.sticker', v_second->>'token', true);
  PERFORM set_config('test.sticker_id', v_second->>'id', true);
  PERFORM set_config('test.now', v_now->>'token', true);
END;
$$;

-- A stranger previews the sticker: name, kind and head count only.
SELECT set_config('request.jwt.claims', json_build_object('sub', 'jc-priya', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  v_row record;
  v_count integer;
  v_result jsonb;
BEGIN
  SELECT count(*) INTO v_count FROM public.preview_join_code(current_setting('test.old_sticker'));
  IF v_count <> 0 THEN RAISE EXCEPTION 'The replaced sticker still previews'; END IF;
  SELECT * INTO v_row FROM public.preview_join_code(current_setting('test.sticker'));
  IF v_row.commune_name <> 'Join home' OR v_row.member_count <> 2 OR v_row.join_mode <> 'approve'
    OR v_row.already_member OR v_row.waiting THEN
    RAISE EXCEPTION 'Unexpected preview: %', row_to_json(v_row);
  END IF;
  IF row_to_json(v_row)::text ~* '(amount|minor|12345|email|balance)' THEN
    RAISE EXCEPTION 'The preview leaks more than the name and head count: %', row_to_json(v_row);
  END IF;
  -- The stranger cannot read the commune or its codes.
  BEGIN PERFORM public.commune_snapshot(current_setting('test.home')::uuid);
    RAISE EXCEPTION 'A stranger read the snapshot';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  BEGIN PERFORM public.commune_join_state(current_setting('test.home')::uuid);
    RAISE EXCEPTION 'A stranger read the join state';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  BEGIN PERFORM public.request_to_join(current_setting('test.old_sticker'), gen_random_uuid());
    RAISE EXCEPTION 'A replaced sticker was accepted';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL; END;

  -- Asking twice, or replaying, gives one waiting request and no membership.
  v_result := public.request_to_join(current_setting('test.sticker'), '00000000-0000-0000-0000-0000000000a1');
  IF v_result->>'status' <> 'pending' OR v_result ? 'communeId' AND v_result->>'communeId' IS NOT NULL THEN
    RAISE EXCEPTION 'Expected a waiting request: %', v_result;
  END IF;
  IF (public.request_to_join(current_setting('test.sticker'), '00000000-0000-0000-0000-0000000000a1'))->>'requestId' <> v_result->>'requestId'
    OR (public.request_to_join(current_setting('test.sticker'), gen_random_uuid()))->>'requestId' <> v_result->>'requestId' THEN
    RAISE EXCEPTION 'Asking again made a second request';
  END IF;
  IF public.is_commune_member(current_setting('test.home')::uuid) THEN
    RAISE EXCEPTION 'Asking to join made Priya a member before approval';
  END IF;
  IF jsonb_array_length(public.my_join_requests()) <> 1 THEN RAISE EXCEPTION 'Priya should see one waiting request'; END IF;
  PERFORM set_config('test.priya_request', v_result->>'requestId', true);
END;
$$;

-- A member who is not an admin cannot approve; the admin sees and approves.
SELECT set_config('request.jwt.claims', json_build_object('sub', 'jc-member', 'role', 'authenticated')::text, true);
DO $$
BEGIN
  BEGIN PERFORM public.decide_join_request(current_setting('test.priya_request')::uuid, 'approve');
    RAISE EXCEPTION 'A member approved a request';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
END;
$$;
SELECT set_config('request.jwt.claims', json_build_object('sub', 'jc-admin', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  v_state jsonb := public.commune_join_state(current_setting('test.home')::uuid);
BEGIN
  IF jsonb_array_length(v_state->'requests') <> 1 OR v_state->'requests'->0->>'name' <> 'Priya Shah' THEN
    RAISE EXCEPTION 'The admin should see Priya waiting: %', v_state;
  END IF;
  v_state := public.decide_join_request(current_setting('test.priya_request')::uuid, 'approve');
  IF jsonb_array_length(v_state->'requests') <> 0 THEN RAISE EXCEPTION 'Priya is still waiting after approval'; END IF;
  PERFORM public.decide_join_request(current_setting('test.priya_request')::uuid, 'approve');
  BEGIN PERFORM public.decide_join_request(current_setting('test.priya_request')::uuid, 'decline');
    RAISE EXCEPTION 'An approved request was declined';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
END;
$$;
RESET ROLE;
DO $$
BEGIN
  IF (SELECT role FROM public.commune_members WHERE commune_id = current_setting('test.home')::uuid AND user_id = 'jc-priya' AND active) IS DISTINCT FROM 'member' THEN
    RAISE EXCEPTION 'Approving did not add Priya as an ordinary member';
  END IF;
END;
$$;
SET ROLE authenticated;

-- Priya, now a member, gets a clear answer when she scans again.
SELECT set_config('request.jwt.claims', json_build_object('sub', 'jc-priya', 'role', 'authenticated')::text, true);
DO $$
BEGIN
  IF (public.request_to_join(current_setting('test.sticker'), gen_random_uuid()))->>'status' <> 'already_member' THEN
    RAISE EXCEPTION 'A member scanning again should be told they are already in';
  END IF;
END;
$$;

-- "Join straight away": Sam joins at once, as a member and never an admin.
SELECT set_config('request.jwt.claims', json_build_object('sub', 'jc-admin', 'role', 'authenticated')::text, true);
SELECT public.set_commune_join_mode(current_setting('test.home')::uuid, 'instant', gen_random_uuid());
SELECT set_config('request.jwt.claims', json_build_object('sub', 'jc-sam', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  v_result jsonb := public.request_to_join(current_setting('test.sticker'), gen_random_uuid());
BEGIN
  IF v_result->>'status' <> 'joined' OR (v_result->>'communeId')::uuid <> current_setting('test.home')::uuid THEN
    RAISE EXCEPTION 'Instant mode did not add Sam: %', v_result;
  END IF;
  IF NOT public.is_commune_member(current_setting('test.home')::uuid) OR public.is_commune_admin(current_setting('test.home')::uuid) THEN
    RAISE EXCEPTION 'Sam should be an ordinary member';
  END IF;
END;
$$;

-- An expired code is refused.
RESET ROLE;
UPDATE public.commune_join_codes SET expires_at = now() - interval '1 minute' WHERE token = current_setting('test.now');
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', 'jc-tom', 'role', 'authenticated')::text, true);
DO $$
BEGIN
  BEGIN PERFORM public.request_to_join(current_setting('test.now'), gen_random_uuid());
    RAISE EXCEPTION 'An expired code was accepted';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL; END;
END;
$$;

-- A turned-off code is refused.
SELECT set_config('request.jwt.claims', json_build_object('sub', 'jc-admin', 'role', 'authenticated')::text, true);
SELECT public.revoke_join_code(current_setting('test.sticker_id')::uuid);
SELECT set_config('request.jwt.claims', json_build_object('sub', 'jc-tom', 'role', 'authenticated')::text, true);
DO $$
BEGIN
  BEGIN PERFORM public.request_to_join(current_setting('test.sticker'), gen_random_uuid());
    RAISE EXCEPTION 'A turned-off code was accepted';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL; END;
END;
$$;

-- "Off": no new codes, and existing ones stop working. Email invites still work.
SELECT set_config('request.jwt.claims', json_build_object('sub', 'jc-admin', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  v_code jsonb;
BEGIN
  PERFORM public.set_commune_join_mode(v_home, 'approve', gen_random_uuid());
  v_code := public.create_join_code(v_home, 'sticker', gen_random_uuid());
  PERFORM set_config('test.last', v_code->>'token', true);
  PERFORM public.set_commune_join_mode(v_home, 'off', gen_random_uuid());
  BEGIN PERFORM public.create_join_code(v_home, 'now', gen_random_uuid());
    RAISE EXCEPTION 'A code was made while codes are off';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
  IF public.create_commune_invite(v_home, 'tom@join.test') !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Email invitations stopped working while codes are off';
  END IF;
END;
$$;
SELECT set_config('request.jwt.claims', json_build_object('sub', 'jc-tom', 'role', 'authenticated')::text, true);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.preview_join_code(current_setting('test.last'))) THEN
    RAISE EXCEPTION 'A code previews while codes are off';
  END IF;
  BEGIN PERFORM public.request_to_join(current_setting('test.last'), gen_random_uuid());
    RAISE EXCEPTION 'A code was accepted while codes are off';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL; END;
END;
$$;

ROLLBACK;
