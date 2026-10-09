-- People who have left a commune keep their name in its history, but their
-- email address is no longer shown to its members, including anyone who
-- joins later. That includes the invitations admins see: an accepted one
-- keeps its address only while the person who accepted it is still a member.
-- The list now also says who accepted, so Members can name a former member
-- from the snapshot instead. Apply after 0030.
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

-- A new column means replacing the function rather than changing it in
-- place, so its grants are given again below.
DO $$
DECLARE v_patch record; v_source text;
BEGIN
  v_source := pg_get_functiondef('public.list_commune_invites(uuid)'::regprocedure);
  FOR v_patch IN SELECT * FROM (VALUES
    ('invited_by text, invited_by_name text)',
     'invited_by text, invited_by_name text, accepted_by text)'),
    ('SELECT i.id, i.email, i.role,',
     'SELECT i.id, CASE WHEN i.accepted_by IS NULL OR EXISTS (SELECT 1 FROM public.commune_members m
      WHERE m.commune_id = i.commune_id AND m.user_id = i.accepted_by AND m.active) THEN i.email END, i.role,'),
    ('i.accepted_at, i.revoked_at, i.invited_by, u.name',
     'i.accepted_at, i.revoked_at, i.invited_by, u.name, i.accepted_by')
  ) AS p(old_text, new_text) LOOP
    IF position(v_patch.old_text IN v_source) = 0 THEN
      RAISE EXCEPTION 'Unsupported definition of public.list_commune_invites(uuid)';
    END IF;
    v_source := replace(v_source, v_patch.old_text, v_patch.new_text);
  END LOOP;
  DROP FUNCTION public.list_commune_invites(uuid);
  EXECUTE v_source;
END;
$$;
REVOKE ALL ON FUNCTION public.list_commune_invites(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_commune_invites(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
