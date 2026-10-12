-- Announcements (0025). Run only in an empty disposable local DB built from
-- infra/local/bootstrap.sql, every migration and after-core.sql (app_auth
-- stands in for Neon Auth). Everything is rolled back.
BEGIN;

DO $$
DECLARE v_home uuid; v_other uuid;
BEGIN
  INSERT INTO app_auth.users (id, name, email, email_verified)
    VALUES ('00000000-0000-4000-8000-0000000000a1', 'Avery', 'avery@notice.test', true),
           ('00000000-0000-4000-8000-0000000000b2', 'Blake', 'blake@notice.test', true),
           ('00000000-0000-4000-8000-0000000000c3', 'Casey', 'casey@notice.test', true),
           ('00000000-0000-4000-8000-0000000000e5', 'Eve', 'eve@notice.test', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000a1', 'role', 'authenticated')::text, true);
  v_home := public.create_commune('Notice home', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role)
    VALUES (v_home, '00000000-0000-4000-8000-0000000000b2', 'member'), (v_home, '00000000-0000-4000-8000-0000000000c3', 'admin');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000e5', 'role', 'authenticated')::text, true);
  v_other := public.create_commune('Elsewhere', 'household', 'GBP');
  PERFORM set_config('test.home', v_home::text, true);
END;
$$;

SET ROLE authenticated;
DO $$
DECLARE
  v_home uuid := current_setting('test.home')::uuid;
  a text := '00000000-0000-4000-8000-0000000000a1';
  b text := '00000000-0000-4000-8000-0000000000b2';
  c text := '00000000-0000-4000-8000-0000000000c3';
  e text := '00000000-0000-4000-8000-0000000000e5';
  v_request uuid := gen_random_uuid(); v_result jsonb; v_id uuid; v_plain uuid; v_snapshot jsonb; v_case text; i integer;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  -- Refusals: blank or long title, long body, no request id.
  FOREACH v_case IN ARRAY ARRAY['blank', 'title', 'body', 'request'] LOOP
    BEGIN
      PERFORM public.post_announcement(v_home,
        CASE v_case WHEN 'blank' THEN '   ' WHEN 'title' THEN repeat('x', 81) ELSE 'Boiler service' END,
        CASE WHEN v_case = 'body' THEN repeat('x', 1001) ELSE '' END, false,
        CASE WHEN v_case = 'request' THEN NULL ELSE gen_random_uuid() END);
      RAISE EXCEPTION 'Post was not refused: %', v_case;
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
  END LOOP;

  v_result := public.post_announcement(v_home, '  Boiler service Thursday ', 'Please be in from 8.', true, v_request);
  v_id := (v_result->>'id')::uuid;
  -- A retry returns the same notice; reusing the id for another one is refused.
  IF (public.post_announcement(v_home, 'Boiler service Thursday', 'Please be in from 8.', true, v_request)->>'id')::uuid <> v_id THEN
    RAISE EXCEPTION 'Retry created a second announcement';
  END IF;
  BEGIN
    PERFORM public.post_announcement(v_home, 'Something else', '', false, v_request);
    RAISE EXCEPTION 'Reused request was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  IF (SELECT count(*) FROM public.commune_announcements WHERE commune_id = v_home) <> 1 THEN
    RAISE EXCEPTION 'Wrong announcement count';
  END IF;
  -- Direct writes are refused.
  BEGIN
    INSERT INTO public.commune_announcements (commune_id, author_id, title, body, request_id) VALUES (v_home, a, 'Sneaky', '', gen_random_uuid());
    RAISE EXCEPTION 'Direct insert was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  v_plain := (public.post_announcement(v_home, 'Window cleaner Friday', '', false, gen_random_uuid())->>'id')::uuid;

  -- A member cannot post, but confirms seeing it, once.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.post_announcement(v_home, 'Party', '', false, gen_random_uuid());
    RAISE EXCEPTION 'A member posted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  v_result := public.acknowledge_announcement(v_id);
  IF (v_result->>'duplicate')::boolean THEN RAISE EXCEPTION 'First acknowledgement reported as duplicate'; END IF;
  IF NOT (public.acknowledge_announcement(v_id)->>'duplicate')::boolean THEN RAISE EXCEPTION 'Second acknowledgement was not a duplicate'; END IF;
  BEGIN
    PERFORM public.acknowledge_announcement(v_plain);
    RAISE EXCEPTION 'Acknowledged a notice that does not ask for it';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  -- Only the author or an admin can take it down.
  BEGIN
    PERFORM public.archive_announcement(v_id);
    RAISE EXCEPTION 'A member took down an admin''s notice';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  v_snapshot := (SELECT x FROM jsonb_array_elements(public.commune_snapshot(v_home)->'announcements') x WHERE x->>'id' = v_id::text);
  IF v_snapshot->>'title' <> 'Boiler service Thursday' OR (v_snapshot->>'needsAcknowledgement')::boolean IS NOT TRUE
     OR v_snapshot->'acknowledgements'->0->>'userId' <> b OR jsonb_array_length(v_snapshot->'acknowledgements') <> 1 THEN
    RAISE EXCEPTION 'Snapshot announcement is wrong: %', v_snapshot;
  END IF;

  -- Outsiders see and do nothing.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', e, 'role', 'authenticated')::text, true);
  IF EXISTS (SELECT 1 FROM public.commune_announcements) OR EXISTS (SELECT 1 FROM public.announcement_acknowledgements) THEN
    RAISE EXCEPTION 'An outsider can read announcements';
  END IF;
  FOREACH v_case IN ARRAY ARRAY['ack', 'archive', 'post'] LOOP
    BEGIN
      IF v_case = 'ack' THEN PERFORM public.acknowledge_announcement(v_id);
      ELSIF v_case = 'archive' THEN PERFORM public.archive_announcement(v_id);
      ELSE PERFORM public.post_announcement(v_home, 'Hi', '', false, gen_random_uuid()); END IF;
      RAISE EXCEPTION 'An outsider could %', v_case;
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;

  -- Another admin takes it down. It leaves the snapshot; the record and the
  -- confirmation remain, and nobody can confirm it any more.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  PERFORM public.archive_announcement(v_id);
  IF NOT (public.archive_announcement(v_id)->>'duplicate')::boolean THEN RAISE EXCEPTION 'Second take-down was not a duplicate'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(public.commune_snapshot(v_home)->'announcements') x WHERE x->>'id' = v_id::text) THEN
    RAISE EXCEPTION 'A taken-down announcement is still shown';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.commune_announcements WHERE id = v_id AND archived_by = c)
     OR NOT EXISTS (SELECT 1 FROM public.announcement_acknowledgements WHERE announcement_id = v_id) THEN
    RAISE EXCEPTION 'Taking it down lost the record';
  END IF;
  BEGIN
    PERFORM public.acknowledge_announcement(v_id);
    RAISE EXCEPTION 'Confirmed a taken-down announcement';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'Confirmed a%' THEN RAISE; END IF;
  END;
  IF (SELECT array_agg(description ORDER BY created_at) FROM public.commune_events WHERE entity_id = v_id)
     <> ARRAY['Posted. Please confirm you have seen it', 'Taken down'] THEN
    RAISE EXCEPTION 'History lines are wrong';
  END IF;

  -- At most 20 notices are up at once.
  FOR i IN 1..19 LOOP PERFORM public.post_announcement(v_home, 'Notice ' || i, '', false, gen_random_uuid()); END LOOP;
  BEGIN
    PERFORM public.post_announcement(v_home, 'One too many', '', false, gen_random_uuid());
    RAISE EXCEPTION 'A 21st announcement was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'There are already 20%' THEN RAISE; END IF;
  END;
END;
$$;

SELECT 'announcements ok';
ROLLBACK;
