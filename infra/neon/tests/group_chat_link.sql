-- Run only in an empty disposable local DB after local_auth_stub.sql and
-- migrations 0001 through 0045. Real Neon verification must use signed JWTs.
BEGIN;

DO $$
DECLARE
  v_home uuid;
  v_other uuid;
BEGIN
  INSERT INTO neon_auth."user" (id, name, email, "emailVerified")
    VALUES ('chat-alice', 'Alice', 'alice@chat.test', true),
           ('chat-bob', 'Bob', 'bob@chat.test', true),
           ('chat-carol', 'Carol', 'carol@chat.test', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'chat-alice', 'role', 'authenticated')::text, true);
  v_home := public.create_commune('Chat home', 'household', 'GBP');
  INSERT INTO public.commune_members (commune_id, user_id, role) VALUES (v_home, 'chat-bob', 'member');
  PERFORM set_config('test.chat_home', v_home::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'chat-carol', 'role', 'authenticated')::text, true);
  v_other := public.create_commune('Carol home', 'household', 'GBP');
  PERFORM set_config('test.chat_other', v_other::text, true);
END;
$$;

SET ROLE authenticated;

-- Alice, the admin, pastes the link the way WhatsApp shares it.
SELECT set_config('request.jwt.claims', json_build_object('sub', 'chat-alice', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  v_home uuid := current_setting('test.chat_home')::uuid;
  v_link text;
BEGIN
  IF (SELECT c->>'chatLink' FROM jsonb_array_elements(public.my_communes()) c WHERE c->>'id' = v_home::text) <> '' THEN
    RAISE EXCEPTION 'A new commune should have no group chat link';
  END IF;
  v_link := public.set_commune_chat_link(v_home, '  https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv?mode=ems_copy_t ');
  IF v_link <> 'https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv' THEN
    RAISE EXCEPTION 'The link was not tidied: %', v_link;
  END IF;
  -- Without the scheme, and with a trailing slash.
  v_link := public.set_commune_chat_link(v_home, 'chat.whatsapp.com/ZyXwVuTsRqPoNmLkJiHg12/');
  IF v_link <> 'https://chat.whatsapp.com/ZyXwVuTsRqPoNmLkJiHg12' THEN
    RAISE EXCEPTION 'A link without https was not accepted: %', v_link;
  END IF;

  BEGIN PERFORM public.set_commune_chat_link(v_home, 'https://example.com/AbCdEfGhIjKlMnOpQrStUv');
    RAISE EXCEPTION 'A link to another site was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  BEGIN PERFORM public.set_commune_chat_link(v_home, 'https://chat.whatsapp.com.evil.test/AbCdEfGhIjKlMnOpQrStUv');
    RAISE EXCEPTION 'A look-alike host was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  BEGIN PERFORM public.set_commune_chat_link(v_home, 'https://wa.me/447700900123');
    RAISE EXCEPTION 'A personal WhatsApp number was accepted as a group link';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  BEGIN PERFORM public.set_commune_chat_link(v_home, 'https://chat.whatsapp.com/short');
    RAISE EXCEPTION 'A too-short invite code was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  BEGIN PERFORM public.set_commune_chat_link(v_home, 'javascript:alert(1)');
    RAISE EXCEPTION 'A script address was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
END;
$$;

-- Bob, a member, sees the link but cannot change it.
SELECT set_config('request.jwt.claims', json_build_object('sub', 'chat-bob', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  v_home uuid := current_setting('test.chat_home')::uuid;
BEGIN
  IF (SELECT c->>'chatLink' FROM jsonb_array_elements(public.my_communes()) c WHERE c->>'id' = v_home::text)
     <> 'https://chat.whatsapp.com/ZyXwVuTsRqPoNmLkJiHg12' THEN
    RAISE EXCEPTION 'Bob does not see the group chat link';
  END IF;
  IF public.commune_snapshot(v_home)->'commune'->>'chatLink' <> 'https://chat.whatsapp.com/ZyXwVuTsRqPoNmLkJiHg12'
     OR public.commune_summary(v_home)->'commune'->>'chatLink' <> 'https://chat.whatsapp.com/ZyXwVuTsRqPoNmLkJiHg12' THEN
    RAISE EXCEPTION 'The snapshot does not carry the group chat link';
  END IF;
  BEGIN PERFORM public.set_commune_chat_link(v_home, '');
    RAISE EXCEPTION 'A member removed the group chat link';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
END;
$$;

-- Carol is not in the commune: she can neither set it nor see it.
SELECT set_config('request.jwt.claims', json_build_object('sub', 'chat-carol', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  v_home uuid := current_setting('test.chat_home')::uuid;
BEGIN
  BEGIN PERFORM public.set_commune_chat_link(v_home, 'https://chat.whatsapp.com/CarolCarolCarolCarol12');
    RAISE EXCEPTION 'An outsider set the group chat link';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(public.my_communes()) c WHERE c->>'id' = v_home::text) THEN
    RAISE EXCEPTION 'An outsider can see the commune';
  END IF;
END;
$$;

-- Alice removes it with an empty link; removing twice is harmless.
SELECT set_config('request.jwt.claims', json_build_object('sub', 'chat-alice', 'role', 'authenticated')::text, true);
DO $$
DECLARE
  v_home uuid := current_setting('test.chat_home')::uuid;
BEGIN
  IF public.set_commune_chat_link(v_home, '') <> '' OR public.set_commune_chat_link(v_home, NULL) <> '' THEN
    RAISE EXCEPTION 'An empty link did not remove it';
  END IF;
  IF (SELECT c->>'chatLink' FROM jsonb_array_elements(public.my_communes()) c WHERE c->>'id' = v_home::text) <> '' THEN
    RAISE EXCEPTION 'The removed link is still listed';
  END IF;
END;
$$;

RESET ROLE;
-- The table itself refuses anything that is not a group invite link.
DO $$
BEGIN
  BEGIN
    UPDATE public.communes SET chat_link = 'https://example.com/x' WHERE id = current_setting('test.chat_home')::uuid;
    RAISE EXCEPTION 'The table accepted a link to another site';
  EXCEPTION WHEN check_violation THEN NULL; END;
END;
$$;
ROLLBACK;
