create or replace function fn_get_user_group_summaries()
returns table (
  id uuid,
  name text,
  type text,
  subtype text,
  avatar_url text,
  currency text,
  approval_policy jsonb,
  active_member_count integer,
  current_user_role text
)
language sql
stable
security invoker
set search_path = public
as $$
with memberships as (
  select
    gm.group_id,
    gm.role::text as current_user_role
  from group_members gm
  where gm.user_id = auth.uid()
    and gm.status = 'active'
),
member_counts as (
  select
    gm.group_id,
    count(*)::int as active_member_count
  from group_members gm
  join memberships memberships_filter
    on memberships_filter.group_id = gm.group_id
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
  memberships.current_user_role
from memberships
join groups g
  on g.id = memberships.group_id
left join member_counts
  on member_counts.group_id = memberships.group_id
order by lower(g.name) asc, g.id asc;
$$;
