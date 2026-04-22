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
current_month_expense_details as (
  select
    e.id,
    e.title,
    e.amount,
    e.currency,
    e.due_date,
    participation.share_amount as participant_share,
    coalesce(payments.unpaid_count, 0)::int as unpaid_count,
    coalesce(user_payments.has_paid, false) as user_has_paid
  from expenses e
  join membership on true
  join month_bounds mb on true
  left join lateral (
    select ep.share_amount
    from expense_participants ep
    where ep.expense_id = e.id
      and ep.user_id = auth.uid()
    limit 1
  ) participation on true
  left join lateral (
    select count(*) filter (where pr.status = 'unpaid') as unpaid_count
    from payment_records pr
    where pr.expense_id = e.id
  ) payments on true
  left join lateral (
    select bool_or(pr.status <> 'unpaid') as has_paid
    from payment_records pr
    where pr.expense_id = e.id
      and pr.user_id = auth.uid()
  ) user_payments on true
  where e.group_id = p_group_id
    and e.is_active = true
    and e.due_date >= mb.month_start
    and e.due_date < mb.month_end
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
  'expense_count', coalesce((select value from range_expense_count), 0),
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
    memberships.current_user_role,
    memberships.current_user_responsibility_label
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
      when not p_include_subscription then null
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
        then fn_get_dashboard_core(resolved_group.group_id, p_month)
      else null
    end
    from resolved_group
  )
);
$$;
