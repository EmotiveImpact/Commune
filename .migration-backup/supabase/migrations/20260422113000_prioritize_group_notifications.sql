create or replace function fn_get_group_notifications(
  p_group_id uuid,
  p_limit integer default 30,
  p_cutoff_days integer default 30
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with params as (
  select
    greatest(coalesce(p_limit, 30), 1) as result_limit,
    greatest(coalesce(p_limit, 30), 1) * 4 as source_limit,
    greatest(coalesce(p_cutoff_days, 30), 1) as cutoff_days
),
membership as (
  select 1
  from group_members
  where group_id = p_group_id
    and user_id = auth.uid()
    and status = 'active'
),
group_context as (
  select
    g.currency,
    case g.currency
      when 'GBP' then '£'
      when 'USD' then '$'
      when 'EUR' then '€'
      when 'GHS' then 'GH₵'
      when 'NGN' then '₦'
      when 'CAD' then 'CA$'
      when 'AUD' then 'A$'
      when 'JPY' then '¥'
      when 'INR' then '₹'
      when 'ZAR' then 'R'
      else coalesce(g.currency, '') || ' '
    end as currency_symbol
  from groups g
  join membership on true
  where g.id = p_group_id
),
recent_expenses as (
  select
    'expense-' || e.id::text as id,
    'expense_added'::text as type,
    'New expense added'::text as title,
    e.title || ' — ' || gc.currency_symbol || trim(to_char(e.amount::numeric, 'FM9999999999990.00')) as description,
    e.created_at,
    e.id as expense_id,
    1 as priority
  from expenses e
  join group_context gc on true
  join params p on true
  where e.group_id = p_group_id
    and e.is_active = true
    and e.created_at >= now() - make_interval(days => p.cutoff_days)
  order by e.created_at desc
  limit (select source_limit from params)
),
recent_payments as (
  select
    'payment-' || pr.id::text as id,
    'payment_made'::text as type,
    'Payment received'::text as title,
    gc.currency_symbol || trim(to_char(pr.amount::numeric, 'FM9999999999990.00')) || ' paid for ' || e.title as description,
    pr.paid_at as created_at,
    e.id as expense_id,
    1 as priority
  from payment_records pr
  join expenses e
    on e.id = pr.expense_id
  join group_context gc on true
  join params p on true
  where e.group_id = p_group_id
    and pr.status = 'paid'
    and pr.user_id <> auth.uid()
    and pr.paid_at >= now() - make_interval(days => p.cutoff_days)
  order by pr.paid_at desc
  limit (select source_limit from params)
),
overdue_items as (
  select distinct on (pr.id)
    'overdue-' || pr.id::text as id,
    'payment_overdue'::text as type,
    'Payment overdue'::text as title,
    gc.currency_symbol || trim(to_char(pr.amount::numeric, 'FM9999999999990.00')) || ' for ' || e.title || ' was due ' || e.due_date::text as description,
    e.due_date::timestamptz as created_at,
    e.id as expense_id,
    0 as priority
  from payment_records pr
  join expenses e
    on e.id = pr.expense_id
  join group_context gc on true
  where e.group_id = p_group_id
    and e.is_active = true
    and pr.user_id = auth.uid()
    and pr.status = 'unpaid'
    and e.due_date < current_date
  order by pr.id, e.due_date desc
),
combined as (
  select * from recent_expenses
  union all
  select * from recent_payments
  union all
  select * from overdue_items
),
ranked as (
  select *
  from combined
  order by priority asc, created_at desc
  limit (select result_limit from params)
),
read_rows as (
  select nr.notification_id
  from notification_reads nr
  where nr.user_id = auth.uid()
    and nr.notification_id in (select id from ranked)
)
select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'id', ranked.id,
      'type', ranked.type,
      'title', ranked.title,
      'description', ranked.description,
      'created_at', ranked.created_at,
      'read', read_rows.notification_id is not null,
      'expense_id', ranked.expense_id
    )
    order by ranked.priority asc, ranked.created_at desc
  ),
  '[]'::jsonb
)
from ranked
left join read_rows
  on read_rows.notification_id = ranked.id;
$$;
