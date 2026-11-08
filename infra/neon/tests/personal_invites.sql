-- Personal invitations (0046): a link for one named person, sent on WhatsApp
-- or by text, with no email address. Runs on the stub database
-- (local_auth_stub.sql and every migration).
BEGIN;
DO $$
DECLARE
  v_commune uuid;
  v_token text;
  v_second text;
  v_email_token text;
  v_count integer;
  v_id uuid;
  v_row record;
BEGIN
  INSERT INTO neon_auth."user" (id, name, email, "emailVerified")
    VALUES ('pi-admin', 'Jean Phil', 'jp@example.test', true),
           ('pi-maya', 'Maya', 'maya@example.test', false),
           ('pi-theo', 'Theo', 'theo@example.test', true),
           ('pi-ama', 'Ama', 'ama@example.test', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'pi-admin', 'role', 'authenticated')::text, true);
  v_commune := public.create_commune('Elm Road', 'household', 'GBP');

  -- Names are tidied and checked; the way it is sent must be one we know.
  v_token := public.create_personal_invite(v_commune, '  Maya   Okafor ', 'whatsapp');
  IF length(v_token) <> 64 THEN RAISE EXCEPTION 'Personal token has insufficient entropy'; END IF;
  SELECT * INTO v_row FROM public.commune_invites WHERE token_hash = digest(v_token, 'sha256');
  IF v_row.email IS NOT NULL OR v_row.invitee_name <> 'Maya Okafor' OR v_row.sent_via <> 'whatsapp' OR v_row.role <> 'member' THEN
    RAISE EXCEPTION 'Personal invite stored wrongly: %', row_to_json(v_row);
  END IF;
  BEGIN
    PERFORM public.create_personal_invite(v_commune, '   ', 'text');
    RAISE EXCEPTION 'Blank name accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM public.create_personal_invite(v_commune, repeat('a', 81), 'text');
    RAISE EXCEPTION 'Long name accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  BEGIN
    PERFORM public.create_personal_invite(v_commune, 'Theo', 'carrier pigeon');
    RAISE EXCEPTION 'Unknown channel accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  -- The admin's list shows the name and how it went.
  SELECT count(*) INTO v_count FROM public.list_commune_invites(v_commune)
    WHERE invitee_name = 'Maya Okafor' AND sent_via = 'whatsapp' AND email IS NULL;
  IF v_count <> 1 THEN RAISE EXCEPTION 'List does not show the personal invite'; END IF;

  -- Anyone signed in can open it, verified email or not, and it is used once.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'pi-maya', 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_count FROM public.preview_commune_invite(v_token) WHERE commune_name = 'Elm Road' AND role = 'member';
  IF v_count <> 1 THEN RAISE EXCEPTION 'Personal invite did not preview'; END IF;
  -- Not an admin, so no personal invitations of their own.
  BEGIN
    PERFORM public.create_personal_invite(v_commune, 'Someone', 'link');
    RAISE EXCEPTION 'Non-member made a personal invite';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  v_id := public.accept_commune_invite(v_token);
  IF v_id <> v_commune THEN RAISE EXCEPTION 'Joined the wrong commune'; END IF;
  SELECT count(*) INTO v_count FROM public.commune_members WHERE commune_id = v_commune AND user_id = 'pi-maya' AND role = 'member' AND active;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Personal invite did not add the member'; END IF;

  -- A second person with the same link gets nothing.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'pi-theo', 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_count FROM public.preview_commune_invite(v_token);
  IF v_count <> 0 THEN RAISE EXCEPTION 'Used personal invite still previews'; END IF;
  BEGIN
    PERFORM public.accept_commune_invite(v_token);
    RAISE EXCEPTION 'Personal invite worked twice';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  -- Withdrawn and expired links stop working.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'pi-admin', 'role', 'authenticated')::text, true);
  v_second := public.create_personal_invite(v_commune, 'Theo', 'text');
  PERFORM public.revoke_commune_invite((SELECT id FROM public.commune_invites WHERE token_hash = digest(v_second, 'sha256')));
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'pi-theo', 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.accept_commune_invite(v_second);
    RAISE EXCEPTION 'Withdrawn personal invite worked';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'pi-admin', 'role', 'authenticated')::text, true);
  v_second := public.create_personal_invite(v_commune, 'Theo', 'text');
  UPDATE public.commune_invites SET expires_at = now() - interval '1 minute', created_at = now() - interval '8 days'
    WHERE token_hash = digest(v_second, 'sha256');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'pi-theo', 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.accept_commune_invite(v_second);
    RAISE EXCEPTION 'Expired personal invite worked';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  -- Email invitations still need their own verified address.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'pi-admin', 'role', 'authenticated')::text, true);
  v_email_token := public.create_commune_invite(v_commune, 'ama@example.test', 'member');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'pi-theo', 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_count FROM public.preview_commune_invite(v_email_token);
  IF v_count <> 0 THEN RAISE EXCEPTION 'Email invite previewed for another account'; END IF;
  BEGIN
    PERFORM public.accept_commune_invite(v_email_token);
    RAISE EXCEPTION 'Email invite accepted by another account';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
  END;

  -- A personal invitation stops when its sender is no longer an admin.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'pi-admin', 'role', 'authenticated')::text, true);
  v_second := public.create_personal_invite(v_commune, 'Ama', 'link');
  UPDATE public.commune_members SET role = 'member' WHERE commune_id = v_commune AND user_id = 'pi-admin';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'pi-ama', 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_count FROM public.preview_commune_invite(v_second);
  IF v_count <> 0 THEN RAISE EXCEPTION 'Invite from a former admin still previews'; END IF;
  UPDATE public.commune_members SET role = 'admin' WHERE commune_id = v_commune AND user_id = 'pi-admin';

  -- At most 20 waiting at once for one admin.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'pi-admin', 'role', 'authenticated')::text, true);
  UPDATE public.commune_invites SET revoked_at = now() WHERE commune_id = v_commune AND accepted_at IS NULL AND revoked_at IS NULL;
  FOR i IN 1..20 LOOP PERFORM public.create_personal_invite(v_commune, 'Person ' || i, 'link'); END LOOP;
  BEGIN
    PERFORM public.create_personal_invite(v_commune, 'Person 21', 'link');
    RAISE EXCEPTION 'More than 20 personal invites waiting';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL;
  END;

  -- The table itself refuses mixed or admin personal invitations.
  BEGIN
    INSERT INTO public.commune_invites (commune_id, email, invitee_name, role, token_hash, invited_by)
      VALUES (v_commune, NULL, 'Boss', 'admin', digest('x', 'sha256'), 'pi-admin');
    RAISE EXCEPTION 'Personal admin invite stored';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.commune_invites (commune_id, email, invitee_name, role, token_hash, invited_by)
      VALUES (v_commune, 'both@example.test', 'Both', 'member', digest('y', 'sha256'), 'pi-admin');
    RAISE EXCEPTION 'Invite with both email and name stored';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
ROLLBACK;
