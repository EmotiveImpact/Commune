-- People who have left a commune keep their name in its history, but their
-- email address is no longer shown to its members, including anyone who
-- joins later. Apply after 0030.
BEGIN;

DO $$
DECLARE v_patch record; v_original text; v_source text;
BEGIN
  FOR v_patch IN SELECT * FROM (VALUES
    ('public.member_profiles_with_status(uuid)',
     'SELECT m.user_id, coalesce(u.name, ''Former member''), u.email, m.role, m.active',
     'SELECT m.user_id, coalesce(u.name, ''Former member''), CASE WHEN m.active THEN u.email END, m.role, m.active'),
    ('public.member_profiles(uuid)',
     'SELECT u.id::text, u.name, u.email, m.role',
     'SELECT u.id::text, u.name, CASE WHEN m.active THEN u.email END, m.role')
  ) AS p(fn, old_text, new_text) LOOP
    v_original := pg_get_functiondef(v_patch.fn::regprocedure);
    v_source := replace(v_original, v_patch.old_text, v_patch.new_text);
    IF v_source = v_original THEN RAISE EXCEPTION 'Unsupported definition of %', v_patch.fn; END IF;
    EXECUTE v_source;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
