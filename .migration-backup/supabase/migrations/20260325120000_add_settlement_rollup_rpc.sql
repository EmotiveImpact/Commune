-- Compact settlement rollups for group settlement and cross-group netting.
-- These functions return only the filtered participant inputs and linked pairs
-- needed by the API layer, so the web hot path avoids fetching full expense
-- trees and payment-record joins.

create or replace function fn_get_group_settlement_rollup(
  p_group_id uuid,
  p_month text default null
)
returns jsonb
language sql
stable
security invoker
as $$
with expense_inputs as (
  select
    e.paid_by_user_id as payer_id,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'userId', ep.user_id,
            'shareAmount', ep.share_amount
          )
          order by ep.user_id
        )
        from expense_participants ep
        where ep.expense_id = e.id
          and not exists (
            select 1
            from payment_records pr
            where pr.expense_id = e.id
              and pr.user_id = ep.user_id
              and pr.status in ('paid', 'confirmed')
          )
      ),
      '[]'::jsonb
    ) as participants
  from expenses e
  where e.group_id = p_group_id
    and e.is_active = true
    and e.approval_status = 'approved'
    and e.paid_by_user_id is not null
    and (
      p_month is null
      or (
        e.due_date >= to_date(p_month || '-01', 'YYYY-MM-DD')
        and e.due_date < (to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month')::date
      )
    )
),
settlement_inputs as (
  select payer_id, participants
  from expense_inputs
  where participants <> '[]'::jsonb
),
linked_pairs as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userIdA', gm.user_id,
        'userIdB', partner.user_id
      )
      order by gm.user_id, partner.user_id
    ),
    '[]'::jsonb
  ) as pairs
  from group_members gm
  join group_members partner
    on partner.id = gm.linked_partner_id
   and partner.group_id = gm.group_id
   and partner.status = 'active'
  where gm.group_id = p_group_id
    and gm.status = 'active'
    and gm.linked_partner_id is not null
)
select
  case
    when exists (select 1 from settlement_inputs) then (
      select jsonb_build_object(
        'groupId', g.id,
        'groupName', g.name,
        'groupType', g.type,
        'currency', g.currency,
        'settlementInputs', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'payerId', si.payer_id,
                'participants', si.participants
              )
              order by si.payer_id
            )
            from settlement_inputs si
          ),
          '[]'::jsonb
        ),
        'linkedPairs', (select pairs from linked_pairs)
      )
      from groups g
      where g.id = p_group_id
    )
    else null
  end;
$$;

create or replace function fn_get_cross_group_settlement_rollup(
  p_user_id uuid
)
returns jsonb
language sql
stable
security invoker
as $$
with active_groups as (
  select g.id
  from group_members gm
  join groups g on g.id = gm.group_id
  where gm.user_id = p_user_id
    and gm.status = 'active'
),
rollups as (
  select fn_get_group_settlement_rollup(ag.id, null) as rollup
  from active_groups ag
)
select coalesce(
  jsonb_agg(rollup order by rollup->>'groupName'),
  '[]'::jsonb
)
from rollups
where rollup is not null;
$$;
