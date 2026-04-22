create or replace function fn_get_dashboard_core(
  p_group_id uuid,
  p_month text
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with membership as (
  select auth.uid() as user_id
  where exists (
    select 1
    from group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
      and gm.status = 'active'
  )
),
month_bounds as (
  select
    (p_month || '-01')::date as month_start,
    ((p_month || '-01')::date + interval '1 month')::date as month_end,
    ((p_month || '-01')::date - interval '5 months')::date as trend_start
),
range_expense_count as (
  select count(*)::int as value
  from expenses e
  join membership on true
  join month_bounds mb on true
  where e.group_id = p_group_id
    and e.is_active = true
    and e.due_date >= mb.trend_start
    and e.due_date < mb.month_end
),
current_month_expenses as (
  select
    e.id,
    e.amount,
    e.due_date
  from expenses e
  join membership on true
  join month_bounds mb on true
  where e.group_id = p_group_id
    and e.is_active = true
    and e.due_date >= mb.month_start
    and e.due_date < mb.month_end
),
participant_shares as (
  select
    ep.expense_id,
    ep.share_amount
  from expense_participants ep
  join current_month_expenses cme on cme.id = ep.expense_id
  join membership m on m.user_id = ep.user_id
),
payment_aggregates as (
  select
    pr.expense_id,
    bool_or(m.user_id is not null and pr.status <> 'unpaid') as user_has_paid,
    bool_or(pr.status = 'unpaid') as has_unpaid
  from payment_records pr
  join current_month_expenses cme on cme.id = pr.expense_id
  left join membership m on m.user_id = pr.user_id
  group by pr.expense_id
),
current_month_expense_details as (
  select
    cme.amount,
    cme.due_date,
    ps.share_amount as participant_share,
    coalesce(pa.user_has_paid, false) as user_has_paid,
    coalesce(pa.has_unpaid, false) as has_unpaid
  from current_month_expenses cme
  left join participant_shares ps on ps.expense_id = cme.id
  left join payment_aggregates pa on pa.expense_id = cme.id
),
dashboard_stats as (
  select
    coalesce(sum(amount), 0)::numeric as total_spend,
    coalesce(sum(coalesce(participant_share, 0)), 0)::numeric as your_share,
    coalesce(
      sum(
        case
          when user_has_paid then coalesce(participant_share, 0)
          else 0
        end
      ),
      0
    )::numeric as amount_paid,
    count(*) filter (
      where due_date < current_date
        and has_unpaid
    )::int as overdue_count
  from current_month_expense_details
)
select jsonb_build_object(
  'expense_count', coalesce((select value from range_expense_count), 0),
  'current_month_total', (select total_spend from dashboard_stats),
  'stats',
  jsonb_build_object(
    'total_spend', (select total_spend from dashboard_stats),
    'your_share', (select your_share from dashboard_stats),
    'amount_paid', (select amount_paid from dashboard_stats),
    'amount_remaining', (select (your_share - amount_paid)::numeric from dashboard_stats),
    'overdue_count', (select overdue_count from dashboard_stats),
    'upcoming_items', '[]'::jsonb
  ),
  'budget', null,
  'has_pending_recurring_generation', false,
  'trend', '[]'::jsonb,
  'category_breakdown', '[]'::jsonb,
  'current_month_category_totals', '{}'::jsonb,
  'recent_expenses', '[]'::jsonb
);
$$;

create or replace function fn_get_dashboard_supporting_data(
  p_group_id uuid,
  p_month text
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with membership as (
  select auth.uid() as user_id
  where exists (
    select 1
    from group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
      and gm.status = 'active'
  )
),
month_bounds as (
  select
    (p_month || '-01')::date as month_start,
    ((p_month || '-01')::date + interval '1 month')::date as month_end
),
current_month_expenses as (
  select
    e.id,
    e.title,
    e.amount,
    e.currency,
    e.due_date
  from expenses e
  join membership on true
  join month_bounds mb on true
  where e.group_id = p_group_id
    and e.is_active = true
    and e.due_date >= mb.month_start
    and e.due_date < mb.month_end
),
participant_shares as (
  select
    ep.expense_id,
    ep.share_amount
  from expense_participants ep
  join current_month_expenses cme on cme.id = ep.expense_id
  join membership m on m.user_id = ep.user_id
),
current_budget as (
  select
    gb.budget_amount,
    gb.category_budgets,
    gb.alert_threshold
  from group_budgets gb
  join membership on true
  join month_bounds mb on true
  where gb.group_id = p_group_id
    and gb.month = mb.month_start
  limit 1
),
upcoming_items as (
  select
    cme.id,
    cme.title,
    cme.amount,
    cme.currency,
    cme.due_date,
    coalesce(ps.share_amount, cme.amount)::numeric as user_share
  from current_month_expenses cme
  left join participant_shares ps on ps.expense_id = cme.id
  where cme.due_date >= current_date
    and cme.due_date <= (current_date + 7)
  order by cme.due_date asc, cme.title asc
)
select jsonb_build_object(
  'budget',
  (
    select case
      when exists(select 1 from current_budget)
        then jsonb_build_object(
          'budget_amount', current_budget.budget_amount,
          'category_budgets', current_budget.category_budgets,
          'alert_threshold', current_budget.alert_threshold
        )
      else null
    end
    from current_budget
    union all
    select null
    where not exists(select 1 from current_budget)
    limit 1
  ),
  'upcoming_items',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', upcoming_items.id,
          'title', upcoming_items.title,
          'amount', upcoming_items.amount,
          'currency', upcoming_items.currency,
          'due_date', upcoming_items.due_date,
          'user_share', upcoming_items.user_share
        )
        order by upcoming_items.due_date asc, upcoming_items.title asc
      )
      from upcoming_items
    ),
    '[]'::jsonb
  )
);
$$;
