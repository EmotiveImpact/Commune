-- Payment nudge tracking table
-- Records when a user sends a payment reminder to another group member
create table if not exists public.payment_nudges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  expense_id uuid references public.expenses(id) on delete set null,
  amount numeric(12, 2) not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Indexes for common queries
create index idx_payment_nudges_group on public.payment_nudges(group_id);
create index idx_payment_nudges_to_user on public.payment_nudges(to_user_id);
create index idx_payment_nudges_from_user on public.payment_nudges(from_user_id);
create index idx_payment_nudges_sent_at on public.payment_nudges(sent_at desc);

-- Enable RLS
alter table public.payment_nudges enable row level security;

-- Policy: group members can insert nudges for their group
create policy "Group members can insert nudges"
  on public.payment_nudges
  for insert
  with check (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = payment_nudges.group_id
        and gm.user_id = auth.uid()
    )
    and from_user_id = auth.uid()
  );

-- Policy: users can view nudges they sent or received
create policy "Users can view own nudges"
  on public.payment_nudges
  for select
  using (
    from_user_id = auth.uid()
    or to_user_id = auth.uid()
  );
