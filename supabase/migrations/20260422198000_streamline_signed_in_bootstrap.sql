drop function if exists fn_get_user_group_summaries();

create function fn_get_user_group_summaries()
returns table (
  id uuid,
  name text,
  type text,
  subtype text,
  avatar_url text,
  currency text,
  approval_policy jsonb,
  active_member_count int,
  current_user_role text,
  current_user_responsibility_label text
)
language sql
stable
security invoker
set search_path = public
as $$
with signed_in_user as (
  select auth.uid() as user_id
),
memberships as (
  select
    gm.group_id,
    gm.role::text as current_user_role,
    gm.responsibility_label as current_user_responsibility_label
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
)
select
  g.id,
  g.name,
  g.type::text,
  g.subtype,
  g.avatar_url,
  g.currency,
  g.approval_policy,
  coalesce(member_counts.active_member_count, 0)::int as active_member_count,
  memberships.current_user_role,
  memberships.current_user_responsibility_label
from memberships
join groups g on g.id = memberships.group_id
left join member_counts on member_counts.group_id = memberships.group_id
order by lower(g.name) asc, g.id asc;
$$;

create or replace function fn_get_signed_in_bootstrap(
  p_active_group_id uuid default null,
  p_month text default to_char(current_date, 'YYYY-MM'),
  p_include_dashboard_summary boolean default false,
  p_include_subscription boolean default true
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
subscription_payload as (
  select to_jsonb(s) as payload
  from subscriptions s
  join signed_in_user on signed_in_user.user_id = s.user_id
  limit 1
),
memberships as (
  select
    gm.group_id,
    gm.role::text as current_user_role,
    gm.responsibility_label as current_user_responsibility_label
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
group_rows as (
  select
    g.id,
    g.name,
    g.type::text as type,
    g.subtype,
    g.avatar_url,
    g.currency,
    g.approval_policy,
    coalesce(member_counts.active_member_count, 0)::int as active_member_count,
    memberships.current_user_role,
    memberships.current_user_responsibility_label,
    lower(g.name) as sort_name
  from memberships
  join groups g on g.id = memberships.group_id
  left join member_counts on member_counts.group_id = memberships.group_id
),
groups_payload as (
  select
    coalesce(
      jsonb_agg((to_jsonb(group_rows) - 'sort_name') order by group_rows.sort_name, group_rows.id),
      '[]'::jsonb
    ) as groups_json,
    (
      array_agg(
        group_rows.id
        order by
          (group_rows.id = p_active_group_id) desc,
          group_rows.sort_name,
          group_rows.id
      )
    )[1] as resolved_group_id
  from group_rows
)
select jsonb_build_object(
  'subscription',
  case
    when p_include_subscription then (select payload from subscription_payload)
    else null
  end,
  'groups',
  coalesce((select groups_json from groups_payload), '[]'::jsonb),
  'resolved_group_id',
  (select resolved_group_id from groups_payload),
  'dashboard_summary',
  (
    select case
      when p_include_dashboard_summary and groups_payload.resolved_group_id is not null
        then fn_get_dashboard_core(groups_payload.resolved_group_id, p_month)
      else null
    end
    from groups_payload
  )
);
$$;
