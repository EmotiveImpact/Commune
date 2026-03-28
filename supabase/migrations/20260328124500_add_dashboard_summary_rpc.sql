-- Compact dashboard summary RPC for the signed-in landing page.
-- This avoids hydrating a six-month raw expense feed in the browser just to
-- render trend, category, recent expense, and budget-supporting summaries.

create or replace function fn_get_dashboard_summary(
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
  select 1
  from group_members
  where group_id = p_group_id
    and user_id = auth.uid()
    and status = 'active'
),
month_bounds as (
  select
    (p_month || '-01')::date as month_start,
    ((p_month || '-01')::date + interval '1 month')::date as month_end,
    ((p_month || '-01')::date - interval '5 months')::date as trend_start
),
range_expenses as (
  select
    e.id,
    e.title,
    coalesce(e.category::text, 'uncategorized') as category,
    e.amount,
    e.due_date,
    e.created_at
  from expenses e
  join membership on true
  join month_bounds mb on true
  where e.group_id = p_group_id
    and e.is_active = true
    and e.due_date >= mb.trend_start
    and e.due_date < mb.month_end
),
current_month_expenses as (
  select re.*
  from range_expenses re
  join month_bounds mb on true
  where re.due_date >= mb.month_start
    and re.due_date < mb.month_end
),
trend_months as (
  select
    to_char(month_bucket, 'YYYY-MM') as month,
    coalesce(sum(re.amount), 0)::numeric as total
  from month_bounds mb
  cross join generate_series(
    mb.trend_start::timestamp,
    mb.month_start::timestamp,
    interval '1 month'
  ) as month_bucket
  left join range_expenses re
    on date_trunc('month', re.due_date)::date = month_bucket::date
  group by month_bucket
  order by month_bucket asc
),
has_current_month as (
  select exists(select 1 from current_month_expenses) as value
),
category_source as (
  select re.category, re.amount
  from range_expenses re
  join has_current_month hm on true
  join month_bounds mb on true
  where (
    hm.value
    and re.due_date >= mb.month_start
    and re.due_date < mb.month_end
  ) or not hm.value
),
category_totals as (
  select
    category,
    sum(amount)::numeric as amount
  from category_source
  group by category
),
category_source_total as (
  select coalesce(sum(amount), 0)::numeric as total
  from category_source
),
top_categories as (
  select
    category,
    amount
  from category_totals
  order by amount desc, category asc
  limit 5
),
current_month_category_totals as (
  select coalesce(
    jsonb_object_agg(category, amount),
    '{}'::jsonb
  ) as totals
  from (
    select
      category,
      sum(amount)::numeric as amount
    from current_month_expenses
    group by category
  ) grouped
),
recent_expenses as (
  select
    re.id,
    re.title,
    re.category,
    re.amount,
    re.due_date,
    coalesce(payments.unpaid_count, 0)::int as unpaid_count
  from range_expenses re
  left join lateral (
    select count(*) filter (where pr.status = 'unpaid') as unpaid_count
    from payment_records pr
    where pr.expense_id = re.id
  ) payments on true
  order by re.due_date desc, re.created_at desc, re.title asc
  limit 5
)
select jsonb_build_object(
  'expense_count', (select count(*)::int from range_expenses),
  'current_month_total', (select coalesce(sum(amount), 0)::numeric from current_month_expenses),
  'trend',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'month', trend_months.month,
          'total', trend_months.total
        )
        order by trend_months.month asc
      )
      from trend_months
    ),
    '[]'::jsonb
  ),
  'category_breakdown',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'category', top_categories.category,
          'amount', top_categories.amount,
          'percent',
          case
            when category_source_total.total > 0
              then round((top_categories.amount / category_source_total.total) * 100)::int
            else 0
          end
        )
        order by top_categories.amount desc, top_categories.category asc
      )
      from top_categories, category_source_total
    ),
    '[]'::jsonb
  ),
  'current_month_category_totals', (select totals from current_month_category_totals),
  'recent_expenses',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', recent_expenses.id,
          'title', recent_expenses.title,
          'category', recent_expenses.category,
          'amount', recent_expenses.amount,
          'due_date', recent_expenses.due_date,
          'unpaid_count', recent_expenses.unpaid_count
        )
        order by recent_expenses.due_date desc, recent_expenses.title asc
      )
      from recent_expenses
    ),
    '[]'::jsonb
  )
);
$$;
