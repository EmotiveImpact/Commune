create or replace function fn_get_signed_in_bootstrap()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with signed_in_user as (
  select auth.uid() as user_id
),
subscription_row as (
  select
    s.id,
    s.user_id,
    s.stripe_customer_id,
    s.stripe_subscription_id,
    s.plan,
    s.status,
    s.trial_ends_at,
    s.current_period_start,
    s.current_period_end,
    s.created_at
  from subscriptions s
  join signed_in_user on signed_in_user.user_id = s.user_id
  order by s.created_at desc
  limit 1
),
memberships as (
  select
    gm.group_id,
    gm.role::text as current_user_role
  from group_members gm
  join signed_in_user on signed_in_user.user_id = gm.user_id
  where gm.status = 'active'
),
member_counts as (
  select
    gm.group_id,
    count(*)::int as active_member_count
  from group_members gm
  join memberships on memberships.group_id = gm.group_id
  where gm.status = 'active'
  group by gm.group_id
),
group_summaries as (
  select
    g.id,
    g.name,
    g.type::text as type,
    g.subtype,
    g.avatar_url,
    g.currency,
    g.approval_policy,
    coalesce(member_counts.active_member_count, 0)::int as active_member_count,
    memberships.current_user_role
  from memberships
  join groups g on g.id = memberships.group_id
  left join member_counts on member_counts.group_id = memberships.group_id
  order by lower(g.name) asc, g.id asc
)
select jsonb_build_object(
  'subscription',
  (
    select case
      when exists(select 1 from subscription_row)
        then to_jsonb(subscription_row)
      else null
    end
    from subscription_row
    union all
    select null
    where not exists(select 1 from subscription_row)
    limit 1
  ),
  'groups',
  coalesce(
    (
      select jsonb_agg(to_jsonb(group_summaries) order by lower(group_summaries.name) asc, group_summaries.id asc)
      from group_summaries
    ),
    '[]'::jsonb
  )
);
$$;
