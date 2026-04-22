drop function if exists fn_get_signed_in_bootstrap(uuid, text);

create or replace function fn_get_signed_in_bootstrap(
  p_active_group_id uuid default null,
  p_month text default to_char(current_date, 'YYYY-MM'),
  p_include_dashboard_summary boolean default false
)
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
),
resolved_group as (
  select
    case
      when p_active_group_id is not null
        and exists(select 1 from group_summaries where group_summaries.id = p_active_group_id)
        then p_active_group_id
      else (
        select group_summaries.id
        from group_summaries
        order by lower(group_summaries.name) asc, group_summaries.id asc
        limit 1
      )
    end as group_id
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
  ),
  'resolved_group_id', (select resolved_group.group_id from resolved_group),
  'dashboard_summary',
  (
    select case
      when p_include_dashboard_summary and resolved_group.group_id is not null
        then fn_get_dashboard_summary(resolved_group.group_id, p_month)
      else null
    end
    from resolved_group
  )
);
$$;
