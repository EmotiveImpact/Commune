-- Notes keep their history and refuse silent overwrites. Every change to a
-- note's content saves the content it replaced as a revision (the last 50 per
-- note are kept) and moves the note to its next version. A save names the
-- version it was based on; when someone else has saved since, it matches no
-- row and the client says so instead of overwriting their change.
-- The snapshot carries revision summaries only; content is read on demand.
-- Apply after 0022. Release with the matching web client.
BEGIN;

ALTER TABLE public.commune_notes
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  ADD COLUMN updated_by text;
-- A backfill is not a member's change: keep it out of the activity history.
ALTER TABLE public.commune_notes DISABLE TRIGGER commune_change;
UPDATE public.commune_notes SET updated_by = created_by WHERE updated_by IS NULL;
ALTER TABLE public.commune_notes ENABLE TRIGGER commune_change;

CREATE TABLE public.note_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.commune_notes(id) ON DELETE CASCADE,
  commune_id uuid NOT NULL REFERENCES public.communes(id) ON DELETE CASCADE,
  -- The version this content was, and who saved it then.
  version integer NOT NULL,
  title text NOT NULL, pill text NOT NULL, kicker text NOT NULL, lede text NOT NULL,
  body text NOT NULL, facts jsonb NOT NULL,
  edited_by text, edited_at timestamptz NOT NULL,
  -- Who replaced it, and when.
  replaced_by text, replaced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (note_id, version)
);
CREATE INDEX note_revisions_note_idx ON public.note_revisions (note_id, version DESC);
ALTER TABLE public.note_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY note_revision_read ON public.note_revisions FOR SELECT TO authenticated
  USING (public.is_commune_member(commune_id));
GRANT SELECT ON public.note_revisions TO authenticated;
-- Deliberately no write grant: only the trigger below writes revisions.

CREATE FUNCTION commune_private.record_note_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
REVOKE ALL ON FUNCTION commune_private.record_note_revision() FROM PUBLIC;
CREATE TRIGGER note_revision BEFORE UPDATE ON public.commune_notes
  FOR EACH ROW EXECUTE FUNCTION commune_private.record_note_revision();

-- A new note starts at version 1, saved by its creator.
CREATE FUNCTION commune_private.start_note_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.version := 1;
  NEW.updated_by := NEW.created_by;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION commune_private.start_note_version() FROM PUBLIC;
CREATE TRIGGER note_version_start BEFORE INSERT ON public.commune_notes
  FOR EACH ROW EXECUTE FUNCTION commune_private.start_note_version();

-- Notes in the snapshot carry their version and a short revision list.
DO $$
DECLARE v_original text; v_source text;
BEGIN
  v_original := pg_get_functiondef('public.commune_snapshot(uuid)'::regprocedure);
  v_source := replace(v_original,
    '''notes'',coalesce((SELECT jsonb_agg(jsonb_build_object(''id'',n.id,''title'',n.title,''pill'',n.pill,''kicker'',n.kicker,''lede'',n.lede,''body'',n.body,''facts'',n.facts)',
    '''notes'',coalesce((SELECT jsonb_agg(jsonb_build_object(''id'',n.id,''title'',n.title,''pill'',n.pill,''kicker'',n.kicker,''lede'',n.lede,''body'',n.body,''facts'',n.facts,
      ''version'',n.version,''createdBy'',n.created_by,''updatedBy'',n.updated_by,''updatedAt'',n.updated_at,
      ''revisions'',coalesce((SELECT jsonb_agg(jsonb_build_object(''id'',r.id,''version'',r.version,''title'',r.title,''editedBy'',r.edited_by,''editedAt'',r.edited_at,
          ''replacedBy'',r.replaced_by,''replacedAt'',r.replaced_at) ORDER BY r.version DESC)
        FROM (SELECT * FROM public.note_revisions x WHERE x.note_id=n.id ORDER BY x.version DESC LIMIT 10) r),''[]''::jsonb))');
  IF v_source = v_original OR position('''revisions'',coalesce((SELECT jsonb_agg(jsonb_build_object(''id'',r.id' IN v_source) = 0 THEN
    RAISE EXCEPTION 'Unsupported snapshot definition';
  END IF;
  EXECUTE v_source;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
