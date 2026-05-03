create index if not exists idx_expenses_group_approval_active_paid_by
  on expenses (group_id, approval_status, paid_by_user_id)
  where is_active = true and paid_by_user_id is not null;

create index if not exists idx_group_members_group_linked_partner_active
  on group_members (group_id, linked_partner_id)
  where status = 'active' and linked_partner_id is not null;

create or replace function fn_get_cross_group_settlement_rollup(
  p_user_id uuid
)
returns jsonb
language sql
stable
security invoker
as $$
with active_groups as (
  select
    g.id,
    g.name,
    g.type,
    g.currency
  from group_members gm
  join groups g on g.id = gm.group_id
  where gm.user_id = p_user_id
    and gm.status = 'active'
),
unpaid_participants as (
  select
    e.group_id,
    e.id as expense_id,
    e.paid_by_user_id as payer_id,
    ep.user_id,
    ep.share_amount
  from active_groups ag
  join expenses e on e.group_id = ag.id
  join expense_participants ep on ep.expense_id = e.id
  left join payment_records pr
    on pr.expense_id = e.id
   and pr.user_id = ep.user_id
   and pr.status in ('paid', 'confirmed')
  where e.is_active = true
    and e.approval_status = 'approved'
    and e.paid_by_user_id is not null
    and pr.id is null
),
expense_inputs as (
  select
    group_id,
    expense_id,
    payer_id,
    jsonb_agg(
      jsonb_build_object(
        'userId', user_id,
        'shareAmount', share_amount
      )
      order by user_id
    ) as participants
  from unpaid_participants
  group by group_id, expense_id, payer_id
),
group_settlement_inputs as (
  select
    group_id,
    jsonb_agg(
      jsonb_build_object(
        'payerId', payer_id,
        'participants', participants
      )
      order by payer_id, expense_id
    ) as settlement_inputs
  from expense_inputs
  group by group_id
),
linked_pairs as (
  select
    gm.group_id,
    jsonb_agg(
      jsonb_build_object(
        'userIdA', gm.user_id,
        'userIdB', partner.user_id
      )
      order by gm.user_id, partner.user_id
    ) as pairs
  from group_members gm
  join group_members partner
    on partner.id = gm.linked_partner_id
   and partner.group_id = gm.group_id
   and partner.status = 'active'
  join active_groups ag on ag.id = gm.group_id
  where gm.status = 'active'
    and gm.linked_partner_id is not null
  group by gm.group_id
),
group_rollups as (
  select
    ag.id,
    ag.name,
    ag.type,
    ag.currency,
    coalesce(gsi.settlement_inputs, '[]'::jsonb) as settlement_inputs,
    coalesce(lp.pairs, '[]'::jsonb) as linked_pairs
  from active_groups ag
  left join group_settlement_inputs gsi on gsi.group_id = ag.id
  left join linked_pairs lp on lp.group_id = ag.id
)
select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'groupId', group_rollups.id,
      'groupName', group_rollups.name,
      'groupType', group_rollups.type,
      'currency', group_rollups.currency,
      'settlementInputs', group_rollups.settlement_inputs,
      'linkedPairs', group_rollups.linked_pairs
    )
    order by lower(group_rollups.name), group_rollups.id
  ) filter (where group_rollups.settlement_inputs <> '[]'::jsonb),
  '[]'::jsonb
)
from group_rollups;
$$;
