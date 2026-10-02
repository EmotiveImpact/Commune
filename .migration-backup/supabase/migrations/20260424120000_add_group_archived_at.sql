-- Add archived_at column to groups for soft-archive (hide from default listings)
-- Existing group RLS policies already gate reads/writes by membership; the
-- archiveGroup API function performs the owner check before flipping this flag.

alter table public.groups
  add column archived_at timestamptz null;

create index if not exists groups_archived_at_idx
  on public.groups (archived_at);
