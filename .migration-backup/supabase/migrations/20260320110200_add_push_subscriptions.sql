-- Push notification subscriptions (Web Push API)
-- Stores the PushSubscription object fields needed to send push notifications.

create table if not exists push_subscriptions (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references users(id) on delete cascade,
  endpoint   text        not null,
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

-- Index for looking up subscriptions by user
create index if not exists idx_push_subscriptions_user_id on push_subscriptions(user_id);

-- RLS
alter table push_subscriptions enable row level security;

-- Users can view their own subscriptions
create policy "Users can view own push subscriptions"
  on push_subscriptions for select
  using (auth.uid() = user_id);

-- Users can insert their own subscriptions
create policy "Users can insert own push subscriptions"
  on push_subscriptions for insert
  with check (auth.uid() = user_id);

-- Users can delete their own subscriptions
create policy "Users can delete own push subscriptions"
  on push_subscriptions for delete
  using (auth.uid() = user_id);

-- Service role can read all subscriptions (for server-side push sending)
-- Note: service_role bypasses RLS by default, so no explicit policy needed.
