-- The schema that infra/neon/migrations produce, with every function in full.
-- Written by infra/neon/dump-schema.sh, which rewrites it after a migration is
-- added or changed; CI fails while it is out of date. Do not edit it by hand.
-- It is for reading: databases are built from the migrations, never from this
-- file. Neon's auth and neon_auth schemas are left out.

--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: commune_private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA commune_private;


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: accounts(text[]); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.accounts(p_ids text[]) RETURNS TABLE(id text, name text, email text, "emailVerified" boolean)
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $_$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a WHERE a.attrelid = 'neon_auth."user"'::regclass
      AND a.attname = 'id' AND a.atttypid = 'uuid'::regtype) THEN
    RETURN QUERY SELECT u.id::text, u.name::text, u.email::text, u."emailVerified"::boolean
      FROM neon_auth."user" u
      WHERE u.id = ANY (ARRAY(SELECT k.id::uuid FROM unnest(p_ids) k(id)
        WHERE k.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'));
  ELSE
    RETURN QUERY SELECT u.id::text, u.name::text, u.email::text, u."emailVerified"::boolean
      FROM neon_auth."user" u
      WHERE u.id::text = ANY (p_ids);
  END IF;
END;
$_$;


--
-- Name: activity_record_type(uuid); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.activity_record_type(p_event_id uuid) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT CASE e.kind
    WHEN 'expenses' THEN CASE WHEN e.details ? 'receiptId' OR e.description LIKE 'Repayment %'
      OR e.description = 'Share confirmed received' THEN 'repayment' ELSE 'expense' END
    WHEN 'funds' THEN CASE WHEN e.details -> 'after' ? 'commitment_id' OR e.description LIKE 'Contribution %' THEN 'contribution'
      WHEN e.details -> 'after' ? 'fund_id' OR e.description LIKE 'Pledge %' THEN 'pledge' ELSE 'fund' END
    WHEN 'operations' THEN coalesce((SELECT o.kind FROM public.commune_operations o WHERE o.id = e.entity_id), 'task')
    WHEN 'recurring' THEN 'recurring'
    WHEN 'templates' THEN 'template'
    WHEN 'notes' THEN 'note'
    WHEN 'members' THEN 'member'
    WHEN 'announcements' THEN 'announcement'
  END
  FROM public.commune_events e WHERE e.id = p_event_id;
$$;


--
-- Name: announcement_result(uuid, boolean); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.announcement_result(p_id uuid, p_duplicate boolean) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT jsonb_build_object('id', a.id, 'duplicate', p_duplicate, 'archived', a.archived_at IS NOT NULL)
  FROM public.commune_announcements a WHERE a.id = p_id;
$$;


--
-- Name: bump_recurring_bill_version(); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.bump_recurring_bill_version() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;


--
-- Name: change_mark(uuid); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.change_mark(p_commune_id uuid) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD') || ':' || count(*) || ':' || coalesce(max(c.id), 0)
    FROM commune_private.commune_changes c
    WHERE c.commune_id = p_commune_id
      AND c.changed_at >= (date_trunc('day', now() AT TIME ZONE 'UTC') - interval '1 day') AT TIME ZONE 'UTC';
$$;


--
-- Name: check_share_settlement(); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.check_share_settlement() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_bad uuid; v_expense_id uuid; v_share_id uuid;
BEGIN
  -- Each branch is planned only for the table whose row type has that field.
  IF TG_TABLE_NAME = 'expenses' THEN v_expense_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'expense_shares' THEN v_share_id := NEW.id;
  ELSE v_share_id := NEW.share_id;
  END IF;
  SELECT s.id INTO v_bad FROM public.expense_shares s JOIN public.expenses e ON e.id = s.expense_id
  LEFT JOIN LATERAL (SELECT coalesce(sum(r.amount_minor), 0) AS total FROM public.expense_share_receipts r
    WHERE r.share_id = s.id AND r.reversed_at IS NULL) paid ON true
  WHERE (s.id = v_share_id OR s.expense_id = v_expense_id)
    AND (CASE WHEN s.user_id = e.paid_by_user_id
      THEN s.settled_minor <> s.amount_minor OR paid.total <> 0
      ELSE s.settled_minor <> paid.total END)
  LIMIT 1;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Share % does not match its repayment receipts', v_bad USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: close_payment_reports(); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.close_payment_reports() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_TABLE_NAME = 'expense_shares' THEN
    IF NEW.settled_minor >= NEW.amount_minor THEN
      UPDATE public.expense_share_payment_reports SET status = 'closed', resolved_at = now(),
          resolution_note = 'Share settled'
        WHERE share_id = NEW.id AND status = 'pending';
    END IF;
  ELSIF NEW.voided_at IS NOT NULL THEN
    UPDATE public.expense_share_payment_reports r SET status = 'closed', resolved_at = now(),
        resolution_note = 'Expense voided'
      FROM public.expense_shares s WHERE s.id = r.share_id AND s.expense_id = NEW.id AND r.status = 'pending';
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: currency_locked_by(uuid); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.currency_locked_by(p_commune_id uuid) RETURNS text[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT array_remove(ARRAY[
    CASE WHEN EXISTS (SELECT 1 FROM public.expenses WHERE commune_id = p_commune_id) THEN 'expenses' END,
    CASE WHEN EXISTS (SELECT 1 FROM public.funds WHERE commune_id = p_commune_id) THEN 'funds' END,
    CASE WHEN EXISTS (SELECT 1 FROM public.recurring_bills WHERE commune_id = p_commune_id) THEN 'recurringBills' END,
    CASE WHEN EXISTS (SELECT 1 FROM public.split_templates WHERE commune_id = p_commune_id AND method = 'Exact')
      THEN 'exactSplitTemplates' END
  ], NULL);
$$;


--
-- Name: data_api_user_id(); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.data_api_user_id() RETURNS text
    LANGUAGE plpgsql STABLE
    SET search_path TO 'pg_catalog'
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


--
-- Name: expense_history(uuid); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.expense_history(p_commune_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_since timestamptz := commune_private.expense_window_start();
BEGIN
  RETURN (SELECT jsonb_build_object('since', to_char(v_since AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
      'olderCount', count(*), 'olderVoidedCount', count(*) FILTER (WHERE e.voided_at IS NOT NULL))
    FROM public.expenses e
    WHERE e.commune_id = p_commune_id AND e.created_at < v_since
      AND e.id NOT IN (SELECT commune_private.snapshot_expense_ids(p_commune_id, v_since)));
END;
$$;


--
-- Name: expense_is_voided(uuid); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.expense_is_voided(p_expense_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT coalesce((SELECT e.voided_at IS NOT NULL FROM public.expenses e WHERE e.id = p_expense_id), false);
$$;


--
-- Name: expense_records(uuid[]); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.expense_records(p_ids uuid[]) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'category',e.category,'amountMinor',e.amount_minor,'paidByUserId',e.paid_by_user_id,'recordedBy',e.recorded_by,'dueOn',e.due_on,'createdAt',e.created_at,
      'version',e.version,'updatedAt',e.updated_at,'voidedAt',e.voided_at,'voidedBy',e.voided_by,'voidReason',e.void_reason,
      'recurring',EXISTS(SELECT 1 FROM public.recurring_bill_occurrences o WHERE o.expense_id=e.id),
      'revisions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id,'version',v.version,'action',v.action,'actorId',v.actor_id,'reason',v.reason,'before',v.before,'after',v.after,'createdAt',v.created_at) ORDER BY v.version DESC)
        FROM (SELECT * FROM public.expense_revisions rv WHERE rv.expense_id=e.id ORDER BY rv.version DESC LIMIT 20) v),'[]'::jsonb),
      'shares',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'userId',s.user_id,'amountMinor',s.amount_minor,'settledMinor',s.settled_minor,'settledAt',s.settled_at,
        'receipts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'amountMinor',r.amount_minor,'receivedOn',r.received_on,'reference',r.reference,'recordedBy',r.recorded_by,'recordedAt',r.recorded_at,'origin',r.origin,
          'reversedAt',r.reversed_at,'reversedBy',r.reversed_by,'reversalReason',r.reversal_reason) ORDER BY r.recorded_at DESC, r.id) FROM public.expense_share_receipts r WHERE r.share_id=s.id),'[]'::jsonb),
        'paymentReports',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'reportedBy',p.reported_by,'amountMinor',p.amount_minor,'sentOn',p.sent_on,'reference',p.reference,
          'reportedAt',p.reported_at,'status',p.status,'resolvedAt',p.resolved_at,'resolvedBy',p.resolved_by,'note',p.resolution_note,'receiptId',p.receipt_id) ORDER BY p.reported_at DESC, p.id)
          FROM (SELECT * FROM public.expense_share_payment_reports x WHERE x.share_id=s.id ORDER BY x.reported_at DESC, x.id LIMIT 10) p),'[]'::jsonb)) ORDER BY s.user_id) FROM public.expense_shares s WHERE s.expense_id=e.id),'[]'::jsonb)) ORDER BY e.created_at DESC, e.id DESC),'[]'::jsonb)
    FROM public.expenses e WHERE e.id = ANY (p_ids);
$$;


--
-- Name: expense_state(uuid); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.expense_state(p_expense_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT jsonb_build_object('title', e.title, 'amountMinor', e.amount_minor, 'paidByUserId', e.paid_by_user_id,
    'category', e.category, 'dueOn', e.due_on,
    'shares', coalesce((SELECT jsonb_agg(jsonb_build_object('userId', s.user_id, 'amountMinor', s.amount_minor) ORDER BY s.user_id)
      FROM public.expense_shares s WHERE s.expense_id = e.id), '[]'::jsonb))
  FROM public.expenses e WHERE e.id = p_expense_id;
$$;


--
-- Name: expense_window_start(); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.expense_window_start() RETURNS timestamp with time zone
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT (date_trunc('month', now() AT TIME ZONE 'UTC') - interval '1 month') AT TIME ZONE 'UTC';
$$;


--
-- Name: format_money(bigint, text); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.format_money(p_minor bigint, p_currency text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'pg_catalog'
    AS $_$
  SELECT CASE p_currency WHEN 'GBP' THEN '£' WHEN 'USD' THEN '$' WHEN 'EUR' THEN '€' ELSE '' END
    || to_char(p_minor / 100.0, 'FM999,999,999,999,990.00');
$_$;


--
-- Name: lock_fund_membership(uuid); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.lock_fund_membership(p_fund_id uuid) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT 1 FROM public.communes co JOIN public.funds f ON f.commune_id=co.id
    WHERE f.id=p_fund_id FOR UPDATE OF co;
$$;


--
-- Name: looks_like_contact(text); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.looks_like_contact(p_text text) RETURNS boolean
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO 'public', 'pg_temp'
    AS $_$
  SELECT coalesce(n.v ~* '://|www\.|[^[:space:]@]@[^[:space:]@]'
    OR n.v ~* '[^[:space:].]\.(com|net|org|io|co|uk|me|app|info|biz|xyz|link|ly|ru|top|site|online|shop)([^a-z0-9]|$)'
    OR n.v ~ ('[0-9]([\t\n\v\f\r\u0020-\u0025\u0027-\u002B\u002D-\u002F\u003A\u003C-\u0040\u005B-\u0060\u007B-\u007E'
      || '\u0080-\u00BF\u00D7\u00F7\u1680\u2000-\u2BFF\u3000-\u303F\U0001F000-\U0001FAFF]*[0-9]){8}'), false)
  FROM (SELECT regexp_replace(normalize(p_text, NFKC),
    '[\u00ad\u034f\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufe00-\ufe0f\ufeff]', '', 'g') AS v) n;
$_$;


--
-- Name: masked_address(text); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.masked_address(p_email text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
DECLARE
  v_name text := split_part(p_email, '@', 1);
  v_labels text[] := string_to_array(split_part(p_email, '@', 2), '.');
  v_count integer;
  v_ending integer := 1;
BEGIN
  v_count := coalesce(cardinality(v_labels), 0);
  IF v_name = '' OR v_count < 2 OR v_labels[1] = '' OR v_labels[v_count] = '' THEN RETURN NULL; END IF;
  -- Where names are registered under a second level, as in co.uk or com.au.
  IF v_count > 2 AND v_labels[v_count - 1] IN ('ac', 'co', 'com', 'edu', 'gov', 'ltd', 'net', 'nhs', 'org', 'plc', 'sch') THEN
    v_ending := 2;
  END IF;
  RETURN left(v_name, 1) || '•••@' || left(v_labels[1], 1) || '•••.'
    || array_to_string(v_labels[v_count - v_ending + 1 : v_count], '.');
END;
$$;


--
-- Name: member_by_name(uuid, text); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.member_by_name(p_commune_id uuid, p_name text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT CASE WHEN count(*) = 1 THEN min(m.user_id) END
  FROM public.commune_members m JOIN commune_private.accounts(ARRAY(SELECT x.user_id FROM public.commune_members x WHERE x.commune_id = p_commune_id AND x.active)) u ON u.id = m.user_id
  WHERE m.commune_id = p_commune_id AND m.active AND btrim(u.name) = btrim(p_name);
$$;


--
-- Name: member_name(text); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.member_name(p_user_id text) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT left(coalesce((SELECT u.name FROM commune_private.accounts(ARRAY[p_user_id]) u), 'Member'), 80);
$$;


--
-- Name: member_names(uuid); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.member_names(p_commune_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT coalesce(jsonb_object_agg(a.id, left(coalesce(a.name, 'Member'), 80)), '{}'::jsonb)
  FROM commune_private.accounts(ARRAY(SELECT m.user_id FROM public.commune_members m WHERE m.commune_id = p_commune_id)) a;
$$;


--
-- Name: money_correction_reserve(text, text, jsonb); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.money_correction_reserve(p_kind text, p_description text, p_details jsonb) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'pg_catalog'
    AS $$
  SELECT CASE
    WHEN p_description IN ('Expense voided', 'Expense corrected', 'Contribution corrected') THEN 'correction'
    WHEN p_kind = 'expenses' AND p_details ->> 'reversed' = 'true' THEN 'reversal'
  END;
$$;


--
-- Name: my_commune_ids(); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.my_commune_ids() RETURNS uuid[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT coalesce(array_agg(m.commune_id), '{}') FROM public.commune_members m
    WHERE m.user_id = commune_private.data_api_user_id() AND m.active;
$$;


--
-- Name: next_in_rotation(uuid, jsonb, text); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.next_in_rotation(p_commune_id uuid, p_rotation jsonb, p_current text) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  WITH r AS (
    SELECT e.value AS user_id, e.ord FROM jsonb_array_elements_text(p_rotation) WITH ORDINALITY e(value, ord)
    WHERE EXISTS (SELECT 1 FROM public.commune_members m WHERE m.commune_id = p_commune_id AND m.user_id = e.value AND m.active)
  ), here AS (
    SELECT coalesce((SELECT e.ord FROM jsonb_array_elements_text(p_rotation) WITH ORDINALITY e(value, ord)
      WHERE e.value = p_current LIMIT 1), 0) AS ord
  )
  SELECT coalesce(
    (SELECT r.user_id FROM r, here WHERE r.ord > here.ord ORDER BY r.ord LIMIT 1),
    (SELECT r.user_id FROM r ORDER BY r.ord LIMIT 1));
$$;


--
-- Name: next_operation_version(); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.next_operation_version() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;


--
-- Name: note_commune_change(); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.note_commune_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_key uuid := (to_jsonb(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END) ->> TG_ARGV[0])::uuid;
  v_noted text := coalesce(current_setting('commune.changed_communes', true), '');
  v_commune uuid;
BEGIN
  v_commune := CASE TG_ARGV[0]
    WHEN 'id' THEN v_key
    WHEN 'commune_id' THEN v_key
    WHEN 'expense_id' THEN (SELECT e.commune_id FROM public.expenses e WHERE e.id = v_key)
    WHEN 'share_id' THEN (SELECT e.commune_id FROM public.expense_shares s
      JOIN public.expenses e ON e.id = s.expense_id WHERE s.id = v_key)
    WHEN 'fund_id' THEN (SELECT f.commune_id FROM public.funds f WHERE f.id = v_key)
    WHEN 'commitment_id' THEN (SELECT f.commune_id FROM public.fund_commitments c
      JOIN public.funds f ON f.id = c.fund_id WHERE c.id = v_key)
    WHEN 'reminder_id' THEN (SELECT r.commune_id FROM public.reminders r WHERE r.id = v_key)
    WHEN 'announcement_id' THEN (SELECT a.commune_id FROM public.commune_announcements a WHERE a.id = v_key)
    WHEN 'bill_id' THEN (SELECT b.commune_id FROM public.recurring_bills b WHERE b.id = v_key)
  END;
  -- A row whose parent went first, as in a cascading delete, was noted with
  -- its parent.
  IF v_commune IS NULL OR strpos(v_noted, v_commune::text) > 0 THEN
    RETURN NULL;
  END IF;
  INSERT INTO commune_private.commune_changes (commune_id) VALUES (v_commune);
  PERFORM set_config('commune.changed_communes', v_noted || v_commune::text || ' ', true);
  RETURN NULL;
END;
$$;


--
-- Name: note_content(text, text, text, text, text, jsonb); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.note_content(p_title text, p_pill text, p_kicker text, p_lede text, p_body text, p_facts jsonb) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_title text := btrim(coalesce(p_title, ''));
BEGIN
  IF length(v_title) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Give the note a title of up to 80 characters' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(p_pill, '')) > 80 OR length(coalesce(p_kicker, '')) > 120 OR length(coalesce(p_lede, '')) > 200 THEN
    RAISE EXCEPTION 'The note''s type, label or summary is too long' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(p_body, '')) > 2000 THEN
    RAISE EXCEPTION 'Keep the note to 2000 characters' USING ERRCODE = '22023';
  END IF;
  IF NOT public.valid_note_facts(coalesce(p_facts, '[]'::jsonb)) THEN
    RAISE EXCEPTION 'A note holds up to 30 details of up to 120 characters each' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('title', v_title, 'pill', coalesce(p_pill, ''), 'kicker', coalesce(p_kicker, ''),
    'lede', coalesce(p_lede, ''), 'body', coalesce(p_body, ''), 'facts', coalesce(p_facts, '[]'::jsonb));
END;
$$;


--
-- Name: note_search_excerpt(text, text, text, jsonb); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.note_search_excerpt(p_pill text, p_body text, p_lede text, p_facts jsonb) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO 'pg_catalog'
    AS $$
  SELECT CASE
    WHEN p_pill = 'Wi-Fi' THEN 'Network and password. Open to view connection details.'
    WHEN p_pill = 'Keys / door' THEN 'Access details. Open to view.'
    WHEN p_pill IN ('Contacts', 'Landlord', 'Emergency') THEN 'Contact details. Open to view.'
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(p_facts) f
      WHERE f->>0 ~* 'password|passcode|door code|access code|pin code')
      THEN 'Shared details. Open to view.'
    ELSE left(coalesce(nullif(p_body, ''), p_lede, ''), 160)
  END;
$$;


--
-- Name: notify_ledger(uuid, text, text, uuid, text, bigint, text); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.notify_ledger(p_commune_id uuid, p_recipient text, p_kind text, p_expense_id uuid, p_actor text, p_amount_minor bigint, p_detail text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF p_recipient IS NULL OR p_actor IS NULL OR p_recipient = p_actor OR NOT EXISTS (SELECT 1 FROM public.commune_members m
      WHERE m.commune_id = p_commune_id AND m.user_id = p_recipient AND m.active) THEN
    RETURN;
  END IF;
  UPDATE public.notifications SET amount_minor = p_amount_minor, detail = left(p_detail, 240), created_at = now()
    WHERE recipient_user_id = p_recipient AND commune_id = p_commune_id AND expense_id = p_expense_id
      AND notice_kind = p_kind AND actor_user_id = p_actor AND read_at IS NULL;
  IF NOT FOUND THEN
    INSERT INTO public.notifications (commune_id, recipient_user_id, notice_kind, expense_id, actor_user_id, amount_minor, detail)
      VALUES (p_commune_id, p_recipient, p_kind, p_expense_id, p_actor, p_amount_minor, left(p_detail, 240));
  END IF;
END;
$$;


--
-- Name: notify_pledge(uuid, text, text, uuid, text, bigint, text); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.notify_pledge(p_commune_id uuid, p_recipient text, p_kind text, p_commitment_id uuid, p_actor text, p_amount_minor bigint, p_detail text) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public', 'pg_temp'
    AS $$
  UPDATE public.notifications SET amount_minor = p_amount_minor, detail = left(p_detail, 240), created_at = now()
    WHERE recipient_user_id = p_recipient AND commune_id = p_commune_id AND commitment_id = p_commitment_id
      AND notice_kind = p_kind AND actor_user_id = p_actor AND read_at IS NULL
      AND p_recipient <> p_actor AND EXISTS (SELECT 1 FROM public.commune_members m
        WHERE m.commune_id = p_commune_id AND m.user_id = p_recipient AND m.active);
  INSERT INTO public.notifications (commune_id, recipient_user_id, notice_kind, commitment_id, actor_user_id, amount_minor, detail)
  SELECT p_commune_id, p_recipient, p_kind, p_commitment_id, p_actor, p_amount_minor, left(p_detail, 240)
  WHERE p_recipient <> p_actor AND EXISTS (SELECT 1 FROM public.commune_members m
    WHERE m.commune_id = p_commune_id AND m.user_id = p_recipient AND m.active)
    AND NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.recipient_user_id = p_recipient
      AND n.commune_id = p_commune_id AND n.commitment_id = p_commitment_id AND n.notice_kind = p_kind
      AND n.actor_user_id = p_actor AND n.read_at IS NULL);
$$;


--
-- Name: occurrence_reason(text); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.occurrence_reason(p_reason text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF length(v_reason) > 200 THEN
    RAISE EXCEPTION 'Keep the reason to 200 characters' USING ERRCODE = '22023';
  END IF;
  RETURN v_reason;
END;
$$;


--
-- Name: occurrence_result(uuid, boolean, uuid); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.occurrence_result(p_id uuid, p_duplicate boolean, p_operation_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT jsonb_build_object('id', p_id, 'duplicate', p_duplicate, 'date', o.date,
    'assignee', CASE WHEN o.assignee_id IS NULL THEN o.assignee ELSE commune_private.member_name(o.assignee_id) END,
    'assigneeId', o.assignee_id, 'turnOwnerId', o.turn_owner_id, 'status', o.status)
  FROM public.commune_operations o WHERE o.id = p_operation_id;
$$;


--
-- Name: operation_content(text, text, text, date, time without time zone, boolean, text, jsonb, text, text); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.operation_content(p_kind text, p_category text, p_title text, p_date date, p_time time without time zone, p_all_day boolean, p_assignee_id text, p_rotation_ids jsonb, p_repeat text, p_notes text) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_title text := btrim(coalesce(p_title, ''));
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('task', 'event') THEN
    RAISE EXCEPTION 'Choose a task or an event' USING ERRCODE = '22023';
  END IF;
  IF p_category IS NULL OR p_category NOT IN ('chore', 'delivery', 'visit', 'appointment', 'other') THEN
    RAISE EXCEPTION 'Choose what kind of event this is' USING ERRCODE = '22023';
  END IF;
  IF length(v_title) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Give it a title of up to 80 characters' USING ERRCODE = '22023';
  END IF;
  IF p_date IS NULL OR p_all_day IS NULL THEN
    RAISE EXCEPTION 'Choose a date, and all day or a time' USING ERRCODE = '22023';
  END IF;
  IF p_repeat IS NULL OR p_repeat NOT IN ('none', 'weekly', 'monthly') THEN
    RAISE EXCEPTION 'Choose how often it repeats' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(p_notes, '')) > 1000 THEN
    RAISE EXCEPTION 'Keep the details to 1000 characters' USING ERRCODE = '22023';
  END IF;
  -- Keys are the column names, so jsonb_populate_record can read it back.
  RETURN jsonb_build_object('kind', p_kind, 'category', p_category, 'title', v_title, 'date', p_date,
    'time', p_time, 'all_day', p_all_day, 'assignee_id', nullif(p_assignee_id, ''),
    'rotation_ids', CASE WHEN p_rotation_ids = '[]'::jsonb THEN NULL ELSE p_rotation_ids END,
    'repeat', p_repeat, 'notes', coalesce(p_notes, ''));
END;
$$;


--
-- Name: pay_links_for(text); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.pay_links_for(p_user_id text) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('provider', l.provider, 'handle', l.handle,
      'accountName', l.account_name, 'sortCode', l.sort_code, 'accountNumber', l.account_number,
      'preferred', l.preferred, 'updatedAt', l.updated_at)
    ORDER BY l.preferred DESC, array_position(ARRAY['monzo', 'paypal', 'revolut', 'bank'], l.provider)), '[]'::jsonb)
  FROM public.member_pay_links l WHERE l.user_id = p_user_id;
$$;


--
-- Name: payment_report_result(uuid, boolean); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.payment_report_result(p_id uuid, p_duplicate boolean) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT jsonb_build_object('id', r.id, 'duplicate', p_duplicate, 'status', r.status, 'receiptId', r.receipt_id,
    'settledMinor', s.settled_minor, 'outstandingMinor', s.amount_minor - s.settled_minor)
  FROM public.expense_share_payment_reports r JOIN public.expense_shares s ON s.id = r.share_id WHERE r.id = p_id;
$$;


--
-- Name: project_share_settlement(uuid); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.project_share_settlement(p_share_id uuid) RETURNS bigint
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_total bigint; v_settled bigint;
BEGIN
  SELECT coalesce(sum(r.amount_minor), 0) INTO v_total FROM public.expense_share_receipts r
    WHERE r.share_id = p_share_id AND r.reversed_at IS NULL;
  UPDATE public.expense_shares s SET settled_minor = v_total,
      settled_at = CASE WHEN v_total < s.amount_minor THEN NULL
        WHEN s.settled_minor >= s.amount_minor THEN coalesce(s.settled_at, now()) ELSE now() END
    WHERE s.id = p_share_id RETURNING s.settled_minor INTO v_settled;
  RETURN v_settled;
END;
$$;


--
-- Name: prune_delivery_records(); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.prune_delivery_records() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_payloads integer; v_invitations integer; v_changes integer; v_reports integer;
BEGIN
  UPDATE public.reminder_email_outbox SET payload = NULL, payload_amount_minor = NULL
    WHERE payload IS NOT NULL AND created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_payloads = ROW_COUNT;
  DELETE FROM public.invitation_email_deliveries
    WHERE created_at < now() - interval '30 days' AND status IN ('sent', 'failed', 'sending');
  GET DIAGNOSTICS v_invitations = ROW_COUNT;
  -- Marks look back to the start of yesterday at most.
  DELETE FROM commune_private.commune_changes WHERE changed_at < now() - interval '2 days';
  GET DIAGNOSTICS v_changes = ROW_COUNT;
  DELETE FROM commune_private.client_reports WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_reports = ROW_COUNT;
  RETURN jsonb_build_object('reminderPayloads', v_payloads, 'invitationEmails', v_invitations, 'changeMarks', v_changes,
    'clientReports', v_reports);
END;
$$;


--
-- Name: reassign_departed_member(); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.reassign_departed_member() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_op public.commune_operations%ROWTYPE;
  v_rotation jsonb; v_next text; v_turn_owner text; v_name text := commune_private.member_name(NEW.user_id);
  v_actor text := coalesce(nullif(commune_private.data_api_user_id(), ''), NEW.user_id);
BEGIN
  FOR v_op IN SELECT * FROM public.commune_operations o WHERE o.commune_id = NEW.commune_id AND o.deleted_at IS NULL
      AND (o.assignee_id = NEW.user_id OR o.rotation_ids ? NEW.user_id OR o.turn_owner_id = NEW.user_id)
      ORDER BY o.id FOR UPDATE LOOP
    SELECT jsonb_agg(e.value ORDER BY e.ord) INTO v_rotation
      FROM jsonb_array_elements_text(v_op.rotation_ids) WITH ORDINALITY e(value, ord) WHERE e.value <> NEW.user_id;
    v_next := v_op.assignee_id;
    v_turn_owner := CASE WHEN v_op.turn_owner_id = NEW.user_id THEN NULL ELSE v_op.turn_owner_id END;
    IF v_op.assignee_id = NEW.user_id THEN
      IF v_turn_owner IS NOT NULL THEN
        v_next := v_turn_owner;
        v_turn_owner := NULL;
      ELSE
        v_next := CASE WHEN v_op.rotation_ids IS NULL THEN NULL
          ELSE commune_private.next_in_rotation(v_op.commune_id, v_op.rotation_ids, NEW.user_id) END;
      END IF;
    END IF;
    PERFORM set_config('commune.occurrence_event', 'on', true);
    UPDATE public.commune_operations SET assignee_id = v_next,
        assignee = CASE WHEN v_next IS NULL THEN NULL ELSE commune_private.member_name(v_next) END,
        turn_owner_id = v_turn_owner,
        rotation_ids = v_rotation,
        rotation = CASE WHEN v_rotation IS NULL THEN NULL ELSE
          (SELECT jsonb_agg(commune_private.member_name(e.value) ORDER BY e.ord) FROM jsonb_array_elements_text(v_rotation) WITH ORDINALITY e(value, ord)) END,
        updated_at = now()
      WHERE id = v_op.id;
    PERFORM set_config('commune.occurrence_event', 'off', true);
    IF v_op.assignee_id = NEW.user_id THEN
      INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
        VALUES (v_op.commune_id, v_actor, 'operations', v_op.id, v_op.title,
          left(v_name || ' left. ' || CASE WHEN v_next IS NULL THEN 'Now unassigned' ELSE 'Now with ' || commune_private.member_name(v_next) END, 240));
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;


--
-- Name: record_commune_change(); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.record_commune_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_commune uuid;v_title text;v_entity uuid;v_kind text;v_description text;v_details jsonb:='{}';
BEGIN
  IF TG_TABLE_NAME IN ('commune_operations','recurring_bills') AND current_setting('commune.occurrence_event', true)='on' THEN RETURN NEW; END IF;
  v_kind:=CASE TG_TABLE_NAME WHEN 'fund_commitments' THEN 'funds' WHEN 'fund_contributions' THEN 'funds' WHEN 'commune_members' THEN 'members'
    WHEN 'recurring_bills' THEN 'recurring' WHEN 'split_templates' THEN 'templates' WHEN 'commune_notes' THEN 'notes' WHEN 'commune_operations' THEN 'operations' WHEN 'expense_shares' THEN 'expenses' ELSE 'funds' END;
  IF TG_TABLE_NAME='fund_commitments' THEN
    SELECT f.commune_id,f.name INTO v_commune,v_title FROM public.funds f WHERE f.id=NEW.fund_id;v_entity:=NEW.fund_id;
    v_description:=CASE WHEN TG_OP='INSERT' THEN 'Pledge made' WHEN NEW.cancelled_at IS NOT NULL THEN 'Pledge cancelled' ELSE 'Pledge updated' END;
  ELSIF TG_TABLE_NAME='fund_contributions' THEN
    SELECT f.commune_id,f.name,f.id INTO v_commune,v_title,v_entity FROM public.fund_commitments c JOIN public.funds f ON f.id=c.fund_id WHERE c.id=NEW.commitment_id;
    v_description:=CASE WHEN NEW.voided_at IS NOT NULL THEN 'Contribution corrected' ELSE 'Contribution recorded' END;
  ELSIF TG_TABLE_NAME='commune_members' THEN
    v_commune:=NEW.commune_id;v_entity:=NEW.commune_id;
    SELECT coalesce(u.name,'Member') INTO v_title FROM commune_private.accounts(ARRAY[NEW.user_id]) u;
    v_description:=CASE WHEN NOT NEW.active THEN 'Membership ended' WHEN TG_OP='INSERT' THEN 'Joined the commune' ELSE 'Membership updated' END;
  ELSIF TG_TABLE_NAME='expense_shares' THEN
    IF NEW.settled_minor=OLD.settled_minor THEN RETURN NEW; END IF;
    SELECT e.commune_id,e.title,e.id INTO v_commune,v_title,v_entity FROM public.expenses e WHERE e.id=NEW.expense_id;v_description:='Share confirmed received';
  ELSE
    v_commune:=NEW.commune_id;v_entity:=NEW.id;
    IF TG_TABLE_NAME IN ('funds','split_templates') THEN v_title:=NEW.name;
    ELSE v_title:=NEW.title; END IF;
    v_description:=CASE WHEN TG_OP='INSERT' THEN 'Created' ELSE 'Updated' END;
  END IF;
  IF TG_TABLE_NAME NOT IN ('commune_notes','commune_operations') THEN
    v_details:=jsonb_build_object('before',CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,'after',to_jsonb(NEW));
  END IF;
  INSERT INTO public.commune_events(commune_id,actor_id,kind,entity_id,title,description,details)
    VALUES(v_commune,commune_private.data_api_user_id(),v_kind,v_entity,coalesce(v_title,'Shared record'),v_description,v_details);
  RETURN NEW;
END;
$$;


--
-- Name: record_note_revision(); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.record_note_revision() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_actor text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub';
BEGIN
  IF NEW.commune_id IS DISTINCT FROM OLD.commune_id THEN
    RAISE EXCEPTION 'A note cannot move between communes' USING ERRCODE = '22023';
  END IF;
  -- The version is the database's to set, never the client's.
  NEW.version := OLD.version;
  IF (NEW.title, NEW.pill, NEW.kicker, NEW.lede, NEW.body, NEW.facts)
     IS NOT DISTINCT FROM (OLD.title, OLD.pill, OLD.kicker, OLD.lede, OLD.body, OLD.facts) THEN
    NEW.updated_by := OLD.updated_by;
    RETURN NEW;
  END IF;
  INSERT INTO public.note_revisions (note_id, commune_id, version, title, pill, kicker, lede, body, facts,
      edited_by, edited_at, replaced_by, replaced_at)
    VALUES (OLD.id, OLD.commune_id, OLD.version, OLD.title, OLD.pill, OLD.kicker, OLD.lede, OLD.body, OLD.facts,
      OLD.updated_by, OLD.updated_at, v_actor, now());
  DELETE FROM public.note_revisions WHERE note_id = OLD.id AND version <= OLD.version - 50;
  NEW.version := OLD.version + 1;
  NEW.updated_by := coalesce(v_actor, NEW.updated_by);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


--
-- Name: record_receipt_event(); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.record_receipt_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_commune uuid; v_expense uuid; v_title text; v_currency text; v_description text;
BEGIN
  IF TG_OP = 'UPDATE' AND NOT (OLD.reversed_at IS NULL AND NEW.reversed_at IS NOT NULL) THEN RETURN NEW; END IF;
  SELECT e.commune_id, e.id, e.title, co.currency INTO v_commune, v_expense, v_title, v_currency
    FROM public.expense_shares s JOIN public.expenses e ON e.id = s.expense_id
    JOIN public.communes co ON co.id = e.commune_id WHERE s.id = NEW.share_id;
  v_description := 'Repayment of ' || commune_private.format_money(NEW.amount_minor, v_currency)
    || CASE WHEN TG_OP = 'INSERT' THEN ' recorded' ELSE ' reversed' END;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description, details)
    VALUES (v_commune, commune_private.data_api_user_id(), 'expenses', v_expense, v_title, v_description,
      jsonb_build_object('receiptId', NEW.id, 'shareId', NEW.share_id, 'amountMinor', NEW.amount_minor,
        'receivedOn', NEW.received_on, 'reversed', TG_OP = 'UPDATE', 'reason', NEW.reversal_reason));
  RETURN NEW;
END;
$$;


--
-- Name: recurring_bill_result(uuid, boolean); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.recurring_bill_result(p_id uuid, p_duplicate boolean) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT jsonb_build_object('id', b.id, 'paused', b.paused, 'archivedAt', b.archived_at,
    'version', b.version, 'duplicate', p_duplicate)
  FROM public.recurring_bills b WHERE b.id = p_id;
$$;


--
-- Name: recurring_departed_names(uuid, text, jsonb); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.recurring_departed_names(p_commune_id uuid, p_paid_by text, p_shares jsonb) RETURNS text[]
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT array_agg(coalesce(u.name, 'A former member') ORDER BY p.ord)
  FROM (SELECT x.user_id, min(x.ord) AS ord FROM (
      SELECT p_paid_by AS user_id, 0::bigint AS ord
      UNION ALL SELECT e.value->>'user_id', e.ord FROM jsonb_array_elements(p_shares) WITH ORDINALITY e(value, ord)
    ) x GROUP BY x.user_id) p
  LEFT JOIN commune_private.accounts(ARRAY(SELECT p_paid_by UNION SELECT e->>'user_id' FROM jsonb_array_elements(p_shares) e)) u ON u.id = p.user_id
  WHERE NOT EXISTS (SELECT 1 FROM public.commune_members m
    WHERE m.commune_id = p_commune_id AND m.user_id = p.user_id AND m.active);
$$;


--
-- Name: recurring_next_due(text, date, integer); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.recurring_next_due(p_frequency text, p_due date, p_anchor_day integer) RETURNS date
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'pg_catalog'
    AS $$
  SELECT CASE WHEN p_frequency = 'weekly' THEN p_due + 7
    ELSE (date_trunc('month', p_due) + interval '1 month')::date
      + (least(p_anchor_day, extract(day FROM (date_trunc('month', p_due) + interval '2 month - 1 day'))::integer) - 1) END;
$$;


--
-- Name: recurring_period_result(uuid, date, boolean); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.recurring_period_result(p_bill_id uuid, p_due date, p_duplicate boolean) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT jsonb_build_object('status', o.status, 'expenseId', o.expense_id, 'amountMinor', o.amount_minor,
    'dueOn', o.due_on, 'nextDueOn', b.next_due_on, 'duplicate', p_duplicate)
  FROM public.recurring_bill_occurrences o JOIN public.recurring_bills b ON b.id = o.bill_id
  WHERE o.bill_id = p_bill_id AND o.due_on = p_due;
$$;


--
-- Name: reminder_email_state(uuid); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.reminder_email_state(p_reminder_id uuid) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT coalesce((SELECT CASE
      WHEN q.status = 'suppressed' AND q.last_error IS NOT NULL THEN 'none'
      ELSE 'possible' END
    FROM public.reminder_email_outbox q WHERE q.reminder_id = p_reminder_id), 'none');
$$;


--
-- Name: report_text(text, integer); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.report_text(p_text text, p_limit integer) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'pg_catalog', 'pg_temp'
    AS $$
  SELECT CASE WHEN btrim(t.kept, E' \t\r\n') = '' THEN NULL ELSE t.kept END
  FROM (SELECT left(
    regexp_replace(
      regexp_replace(
        regexp_replace(left(p_text, 4 * p_limit),
          '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', ':id', 'gi'),
        '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}', '[email]', 'g'),
      '(https?://[^\s?#)]*)[?#][^\s)]*', '\1', 'gi'),
    p_limit) AS kept) t
$$;


--
-- Name: revoke_orphaned_invites(uuid); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.revoke_orphaned_invites(p_commune_id uuid) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.commune_invites i SET revoked_at = now()
    WHERE (p_commune_id IS NULL OR i.commune_id = p_commune_id)
      AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > now()
      AND NOT EXISTS (SELECT 1 FROM public.commune_members m WHERE m.commune_id = i.commune_id
        AND m.user_id = i.invited_by AND m.active AND m.role = 'admin');
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


--
-- Name: scale_recurring_shares(jsonb, bigint); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.scale_recurring_shares(p_shares jsonb, p_amount_minor bigint) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'pg_catalog'
    AS $$
  WITH s AS (
    SELECT e.ord, e.value->>'user_id' AS user_id, (e.value->>'amount_minor')::numeric AS amt
    FROM jsonb_array_elements(p_shares) WITH ORDINALITY e(value, ord)
  ), t AS (SELECT sum(amt) AS total FROM s),
  f AS (
    SELECT s.ord, s.user_id, floor(p_amount_minor::numeric * s.amt / t.total) AS base,
      mod(p_amount_minor::numeric * s.amt, t.total) AS rem
    FROM s, t
  ), spare AS (SELECT p_amount_minor - sum(base) AS n FROM f),
  ranked AS (SELECT f.*, row_number() OVER (ORDER BY rem DESC, ord) AS rk FROM f)
  SELECT jsonb_agg(jsonb_build_object('user_id', user_id, 'amount_minor', amount) ORDER BY ord)
  FROM (SELECT ranked.ord, ranked.user_id, (base + CASE WHEN rk <= spare.n THEN 1 ELSE 0 END)::bigint AS amount
        FROM ranked, spare) scaled
  WHERE amount > 0;
$$;


--
-- Name: set_operation_anchor(); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.set_operation_anchor() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (coalesce(current_setting('commune.occurrence_event', true), '') <> 'on'
     AND (NEW.date IS DISTINCT FROM OLD.date OR NEW.repeat IS DISTINCT FROM OLD.repeat)) THEN
    NEW.anchor_day := extract(day FROM NEW.date)::smallint;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_operation_people(); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.set_operation_people() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_command boolean := coalesce(current_setting('commune.occurrence_event', true), '') = 'on';
  v_id text;
BEGIN
  IF NOT v_command THEN
    -- An older client sends names only. On an update the id columns carry
    -- over unchanged, so a changed name with an unchanged id is such a write.
    IF nullif(btrim(NEW.assignee), '') IS NOT NULL AND (
        (TG_OP = 'INSERT' AND NEW.assignee_id IS NULL)
        OR (TG_OP = 'UPDATE' AND NEW.assignee IS DISTINCT FROM OLD.assignee
            AND NEW.assignee_id IS NOT DISTINCT FROM OLD.assignee_id)) THEN
      NEW.assignee_id := commune_private.member_by_name(NEW.commune_id, NEW.assignee);
      IF NEW.assignee_id IS NULL THEN
        RAISE EXCEPTION 'Choose a current member of this commune' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF jsonb_typeof(NEW.rotation) = 'array' AND jsonb_array_length(NEW.rotation) > 0 AND (
        (TG_OP = 'INSERT' AND NEW.rotation_ids IS NULL)
        OR (TG_OP = 'UPDATE' AND NEW.rotation IS DISTINCT FROM OLD.rotation
            AND NEW.rotation_ids IS NOT DISTINCT FROM OLD.rotation_ids)) THEN
      SELECT jsonb_agg(commune_private.member_by_name(NEW.commune_id, e.value) ORDER BY e.ord) INTO NEW.rotation_ids
        FROM jsonb_array_elements_text(NEW.rotation) WITH ORDINALITY e(value, ord);
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.rotation_ids) e WHERE e.value = 'null'::jsonb)
         OR NOT public.valid_operation_member_ids(NEW.rotation_ids) THEN
        RAISE EXCEPTION 'Choose current members of this commune for the rotation' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF NEW.kind <> 'task' AND (NEW.assignee_id IS NOT NULL OR NEW.rotation_ids IS NOT NULL) THEN
      RAISE EXCEPTION 'Only tasks have people' USING ERRCODE = '22023';
    END IF;
    IF NEW.assignee_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id)
       AND NOT EXISTS (SELECT 1 FROM public.commune_members m
         WHERE m.commune_id = NEW.commune_id AND m.user_id = NEW.assignee_id AND m.active) THEN
      RAISE EXCEPTION 'Choose a current member of this commune' USING ERRCODE = '22023';
    END IF;
    IF NEW.rotation_ids IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.rotation_ids IS DISTINCT FROM OLD.rotation_ids) THEN
      IF NOT public.valid_operation_member_ids(NEW.rotation_ids) THEN
        RAISE EXCEPTION 'Choose each person in the rotation once' USING ERRCODE = '22023';
      END IF;
      FOR v_id IN SELECT jsonb_array_elements_text(NEW.rotation_ids) LOOP
        IF NOT EXISTS (SELECT 1 FROM public.commune_members m
            WHERE m.commune_id = NEW.commune_id AND m.user_id = v_id AND m.active) THEN
          RAISE EXCEPTION 'Choose current members of this commune for the rotation' USING ERRCODE = '22023';
        END IF;
      END LOOP;
    END IF;
    IF TG_OP = 'INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
       OR NEW.rotation_ids IS DISTINCT FROM OLD.rotation_ids OR NEW.repeat IS DISTINCT FROM OLD.repeat THEN
      NEW.turn_owner_id := NULL;
    END IF;
    IF NEW.rotation_ids IS NOT NULL AND NEW.assignee_id IS NOT NULL AND NOT NEW.rotation_ids ? NEW.assignee_id
       AND NOT (NEW.turn_owner_id IS NOT NULL AND NEW.rotation_ids ? NEW.turn_owner_id) THEN
      RAISE EXCEPTION 'The person it is with now must be in the rotation' USING ERRCODE = '22023';
    END IF;
  END IF;
  -- Copy names from ids so older readers stay correct. A write that clears
  -- an id clears the copied name with it.
  IF NEW.assignee_id IS NOT NULL THEN
    NEW.assignee := commune_private.member_name(NEW.assignee_id);
  ELSIF NOT v_command AND TG_OP = 'UPDATE' AND OLD.assignee_id IS NOT NULL THEN
    NEW.assignee := NULL;
  END IF;
  IF NEW.rotation_ids IS NOT NULL THEN
    SELECT jsonb_agg(commune_private.member_name(e.value) ORDER BY e.ord) INTO NEW.rotation
      FROM jsonb_array_elements_text(NEW.rotation_ids) WITH ORDINALITY e(value, ord);
  ELSIF NOT v_command AND TG_OP = 'UPDATE' AND OLD.rotation_ids IS NOT NULL THEN
    NEW.rotation := NULL;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: snapshot_announcements(uuid); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.snapshot_announcements(p_commune_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'body', a.body, 'authorId', a.author_id,
      'createdAt', a.created_at, 'needsAcknowledgement', a.needs_acknowledgement,
      'acknowledgements', coalesce((SELECT jsonb_agg(jsonb_build_object('userId', k.user_id, 'acknowledgedAt', k.acknowledged_at)
        ORDER BY k.acknowledged_at) FROM public.announcement_acknowledgements k WHERE k.announcement_id = a.id), '[]'::jsonb))
    ORDER BY a.created_at DESC), '[]'::jsonb)
  FROM public.commune_announcements a WHERE a.commune_id = p_commune_id AND a.archived_at IS NULL;
$$;


--
-- Name: snapshot_expense_ids(uuid, timestamp with time zone); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.snapshot_expense_ids(p_commune_id uuid, p_since timestamp with time zone) RETURNS SETOF uuid
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT e.id FROM public.expenses e
    WHERE e.commune_id = p_commune_id
      AND (e.created_at >= p_since OR e.updated_at >= p_since
        OR EXISTS (SELECT 1 FROM public.expense_shares s WHERE s.expense_id = e.id
          AND ((e.voided_at IS NULL AND s.settled_minor < s.amount_minor) OR s.settled_at >= p_since)))
  UNION
  (SELECT e.id FROM public.expenses e WHERE e.commune_id = p_commune_id AND e.voided_at IS NULL
    ORDER BY e.created_at DESC, e.id DESC LIMIT 5);
$$;


--
-- Name: snapshot_expenses(uuid); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.snapshot_expenses(p_commune_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT commune_private.expense_records(ARRAY(
    SELECT commune_private.snapshot_expense_ids(p_commune_id, commune_private.expense_window_start())));
$$;


--
-- Name: snapshot_notifications(uuid, text); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.snapshot_notifications(p_commune_id uuid, p_actor text) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',n.id,'communeId',n.commune_id,
      'kind',coalesce(r.kind,replace(n.notice_kind,'_','-')),'sourceId',coalesce(r.source_id,n.expense_id,n.commitment_id),
      'amountMinor',coalesce(r.amount_minor,n.amount_minor),'senderUserId',coalesce(r.sender_user_id,n.actor_user_id),
      'expenseId',n.expense_id,'title',coalesce(e.title,pf.name),'detail',n.detail,'createdAt',n.created_at,'readAt',n.read_at) ORDER BY n.created_at DESC),'[]'::jsonb)
    FROM (SELECT * FROM public.notifications x WHERE x.commune_id=p_commune_id AND x.recipient_user_id=p_actor
      ORDER BY x.read_at IS NULL DESC, x.created_at DESC LIMIT 100) n LEFT JOIN public.reminders r ON r.id=n.reminder_id
    LEFT JOIN public.expenses e ON e.id=n.expense_id
    LEFT JOIN public.fund_commitments pc ON pc.id=n.commitment_id LEFT JOIN public.funds pf ON pf.id=pc.fund_id
    WHERE n.commune_id=p_commune_id AND n.recipient_user_id=p_actor;
$$;


--
-- Name: snapshot_operations(uuid); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.snapshot_operations(p_commune_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  WITH names AS MATERIALIZED (SELECT commune_private.member_names(p_commune_id) AS map)
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'hubId',o.commune_id,'kind',o.kind,'category',o.category,'title',o.title,'date',o.date,'time',o.time,'allDay',o.all_day,
      'version',o.version,'createdBy',o.created_by,
      'assignee',CASE WHEN o.assignee_id IS NULL THEN o.assignee ELSE coalesce(names.map->>o.assignee_id, commune_private.member_name(o.assignee_id)) END,
      'assigneeId',o.assignee_id,
      'turnOwnerId',o.turn_owner_id,
      'turnOwner',CASE WHEN o.turn_owner_id IS NULL THEN NULL ELSE coalesce(names.map->>o.turn_owner_id, commune_private.member_name(o.turn_owner_id)) END,
      'rotation',CASE WHEN o.rotation_ids IS NULL THEN o.rotation ELSE
        (SELECT jsonb_agg(coalesce(names.map->>e.value, commune_private.member_name(e.value)) ORDER BY e.ord) FROM jsonb_array_elements_text(o.rotation_ids) WITH ORDINALITY e(value, ord)) END,
      'rotationIds',o.rotation_ids,
      'lastDone',o.last_done,'repeat',o.repeat,'anchorDay',o.anchor_day,'status',o.status,'notes',o.notes,
      -- The latest action, only while the task is still exactly as it left it.
      'undoOccurrenceId',(SELECT u.id FROM public.operation_occurrences u WHERE u.operation_id=o.id AND u.undone_at IS NULL
        AND u.next_date=o.date AND u.next_assignee_id IS NOT DISTINCT FROM o.assignee_id
        AND (o.assignee_id IS NOT NULL OR u.next_assignee IS NOT DISTINCT FROM o.assignee)
        AND u.next_turn_owner_id IS NOT DISTINCT FROM o.turn_owner_id
        AND u.next_status=o.status AND u.next_last_done IS NOT DISTINCT FROM o.last_done
        AND NOT EXISTS(SELECT 1 FROM public.operation_occurrences later WHERE later.operation_id=o.id AND later.undone_at IS NULL AND later.id<>u.id AND later.acted_at>=u.acted_at)
        ORDER BY u.acted_at DESC LIMIT 1),
      'history',coalesce((SELECT jsonb_agg(jsonb_build_object('id',h.id,'action',h.action,'dueOn',h.due_on,
          'assignee',CASE WHEN h.assignee_id IS NULL THEN h.assignee ELSE coalesce(names.map->>h.assignee_id, commune_private.member_name(h.assignee_id)) END,'assigneeId',h.assignee_id,
          'actorId',h.actor_id,'actedOn',h.acted_on,'actedAt',h.acted_at,'nextDate',h.next_date,
          'nextAssignee',CASE WHEN h.next_assignee_id IS NULL THEN h.next_assignee ELSE coalesce(names.map->>h.next_assignee_id, commune_private.member_name(h.next_assignee_id)) END,'nextAssigneeId',h.next_assignee_id,
          'reason',h.reason,'doneById',h.done_by_id,
          'undoneAt',h.undone_at,'undoneBy',h.undone_by) ORDER BY h.acted_at DESC, h.id)
        FROM (SELECT * FROM public.operation_occurrences x WHERE x.operation_id=o.id ORDER BY x.acted_at DESC, x.id LIMIT 12) h),'[]'::jsonb)
    ) ORDER BY o.date,o.time),'[]'::jsonb)
    FROM public.commune_operations o CROSS JOIN names WHERE o.commune_id=p_commune_id AND o.deleted_at IS NULL;
$$;


--
-- Name: snapshot_pay_links(uuid); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.snapshot_pay_links(p_commune_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT coalesce(jsonb_object_agg(m.user_id, commune_private.pay_links_for(m.user_id)), '{}'::jsonb)
  FROM public.commune_members m
  WHERE m.commune_id = p_commune_id AND m.active
    AND EXISTS (SELECT 1 FROM public.member_pay_links l WHERE l.user_id = m.user_id);
$$;


--
-- Name: snapshot_sent_reminders(uuid, text); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.snapshot_sent_reminders(p_commune_id uuid, p_actor text) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'sourceId',r.source_id,'recipientUserId',r.recipient_user_id,'amountMinor',r.amount_minor,'createdAt',r.created_at,
      'emailStatus',commune_private.reminder_email_state(r.id)) ORDER BY r.created_at DESC),'[]'::jsonb)
    FROM (SELECT * FROM public.reminders sent WHERE sent.commune_id=p_commune_id AND sent.sender_user_id=p_actor
      AND sent.created_at > now() - interval '30 days' ORDER BY sent.created_at DESC LIMIT 50) r;
$$;


--
-- Name: start_note_version(); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.start_note_version() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.version := 1;
  NEW.updated_by := NEW.created_by;
  RETURN NEW;
END;
$$;


--
-- Name: unread_notice_count(uuid, text); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.unread_notice_count(p_commune_id uuid, p_user_id text) RETURNS integer
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT count(*)::integer FROM public.notifications n
    WHERE n.recipient_user_id = p_user_id AND n.commune_id = p_commune_id AND n.read_at IS NULL;
$$;


--
-- Name: validate_expense_split(uuid, bigint, jsonb); Type: FUNCTION; Schema: commune_private; Owner: -
--

CREATE FUNCTION commune_private.validate_expense_split(p_commune_id uuid, p_amount bigint, p_shares jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_count integer; v_distinct integer; v_sum numeric;
BEGIN
  IF p_amount IS NULL OR p_amount NOT BETWEEN 1 AND 1000000000000
     OR jsonb_typeof(p_shares) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid expense amount or split' USING ERRCODE = '22023';
  END IF;
  SELECT count(*), count(DISTINCT s.user_id), sum(s.amount_minor)
    INTO v_count, v_distinct, v_sum FROM jsonb_to_recordset(p_shares) AS s(user_id text, amount_minor bigint);
  IF v_count NOT BETWEEN 1 AND 100 OR v_count <> v_distinct OR v_sum IS DISTINCT FROM p_amount
    OR EXISTS (SELECT 1 FROM jsonb_to_recordset(p_shares) AS s(user_id text, amount_minor bigint)
      WHERE s.amount_minor IS NULL OR s.amount_minor <= 0 OR NOT EXISTS (
        SELECT 1 FROM public.commune_members m WHERE m.commune_id = p_commune_id
          AND m.user_id = s.user_id AND m.active)) THEN
    RAISE EXCEPTION 'Shares must be positive, unique, belong to active members, and total the expense' USING ERRCODE = '22023';
  END IF;
END;
$$;


--
-- Name: accept_commune_invite(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_commune_invite(p_token text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE v_invite public.commune_invites%ROWTYPE;v_actor text:=commune_private.data_api_user_id();v_email text;
BEGIN
  SELECT lower(email) INTO v_email FROM commune_private.accounts(ARRAY[v_actor]) WHERE "emailVerified" IS TRUE;
  IF v_email IS NULL OR p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invite unavailable for this verified account' USING ERRCODE='42501'; END IF;
  -- Use the same commune -> invitation order as invitation creation.
  PERFORM 1 FROM public.communes co JOIN public.commune_invites i ON i.commune_id=co.id WHERE i.token_hash=digest(p_token,'sha256') FOR UPDATE OF co;
  SELECT * INTO v_invite FROM public.commune_invites WHERE token_hash=digest(p_token,'sha256') FOR UPDATE;
  IF NOT FOUND OR v_invite.email<>v_email OR v_invite.expires_at<=now() OR v_invite.accepted_at IS NOT NULL OR v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invite unavailable for this verified account' USING ERRCODE='42501'; END IF;
  -- The sender must still be an active admin of this commune.
  IF NOT EXISTS(SELECT 1 FROM public.commune_members m WHERE m.commune_id=v_invite.commune_id AND m.user_id=v_invite.invited_by AND m.active AND m.role='admin') THEN
    RAISE EXCEPTION 'Invite unavailable for this verified account' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM public.commune_members WHERE commune_id=v_invite.commune_id AND user_id=v_actor AND active) THEN
    RAISE EXCEPTION 'Already a member of this commune' USING ERRCODE='P0001'; END IF;
  INSERT INTO public.commune_members(commune_id,user_id,role) VALUES(v_invite.commune_id,v_actor,v_invite.role)
    ON CONFLICT(commune_id,user_id) DO UPDATE SET role=excluded.role,active=true,left_at=NULL,joined_at=now();
  UPDATE public.commune_invites SET accepted_at=now(),accepted_by=v_actor WHERE id=v_invite.id;
  RETURN v_invite.commune_id;
END;
$_$;


--
-- Name: acknowledge_announcement(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.acknowledge_announcement(p_announcement_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_announcement public.commune_announcements%ROWTYPE;
  v_inserted integer;
BEGIN
  SELECT * INTO v_announcement FROM public.commune_announcements WHERE id = p_announcement_id;
  IF v_announcement.id IS NULL OR NOT public.is_commune_member(v_announcement.commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  IF NOT v_announcement.needs_acknowledgement THEN
    RAISE EXCEPTION 'This announcement does not ask for confirmation' USING ERRCODE = '22023';
  END IF;
  IF v_announcement.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This announcement has been taken down' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.announcement_acknowledgements (announcement_id, user_id)
    VALUES (p_announcement_id, v_actor) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN commune_private.announcement_result(p_announcement_id, v_inserted = 0);
END;
$$;


--
-- Name: archive_announcement(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.archive_announcement(p_announcement_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_announcement public.commune_announcements%ROWTYPE;
BEGIN
  SELECT * INTO v_announcement FROM public.commune_announcements WHERE id = p_announcement_id FOR UPDATE;
  IF v_announcement.id IS NULL OR NOT public.is_commune_member(v_announcement.commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  IF v_announcement.author_id <> v_actor AND NOT public.is_commune_admin(v_announcement.commune_id) THEN
    RAISE EXCEPTION 'Only the person who posted it or an admin can take it down' USING ERRCODE = '42501';
  END IF;
  IF v_announcement.archived_at IS NOT NULL THEN
    RETURN commune_private.announcement_result(p_announcement_id, true);
  END IF;
  UPDATE public.commune_announcements SET archived_at = now(), archived_by = v_actor WHERE id = p_announcement_id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_announcement.commune_id, v_actor, 'announcements', p_announcement_id, v_announcement.title, 'Taken down');
  RETURN commune_private.announcement_result(p_announcement_id, false);
END;
$$;


--
-- Name: commune_expense_page(uuid, date, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commune_expense_page(p_commune_id uuid, p_before date, p_months integer) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_window uuid[];
  v_before timestamptz;
  v_from timestamptz;
  v_newest timestamptz;
BEGIN
  IF NOT public.is_commune_member(p_commune_id) THEN RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501'; END IF;
  IF p_months IS NOT NULL AND p_months NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'Ask for 1 to 12 months of expenses at a time' USING ERRCODE = '22023';
  END IF;
  v_window := ARRAY(SELECT commune_private.snapshot_expense_ids(p_commune_id, commune_private.expense_window_start()));
  v_before := date_trunc('month', coalesce(p_before::timestamp, commune_private.expense_window_start() AT TIME ZONE 'UTC')) AT TIME ZONE 'UTC';
  SELECT max(e.created_at) INTO v_newest FROM public.expenses e
    WHERE e.commune_id = p_commune_id AND e.created_at < v_before AND NOT (e.id = ANY (v_window));
  v_from := CASE WHEN p_months IS NULL OR v_newest IS NULL THEN NULL
    ELSE least((date_trunc('month', v_before AT TIME ZONE 'UTC') - make_interval(months => p_months)) AT TIME ZONE 'UTC',
      date_trunc('month', v_newest AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') END;
  RETURN jsonb_build_object(
    'expenses', commune_private.expense_records(ARRAY(SELECT e.id FROM public.expenses e
      WHERE e.commune_id = p_commune_id AND e.created_at < v_before AND e.created_at >= coalesce(v_from, '-infinity')
        AND NOT (e.id = ANY (v_window)))),
    'before', to_char(v_before AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
    'from', to_char(v_from AT TIME ZONE 'UTC', 'YYYY-MM-DD'))
    || (SELECT jsonb_build_object('olderCount', count(*), 'olderVoidedCount', count(*) FILTER (WHERE e.voided_at IS NOT NULL))
      FROM public.expenses e
      WHERE e.commune_id = p_commune_id AND e.created_at < coalesce(v_from, '-infinity') AND NOT (e.id = ANY (v_window)));
END;
$$;


--
-- Name: commune_expense_records(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commune_expense_records(p_commune_id uuid, p_ids uuid[]) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_commune_member(p_commune_id) THEN RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501'; END IF;
  IF p_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Ask for 1 to 50 expenses at a time' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('expenses', commune_private.expense_records(ARRAY(SELECT e.id FROM public.expenses e
    WHERE e.commune_id = p_commune_id AND e.id = ANY (p_ids))));
END;
$$;


--
-- Name: commune_snapshot(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commune_snapshot(p_commune_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_actor text:=commune_private.data_api_user_id();v_result jsonb;
BEGIN
  IF NOT public.is_commune_member(p_commune_id) THEN RAISE EXCEPTION 'Not a commune member' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object(
    'commune',jsonb_build_object('id',co.id,'name',co.name,'kind',co.kind,'currency',co.currency,'address',co.address,'destination',co.destination,'stayName',co.stay_name,'stayAddress',co.stay_address,'role',m.role,
      'memberCount',(SELECT count(*) FROM public.commune_members cm WHERE cm.commune_id=co.id AND cm.active),
      'currencyLockedBy',to_jsonb(commune_private.currency_locked_by(co.id)),
      'unreadNotices',commune_private.unread_notice_count(co.id,v_actor)),
    'members',coalesce((SELECT jsonb_agg(jsonb_build_object('userId',mp.id,'name',mp.name,'email',mp.email,'role',mp.role,'active',mp.active)) FROM public.member_profiles_with_status(co.id) mp),'[]'::jsonb),
    'expenses',commune_private.snapshot_expenses(co.id),
    'expenseHistory',commune_private.expense_history(co.id),'changeMark',commune_private.change_mark(co.id),
    'funds',coalesce((SELECT jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'targetMinor',f.target_minor,'createdBy',f.created_by,'archivedAt',f.archived_at,
      'commitments',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'userId',c.user_id,'amountMinor',c.amount_minor,'dueOn',c.due_on,'cancelledAt',c.cancelled_at,
        'contributedMinor',(SELECT coalesce(sum(fc.amount_minor),0) FROM public.fund_contributions fc WHERE fc.commitment_id=c.id AND fc.voided_at IS NULL),
        'contributions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',fc.id,'amountMinor',fc.amount_minor,'contributedAt',fc.contributed_at,'voidedAt',fc.voided_at,'voidReason',fc.void_reason) ORDER BY fc.contributed_at DESC) FROM public.fund_contributions fc WHERE fc.commitment_id=c.id),'[]'::jsonb)) ORDER BY c.created_at) FROM public.fund_commitments c WHERE c.fund_id=f.id),'[]'::jsonb)) ORDER BY f.created_at DESC) FROM public.funds f WHERE f.commune_id=co.id),'[]'::jsonb),
    'notifications',commune_private.snapshot_notifications(co.id,v_actor),
    'reminderTargets',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',rt.kind,'sourceId',rt.source_id,'recipientUserId',rt.recipient_user_id,'amountMinor',rt.amount_minor,'currency',rt.currency,'label',rt.label,'dueOn',rt.due_on,'lastSentAt',rt.last_sent_at)) FROM public.list_reminder_targets(co.id) rt),'[]'::jsonb),
    'sentReminders',commune_private.snapshot_sent_reminders(co.id,v_actor),
    'notes',coalesce((SELECT jsonb_agg(jsonb_build_object('id',n.id,'title',n.title,'pill',n.pill,'kicker',n.kicker,'lede',n.lede,'body',n.body,'facts',n.facts,
      'version',n.version,'createdBy',n.created_by,'updatedBy',n.updated_by,'updatedAt',n.updated_at,
      'revisions',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'version',r.version,'title',r.title,'editedBy',r.edited_by,'editedAt',r.edited_at,
          'replacedBy',r.replaced_by,'replacedAt',r.replaced_at) ORDER BY r.version DESC)
        FROM (SELECT * FROM public.note_revisions x WHERE x.note_id=n.id ORDER BY x.version DESC LIMIT 10) r),'[]'::jsonb)) ORDER BY n.created_at DESC) FROM public.commune_notes n WHERE n.commune_id=co.id AND n.deleted_at IS NULL),'[]'::jsonb),
    'operations',commune_private.snapshot_operations(co.id),
    'announcements',commune_private.snapshot_announcements(co.id),
    'payLinks',commune_private.snapshot_pay_links(co.id),
    'recurringBills',coalesce((SELECT jsonb_agg(jsonb_build_object('id',b.id,'title',b.title,'amountMinor',b.amount_minor,'paidByUserId',b.paid_by_user_id,'allocations',(SELECT jsonb_agg(jsonb_build_object('userId',s->>'user_id','amountMinor',(s->>'amount_minor')::bigint)) FROM jsonb_array_elements(b.shares) s),'frequency',b.frequency,'nextDueOn',b.next_due_on,'paused',b.paused,'createdBy',b.created_by,'version',b.version,'archivedAt',b.archived_at,
      'history',coalesce((SELECT jsonb_agg(jsonb_build_object('dueOn',h.due_on,'status',h.status,'amountMinor',h.amount_minor,'expenseId',h.expense_id,
        'actorId',h.actor_id,'actedAt',h.acted_at,'note',h.note) ORDER BY h.due_on DESC)
        FROM (SELECT * FROM public.recurring_bill_occurrences x WHERE x.bill_id=b.id ORDER BY x.due_on DESC LIMIT 12) h),'[]'::jsonb)) ORDER BY b.next_due_on) FROM public.recurring_bills b WHERE b.commune_id=co.id),'[]'::jsonb),
    'splitTemplates',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'method',t.method,'participants',(SELECT jsonb_agg(jsonb_build_object('userId',p->>'user_id','value',coalesce(p->>'value',''))) FROM jsonb_array_elements(t.participants) p),'createdBy',t.created_by,'archivedAt',t.archived_at) ORDER BY t.created_at DESC) FROM public.split_templates t WHERE t.commune_id=co.id),'[]'::jsonb),
    'activityEvents',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'actorId',a.actor_id,'kind',a.kind,'entityId',a.entity_id,'title',a.title,'description',a.description,'createdAt',a.created_at,'recordType',commune_private.activity_record_type(a.id)) ORDER BY a.created_at DESC) FROM ((SELECT ev.id, ev.actor_id, ev.kind, ev.entity_id, ev.title, ev.description, ev.created_at
        FROM public.commune_events ev WHERE ev.commune_id=co.id ORDER BY ev.created_at DESC LIMIT 100)
      UNION (SELECT ev.id, ev.actor_id, ev.kind, ev.entity_id, ev.title, ev.description, ev.created_at
        FROM public.commune_events ev WHERE ev.commune_id=co.id
          AND commune_private.money_correction_reserve(ev.kind, ev.description, ev.details) = 'correction'
          AND ev.created_at > now() - interval '90 days' ORDER BY ev.created_at DESC LIMIT 50)
      UNION (SELECT ev.id, ev.actor_id, ev.kind, ev.entity_id, ev.title, ev.description, ev.created_at
        FROM public.commune_events ev WHERE ev.commune_id=co.id
          AND commune_private.money_correction_reserve(ev.kind, ev.description, ev.details) = 'reversal'
          AND ev.created_at > now() - interval '90 days' ORDER BY ev.created_at DESC LIMIT 50)) a),'[]'::jsonb)
  ) INTO v_result FROM public.communes co JOIN public.commune_members m ON m.commune_id=co.id AND m.user_id=v_actor AND m.active WHERE co.id=p_commune_id;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Commune not found' USING ERRCODE='42501'; END IF;
  RETURN v_result;
END;
$$;


--
-- Name: commune_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.commune_summary(p_commune_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_full jsonb := public.commune_snapshot(p_commune_id);
BEGIN
  RETURN v_full || jsonb_build_object('detail', 'summary',
    'expenses', (SELECT coalesce(jsonb_agg(x.item || jsonb_build_object('revisions', '[]'::jsonb,
        'shares', (SELECT coalesce(jsonb_agg(y.item || jsonb_build_object('receipts', '[]'::jsonb, 'paymentReports',
            coalesce((SELECT jsonb_agg(r.report ORDER BY r.ord) FROM jsonb_array_elements(y.item -> 'paymentReports') WITH ORDINALITY r(report, ord)
              WHERE r.report ->> 'status' = 'pending'), '[]'::jsonb)) ORDER BY y.ord), '[]'::jsonb)
          FROM jsonb_array_elements(x.item -> 'shares') WITH ORDINALITY y(item, ord))) ORDER BY x.ord), '[]'::jsonb)
      FROM jsonb_array_elements(v_full -> 'expenses') WITH ORDINALITY x(item, ord)),
    'notes', (SELECT coalesce(jsonb_agg(x.item || '{"body": "", "revisions": []}'::jsonb ORDER BY x.ord), '[]'::jsonb)
      FROM jsonb_array_elements(v_full -> 'notes') WITH ORDINALITY x(item, ord)),
    'operations', (SELECT coalesce(jsonb_agg(x.item || '{"history": []}'::jsonb ORDER BY x.ord), '[]'::jsonb)
      FROM jsonb_array_elements(v_full -> 'operations') WITH ORDINALITY x(item, ord)),
    'recurringBills', (SELECT coalesce(jsonb_agg(x.item || '{"history": []}'::jsonb ORDER BY x.ord), '[]'::jsonb)
      FROM jsonb_array_elements(v_full -> 'recurringBills') WITH ORDINALITY x(item, ord)),
    'announcements', '[]'::jsonb, 'splitTemplates', '[]'::jsonb, 'sentReminders', '[]'::jsonb,
    'notifications', '[]'::jsonb);
END;
$$;


--
-- Name: confirm_expense_share(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirm_expense_share(p_share_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_actor text := commune_private.data_api_user_id(); v_outstanding bigint; v_payer text; v_debtor text; v_commune uuid;
BEGIN
  PERFORM 1 FROM public.communes co JOIN public.expenses e ON e.commune_id = co.id
    JOIN public.expense_shares s ON s.expense_id = e.id WHERE s.id = p_share_id FOR UPDATE OF co;
  SELECT s.amount_minor - s.settled_minor, e.paid_by_user_id, s.user_id, e.commune_id
    INTO v_outstanding, v_payer, v_debtor, v_commune
    FROM public.expense_shares s JOIN public.expenses e ON e.id = s.expense_id WHERE s.id = p_share_id FOR UPDATE OF s;
  IF v_payer IS NULL OR NOT public.is_commune_member(v_commune)
     OR v_actor IS DISTINCT FROM v_payer OR v_debtor = v_payer THEN
    RAISE EXCEPTION 'Only the bill payer can confirm an outstanding share' USING ERRCODE = '42501';
  END IF;
  IF v_outstanding <= 0 THEN RETURN; END IF;
  PERFORM public.record_share_receipt(p_share_id, v_outstanding, current_date, NULL, gen_random_uuid());
END;
$$;


--
-- Name: correct_expense(uuid, integer, text, bigint, jsonb, date, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.correct_expense(p_expense_id uuid, p_expected_version integer, p_title text, p_amount_minor bigint, p_shares jsonb, p_due_on date, p_paid_by text, p_category text, p_reason text, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_expense public.expenses%ROWTYPE;
  v_replay public.expense_revisions%ROWTYPE;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_title text := btrim(coalesce(p_title, ''));
  v_category text := btrim(coalesce(p_category, ''));
  v_payer text;
  v_before jsonb; v_after jsonb; v_new_shares jsonb;
  v_financial boolean; v_admin boolean; v_blocked text; v_member record;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to correct an expense' USING ERRCODE = '22023';
  END IF;
  -- Commune, then expense, then shares: the order every money write uses.
  PERFORM 1 FROM public.communes co JOIN public.expenses e ON e.commune_id = co.id
    WHERE e.id = p_expense_id FOR UPDATE OF co;
  SELECT * INTO v_expense FROM public.expenses WHERE id = p_expense_id FOR UPDATE;
  v_admin := v_expense.id IS NOT NULL AND public.is_commune_admin(v_expense.commune_id);
  IF v_expense.id IS NULL OR NOT public.is_commune_member(v_expense.commune_id)
     OR (v_actor IS DISTINCT FROM v_expense.paid_by_user_id AND NOT v_admin) THEN
    RAISE EXCEPTION 'Only the bill payer or an admin can correct this expense' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_shares) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid expense amount or split' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('userId', s.user_id, 'amountMinor', s.amount_minor) ORDER BY s.user_id), '[]'::jsonb)
    INTO v_new_shares FROM jsonb_to_recordset(p_shares) AS s(user_id text, amount_minor bigint);
  SELECT * INTO v_replay FROM public.expense_revisions WHERE actor_id = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    -- A replay must be the same decision: same expense, reason and outcome.
    IF v_replay.expense_id <> p_expense_id OR v_replay.action <> 'corrected' OR v_replay.reason <> v_reason
       OR v_replay.after IS DISTINCT FROM jsonb_build_object('title', v_title, 'amountMinor', p_amount_minor,
         'paidByUserId', coalesce(p_paid_by, v_replay.after ->> 'paidByUserId'), 'category', v_category,
         'dueOn', p_due_on, 'shares', v_new_shares) THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('version', v_replay.version, 'duplicate', true);
  END IF;
  IF v_expense.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'This expense was voided and can no longer be changed' USING ERRCODE = 'P0001';
  END IF;
  IF p_expected_version IS DISTINCT FROM v_expense.version THEN
    RAISE EXCEPTION 'This expense was changed by someone else. Review the latest version before saving your correction.' USING ERRCODE = 'P0001';
  END IF;
  IF length(v_reason) NOT BETWEEN 3 AND 240 THEN
    RAISE EXCEPTION 'Give a reason for the correction (3 to 240 characters)' USING ERRCODE = '22023';
  END IF;
  IF length(v_title) NOT BETWEEN 1 AND 80 OR length(v_category) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Invalid expense details' USING ERRCODE = '22023';
  END IF;
  v_payer := coalesce(p_paid_by, v_expense.paid_by_user_id);
  v_before := commune_private.expense_state(p_expense_id);
  v_financial := p_amount_minor IS DISTINCT FROM v_expense.amount_minor
    OR v_payer <> v_expense.paid_by_user_id OR v_new_shares <> (v_before -> 'shares');
  IF NOT v_financial AND v_title = v_expense.title AND v_category = v_expense.category
     AND p_due_on IS NOT DISTINCT FROM v_expense.due_on THEN
    RAISE EXCEPTION 'Nothing has changed, so there is nothing to correct' USING ERRCODE = '22023';
  END IF;

  IF v_financial THEN
    IF v_payer <> v_expense.paid_by_user_id AND NOT v_admin THEN
      RAISE EXCEPTION 'Only an admin can change who paid' USING ERRCODE = '42501';
    END IF;
    -- Never move or silently absorb recorded money.
    IF EXISTS (SELECT 1 FROM public.expense_share_receipts r JOIN public.expense_shares s ON s.id = r.share_id
      WHERE s.expense_id = p_expense_id AND r.reversed_at IS NULL) THEN
      RAISE EXCEPTION 'Repayments are recorded on this expense. Reverse them before changing the amount, payer or split.' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.commune_members WHERE commune_id = v_expense.commune_id AND user_id = v_payer AND active) THEN
      RAISE EXCEPTION 'Invalid payer or expense details' USING ERRCODE = '22023';
    END IF;
    PERFORM commune_private.validate_expense_split(v_expense.commune_id, p_amount_minor, p_shares);
    -- A reversed repayment is still history that belongs to that person.
    SELECT coalesce(u.name, 'A former member') INTO v_blocked FROM public.expense_shares s
      LEFT JOIN commune_private.accounts(ARRAY(SELECT x.user_id FROM public.expense_shares x WHERE x.expense_id = p_expense_id)) u ON u.id = s.user_id
      WHERE s.expense_id = p_expense_id
        AND EXISTS (SELECT 1 FROM public.expense_share_receipts r WHERE r.share_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(p_shares) AS n(user_id text, amount_minor bigint) WHERE n.user_id = s.user_id)
      LIMIT 1;
    IF v_blocked IS NOT NULL THEN
      RAISE EXCEPTION '% has repayment history on this expense and must stay in the split. Void the expense and record it again instead.', v_blocked USING ERRCODE = 'P0001';
    END IF;
    DELETE FROM public.expense_shares s WHERE s.expense_id = p_expense_id
      AND NOT EXISTS (SELECT 1 FROM jsonb_to_recordset(p_shares) AS n(user_id text, amount_minor bigint) WHERE n.user_id = s.user_id);
    -- With no active repayments, only the payer's own share is settled.
    INSERT INTO public.expense_shares (expense_id, user_id, amount_minor, settled_minor, settled_at)
      SELECT p_expense_id, n.user_id, n.amount_minor,
        CASE WHEN n.user_id = v_payer THEN n.amount_minor ELSE 0 END,
        CASE WHEN n.user_id = v_payer THEN now() ELSE NULL END
      FROM jsonb_to_recordset(p_shares) AS n(user_id text, amount_minor bigint)
    ON CONFLICT (expense_id, user_id) DO UPDATE SET amount_minor = excluded.amount_minor,
      settled_minor = excluded.settled_minor, settled_at = excluded.settled_at;
  END IF;

  UPDATE public.expenses SET title = v_title, category = v_category, due_on = p_due_on,
      amount_minor = CASE WHEN v_financial THEN p_amount_minor ELSE amount_minor END,
      paid_by_user_id = v_payer, version = version + 1, updated_at = now()
    WHERE id = p_expense_id;
  v_after := commune_private.expense_state(p_expense_id);
  INSERT INTO public.expense_revisions (expense_id, version, action, actor_id, reason, before, after, request_id)
    VALUES (p_expense_id, v_expense.version + 1, 'corrected', v_actor, v_reason, v_before, v_after, p_request_id);
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description, details)
    VALUES (v_expense.commune_id, v_actor, 'expenses', p_expense_id, v_title, 'Expense corrected',
      jsonb_build_object('version', v_expense.version + 1, 'reason', v_reason, 'before', v_before, 'after', v_after));

  IF v_financial THEN
    -- Tell everyone whose own figure moved: a changed, added or removed share,
    -- or a change of who they owe.
    FOR v_member IN
      SELECT coalesce(b.user_id, a.user_id) AS user_id, a.amount_minor
      FROM (SELECT x->>'userId' AS user_id, (x->>'amountMinor')::bigint AS amount_minor FROM jsonb_array_elements(v_before->'shares') x) b
      FULL JOIN (SELECT x->>'userId' AS user_id, (x->>'amountMinor')::bigint AS amount_minor FROM jsonb_array_elements(v_after->'shares') x) a
        ON a.user_id = b.user_id
      WHERE a.amount_minor IS DISTINCT FROM b.amount_minor OR v_payer <> v_expense.paid_by_user_id
      UNION
      SELECT p.user_id, NULL::bigint FROM (VALUES (v_payer), (v_expense.paid_by_user_id)) AS p(user_id)
        WHERE v_payer <> v_expense.paid_by_user_id
          AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_after->'shares') x WHERE x->>'userId' = p.user_id)
          AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_before->'shares') x WHERE x->>'userId' = p.user_id)
    LOOP
      PERFORM commune_private.notify_ledger(v_expense.commune_id, v_member.user_id, 'expense_corrected',
        p_expense_id, v_actor, v_member.amount_minor, v_reason);
    END LOOP;
  END IF;
  RETURN jsonb_build_object('version', v_expense.version + 1, 'duplicate', false);
END;
$$;


--
-- Name: create_commune(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_commune(p_name text, p_kind text, p_currency text DEFAULT 'GBP'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_user text := commune_private.data_api_user_id();
  v_id uuid;
BEGIN
  IF v_user IS NULL OR v_user = '' THEN
    RAISE EXCEPTION 'Sign in to create a commune' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_name, ''))) NOT BETWEEN 1 AND 80
     OR p_kind NOT IN ('household', 'workspace', 'trip')
     OR p_currency NOT IN ('GBP', 'USD', 'EUR') THEN
    RAISE EXCEPTION 'Invalid commune details' USING ERRCODE = '22023';
  END IF;
  IF commune_private.looks_like_contact(p_name) THEN
    RAISE EXCEPTION 'Commune names can''t include links, email addresses or phone numbers.'
      USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('commune-create:' || v_user, 0));
  IF (SELECT count(*) FROM public.communes WHERE created_by = v_user AND created_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'You have created 10 communes in the last hour. Try again later.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.communes WHERE created_by = v_user AND created_at > now() - interval '1 day') >= 30 THEN
    RAISE EXCEPTION 'You have created 30 communes in the last day. Try again tomorrow.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.communes WHERE created_by = v_user) >= 100 THEN
    RAISE EXCEPTION 'You have created 100 communes, which is the most one account can create.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.communes (name, kind, currency, created_by)
    VALUES (btrim(p_name), p_kind, p_currency, v_user)
    RETURNING id INTO v_id;
  INSERT INTO public.commune_members (commune_id, user_id, role)
    VALUES (v_id, v_user, 'admin');
  RETURN v_id;
END;
$$;


--
-- Name: create_commune_invite(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_commune_invite(p_commune_id uuid, p_email text, p_role text DEFAULT 'member'::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE v_email text:=lower(btrim(coalesce(p_email,'')));v_token text;
BEGIN
  PERFORM 1 FROM public.communes WHERE id=p_commune_id FOR UPDATE;
  IF NOT public.is_commune_admin(p_commune_id) THEN RAISE EXCEPTION 'Only an admin can invite members' USING ERRCODE='42501'; END IF;
  IF length(v_email)>254 OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' OR p_role IS NULL OR p_role NOT IN ('admin','member') THEN
    RAISE EXCEPTION 'Invalid invite details' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.commune_members m JOIN commune_private.accounts(ARRAY(SELECT x.user_id FROM public.commune_members x WHERE x.commune_id=p_commune_id AND x.active)) u ON u.id=m.user_id WHERE m.commune_id=p_commune_id AND m.active AND lower(u.email)=v_email) THEN
    RAISE EXCEPTION 'This person is already a member' USING ERRCODE='P0001'; END IF;
  UPDATE public.commune_invites SET revoked_at=now() WHERE commune_id=p_commune_id AND email=v_email AND accepted_at IS NULL AND revoked_at IS NULL;
  v_token:=encode(gen_random_bytes(32),'hex');
  INSERT INTO public.commune_invites(commune_id,email,role,token_hash,invited_by) VALUES(p_commune_id,v_email,p_role,digest(v_token,'sha256'),commune_private.data_api_user_id());
  RETURN v_token;
END;
$_$;


--
-- Name: create_commune_with_location(text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_commune_with_location(p_name text, p_kind text, p_currency text, p_address text, p_destination text, p_stay_name text, p_stay_address text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_commune_id uuid;
BEGIN
  v_commune_id := public.create_commune(p_name, p_kind, p_currency);
  PERFORM public.update_commune_location(
    v_commune_id, p_address, p_destination, p_stay_name, p_stay_address
  );
  RETURN v_commune_id;
END;
$$;


--
-- Name: create_expense(uuid, text, bigint, jsonb, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_expense(p_commune_id uuid, p_title text, p_amount_minor bigint, p_shares jsonb, p_due_on date DEFAULT NULL::date) RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT public.create_expense_for(p_commune_id, p_title, p_amount_minor, p_shares, p_due_on);
$$;


--
-- Name: create_expense_command(uuid, text, bigint, jsonb, date, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_expense_command(p_commune_id uuid, p_title text, p_amount_minor bigint, p_shares jsonb, p_due_on date, p_paid_by text, p_category text, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_existing public.expenses%ROWTYPE;
  v_request jsonb;
  v_id uuid;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to record an expense' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'commune-expense-request:' || v_actor || ':' || p_request_id::text, 0));
  IF NOT public.is_commune_member(p_commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_existing FROM public.expenses WHERE recorded_by = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.commune_id <> p_commune_id OR v_existing.voided_at IS NOT NULL
       OR jsonb_typeof(p_shares) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    v_request := jsonb_build_object('title', btrim(coalesce(p_title, '')), 'amountMinor', p_amount_minor,
      'paidByUserId', coalesce(p_paid_by, v_actor), 'category', btrim(coalesce(p_category, 'Other')), 'dueOn', p_due_on,
      'shares', (SELECT coalesce(jsonb_agg(jsonb_build_object('userId', s.user_id, 'amountMinor', s.amount_minor) ORDER BY s.user_id), '[]'::jsonb)
        FROM jsonb_to_recordset(p_shares) AS s(user_id text, amount_minor bigint)));
    IF commune_private.expense_state(v_existing.id) IS DISTINCT FROM v_request THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'duplicate', true);
  END IF;
  v_id := public.create_expense_for(p_commune_id, p_title, p_amount_minor, p_shares, p_due_on,
    p_paid_by, coalesce(p_category, 'Other'));
  UPDATE public.expenses SET request_id = p_request_id WHERE id = v_id;
  RETURN jsonb_build_object('id', v_id, 'duplicate', false);
END;
$$;


--
-- Name: create_expense_for(uuid, text, bigint, jsonb, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_expense_for(p_commune_id uuid, p_title text, p_amount_minor bigint, p_shares jsonb, p_due_on date DEFAULT NULL::date, p_paid_by text DEFAULT NULL::text, p_category text DEFAULT 'Other'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_actor text := commune_private.data_api_user_id(); v_payer text := coalesce(p_paid_by, v_actor); v_id uuid;
BEGIN
  -- The commune lock serializes membership changes and split validation.
  PERFORM 1 FROM public.communes WHERE id = p_commune_id FOR UPDATE;
  IF NOT public.is_commune_member(p_commune_id) OR
    (v_payer <> v_actor AND NOT public.is_commune_admin(p_commune_id)) THEN
    RAISE EXCEPTION 'Only an admin can record an expense paid by another member' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.commune_members WHERE commune_id = p_commune_id AND user_id = v_payer AND active)
    OR length(btrim(coalesce(p_title, ''))) NOT BETWEEN 1 AND 80
    OR length(btrim(coalesce(p_category, ''))) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Invalid payer or expense details' USING ERRCODE = '22023';
  END IF;
  PERFORM commune_private.validate_expense_split(p_commune_id, p_amount_minor, p_shares);
  INSERT INTO public.expenses (commune_id, title, amount_minor, paid_by_user_id, recorded_by, category, due_on)
    VALUES (p_commune_id, btrim(p_title), p_amount_minor, v_payer, v_actor, btrim(p_category), p_due_on) RETURNING id INTO v_id;
  INSERT INTO public.expense_shares (expense_id, user_id, amount_minor, settled_minor, settled_at)
    SELECT v_id, s.user_id, s.amount_minor, CASE WHEN s.user_id = v_payer THEN s.amount_minor ELSE 0 END,
      CASE WHEN s.user_id = v_payer THEN now() ELSE NULL END
    FROM jsonb_to_recordset(p_shares) AS s(user_id text, amount_minor bigint);
  RETURN v_id;
END;
$$;


--
-- Name: create_fund(uuid, text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_fund(p_commune_id uuid, p_name text, p_target_minor bigint DEFAULT NULL::bigint) RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT (public.create_fund_command(p_commune_id, p_name, p_target_minor, gen_random_uuid()) ->> 'id')::uuid;
$$;


--
-- Name: create_fund_command(uuid, text, bigint, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_fund_command(p_commune_id uuid, p_name text, p_target_minor bigint, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_existing public.funds%ROWTYPE;
  v_id uuid;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to create a fund' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'commune-fund-request:' || v_actor || ':' || p_request_id::text, 0));
  IF NOT public.is_commune_admin(p_commune_id) THEN
    RAISE EXCEPTION 'Only a commune admin can create a fund' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_existing FROM public.funds WHERE created_by = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.commune_id <> p_commune_id OR v_existing.archived_at IS NOT NULL
       OR v_existing.name IS DISTINCT FROM btrim(coalesce(p_name, ''))
       OR v_existing.target_minor IS DISTINCT FROM p_target_minor THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'duplicate', true);
  END IF;
  IF length(btrim(coalesce(p_name, ''))) NOT BETWEEN 1 AND 120
     OR (p_target_minor IS NOT NULL AND p_target_minor <= 0) THEN
    RAISE EXCEPTION 'Invalid fund details' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.funds (commune_id, name, target_minor, created_by, request_id)
    VALUES (p_commune_id, btrim(p_name), p_target_minor, v_actor, p_request_id)
    RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'duplicate', false);
END;
$$;


--
-- Name: create_note(uuid, text, text, text, text, text, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_note(p_commune_id uuid, p_title text, p_pill text, p_kicker text, p_lede text, p_body text, p_facts jsonb, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_card jsonb;
  v_new public.commune_notes%ROWTYPE;
  v_existing public.commune_notes%ROWTYPE;
  v_id uuid;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to add a note' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_commune_member(p_commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  v_card := commune_private.note_content(p_title, p_pill, p_kicker, p_lede, p_body, p_facts);
  -- Serialise adds in one commune so the limit holds and a retry finds its note.
  PERFORM 1 FROM public.communes WHERE id = p_commune_id FOR UPDATE;
  SELECT * INTO v_existing FROM public.commune_notes WHERE created_by = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.commune_id <> p_commune_id OR v_existing.request_digest IS DISTINCT FROM md5(v_card::text) THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    -- A late retry must not hand back a note that has since been removed.
    IF v_existing.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'This note has been removed' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'version', v_existing.version, 'duplicate', true);
  END IF;
  IF (SELECT count(*) FROM public.commune_notes WHERE commune_id = p_commune_id AND deleted_at IS NULL) >= 500 THEN
    RAISE EXCEPTION 'This commune already has 500 notes. Remove one you no longer need first.' USING ERRCODE = 'P0001';
  END IF;
  v_new := jsonb_populate_record(NULL::public.commune_notes, v_card);
  INSERT INTO public.commune_notes (commune_id, title, pill, kicker, lede, body, facts, created_by, request_id, request_digest)
    VALUES (p_commune_id, v_new.title, v_new.pill, v_new.kicker, v_new.lede, v_new.body, v_new.facts, v_actor,
      p_request_id, md5(v_card::text))
    RETURNING id INTO v_id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (p_commune_id, v_actor, 'notes', v_id, v_new.title, 'Created');
  RETURN jsonb_build_object('id', v_id, 'version', 1, 'duplicate', false);
END;
$$;


--
-- Name: create_operation(uuid, text, text, text, date, time without time zone, boolean, text, jsonb, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_operation(p_commune_id uuid, p_kind text, p_category text, p_title text, p_date date, p_time time without time zone, p_all_day boolean, p_assignee_id text, p_rotation_ids jsonb, p_repeat text, p_notes text, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_item jsonb;
  v_new public.commune_operations%ROWTYPE;
  v_existing public.commune_operations%ROWTYPE;
  v_id uuid;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to add a task or event' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_commune_member(p_commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  v_item := commune_private.operation_content(p_kind, p_category, p_title, p_date, p_time, p_all_day,
    p_assignee_id, p_rotation_ids, p_repeat, p_notes);
  PERFORM 1 FROM public.communes WHERE id = p_commune_id FOR UPDATE;
  SELECT * INTO v_existing FROM public.commune_operations WHERE created_by = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.commune_id <> p_commune_id OR v_existing.request_digest IS DISTINCT FROM md5(v_item::text) THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    -- A late retry must not hand back a task or event that has since been removed.
    IF v_existing.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'This % has been removed', v_existing.kind USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'version', v_existing.version, 'duplicate', true);
  END IF;
  IF (SELECT count(*) FROM public.commune_operations WHERE commune_id = p_commune_id AND deleted_at IS NULL) >= 1000 THEN
    RAISE EXCEPTION 'This commune already has 1,000 tasks and events. Remove some you no longer need first.'
      USING ERRCODE = 'P0001';
  END IF;
  v_new := jsonb_populate_record(NULL::public.commune_operations, v_item);
  INSERT INTO public.commune_operations (commune_id, kind, category, title, date, time, all_day,
      assignee_id, rotation_ids, repeat, notes, created_by, request_id, request_digest)
    VALUES (p_commune_id, v_new.kind, v_new.category, v_new.title, v_new.date, v_new.time, v_new.all_day,
      v_new.assignee_id, v_new.rotation_ids, v_new.repeat, v_new.notes, v_actor, p_request_id, md5(v_item::text))
    RETURNING id INTO v_id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (p_commune_id, v_actor, 'operations', v_id, v_new.title, 'Created');
  RETURN jsonb_build_object('id', v_id, 'version', 1, 'duplicate', false);
END;
$$;


--
-- Name: hand_over_operation(uuid, text, date, text, date, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hand_over_operation(p_operation_id uuid, p_to_member_id text, p_expected_date date, p_expected_assignee_id text, p_today date, p_reason text, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_commune_id uuid;
  v_op public.commune_operations%ROWTYPE;
  v_replay public.operation_occurrences%ROWTYPE;
  v_turn_owner_id text; v_to_name text; v_id uuid; v_description text;
  v_reason text := commune_private.occurrence_reason(p_reason);
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to hand over a task' USING ERRCODE = '22023';
  END IF;
  -- The commune first, then the task, as in update_operation.
  SELECT commune_id INTO v_commune_id FROM public.commune_operations WHERE id = p_operation_id;
  PERFORM 1 FROM public.communes WHERE id = v_commune_id FOR UPDATE;
  SELECT * INTO v_op FROM public.commune_operations WHERE id = p_operation_id FOR UPDATE;
  IF v_op.id IS NULL OR NOT public.is_commune_member(v_op.commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_replay FROM public.operation_occurrences WHERE actor_id = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_replay.operation_id <> p_operation_id OR v_replay.action <> 'handed_over'
       OR v_replay.next_assignee_id IS DISTINCT FROM p_to_member_id THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    RETURN commune_private.occurrence_result(v_replay.id, true, p_operation_id);
  END IF;
  IF v_op.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This task has been removed' USING ERRCODE = 'P0001';
  END IF;
  IF p_today IS NULL OR p_today NOT BETWEEN current_date - 1 AND current_date + 1 THEN
    RAISE EXCEPTION 'Check the date on this device and try again' USING ERRCODE = '22023';
  END IF;
  IF v_op.kind <> 'task' THEN
    RAISE EXCEPTION 'Only tasks can be handed over' USING ERRCODE = '22023';
  END IF;
  IF p_to_member_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.commune_members m
      WHERE m.commune_id = v_op.commune_id AND m.user_id = p_to_member_id AND m.active) THEN
    RAISE EXCEPTION 'Choose a current member of this commune' USING ERRCODE = '22023';
  END IF;
  IF p_expected_date IS DISTINCT FROM v_op.date OR p_expected_assignee_id IS DISTINCT FROM v_op.assignee_id THEN
    RAISE EXCEPTION 'This task has already moved on. Refresh to see who has it now.' USING ERRCODE = 'P0001';
  END IF;
  IF v_op.status <> 'open' THEN
    RAISE EXCEPTION 'This task is already done' USING ERRCODE = 'P0001';
  END IF;
  IF p_to_member_id = v_op.assignee_id THEN
    RAISE EXCEPTION 'They already have this task' USING ERRCODE = '22023';
  END IF;

  -- On a task that takes turns, remember whose turn it is. Handing it back
  -- to that person ends the cover.
  IF v_op.rotation_ids IS NOT NULL AND v_op.repeat <> 'none' THEN
    v_turn_owner_id := coalesce(v_op.turn_owner_id, v_op.assignee_id);
    IF v_turn_owner_id = p_to_member_id THEN v_turn_owner_id := NULL; END IF;
  END IF;
  v_to_name := commune_private.member_name(p_to_member_id);
  v_description := CASE
    WHEN v_op.turn_owner_id = p_to_member_id THEN 'Handed back to ' || v_to_name
    WHEN v_turn_owner_id IS NOT NULL THEN 'Handed to ' || v_to_name || ', covering for ' || commune_private.member_name(v_turn_owner_id)
    ELSE 'Handed to ' || v_to_name END || coalesce(': ' || v_reason, '');

  PERFORM set_config('commune.occurrence_event', 'on', true);
  UPDATE public.commune_operations SET assignee_id = p_to_member_id, assignee = v_to_name,
    turn_owner_id = v_turn_owner_id, updated_at = now() WHERE id = p_operation_id;
  PERFORM set_config('commune.occurrence_event', 'off', true);
  INSERT INTO public.operation_occurrences (operation_id, commune_id, action, due_on, assignee, actor_id, acted_on, acted_at, request_id,
      prev_date, prev_assignee, prev_status, prev_last_done, next_date, next_assignee, next_status, next_last_done,
      assignee_id, prev_assignee_id, next_assignee_id, reason, prev_turn_owner_id, next_turn_owner_id)
    VALUES (p_operation_id, v_op.commune_id, 'handed_over', v_op.date, v_op.assignee, v_actor, p_today, clock_timestamp(), p_request_id,
      v_op.date, v_op.assignee, v_op.status, v_op.last_done, v_op.date, v_to_name, v_op.status, v_op.last_done,
      v_op.assignee_id, v_op.assignee_id, p_to_member_id, v_reason, v_op.turn_owner_id, v_turn_owner_id)
    RETURNING id INTO v_id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_op.commune_id, v_actor, 'operations', p_operation_id, v_op.title, left(v_description, 240));
  RETURN commune_private.occurrence_result(v_id, false, p_operation_id);
END;
$$;


--
-- Name: invite_address_hint(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invite_address_hint(p_token text) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE v_account text; v_invited text;
BEGIN
  SELECT lower(u.email) INTO v_account
  FROM commune_private.accounts(ARRAY[commune_private.data_api_user_id()]) u;
  IF v_account IS NULL OR p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN NULL;
  END IF;
  SELECT lower(i.email) INTO v_invited
  FROM public.commune_invites i
  WHERE i.token_hash = digest(p_token, 'sha256')
    AND i.expires_at > now() AND i.accepted_at IS NULL AND i.revoked_at IS NULL
    AND EXISTS (SELECT 1 FROM public.commune_members m WHERE m.commune_id = i.commune_id
      AND m.user_id = i.invited_by AND m.active AND m.role = 'admin');
  IF v_invited IS NULL OR v_invited = v_account THEN
    RETURN NULL;
  END IF;
  RETURN commune_private.masked_address(v_invited);
END;
$_$;


--
-- Name: is_commune_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_commune_admin(p_commune_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.commune_members m WHERE m.commune_id = p_commune_id
    AND m.user_id = commune_private.data_api_user_id() AND m.active AND m.role = 'admin');
$$;


--
-- Name: is_commune_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_commune_member(p_commune_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.commune_members m WHERE m.commune_id = p_commune_id
    AND m.user_id = commune_private.data_api_user_id() AND m.active);
$$;


--
-- Name: list_commune_invites(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_commune_invites(p_commune_id uuid) RETURNS TABLE(id uuid, email text, role text, created_at timestamp with time zone, expires_at timestamp with time zone, accepted_at timestamp with time zone, revoked_at timestamp with time zone, invited_by text, invited_by_name text, accepted_by text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_commune_admin(p_commune_id) THEN
    RAISE EXCEPTION 'Only a commune admin can view invites'
      USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT i.id, CASE WHEN i.accepted_by IS NULL OR EXISTS (SELECT 1 FROM public.commune_members m
      WHERE m.commune_id = i.commune_id AND m.user_id = i.accepted_by AND m.active) THEN i.email END, i.role, i.created_at, i.expires_at,
    i.accepted_at, i.revoked_at, i.invited_by, u.name, i.accepted_by
  FROM public.commune_invites i
  LEFT JOIN commune_private.accounts(ARRAY(SELECT DISTINCT x.invited_by FROM public.commune_invites x WHERE x.commune_id = p_commune_id)) u ON u.id = i.invited_by
  WHERE i.commune_id = p_commune_id
  ORDER BY i.created_at DESC;
END;
$$;


--
-- Name: list_reminder_targets(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.list_reminder_targets(p_commune_id uuid) RETURNS TABLE(kind text, source_id uuid, recipient_user_id text, amount_minor bigint, currency text, label text, due_on date, last_sent_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_commune_member(p_commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT 'nudge'::text, s.id, s.user_id,
    (s.amount_minor - s.settled_minor)::bigint,
    co.currency, e.title, e.due_on,
    (SELECT max(r.created_at) FROM public.reminders r
      WHERE r.kind = 'nudge' AND r.source_id = s.id
        AND r.recipient_user_id = s.user_id)
  FROM public.expense_shares s
  JOIN public.expenses e ON e.id = s.expense_id
  JOIN public.communes co ON co.id = e.commune_id
  JOIN public.commune_members m
    ON m.commune_id = co.id AND m.user_id = s.user_id
  WHERE e.commune_id = p_commune_id
    AND e.paid_by_user_id = commune_private.data_api_user_id()
    AND s.user_id <> commune_private.data_api_user_id()
    AND e.voided_at IS NULL AND m.active AND s.settled_minor < s.amount_minor
    AND e.due_on <= current_date
  UNION ALL
  SELECT 'chase'::text, c.id, c.user_id,
    (c.amount_minor - coalesce(paid.total, 0))::bigint,
    co.currency, f.name, c.due_on,
    (SELECT max(r.created_at) FROM public.reminders r
      WHERE r.kind = 'chase' AND r.source_id = c.id
        AND r.recipient_user_id = c.user_id)
  FROM public.fund_commitments c
  JOIN public.funds f ON f.id = c.fund_id
  JOIN public.communes co ON co.id = f.commune_id
  JOIN public.commune_members m
    ON m.commune_id = co.id AND m.user_id = c.user_id
  LEFT JOIN LATERAL (
    SELECT sum(fc.amount_minor) AS total
    FROM public.fund_contributions fc WHERE fc.commitment_id = c.id AND fc.voided_at IS NULL
  ) paid ON true
  WHERE f.commune_id = p_commune_id
    AND public.is_commune_admin(f.commune_id)
    AND c.user_id <> commune_private.data_api_user_id()
    AND m.active AND f.archived_at IS NULL AND c.cancelled_at IS NULL AND c.due_on <= current_date
    AND c.amount_minor > coalesce(paid.total, 0);
END;
$$;


--
-- Name: manage_commune_member(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.manage_commune_member(p_commune_id uuid, p_user_id text, p_action text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_actor text:=commune_private.data_api_user_id(); v_member public.commune_members%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.communes WHERE id=p_commune_id FOR UPDATE;
  SELECT * INTO v_member FROM public.commune_members WHERE commune_id=p_commune_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR NOT v_member.active OR NOT public.is_commune_member(p_commune_id) OR
    (NOT public.is_commune_admin(p_commune_id) AND NOT (p_user_id=v_actor AND p_action='leave')) THEN
    RAISE EXCEPTION 'Only an admin can change other members' USING ERRCODE='42501'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('admin','member','leave','remove') OR (p_action='leave' AND p_user_id<>v_actor) THEN
    RAISE EXCEPTION 'Invalid membership action' USING ERRCODE='22023'; END IF;
  IF v_member.role='admin' AND p_action<>'admin' AND NOT EXISTS(SELECT 1 FROM public.commune_members WHERE commune_id=p_commune_id AND active AND role='admin' AND user_id<>p_user_id) THEN
    RAISE EXCEPTION 'Keep at least one admin. Promote another member first.' USING ERRCODE='P0001'; END IF;
  IF p_action IN ('leave','remove') THEN
    IF EXISTS(SELECT 1 FROM public.expense_shares s JOIN public.expenses e ON e.id=s.expense_id WHERE e.commune_id=p_commune_id AND e.voided_at IS NULL AND s.settled_minor<s.amount_minor AND (s.user_id=p_user_id OR e.paid_by_user_id=p_user_id)) OR
      EXISTS(SELECT 1 FROM public.fund_commitments c JOIN public.funds f ON f.id=c.fund_id WHERE f.commune_id=p_commune_id AND c.user_id=p_user_id AND c.cancelled_at IS NULL AND c.amount_minor>(SELECT coalesce(sum(fc.amount_minor),0) FROM public.fund_contributions fc WHERE fc.commitment_id=c.id AND fc.voided_at IS NULL)) THEN
      RAISE EXCEPTION 'Resolve outstanding shares and pledges before this member leaves' USING ERRCODE='P0001'; END IF;
    IF EXISTS(SELECT 1 FROM public.recurring_bills b WHERE b.commune_id=p_commune_id AND NOT b.paused AND (b.paid_by_user_id=p_user_id OR EXISTS(SELECT 1 FROM jsonb_array_elements(b.shares) s WHERE s->>'user_id'=p_user_id))) THEN
      RAISE EXCEPTION 'Pause or update recurring bills that include this member first' USING ERRCODE='P0001'; END IF;
    UPDATE public.commune_members SET active=false,left_at=now() WHERE commune_id=p_commune_id AND user_id=p_user_id;
    PERFORM commune_private.revoke_orphaned_invites(p_commune_id);
  ELSE
    UPDATE public.commune_members SET role=p_action WHERE commune_id=p_commune_id AND user_id=p_user_id;
    IF v_member.role='admin' AND p_action='member' THEN PERFORM commune_private.revoke_orphaned_invites(p_commune_id); END IF;
  END IF;
END;
$$;


--
-- Name: mark_notification_read(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_notification_read(p_notification_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.notifications SET read_at = coalesce(read_at, now())
    WHERE id = p_notification_id
      AND recipient_user_id = commune_private.data_api_user_id();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found' USING ERRCODE = '42501';
  END IF;
END;
$$;


--
-- Name: member_profiles(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.member_profiles(p_commune_id uuid) RETURNS TABLE(id text, name text, email text, role text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_commune_member(p_commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT u.id::text, u.name, CASE WHEN m.active THEN u.email END, m.role
  FROM public.commune_members m
  JOIN commune_private.accounts(ARRAY(SELECT x.user_id FROM public.commune_members x WHERE x.commune_id = p_commune_id)) u ON u.id = m.user_id
  WHERE m.commune_id = p_commune_id
  ORDER BY m.joined_at;
END;
$$;


--
-- Name: member_profiles_with_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.member_profiles_with_status(p_commune_id uuid) RETURNS TABLE(id text, name text, email text, role text, active boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_commune_member(p_commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT m.user_id, coalesce(u.name, 'Former member'), CASE WHEN m.active THEN u.email END, m.role, m.active
    FROM public.commune_members m LEFT JOIN commune_private.accounts(ARRAY(SELECT x.user_id FROM public.commune_members x WHERE x.commune_id = p_commune_id)) u ON u.id = m.user_id
    WHERE m.commune_id = p_commune_id ORDER BY m.joined_at;
END;
$$;


--
-- Name: my_communes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_communes() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'kind', c.kind, 'currency', c.currency,
      'address', c.address, 'destination', c.destination, 'stayName', c.stay_name, 'stayAddress', c.stay_address,
      'role', m.role, 'memberCount', (SELECT count(*) FROM public.commune_members cm WHERE cm.commune_id = c.id AND cm.active),
      'changeMark', commune_private.change_mark(c.id),
      'unreadNotices', commune_private.unread_notice_count(c.id, m.user_id)) ORDER BY c.created_at DESC, c.id), '[]'::jsonb)
    FROM public.commune_members m JOIN public.communes c ON c.id = m.commune_id
    WHERE m.user_id = commune_private.data_api_user_id() AND m.active;
$$;


--
-- Name: my_pay_links(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_pay_links() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in to see how people pay you' USING ERRCODE = '42501';
  END IF;
  RETURN commune_private.pay_links_for(v_actor);
END;
$$;


--
-- Name: my_unread_notices(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_unread_notices() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT coalesce(jsonb_agg(n.notice || jsonb_build_object(
      'senderName', names.value ->> (n.notice ->> 'senderUserId'),
      'fundId', (SELECT f.id FROM public.fund_commitments c JOIN public.funds f ON f.id = c.fund_id
        WHERE n.notice ->> 'kind' IN ('pledge-changed', 'pledge-cancelled') AND c.id = (n.notice ->> 'sourceId')::uuid
          AND f.archived_at IS NULL))
    ORDER BY (n.notice ->> 'createdAt')::timestamptz DESC, n.notice ->> 'id'), '[]'::jsonb)
  FROM public.commune_members m
  CROSS JOIN LATERAL (SELECT commune_private.member_names(m.commune_id) AS value) names
  CROSS JOIN LATERAL jsonb_array_elements(commune_private.snapshot_notifications(m.commune_id, m.user_id)) n(notice)
  WHERE m.user_id = commune_private.data_api_user_id() AND m.active
    AND commune_private.unread_notice_count(m.commune_id, m.user_id) > 0
    AND n.notice ->> 'readAt' IS NULL;
$$;


--
-- Name: pledge_fund(uuid, bigint, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pledge_fund(p_fund_id uuid, p_amount_minor bigint, p_due_on date) RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT (public.pledge_fund_command(p_fund_id, p_amount_minor, p_due_on, gen_random_uuid()) ->> 'id')::uuid;
$$;


--
-- Name: pledge_fund_command(uuid, bigint, date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pledge_fund_command(p_fund_id uuid, p_amount_minor bigint, p_due_on date, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_request public.fund_pledge_requests%ROWTYPE;
  v_existing public.fund_commitments%ROWTYPE;
  v_commune uuid; v_archived timestamptz; v_id uuid; v_cancelled timestamptz;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to make a pledge' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'commune-pledge-request:' || v_actor || ':' || p_request_id::text, 0));
  PERFORM commune_private.lock_fund_membership(p_fund_id);
  SELECT commune_id, archived_at INTO v_commune, v_archived FROM public.funds WHERE id = p_fund_id FOR UPDATE;
  IF NOT public.is_commune_member(v_commune) THEN RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501'; END IF;
  -- A repeat returns the pledge only while it stands as this request left it:
  -- same fund and figures, not cancelled, unchanged, and not made again since
  -- by a later request.
  SELECT * INTO v_request FROM public.fund_pledge_requests WHERE user_id = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    SELECT * INTO v_existing FROM public.fund_commitments WHERE id = v_request.commitment_id;
    IF v_existing.fund_id IS DISTINCT FROM p_fund_id OR v_archived IS NOT NULL OR v_existing.cancelled_at IS NOT NULL
       OR v_request.amount_minor IS DISTINCT FROM p_amount_minor OR v_request.due_on IS DISTINCT FROM p_due_on
       OR v_existing.amount_minor IS DISTINCT FROM v_request.amount_minor OR v_existing.due_on IS DISTINCT FROM v_request.due_on
       OR EXISTS (SELECT 1 FROM public.fund_pledge_requests r
         WHERE r.commitment_id = v_request.commitment_id AND r.seq > v_request.seq) THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'duplicate', true);
  END IF;
  IF v_archived IS NOT NULL OR p_amount_minor IS NULL OR p_amount_minor NOT BETWEEN 1 AND 1000000000000 OR p_due_on IS NULL THEN
    RAISE EXCEPTION 'Invalid pledge or archived fund' USING ERRCODE = '22023'; END IF;
  SELECT id, cancelled_at INTO v_id, v_cancelled FROM public.fund_commitments WHERE fund_id = p_fund_id AND user_id = v_actor FOR UPDATE;
  IF FOUND THEN
    IF v_cancelled IS NULL THEN RAISE EXCEPTION 'You already have a pledge; edit it instead' USING ERRCODE = 'P0001'; END IF;
    UPDATE public.fund_commitments SET amount_minor = p_amount_minor, due_on = p_due_on, cancelled_at = NULL WHERE id = v_id;
  ELSE
    INSERT INTO public.fund_commitments (fund_id, user_id, amount_minor, due_on)
      VALUES (p_fund_id, v_actor, p_amount_minor, p_due_on) RETURNING id INTO v_id;
  END IF;
  INSERT INTO public.fund_pledge_requests (user_id, request_id, commitment_id, amount_minor, due_on)
    VALUES (v_actor, p_request_id, v_id, p_amount_minor, p_due_on);
  RETURN jsonb_build_object('id', v_id, 'duplicate', false);
END;
$$;


--
-- Name: post_announcement(uuid, text, text, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_announcement(p_commune_id uuid, p_title text, p_body text, p_needs_acknowledgement boolean, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_existing public.commune_announcements%ROWTYPE;
  v_id uuid;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to post an announcement' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_commune_admin(p_commune_id) THEN
    RAISE EXCEPTION 'Only an admin can post an announcement' USING ERRCODE = '42501';
  END IF;
  -- Serialise posts in one commune so the active limit holds.
  PERFORM 1 FROM public.communes WHERE id = p_commune_id FOR UPDATE;
  SELECT * INTO v_existing FROM public.commune_announcements WHERE author_id = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.commune_id <> p_commune_id OR v_existing.title <> v_title THEN
      RAISE EXCEPTION 'This request was already used for a different announcement' USING ERRCODE = '22023';
    END IF;
    RETURN commune_private.announcement_result(v_existing.id, true);
  END IF;
  IF length(v_title) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Give the announcement a title of up to 80 characters' USING ERRCODE = '22023';
  END IF;
  IF length(v_body) > 1000 THEN
    RAISE EXCEPTION 'Keep the announcement to 1000 characters' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.commune_announcements
      WHERE commune_id = p_commune_id AND archived_at IS NULL) >= 20 THEN
    RAISE EXCEPTION 'There are already 20 announcements up. Take one down first.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.commune_announcements (commune_id, author_id, title, body, needs_acknowledgement, request_id)
    VALUES (p_commune_id, v_actor, v_title, v_body, coalesce(p_needs_acknowledgement, false), p_request_id)
    RETURNING id INTO v_id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (p_commune_id, v_actor, 'announcements', v_id, v_title,
      CASE WHEN coalesce(p_needs_acknowledgement, false) THEN 'Posted. Please confirm you have seen it' ELSE 'Posted' END);
  RETURN commune_private.announcement_result(v_id, false);
END;
$$;


--
-- Name: preview_commune_invite(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preview_commune_invite(p_token text) RETURNS TABLE(commune_name text, role text, expires_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_email text;
BEGIN
  SELECT lower(u.email) INTO v_email
  FROM commune_private.accounts(ARRAY[commune_private.data_api_user_id()]) u
  WHERE u."emailVerified" IS TRUE;
  IF v_email IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT c.name, i.role, i.expires_at
  FROM public.commune_invites i
  JOIN public.communes c ON c.id = i.commune_id
  WHERE i.token_hash = digest(p_token, 'sha256')
    AND i.email = v_email AND i.expires_at > now()
    AND i.accepted_at IS NULL AND i.revoked_at IS NULL
    AND EXISTS (SELECT 1 FROM public.commune_members m WHERE m.commune_id = i.commune_id
      AND m.user_id = i.invited_by AND m.active AND m.role = 'admin');
END;
$_$;


--
-- Name: record_fund_contribution(uuid, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_fund_contribution(p_commitment_id uuid, p_amount_minor bigint) RETURNS uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT (public.record_fund_contribution_command(p_commitment_id, p_amount_minor, gen_random_uuid()) ->> 'id')::uuid;
$$;


--
-- Name: record_fund_contribution_command(uuid, bigint, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_fund_contribution_command(p_commitment_id uuid, p_amount_minor bigint, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_existing public.fund_contributions%ROWTYPE;
  v_row public.fund_commitments%ROWTYPE; v_commune uuid; v_archived timestamptz; v_paid bigint; v_id uuid;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to record a contribution' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'commune-contribution-request:' || v_actor || ':' || p_request_id::text, 0));
  PERFORM commune_private.lock_fund_membership((SELECT fund_id FROM public.fund_commitments WHERE id=p_commitment_id));
  SELECT f.commune_id,f.archived_at INTO v_commune,v_archived FROM public.funds f JOIN public.fund_commitments c ON c.fund_id=f.id WHERE c.id=p_commitment_id FOR UPDATE OF f;
  SELECT * INTO v_row FROM public.fund_commitments WHERE id=p_commitment_id FOR UPDATE;
  IF NOT public.is_commune_admin(v_commune) THEN RAISE EXCEPTION 'Only an admin can confirm a contribution' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_existing FROM public.fund_contributions WHERE recorded_by = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.commitment_id <> p_commitment_id OR v_existing.voided_at IS NOT NULL
       OR v_existing.amount_minor IS DISTINCT FROM p_amount_minor THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'duplicate', true);
  END IF;
  -- Someone else confirms money towards an admin's own pledge whenever the
  -- commune has another admin. A commune with one admin still works.
  IF v_row.user_id = v_actor AND EXISTS (SELECT 1 FROM public.commune_members m
      WHERE m.commune_id = v_commune AND m.active AND m.role = 'admin' AND m.user_id <> v_actor) THEN
    RAISE EXCEPTION 'Ask another admin to confirm contributions to your own pledge' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(sum(amount_minor),0) INTO v_paid FROM public.fund_contributions WHERE commitment_id=p_commitment_id AND voided_at IS NULL;
  IF v_row.id IS NULL OR v_row.cancelled_at IS NOT NULL OR v_archived IS NOT NULL OR p_amount_minor IS NULL OR p_amount_minor <= 0 OR v_paid+p_amount_minor > v_row.amount_minor THEN
    RAISE EXCEPTION 'Contribution exceeds the active outstanding pledge' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.fund_contributions (commitment_id, amount_minor, recorded_by, request_id)
    VALUES (p_commitment_id, p_amount_minor, v_actor, p_request_id) RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'duplicate', false);
END;
$$;


--
-- Name: record_operation_occurrence(uuid, text, date, date, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_operation_occurrence(p_operation_id uuid, p_action text, p_expected_date date, p_today date, p_request_id uuid, p_reason text DEFAULT NULL::text, p_done_by text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_commune_id uuid;
  v_op public.commune_operations%ROWTYPE;
  v_replay public.operation_occurrences%ROWTYPE;
  v_actor_name text;
  v_date date; v_assignee text; v_assignee_id text; v_turn_owner_id text; v_status text; v_last_done jsonb;
  v_id uuid; v_description text; v_reason text;
  v_holder_name text; v_held_by_name text; v_done_by_id text;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to update a task' USING ERRCODE = '22023';
  END IF;
  -- The commune first, then the task, as in update_operation: the order a
  -- member leaving takes them in. The other order lets the two wait on each
  -- other until one fails as a deadlock.
  SELECT commune_id INTO v_commune_id FROM public.commune_operations WHERE id = p_operation_id;
  PERFORM 1 FROM public.communes WHERE id = v_commune_id FOR UPDATE;
  -- The row lock serialises two people acting on the same task.
  SELECT * INTO v_op FROM public.commune_operations WHERE id = p_operation_id FOR UPDATE;
  IF v_op.id IS NULL OR NOT public.is_commune_member(v_op.commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_replay FROM public.operation_occurrences WHERE actor_id = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_replay.operation_id <> p_operation_id OR v_replay.action IS DISTINCT FROM p_action THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    RETURN commune_private.occurrence_result(v_replay.id, true, p_operation_id);
  END IF;
  IF v_op.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This task has been removed' USING ERRCODE = 'P0001';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('completed', 'skipped', 'reopened') THEN
    RAISE EXCEPTION 'Unknown task action' USING ERRCODE = '22023';
  END IF;
  v_reason := commune_private.occurrence_reason(p_reason);
  IF v_reason IS NOT NULL AND p_action <> 'skipped' THEN
    RAISE EXCEPTION 'Only a skip or a handover takes a reason' USING ERRCODE = '22023';
  END IF;
  IF p_done_by IS NOT NULL AND (p_done_by NOT IN ('me', 'assignee') OR p_action <> 'completed') THEN
    RAISE EXCEPTION 'Only marking a task done says who did it: you, or the person who has it' USING ERRCODE = '22023';
  END IF;
  -- A commune has no time zone, so the member's own date decides "today".
  -- It may differ from the server's UTC date by at most one day.
  IF p_today IS NULL OR p_today NOT BETWEEN current_date - 1 AND current_date + 1 THEN
    RAISE EXCEPTION 'Check the date on this device and try again' USING ERRCODE = '22023';
  END IF;
  IF v_op.kind <> 'task' THEN
    RAISE EXCEPTION 'Only tasks can be completed, skipped or reopened' USING ERRCODE = '22023';
  END IF;
  IF p_expected_date IS DISTINCT FROM v_op.date THEN
    RAISE EXCEPTION 'This task has already moved on. Refresh to see who has it now.' USING ERRCODE = 'P0001';
  END IF;
  SELECT coalesce(u.name, 'Member') INTO v_actor_name FROM commune_private.accounts(ARRAY[v_actor]) u;
  v_actor_name := left(coalesce(v_actor_name, 'Member'), 80);
  v_date := v_op.date; v_assignee := v_op.assignee; v_assignee_id := v_op.assignee_id;
  v_turn_owner_id := v_op.turn_owner_id; v_status := v_op.status; v_last_done := v_op.last_done;

  IF p_action = 'completed' THEN
    IF v_op.status <> 'open' THEN
      RAISE EXCEPTION 'This task is already done' USING ERRCODE = 'P0001';
    END IF;
    -- Who did it. Someone else's task needs an answer, so nothing is marked
    -- done for a person without both names on it.
    IF v_op.assignee_id IS NOT NULL THEN
      v_holder_name := commune_private.member_name(v_op.assignee_id);
    END IF;
    IF v_op.assignee_id IS NOT NULL AND v_op.assignee_id <> v_actor THEN
      IF p_done_by IS NULL THEN
        RAISE EXCEPTION 'This is %''s turn. Say whether you did it or they did.', split_part(v_holder_name, ' ', 1) USING ERRCODE = '22023';
      END IF;
      v_done_by_id := CASE p_done_by WHEN 'me' THEN v_actor ELSE v_op.assignee_id END;
    ELSIF p_done_by = 'assignee' AND v_op.assignee_id IS NULL THEN
      RAISE EXCEPTION 'Nobody has this task. Mark it done as yourself.' USING ERRCODE = '22023';
    ELSE
      v_held_by_name := left(nullif(btrim(coalesce(v_op.assignee, '')), ''), 80);
      -- A task held by a name with no account cannot say who that was.
      v_done_by_id := CASE WHEN v_op.assignee_id IS NULL AND v_held_by_name IS NOT NULL THEN NULL ELSE v_actor END;
    END IF;
    v_last_done := CASE
      WHEN v_done_by_id IS NULL THEN jsonb_strip_nulls(jsonb_build_object('by', v_held_by_name, 'date', p_today,
        'markedBy', CASE WHEN v_held_by_name <> v_actor_name THEN v_actor_name END))
      WHEN v_done_by_id <> v_actor THEN jsonb_build_object('by', v_holder_name, 'date', p_today, 'markedBy', v_actor_name)
      WHEN v_op.assignee_id IS NOT NULL AND v_op.assignee_id <> v_actor THEN
        jsonb_build_object('by', v_actor_name, 'date', p_today, 'covering', v_holder_name)
      ELSE jsonb_build_object('by', v_actor_name, 'date', p_today) END;
    IF v_op.repeat = 'none' THEN
      v_status := 'done';
    ELSE
      -- Next occurrence strictly after today.
      LOOP
        IF v_op.repeat = 'weekly' THEN
          v_date := v_date + 7;
        ELSE
          -- Step month by month from the anchor day, clamped to each month's
          -- length, so 31 January goes to 28 February and back to 31 March.
          v_date := (date_trunc('month', v_date) + interval '1 month')::date
            + (least(coalesce(v_op.anchor_day, extract(day FROM v_op.date)::int),
                extract(day FROM (date_trunc('month', v_date) + interval '2 month - 1 day'))::int) - 1);
        END IF;
        EXIT WHEN v_date > p_today;
      END LOOP;
      IF v_op.rotation_ids IS NOT NULL THEN
        -- The turn moves on from whoever's turn it was, not from the person
        -- covering it. Members who have left are passed over.
        v_assignee_id := coalesce(
          commune_private.next_in_rotation(v_op.commune_id, v_op.rotation_ids, coalesce(v_op.turn_owner_id, v_op.assignee_id)),
          v_op.turn_owner_id, v_op.assignee_id);
        v_assignee := CASE WHEN v_assignee_id IS NULL THEN v_op.assignee ELSE commune_private.member_name(v_assignee_id) END;
      ELSIF v_op.turn_owner_id IS NOT NULL THEN
        v_assignee_id := v_op.turn_owner_id;
        v_assignee := commune_private.member_name(v_assignee_id);
      END IF;
    END IF;
    -- A cover lasts for one occurrence.
    v_turn_owner_id := NULL;
    v_description := CASE WHEN v_last_done ? 'markedBy' THEN 'Marked done for ' || (v_last_done->>'by')
        WHEN v_last_done ? 'covering' THEN 'Completed, covering ' || (v_last_done->>'covering')
        ELSE 'Completed' END
      || CASE WHEN v_op.repeat = 'none' THEN ''
        WHEN v_assignee_id IS DISTINCT FROM v_op.assignee_id AND v_assignee IS NOT NULL THEN '. Next: ' || v_assignee
        ELSE '. Next due ' || to_char(v_date, 'FMDD Mon') END;
  ELSIF p_action = 'skipped' THEN
    IF v_op.status <> 'open' OR v_op.repeat = 'none' THEN
      RAISE EXCEPTION 'Only an open repeating task can be skipped' USING ERRCODE = 'P0001';
    END IF;
    v_date := greatest(v_op.date, p_today) + 7;
    v_description := 'Skipped to ' || to_char(v_date, 'FMDD Mon') || coalesce(': ' || v_reason, '');
  ELSE
    IF v_op.status <> 'done' THEN
      RAISE EXCEPTION 'This task is already open' USING ERRCODE = 'P0001';
    END IF;
    v_status := 'open';
    v_description := 'Reopened';
  END IF;

  PERFORM set_config('commune.occurrence_event', 'on', true);
  UPDATE public.commune_operations SET date = v_date, assignee = v_assignee, assignee_id = v_assignee_id,
    turn_owner_id = v_turn_owner_id, status = v_status, last_done = v_last_done, updated_at = now()
    WHERE id = p_operation_id;
  PERFORM set_config('commune.occurrence_event', 'off', true);
  -- clock_timestamp(), taken while the row lock is held, orders occurrences
  -- by when they were recorded rather than when their transaction began.
  INSERT INTO public.operation_occurrences (operation_id, commune_id, action, due_on, assignee, actor_id, acted_on, acted_at, request_id,
      prev_date, prev_assignee, prev_status, prev_last_done, next_date, next_assignee, next_status, next_last_done,
      assignee_id, prev_assignee_id, next_assignee_id, reason, prev_turn_owner_id, next_turn_owner_id, done_by_id)
    VALUES (p_operation_id, v_op.commune_id, p_action, v_op.date, v_op.assignee, v_actor, p_today, clock_timestamp(), p_request_id,
      v_op.date, v_op.assignee, v_op.status, v_op.last_done, v_date, v_assignee, v_status, v_last_done,
      v_op.assignee_id, v_op.assignee_id, v_assignee_id, v_reason, v_op.turn_owner_id, v_turn_owner_id, v_done_by_id)
    RETURNING id INTO v_id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_op.commune_id, v_actor, 'operations', p_operation_id, v_op.title, left(v_description, 240));
  RETURN commune_private.occurrence_result(v_id, false, p_operation_id);
END;
$$;


--
-- Name: record_recurring_bill(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_recurring_bill(p_id uuid, p_expected_due_on date) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_result jsonb;
BEGIN
  -- This command never had a retry contract: a second call for the same
  -- period (even one that waited on the lock) is refused, as before.
  v_result := public.record_recurring_period(p_id, p_expected_due_on, NULL);
  IF (v_result->>'duplicate')::boolean THEN
    RAISE EXCEPTION 'This bill is not due, is paused, or has already been recorded. Refresh the schedule.' USING ERRCODE = 'P0001';
  END IF;
  RETURN (v_result->>'expenseId')::uuid;
END;
$$;


--
-- Name: record_recurring_period(uuid, date, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_recurring_period(p_id uuid, p_expected_due_on date, p_amount_minor bigint DEFAULT NULL::bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_bill public.recurring_bills%ROWTYPE;
  v_done public.recurring_bill_occurrences%ROWTYPE;
  v_amount bigint; v_shares jsonb; v_id uuid; v_currency text;
BEGIN
  PERFORM 1 FROM public.communes co JOIN public.recurring_bills b ON b.commune_id = co.id WHERE b.id = p_id FOR UPDATE OF co;
  SELECT * INTO v_bill FROM public.recurring_bills WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_commune_member(v_bill.commune_id) OR
     (v_bill.paid_by_user_id <> v_actor AND NOT public.is_commune_admin(v_bill.commune_id)) THEN
    RAISE EXCEPTION 'Only the payer or an admin can record this bill' USING ERRCODE = '42501';
  END IF;
  v_amount := coalesce(p_amount_minor, v_bill.amount_minor);
  -- The same period sent again: report what was recorded, never twice.
  SELECT * INTO v_done FROM public.recurring_bill_occurrences WHERE bill_id = p_id AND due_on = p_expected_due_on;
  IF FOUND THEN
    IF v_done.status = 'recorded' AND v_done.amount_minor IS NOT DISTINCT FROM v_amount THEN
      RETURN commune_private.recurring_period_result(p_id, p_expected_due_on, true);
    END IF;
    RAISE EXCEPTION 'This period was already %. Refresh the schedule.',
      CASE v_done.status WHEN 'skipped' THEN 'skipped' ELSE 'recorded with a different amount' END USING ERRCODE = 'P0001';
  END IF;
  IF v_bill.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This bill is archived. Restore and resume it before recording a period.' USING ERRCODE = 'P0001';
  END IF;
  IF v_bill.next_due_on IS DISTINCT FROM p_expected_due_on OR v_bill.paused OR v_bill.next_due_on > current_date + 1 THEN
    RAISE EXCEPTION 'This bill is not due, is paused, or has already been recorded. Refresh the schedule.' USING ERRCODE = 'P0001';
  END IF;
  IF v_amount NOT BETWEEN 1 AND 1000000000000 THEN
    RAISE EXCEPTION 'Enter the amount paid, greater than zero' USING ERRCODE = '22023';
  END IF;
  v_shares := CASE WHEN v_amount = v_bill.amount_minor THEN v_bill.shares
    ELSE commune_private.scale_recurring_shares(v_bill.shares, v_amount) END;
  v_id := public.create_expense_for(v_bill.commune_id, v_bill.title, v_amount, v_shares, v_bill.next_due_on, v_bill.paid_by_user_id, 'Bills');
  INSERT INTO public.recurring_bill_occurrences (bill_id, due_on, expense_id, status, amount_minor, actor_id, acted_at)
    VALUES (p_id, v_bill.next_due_on, v_id, 'recorded', v_amount, v_actor, clock_timestamp());
  PERFORM set_config('commune.occurrence_event', 'on', true);
  UPDATE public.recurring_bills SET next_due_on = commune_private.recurring_next_due(frequency, next_due_on, anchor_day), updated_at = now()
    WHERE id = p_id;
  PERFORM set_config('commune.occurrence_event', 'off', true);
  SELECT currency INTO v_currency FROM public.communes WHERE id = v_bill.commune_id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_bill.commune_id, v_actor, 'recurring', p_id, v_bill.title,
      'Recorded for ' || to_char(v_bill.next_due_on, 'FMDD Mon') || ' · ' || commune_private.format_money(v_amount, v_currency)
      || CASE WHEN v_amount <> v_bill.amount_minor THEN ' (usually ' || commune_private.format_money(v_bill.amount_minor, v_currency) || ')' ELSE '' END);
  RETURN commune_private.recurring_period_result(p_id, p_expected_due_on, false);
END;
$$;


--
-- Name: record_share_receipt(uuid, bigint, date, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_share_receipt(p_share_id uuid, p_amount_minor bigint, p_received_on date, p_reference text, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_share public.expense_shares%ROWTYPE;
  v_expense public.expenses%ROWTYPE;
  v_existing public.expense_share_receipts%ROWTYPE;
  v_reference text := nullif(btrim(coalesce(p_reference, '')), '');
  v_currency text; v_id uuid; v_settled bigint;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to record a repayment' USING ERRCODE = '22023';
  END IF;
  -- Commune, then share: the order every money write uses. Membership
  -- changes take the same commune lock, so a leaving member cannot race this.
  PERFORM 1 FROM public.communes co JOIN public.expenses e ON e.commune_id = co.id
    JOIN public.expense_shares s ON s.expense_id = e.id WHERE s.id = p_share_id FOR UPDATE OF co;
  SELECT * INTO v_share FROM public.expense_shares WHERE id = p_share_id FOR UPDATE;
  IF FOUND THEN SELECT * INTO v_expense FROM public.expenses WHERE id = v_share.expense_id; END IF;
  IF v_expense.id IS NULL OR NOT public.is_commune_member(v_expense.commune_id)
     OR v_actor IS DISTINCT FROM v_expense.paid_by_user_id THEN
    RAISE EXCEPTION 'Only the bill payer can record a repayment for this share' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_existing FROM public.expense_share_receipts
    WHERE recorded_by = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.share_id <> p_share_id OR v_existing.amount_minor IS DISTINCT FROM p_amount_minor
       OR v_existing.received_on IS DISTINCT FROM p_received_on OR v_existing.reference IS DISTINCT FROM v_reference THEN
      RAISE EXCEPTION 'This request was already used for a different repayment' USING ERRCODE = '22023';
    END IF;
    IF v_existing.reversed_at IS NOT NULL THEN
      RAISE EXCEPTION 'That repayment was recorded and later reversed. Record it again as a new entry.' USING ERRCODE = 'P0001';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'duplicate', true,
      'settledMinor', v_share.settled_minor, 'outstandingMinor', v_share.amount_minor - v_share.settled_minor);
  END IF;
  SELECT currency INTO v_currency FROM public.communes WHERE id = v_expense.commune_id;
  IF v_share.user_id = v_expense.paid_by_user_id THEN
    RAISE EXCEPTION 'The payer''s own share is not a repayment' USING ERRCODE = '22023';
  END IF;
  IF commune_private.expense_is_voided(v_expense.id) THEN
    RAISE EXCEPTION 'This expense was voided. Repayments cannot be recorded against it.' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'Enter the amount received, greater than zero' USING ERRCODE = '22023';
  END IF;
  IF p_amount_minor > v_share.amount_minor - v_share.settled_minor THEN
    RAISE EXCEPTION 'Only % is still outstanding on this share',
      commune_private.format_money(v_share.amount_minor - v_share.settled_minor, v_currency) USING ERRCODE = 'P0001';
  END IF;
  -- One day of tolerance covers a member whose local date is ahead of UTC.
  IF p_received_on IS NULL OR p_received_on > current_date + 1 OR p_received_on < DATE '2000-01-01' THEN
    RAISE EXCEPTION 'Enter the date the money was received, not a future date' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(v_reference, '')) > 80 THEN
    RAISE EXCEPTION 'Keep the reference to 80 characters' USING ERRCODE = '22023';
  END IF;
  -- Everyone in the commune can read a reference. Refuse what looks like a
  -- card or account number rather than storing it.
  IF regexp_replace(coalesce(v_reference, ''), '\s', '', 'g') ~ '[0-9]{8,}' THEN
    RAISE EXCEPTION 'Leave out card or account numbers. A short note such as "bank transfer" is enough.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.expense_share_receipts (share_id, amount_minor, received_on, reference, recorded_by, request_id)
    VALUES (p_share_id, p_amount_minor, p_received_on, v_reference, v_actor, p_request_id) RETURNING id INTO v_id;
  v_settled := commune_private.project_share_settlement(p_share_id);
  RETURN jsonb_build_object('id', v_id, 'duplicate', false,
    'settledMinor', v_settled, 'outstandingMinor', v_share.amount_minor - v_settled);
END;
$$;


--
-- Name: reminder_usage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reminder_usage() RETURNS TABLE(total_used integer, total_limit integer, recipient_limit integer, recipient_usage jsonb, next_slot_at timestamp with time zone, recipient_last_sent jsonb)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_sender text := commune_private.data_api_user_id();
BEGIN
  IF v_sender IS NULL OR v_sender = '' THEN
    RAISE EXCEPTION 'Sign in to see reminder usage' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH recent AS (
    SELECT r.recipient_user_id, r.created_at
    FROM public.reminders r
    WHERE r.sender_user_id = v_sender
      AND r.created_at > now() - interval '30 days'
  ), by_recipient AS (
    SELECT recent.recipient_user_id, count(*)::integer AS used, max(recent.created_at) AS last_sent
    FROM recent GROUP BY recent.recipient_user_id
  ), ranked AS (
    SELECT recent.created_at,
      row_number() OVER (ORDER BY recent.created_at) AS position,
      count(*) OVER () AS total
    FROM recent
  )
  SELECT
    (SELECT count(*)::integer FROM recent),
    60,
    8,
    (SELECT coalesce(jsonb_object_agg(recipient_user_id, used), '{}'::jsonb)
       FROM by_recipient),
    (SELECT created_at + interval '30 days'
       FROM ranked WHERE position = total - 59),
    (SELECT coalesce(jsonb_object_agg(recipient_user_id, last_sent), '{}'::jsonb)
       FROM by_recipient WHERE last_sent > now() - interval '1 day');
END;
$$;


--
-- Name: remove_note(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_note(p_note_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_note public.commune_notes%ROWTYPE;
BEGIN
  SELECT * INTO v_note FROM public.commune_notes WHERE id = p_note_id FOR UPDATE;
  IF v_note.id IS NULL OR NOT public.is_commune_member(v_note.commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  IF v_note.created_by <> v_actor AND NOT public.is_commune_admin(v_note.commune_id) THEN
    RAISE EXCEPTION 'Only the person who added this note or an admin can remove it' USING ERRCODE = '42501';
  END IF;
  IF v_note.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_note.id, 'version', v_note.version, 'duplicate', true);
  END IF;
  UPDATE public.commune_notes SET deleted_at = now(), deleted_by = v_actor WHERE id = p_note_id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_note.commune_id, v_actor, 'notes', v_note.id, v_note.title, 'Removed');
  RETURN jsonb_build_object('id', v_note.id, 'version', v_note.version, 'duplicate', false);
END;
$$;


--
-- Name: remove_operation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_operation(p_operation_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_commune_id uuid;
  v_op public.commune_operations%ROWTYPE;
  v_version integer;
BEGIN
  -- The commune first, then the task, as in update_operation.
  SELECT commune_id INTO v_commune_id FROM public.commune_operations WHERE id = p_operation_id;
  PERFORM 1 FROM public.communes WHERE id = v_commune_id FOR UPDATE;
  SELECT * INTO v_op FROM public.commune_operations WHERE id = p_operation_id FOR UPDATE;
  IF v_op.id IS NULL OR NOT public.is_commune_member(v_op.commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  IF v_op.created_by <> v_actor AND NOT public.is_commune_admin(v_op.commune_id) THEN
    RAISE EXCEPTION 'Only the person who added this or an admin can remove it' USING ERRCODE = '42501';
  END IF;
  IF v_op.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_op.id, 'version', v_op.version, 'duplicate', true);
  END IF;
  -- A command write, as completion is: the people and date stay as they are.
  PERFORM set_config('commune.occurrence_event', 'on', true);
  UPDATE public.commune_operations SET deleted_at = now(), deleted_by = v_actor WHERE id = p_operation_id
    RETURNING version INTO v_version;
  PERFORM set_config('commune.occurrence_event', 'off', true);
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_op.commune_id, v_actor, 'operations', v_op.id, v_op.title, 'Removed');
  RETURN jsonb_build_object('id', v_op.id, 'version', v_version, 'duplicate', false);
END;
$$;


--
-- Name: remove_pay_link(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_pay_link(p_provider text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in to change how people pay you' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.member_pay_links WHERE user_id = v_actor AND provider = lower(btrim(coalesce(p_provider, '')));
  RETURN commune_private.pay_links_for(v_actor);
END;
$$;


--
-- Name: report_client_event(text, text, text, text, text, text, integer, integer, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.report_client_event(p_kind text, p_release text, p_route text, p_browser text, p_message text DEFAULT NULL::text, p_stack text DEFAULT NULL::text, p_lcp_ms integer DEFAULT NULL::integer, p_inp_ms integer DEFAULT NULL::integer, p_cls numeric DEFAULT NULL::numeric) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE v_user text := commune_private.data_api_user_id(); v_message text; v_stack text;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('error', 'speed') THEN
    RAISE EXCEPTION 'Report kind must be error or speed' USING ERRCODE = '22023';
  END IF;
  IF p_release IS NULL OR p_release !~ '^[A-Za-z0-9._-]{1,40}$' THEN
    RAISE EXCEPTION 'Invalid release' USING ERRCODE = '22023';
  END IF;
  IF p_route IS NULL OR length(p_route) > 80 OR p_route !~ '^/(([a-z-]+|:[a-z]+)(/([a-z-]+|:[a-z]+))*)?$' THEN
    RAISE EXCEPTION 'A route is a page pattern such as /expenses/:id' USING ERRCODE = '22023';
  END IF;
  IF p_browser IS NULL OR p_browser NOT IN ('chrome', 'edge', 'firefox', 'safari', 'samsung', 'other') THEN
    RAISE EXCEPTION 'Invalid browser' USING ERRCODE = '22023';
  END IF;
  v_message := commune_private.report_text(p_message, 300);
  v_stack := commune_private.report_text(p_stack, 2000);
  IF p_kind = 'error' AND (v_message IS NULL OR num_nonnulls(p_lcp_ms, p_inp_ms, p_cls) > 0) THEN
    RAISE EXCEPTION 'An error report has a message and no speed figures' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'speed' AND (num_nonnulls(p_message, p_stack) > 0 OR num_nonnulls(p_lcp_ms, p_inp_ms, p_cls) = 0) THEN
    RAISE EXCEPTION 'A speed report has speed figures and no message' USING ERRCODE = '22023';
  END IF;
  IF p_lcp_ms NOT BETWEEN 0 AND 600000 OR p_inp_ms NOT BETWEEN 0 AND 600000 OR p_cls NOT BETWEEN 0 AND 1000 THEN
    RAISE EXCEPTION 'Speed figures out of range' USING ERRCODE = '22023';
  END IF;
  -- One account's reports are counted one at a time, so reports sent at
  -- once cannot all slip under the limit.
  PERFORM pg_advisory_xact_lock(hashtextextended('client-report:' || v_user, 0));
  IF (SELECT count(*) FROM commune_private.client_reports WHERE user_id = v_user AND created_at > now() - interval '1 hour') >= 20
    OR (SELECT count(*) FROM commune_private.client_reports WHERE user_id = v_user AND created_at > now() - interval '1 day') >= 100 THEN
    RETURN false;
  END IF;
  INSERT INTO commune_private.client_reports (user_id, kind, release, route, browser, message, stack, lcp_ms, inp_ms, cls)
    VALUES (v_user, p_kind, p_release, p_route, p_browser, v_message, v_stack, p_lcp_ms, p_inp_ms, round(p_cls, 4));
  RETURN true;
END;
$_$;


--
-- Name: report_share_payment(uuid, bigint, date, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.report_share_payment(p_share_id uuid, p_amount_minor bigint, p_sent_on date, p_reference text, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_share public.expense_shares%ROWTYPE;
  v_expense public.expenses%ROWTYPE;
  v_existing public.expense_share_payment_reports%ROWTYPE;
  v_reference text := nullif(btrim(coalesce(p_reference, '')), '');
  v_currency text; v_id uuid; v_pending public.expense_share_payment_reports%ROWTYPE;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to report a payment' USING ERRCODE = '22023';
  END IF;
  -- Commune, then share: the order every money write uses.
  PERFORM 1 FROM public.communes co JOIN public.expenses e ON e.commune_id = co.id
    JOIN public.expense_shares s ON s.expense_id = e.id WHERE s.id = p_share_id FOR UPDATE OF co;
  SELECT * INTO v_share FROM public.expense_shares WHERE id = p_share_id FOR UPDATE;
  IF FOUND THEN SELECT * INTO v_expense FROM public.expenses WHERE id = v_share.expense_id; END IF;
  IF v_expense.id IS NULL OR NOT public.is_commune_member(v_expense.commune_id)
     OR v_actor IS DISTINCT FROM v_share.user_id THEN
    RAISE EXCEPTION 'Only the member who owes this share can report paying it' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_existing FROM public.expense_share_payment_reports
    WHERE reported_by = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.share_id <> p_share_id OR v_existing.amount_minor IS DISTINCT FROM p_amount_minor
       OR v_existing.sent_on IS DISTINCT FROM p_sent_on OR v_existing.reference IS DISTINCT FROM v_reference THEN
      RAISE EXCEPTION 'This request was already used for a different report' USING ERRCODE = '22023';
    END IF;
    RETURN commune_private.payment_report_result(v_existing.id, true);
  END IF;
  IF v_share.user_id = v_expense.paid_by_user_id THEN
    RAISE EXCEPTION 'The payer''s own share is not a repayment' USING ERRCODE = '22023';
  END IF;
  IF commune_private.expense_is_voided(v_expense.id) THEN
    RAISE EXCEPTION 'This expense was voided. There is nothing to pay.' USING ERRCODE = 'P0001';
  END IF;
  SELECT currency INTO v_currency FROM public.communes WHERE id = v_expense.commune_id;
  IF v_share.amount_minor - v_share.settled_minor <= 0 THEN
    RAISE EXCEPTION 'This share is already settled' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_pending FROM public.expense_share_payment_reports WHERE share_id = p_share_id AND status = 'pending';
  IF FOUND THEN
    RAISE EXCEPTION 'You already reported % for this share. Withdraw it first to report a different payment.',
      commune_private.format_money(v_pending.amount_minor, v_currency) USING ERRCODE = 'P0001';
  END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'Enter the amount you sent, greater than zero' USING ERRCODE = '22023';
  END IF;
  IF p_amount_minor > v_share.amount_minor - v_share.settled_minor THEN
    RAISE EXCEPTION 'Only % is still outstanding on this share',
      commune_private.format_money(v_share.amount_minor - v_share.settled_minor, v_currency) USING ERRCODE = 'P0001';
  END IF;
  IF p_sent_on IS NULL OR p_sent_on > current_date + 1 OR p_sent_on < DATE '2000-01-01' THEN
    RAISE EXCEPTION 'Enter the date you sent the money, not a future date' USING ERRCODE = '22023';
  END IF;
  IF length(coalesce(v_reference, '')) > 80 THEN
    RAISE EXCEPTION 'Keep the reference to 80 characters' USING ERRCODE = '22023';
  END IF;
  IF regexp_replace(coalesce(v_reference, ''), '\s', '', 'g') ~ '[0-9]{8,}' THEN
    RAISE EXCEPTION 'Leave out card or account numbers. A short note such as "bank transfer" is enough.' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.expense_share_payment_reports WHERE share_id = p_share_id
      AND reported_by = v_actor AND reported_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'You have reported this share 10 times today. Try again tomorrow, or ask the bill payer to record it.'
      USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.expense_share_payment_reports (share_id, reported_by, amount_minor, sent_on, reference, request_id)
    VALUES (p_share_id, v_actor, p_amount_minor, p_sent_on, v_reference, p_request_id) RETURNING id INTO v_id;
  PERFORM commune_private.notify_ledger(v_expense.commune_id, v_expense.paid_by_user_id, 'payment_reported',
    v_expense.id, v_actor, p_amount_minor, v_reference);
  RETURN commune_private.payment_report_result(v_id, false);
END;
$$;


--
-- Name: resolve_share_payment_report(uuid, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_share_payment_report(p_report_id uuid, p_decision text, p_note text, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_report public.expense_share_payment_reports%ROWTYPE;
  v_share public.expense_shares%ROWTYPE;
  v_expense public.expenses%ROWTYPE;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_receipt jsonb;
BEGIN
  IF p_decision IS NULL OR p_decision NOT IN ('confirm', 'decline') THEN
    RAISE EXCEPTION 'Choose to confirm or decline the report' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.communes co JOIN public.expenses e ON e.commune_id = co.id
    JOIN public.expense_shares s ON s.expense_id = e.id
    JOIN public.expense_share_payment_reports r ON r.share_id = s.id WHERE r.id = p_report_id FOR UPDATE OF co;
  SELECT s.* INTO v_share FROM public.expense_shares s
    JOIN public.expense_share_payment_reports r ON r.share_id = s.id WHERE r.id = p_report_id FOR UPDATE OF s;
  SELECT * INTO v_report FROM public.expense_share_payment_reports WHERE id = p_report_id FOR UPDATE;
  IF v_share.id IS NOT NULL THEN SELECT * INTO v_expense FROM public.expenses WHERE id = v_share.expense_id; END IF;
  IF v_report.id IS NULL OR v_expense.id IS NULL OR NOT public.is_commune_member(v_expense.commune_id)
     OR v_actor IS DISTINCT FROM v_expense.paid_by_user_id THEN
    RAISE EXCEPTION 'Only the bill payer can answer a payment report' USING ERRCODE = '42501';
  END IF;
  -- The same answer sent again reports the standing result.
  IF (p_decision = 'confirm' AND v_report.status = 'confirmed') OR (p_decision = 'decline' AND v_report.status = 'declined') THEN
    RETURN commune_private.payment_report_result(v_report.id, true);
  END IF;
  IF v_report.status = 'withdrawn' THEN
    RAISE EXCEPTION 'This report was withdrawn by the member who made it' USING ERRCODE = 'P0001';
  END IF;
  IF v_report.status <> 'pending' THEN
    RAISE EXCEPTION 'This report has already been answered' USING ERRCODE = 'P0001';
  END IF;
  IF p_decision = 'confirm' THEN
    IF p_request_id IS NULL THEN
      RAISE EXCEPTION 'A request id is required to record a repayment' USING ERRCODE = '22023';
    END IF;
    -- The receipt is checked like any other: not voided, within what is
    -- outstanding, and so on. Its errors explain themselves.
    v_receipt := public.record_share_receipt(v_share.id, v_report.amount_minor, v_report.sent_on, v_report.reference, p_request_id);
    -- A receipt that settles the share closes pending reports; this one is
    -- the confirmation itself, so it is marked confirmed, not closed.
    UPDATE public.expense_share_payment_reports SET status = 'confirmed', resolved_at = now(), resolved_by = v_actor,
        receipt_id = (v_receipt->>'id')::uuid, resolution_note = NULL
      WHERE id = p_report_id;
    PERFORM commune_private.notify_ledger(v_expense.commune_id, v_report.reported_by, 'payment_confirmed',
      v_expense.id, v_actor, v_report.amount_minor, NULL);
  ELSE
    IF v_note IS NULL OR length(v_note) NOT BETWEEN 3 AND 240 THEN
      RAISE EXCEPTION 'Say why it has not been received (3 to 240 characters)' USING ERRCODE = '22023';
    END IF;
    UPDATE public.expense_share_payment_reports SET status = 'declined', resolved_at = now(), resolved_by = v_actor,
        resolution_note = v_note
      WHERE id = p_report_id;
    PERFORM commune_private.notify_ledger(v_expense.commune_id, v_report.reported_by, 'payment_declined',
      v_expense.id, v_actor, v_report.amount_minor, v_note);
  END IF;
  RETURN commune_private.payment_report_result(v_report.id, false);
END;
$$;


--
-- Name: reverse_share_receipt(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reverse_share_receipt(p_receipt_id uuid, p_reason text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_receipt public.expense_share_receipts%ROWTYPE;
  v_share public.expense_shares%ROWTYPE;
  v_expense public.expenses%ROWTYPE;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_currency text; v_settled bigint;
BEGIN
  PERFORM 1 FROM public.communes co JOIN public.expenses e ON e.commune_id = co.id
    JOIN public.expense_shares s ON s.expense_id = e.id
    JOIN public.expense_share_receipts r ON r.share_id = s.id WHERE r.id = p_receipt_id FOR UPDATE OF co;
  SELECT s.* INTO v_share FROM public.expense_shares s
    JOIN public.expense_share_receipts r ON r.share_id = s.id WHERE r.id = p_receipt_id FOR UPDATE OF s;
  SELECT * INTO v_receipt FROM public.expense_share_receipts WHERE id = p_receipt_id FOR UPDATE;
  IF v_share.id IS NOT NULL THEN SELECT * INTO v_expense FROM public.expenses WHERE id = v_share.expense_id; END IF;
  IF v_receipt.id IS NULL OR v_expense.id IS NULL OR NOT public.is_commune_member(v_expense.commune_id)
     OR v_actor IS DISTINCT FROM v_expense.paid_by_user_id THEN
    RAISE EXCEPTION 'Only the bill payer can reverse a repayment' USING ERRCODE = '42501';
  END IF;
  -- A repeated reversal is a no-op that reports the standing result.
  IF v_receipt.reversed_at IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_receipt.id, 'duplicate', true,
      'settledMinor', v_share.settled_minor, 'outstandingMinor', v_share.amount_minor - v_share.settled_minor);
  END IF;
  IF length(v_reason) NOT BETWEEN 3 AND 240 THEN
    RAISE EXCEPTION 'Give a reason for the reversal (3 to 240 characters)' USING ERRCODE = '22023';
  END IF;
  IF commune_private.expense_is_voided(v_expense.id) THEN
    RAISE EXCEPTION 'This expense was voided. Its repayments can no longer change.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.commune_members m
    WHERE m.commune_id = v_expense.commune_id AND m.user_id = v_share.user_id AND m.active) THEN
    RAISE EXCEPTION 'Cannot reopen an obligation for a former member' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.expense_share_receipts SET reversed_at = now(), reversed_by = v_actor, reversal_reason = v_reason
    WHERE id = p_receipt_id;
  v_settled := commune_private.project_share_settlement(v_share.id);
  SELECT currency INTO v_currency FROM public.communes WHERE id = v_expense.commune_id;
  PERFORM commune_private.notify_ledger(v_expense.commune_id, v_share.user_id, 'receipt_reversed',
    v_expense.id, v_actor, v_receipt.amount_minor, v_reason);
  RETURN jsonb_build_object('id', v_receipt.id, 'duplicate', false,
    'settledMinor', v_settled, 'outstandingMinor', v_share.amount_minor - v_settled);
END;
$$;


--
-- Name: revoke_commune_invite(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_commune_invite(p_invite_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_invite public.commune_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite FROM public.commune_invites
    WHERE id = p_invite_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_commune_admin(v_invite.commune_id) THEN
    RAISE EXCEPTION 'Only a commune admin can revoke this invite'
      USING ERRCODE = '42501';
  END IF;
  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Accepted invites cannot be revoked'
      USING ERRCODE = '22023';
  END IF;
  UPDATE public.commune_invites SET revoked_at = coalesce(revoked_at, now())
    WHERE id = p_invite_id;
END;
$$;


--
-- Name: save_recurring_bill(uuid, text, bigint, text, jsonb, text, date, uuid, integer, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_recurring_bill(p_commune_id uuid, p_title text, p_amount_minor bigint, p_paid_by text, p_shares jsonb, p_frequency text, p_next_due_on date, p_id uuid DEFAULT NULL::uuid, p_expected_version integer DEFAULT NULL::integer, p_request_id uuid DEFAULT NULL::uuid, p_paused boolean DEFAULT NULL::boolean) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_admin boolean;
  v_existing public.recurring_bills%ROWTYPE;
  v_last public.recurring_bill_occurrences%ROWTYPE;
  v_earliest date := (current_date - interval '1 year')::date;
  v_latest date := (current_date + interval '2 years')::date;
  v_id uuid;
BEGIN
  PERFORM 1 FROM public.communes WHERE id = p_commune_id FOR UPDATE;
  v_admin := public.is_commune_admin(p_commune_id);
  IF NOT public.is_commune_member(p_commune_id) OR (p_paid_by IS DISTINCT FROM v_actor AND NOT v_admin) THEN
    RAISE EXCEPTION 'Only an admin can schedule another member as payer' USING ERRCODE = '42501';
  END IF;
  IF p_id IS NULL THEN
    IF p_request_id IS NULL THEN
      RAISE EXCEPTION 'A request id is required to add a recurring bill' USING ERRCODE = '22023';
    END IF;
    -- The same request sent at once (even to another commune) waits here for
    -- the first attempt, then finds its bill.
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'commune-recurring-request:' || v_actor || ':' || p_request_id::text, 0));
    SELECT * INTO v_existing FROM public.recurring_bills WHERE created_by = v_actor AND request_id = p_request_id;
    IF FOUND THEN
      -- A retry gets the bill back only while it still stands exactly as this
      -- request made it. A changed request, or a bill changed since, is refused.
      IF v_existing.commune_id <> p_commune_id OR v_existing.version <> 1
         OR v_existing.title IS DISTINCT FROM btrim(p_title) OR v_existing.amount_minor IS DISTINCT FROM p_amount_minor
         OR v_existing.paid_by_user_id IS DISTINCT FROM p_paid_by OR v_existing.shares IS DISTINCT FROM p_shares
         OR v_existing.frequency IS DISTINCT FROM p_frequency OR v_existing.next_due_on IS DISTINCT FROM p_next_due_on
         OR v_existing.paused IS DISTINCT FROM coalesce(p_paused, false) THEN
        RAISE EXCEPTION 'This request was already used for a different bill' USING ERRCODE = '22023';
      END IF;
      RETURN v_existing.id;
    END IF;
  ELSE
    SELECT * INTO v_existing FROM public.recurring_bills WHERE id = p_id FOR UPDATE;
    -- Members edit only a bill they added and pay themselves.
    IF NOT FOUND OR v_existing.commune_id <> p_commune_id
       OR (NOT v_admin AND (v_existing.created_by <> v_actor OR v_existing.paid_by_user_id <> v_actor)) THEN
      RAISE EXCEPTION 'Only an admin, or the member who added this bill and pays it, can edit it' USING ERRCODE = '42501';
    END IF;
    IF p_paused IS NOT NULL THEN
      RAISE EXCEPTION 'An edit cannot pause or resume a bill. Use Pause or Resume.' USING ERRCODE = '22023';
    END IF;
    IF p_expected_version IS NULL THEN
      RAISE EXCEPTION 'Say which version of this bill the change is based on' USING ERRCODE = '22023';
    END IF;
    IF v_existing.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'This bill is archived. Restore it before editing it.' USING ERRCODE = 'P0001';
    END IF;
    IF p_expected_version IS DISTINCT FROM v_existing.version THEN
      RAISE EXCEPTION 'This recurring bill was changed by someone else. Review the latest version before saving your changes.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF length(btrim(coalesce(p_title, ''))) NOT BETWEEN 1 AND 80 OR p_frequency IS NULL OR p_frequency NOT IN ('weekly', 'monthly')
     OR p_next_due_on IS NULL THEN
    RAISE EXCEPTION 'Invalid recurring bill' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.commune_members WHERE commune_id = p_commune_id AND user_id = p_paid_by AND active) THEN
    RAISE EXCEPTION 'Choose a payer who is a member of this commune' USING ERRCODE = '22023';
  END IF;
  -- Far enough back to record the last few periods, not years of history,
  -- and not so far ahead that a typo hides the bill. An unchanged date is
  -- not checked again, so an old paused bill can still be edited.
  IF (p_id IS NULL OR p_next_due_on <> v_existing.next_due_on) AND p_next_due_on NOT BETWEEN v_earliest AND v_latest THEN
    RAISE EXCEPTION 'Choose a next due date between % and %', to_char(v_earliest, 'FMDD Mon YYYY'), to_char(v_latest, 'FMDD Mon YYYY')
      USING ERRCODE = '22023';
  END IF;
  PERFORM commune_private.validate_expense_split(p_commune_id, p_amount_minor, p_shares);
  IF p_id IS NULL THEN
    INSERT INTO public.recurring_bills (commune_id, title, amount_minor, paid_by_user_id, shares, frequency, next_due_on, anchor_day,
        paused, created_by, request_id)
      VALUES (p_commune_id, btrim(p_title), p_amount_minor, p_paid_by, p_shares, p_frequency, p_next_due_on, extract(day FROM p_next_due_on),
        coalesce(p_paused, false), v_actor, p_request_id) RETURNING id INTO v_id;
  ELSE
    -- A recorded or skipped period never becomes due again, and nothing
    -- before the latest one can be reopened.
    SELECT * INTO v_last FROM public.recurring_bill_occurrences WHERE bill_id = p_id ORDER BY due_on DESC LIMIT 1;
    IF FOUND AND p_next_due_on <= v_last.due_on THEN
      RAISE EXCEPTION 'The % period was already %. Choose a next due date after it.', to_char(v_last.due_on, 'FMDD Mon YYYY'), v_last.status
        USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.recurring_bills SET title = btrim(p_title), amount_minor = p_amount_minor, paid_by_user_id = p_paid_by, shares = p_shares,
        frequency = p_frequency, next_due_on = p_next_due_on,
        anchor_day = CASE WHEN next_due_on = p_next_due_on AND frequency = p_frequency THEN anchor_day ELSE extract(day FROM p_next_due_on) END,
        updated_at = now()
      WHERE id = p_id RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;


--
-- Name: save_split_template(uuid, text, text, jsonb, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_split_template(p_commune_id uuid, p_name text, p_method text, p_participants jsonb, p_id uuid DEFAULT NULL::uuid, p_archived boolean DEFAULT false) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE v_id uuid; v_actor text:=commune_private.data_api_user_id(); v_existing public.split_templates%ROWTYPE; v_count integer; v_distinct integer;
BEGIN
  PERFORM 1 FROM public.communes WHERE id=p_commune_id FOR UPDATE;
  IF NOT public.is_commune_member(p_commune_id) THEN RAISE EXCEPTION 'Not a commune member' USING ERRCODE='42501'; END IF;
  IF p_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.split_templates WHERE id=p_id FOR UPDATE;
    IF NOT FOUND OR v_existing.commune_id<>p_commune_id OR (v_existing.created_by<>v_actor AND NOT public.is_commune_admin(p_commune_id)) THEN
      RAISE EXCEPTION 'Only the creator or an admin can edit this template' USING ERRCODE='42501'; END IF;
    IF p_archived IS TRUE THEN
      UPDATE public.split_templates SET archived_at=now() WHERE id=p_id;
      RETURN p_id;
    END IF;
  END IF;
  IF length(btrim(coalesce(p_name,''))) NOT BETWEEN 1 AND 60 OR p_method IS NULL OR p_method NOT IN ('Equal','Exact','Percentage','Shares') OR p_archived IS NULL OR jsonb_typeof(p_participants) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid split template' USING ERRCODE='22023'; END IF;
  SELECT count(*),count(DISTINCT s.user_id) INTO v_count,v_distinct FROM jsonb_to_recordset(p_participants) AS s(user_id text,value text);
  IF v_count NOT BETWEEN 1 AND 100 OR v_count<>v_distinct OR EXISTS(SELECT 1 FROM jsonb_to_recordset(p_participants) AS s(user_id text,value text)
    WHERE length(coalesce(s.value,''))>20 OR NOT EXISTS(SELECT 1 FROM public.commune_members m WHERE m.commune_id=p_commune_id AND m.user_id=s.user_id AND m.active)) THEN
    RAISE EXCEPTION 'Choose unique active members for this template' USING ERRCODE='22023'; END IF;
  IF p_method<>'Equal' THEN
    IF EXISTS(SELECT 1 FROM jsonb_to_recordset(p_participants) AS s(user_id text,value text)
      WHERE coalesce(s.value,'') !~ CASE WHEN p_method='Shares' THEN '^[0-9]+$' ELSE '^[0-9]+(\.[0-9]{1,2})?$' END) THEN
      RAISE EXCEPTION 'Enter valid split values for every participant' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_to_recordset(p_participants) AS s(user_id text,value text) WHERE s.value::numeric<=0) OR
      (p_method='Percentage' AND (SELECT sum(s.value::numeric) FROM jsonb_to_recordset(p_participants) AS s(user_id text,value text))<>100) THEN
      RAISE EXCEPTION 'Split values must be positive and percentages total 100' USING ERRCODE='22023'; END IF;
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.split_templates(commune_id,name,method,participants,created_by) VALUES(p_commune_id,btrim(p_name),p_method,p_participants,v_actor) RETURNING id INTO v_id;
  ELSE
    UPDATE public.split_templates SET name=btrim(p_name),method=p_method,participants=p_participants,archived_at=CASE WHEN p_archived THEN now() ELSE NULL END WHERE id=p_id RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$_$;


--
-- Name: search_commune_records(text, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_commune_records(p_query text, p_commune_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 8) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_query text := btrim(coalesce(p_query, ''));
  v_pattern text;
  v_result jsonb;
BEGIN
  IF v_actor IS NULL OR v_actor = '' THEN
    RAISE EXCEPTION 'Sign in to search' USING ERRCODE = '42501';
  END IF;
  IF p_commune_id IS NOT NULL AND NOT public.is_commune_member(p_commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  IF length(v_query) > 80 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 25 THEN
    RAISE EXCEPTION 'Invalid search query or result limit' USING ERRCODE = '22023';
  END IF;
  IF length(v_query) < 2 THEN
    RETURN jsonb_build_object('query',v_query,'items','[]'::jsonb,'total',0,'hasMore',false);
  END IF;
  -- Treat %, _ and backslash as literal user text, never SQL wildcards.
  v_pattern := '%' || replace(replace(replace(v_query, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  WITH allowed AS MATERIALIZED (
    SELECT co.id, co.name, co.kind, co.currency FROM public.communes co
    JOIN public.commune_members m ON m.commune_id = co.id
    WHERE m.user_id = v_actor AND m.active
      AND (p_commune_id IS NULL OR co.id = p_commune_id)
  ), records AS NOT MATERIALIZED (
    SELECT 'commune'::text AS kind, co.id::text AS id, co.id AS commune_id, co.name AS commune_name,
      co.name AS title, initcap(co.kind) AS subtitle, 'Commune'::text AS meta,
      'Commune'::text AS label, NULL::date AS on_date,
      NULL::bigint AS amount_minor, co.currency, co.name || ' ' || co.kind AS searchable
      FROM allowed co
    UNION ALL
    SELECT 'expense', e.id::text, co.id, co.name, e.title, e.category,
      CASE WHEN e.voided_at IS NOT NULL THEN 'Voided' WHEN EXISTS(SELECT 1 FROM public.expense_shares s WHERE s.expense_id=e.id AND s.settled_minor<s.amount_minor)
        THEN 'Open' ELSE 'Settled' END,
      CASE WHEN e.voided_at IS NOT NULL THEN 'Voided' WHEN EXISTS(SELECT 1 FROM public.expense_shares s WHERE s.expense_id=e.id AND s.settled_minor<s.amount_minor)
        THEN 'Open' ELSE 'Settled' END, NULL::date,
      e.amount_minor, co.currency, e.title || ' ' || e.category
      FROM public.expenses e JOIN allowed co ON co.id=e.commune_id
    UNION ALL
    SELECT 'note', n.id::text, co.id, co.name, n.title,
      commune_private.note_search_excerpt(n.pill,n.body,n.lede,n.facts),
      CASE WHEN n.pill='Landlord' THEN 'Contacts' ELSE n.pill END,
      CASE WHEN n.pill='Landlord' THEN 'Contacts' ELSE n.pill END, NULL::date,
      NULL::bigint, co.currency, n.title || ' ' || CASE WHEN n.pill='Landlord' THEN 'Contacts' ELSE n.pill END || ' ' ||
        commune_private.note_search_excerpt(n.pill,n.body,n.lede,n.facts)
      FROM public.commune_notes n JOIN allowed co ON co.id=n.commune_id WHERE n.deleted_at IS NULL
    UNION ALL
    SELECT 'operation', o.id::text, co.id, co.name, o.title, o.category,
      initcap(o.kind) || ' · ' || o.date::text, initcap(o.kind), o.date,
      NULL::bigint, co.currency, o.title || ' ' || o.category
      FROM public.commune_operations o JOIN allowed co ON co.id=o.commune_id WHERE o.deleted_at IS NULL
    UNION ALL
    SELECT 'fund', f.id::text, co.id, co.name, f.name, 'Shared fund',
      CASE WHEN f.target_minor IS NULL THEN 'No target' ELSE 'Target' END,
      CASE WHEN f.target_minor IS NULL THEN 'No target' ELSE 'Target' END, NULL::date,
      f.target_minor, co.currency, f.name
      FROM public.funds f JOIN allowed co ON co.id=f.commune_id WHERE f.archived_at IS NULL
    UNION ALL
    SELECT 'recurring', b.id::text, co.id, co.name, b.title, initcap(b.frequency),
      CASE WHEN b.paused THEN 'Paused' ELSE 'Due ' || b.next_due_on::text END,
      CASE WHEN b.paused THEN 'Paused' ELSE 'Due' END, CASE WHEN b.paused THEN NULL ELSE b.next_due_on END,
      b.amount_minor, co.currency, b.title
      FROM public.recurring_bills b JOIN allowed co ON co.id=b.commune_id
    UNION ALL
    SELECT 'member', m.user_id, co.id, co.name, coalesce(u.name,'Member'), 'Commune member',
      initcap(m.role), initcap(m.role), NULL::date, NULL::bigint, co.currency, coalesce(u.name,'')
      FROM public.commune_members m JOIN allowed co ON co.id=m.commune_id
      LEFT JOIN commune_private.accounts(ARRAY(SELECT x.user_id FROM public.commune_members x JOIN allowed a ON a.id=x.commune_id WHERE x.active)) u ON u.id=m.user_id WHERE m.active
    UNION ALL
    SELECT 'template', t.id::text, co.id, co.name, t.name, 'Saved split',
      t.method, t.method, NULL::date, NULL::bigint, co.currency, t.name || ' ' || t.method
      FROM public.split_templates t JOIN allowed co ON co.id=t.commune_id WHERE t.archived_at IS NULL
  ), matches AS MATERIALIZED (
    SELECT *, CASE WHEN lower(title)=lower(v_query) THEN 0
      WHEN starts_with(lower(title),lower(v_query)) THEN 1
      WHEN title ILIKE v_pattern ESCAPE E'\\' THEN 2 ELSE 3 END AS rank
      FROM records WHERE searchable ILIKE v_pattern ESCAPE E'\\'
  ), ranked AS (
    SELECT *, row_number() OVER(PARTITION BY kind ORDER BY rank,title,commune_name,id,commune_id) AS position FROM matches
  )
  SELECT jsonb_build_object('query',v_query,
    'items',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',kind,'id',id,
      'communeId',commune_id,'communeName',commune_name,'title',title,'subtitle',subtitle,
      'meta',meta,'label',label,'date',to_char(on_date,'YYYY-MM-DD'),
      'amountMinor',amount_minor,'currency',currency) ORDER BY kind,position)
      FROM ranked WHERE position<=p_limit),'[]'::jsonb),
    'total',(SELECT count(*) FROM matches),
    'hasMore',EXISTS(SELECT 1 FROM ranked WHERE position>p_limit)) INTO v_result;
  RETURN v_result;
END;
$$;


--
-- Name: send_reminder(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_reminder(p_kind text, p_source_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_sender text := commune_private.data_api_user_id();
  v_recipient text;
  v_commune_id uuid;
  v_amount bigint;
  v_due_on date;
  v_payer text;
  v_reminder_id uuid;
BEGIN
  IF v_sender IS NULL OR v_sender = '' THEN
    RAISE EXCEPTION 'Sign in to send a reminder' USING ERRCODE = '42501';
  END IF;
  IF p_kind = 'nudge' THEN
    PERFORM 1 FROM public.communes co JOIN public.expenses e ON e.commune_id = co.id
      JOIN public.expense_shares s ON s.expense_id = e.id WHERE s.id = p_source_id FOR KEY SHARE OF co;
    SELECT s.user_id, e.commune_id, s.amount_minor - s.settled_minor,
      e.due_on, e.paid_by_user_id
      INTO v_recipient, v_commune_id, v_amount, v_due_on, v_payer
    FROM public.expense_shares s
    JOIN public.expenses e ON e.id = s.expense_id
    WHERE s.id = p_source_id FOR UPDATE OF s;
    IF NOT FOUND OR v_sender IS DISTINCT FROM v_payer THEN
      RAISE EXCEPTION 'Only the bill payer can nudge this share'
        USING ERRCODE = '42501';
    END IF;
    -- Checked after the share lock, so a void that committed while this call
    -- waited is seen here.
    IF commune_private.expense_is_voided(
        (SELECT s.expense_id FROM public.expense_shares s WHERE s.id = p_source_id)) THEN
      RAISE EXCEPTION 'This expense was voided. There is nothing to remind about.'
        USING ERRCODE = 'P0001';
    END IF;
    IF false THEN
      RAISE EXCEPTION 'Only the bill payer can nudge this share'
        USING ERRCODE = '42501';
    END IF;
  ELSIF p_kind = 'chase' THEN
    PERFORM 1 FROM public.communes co JOIN public.funds f ON f.commune_id = co.id
      JOIN public.fund_commitments c ON c.fund_id = f.id WHERE c.id = p_source_id FOR KEY SHARE OF co;
    SELECT c.user_id, f.commune_id, c.due_on
      INTO v_recipient, v_commune_id, v_due_on
    FROM public.fund_commitments c
    JOIN public.funds f ON f.id = c.fund_id
    WHERE c.id = p_source_id AND c.cancelled_at IS NULL AND f.archived_at IS NULL FOR UPDATE OF c;
    IF NOT FOUND OR NOT public.is_commune_admin(v_commune_id) THEN
      RAISE EXCEPTION 'Only a commune admin can chase this pledge'
        USING ERRCODE = '42501';
    END IF;
    SELECT c.amount_minor - coalesce(sum(fc.amount_minor), 0)
      INTO v_amount
    FROM public.fund_commitments c
    LEFT JOIN public.fund_contributions fc ON fc.commitment_id = c.id AND fc.voided_at IS NULL
    WHERE c.id = p_source_id
    GROUP BY c.amount_minor;
  ELSE
    RAISE EXCEPTION 'Unknown reminder type' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_commune_member(v_commune_id) OR v_recipient = v_sender OR v_amount IS NULL OR v_amount <= 0
     OR v_due_on IS NULL OR v_due_on > current_date
     OR NOT EXISTS (
       SELECT 1 FROM public.commune_members m
       WHERE m.commune_id = v_commune_id AND m.user_id = v_recipient AND m.active
     ) THEN
    RAISE EXCEPTION 'No due amount to remind this member about'
      USING ERRCODE = '22023';
  END IF;

  -- Serialize *all* reminders from this sender. A pair-only lock would let
  -- simultaneous requests to different people pass the sender-wide cap.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'commune-reminder-sender:' || v_sender, 0
  ));
  IF EXISTS (
    SELECT 1 FROM public.reminders r
    WHERE r.kind = p_kind AND r.source_id = p_source_id
      AND r.recipient_user_id = v_recipient
      AND r.created_at > now() - interval '3 days'
  ) THEN
    RAISE EXCEPTION 'A reminder was already sent in the last 3 days'
      USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.reminders r
    WHERE r.sender_user_id = v_sender
      AND r.recipient_user_id = v_recipient
      AND r.created_at > now() - interval '1 day'
  ) THEN
    RAISE EXCEPTION 'This member was already reminded in the last day'
      USING ERRCODE = 'P0001';
  END IF;
  IF (
    SELECT count(*) FROM public.reminders r
    WHERE r.sender_user_id = v_sender
      AND r.recipient_user_id = v_recipient
      AND r.created_at > now() - interval '30 days'
  ) >= 8 THEN
    RAISE EXCEPTION 'You have reached the limit of 8 reminders to this person in 30 days'
      USING ERRCODE = 'P0001';
  END IF;
  IF (
    SELECT count(*) FROM public.reminders r
    WHERE r.sender_user_id = v_sender
      AND r.created_at > now() - interval '30 days'
  ) >= 60 THEN
    RAISE EXCEPTION 'You have reached the limit of 60 reminders in 30 days'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.reminders
    (commune_id, kind, source_id, sender_user_id,
      recipient_user_id, amount_minor)
    VALUES (v_commune_id, p_kind, p_source_id, v_sender,
      v_recipient, v_amount)
    RETURNING id INTO v_reminder_id;
  INSERT INTO public.notifications
    (reminder_id, commune_id, recipient_user_id)
    VALUES (v_reminder_id, v_commune_id, v_recipient);
  INSERT INTO public.reminder_email_outbox (reminder_id, status)
    VALUES (v_reminder_id, CASE WHEN coalesce((
      SELECT p.email_reminders FROM public.notification_preferences p
      WHERE p.user_id = v_recipient
    ), true) THEN 'pending' ELSE 'suppressed' END);
  RETURN v_reminder_id;
END;
$$;


--
-- Name: send_reminder_command(text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.send_reminder_command(p_kind text, p_source_id uuid, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_existing public.reminders%ROWTYPE;
  v_id uuid;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to send a reminder' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'commune-reminder-request:' || v_actor || ':' || p_request_id::text, 0));
  SELECT * INTO v_existing FROM public.reminders
    WHERE sender_user_id = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.kind IS DISTINCT FROM p_kind OR v_existing.source_id IS DISTINCT FROM p_source_id THEN
      RAISE EXCEPTION 'This request was already used for a different reminder' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('id', v_existing.id, 'duplicate', true,
      'emailStatus', commune_private.reminder_email_state(v_existing.id));
  END IF;
  v_id := public.send_reminder(p_kind, p_source_id);
  UPDATE public.reminders SET request_id = p_request_id WHERE id = v_id;
  RETURN jsonb_build_object('id', v_id, 'duplicate', false,
    'emailStatus', commune_private.reminder_email_state(v_id));
END;
$$;


--
-- Name: set_email_reminders(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_email_reminders(p_enabled boolean) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_actor text := commune_private.data_api_user_id();
BEGIN
  IF p_enabled IS NULL THEN
    RAISE EXCEPTION 'Choose whether to get reminder emails' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.notification_preferences (user_id, email_reminders)
    VALUES (v_actor, p_enabled)
  ON CONFLICT (user_id) DO UPDATE
    SET email_reminders = EXCLUDED.email_reminders, updated_at = now();
  RETURN p_enabled;
END;
$$;


--
-- Name: set_fund_archived(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_fund_archived(p_fund_id uuid, p_archived boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_commune uuid;
BEGIN
  PERFORM commune_private.lock_fund_membership(p_fund_id);
  SELECT commune_id INTO v_commune FROM public.funds WHERE id = p_fund_id FOR UPDATE;
  IF NOT public.is_commune_admin(v_commune) THEN RAISE EXCEPTION 'Only an admin can archive a fund' USING ERRCODE = '42501'; END IF;
  IF p_archived IS NULL THEN RAISE EXCEPTION 'Choose archive or restore' USING ERRCODE = '22023'; END IF;
  IF p_archived AND EXISTS (SELECT 1 FROM public.fund_commitments c WHERE c.fund_id = p_fund_id AND c.cancelled_at IS NULL
    AND c.amount_minor > (SELECT coalesce(sum(fc.amount_minor),0) FROM public.fund_contributions fc WHERE fc.commitment_id = c.id AND fc.voided_at IS NULL)) THEN
    RAISE EXCEPTION 'Resolve or cancel outstanding pledges before archiving this fund' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.funds SET archived_at = CASE WHEN p_archived THEN now() ELSE NULL END WHERE id = p_fund_id;
END;
$$;


--
-- Name: set_pay_link(text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_pay_link(p_provider text, p_handle text, p_account_name text, p_sort_code text, p_account_number text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_provider text := lower(btrim(coalesce(p_provider, '')));
  v_handle text := nullif(btrim(coalesce(p_handle, '')), '');
  v_name text := nullif(btrim(coalesce(p_account_name, '')), '');
  v_sort text := nullif(regexp_replace(coalesce(p_sort_code, ''), '[\s-]', '', 'g'), '');
  v_account text := nullif(regexp_replace(coalesce(p_account_number, ''), '\s', '', 'g'), '');
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in to save how people pay you' USING ERRCODE = '42501';
  END IF;
  IF v_provider NOT IN ('monzo', 'paypal', 'revolut', 'bank') THEN
    RAISE EXCEPTION 'Choose Monzo, PayPal, Revolut or bank transfer' USING ERRCODE = '22023';
  END IF;
  IF v_provider = 'bank' THEN
    IF v_name IS NULL OR length(v_name) > 60 THEN
      RAISE EXCEPTION 'Enter the name on the account, up to 60 characters' USING ERRCODE = '22023';
    END IF;
    IF v_sort IS NULL OR v_sort !~ '^[0-9]{6}$' THEN
      RAISE EXCEPTION 'Enter a six-digit sort code, for example 20-45-77' USING ERRCODE = '22023';
    END IF;
    IF v_account IS NULL OR v_account !~ '^[0-9]{8}$' THEN
      RAISE EXCEPTION 'Enter an eight-digit account number' USING ERRCODE = '22023';
    END IF;
    v_handle := NULL;
  ELSE
    -- Accept a pasted link or an @name and keep only the username.
    v_handle := regexp_replace(coalesce(v_handle, ''), '^(https?://)?(www\.)?(monzo\.me|paypal\.me|paypal\.com/paypalme|revolut\.me)/', '', 'i');
    v_handle := regexp_replace(regexp_replace(v_handle, '^@', ''), '/.*$', '');
    IF v_handle !~ '^[A-Za-z0-9._-]{1,40}$' THEN
      RAISE EXCEPTION 'Enter your username: letters, numbers, dots, dashes or underscores, up to 40' USING ERRCODE = '22023';
    END IF;
    v_name := NULL; v_sort := NULL; v_account := NULL;
  END IF;
  INSERT INTO public.member_pay_links (user_id, provider, handle, account_name, sort_code, account_number)
    VALUES (v_actor, v_provider, v_handle, v_name, v_sort, v_account)
    ON CONFLICT (user_id, provider) DO UPDATE SET handle = EXCLUDED.handle, account_name = EXCLUDED.account_name,
      sort_code = EXCLUDED.sort_code, account_number = EXCLUDED.account_number, updated_at = now();
  RETURN commune_private.pay_links_for(v_actor);
END;
$_$;


--
-- Name: set_preferred_pay_link(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_preferred_pay_link(p_provider text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_provider text := nullif(lower(btrim(coalesce(p_provider, ''))), '');
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in to change how people pay you' USING ERRCODE = '42501';
  END IF;
  IF v_provider IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.member_pay_links WHERE user_id = v_actor AND provider = v_provider
  ) THEN
    RAISE EXCEPTION 'Add that way to be paid before making it your favourite' USING ERRCODE = '22023';
  END IF;
  UPDATE public.member_pay_links SET preferred = false
    WHERE user_id = v_actor AND preferred AND provider IS DISTINCT FROM v_provider;
  IF v_provider IS NOT NULL THEN
    UPDATE public.member_pay_links SET preferred = true
      WHERE user_id = v_actor AND provider = v_provider AND NOT preferred;
  END IF;
  RETURN commune_private.pay_links_for(v_actor);
END;
$$;


--
-- Name: set_recurring_bill_archived(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_recurring_bill_archived(p_id uuid, p_archived boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_bill public.recurring_bills%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.communes co JOIN public.recurring_bills b ON b.commune_id = co.id WHERE b.id = p_id FOR UPDATE OF co;
  SELECT * INTO v_bill FROM public.recurring_bills WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_commune_member(v_bill.commune_id)
     OR (v_actor IS DISTINCT FROM v_bill.created_by AND v_actor IS DISTINCT FROM v_bill.paid_by_user_id
       AND NOT public.is_commune_admin(v_bill.commune_id)) THEN
    RAISE EXCEPTION 'Only the person who added this bill, its payer or an admin can archive or restore it' USING ERRCODE = '42501';
  END IF;
  IF p_archived IS NULL THEN
    RAISE EXCEPTION 'Choose archive or restore' USING ERRCODE = '22023';
  END IF;
  IF (v_bill.archived_at IS NOT NULL) = p_archived THEN
    RETURN commune_private.recurring_bill_result(p_id, true);
  END IF;
  PERFORM set_config('commune.occurrence_event', 'on', true);
  UPDATE public.recurring_bills SET archived_at = CASE WHEN p_archived THEN now() END,
      paused = paused OR p_archived, updated_at = now()
    WHERE id = p_id;
  PERFORM set_config('commune.occurrence_event', 'off', true);
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description, details)
    VALUES (v_bill.commune_id, v_actor, 'recurring', p_id, v_bill.title, CASE WHEN p_archived THEN 'Archived' ELSE 'Restored, still paused' END,
      jsonb_build_object('before', jsonb_build_object('paused', v_bill.paused, 'archived', v_bill.archived_at IS NOT NULL),
        'after', jsonb_build_object('paused', v_bill.paused OR p_archived, 'archived', p_archived)));
  RETURN commune_private.recurring_bill_result(p_id, false);
END;
$$;


--
-- Name: set_recurring_bill_paused(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_recurring_bill_paused(p_id uuid, p_paused boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_bill public.recurring_bills%ROWTYPE;
  v_left text[];
BEGIN
  PERFORM 1 FROM public.communes co JOIN public.recurring_bills b ON b.commune_id = co.id WHERE b.id = p_id FOR UPDATE OF co;
  SELECT * INTO v_bill FROM public.recurring_bills WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_commune_member(v_bill.commune_id)
     OR (v_actor IS DISTINCT FROM v_bill.created_by AND v_actor IS DISTINCT FROM v_bill.paid_by_user_id
       AND NOT public.is_commune_admin(v_bill.commune_id)) THEN
    RAISE EXCEPTION 'Only the person who added this bill, its payer or an admin can pause or resume it' USING ERRCODE = '42501';
  END IF;
  IF p_paused IS NULL THEN
    RAISE EXCEPTION 'Choose pause or resume' USING ERRCODE = '22023';
  END IF;
  IF v_bill.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This bill is archived. Restore it first.' USING ERRCODE = 'P0001';
  END IF;
  IF v_bill.paused = p_paused THEN
    RETURN commune_private.recurring_bill_result(p_id, true);
  END IF;
  IF NOT p_paused THEN
    v_left := commune_private.recurring_departed_names(v_bill.commune_id, v_bill.paid_by_user_id, v_bill.shares);
    IF cardinality(v_left) > 0 THEN
      RAISE EXCEPTION '% % left the commune. Update the payer and split before resuming this bill.',
        CASE WHEN cardinality(v_left) = 1 THEN v_left[1]
          ELSE array_to_string(v_left[1:cardinality(v_left) - 1], ', ') || ' and ' || v_left[cardinality(v_left)] END,
        CASE WHEN cardinality(v_left) = 1 THEN 'has' ELSE 'have' END USING ERRCODE = 'P0001';
    END IF;
  END IF;
  -- This command writes its own history line instead of a generic "Updated".
  PERFORM set_config('commune.occurrence_event', 'on', true);
  UPDATE public.recurring_bills SET paused = p_paused, updated_at = now() WHERE id = p_id;
  PERFORM set_config('commune.occurrence_event', 'off', true);
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description, details)
    VALUES (v_bill.commune_id, v_actor, 'recurring', p_id, v_bill.title, CASE WHEN p_paused THEN 'Paused' ELSE 'Resumed' END,
      jsonb_build_object('before', jsonb_build_object('paused', v_bill.paused), 'after', jsonb_build_object('paused', p_paused)));
  RETURN commune_private.recurring_bill_result(p_id, false);
END;
$$;


--
-- Name: skip_recurring_period(uuid, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.skip_recurring_period(p_id uuid, p_expected_due_on date, p_reason text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_bill public.recurring_bills%ROWTYPE;
  v_done public.recurring_bill_occurrences%ROWTYPE;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_opens date;
BEGIN
  PERFORM 1 FROM public.communes co JOIN public.recurring_bills b ON b.commune_id = co.id WHERE b.id = p_id FOR UPDATE OF co;
  SELECT * INTO v_bill FROM public.recurring_bills WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_commune_member(v_bill.commune_id) OR
     (v_bill.paid_by_user_id <> v_actor AND NOT public.is_commune_admin(v_bill.commune_id)) THEN
    RAISE EXCEPTION 'Only the payer or an admin can skip this bill' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_done FROM public.recurring_bill_occurrences WHERE bill_id = p_id AND due_on = p_expected_due_on;
  IF FOUND THEN
    IF v_done.status = 'skipped' THEN
      RETURN commune_private.recurring_period_result(p_id, p_expected_due_on, true);
    END IF;
    RAISE EXCEPTION 'This period was already recorded. Void its expense instead if it was a mistake.' USING ERRCODE = 'P0001';
  END IF;
  IF v_bill.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'This bill is archived. Restore and resume it before skipping a period.' USING ERRCODE = 'P0001';
  END IF;
  IF v_bill.next_due_on IS DISTINCT FROM p_expected_due_on OR v_bill.paused THEN
    RAISE EXCEPTION 'This period has moved on or the bill is paused. Refresh the schedule.' USING ERRCODE = 'P0001';
  END IF;
  v_opens := CASE v_bill.frequency WHEN 'weekly' THEN v_bill.next_due_on - 7
    ELSE (v_bill.next_due_on - interval '1 month')::date END;
  IF v_opens > current_date + 1 THEN
    RAISE EXCEPTION 'It is too early to skip the % period. You can skip it from %.',
      to_char(v_bill.next_due_on, 'FMDD Mon YYYY'), to_char(v_opens, 'FMDD Mon YYYY') USING ERRCODE = 'P0001';
  END IF;
  IF length(v_reason) NOT BETWEEN 3 AND 240 THEN
    RAISE EXCEPTION 'Say why this period is skipped (3 to 240 characters)' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.recurring_bill_occurrences o
      WHERE o.bill_id = p_id AND o.status = 'skipped' AND o.acted_at > now() - interval '1 day') >= 12 THEN
    RAISE EXCEPTION 'This bill has had 12 periods skipped in the last day. To move it on further, edit its next due date.'
      USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.recurring_bill_occurrences (bill_id, due_on, expense_id, status, actor_id, acted_at, note)
    VALUES (p_id, v_bill.next_due_on, NULL, 'skipped', v_actor, clock_timestamp(), v_reason);
  PERFORM set_config('commune.occurrence_event', 'on', true);
  UPDATE public.recurring_bills SET next_due_on = commune_private.recurring_next_due(frequency, next_due_on, anchor_day), updated_at = now()
    WHERE id = p_id;
  PERFORM set_config('commune.occurrence_event', 'off', true);
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_bill.commune_id, v_actor, 'recurring', p_id, v_bill.title,
      left('Skipped ' || to_char(v_bill.next_due_on, 'FMDD Mon') || ': ' || v_reason, 240));
  RETURN commune_private.recurring_period_result(p_id, p_expected_due_on, false);
END;
$$;


--
-- Name: undo_operation_occurrence(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.undo_operation_occurrence(p_occurrence_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_commune_id uuid;
  v_op public.commune_operations%ROWTYPE;
  v_occurrence public.operation_occurrences%ROWTYPE;
BEGIN
  -- The commune first, then the task, then the occurrence, as in
  -- update_operation.
  SELECT o.commune_id INTO v_commune_id FROM public.commune_operations o
    JOIN public.operation_occurrences h ON h.operation_id = o.id WHERE h.id = p_occurrence_id;
  PERFORM 1 FROM public.communes WHERE id = v_commune_id FOR UPDATE;
  SELECT o.* INTO v_op FROM public.commune_operations o
    JOIN public.operation_occurrences h ON h.operation_id = o.id WHERE h.id = p_occurrence_id FOR UPDATE OF o;
  SELECT * INTO v_occurrence FROM public.operation_occurrences WHERE id = p_occurrence_id FOR UPDATE;
  IF v_op.id IS NULL OR v_occurrence.id IS NULL OR NOT public.is_commune_member(v_op.commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  IF v_occurrence.undone_at IS NOT NULL THEN
    RETURN commune_private.occurrence_result(v_occurrence.id, true, v_op.id);
  END IF;
  IF v_op.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This task has been removed' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.operation_occurrences later WHERE later.operation_id = v_op.id
      AND later.undone_at IS NULL AND later.id <> v_occurrence.id AND later.acted_at >= v_occurrence.acted_at)
     OR v_op.date <> v_occurrence.next_date
     OR v_op.assignee_id IS DISTINCT FROM v_occurrence.next_assignee_id
     OR (v_op.assignee_id IS NULL AND v_op.assignee IS DISTINCT FROM v_occurrence.next_assignee)
     OR v_op.turn_owner_id IS DISTINCT FROM v_occurrence.next_turn_owner_id
     OR v_op.status <> v_occurrence.next_status OR v_op.last_done IS DISTINCT FROM v_occurrence.next_last_done THEN
    RAISE EXCEPTION 'This task has changed since then, so it can no longer be undone. Edit the task instead.' USING ERRCODE = 'P0001';
  END IF;
  -- Someone being handed back a task must still be a member.
  IF v_occurrence.prev_assignee_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.commune_members m
      WHERE m.commune_id = v_op.commune_id AND m.user_id = v_occurrence.prev_assignee_id AND m.active) THEN
    RAISE EXCEPTION 'The person who had this task has left, so it can no longer be undone. Edit the task instead.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('commune.occurrence_event', 'on', true);
  UPDATE public.commune_operations SET date = v_occurrence.prev_date, assignee = v_occurrence.prev_assignee,
    assignee_id = v_occurrence.prev_assignee_id, turn_owner_id = v_occurrence.prev_turn_owner_id,
    status = v_occurrence.prev_status, last_done = v_occurrence.prev_last_done, updated_at = now() WHERE id = v_op.id;
  PERFORM set_config('commune.occurrence_event', 'off', true);
  UPDATE public.operation_occurrences SET undone_at = now(), undone_by = v_actor WHERE id = v_occurrence.id;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_op.commune_id, v_actor, 'operations', v_op.id, v_op.title,
      CASE v_occurrence.action WHEN 'completed' THEN 'Completion undone' WHEN 'skipped' THEN 'Skip undone'
        WHEN 'handed_over' THEN 'Handover undone' ELSE 'Reopening undone' END);
  RETURN commune_private.occurrence_result(v_occurrence.id, false, v_op.id);
END;
$$;


--
-- Name: update_commune_details(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_commune_details(p_commune_id uuid, p_name text, p_kind text, p_currency text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_currency text;
BEGIN
  IF NOT public.is_commune_admin(p_commune_id) THEN
    RAISE EXCEPTION 'Only a commune admin can change its settings'
      USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_name, ''))) NOT BETWEEN 1 AND 48
     OR p_kind NOT IN ('household', 'workspace', 'trip')
     OR p_currency NOT IN ('GBP', 'USD', 'EUR') THEN
    RAISE EXCEPTION 'Invalid commune details' USING ERRCODE = '22023';
  END IF;

  SELECT currency INTO v_currency FROM public.communes
    WHERE id = p_commune_id FOR UPDATE;
  IF v_currency IS NULL THEN
    RAISE EXCEPTION 'Commune not found' USING ERRCODE = '22023';
  END IF;
  IF btrim(p_name) IS DISTINCT FROM (SELECT c.name FROM public.communes c WHERE c.id = p_commune_id)
     AND commune_private.looks_like_contact(p_name) THEN
    RAISE EXCEPTION 'Commune names can''t include links, email addresses or phone numbers.'
      USING ERRCODE = '22023';
  END IF;
  IF p_currency <> v_currency AND cardinality(commune_private.currency_locked_by(p_commune_id)) > 0 THEN
    RAISE EXCEPTION 'The currency cannot change once this commune has an expense, fund, recurring bill or exact split template, even a voided or archived one'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.communes
    SET name = btrim(p_name), kind = p_kind, currency = p_currency,
      address = CASE WHEN p_kind = 'trip' THEN '' ELSE address END,
      destination = CASE WHEN p_kind = 'trip' THEN destination ELSE '' END,
      stay_name = CASE WHEN p_kind = 'trip' THEN stay_name ELSE '' END,
      stay_address = CASE WHEN p_kind = 'trip' THEN stay_address ELSE '' END
    WHERE id = p_commune_id;
END;
$$;


--
-- Name: update_commune_location(uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_commune_location(p_commune_id uuid, p_address text DEFAULT NULL::text, p_destination text DEFAULT NULL::text, p_stay_name text DEFAULT NULL::text, p_stay_address text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_kind text;
  v_address text;
  v_destination text;
  v_stay_name text;
  v_stay_address text;
BEGIN
  IF NOT public.is_commune_admin(p_commune_id) THEN
    RAISE EXCEPTION 'Only a commune admin can change its location'
      USING ERRCODE = '42501';
  END IF;

  SELECT kind, address, destination, stay_name, stay_address
    INTO v_kind, v_address, v_destination, v_stay_name, v_stay_address
    FROM public.communes WHERE id = p_commune_id FOR UPDATE;
  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'Commune not found' USING ERRCODE = '22023';
  END IF;
  v_address := btrim(coalesce(p_address, v_address));
  v_destination := btrim(coalesce(p_destination, v_destination));
  v_stay_name := btrim(coalesce(p_stay_name, v_stay_name));
  v_stay_address := btrim(coalesce(p_stay_address, v_stay_address));

  IF length(v_address) > 160 OR length(v_destination) > 80
     OR length(v_stay_name) > 80 OR length(v_stay_address) > 160
     OR (v_kind = 'trip' AND v_address <> '')
     OR (v_kind <> 'trip' AND
       (v_destination <> '' OR v_stay_name <> '' OR v_stay_address <> '')) THEN
    RAISE EXCEPTION 'Invalid commune location' USING ERRCODE = '22023';
  END IF;

  UPDATE public.communes SET address = v_address,
    destination = v_destination, stay_name = v_stay_name,
    stay_address = v_stay_address WHERE id = p_commune_id;
END;
$$;


--
-- Name: update_commune_with_location(uuid, text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_commune_with_location(p_commune_id uuid, p_name text, p_kind text, p_currency text, p_address text, p_destination text, p_stay_name text, p_stay_address text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  PERFORM public.update_commune_details(
    p_commune_id, p_name, p_kind, p_currency
  );
  PERFORM public.update_commune_location(
    p_commune_id, p_address, p_destination, p_stay_name, p_stay_address
  );
END;
$$;


--
-- Name: update_fund(uuid, text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_fund(p_fund_id uuid, p_name text, p_target_minor bigint DEFAULT NULL::bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_commune uuid;
BEGIN
  PERFORM commune_private.lock_fund_membership(p_fund_id);
  SELECT commune_id INTO v_commune FROM public.funds WHERE id = p_fund_id FOR UPDATE;
  IF NOT public.is_commune_admin(v_commune) THEN RAISE EXCEPTION 'Only an admin can edit a fund' USING ERRCODE = '42501'; END IF;
  IF length(btrim(coalesce(p_name, ''))) NOT BETWEEN 1 AND 80 OR (p_target_minor IS NOT NULL AND p_target_minor NOT BETWEEN 1 AND 1000000000000) THEN
    RAISE EXCEPTION 'Invalid fund details' USING ERRCODE = '22023'; END IF;
  UPDATE public.funds SET name = btrim(p_name), target_minor = p_target_minor WHERE id = p_fund_id;
END;
$$;


--
-- Name: update_fund_pledge(uuid, bigint, date, boolean, bigint, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_fund_pledge(p_commitment_id uuid, p_amount_minor bigint, p_due_on date, p_cancel boolean DEFAULT false, p_expected_amount_minor bigint DEFAULT NULL::bigint, p_expected_due_on date DEFAULT NULL::date) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_row public.fund_commitments%ROWTYPE; v_commune uuid; v_archived timestamptz; v_paid bigint;
  v_currency text; v_changes text[] := ARRAY[]::text[];
BEGIN
  -- Match fund -> pledge lock order used by pledge/archive/contribution.
  PERFORM commune_private.lock_fund_membership((SELECT fund_id FROM public.fund_commitments WHERE id=p_commitment_id));
  SELECT f.commune_id, f.archived_at INTO v_commune, v_archived FROM public.funds f
    JOIN public.fund_commitments c ON c.fund_id = f.id WHERE c.id = p_commitment_id FOR UPDATE OF f;
  SELECT * INTO v_row FROM public.fund_commitments WHERE id = p_commitment_id FOR UPDATE;
  IF v_row.id IS NULL OR NOT public.is_commune_member(v_commune) OR
    (v_row.user_id <> v_actor AND NOT public.is_commune_admin(v_commune)) THEN
    RAISE EXCEPTION 'Only the pledger or an admin can change this pledge' USING ERRCODE = '42501'; END IF;
  IF (p_expected_amount_minor IS NOT NULL AND p_expected_amount_minor IS DISTINCT FROM v_row.amount_minor)
     OR (p_expected_due_on IS NOT NULL AND p_expected_due_on IS DISTINCT FROM v_row.due_on)
     OR (p_cancel IS NOT TRUE AND v_row.cancelled_at IS NOT NULL
       AND (p_expected_amount_minor IS NOT NULL OR p_expected_due_on IS NOT NULL)) THEN
    RAISE EXCEPTION 'This pledge changed while you were editing. Nothing was saved. Check it again.' USING ERRCODE = 'P0001';
  END IF;
  SELECT coalesce(sum(amount_minor),0) INTO v_paid FROM public.fund_contributions WHERE commitment_id = p_commitment_id AND voided_at IS NULL;
  IF p_cancel IS TRUE THEN
    IF v_paid > 0 THEN RAISE EXCEPTION 'A contributed pledge cannot be cancelled; change its total or correct the contribution first' USING ERRCODE = 'P0001'; END IF;
    -- Cancelling again (a retry, a second tab) changes nothing and tells no one twice.
    IF v_row.cancelled_at IS NOT NULL THEN RETURN; END IF;
    UPDATE public.fund_commitments SET cancelled_at = now() WHERE id = p_commitment_id;
    PERFORM commune_private.notify_pledge(v_commune, v_row.user_id, 'pledge_cancelled', p_commitment_id, v_actor, v_row.amount_minor, NULL);
  ELSE
    IF v_archived IS NOT NULL OR v_row.cancelled_at IS NOT NULL OR p_amount_minor IS NULL OR p_amount_minor NOT BETWEEN 1 AND 1000000000000 OR p_amount_minor < v_paid OR p_due_on IS NULL THEN
      RAISE EXCEPTION 'Pledge must cover recorded contributions and belong to an active fund' USING ERRCODE = '22023'; END IF;
    IF v_row.user_id <> v_actor AND (p_amount_minor > v_row.amount_minor OR p_due_on < v_row.due_on) THEN
      RAISE EXCEPTION 'Only the person who made this pledge can raise it or bring its due date forward' USING ERRCODE = '42501'; END IF;
    UPDATE public.fund_commitments SET amount_minor = p_amount_minor, due_on = p_due_on WHERE id = p_commitment_id;
    IF v_row.user_id <> v_actor THEN
      SELECT currency INTO v_currency FROM public.communes WHERE id = v_commune;
      IF p_amount_minor <> v_row.amount_minor THEN
        v_changes := v_changes || format('Lowered from %s to %s.', commune_private.format_money(v_row.amount_minor, v_currency),
          commune_private.format_money(p_amount_minor, v_currency));
      END IF;
      IF p_due_on <> v_row.due_on THEN
        v_changes := v_changes || format('Due date moved from %s to %s.', to_char(v_row.due_on, 'FMDD Mon YYYY'),
          to_char(p_due_on, 'FMDD Mon YYYY'));
      END IF;
      IF cardinality(v_changes) > 0 THEN
        PERFORM commune_private.notify_pledge(v_commune, v_row.user_id, 'pledge_changed', p_commitment_id, v_actor,
          p_amount_minor, array_to_string(v_changes, ' '));
      END IF;
    END IF;
  END IF;
END;
$$;


--
-- Name: update_note(uuid, integer, text, text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_note(p_note_id uuid, p_expected_version integer, p_title text, p_pill text, p_kicker text, p_lede text, p_body text, p_facts jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_note public.commune_notes%ROWTYPE;
  v_card jsonb;
  v_new public.commune_notes%ROWTYPE;
  v_version integer;
BEGIN
  SELECT * INTO v_note FROM public.commune_notes WHERE id = p_note_id FOR UPDATE;
  IF v_note.id IS NULL OR NOT public.is_commune_member(v_note.commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  IF p_expected_version IS NULL THEN
    RAISE EXCEPTION 'Say which version of the note this change is based on' USING ERRCODE = '22023';
  END IF;
  v_card := commune_private.note_content(p_title, p_pill, p_kicker, p_lede, p_body, p_facts);
  IF v_note.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This note has been removed' USING ERRCODE = 'P0001';
  END IF;
  -- Saving what is already there changes nothing. A retry of a save that
  -- went through is then not mistaken for someone else's change.
  IF v_card = jsonb_build_object('title', v_note.title, 'pill', v_note.pill, 'kicker', v_note.kicker,
      'lede', v_note.lede, 'body', v_note.body, 'facts', v_note.facts) THEN
    RETURN jsonb_build_object('id', v_note.id, 'version', v_note.version, 'duplicate', true);
  END IF;
  IF p_expected_version <> v_note.version THEN
    RAISE EXCEPTION 'This note was changed by someone else. Review the latest version before saving your changes.'
      USING ERRCODE = 'P0001';
  END IF;
  v_new := jsonb_populate_record(NULL::public.commune_notes, v_card);
  UPDATE public.commune_notes SET title = v_new.title, pill = v_new.pill, kicker = v_new.kicker, lede = v_new.lede,
      body = v_new.body, facts = v_new.facts
    WHERE id = p_note_id RETURNING version INTO v_version;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_note.commune_id, v_actor, 'notes', v_note.id, v_new.title, 'Updated');
  RETURN jsonb_build_object('id', v_note.id, 'version', v_version, 'duplicate', false);
END;
$$;


--
-- Name: update_operation(uuid, integer, text, text, text, date, time without time zone, boolean, text, jsonb, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_operation(p_operation_id uuid, p_expected_version integer, p_kind text, p_category text, p_title text, p_date date, p_time time without time zone, p_all_day boolean, p_assignee_id text, p_rotation_ids jsonb, p_repeat text, p_notes text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_commune_id uuid;
  v_op public.commune_operations%ROWTYPE;
  v_item jsonb;
  v_new public.commune_operations%ROWTYPE;
  v_version integer;
BEGIN
  -- The commune first, then the task: the order a member leaving takes them
  -- in (manage_commune_member, then reassign_departed_member). The other
  -- order lets the two wait on each other until one fails as a deadlock.
  SELECT commune_id INTO v_commune_id FROM public.commune_operations WHERE id = p_operation_id;
  PERFORM 1 FROM public.communes WHERE id = v_commune_id FOR UPDATE;
  SELECT * INTO v_op FROM public.commune_operations WHERE id = p_operation_id FOR UPDATE;
  IF v_op.id IS NULL OR NOT public.is_commune_member(v_op.commune_id) THEN
    RAISE EXCEPTION 'Not a commune member' USING ERRCODE = '42501';
  END IF;
  IF p_expected_version IS NULL THEN
    RAISE EXCEPTION 'Say which version of the task this change is based on' USING ERRCODE = '22023';
  END IF;
  v_item := commune_private.operation_content(p_kind, p_category, p_title, p_date, p_time, p_all_day,
    p_assignee_id, p_rotation_ids, p_repeat, p_notes);
  IF v_op.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This % has been removed', v_op.kind USING ERRCODE = 'P0001';
  END IF;
  -- Saving what is already there changes nothing, so a retry of a save that
  -- went through is not mistaken for someone else's change. A name kept from
  -- before member ids (0020) is cleared by any save.
  IF v_item = jsonb_build_object('kind', v_op.kind, 'category', v_op.category, 'title', v_op.title, 'date', v_op.date,
      'time', v_op.time, 'all_day', v_op.all_day, 'assignee_id', v_op.assignee_id, 'rotation_ids', v_op.rotation_ids,
      'repeat', v_op.repeat, 'notes', v_op.notes)
     AND (v_op.assignee_id IS NOT NULL OR v_op.assignee IS NULL)
     AND (v_op.rotation_ids IS NOT NULL OR v_op.rotation IS NULL) THEN
    RETURN jsonb_build_object('id', v_op.id, 'version', v_op.version, 'duplicate', true);
  END IF;
  IF p_expected_version <> v_op.version THEN
    RAISE EXCEPTION 'This % was changed by someone else. Review the latest version before saving your changes.', v_op.kind
      USING ERRCODE = 'P0001';
  END IF;
  v_new := jsonb_populate_record(NULL::public.commune_operations, v_item);
  -- The operation_people trigger checks the people, copies their names and
  -- ends a cover when they change; operation_anchor resets the monthly day.
  UPDATE public.commune_operations SET kind = v_new.kind, category = v_new.category, title = v_new.title,
      date = v_new.date, time = v_new.time, all_day = v_new.all_day,
      assignee = NULL, assignee_id = v_new.assignee_id, rotation = NULL, rotation_ids = v_new.rotation_ids,
      repeat = v_new.repeat, notes = v_new.notes, updated_at = now()
    WHERE id = p_operation_id RETURNING version INTO v_version;
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description)
    VALUES (v_op.commune_id, v_actor, 'operations', v_op.id, v_new.title, 'Updated');
  RETURN jsonb_build_object('id', v_op.id, 'version', v_version, 'duplicate', false);
END;
$$;


--
-- Name: valid_note_facts(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valid_note_facts(p_facts jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  v_fact jsonb;
  v_part jsonb;
BEGIN
  IF p_facts IS NULL OR jsonb_typeof(p_facts) <> 'array' THEN
    RETURN false;
  END IF;
  IF jsonb_array_length(p_facts) > 30 THEN
    RETURN false;
  END IF;
  FOR v_fact IN SELECT value FROM jsonb_array_elements(p_facts) LOOP
    IF jsonb_typeof(v_fact) <> 'array' THEN
      RETURN false;
    END IF;
    IF jsonb_array_length(v_fact) <> 2 THEN
      RETURN false;
    END IF;
    FOR v_part IN SELECT value FROM jsonb_array_elements(v_fact) LOOP
      IF jsonb_typeof(v_part) <> 'string'
         OR length(v_part #>> '{}') > 120 THEN
        RETURN false;
      END IF;
    END LOOP;
  END LOOP;
  RETURN true;
END;
$$;


--
-- Name: valid_operation_last_done(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valid_operation_last_done(p_last_done jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
    SET search_path TO 'pg_catalog'
    AS $_$
DECLARE
  v_date text;
  v_year integer;
  v_month integer;
  v_day integer;
  v_days_in_month integer;
BEGIN
  IF p_last_done IS NULL THEN
    RETURN true;
  END IF;
  IF jsonb_typeof(p_last_done) <> 'object'
     OR jsonb_typeof(p_last_done->'by') IS DISTINCT FROM 'string'
     OR jsonb_typeof(p_last_done->'date') IS DISTINCT FROM 'string'
     OR length(btrim(p_last_done->>'by')) NOT BETWEEN 1 AND 80 THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_last_done) AS field(key)
    WHERE field.key NOT IN ('by', 'date', 'markedBy', 'covering')
  ) THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(p_last_done) AS field(key, value)
    WHERE field.key IN ('markedBy', 'covering')
      AND (jsonb_typeof(field.value) <> 'string' OR length(btrim(field.value #>> '{}')) NOT BETWEEN 1 AND 80)
  ) THEN
    RETURN false;
  END IF;
  v_date := p_last_done->>'date';
  IF v_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RETURN false;
  END IF;
  v_year := substring(v_date, 1, 4)::integer;
  v_month := substring(v_date, 6, 2)::integer;
  v_day := substring(v_date, 9, 2)::integer;
  IF v_year = 0 OR v_month NOT BETWEEN 1 AND 12 OR v_day < 1 THEN
    RETURN false;
  END IF;
  v_days_in_month := CASE
    WHEN v_month IN (4, 6, 9, 11) THEN 30
    WHEN v_month = 2 THEN CASE
      WHEN mod(v_year, 400) = 0 OR
        (mod(v_year, 4) = 0 AND mod(v_year, 100) <> 0) THEN 29
      ELSE 28 END
    ELSE 31 END;
  RETURN v_day <= v_days_in_month;
END;
$_$;


--
-- Name: valid_operation_member_ids(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valid_operation_member_ids(p_ids jsonb) RETURNS boolean
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO 'pg_catalog'
    AS $$
  SELECT p_ids IS NULL OR (jsonb_typeof(p_ids) = 'array' AND jsonb_array_length(p_ids) BETWEEN 1 AND 50
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_ids) e
      WHERE jsonb_typeof(e.value) <> 'string' OR length(e.value #>> '{}') NOT BETWEEN 1 AND 128)
    AND (SELECT count(DISTINCT e.value) FROM jsonb_array_elements(p_ids) e) = jsonb_array_length(p_ids));
$$;


--
-- Name: valid_operation_rotation(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valid_operation_rotation(p_rotation jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  v_member jsonb;
BEGIN
  IF p_rotation IS NULL THEN
    RETURN true;
  END IF;
  IF jsonb_typeof(p_rotation) <> 'array' THEN
    RETURN false;
  END IF;
  IF jsonb_array_length(p_rotation) > 50 THEN
    RETURN false;
  END IF;
  FOR v_member IN SELECT value FROM jsonb_array_elements(p_rotation) LOOP
    IF jsonb_typeof(v_member) <> 'string'
       OR length(v_member #>> '{}') > 80 THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;


--
-- Name: void_expense(uuid, integer, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.void_expense(p_expense_id uuid, p_expected_version integer, p_reason text, p_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_expense public.expenses%ROWTYPE;
  v_replay public.expense_revisions%ROWTYPE;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_before jsonb; v_member record;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'A request id is required to void an expense' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.communes co JOIN public.expenses e ON e.commune_id = co.id
    WHERE e.id = p_expense_id FOR UPDATE OF co;
  SELECT * INTO v_expense FROM public.expenses WHERE id = p_expense_id FOR UPDATE;
  IF v_expense.id IS NULL OR NOT public.is_commune_member(v_expense.commune_id)
     OR (v_actor IS DISTINCT FROM v_expense.paid_by_user_id AND NOT public.is_commune_admin(v_expense.commune_id)) THEN
    RAISE EXCEPTION 'Only the bill payer or an admin can void this expense' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_replay FROM public.expense_revisions WHERE actor_id = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    IF v_replay.expense_id <> p_expense_id OR v_replay.action <> 'voided' OR v_replay.reason <> v_reason THEN
      RAISE EXCEPTION 'This request was already used for a different change' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('version', v_replay.version, 'duplicate', true);
  END IF;
  IF v_expense.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'This expense was already voided' USING ERRCODE = 'P0001';
  END IF;
  IF p_expected_version IS DISTINCT FROM v_expense.version THEN
    RAISE EXCEPTION 'This expense was changed by someone else. Review the latest version before voiding it.' USING ERRCODE = 'P0001';
  END IF;
  IF length(v_reason) NOT BETWEEN 3 AND 240 THEN
    RAISE EXCEPTION 'Give a reason for voiding this expense (3 to 240 characters)' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.expense_share_receipts r JOIN public.expense_shares s ON s.id = r.share_id
    WHERE s.expense_id = p_expense_id AND r.reversed_at IS NULL
      AND EXISTS (SELECT 1 FROM public.commune_members m WHERE m.commune_id = v_expense.commune_id AND m.user_id = s.user_id AND m.active)
      AND EXISTS (SELECT 1 FROM public.commune_members m WHERE m.commune_id = v_expense.commune_id AND m.user_id = v_expense.paid_by_user_id AND m.active)) THEN
    RAISE EXCEPTION 'Repayments are recorded on this expense. The bill payer needs to reverse them before it can be voided.' USING ERRCODE = 'P0001';
  END IF;
  -- send_reminder holds a share's row lock while it works. Taking the same
  -- locks here means a reminder either finished before this void (and its
  -- queued email is suppressed below) or waits and then sees the void.
  PERFORM 1 FROM public.expense_shares WHERE expense_id = p_expense_id ORDER BY id FOR UPDATE;
  -- Repayments that can no longer be reversed are closed with the void, so
  -- the record stays explained. No debt reopens: a voided bill never counts.
  UPDATE public.expense_share_receipts r SET reversed_at = now(), reversed_by = v_actor,
      reversal_reason = left('Expense voided: ' || v_reason, 240)
    FROM public.expense_shares s
    WHERE s.id = r.share_id AND s.expense_id = p_expense_id AND r.reversed_at IS NULL;
  PERFORM commune_private.project_share_settlement(s.id) FROM public.expense_shares s
    WHERE s.expense_id = p_expense_id AND s.user_id <> v_expense.paid_by_user_id;
  v_before := commune_private.expense_state(p_expense_id);
  UPDATE public.expenses SET voided_at = now(), voided_by = v_actor, void_reason = v_reason,
      version = version + 1, updated_at = now() WHERE id = p_expense_id;
  INSERT INTO public.expense_revisions (expense_id, version, action, actor_id, reason, before, after, request_id)
    VALUES (p_expense_id, v_expense.version + 1, 'voided', v_actor, v_reason, v_before,
      v_before || jsonb_build_object('voided', true), p_request_id);
  INSERT INTO public.commune_events (commune_id, actor_id, kind, entity_id, title, description, details)
    VALUES (v_expense.commune_id, v_actor, 'expenses', p_expense_id, v_expense.title, 'Expense voided',
      jsonb_build_object('version', v_expense.version + 1, 'reason', v_reason, 'before', v_before));
  -- A queued reminder email about a voided bill must not go out later.
  UPDATE public.reminder_email_outbox q SET status = 'suppressed', updated_at = now()
    FROM public.reminders r JOIN public.expense_shares s ON s.id = r.source_id
    WHERE q.reminder_id = r.id AND r.kind = 'nudge' AND s.expense_id = p_expense_id AND q.status IN ('pending', 'failed');
  FOR v_member IN
    SELECT s.user_id, s.amount_minor FROM public.expense_shares s WHERE s.expense_id = p_expense_id
    UNION SELECT v_expense.paid_by_user_id, NULL::bigint
      WHERE NOT EXISTS (SELECT 1 FROM public.expense_shares s WHERE s.expense_id = p_expense_id AND s.user_id = v_expense.paid_by_user_id)
  LOOP
    PERFORM commune_private.notify_ledger(v_expense.commune_id, v_member.user_id, 'expense_voided',
      p_expense_id, v_actor, v_member.amount_minor, v_reason);
  END LOOP;
  RETURN jsonb_build_object('version', v_expense.version + 1, 'duplicate', false);
END;
$$;


--
-- Name: void_fund_contribution(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.void_fund_contribution(p_contribution_id uuid, p_reason text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE v_commune uuid; v_commitment uuid; v_archived timestamptz;
BEGIN
  PERFORM commune_private.lock_fund_membership((SELECT c.fund_id FROM public.fund_contributions fc JOIN public.fund_commitments c ON c.id=fc.commitment_id WHERE fc.id=p_contribution_id));
  SELECT f.commune_id,fc.commitment_id,f.archived_at INTO v_commune,v_commitment,v_archived FROM public.fund_contributions fc
    JOIN public.fund_commitments c ON c.id=fc.commitment_id JOIN public.funds f ON f.id=c.fund_id WHERE fc.id=p_contribution_id FOR UPDATE OF f;
  IF NOT public.is_commune_admin(v_commune) THEN RAISE EXCEPTION 'Only an admin can correct a contribution' USING ERRCODE = '42501'; END IF;
  IF v_archived IS NOT NULL OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 240 THEN
    RAISE EXCEPTION 'Restore the fund and enter a correction reason (3 to 240 characters)' USING ERRCODE = '22023'; END IF;
  PERFORM 1 FROM public.fund_commitments WHERE id=v_commitment FOR UPDATE;
  -- A new debt cannot be reintroduced after the member has left.
  IF NOT EXISTS (SELECT 1 FROM public.fund_commitments c JOIN public.commune_members m ON m.user_id=c.user_id
    WHERE c.id=v_commitment AND m.commune_id=v_commune AND m.active) THEN
    RAISE EXCEPTION 'Cannot reopen an obligation for a former member' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.fund_contributions SET voided_at=now(), voided_by=commune_private.data_api_user_id(),void_reason=btrim(p_reason)
    WHERE id=p_contribution_id AND voided_at IS NULL;
END;
$$;


--
-- Name: withdraw_share_payment_report(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.withdraw_share_payment_report(p_report_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_actor text := commune_private.data_api_user_id();
  v_report public.expense_share_payment_reports%ROWTYPE;
  v_commune uuid;
BEGIN
  SELECT e.commune_id INTO v_commune FROM public.expense_share_payment_reports r
    JOIN public.expense_shares s ON s.id = r.share_id JOIN public.expenses e ON e.id = s.expense_id WHERE r.id = p_report_id;
  PERFORM 1 FROM public.communes WHERE id = v_commune FOR UPDATE;
  SELECT * INTO v_report FROM public.expense_share_payment_reports WHERE id = p_report_id FOR UPDATE;
  IF v_report.id IS NULL OR NOT public.is_commune_member(v_commune) OR v_actor IS DISTINCT FROM v_report.reported_by THEN
    RAISE EXCEPTION 'Only the member who reported this payment can withdraw it' USING ERRCODE = '42501';
  END IF;
  IF v_report.status = 'withdrawn' THEN
    RETURN commune_private.payment_report_result(v_report.id, true);
  END IF;
  IF v_report.status <> 'pending' THEN
    RAISE EXCEPTION 'The bill payer has already answered this report' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.expense_share_payment_reports SET status = 'withdrawn', resolved_at = now(), resolved_by = v_actor
    WHERE id = p_report_id;
  RETURN commune_private.payment_report_result(v_report.id, false);
END;
$$;


SET default_table_access_method = heap;

--
-- Name: client_reports; Type: TABLE; Schema: commune_private; Owner: -
--

CREATE TABLE commune_private.client_reports (
    id bigint NOT NULL,
    user_id text NOT NULL,
    kind text NOT NULL,
    release text NOT NULL,
    route text NOT NULL,
    browser text NOT NULL,
    message text,
    stack text,
    lcp_ms integer,
    inp_ms integer,
    cls numeric(8,4),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT client_reports_check CHECK (
CASE kind
    WHEN 'error'::text THEN ((message IS NOT NULL) AND (num_nonnulls(lcp_ms, inp_ms, cls) = 0))
    ELSE ((num_nulls(message, stack) = 2) AND (num_nonnulls(lcp_ms, inp_ms, cls) > 0))
END),
    CONSTRAINT client_reports_kind_check CHECK ((kind = ANY (ARRAY['error'::text, 'speed'::text])))
);


--
-- Name: client_reports_id_seq; Type: SEQUENCE; Schema: commune_private; Owner: -
--

ALTER TABLE commune_private.client_reports ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME commune_private.client_reports_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: commune_changes; Type: TABLE; Schema: commune_private; Owner: -
--

CREATE TABLE commune_private.commune_changes (
    id bigint NOT NULL,
    commune_id uuid NOT NULL,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: commune_changes_id_seq; Type: SEQUENCE; Schema: commune_private; Owner: -
--

ALTER TABLE commune_private.commune_changes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME commune_private.commune_changes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: announcement_acknowledgements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_acknowledgements (
    announcement_id uuid NOT NULL,
    user_id text NOT NULL,
    acknowledged_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: commune_announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commune_announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    commune_id uuid NOT NULL,
    author_id text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    needs_acknowledgement boolean DEFAULT false NOT NULL,
    request_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    archived_by text,
    CONSTRAINT commune_announcements_body_check CHECK ((length(body) <= 1000)),
    CONSTRAINT commune_announcements_check CHECK (((archived_at IS NULL) = (archived_by IS NULL))),
    CONSTRAINT commune_announcements_title_check CHECK (((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 80)))
);


--
-- Name: commune_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commune_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    commune_id uuid NOT NULL,
    actor_id text NOT NULL,
    kind text NOT NULL,
    entity_id uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: commune_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commune_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    commune_id uuid NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    token_hash bytea NOT NULL,
    invited_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    accepted_at timestamp with time zone,
    accepted_by text,
    revoked_at timestamp with time zone,
    CONSTRAINT commune_invites_check CHECK (((accepted_at IS NULL) = (accepted_by IS NULL))),
    CONSTRAINT commune_invites_check1 CHECK (((accepted_at IS NULL) OR (revoked_at IS NULL))),
    CONSTRAINT commune_invites_email_check CHECK (((length(email) >= 3) AND (length(email) <= 254))),
    CONSTRAINT commune_invites_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])))
);


--
-- Name: commune_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commune_members (
    commune_id uuid NOT NULL,
    user_id text NOT NULL,
    role text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    active boolean DEFAULT true NOT NULL,
    left_at timestamp with time zone,
    CONSTRAINT commune_members_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])))
);


--
-- Name: commune_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commune_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    commune_id uuid NOT NULL,
    title text NOT NULL,
    pill text DEFAULT ''::text NOT NULL,
    kicker text DEFAULT ''::text NOT NULL,
    lede text DEFAULT ''::text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    facts jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    updated_by text,
    request_id uuid,
    request_digest text,
    deleted_at timestamp with time zone,
    deleted_by text,
    CONSTRAINT commune_notes_body_check CHECK ((length(body) <= 2000)),
    CONSTRAINT commune_notes_facts_check CHECK (public.valid_note_facts(facts)),
    CONSTRAINT commune_notes_kicker_check CHECK ((length(kicker) <= 120)),
    CONSTRAINT commune_notes_lede_check CHECK ((length(lede) <= 200)),
    CONSTRAINT commune_notes_pill_check CHECK ((length(pill) <= 80)),
    CONSTRAINT commune_notes_removed_check CHECK (((deleted_at IS NULL) = (deleted_by IS NULL))),
    CONSTRAINT commune_notes_title_check CHECK (((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 80))),
    CONSTRAINT commune_notes_version_check CHECK ((version >= 1))
);


--
-- Name: commune_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commune_operations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    commune_id uuid NOT NULL,
    kind text NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    date date NOT NULL,
    "time" time without time zone,
    all_day boolean DEFAULT true NOT NULL,
    assignee text,
    rotation jsonb,
    last_done jsonb,
    repeat text DEFAULT 'none'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    anchor_day smallint,
    assignee_id text,
    rotation_ids jsonb,
    turn_owner_id text,
    version integer DEFAULT 1 NOT NULL,
    request_id uuid,
    request_digest text,
    deleted_at timestamp with time zone,
    deleted_by text,
    CONSTRAINT commune_operations_anchor_day_check CHECK (((anchor_day IS NULL) OR ((anchor_day >= 1) AND (anchor_day <= 31)))),
    CONSTRAINT commune_operations_assignee_check CHECK (((assignee IS NULL) OR (length(assignee) <= 80))),
    CONSTRAINT commune_operations_assignee_id_check CHECK (((assignee_id IS NULL) OR ((length(assignee_id) >= 1) AND (length(assignee_id) <= 128)))),
    CONSTRAINT commune_operations_category_check CHECK ((category = ANY (ARRAY['chore'::text, 'delivery'::text, 'visit'::text, 'appointment'::text, 'other'::text]))),
    CONSTRAINT commune_operations_kind_check CHECK ((kind = ANY (ARRAY['task'::text, 'event'::text]))),
    CONSTRAINT commune_operations_last_done_check CHECK (public.valid_operation_last_done(last_done)),
    CONSTRAINT commune_operations_notes_check CHECK ((length(notes) <= 1000)),
    CONSTRAINT commune_operations_removed_check CHECK (((deleted_at IS NULL) = (deleted_by IS NULL))),
    CONSTRAINT commune_operations_repeat_check CHECK ((repeat = ANY (ARRAY['none'::text, 'weekly'::text, 'monthly'::text]))),
    CONSTRAINT commune_operations_rotation_check CHECK (public.valid_operation_rotation(rotation)),
    CONSTRAINT commune_operations_rotation_ids_check CHECK (public.valid_operation_member_ids(rotation_ids)),
    CONSTRAINT commune_operations_status_check CHECK ((status = ANY (ARRAY['open'::text, 'done'::text]))),
    CONSTRAINT commune_operations_title_check CHECK (((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 80))),
    CONSTRAINT commune_operations_turn_owner_id_check CHECK (((turn_owner_id IS NULL) OR ((length(turn_owner_id) >= 1) AND (length(turn_owner_id) <= 128)))),
    CONSTRAINT commune_operations_version_check CHECK ((version >= 1))
);


--
-- Name: communes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    kind text NOT NULL,
    currency text NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    destination text DEFAULT ''::text NOT NULL,
    stay_name text DEFAULT ''::text NOT NULL,
    stay_address text DEFAULT ''::text NOT NULL,
    CONSTRAINT commune_location_matches_kind CHECK ((((kind = 'trip'::text) AND (address = ''::text)) OR ((kind = ANY (ARRAY['household'::text, 'workspace'::text])) AND (destination = ''::text) AND (stay_name = ''::text) AND (stay_address = ''::text)))),
    CONSTRAINT communes_address_check CHECK ((length(address) <= 160)),
    CONSTRAINT communes_currency_check CHECK ((currency = ANY (ARRAY['GBP'::text, 'USD'::text, 'EUR'::text]))),
    CONSTRAINT communes_destination_check CHECK ((length(destination) <= 80)),
    CONSTRAINT communes_kind_check CHECK ((kind = ANY (ARRAY['household'::text, 'workspace'::text, 'trip'::text]))),
    CONSTRAINT communes_name_check CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 80))),
    CONSTRAINT communes_stay_address_check CHECK ((length(stay_address) <= 160)),
    CONSTRAINT communes_stay_name_check CHECK ((length(stay_name) <= 80))
);


--
-- Name: email_suppressions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_suppressions (
    email text NOT NULL,
    reason text NOT NULL,
    provider_event_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_suppressions_email_check CHECK (((email = lower(email)) AND ((length(email) >= 3) AND (length(email) <= 320)))),
    CONSTRAINT email_suppressions_provider_event_id_check CHECK (((length(provider_event_id) >= 1) AND (length(provider_event_id) <= 256))),
    CONSTRAINT email_suppressions_reason_check CHECK ((reason = ANY (ARRAY['bounce'::text, 'complaint'::text])))
);


--
-- Name: expense_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expense_id uuid NOT NULL,
    version integer NOT NULL,
    action text NOT NULL,
    actor_id text NOT NULL,
    reason text NOT NULL,
    before jsonb NOT NULL,
    after jsonb NOT NULL,
    request_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expense_revisions_action_check CHECK ((action = ANY (ARRAY['corrected'::text, 'voided'::text]))),
    CONSTRAINT expense_revisions_reason_check CHECK (((length(btrim(reason)) >= 3) AND (length(btrim(reason)) <= 240))),
    CONSTRAINT expense_revisions_version_check CHECK ((version >= 2))
);


--
-- Name: expense_share_payment_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_share_payment_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    share_id uuid NOT NULL,
    reported_by text NOT NULL,
    amount_minor bigint NOT NULL,
    sent_on date NOT NULL,
    reference text,
    reported_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by text,
    resolution_note text,
    receipt_id uuid,
    CONSTRAINT expense_share_payment_reports_amount_minor_check CHECK ((amount_minor > 0)),
    CONSTRAINT expense_share_payment_reports_check CHECK (((status = 'pending'::text) = (resolved_at IS NULL))),
    CONSTRAINT expense_share_payment_reports_check1 CHECK (((status <> 'confirmed'::text) OR (receipt_id IS NOT NULL))),
    CONSTRAINT expense_share_payment_reports_check2 CHECK (((status <> 'declined'::text) OR (resolution_note IS NOT NULL))),
    CONSTRAINT expense_share_payment_reports_reference_check CHECK (((reference IS NULL) OR ((length(reference) >= 1) AND (length(reference) <= 80)))),
    CONSTRAINT expense_share_payment_reports_resolution_note_check CHECK (((resolution_note IS NULL) OR ((length(resolution_note) >= 3) AND (length(resolution_note) <= 240)))),
    CONSTRAINT expense_share_payment_reports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'declined'::text, 'withdrawn'::text, 'closed'::text])))
);


--
-- Name: expense_share_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_share_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    share_id uuid NOT NULL,
    amount_minor bigint NOT NULL,
    received_on date NOT NULL,
    reference text,
    recorded_by text NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id uuid NOT NULL,
    origin text DEFAULT 'recorded'::text NOT NULL,
    reversed_at timestamp with time zone,
    reversed_by text,
    reversal_reason text,
    CONSTRAINT expense_share_receipts_amount_minor_check CHECK ((amount_minor > 0)),
    CONSTRAINT expense_share_receipts_check CHECK ((((reversed_at IS NULL) AND (reversed_by IS NULL) AND (reversal_reason IS NULL)) OR ((reversed_at IS NOT NULL) AND (reversed_by IS NOT NULL) AND ((length(btrim(reversal_reason)) >= 3) AND (length(btrim(reversal_reason)) <= 240))))),
    CONSTRAINT expense_share_receipts_origin_check CHECK ((origin = ANY (ARRAY['recorded'::text, 'migrated'::text]))),
    CONSTRAINT expense_share_receipts_reference_check CHECK (((reference IS NULL) OR ((length(reference) >= 1) AND (length(reference) <= 80))))
);


--
-- Name: expense_shares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    expense_id uuid NOT NULL,
    user_id text NOT NULL,
    amount_minor bigint NOT NULL,
    settled_minor bigint DEFAULT 0 NOT NULL,
    settled_at timestamp with time zone,
    CONSTRAINT expense_shares_amount_minor_check CHECK ((amount_minor > 0)),
    CONSTRAINT expense_shares_check CHECK (((settled_minor >= 0) AND (settled_minor <= amount_minor)))
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    commune_id uuid NOT NULL,
    title text NOT NULL,
    amount_minor bigint NOT NULL,
    paid_by_user_id text NOT NULL,
    due_on date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    category text DEFAULT 'Other'::text NOT NULL,
    recorded_by text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone,
    voided_at timestamp with time zone,
    voided_by text,
    void_reason text,
    request_id uuid,
    CONSTRAINT expenses_amount_minor_check CHECK ((amount_minor > 0)),
    CONSTRAINT expenses_category_check CHECK (((length(btrim(category)) >= 1) AND (length(btrim(category)) <= 40))),
    CONSTRAINT expenses_title_check CHECK (((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 160))),
    CONSTRAINT expenses_version_check CHECK ((version >= 1)),
    CONSTRAINT expenses_void_check CHECK ((((voided_at IS NULL) AND (voided_by IS NULL) AND (void_reason IS NULL)) OR ((voided_at IS NOT NULL) AND (voided_by IS NOT NULL) AND ((length(btrim(void_reason)) >= 3) AND (length(btrim(void_reason)) <= 240)))))
);


--
-- Name: fund_commitments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fund_commitments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fund_id uuid NOT NULL,
    user_id text NOT NULL,
    amount_minor bigint NOT NULL,
    due_on date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cancelled_at timestamp with time zone,
    CONSTRAINT fund_commitments_amount_minor_check CHECK ((amount_minor > 0))
);


--
-- Name: fund_contributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fund_contributions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    commitment_id uuid NOT NULL,
    amount_minor bigint NOT NULL,
    recorded_by text NOT NULL,
    contributed_at timestamp with time zone DEFAULT now() NOT NULL,
    voided_at timestamp with time zone,
    voided_by text,
    void_reason text,
    request_id uuid,
    CONSTRAINT fund_contributions_amount_minor_check CHECK ((amount_minor > 0))
);


--
-- Name: fund_pledge_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fund_pledge_requests (
    user_id text NOT NULL,
    request_id uuid NOT NULL,
    commitment_id uuid NOT NULL,
    amount_minor bigint NOT NULL,
    due_on date NOT NULL,
    seq bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fund_pledge_requests_seq_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.fund_pledge_requests ALTER COLUMN seq ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.fund_pledge_requests_seq_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: funds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.funds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    commune_id uuid NOT NULL,
    name text NOT NULL,
    target_minor bigint,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_at timestamp with time zone,
    request_id uuid,
    CONSTRAINT funds_name_check CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 120))),
    CONSTRAINT funds_target_minor_check CHECK ((target_minor > 0))
);


--
-- Name: invitation_email_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitation_email_deliveries (
    invite_id uuid NOT NULL,
    commune_id uuid NOT NULL,
    sender_id text NOT NULL,
    recipient_email text NOT NULL,
    status text NOT NULL,
    attempts integer DEFAULT 1 NOT NULL,
    payload jsonb NOT NULL,
    provider_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invitation_email_deliveries_attempts_check CHECK (((attempts >= 1) AND (attempts <= 5))),
    CONSTRAINT invitation_email_deliveries_status_check CHECK ((status = ANY (ARRAY['sending'::text, 'sent'::text, 'failed'::text])))
);


--
-- Name: member_pay_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.member_pay_links (
    user_id text NOT NULL,
    provider text NOT NULL,
    handle text,
    account_name text,
    sort_code text,
    account_number text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    preferred boolean DEFAULT false NOT NULL,
    CONSTRAINT member_pay_links_account_name_check CHECK (((length(btrim(account_name)) >= 1) AND (length(btrim(account_name)) <= 60))),
    CONSTRAINT member_pay_links_account_number_check CHECK ((account_number ~ '^[0-9]{8}$'::text)),
    CONSTRAINT member_pay_links_check CHECK (
CASE
    WHEN (provider = 'bank'::text) THEN ((handle IS NULL) AND (account_name IS NOT NULL) AND (sort_code IS NOT NULL) AND (account_number IS NOT NULL))
    ELSE ((handle IS NOT NULL) AND (account_name IS NULL) AND (sort_code IS NULL) AND (account_number IS NULL))
END),
    CONSTRAINT member_pay_links_handle_check CHECK ((handle ~ '^[A-Za-z0-9._-]{1,40}$'::text)),
    CONSTRAINT member_pay_links_provider_check CHECK ((provider = ANY (ARRAY['monzo'::text, 'paypal'::text, 'revolut'::text, 'bank'::text]))),
    CONSTRAINT member_pay_links_sort_code_check CHECK ((sort_code ~ '^[0-9]{6}$'::text))
);


--
-- Name: note_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.note_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    note_id uuid NOT NULL,
    commune_id uuid NOT NULL,
    version integer NOT NULL,
    title text NOT NULL,
    pill text NOT NULL,
    kicker text NOT NULL,
    lede text NOT NULL,
    body text NOT NULL,
    facts jsonb NOT NULL,
    edited_by text,
    edited_at timestamp with time zone NOT NULL,
    replaced_by text,
    replaced_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    user_id text NOT NULL,
    email_reminders boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reminder_id uuid,
    commune_id uuid NOT NULL,
    recipient_user_id text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    notice_kind text,
    expense_id uuid,
    actor_user_id text,
    amount_minor bigint,
    detail text,
    commitment_id uuid,
    CONSTRAINT notifications_detail_check CHECK (((detail IS NULL) OR (length(detail) <= 240))),
    CONSTRAINT notifications_source_check CHECK ((((reminder_id IS NOT NULL) AND (notice_kind IS NULL)) OR ((reminder_id IS NULL) AND (expense_id IS NOT NULL) AND (actor_user_id IS NOT NULL) AND (notice_kind = ANY (ARRAY['receipt_reversed'::text, 'expense_corrected'::text, 'expense_voided'::text, 'payment_reported'::text, 'payment_confirmed'::text, 'payment_declined'::text]))) OR ((reminder_id IS NULL) AND (expense_id IS NULL) AND (commitment_id IS NOT NULL) AND (actor_user_id IS NOT NULL) AND (notice_kind = ANY (ARRAY['pledge_changed'::text, 'pledge_cancelled'::text])))))
);


--
-- Name: operation_occurrences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operation_occurrences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    operation_id uuid NOT NULL,
    commune_id uuid NOT NULL,
    action text NOT NULL,
    due_on date NOT NULL,
    assignee text,
    actor_id text NOT NULL,
    acted_on date NOT NULL,
    acted_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id uuid NOT NULL,
    prev_date date NOT NULL,
    prev_assignee text,
    prev_status text NOT NULL,
    prev_last_done jsonb,
    next_date date NOT NULL,
    next_assignee text,
    next_status text NOT NULL,
    next_last_done jsonb,
    undone_at timestamp with time zone,
    undone_by text,
    assignee_id text,
    prev_assignee_id text,
    next_assignee_id text,
    reason text,
    prev_turn_owner_id text,
    next_turn_owner_id text,
    done_by_id text,
    CONSTRAINT operation_occurrences_action_check CHECK ((action = ANY (ARRAY['completed'::text, 'skipped'::text, 'reopened'::text, 'handed_over'::text]))),
    CONSTRAINT operation_occurrences_check CHECK (((undone_at IS NULL) = (undone_by IS NULL))),
    CONSTRAINT operation_occurrences_done_by_id_check CHECK (((done_by_id IS NULL) OR ((length(done_by_id) >= 1) AND (length(done_by_id) <= 128)))),
    CONSTRAINT operation_occurrences_reason_check CHECK (((reason IS NULL) OR ((length(reason) >= 1) AND (length(reason) <= 200))))
);


--
-- Name: recurring_bill_occurrences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_bill_occurrences (
    bill_id uuid NOT NULL,
    due_on date NOT NULL,
    expense_id uuid,
    status text DEFAULT 'recorded'::text NOT NULL,
    amount_minor bigint,
    actor_id text,
    acted_at timestamp with time zone DEFAULT now() NOT NULL,
    note text,
    CONSTRAINT recurring_bill_occurrences_amount_minor_check CHECK (((amount_minor IS NULL) OR (amount_minor > 0))),
    CONSTRAINT recurring_bill_occurrences_note_check CHECK (((note IS NULL) OR ((length(note) >= 3) AND (length(note) <= 240)))),
    CONSTRAINT recurring_bill_occurrences_status_check CHECK ((status = ANY (ARRAY['recorded'::text, 'skipped'::text]))),
    CONSTRAINT recurring_occurrence_shape CHECK ((((status = 'recorded'::text) AND (expense_id IS NOT NULL)) OR ((status = 'skipped'::text) AND (expense_id IS NULL) AND (note IS NOT NULL))))
);


--
-- Name: recurring_bills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_bills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    commune_id uuid NOT NULL,
    title text NOT NULL,
    amount_minor bigint NOT NULL,
    paid_by_user_id text NOT NULL,
    shares jsonb NOT NULL,
    frequency text NOT NULL,
    next_due_on date NOT NULL,
    anchor_day integer NOT NULL,
    paused boolean DEFAULT false NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    archived_at timestamp with time zone,
    request_id uuid,
    CONSTRAINT recurring_archived_paused CHECK (((archived_at IS NULL) OR paused)),
    CONSTRAINT recurring_bills_amount_minor_check CHECK (((amount_minor >= 1) AND (amount_minor <= '1000000000000'::bigint))),
    CONSTRAINT recurring_bills_anchor_day_check CHECK (((anchor_day >= 1) AND (anchor_day <= 31))),
    CONSTRAINT recurring_bills_frequency_check CHECK ((frequency = ANY (ARRAY['weekly'::text, 'monthly'::text]))),
    CONSTRAINT recurring_bills_shares_check CHECK ((jsonb_typeof(shares) = 'array'::text)),
    CONSTRAINT recurring_bills_title_check CHECK (((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 80))),
    CONSTRAINT recurring_bills_version_check CHECK ((version >= 1))
);


--
-- Name: reminder_email_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reminder_email_outbox (
    reminder_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    payload jsonb,
    payload_amount_minor bigint,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    provider_message_id text,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reminder_email_outbox_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT reminder_email_outbox_payload_amount_minor_check CHECK ((payload_amount_minor > 0)),
    CONSTRAINT reminder_email_outbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'failed'::text, 'suppressed'::text])))
);


--
-- Name: reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    commune_id uuid NOT NULL,
    kind text NOT NULL,
    source_id uuid NOT NULL,
    sender_user_id text NOT NULL,
    recipient_user_id text NOT NULL,
    amount_minor bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    request_id uuid,
    CONSTRAINT reminders_amount_minor_check CHECK ((amount_minor > 0)),
    CONSTRAINT reminders_check CHECK ((sender_user_id <> recipient_user_id)),
    CONSTRAINT reminders_kind_check CHECK ((kind = ANY (ARRAY['nudge'::text, 'chase'::text])))
);


--
-- Name: split_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.split_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    commune_id uuid NOT NULL,
    name text NOT NULL,
    method text NOT NULL,
    participants jsonb NOT NULL,
    created_by text NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT split_templates_method_check CHECK ((method = ANY (ARRAY['Equal'::text, 'Exact'::text, 'Percentage'::text, 'Shares'::text]))),
    CONSTRAINT split_templates_name_check CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 60))),
    CONSTRAINT split_templates_participants_check CHECK ((jsonb_typeof(participants) = 'array'::text))
);


--
-- Name: client_reports client_reports_pkey; Type: CONSTRAINT; Schema: commune_private; Owner: -
--

ALTER TABLE ONLY commune_private.client_reports
    ADD CONSTRAINT client_reports_pkey PRIMARY KEY (id);


--
-- Name: commune_changes commune_changes_pkey; Type: CONSTRAINT; Schema: commune_private; Owner: -
--

ALTER TABLE ONLY commune_private.commune_changes
    ADD CONSTRAINT commune_changes_pkey PRIMARY KEY (id);


--
-- Name: announcement_acknowledgements announcement_acknowledgements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_acknowledgements
    ADD CONSTRAINT announcement_acknowledgements_pkey PRIMARY KEY (announcement_id, user_id);


--
-- Name: commune_announcements commune_announcements_author_id_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commune_announcements
    ADD CONSTRAINT commune_announcements_author_id_request_id_key UNIQUE (author_id, request_id);


--
-- Name: commune_announcements commune_announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commune_announcements
    ADD CONSTRAINT commune_announcements_pkey PRIMARY KEY (id);


--
-- Name: commune_events commune_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commune_events
    ADD CONSTRAINT commune_events_pkey PRIMARY KEY (id);


--
-- Name: commune_invites commune_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commune_invites
    ADD CONSTRAINT commune_invites_pkey PRIMARY KEY (id);


--
-- Name: commune_invites commune_invites_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commune_invites
    ADD CONSTRAINT commune_invites_token_hash_key UNIQUE (token_hash);


--
-- Name: commune_members commune_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commune_members
    ADD CONSTRAINT commune_members_pkey PRIMARY KEY (commune_id, user_id);


--
-- Name: commune_notes commune_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commune_notes
    ADD CONSTRAINT commune_notes_pkey PRIMARY KEY (id);


--
-- Name: commune_operations commune_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commune_operations
    ADD CONSTRAINT commune_operations_pkey PRIMARY KEY (id);


--
-- Name: communes communes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communes
    ADD CONSTRAINT communes_pkey PRIMARY KEY (id);


--
-- Name: email_suppressions email_suppressions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_suppressions
    ADD CONSTRAINT email_suppressions_pkey PRIMARY KEY (email);


--
-- Name: expense_revisions expense_revisions_actor_id_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_revisions
    ADD CONSTRAINT expense_revisions_actor_id_request_id_key UNIQUE (actor_id, request_id);


--
-- Name: expense_revisions expense_revisions_expense_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_revisions
    ADD CONSTRAINT expense_revisions_expense_id_version_key UNIQUE (expense_id, version);


--
-- Name: expense_revisions expense_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_revisions
    ADD CONSTRAINT expense_revisions_pkey PRIMARY KEY (id);


--
-- Name: expense_share_payment_reports expense_share_payment_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_share_payment_reports
    ADD CONSTRAINT expense_share_payment_reports_pkey PRIMARY KEY (id);


--
-- Name: expense_share_payment_reports expense_share_payment_reports_reported_by_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_share_payment_reports
    ADD CONSTRAINT expense_share_payment_reports_reported_by_request_id_key UNIQUE (reported_by, request_id);


--
-- Name: expense_share_receipts expense_share_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_share_receipts
    ADD CONSTRAINT expense_share_receipts_pkey PRIMARY KEY (id);


--
-- Name: expense_share_receipts expense_share_receipts_recorded_by_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_share_receipts
    ADD CONSTRAINT expense_share_receipts_recorded_by_request_id_key UNIQUE (recorded_by, request_id);


--
-- Name: expense_shares expense_shares_expense_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_shares
    ADD CONSTRAINT expense_shares_expense_id_user_id_key UNIQUE (expense_id, user_id);


--
-- Name: expense_shares expense_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_shares
    ADD CONSTRAINT expense_shares_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: fund_commitments fund_commitments_fund_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_commitments
    ADD CONSTRAINT fund_commitments_fund_id_user_id_key UNIQUE (fund_id, user_id);


--
-- Name: fund_commitments fund_commitments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_commitments
    ADD CONSTRAINT fund_commitments_pkey PRIMARY KEY (id);


--
-- Name: fund_contributions fund_contributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_contributions
    ADD CONSTRAINT fund_contributions_pkey PRIMARY KEY (id);


--
-- Name: fund_pledge_requests fund_pledge_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_pledge_requests
    ADD CONSTRAINT fund_pledge_requests_pkey PRIMARY KEY (user_id, request_id);


--
-- Name: funds funds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funds
    ADD CONSTRAINT funds_pkey PRIMARY KEY (id);


--
-- Name: invitation_email_deliveries invitation_email_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation_email_deliveries
    ADD CONSTRAINT invitation_email_deliveries_pkey PRIMARY KEY (invite_id);


--
-- Name: member_pay_links member_pay_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.member_pay_links
    ADD CONSTRAINT member_pay_links_pkey PRIMARY KEY (user_id, provider);


--
-- Name: note_revisions note_revisions_note_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_revisions
    ADD CONSTRAINT note_revisions_note_id_version_key UNIQUE (note_id, version);


--
-- Name: note_revisions note_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_revisions
    ADD CONSTRAINT note_revisions_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_reminder_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_reminder_id_key UNIQUE (reminder_id);


--
-- Name: operation_occurrences operation_occurrences_actor_id_request_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_occurrences
    ADD CONSTRAINT operation_occurrences_actor_id_request_id_key UNIQUE (actor_id, request_id);


--
-- Name: operation_occurrences operation_occurrences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_occurrences
    ADD CONSTRAINT operation_occurrences_pkey PRIMARY KEY (id);


--
-- Name: recurring_bill_occurrences recurring_bill_occurrences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_bill_occurrences
    ADD CONSTRAINT recurring_bill_occurrences_pkey PRIMARY KEY (bill_id, due_on);


--
-- Name: recurring_bills recurring_bills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_bills
    ADD CONSTRAINT recurring_bills_pkey PRIMARY KEY (id);


--
-- Name: reminder_email_outbox reminder_email_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminder_email_outbox
    ADD CONSTRAINT reminder_email_outbox_pkey PRIMARY KEY (reminder_id);


--
-- Name: reminders reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_pkey PRIMARY KEY (id);


--
-- Name: split_templates split_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.split_templates
    ADD CONSTRAINT split_templates_pkey PRIMARY KEY (id);


--
-- Name: client_reports_account_idx; Type: INDEX; Schema: commune_private; Owner: -
--

CREATE INDEX client_reports_account_idx ON commune_private.client_reports USING btree (user_id, created_at);


--
-- Name: client_reports_age_idx; Type: INDEX; Schema: commune_private; Owner: -
--

CREATE INDEX client_reports_age_idx ON commune_private.client_reports USING btree (created_at);


--
-- Name: commune_changes_age_idx; Type: INDEX; Schema: commune_private; Owner: -
--

CREATE INDEX commune_changes_age_idx ON commune_private.commune_changes USING btree (changed_at);


--
-- Name: commune_changes_recent_idx; Type: INDEX; Schema: commune_private; Owner: -
--

CREATE INDEX commune_changes_recent_idx ON commune_private.commune_changes USING btree (commune_id, changed_at) INCLUDE (id);


--
-- Name: commune_announcements_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commune_announcements_active_idx ON public.commune_announcements USING btree (commune_id, created_at DESC) WHERE (archived_at IS NULL);


--
-- Name: commune_events_corrections_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commune_events_corrections_idx ON public.commune_events USING btree (commune_id, commune_private.money_correction_reserve(kind, description, details), created_at DESC) WHERE (commune_private.money_correction_reserve(kind, description, details) IS NOT NULL);


--
-- Name: commune_events_recent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commune_events_recent_idx ON public.commune_events USING btree (commune_id, created_at DESC);


--
-- Name: commune_invites_commune_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commune_invites_commune_idx ON public.commune_invites USING btree (commune_id, created_at DESC);


--
-- Name: commune_invites_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commune_invites_email_idx ON public.commune_invites USING btree (email, expires_at DESC) WHERE ((accepted_at IS NULL) AND (revoked_at IS NULL));


--
-- Name: commune_members_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commune_members_user_idx ON public.commune_members USING btree (user_id, commune_id);


--
-- Name: commune_notes_commune_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commune_notes_commune_idx ON public.commune_notes USING btree (commune_id, created_at DESC);


--
-- Name: commune_notes_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX commune_notes_request_idx ON public.commune_notes USING btree (created_by, request_id) WHERE (request_id IS NOT NULL);


--
-- Name: commune_operations_commune_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX commune_operations_commune_date_idx ON public.commune_operations USING btree (commune_id, date, "time");


--
-- Name: commune_operations_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX commune_operations_request_idx ON public.commune_operations USING btree (created_by, request_id) WHERE (request_id IS NOT NULL);


--
-- Name: communes_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX communes_created_by_idx ON public.communes USING btree (created_by, created_at);


--
-- Name: expense_share_payment_reports_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX expense_share_payment_reports_pending_idx ON public.expense_share_payment_reports USING btree (share_id) WHERE (status = 'pending'::text);


--
-- Name: expense_share_payment_reports_share_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expense_share_payment_reports_share_idx ON public.expense_share_payment_reports USING btree (share_id, reported_at DESC);


--
-- Name: expense_share_receipts_share_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expense_share_receipts_share_idx ON public.expense_share_receipts USING btree (share_id, recorded_at DESC);


--
-- Name: expense_shares_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expense_shares_user_idx ON public.expense_shares USING btree (user_id, expense_id);


--
-- Name: expenses_commune_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_commune_idx ON public.expenses USING btree (commune_id, created_at DESC);


--
-- Name: expenses_recorder_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX expenses_recorder_request_idx ON public.expenses USING btree (recorded_by, request_id) WHERE (request_id IS NOT NULL);


--
-- Name: expenses_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_search_idx ON public.expenses USING gin ((((title || ' '::text) || category)) public.gin_trgm_ops);


--
-- Name: fund_commitments_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fund_commitments_user_idx ON public.fund_commitments USING btree (user_id, fund_id);


--
-- Name: fund_contributions_commitment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fund_contributions_commitment_idx ON public.fund_contributions USING btree (commitment_id, contributed_at DESC);


--
-- Name: fund_contributions_recorder_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fund_contributions_recorder_request_idx ON public.fund_contributions USING btree (recorded_by, request_id) WHERE (request_id IS NOT NULL);


--
-- Name: fund_pledge_requests_commitment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fund_pledge_requests_commitment_idx ON public.fund_pledge_requests USING btree (commitment_id, seq);


--
-- Name: funds_commune_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX funds_commune_idx ON public.funds USING btree (commune_id, created_at DESC);


--
-- Name: funds_creator_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX funds_creator_request_idx ON public.funds USING btree (created_by, request_id) WHERE (request_id IS NOT NULL);


--
-- Name: funds_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX funds_search_idx ON public.funds USING gin (name public.gin_trgm_ops) WHERE (archived_at IS NULL);


--
-- Name: invitation_email_commune_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invitation_email_commune_idx ON public.invitation_email_deliveries USING btree (commune_id, created_at);


--
-- Name: invitation_email_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invitation_email_created_idx ON public.invitation_email_deliveries USING btree (created_at);


--
-- Name: invitation_email_recipient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invitation_email_recipient_idx ON public.invitation_email_deliveries USING btree (recipient_email, created_at);


--
-- Name: invitation_email_sender_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invitation_email_sender_idx ON public.invitation_email_deliveries USING btree (sender_id, created_at);


--
-- Name: member_pay_links_one_preferred; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX member_pay_links_one_preferred ON public.member_pay_links USING btree (user_id) WHERE preferred;


--
-- Name: note_revisions_note_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX note_revisions_note_idx ON public.note_revisions USING btree (note_id, version DESC);


--
-- Name: notes_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notes_search_idx ON public.commune_notes USING gin ((((((title || ' '::text) ||
CASE
    WHEN (pill = 'Landlord'::text) THEN 'Contacts'::text
    ELSE pill
END) || ' '::text) || commune_private.note_search_excerpt(pill, body, lede, facts))) public.gin_trgm_ops);


--
-- Name: notifications_recipient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_recipient_idx ON public.notifications USING btree (recipient_user_id, created_at DESC);


--
-- Name: notifications_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_unread_idx ON public.notifications USING btree (recipient_user_id, commune_id) WHERE (read_at IS NULL);


--
-- Name: operation_occurrences_operation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX operation_occurrences_operation_idx ON public.operation_occurrences USING btree (operation_id, acted_at DESC);


--
-- Name: operations_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX operations_search_idx ON public.commune_operations USING gin ((((title || ' '::text) || category)) public.gin_trgm_ops);


--
-- Name: recurring_bills_commune_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recurring_bills_commune_idx ON public.recurring_bills USING btree (commune_id, next_due_on);


--
-- Name: recurring_bills_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX recurring_bills_request_idx ON public.recurring_bills USING btree (created_by, request_id) WHERE (request_id IS NOT NULL);


--
-- Name: recurring_occurrences_expense_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recurring_occurrences_expense_idx ON public.recurring_bill_occurrences USING btree (expense_id) WHERE (expense_id IS NOT NULL);


--
-- Name: recurring_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recurring_search_idx ON public.recurring_bills USING gin (title public.gin_trgm_ops);


--
-- Name: reminder_email_outbox_payload_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reminder_email_outbox_payload_idx ON public.reminder_email_outbox USING btree (created_at) WHERE (payload IS NOT NULL);


--
-- Name: reminder_email_outbox_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reminder_email_outbox_pending_idx ON public.reminder_email_outbox USING btree (next_attempt_at) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text]));


--
-- Name: reminders_commune_sender_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reminders_commune_sender_idx ON public.reminders USING btree (commune_id, sender_user_id, created_at DESC);


--
-- Name: reminders_cooldown_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reminders_cooldown_idx ON public.reminders USING btree (kind, source_id, recipient_user_id, created_at DESC);


--
-- Name: reminders_recipient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reminders_recipient_idx ON public.reminders USING btree (recipient_user_id, created_at DESC);


--
-- Name: reminders_sender_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reminders_sender_created_idx ON public.reminders USING btree (sender_user_id, created_at DESC);


--
-- Name: reminders_sender_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX reminders_sender_request_idx ON public.reminders USING btree (sender_user_id, request_id) WHERE (request_id IS NOT NULL);


--
-- Name: split_templates_commune_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX split_templates_commune_idx ON public.split_templates USING btree (commune_id);


--
-- Name: templates_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX templates_search_idx ON public.split_templates USING gin ((((name || ' '::text) || method)) public.gin_trgm_ops) WHERE (archived_at IS NULL);


--
-- Name: announcement_acknowledgements change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.announcement_acknowledgements FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('announcement_id');


--
-- Name: commune_announcements change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.commune_announcements FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');


--
-- Name: commune_events change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.commune_events FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');


--
-- Name: commune_invites change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.commune_invites FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');


--
-- Name: commune_members change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.commune_members FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');


--
-- Name: commune_notes change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.commune_notes FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');


--
-- Name: commune_operations change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.commune_operations FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');


--
-- Name: communes change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.communes FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('id');


--
-- Name: expense_revisions change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.expense_revisions FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('expense_id');


--
-- Name: expense_share_payment_reports change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.expense_share_payment_reports FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('share_id');


--
-- Name: expense_share_receipts change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.expense_share_receipts FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('share_id');


--
-- Name: expense_shares change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.expense_shares FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('expense_id');


--
-- Name: expenses change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');


--
-- Name: fund_commitments change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.fund_commitments FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('fund_id');


--
-- Name: fund_contributions change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.fund_contributions FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commitment_id');


--
-- Name: fund_pledge_requests change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.fund_pledge_requests FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commitment_id');


--
-- Name: funds change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.funds FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');


--
-- Name: note_revisions change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.note_revisions FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');


--
-- Name: notifications change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');


--
-- Name: operation_occurrences change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.operation_occurrences FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');


--
-- Name: recurring_bill_occurrences change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.recurring_bill_occurrences FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('bill_id');


--
-- Name: recurring_bills change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.recurring_bills FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');


--
-- Name: reminder_email_outbox change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE OF status, last_error ON public.reminder_email_outbox FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('reminder_id');


--
-- Name: reminders change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.reminders FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');


--
-- Name: split_templates change_mark; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER change_mark AFTER INSERT OR DELETE OR UPDATE ON public.split_templates FOR EACH ROW EXECUTE FUNCTION commune_private.note_commune_change('commune_id');


--
-- Name: commune_members commune_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER commune_change AFTER INSERT OR UPDATE ON public.commune_members FOR EACH ROW EXECUTE FUNCTION commune_private.record_commune_change();


--
-- Name: fund_commitments commune_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER commune_change AFTER INSERT OR UPDATE ON public.fund_commitments FOR EACH ROW EXECUTE FUNCTION commune_private.record_commune_change();


--
-- Name: fund_contributions commune_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER commune_change AFTER INSERT OR UPDATE ON public.fund_contributions FOR EACH ROW EXECUTE FUNCTION commune_private.record_commune_change();


--
-- Name: funds commune_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER commune_change AFTER INSERT OR UPDATE ON public.funds FOR EACH ROW EXECUTE FUNCTION commune_private.record_commune_change();


--
-- Name: recurring_bills commune_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER commune_change AFTER INSERT OR UPDATE ON public.recurring_bills FOR EACH ROW EXECUTE FUNCTION commune_private.record_commune_change();


--
-- Name: split_templates commune_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER commune_change AFTER INSERT OR UPDATE ON public.split_templates FOR EACH ROW EXECUTE FUNCTION commune_private.record_commune_change();


--
-- Name: expenses expense_payer_matches_settlement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER expense_payer_matches_settlement AFTER UPDATE OF paid_by_user_id ON public.expenses DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION commune_private.check_share_settlement();


--
-- Name: expenses expense_voided_closes_reports; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER expense_voided_closes_reports AFTER UPDATE OF voided_at ON public.expenses FOR EACH ROW WHEN (((old.voided_at IS NULL) AND (new.voided_at IS NOT NULL))) EXECUTE FUNCTION commune_private.close_payment_reports();


--
-- Name: commune_members member_departure_operations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER member_departure_operations AFTER UPDATE OF active ON public.commune_members FOR EACH ROW WHEN ((old.active AND (NOT new.active))) EXECUTE FUNCTION commune_private.reassign_departed_member();


--
-- Name: commune_notes note_revision; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_revision BEFORE UPDATE ON public.commune_notes FOR EACH ROW EXECUTE FUNCTION commune_private.record_note_revision();


--
-- Name: commune_notes note_version_start; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER note_version_start BEFORE INSERT ON public.commune_notes FOR EACH ROW EXECUTE FUNCTION commune_private.start_note_version();


--
-- Name: commune_operations operation_anchor; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER operation_anchor BEFORE INSERT OR UPDATE ON public.commune_operations FOR EACH ROW EXECUTE FUNCTION commune_private.set_operation_anchor();


--
-- Name: commune_operations operation_people; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER operation_people BEFORE INSERT OR UPDATE ON public.commune_operations FOR EACH ROW EXECUTE FUNCTION commune_private.set_operation_people();


--
-- Name: commune_operations operation_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER operation_version BEFORE UPDATE ON public.commune_operations FOR EACH ROW EXECUTE FUNCTION commune_private.next_operation_version();


--
-- Name: expense_share_receipts receipt_event; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER receipt_event AFTER INSERT OR UPDATE ON public.expense_share_receipts FOR EACH ROW EXECUTE FUNCTION commune_private.record_receipt_event();


--
-- Name: expense_share_receipts receipt_matches_share_settlement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER receipt_matches_share_settlement AFTER INSERT OR UPDATE ON public.expense_share_receipts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION commune_private.check_share_settlement();


--
-- Name: recurring_bills recurring_bill_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER recurring_bill_version BEFORE UPDATE ON public.recurring_bills FOR EACH ROW EXECUTE FUNCTION commune_private.bump_recurring_bill_version();


--
-- Name: expense_shares share_settled_closes_reports; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER share_settled_closes_reports AFTER UPDATE OF settled_minor ON public.expense_shares FOR EACH ROW WHEN ((new.settled_minor >= new.amount_minor)) EXECUTE FUNCTION commune_private.close_payment_reports();


--
-- Name: expense_shares share_settlement_matches_receipts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER share_settlement_matches_receipts AFTER INSERT OR UPDATE ON public.expense_shares DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION commune_private.check_share_settlement();


--
-- Name: announcement_acknowledgements announcement_acknowledgements_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_acknowledgements
    ADD CONSTRAINT announcement_acknowledgements_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.commune_announcements(id) ON DELETE CASCADE;


--
-- Name: commune_announcements commune_announcements_commune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commune_announcements
    ADD CONSTRAINT commune_announcements_commune_id_fkey FOREIGN KEY (commune_id) REFERENCES public.communes(id) ON DELETE CASCADE;


--
-- Name: commune_events commune_events_commune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commune_events
    ADD CONSTRAINT commune_events_commune_id_fkey FOREIGN KEY (commune_id) REFERENCES public.communes(id) ON DELETE CASCADE;


--
-- Name: commune_invites commune_invites_commune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commune_invites
    ADD CONSTRAINT commune_invites_commune_id_fkey FOREIGN KEY (commune_id) REFERENCES public.communes(id) ON DELETE CASCADE;


--
-- Name: commune_invites commune_invites_commune_id_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commune_invites
    ADD CONSTRAINT commune_invites_commune_id_invited_by_fkey FOREIGN KEY (commune_id, invited_by) REFERENCES public.commune_members(commune_id, user_id);


--
-- Name: commune_members commune_members_commune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commune_members
    ADD CONSTRAINT commune_members_commune_id_fkey FOREIGN KEY (commune_id) REFERENCES public.communes(id) ON DELETE CASCADE;


--
-- Name: commune_notes commune_notes_commune_id_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commune_notes
    ADD CONSTRAINT commune_notes_commune_id_created_by_fkey FOREIGN KEY (commune_id, created_by) REFERENCES public.commune_members(commune_id, user_id);


--
-- Name: commune_notes commune_notes_commune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commune_notes
    ADD CONSTRAINT commune_notes_commune_id_fkey FOREIGN KEY (commune_id) REFERENCES public.communes(id) ON DELETE CASCADE;


--
-- Name: commune_operations commune_operations_commune_id_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commune_operations
    ADD CONSTRAINT commune_operations_commune_id_created_by_fkey FOREIGN KEY (commune_id, created_by) REFERENCES public.commune_members(commune_id, user_id);


--
-- Name: commune_operations commune_operations_commune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commune_operations
    ADD CONSTRAINT commune_operations_commune_id_fkey FOREIGN KEY (commune_id) REFERENCES public.communes(id) ON DELETE CASCADE;


--
-- Name: expense_revisions expense_revisions_expense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_revisions
    ADD CONSTRAINT expense_revisions_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.expenses(id) ON DELETE CASCADE;


--
-- Name: expense_share_payment_reports expense_share_payment_reports_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_share_payment_reports
    ADD CONSTRAINT expense_share_payment_reports_receipt_id_fkey FOREIGN KEY (receipt_id) REFERENCES public.expense_share_receipts(id);


--
-- Name: expense_share_payment_reports expense_share_payment_reports_share_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_share_payment_reports
    ADD CONSTRAINT expense_share_payment_reports_share_id_fkey FOREIGN KEY (share_id) REFERENCES public.expense_shares(id) ON DELETE CASCADE;


--
-- Name: expense_share_receipts expense_share_receipts_share_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_share_receipts
    ADD CONSTRAINT expense_share_receipts_share_id_fkey FOREIGN KEY (share_id) REFERENCES public.expense_shares(id) ON DELETE CASCADE;


--
-- Name: expense_shares expense_shares_expense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_shares
    ADD CONSTRAINT expense_shares_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.expenses(id) ON DELETE CASCADE;


--
-- Name: expenses expenses_commune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_commune_id_fkey FOREIGN KEY (commune_id) REFERENCES public.communes(id) ON DELETE CASCADE;


--
-- Name: expenses expenses_commune_id_paid_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_commune_id_paid_by_user_id_fkey FOREIGN KEY (commune_id, paid_by_user_id) REFERENCES public.commune_members(commune_id, user_id);


--
-- Name: fund_commitments fund_commitments_fund_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_commitments
    ADD CONSTRAINT fund_commitments_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES public.funds(id) ON DELETE CASCADE;


--
-- Name: fund_contributions fund_contributions_commitment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_contributions
    ADD CONSTRAINT fund_contributions_commitment_id_fkey FOREIGN KEY (commitment_id) REFERENCES public.fund_commitments(id) ON DELETE CASCADE;


--
-- Name: fund_pledge_requests fund_pledge_requests_commitment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_pledge_requests
    ADD CONSTRAINT fund_pledge_requests_commitment_id_fkey FOREIGN KEY (commitment_id) REFERENCES public.fund_commitments(id) ON DELETE CASCADE;


--
-- Name: funds funds_commune_id_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funds
    ADD CONSTRAINT funds_commune_id_created_by_fkey FOREIGN KEY (commune_id, created_by) REFERENCES public.commune_members(commune_id, user_id);


--
-- Name: funds funds_commune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.funds
    ADD CONSTRAINT funds_commune_id_fkey FOREIGN KEY (commune_id) REFERENCES public.communes(id) ON DELETE CASCADE;


--
-- Name: invitation_email_deliveries invitation_email_deliveries_commune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation_email_deliveries
    ADD CONSTRAINT invitation_email_deliveries_commune_id_fkey FOREIGN KEY (commune_id) REFERENCES public.communes(id) ON DELETE CASCADE;


--
-- Name: invitation_email_deliveries invitation_email_deliveries_invite_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitation_email_deliveries
    ADD CONSTRAINT invitation_email_deliveries_invite_id_fkey FOREIGN KEY (invite_id) REFERENCES public.commune_invites(id) ON DELETE CASCADE;


--
-- Name: note_revisions note_revisions_commune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_revisions
    ADD CONSTRAINT note_revisions_commune_id_fkey FOREIGN KEY (commune_id) REFERENCES public.communes(id) ON DELETE CASCADE;


--
-- Name: note_revisions note_revisions_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.note_revisions
    ADD CONSTRAINT note_revisions_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.commune_notes(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_commitment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_commitment_id_fkey FOREIGN KEY (commitment_id) REFERENCES public.fund_commitments(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_commune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_commune_id_fkey FOREIGN KEY (commune_id) REFERENCES public.communes(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_expense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.expenses(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_reminder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_reminder_id_fkey FOREIGN KEY (reminder_id) REFERENCES public.reminders(id) ON DELETE CASCADE;


--
-- Name: operation_occurrences operation_occurrences_commune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_occurrences
    ADD CONSTRAINT operation_occurrences_commune_id_fkey FOREIGN KEY (commune_id) REFERENCES public.communes(id) ON DELETE CASCADE;


--
-- Name: operation_occurrences operation_occurrences_operation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operation_occurrences
    ADD CONSTRAINT operation_occurrences_operation_id_fkey FOREIGN KEY (operation_id) REFERENCES public.commune_operations(id) ON DELETE CASCADE;


--
-- Name: recurring_bill_occurrences recurring_bill_occurrences_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_bill_occurrences
    ADD CONSTRAINT recurring_bill_occurrences_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.recurring_bills(id);


--
-- Name: recurring_bill_occurrences recurring_bill_occurrences_expense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_bill_occurrences
    ADD CONSTRAINT recurring_bill_occurrences_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.expenses(id);


--
-- Name: recurring_bills recurring_bills_commune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_bills
    ADD CONSTRAINT recurring_bills_commune_id_fkey FOREIGN KEY (commune_id) REFERENCES public.communes(id);


--
-- Name: recurring_bills recurring_bills_commune_id_paid_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_bills
    ADD CONSTRAINT recurring_bills_commune_id_paid_by_user_id_fkey FOREIGN KEY (commune_id, paid_by_user_id) REFERENCES public.commune_members(commune_id, user_id);


--
-- Name: reminder_email_outbox reminder_email_outbox_reminder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminder_email_outbox
    ADD CONSTRAINT reminder_email_outbox_reminder_id_fkey FOREIGN KEY (reminder_id) REFERENCES public.reminders(id) ON DELETE CASCADE;


--
-- Name: reminders reminders_commune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_commune_id_fkey FOREIGN KEY (commune_id) REFERENCES public.communes(id) ON DELETE CASCADE;


--
-- Name: split_templates split_templates_commune_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.split_templates
    ADD CONSTRAINT split_templates_commune_id_fkey FOREIGN KEY (commune_id) REFERENCES public.communes(id);


--
-- Name: client_reports; Type: ROW SECURITY; Schema: commune_private; Owner: -
--

ALTER TABLE commune_private.client_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: commune_changes; Type: ROW SECURITY; Schema: commune_private; Owner: -
--

ALTER TABLE commune_private.commune_changes ENABLE ROW LEVEL SECURITY;

--
-- Name: announcement_acknowledgements announcement_acknowledgement_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY announcement_acknowledgement_read ON public.announcement_acknowledgements FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.commune_announcements a
  WHERE ((a.id = announcement_acknowledgements.announcement_id) AND public.is_commune_member(a.commune_id)))));


--
-- Name: announcement_acknowledgements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcement_acknowledgements ENABLE ROW LEVEL SECURITY;

--
-- Name: commune_announcements announcement_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY announcement_read ON public.commune_announcements FOR SELECT TO authenticated USING (public.is_commune_member(commune_id));


--
-- Name: commune_announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commune_announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: commune_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commune_events ENABLE ROW LEVEL SECURITY;

--
-- Name: commune_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commune_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: commune_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commune_members ENABLE ROW LEVEL SECURITY;

--
-- Name: commune_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commune_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: commune_notes commune_notes_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commune_notes_read ON public.commune_notes FOR SELECT TO authenticated USING ((public.is_commune_member(commune_id) AND (deleted_at IS NULL)));


--
-- Name: commune_operations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commune_operations ENABLE ROW LEVEL SECURITY;

--
-- Name: commune_operations commune_operations_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commune_operations_read ON public.commune_operations FOR SELECT TO authenticated USING ((public.is_commune_member(commune_id) AND (deleted_at IS NULL)));


--
-- Name: communes commune_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commune_read ON public.communes FOR SELECT TO authenticated USING ((id = ANY (( SELECT commune_private.my_commune_ids() AS my_commune_ids)::uuid[])));


--
-- Name: communes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.communes ENABLE ROW LEVEL SECURITY;

--
-- Name: email_suppressions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

--
-- Name: commune_events event_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY event_read ON public.commune_events FOR SELECT TO authenticated USING (public.is_commune_member(commune_id));


--
-- Name: expenses expense_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY expense_read ON public.expenses FOR SELECT TO authenticated USING (public.is_commune_member(commune_id));


--
-- Name: expense_revisions expense_revision_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY expense_revision_read ON public.expense_revisions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.expenses e
  WHERE ((e.id = expense_revisions.expense_id) AND public.is_commune_member(e.commune_id)))));


--
-- Name: expense_revisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expense_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_share_payment_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expense_share_payment_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_shares expense_share_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY expense_share_read ON public.expense_shares FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.expenses e
  WHERE ((e.id = expense_shares.expense_id) AND public.is_commune_member(e.commune_id)))));


--
-- Name: expense_share_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expense_share_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_shares; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expense_shares ENABLE ROW LEVEL SECURITY;

--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: fund_commitments fund_commitment_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fund_commitment_read ON public.fund_commitments FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.funds f
  WHERE ((f.id = fund_commitments.fund_id) AND public.is_commune_member(f.commune_id)))));


--
-- Name: fund_commitments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fund_commitments ENABLE ROW LEVEL SECURITY;

--
-- Name: fund_contributions fund_contribution_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fund_contribution_read ON public.fund_contributions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.fund_commitments c
     JOIN public.funds f ON ((f.id = c.fund_id)))
  WHERE ((c.id = fund_contributions.commitment_id) AND public.is_commune_member(f.commune_id)))));


--
-- Name: fund_contributions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fund_contributions ENABLE ROW LEVEL SECURITY;

--
-- Name: fund_pledge_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fund_pledge_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: funds fund_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fund_read ON public.funds FOR SELECT TO authenticated USING (public.is_commune_member(commune_id));


--
-- Name: funds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.funds ENABLE ROW LEVEL SECURITY;

--
-- Name: invitation_email_deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invitation_email_deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: member_pay_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.member_pay_links ENABLE ROW LEVEL SECURITY;

--
-- Name: commune_members member_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY member_read ON public.commune_members FOR SELECT TO authenticated USING ((commune_id = ANY (( SELECT commune_private.my_commune_ids() AS my_commune_ids)::uuid[])));


--
-- Name: note_revisions note_revision_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY note_revision_read ON public.note_revisions FOR SELECT TO authenticated USING ((public.is_commune_member(commune_id) AND (EXISTS ( SELECT 1
   FROM public.commune_notes n
  WHERE ((n.id = note_revisions.note_id) AND (n.deleted_at IS NULL))))));


--
-- Name: note_revisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.note_revisions ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notification_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_read ON public.notifications FOR SELECT TO authenticated USING ((recipient_user_id = commune_private.data_api_user_id()));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: recurring_bill_occurrences occurrence_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY occurrence_read ON public.recurring_bill_occurrences FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.recurring_bills b
  WHERE ((b.id = recurring_bill_occurrences.bill_id) AND public.is_commune_member(b.commune_id)))));


--
-- Name: operation_occurrences operation_occurrence_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY operation_occurrence_read ON public.operation_occurrences FOR SELECT TO authenticated USING ((public.is_commune_member(commune_id) AND (EXISTS ( SELECT 1
   FROM public.commune_operations o
  WHERE ((o.id = operation_occurrences.operation_id) AND (o.deleted_at IS NULL))))));


--
-- Name: operation_occurrences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.operation_occurrences ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_share_payment_reports payment_report_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_report_read ON public.expense_share_payment_reports FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.expense_shares s
     JOIN public.expenses e ON ((e.id = s.expense_id)))
  WHERE ((s.id = expense_share_payment_reports.share_id) AND public.is_commune_member(e.commune_id)))));


--
-- Name: notification_preferences preferences_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY preferences_insert ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK ((user_id = commune_private.data_api_user_id()));


--
-- Name: notification_preferences preferences_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY preferences_read ON public.notification_preferences FOR SELECT TO authenticated USING ((user_id = commune_private.data_api_user_id()));


--
-- Name: notification_preferences preferences_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY preferences_update ON public.notification_preferences FOR UPDATE TO authenticated USING ((user_id = commune_private.data_api_user_id())) WITH CHECK ((user_id = commune_private.data_api_user_id()));


--
-- Name: expense_share_receipts receipt_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY receipt_read ON public.expense_share_receipts FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.expense_shares s
     JOIN public.expenses e ON ((e.id = s.expense_id)))
  WHERE ((s.id = expense_share_receipts.share_id) AND public.is_commune_member(e.commune_id)))));


--
-- Name: recurring_bill_occurrences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recurring_bill_occurrences ENABLE ROW LEVEL SECURITY;

--
-- Name: recurring_bills; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;

--
-- Name: recurring_bills recurring_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY recurring_read ON public.recurring_bills FOR SELECT TO authenticated USING (public.is_commune_member(commune_id));


--
-- Name: reminder_email_outbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reminder_email_outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: reminders reminder_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reminder_read ON public.reminders FOR SELECT TO authenticated USING (((sender_user_id = commune_private.data_api_user_id()) OR (recipient_user_id = commune_private.data_api_user_id())));


--
-- Name: reminders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

--
-- Name: split_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.split_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: split_templates template_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY template_read ON public.split_templates FOR SELECT TO authenticated USING (public.is_commune_member(commune_id));


--
-- Name: SCHEMA commune_private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA commune_private TO authenticated;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO authenticated;


--
-- Name: FUNCTION gtrgm_in(cstring); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gtrgm_in(cstring) FROM PUBLIC;


--
-- Name: FUNCTION gtrgm_out(public.gtrgm); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gtrgm_out(public.gtrgm) FROM PUBLIC;


--
-- Name: FUNCTION accounts(p_ids text[]); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.accounts(p_ids text[]) FROM PUBLIC;


--
-- Name: FUNCTION activity_record_type(p_event_id uuid); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.activity_record_type(p_event_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION announcement_result(p_id uuid, p_duplicate boolean); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.announcement_result(p_id uuid, p_duplicate boolean) FROM PUBLIC;


--
-- Name: FUNCTION bump_recurring_bill_version(); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.bump_recurring_bill_version() FROM PUBLIC;


--
-- Name: FUNCTION change_mark(p_commune_id uuid); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.change_mark(p_commune_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION check_share_settlement(); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.check_share_settlement() FROM PUBLIC;


--
-- Name: FUNCTION close_payment_reports(); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.close_payment_reports() FROM PUBLIC;


--
-- Name: FUNCTION currency_locked_by(p_commune_id uuid); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.currency_locked_by(p_commune_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION data_api_user_id(); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.data_api_user_id() FROM PUBLIC;
GRANT ALL ON FUNCTION commune_private.data_api_user_id() TO authenticated;


--
-- Name: FUNCTION expense_history(p_commune_id uuid); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.expense_history(p_commune_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION expense_is_voided(p_expense_id uuid); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.expense_is_voided(p_expense_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION expense_records(p_ids uuid[]); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.expense_records(p_ids uuid[]) FROM PUBLIC;


--
-- Name: FUNCTION expense_state(p_expense_id uuid); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.expense_state(p_expense_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION expense_window_start(); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.expense_window_start() FROM PUBLIC;


--
-- Name: FUNCTION format_money(p_minor bigint, p_currency text); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.format_money(p_minor bigint, p_currency text) FROM PUBLIC;


--
-- Name: FUNCTION lock_fund_membership(p_fund_id uuid); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.lock_fund_membership(p_fund_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION looks_like_contact(p_text text); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.looks_like_contact(p_text text) FROM PUBLIC;


--
-- Name: FUNCTION masked_address(p_email text); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.masked_address(p_email text) FROM PUBLIC;


--
-- Name: FUNCTION member_by_name(p_commune_id uuid, p_name text); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.member_by_name(p_commune_id uuid, p_name text) FROM PUBLIC;


--
-- Name: FUNCTION member_name(p_user_id text); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.member_name(p_user_id text) FROM PUBLIC;


--
-- Name: FUNCTION member_names(p_commune_id uuid); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.member_names(p_commune_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION money_correction_reserve(p_kind text, p_description text, p_details jsonb); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.money_correction_reserve(p_kind text, p_description text, p_details jsonb) FROM PUBLIC;


--
-- Name: FUNCTION my_commune_ids(); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.my_commune_ids() FROM PUBLIC;
GRANT ALL ON FUNCTION commune_private.my_commune_ids() TO authenticated;


--
-- Name: FUNCTION next_in_rotation(p_commune_id uuid, p_rotation jsonb, p_current text); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.next_in_rotation(p_commune_id uuid, p_rotation jsonb, p_current text) FROM PUBLIC;


--
-- Name: FUNCTION next_operation_version(); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.next_operation_version() FROM PUBLIC;


--
-- Name: FUNCTION note_commune_change(); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.note_commune_change() FROM PUBLIC;


--
-- Name: FUNCTION note_content(p_title text, p_pill text, p_kicker text, p_lede text, p_body text, p_facts jsonb); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.note_content(p_title text, p_pill text, p_kicker text, p_lede text, p_body text, p_facts jsonb) FROM PUBLIC;


--
-- Name: FUNCTION note_search_excerpt(p_pill text, p_body text, p_lede text, p_facts jsonb); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.note_search_excerpt(p_pill text, p_body text, p_lede text, p_facts jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION commune_private.note_search_excerpt(p_pill text, p_body text, p_lede text, p_facts jsonb) TO authenticated;


--
-- Name: FUNCTION notify_ledger(p_commune_id uuid, p_recipient text, p_kind text, p_expense_id uuid, p_actor text, p_amount_minor bigint, p_detail text); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.notify_ledger(p_commune_id uuid, p_recipient text, p_kind text, p_expense_id uuid, p_actor text, p_amount_minor bigint, p_detail text) FROM PUBLIC;


--
-- Name: FUNCTION notify_pledge(p_commune_id uuid, p_recipient text, p_kind text, p_commitment_id uuid, p_actor text, p_amount_minor bigint, p_detail text); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.notify_pledge(p_commune_id uuid, p_recipient text, p_kind text, p_commitment_id uuid, p_actor text, p_amount_minor bigint, p_detail text) FROM PUBLIC;


--
-- Name: FUNCTION occurrence_reason(p_reason text); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.occurrence_reason(p_reason text) FROM PUBLIC;


--
-- Name: FUNCTION occurrence_result(p_id uuid, p_duplicate boolean, p_operation_id uuid); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.occurrence_result(p_id uuid, p_duplicate boolean, p_operation_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION operation_content(p_kind text, p_category text, p_title text, p_date date, p_time time without time zone, p_all_day boolean, p_assignee_id text, p_rotation_ids jsonb, p_repeat text, p_notes text); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.operation_content(p_kind text, p_category text, p_title text, p_date date, p_time time without time zone, p_all_day boolean, p_assignee_id text, p_rotation_ids jsonb, p_repeat text, p_notes text) FROM PUBLIC;


--
-- Name: FUNCTION pay_links_for(p_user_id text); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.pay_links_for(p_user_id text) FROM PUBLIC;


--
-- Name: FUNCTION payment_report_result(p_id uuid, p_duplicate boolean); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.payment_report_result(p_id uuid, p_duplicate boolean) FROM PUBLIC;


--
-- Name: FUNCTION project_share_settlement(p_share_id uuid); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.project_share_settlement(p_share_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION prune_delivery_records(); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.prune_delivery_records() FROM PUBLIC;


--
-- Name: FUNCTION reassign_departed_member(); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.reassign_departed_member() FROM PUBLIC;


--
-- Name: FUNCTION record_commune_change(); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.record_commune_change() FROM PUBLIC;


--
-- Name: FUNCTION record_note_revision(); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.record_note_revision() FROM PUBLIC;


--
-- Name: FUNCTION record_receipt_event(); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.record_receipt_event() FROM PUBLIC;


--
-- Name: FUNCTION recurring_bill_result(p_id uuid, p_duplicate boolean); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.recurring_bill_result(p_id uuid, p_duplicate boolean) FROM PUBLIC;


--
-- Name: FUNCTION recurring_departed_names(p_commune_id uuid, p_paid_by text, p_shares jsonb); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.recurring_departed_names(p_commune_id uuid, p_paid_by text, p_shares jsonb) FROM PUBLIC;


--
-- Name: FUNCTION recurring_next_due(p_frequency text, p_due date, p_anchor_day integer); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.recurring_next_due(p_frequency text, p_due date, p_anchor_day integer) FROM PUBLIC;


--
-- Name: FUNCTION recurring_period_result(p_bill_id uuid, p_due date, p_duplicate boolean); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.recurring_period_result(p_bill_id uuid, p_due date, p_duplicate boolean) FROM PUBLIC;


--
-- Name: FUNCTION reminder_email_state(p_reminder_id uuid); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.reminder_email_state(p_reminder_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION report_text(p_text text, p_limit integer); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.report_text(p_text text, p_limit integer) FROM PUBLIC;


--
-- Name: FUNCTION revoke_orphaned_invites(p_commune_id uuid); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.revoke_orphaned_invites(p_commune_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION scale_recurring_shares(p_shares jsonb, p_amount_minor bigint); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.scale_recurring_shares(p_shares jsonb, p_amount_minor bigint) FROM PUBLIC;


--
-- Name: FUNCTION set_operation_anchor(); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.set_operation_anchor() FROM PUBLIC;


--
-- Name: FUNCTION set_operation_people(); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.set_operation_people() FROM PUBLIC;


--
-- Name: FUNCTION snapshot_announcements(p_commune_id uuid); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.snapshot_announcements(p_commune_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION snapshot_expense_ids(p_commune_id uuid, p_since timestamp with time zone); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.snapshot_expense_ids(p_commune_id uuid, p_since timestamp with time zone) FROM PUBLIC;


--
-- Name: FUNCTION snapshot_expenses(p_commune_id uuid); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.snapshot_expenses(p_commune_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION snapshot_notifications(p_commune_id uuid, p_actor text); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.snapshot_notifications(p_commune_id uuid, p_actor text) FROM PUBLIC;


--
-- Name: FUNCTION snapshot_operations(p_commune_id uuid); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.snapshot_operations(p_commune_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION snapshot_pay_links(p_commune_id uuid); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.snapshot_pay_links(p_commune_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION snapshot_sent_reminders(p_commune_id uuid, p_actor text); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.snapshot_sent_reminders(p_commune_id uuid, p_actor text) FROM PUBLIC;


--
-- Name: FUNCTION start_note_version(); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.start_note_version() FROM PUBLIC;


--
-- Name: FUNCTION unread_notice_count(p_commune_id uuid, p_user_id text); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.unread_notice_count(p_commune_id uuid, p_user_id text) FROM PUBLIC;


--
-- Name: FUNCTION validate_expense_split(p_commune_id uuid, p_amount bigint, p_shares jsonb); Type: ACL; Schema: commune_private; Owner: -
--

REVOKE ALL ON FUNCTION commune_private.validate_expense_split(p_commune_id uuid, p_amount bigint, p_shares jsonb) FROM PUBLIC;


--
-- Name: FUNCTION accept_commune_invite(p_token text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.accept_commune_invite(p_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.accept_commune_invite(p_token text) TO authenticated;


--
-- Name: FUNCTION acknowledge_announcement(p_announcement_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.acknowledge_announcement(p_announcement_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.acknowledge_announcement(p_announcement_id uuid) TO authenticated;


--
-- Name: FUNCTION archive_announcement(p_announcement_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.archive_announcement(p_announcement_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.archive_announcement(p_announcement_id uuid) TO authenticated;


--
-- Name: FUNCTION armor(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.armor(bytea) FROM PUBLIC;


--
-- Name: FUNCTION armor(bytea, text[], text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.armor(bytea, text[], text[]) FROM PUBLIC;


--
-- Name: FUNCTION commune_expense_page(p_commune_id uuid, p_before date, p_months integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.commune_expense_page(p_commune_id uuid, p_before date, p_months integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.commune_expense_page(p_commune_id uuid, p_before date, p_months integer) TO authenticated;


--
-- Name: FUNCTION commune_expense_records(p_commune_id uuid, p_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.commune_expense_records(p_commune_id uuid, p_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.commune_expense_records(p_commune_id uuid, p_ids uuid[]) TO authenticated;


--
-- Name: FUNCTION commune_snapshot(p_commune_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.commune_snapshot(p_commune_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.commune_snapshot(p_commune_id uuid) TO authenticated;


--
-- Name: FUNCTION commune_summary(p_commune_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.commune_summary(p_commune_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.commune_summary(p_commune_id uuid) TO authenticated;


--
-- Name: FUNCTION confirm_expense_share(p_share_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.confirm_expense_share(p_share_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.confirm_expense_share(p_share_id uuid) TO authenticated;


--
-- Name: FUNCTION correct_expense(p_expense_id uuid, p_expected_version integer, p_title text, p_amount_minor bigint, p_shares jsonb, p_due_on date, p_paid_by text, p_category text, p_reason text, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.correct_expense(p_expense_id uuid, p_expected_version integer, p_title text, p_amount_minor bigint, p_shares jsonb, p_due_on date, p_paid_by text, p_category text, p_reason text, p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.correct_expense(p_expense_id uuid, p_expected_version integer, p_title text, p_amount_minor bigint, p_shares jsonb, p_due_on date, p_paid_by text, p_category text, p_reason text, p_request_id uuid) TO authenticated;


--
-- Name: FUNCTION create_commune(p_name text, p_kind text, p_currency text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_commune(p_name text, p_kind text, p_currency text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_commune(p_name text, p_kind text, p_currency text) TO authenticated;


--
-- Name: FUNCTION create_commune_invite(p_commune_id uuid, p_email text, p_role text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_commune_invite(p_commune_id uuid, p_email text, p_role text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_commune_invite(p_commune_id uuid, p_email text, p_role text) TO authenticated;


--
-- Name: FUNCTION create_commune_with_location(p_name text, p_kind text, p_currency text, p_address text, p_destination text, p_stay_name text, p_stay_address text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_commune_with_location(p_name text, p_kind text, p_currency text, p_address text, p_destination text, p_stay_name text, p_stay_address text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_commune_with_location(p_name text, p_kind text, p_currency text, p_address text, p_destination text, p_stay_name text, p_stay_address text) TO authenticated;


--
-- Name: FUNCTION create_expense(p_commune_id uuid, p_title text, p_amount_minor bigint, p_shares jsonb, p_due_on date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_expense(p_commune_id uuid, p_title text, p_amount_minor bigint, p_shares jsonb, p_due_on date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_expense(p_commune_id uuid, p_title text, p_amount_minor bigint, p_shares jsonb, p_due_on date) TO authenticated;


--
-- Name: FUNCTION create_expense_command(p_commune_id uuid, p_title text, p_amount_minor bigint, p_shares jsonb, p_due_on date, p_paid_by text, p_category text, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_expense_command(p_commune_id uuid, p_title text, p_amount_minor bigint, p_shares jsonb, p_due_on date, p_paid_by text, p_category text, p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_expense_command(p_commune_id uuid, p_title text, p_amount_minor bigint, p_shares jsonb, p_due_on date, p_paid_by text, p_category text, p_request_id uuid) TO authenticated;


--
-- Name: FUNCTION create_expense_for(p_commune_id uuid, p_title text, p_amount_minor bigint, p_shares jsonb, p_due_on date, p_paid_by text, p_category text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_expense_for(p_commune_id uuid, p_title text, p_amount_minor bigint, p_shares jsonb, p_due_on date, p_paid_by text, p_category text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_expense_for(p_commune_id uuid, p_title text, p_amount_minor bigint, p_shares jsonb, p_due_on date, p_paid_by text, p_category text) TO authenticated;


--
-- Name: FUNCTION create_fund(p_commune_id uuid, p_name text, p_target_minor bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_fund(p_commune_id uuid, p_name text, p_target_minor bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_fund(p_commune_id uuid, p_name text, p_target_minor bigint) TO authenticated;


--
-- Name: FUNCTION create_fund_command(p_commune_id uuid, p_name text, p_target_minor bigint, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_fund_command(p_commune_id uuid, p_name text, p_target_minor bigint, p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_fund_command(p_commune_id uuid, p_name text, p_target_minor bigint, p_request_id uuid) TO authenticated;


--
-- Name: FUNCTION create_note(p_commune_id uuid, p_title text, p_pill text, p_kicker text, p_lede text, p_body text, p_facts jsonb, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_note(p_commune_id uuid, p_title text, p_pill text, p_kicker text, p_lede text, p_body text, p_facts jsonb, p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_note(p_commune_id uuid, p_title text, p_pill text, p_kicker text, p_lede text, p_body text, p_facts jsonb, p_request_id uuid) TO authenticated;


--
-- Name: FUNCTION create_operation(p_commune_id uuid, p_kind text, p_category text, p_title text, p_date date, p_time time without time zone, p_all_day boolean, p_assignee_id text, p_rotation_ids jsonb, p_repeat text, p_notes text, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_operation(p_commune_id uuid, p_kind text, p_category text, p_title text, p_date date, p_time time without time zone, p_all_day boolean, p_assignee_id text, p_rotation_ids jsonb, p_repeat text, p_notes text, p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_operation(p_commune_id uuid, p_kind text, p_category text, p_title text, p_date date, p_time time without time zone, p_all_day boolean, p_assignee_id text, p_rotation_ids jsonb, p_repeat text, p_notes text, p_request_id uuid) TO authenticated;


--
-- Name: FUNCTION crypt(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.crypt(text, text) FROM PUBLIC;


--
-- Name: FUNCTION dearmor(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.dearmor(text) FROM PUBLIC;


--
-- Name: FUNCTION decrypt(bytea, bytea, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.decrypt(bytea, bytea, text) FROM PUBLIC;


--
-- Name: FUNCTION decrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.decrypt_iv(bytea, bytea, bytea, text) FROM PUBLIC;


--
-- Name: FUNCTION digest(bytea, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.digest(bytea, text) FROM PUBLIC;


--
-- Name: FUNCTION digest(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.digest(text, text) FROM PUBLIC;


--
-- Name: FUNCTION encrypt(bytea, bytea, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.encrypt(bytea, bytea, text) FROM PUBLIC;


--
-- Name: FUNCTION encrypt_iv(bytea, bytea, bytea, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.encrypt_iv(bytea, bytea, bytea, text) FROM PUBLIC;


--
-- Name: FUNCTION gen_random_bytes(integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gen_random_bytes(integer) FROM PUBLIC;


--
-- Name: FUNCTION gen_random_uuid(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gen_random_uuid() FROM PUBLIC;


--
-- Name: FUNCTION gen_salt(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gen_salt(text) FROM PUBLIC;


--
-- Name: FUNCTION gen_salt(text, integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gen_salt(text, integer) FROM PUBLIC;


--
-- Name: FUNCTION gin_extract_query_trgm(text, internal, smallint, internal, internal, internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gin_extract_query_trgm(text, internal, smallint, internal, internal, internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION gin_extract_value_trgm(text, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gin_extract_value_trgm(text, internal) FROM PUBLIC;


--
-- Name: FUNCTION gin_trgm_consistent(internal, smallint, text, integer, internal, internal, internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gin_trgm_consistent(internal, smallint, text, integer, internal, internal, internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION gin_trgm_triconsistent(internal, smallint, text, integer, internal, internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gin_trgm_triconsistent(internal, smallint, text, integer, internal, internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION gtrgm_compress(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gtrgm_compress(internal) FROM PUBLIC;


--
-- Name: FUNCTION gtrgm_consistent(internal, text, smallint, oid, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gtrgm_consistent(internal, text, smallint, oid, internal) FROM PUBLIC;


--
-- Name: FUNCTION gtrgm_decompress(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gtrgm_decompress(internal) FROM PUBLIC;


--
-- Name: FUNCTION gtrgm_distance(internal, text, smallint, oid, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gtrgm_distance(internal, text, smallint, oid, internal) FROM PUBLIC;


--
-- Name: FUNCTION gtrgm_options(internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gtrgm_options(internal) FROM PUBLIC;


--
-- Name: FUNCTION gtrgm_penalty(internal, internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gtrgm_penalty(internal, internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION gtrgm_picksplit(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gtrgm_picksplit(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION gtrgm_same(public.gtrgm, public.gtrgm, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gtrgm_same(public.gtrgm, public.gtrgm, internal) FROM PUBLIC;


--
-- Name: FUNCTION gtrgm_union(internal, internal); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gtrgm_union(internal, internal) FROM PUBLIC;


--
-- Name: FUNCTION hand_over_operation(p_operation_id uuid, p_to_member_id text, p_expected_date date, p_expected_assignee_id text, p_today date, p_reason text, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.hand_over_operation(p_operation_id uuid, p_to_member_id text, p_expected_date date, p_expected_assignee_id text, p_today date, p_reason text, p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.hand_over_operation(p_operation_id uuid, p_to_member_id text, p_expected_date date, p_expected_assignee_id text, p_today date, p_reason text, p_request_id uuid) TO authenticated;


--
-- Name: FUNCTION hmac(bytea, bytea, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.hmac(bytea, bytea, text) FROM PUBLIC;


--
-- Name: FUNCTION hmac(text, text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.hmac(text, text, text) FROM PUBLIC;


--
-- Name: FUNCTION invite_address_hint(p_token text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.invite_address_hint(p_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.invite_address_hint(p_token text) TO authenticated;


--
-- Name: FUNCTION is_commune_admin(p_commune_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_commune_admin(p_commune_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_commune_admin(p_commune_id uuid) TO authenticated;


--
-- Name: FUNCTION is_commune_member(p_commune_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_commune_member(p_commune_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_commune_member(p_commune_id uuid) TO authenticated;


--
-- Name: FUNCTION list_commune_invites(p_commune_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.list_commune_invites(p_commune_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.list_commune_invites(p_commune_id uuid) TO authenticated;


--
-- Name: FUNCTION list_reminder_targets(p_commune_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.list_reminder_targets(p_commune_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.list_reminder_targets(p_commune_id uuid) TO authenticated;


--
-- Name: FUNCTION manage_commune_member(p_commune_id uuid, p_user_id text, p_action text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.manage_commune_member(p_commune_id uuid, p_user_id text, p_action text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.manage_commune_member(p_commune_id uuid, p_user_id text, p_action text) TO authenticated;


--
-- Name: FUNCTION mark_notification_read(p_notification_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_notification_read(p_notification_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_notification_read(p_notification_id uuid) TO authenticated;


--
-- Name: FUNCTION member_profiles(p_commune_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.member_profiles(p_commune_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.member_profiles(p_commune_id uuid) TO authenticated;


--
-- Name: FUNCTION member_profiles_with_status(p_commune_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.member_profiles_with_status(p_commune_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.member_profiles_with_status(p_commune_id uuid) TO authenticated;


--
-- Name: FUNCTION my_communes(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_communes() FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_communes() TO authenticated;


--
-- Name: FUNCTION my_pay_links(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_pay_links() FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_pay_links() TO authenticated;


--
-- Name: FUNCTION my_unread_notices(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.my_unread_notices() FROM PUBLIC;
GRANT ALL ON FUNCTION public.my_unread_notices() TO authenticated;


--
-- Name: FUNCTION pgp_armor_headers(text, OUT key text, OUT value text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgp_armor_headers(text, OUT key text, OUT value text) FROM PUBLIC;


--
-- Name: FUNCTION pgp_key_id(bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgp_key_id(bytea) FROM PUBLIC;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgp_pub_decrypt(bytea, bytea) FROM PUBLIC;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgp_pub_decrypt(bytea, bytea, text) FROM PUBLIC;


--
-- Name: FUNCTION pgp_pub_decrypt(bytea, bytea, text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgp_pub_decrypt(bytea, bytea, text, text) FROM PUBLIC;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea) FROM PUBLIC;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea, text) FROM PUBLIC;


--
-- Name: FUNCTION pgp_pub_decrypt_bytea(bytea, bytea, text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea, text, text) FROM PUBLIC;


--
-- Name: FUNCTION pgp_pub_encrypt(text, bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgp_pub_encrypt(text, bytea) FROM PUBLIC;


--
-- Name: FUNCTION pgp_pub_encrypt(text, bytea, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgp_pub_encrypt(text, bytea, text) FROM PUBLIC;


--
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgp_pub_encrypt_bytea(bytea, bytea) FROM PUBLIC;


--
-- Name: FUNCTION pgp_pub_encrypt_bytea(bytea, bytea, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgp_pub_encrypt_bytea(bytea, bytea, text) FROM PUBLIC;


--
-- Name: FUNCTION pgp_sym_decrypt(bytea, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgp_sym_decrypt(bytea, text) FROM PUBLIC;


--
-- Name: FUNCTION pgp_sym_decrypt(bytea, text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgp_sym_decrypt(bytea, text, text) FROM PUBLIC;


--
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgp_sym_decrypt_bytea(bytea, text) FROM PUBLIC;


--
-- Name: FUNCTION pgp_sym_decrypt_bytea(bytea, text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgp_sym_decrypt_bytea(bytea, text, text) FROM PUBLIC;


--
-- Name: FUNCTION pgp_sym_encrypt(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgp_sym_encrypt(text, text) FROM PUBLIC;


--
-- Name: FUNCTION pgp_sym_encrypt(text, text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgp_sym_encrypt(text, text, text) FROM PUBLIC;


--
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgp_sym_encrypt_bytea(bytea, text) FROM PUBLIC;


--
-- Name: FUNCTION pgp_sym_encrypt_bytea(bytea, text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pgp_sym_encrypt_bytea(bytea, text, text) FROM PUBLIC;


--
-- Name: FUNCTION pledge_fund(p_fund_id uuid, p_amount_minor bigint, p_due_on date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pledge_fund(p_fund_id uuid, p_amount_minor bigint, p_due_on date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pledge_fund(p_fund_id uuid, p_amount_minor bigint, p_due_on date) TO authenticated;


--
-- Name: FUNCTION pledge_fund_command(p_fund_id uuid, p_amount_minor bigint, p_due_on date, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pledge_fund_command(p_fund_id uuid, p_amount_minor bigint, p_due_on date, p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pledge_fund_command(p_fund_id uuid, p_amount_minor bigint, p_due_on date, p_request_id uuid) TO authenticated;


--
-- Name: FUNCTION post_announcement(p_commune_id uuid, p_title text, p_body text, p_needs_acknowledgement boolean, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.post_announcement(p_commune_id uuid, p_title text, p_body text, p_needs_acknowledgement boolean, p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.post_announcement(p_commune_id uuid, p_title text, p_body text, p_needs_acknowledgement boolean, p_request_id uuid) TO authenticated;


--
-- Name: FUNCTION preview_commune_invite(p_token text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.preview_commune_invite(p_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.preview_commune_invite(p_token text) TO authenticated;


--
-- Name: FUNCTION record_fund_contribution(p_commitment_id uuid, p_amount_minor bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_fund_contribution(p_commitment_id uuid, p_amount_minor bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_fund_contribution(p_commitment_id uuid, p_amount_minor bigint) TO authenticated;


--
-- Name: FUNCTION record_fund_contribution_command(p_commitment_id uuid, p_amount_minor bigint, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_fund_contribution_command(p_commitment_id uuid, p_amount_minor bigint, p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_fund_contribution_command(p_commitment_id uuid, p_amount_minor bigint, p_request_id uuid) TO authenticated;


--
-- Name: FUNCTION record_operation_occurrence(p_operation_id uuid, p_action text, p_expected_date date, p_today date, p_request_id uuid, p_reason text, p_done_by text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_operation_occurrence(p_operation_id uuid, p_action text, p_expected_date date, p_today date, p_request_id uuid, p_reason text, p_done_by text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_operation_occurrence(p_operation_id uuid, p_action text, p_expected_date date, p_today date, p_request_id uuid, p_reason text, p_done_by text) TO authenticated;


--
-- Name: FUNCTION record_recurring_bill(p_id uuid, p_expected_due_on date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_recurring_bill(p_id uuid, p_expected_due_on date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_recurring_bill(p_id uuid, p_expected_due_on date) TO authenticated;


--
-- Name: FUNCTION record_recurring_period(p_id uuid, p_expected_due_on date, p_amount_minor bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_recurring_period(p_id uuid, p_expected_due_on date, p_amount_minor bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_recurring_period(p_id uuid, p_expected_due_on date, p_amount_minor bigint) TO authenticated;


--
-- Name: FUNCTION record_share_receipt(p_share_id uuid, p_amount_minor bigint, p_received_on date, p_reference text, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_share_receipt(p_share_id uuid, p_amount_minor bigint, p_received_on date, p_reference text, p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_share_receipt(p_share_id uuid, p_amount_minor bigint, p_received_on date, p_reference text, p_request_id uuid) TO authenticated;


--
-- Name: FUNCTION reminder_usage(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reminder_usage() FROM PUBLIC;
GRANT ALL ON FUNCTION public.reminder_usage() TO authenticated;


--
-- Name: FUNCTION remove_note(p_note_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remove_note(p_note_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remove_note(p_note_id uuid) TO authenticated;


--
-- Name: FUNCTION remove_operation(p_operation_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remove_operation(p_operation_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remove_operation(p_operation_id uuid) TO authenticated;


--
-- Name: FUNCTION remove_pay_link(p_provider text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remove_pay_link(p_provider text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remove_pay_link(p_provider text) TO authenticated;


--
-- Name: FUNCTION report_client_event(p_kind text, p_release text, p_route text, p_browser text, p_message text, p_stack text, p_lcp_ms integer, p_inp_ms integer, p_cls numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.report_client_event(p_kind text, p_release text, p_route text, p_browser text, p_message text, p_stack text, p_lcp_ms integer, p_inp_ms integer, p_cls numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.report_client_event(p_kind text, p_release text, p_route text, p_browser text, p_message text, p_stack text, p_lcp_ms integer, p_inp_ms integer, p_cls numeric) TO authenticated;


--
-- Name: FUNCTION report_share_payment(p_share_id uuid, p_amount_minor bigint, p_sent_on date, p_reference text, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.report_share_payment(p_share_id uuid, p_amount_minor bigint, p_sent_on date, p_reference text, p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.report_share_payment(p_share_id uuid, p_amount_minor bigint, p_sent_on date, p_reference text, p_request_id uuid) TO authenticated;


--
-- Name: FUNCTION resolve_share_payment_report(p_report_id uuid, p_decision text, p_note text, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.resolve_share_payment_report(p_report_id uuid, p_decision text, p_note text, p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.resolve_share_payment_report(p_report_id uuid, p_decision text, p_note text, p_request_id uuid) TO authenticated;


--
-- Name: FUNCTION reverse_share_receipt(p_receipt_id uuid, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reverse_share_receipt(p_receipt_id uuid, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reverse_share_receipt(p_receipt_id uuid, p_reason text) TO authenticated;


--
-- Name: FUNCTION revoke_commune_invite(p_invite_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.revoke_commune_invite(p_invite_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.revoke_commune_invite(p_invite_id uuid) TO authenticated;


--
-- Name: FUNCTION save_recurring_bill(p_commune_id uuid, p_title text, p_amount_minor bigint, p_paid_by text, p_shares jsonb, p_frequency text, p_next_due_on date, p_id uuid, p_expected_version integer, p_request_id uuid, p_paused boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_recurring_bill(p_commune_id uuid, p_title text, p_amount_minor bigint, p_paid_by text, p_shares jsonb, p_frequency text, p_next_due_on date, p_id uuid, p_expected_version integer, p_request_id uuid, p_paused boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_recurring_bill(p_commune_id uuid, p_title text, p_amount_minor bigint, p_paid_by text, p_shares jsonb, p_frequency text, p_next_due_on date, p_id uuid, p_expected_version integer, p_request_id uuid, p_paused boolean) TO authenticated;


--
-- Name: FUNCTION save_split_template(p_commune_id uuid, p_name text, p_method text, p_participants jsonb, p_id uuid, p_archived boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.save_split_template(p_commune_id uuid, p_name text, p_method text, p_participants jsonb, p_id uuid, p_archived boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.save_split_template(p_commune_id uuid, p_name text, p_method text, p_participants jsonb, p_id uuid, p_archived boolean) TO authenticated;


--
-- Name: FUNCTION search_commune_records(p_query text, p_commune_id uuid, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.search_commune_records(p_query text, p_commune_id uuid, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.search_commune_records(p_query text, p_commune_id uuid, p_limit integer) TO authenticated;


--
-- Name: FUNCTION send_reminder(p_kind text, p_source_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.send_reminder(p_kind text, p_source_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.send_reminder(p_kind text, p_source_id uuid) TO authenticated;


--
-- Name: FUNCTION send_reminder_command(p_kind text, p_source_id uuid, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.send_reminder_command(p_kind text, p_source_id uuid, p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.send_reminder_command(p_kind text, p_source_id uuid, p_request_id uuid) TO authenticated;


--
-- Name: FUNCTION set_email_reminders(p_enabled boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_email_reminders(p_enabled boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_email_reminders(p_enabled boolean) TO authenticated;


--
-- Name: FUNCTION set_fund_archived(p_fund_id uuid, p_archived boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_fund_archived(p_fund_id uuid, p_archived boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_fund_archived(p_fund_id uuid, p_archived boolean) TO authenticated;


--
-- Name: FUNCTION set_limit(real); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_limit(real) FROM PUBLIC;


--
-- Name: FUNCTION set_pay_link(p_provider text, p_handle text, p_account_name text, p_sort_code text, p_account_number text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_pay_link(p_provider text, p_handle text, p_account_name text, p_sort_code text, p_account_number text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_pay_link(p_provider text, p_handle text, p_account_name text, p_sort_code text, p_account_number text) TO authenticated;


--
-- Name: FUNCTION set_preferred_pay_link(p_provider text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_preferred_pay_link(p_provider text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_preferred_pay_link(p_provider text) TO authenticated;


--
-- Name: FUNCTION set_recurring_bill_archived(p_id uuid, p_archived boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_recurring_bill_archived(p_id uuid, p_archived boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_recurring_bill_archived(p_id uuid, p_archived boolean) TO authenticated;


--
-- Name: FUNCTION set_recurring_bill_paused(p_id uuid, p_paused boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_recurring_bill_paused(p_id uuid, p_paused boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_recurring_bill_paused(p_id uuid, p_paused boolean) TO authenticated;


--
-- Name: FUNCTION show_limit(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.show_limit() FROM PUBLIC;


--
-- Name: FUNCTION show_trgm(text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.show_trgm(text) FROM PUBLIC;


--
-- Name: FUNCTION similarity(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.similarity(text, text) FROM PUBLIC;


--
-- Name: FUNCTION similarity_dist(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.similarity_dist(text, text) FROM PUBLIC;


--
-- Name: FUNCTION similarity_op(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.similarity_op(text, text) FROM PUBLIC;


--
-- Name: FUNCTION skip_recurring_period(p_id uuid, p_expected_due_on date, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.skip_recurring_period(p_id uuid, p_expected_due_on date, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.skip_recurring_period(p_id uuid, p_expected_due_on date, p_reason text) TO authenticated;


--
-- Name: FUNCTION strict_word_similarity(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.strict_word_similarity(text, text) FROM PUBLIC;


--
-- Name: FUNCTION strict_word_similarity_commutator_op(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.strict_word_similarity_commutator_op(text, text) FROM PUBLIC;


--
-- Name: FUNCTION strict_word_similarity_dist_commutator_op(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.strict_word_similarity_dist_commutator_op(text, text) FROM PUBLIC;


--
-- Name: FUNCTION strict_word_similarity_dist_op(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.strict_word_similarity_dist_op(text, text) FROM PUBLIC;


--
-- Name: FUNCTION strict_word_similarity_op(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.strict_word_similarity_op(text, text) FROM PUBLIC;


--
-- Name: FUNCTION undo_operation_occurrence(p_occurrence_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.undo_operation_occurrence(p_occurrence_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.undo_operation_occurrence(p_occurrence_id uuid) TO authenticated;


--
-- Name: FUNCTION update_commune_details(p_commune_id uuid, p_name text, p_kind text, p_currency text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_commune_details(p_commune_id uuid, p_name text, p_kind text, p_currency text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_commune_details(p_commune_id uuid, p_name text, p_kind text, p_currency text) TO authenticated;


--
-- Name: FUNCTION update_commune_location(p_commune_id uuid, p_address text, p_destination text, p_stay_name text, p_stay_address text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_commune_location(p_commune_id uuid, p_address text, p_destination text, p_stay_name text, p_stay_address text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_commune_location(p_commune_id uuid, p_address text, p_destination text, p_stay_name text, p_stay_address text) TO authenticated;


--
-- Name: FUNCTION update_commune_with_location(p_commune_id uuid, p_name text, p_kind text, p_currency text, p_address text, p_destination text, p_stay_name text, p_stay_address text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_commune_with_location(p_commune_id uuid, p_name text, p_kind text, p_currency text, p_address text, p_destination text, p_stay_name text, p_stay_address text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_commune_with_location(p_commune_id uuid, p_name text, p_kind text, p_currency text, p_address text, p_destination text, p_stay_name text, p_stay_address text) TO authenticated;


--
-- Name: FUNCTION update_fund(p_fund_id uuid, p_name text, p_target_minor bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_fund(p_fund_id uuid, p_name text, p_target_minor bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_fund(p_fund_id uuid, p_name text, p_target_minor bigint) TO authenticated;


--
-- Name: FUNCTION update_fund_pledge(p_commitment_id uuid, p_amount_minor bigint, p_due_on date, p_cancel boolean, p_expected_amount_minor bigint, p_expected_due_on date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_fund_pledge(p_commitment_id uuid, p_amount_minor bigint, p_due_on date, p_cancel boolean, p_expected_amount_minor bigint, p_expected_due_on date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_fund_pledge(p_commitment_id uuid, p_amount_minor bigint, p_due_on date, p_cancel boolean, p_expected_amount_minor bigint, p_expected_due_on date) TO authenticated;


--
-- Name: FUNCTION update_note(p_note_id uuid, p_expected_version integer, p_title text, p_pill text, p_kicker text, p_lede text, p_body text, p_facts jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_note(p_note_id uuid, p_expected_version integer, p_title text, p_pill text, p_kicker text, p_lede text, p_body text, p_facts jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_note(p_note_id uuid, p_expected_version integer, p_title text, p_pill text, p_kicker text, p_lede text, p_body text, p_facts jsonb) TO authenticated;


--
-- Name: FUNCTION update_operation(p_operation_id uuid, p_expected_version integer, p_kind text, p_category text, p_title text, p_date date, p_time time without time zone, p_all_day boolean, p_assignee_id text, p_rotation_ids jsonb, p_repeat text, p_notes text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_operation(p_operation_id uuid, p_expected_version integer, p_kind text, p_category text, p_title text, p_date date, p_time time without time zone, p_all_day boolean, p_assignee_id text, p_rotation_ids jsonb, p_repeat text, p_notes text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_operation(p_operation_id uuid, p_expected_version integer, p_kind text, p_category text, p_title text, p_date date, p_time time without time zone, p_all_day boolean, p_assignee_id text, p_rotation_ids jsonb, p_repeat text, p_notes text) TO authenticated;


--
-- Name: FUNCTION valid_note_facts(p_facts jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.valid_note_facts(p_facts jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.valid_note_facts(p_facts jsonb) TO authenticated;


--
-- Name: FUNCTION valid_operation_last_done(p_last_done jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.valid_operation_last_done(p_last_done jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.valid_operation_last_done(p_last_done jsonb) TO authenticated;


--
-- Name: FUNCTION valid_operation_member_ids(p_ids jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.valid_operation_member_ids(p_ids jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.valid_operation_member_ids(p_ids jsonb) TO authenticated;


--
-- Name: FUNCTION valid_operation_rotation(p_rotation jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.valid_operation_rotation(p_rotation jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.valid_operation_rotation(p_rotation jsonb) TO authenticated;


--
-- Name: FUNCTION void_expense(p_expense_id uuid, p_expected_version integer, p_reason text, p_request_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.void_expense(p_expense_id uuid, p_expected_version integer, p_reason text, p_request_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.void_expense(p_expense_id uuid, p_expected_version integer, p_reason text, p_request_id uuid) TO authenticated;


--
-- Name: FUNCTION void_fund_contribution(p_contribution_id uuid, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.void_fund_contribution(p_contribution_id uuid, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.void_fund_contribution(p_contribution_id uuid, p_reason text) TO authenticated;


--
-- Name: FUNCTION withdraw_share_payment_report(p_report_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.withdraw_share_payment_report(p_report_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.withdraw_share_payment_report(p_report_id uuid) TO authenticated;


--
-- Name: FUNCTION word_similarity(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.word_similarity(text, text) FROM PUBLIC;


--
-- Name: FUNCTION word_similarity_commutator_op(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.word_similarity_commutator_op(text, text) FROM PUBLIC;


--
-- Name: FUNCTION word_similarity_dist_commutator_op(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.word_similarity_dist_commutator_op(text, text) FROM PUBLIC;


--
-- Name: FUNCTION word_similarity_dist_op(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.word_similarity_dist_op(text, text) FROM PUBLIC;


--
-- Name: FUNCTION word_similarity_op(text, text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.word_similarity_op(text, text) FROM PUBLIC;


--
-- Name: TABLE announcement_acknowledgements; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.announcement_acknowledgements TO authenticated;


--
-- Name: TABLE commune_announcements; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.commune_announcements TO authenticated;


--
-- Name: TABLE commune_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.commune_events TO authenticated;


--
-- Name: TABLE commune_members; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.commune_members TO authenticated;


--
-- Name: TABLE commune_notes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.commune_notes TO authenticated;


--
-- Name: TABLE commune_operations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.commune_operations TO authenticated;


--
-- Name: TABLE communes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.communes TO authenticated;


--
-- Name: TABLE expense_revisions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.expense_revisions TO authenticated;


--
-- Name: TABLE expense_share_payment_reports; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.expense_share_payment_reports TO authenticated;


--
-- Name: TABLE expense_share_receipts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.expense_share_receipts TO authenticated;


--
-- Name: TABLE expense_shares; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.expense_shares TO authenticated;


--
-- Name: TABLE expenses; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.expenses TO authenticated;


--
-- Name: TABLE fund_commitments; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.fund_commitments TO authenticated;


--
-- Name: TABLE fund_contributions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.fund_contributions TO authenticated;


--
-- Name: TABLE funds; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.funds TO authenticated;


--
-- Name: TABLE note_revisions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.note_revisions TO authenticated;


--
-- Name: TABLE notification_preferences; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.notification_preferences TO authenticated;


--
-- Name: COLUMN notification_preferences.user_id; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(user_id) ON TABLE public.notification_preferences TO authenticated;


--
-- Name: COLUMN notification_preferences.email_reminders; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT(email_reminders),UPDATE(email_reminders) ON TABLE public.notification_preferences TO authenticated;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.notifications TO authenticated;


--
-- Name: TABLE operation_occurrences; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.operation_occurrences TO authenticated;


--
-- Name: TABLE recurring_bill_occurrences; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.recurring_bill_occurrences TO authenticated;


--
-- Name: TABLE recurring_bills; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.recurring_bills TO authenticated;


--
-- Name: TABLE reminders; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.reminders TO authenticated;


--
-- Name: TABLE split_templates; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.split_templates TO authenticated;


--
-- PostgreSQL database dump complete
--

