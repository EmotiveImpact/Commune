-- Acquisition source for product attribution from onboarding.
-- Captured optionally on the new "Where did you hear about us?" step.
-- Free-text by design (frontend constrains to a known list, but new sources
-- can be added without a schema change).
alter table public.profiles
  add column if not exists acquisition_source text null;

create index if not exists profiles_acquisition_source_idx
  on public.profiles (acquisition_source)
  where acquisition_source is not null;
