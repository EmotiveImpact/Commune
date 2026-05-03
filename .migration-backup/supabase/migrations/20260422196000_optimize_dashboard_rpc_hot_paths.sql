create index if not exists idx_expenses_group_due_date_active
  on expenses (group_id, due_date)
  where is_active = true;

create index if not exists idx_expenses_group_recurrence_active
  on expenses (group_id, recurrence_type)
  where is_active = true and recurrence_type <> 'none';

create index if not exists idx_expense_participants_user_expense
  on expense_participants (user_id, expense_id);

create index if not exists idx_payment_records_expense_user_status
  on payment_records (expense_id, user_id, status);

create index if not exists idx_group_budgets_group_month_updated
  on group_budgets (group_id, month, updated_at desc);

create index if not exists idx_recurring_expense_log_generated_expense_id
  on recurring_expense_log (generated_expense_id);

create index if not exists idx_recurring_expense_log_source_month
  on recurring_expense_log (source_expense_id, generated_for_month);

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
    e.amount,
    e.currency,
    e.due_date
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
participant_shares as (
  select
    ep.expense_id,
    ep.share_amount
  from expense_participants ep
  join current_month_expenses cme on cme.id = ep.expense_id
  where ep.user_id = auth.uid()
),
payment_statuses as (
  select
    pr.expense_id,
    count(*) filter (where pr.status = 'unpaid')::int as unpaid_count,
    bool_or(pr.user_id = auth.uid() and pr.status <> 'unpaid') as user_has_paid
  from payment_records pr
  join current_month_expenses cme on cme.id = pr.expense_id
  group by pr.expense_id
),
current_month_expense_details as (
  select
    cme.id,
    cme.title,
    cme.amount,
    cme.currency,
    cme.due_date,
    participant_shares.share_amount as participant_share,
    coalesce(payment_statuses.unpaid_count, 0)::int as unpaid_count,
    coalesce(payment_statuses.user_has_paid, false) as user_has_paid
  from current_month_expenses cme
  left join participant_shares on participant_shares.expense_id = cme.id
  left join payment_statuses on payment_statuses.expense_id = cme.id
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
        and unpaid_count > 0
    )::int as overdue_count
  from current_month_expense_details
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
  order by gb.updated_at desc
  limit 1
),
pending_recurring_generation as (
  select exists (
    select 1
    from expenses e
    join membership on true
    where e.group_id = p_group_id
      and e.is_active = true
      and e.recurrence_type <> 'none'
      and not exists (
        select 1
        from recurring_expense_log generated_source
        where generated_source.generated_expense_id = e.id
      )
      and not exists (
        select 1
        from recurring_expense_log month_log
        where month_log.source_expense_id = e.id
          and month_log.generated_for_month = p_month
      )
  ) as value
),
upcoming_items as (
  select
    id,
    title,
    amount,
    currency,
    due_date,
    coalesce(participant_share, amount)::numeric as user_share
  from current_month_expense_details
  where due_date >= current_date
    and due_date <= (current_date + 7)
  order by due_date asc, title asc
)
select jsonb_build_object(
  'expense_count', coalesce((select count(*)::int from range_expenses), 0),
  'current_month_total', (select total_spend from dashboard_stats),
  'stats',
  jsonb_build_object(
    'total_spend', (select total_spend from dashboard_stats),
    'your_share', (select your_share from dashboard_stats),
    'amount_paid', (select amount_paid from dashboard_stats),
    'amount_remaining', (select (your_share - amount_paid)::numeric from dashboard_stats),
    'overdue_count', (select overdue_count from dashboard_stats),
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
  ),
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
  'has_pending_recurring_generation', (select value from pending_recurring_generation),
  'trend', '[]'::jsonb,
  'category_breakdown', '[]'::jsonb,
  'current_month_category_totals', '{}'::jsonb,
  'recent_expenses', '[]'::jsonb
);
$$;

create or replace function fn_get_dashboard_summary(
  p_group_id uuid,
  p_month text,
  p_include_insights boolean default true
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
    e.currency,
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
current_month_participant_shares as (
  select
    ep.expense_id,
    ep.share_amount
  from expense_participants ep
  join current_month_expenses cme on cme.id = ep.expense_id
  where ep.user_id = auth.uid()
),
current_month_payment_statuses as (
  select
    pr.expense_id,
    count(*) filter (where pr.status = 'unpaid')::int as unpaid_count,
    bool_or(pr.user_id = auth.uid() and pr.status <> 'unpaid') as user_has_paid
  from payment_records pr
  join current_month_expenses cme on cme.id = pr.expense_id
  group by pr.expense_id
),
range_payment_statuses as (
  select
    pr.expense_id,
    count(*) filter (where pr.status = 'unpaid')::int as unpaid_count
  from payment_records pr
  join range_expenses re on re.id = pr.expense_id
  group by pr.expense_id
),
current_month_expense_details as (
  select
    cme.id,
    cme.title,
    cme.amount,
    cme.currency,
    cme.due_date,
    current_month_participant_shares.share_amount as participant_share,
    coalesce(current_month_payment_statuses.unpaid_count, 0)::int as unpaid_count,
    coalesce(current_month_payment_statuses.user_has_paid, false) as user_has_paid
  from current_month_expenses cme
  left join current_month_participant_shares
    on current_month_participant_shares.expense_id = cme.id
  left join current_month_payment_statuses
    on current_month_payment_statuses.expense_id = cme.id
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
        and unpaid_count > 0
    )::int as overdue_count
  from current_month_expense_details
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
  order by gb.updated_at desc
  limit 1
),
pending_recurring_generation as (
  select exists (
    select 1
    from expenses e
    join membership on true
    where e.group_id = p_group_id
      and e.is_active = true
      and e.recurrence_type <> 'none'
      and not exists (
        select 1
        from recurring_expense_log generated_source
        where generated_source.generated_expense_id = e.id
      )
      and not exists (
        select 1
        from recurring_expense_log month_log
        where month_log.source_expense_id = e.id
          and month_log.generated_for_month = p_month
      )
  ) as value
),
upcoming_items as (
  select
    id,
    title,
    amount,
    currency,
    due_date,
    coalesce(participant_share, amount)::numeric as user_share
  from current_month_expense_details
  where due_date >= current_date
    and due_date <= (current_date + 7)
  order by due_date asc, title asc
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
    coalesce(range_payment_statuses.unpaid_count, 0)::int as unpaid_count
  from range_expenses re
  left join range_payment_statuses on range_payment_statuses.expense_id = re.id
  order by re.due_date desc, re.created_at desc, re.title asc
  limit 5
)
select jsonb_build_object(
  'expense_count', (select count(*)::int from range_expenses),
  'current_month_total', (select total_spend from dashboard_stats),
  'stats',
  jsonb_build_object(
    'total_spend', (select total_spend from dashboard_stats),
    'your_share', (select your_share from dashboard_stats),
    'amount_paid', (select amount_paid from dashboard_stats),
    'amount_remaining', (select (your_share - amount_paid)::numeric from dashboard_stats),
    'overdue_count', (select overdue_count from dashboard_stats),
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
  ),
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
  'has_pending_recurring_generation', (select value from pending_recurring_generation),
  'trend',
  case
    when p_include_insights then coalesce(
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
    )
    else '[]'::jsonb
  end,
  'category_breakdown',
  case
    when p_include_insights then coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'category', top_categories.category,
            'amount', top_categories.amount,
            'percent',
            case
              when category_source_total.total > 0
                then round((top_categories.amount / category_source_total.total) * 100, 2)
              else 0
            end
          )
          order by top_categories.amount desc, top_categories.category asc
        )
        from top_categories
        cross join category_source_total
      ),
      '[]'::jsonb
    )
    else '[]'::jsonb
  end,
  'current_month_category_totals',
  case
    when p_include_insights then (select totals from current_month_category_totals)
    else '{}'::jsonb
  end,
  'recent_expenses',
  case
    when p_include_insights then coalesce(
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
    else '[]'::jsonb
  end
);
$$;
