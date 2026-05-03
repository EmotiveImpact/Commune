-- Compact smart-nudge payload RPC for the web app.
-- This removes the remaining membership, budget, and expense-window fan-out
-- from the overview page while preserving the existing settlement reuse path.

create or replace function fn_get_smart_nudge_payload(
  p_due_soon_days integer default 3
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with date_bounds as (
  select
    date_trunc('month', current_date)::date as this_month_start,
    (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date as this_month_end,
    (date_trunc('month', current_date) - interval '1 month')::date as last_month_start,
    (date_trunc('month', current_date) - interval '1 day')::date as last_month_end,
    current_date as today,
    (current_date + greatest(coalesce(p_due_soon_days, 3), 0))::date as due_soon_end,
    date_trunc('month', current_date)::date as budget_month
),
memberships as (
  select
    gm.group_id,
    g.name,
    coalesce(g.currency, 'GBP') as currency,
    gb.budget_amount
  from group_members gm
  join groups g
    on g.id = gm.group_id
  join date_bounds db on true
  left join group_budgets gb
    on gb.group_id = gm.group_id
   and gb.month = db.budget_month
  where gm.user_id = auth.uid()
    and gm.status = 'active'
),
this_month_expenses as (
  select
    e.id,
    e.group_id,
    e.title,
    e.amount,
    e.due_date,
    e.created_at
  from expenses e
  join memberships m
    on m.group_id = e.group_id
  join date_bounds db on true
  where e.is_active = true
    and e.approval_status = 'approved'
    and e.due_date >= db.this_month_start
    and e.due_date <= db.this_month_end
),
last_month_expenses as (
  select
    e.group_id,
    e.amount
  from expenses e
  join memberships m
    on m.group_id = e.group_id
  join date_bounds db on true
  where e.is_active = true
    and e.due_date >= db.last_month_start
    and e.due_date <= db.last_month_end
),
recurring_expenses as (
  select
    e.id,
    e.title,
    e.group_id,
    e.due_date,
    e.amount
  from expenses e
  join memberships m
    on m.group_id = e.group_id
  join date_bounds db on true
  where e.is_active = true
    and e.recurrence_type <> 'none'
    and e.due_date >= db.today
    and e.due_date <= db.due_soon_end
)
select jsonb_build_object(
  'groups',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', memberships.group_id,
          'name', memberships.name,
          'currency', memberships.currency,
          'budgetAmount', memberships.budget_amount
        )
        order by memberships.name asc
      )
      from memberships
    ),
    '[]'::jsonb
  ),
  'this_month_expenses',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', this_month_expenses.id,
          'group_id', this_month_expenses.group_id,
          'title', this_month_expenses.title,
          'amount', this_month_expenses.amount,
          'due_date', this_month_expenses.due_date,
          'created_at', this_month_expenses.created_at
        )
        order by this_month_expenses.due_date asc, this_month_expenses.created_at desc
      )
      from this_month_expenses
    ),
    '[]'::jsonb
  ),
  'last_month_expenses',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'group_id', last_month_expenses.group_id,
          'amount', last_month_expenses.amount
        )
      )
      from last_month_expenses
    ),
    '[]'::jsonb
  ),
  'recurring_expenses',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', recurring_expenses.id,
          'title', recurring_expenses.title,
          'group_id', recurring_expenses.group_id,
          'due_date', recurring_expenses.due_date,
          'amount', recurring_expenses.amount
        )
        order by recurring_expenses.due_date asc, recurring_expenses.title asc
      )
      from recurring_expenses
    ),
    '[]'::jsonb
  )
);
$$;
