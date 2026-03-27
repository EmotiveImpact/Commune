-- Compact activity and notification feed RPCs for the web app.
-- These move hot-path shaping into Postgres so the client avoids extra
-- round trips for user joins, workspace billing context, summary stats,
-- and read-state fan-out.

create index if not exists idx_activity_log_group_entity_created
  on activity_log (group_id, entity_type, created_at desc);

create or replace function fn_get_activity_feed(
  p_group_id uuid,
  p_limit integer default 20,
  p_offset integer default 0,
  p_entity_types text[] default null
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
base as (
  select
    al.id,
    al.group_id,
    al.user_id,
    al.action,
    al.entity_type,
    al.entity_id,
    al.metadata,
    al.created_at,
    jsonb_build_object(
      'id', u.id,
      'name', u.name,
      'email', u.email,
      'avatar_url', u.avatar_url
    ) as user_payload,
    case
      when expense_context.id is not null then jsonb_build_object(
        'id', expense_context.id,
        'title', expense_context.title,
        'amount', expense_context.amount,
        'currency', expense_context.currency,
        'due_date', expense_context.due_date,
        'vendor_name', expense_context.vendor_name,
        'invoice_reference', expense_context.invoice_reference,
        'invoice_date', expense_context.invoice_date,
        'payment_due_date', expense_context.payment_due_date,
        'category', expense_context.category,
        'recurrence_type', expense_context.recurrence_type,
        'effective_due_date', coalesce(expense_context.payment_due_date, expense_context.due_date),
        'is_overdue', coalesce(expense_context.payment_due_date, expense_context.due_date) < current_date
      )
      when payment_expense.id is not null then jsonb_build_object(
        'id', payment_expense.id,
        'title', payment_expense.title,
        'amount', payment_expense.amount,
        'currency', payment_expense.currency,
        'due_date', payment_expense.due_date,
        'vendor_name', payment_expense.vendor_name,
        'invoice_reference', payment_expense.invoice_reference,
        'invoice_date', payment_expense.invoice_date,
        'payment_due_date', payment_expense.payment_due_date,
        'category', payment_expense.category,
        'recurrence_type', payment_expense.recurrence_type,
        'effective_due_date', coalesce(payment_expense.payment_due_date, payment_expense.due_date),
        'is_overdue', coalesce(payment_expense.payment_due_date, payment_expense.due_date) < current_date
      )
      else null
    end as workspace_billing_context
  from activity_log al
  join membership on true
  left join users u
    on u.id = al.user_id
  left join expenses expense_context
    on al.entity_type = 'expense'
   and expense_context.id = al.entity_id
  left join payment_records pr
    on al.entity_type = 'payment'
   and pr.id = al.entity_id
  left join expenses payment_expense
    on payment_expense.id = pr.expense_id
  where al.group_id = p_group_id
    and (
      coalesce(array_length(p_entity_types, 1), 0) = 0
      or al.entity_type = any(p_entity_types)
    )
),
summary_rows as (
  select
    user_id,
    coalesce(user_payload->>'name', user_payload->>'email', 'Unknown') as user_name,
    coalesce(entity_type, 'other') as entity_type
  from base
  where created_at >= date_trunc('month', timezone('utc', now()))
),
summary_counts as (
  select
    count(*)::int as this_month
  from summary_rows
),
most_active as (
  select
    user_name,
    count(*)::int as activity_count
  from summary_rows
  group by user_name
  order by activity_count desc, user_name asc
  limit 1
),
by_type as (
  select
    entity_type,
    count(*)::int as activity_count
  from summary_rows
  group by entity_type
),
filtered_count as (
  select count(*)::int as total_count
  from base
),
page_items as (
  select *
  from base
  order by created_at desc
  limit greatest(coalesce(p_limit, 20), 1)
  offset greatest(coalesce(p_offset, 0), 0)
)
select jsonb_build_object(
  'entries',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', page_items.id,
          'group_id', page_items.group_id,
          'user_id', page_items.user_id,
          'action', page_items.action,
          'entity_type', page_items.entity_type,
          'entity_id', page_items.entity_id,
          'metadata', page_items.metadata,
          'created_at', page_items.created_at,
          'workspace_billing_context', page_items.workspace_billing_context,
          'user', page_items.user_payload
        )
        order by page_items.created_at desc
      )
      from page_items
    ),
    '[]'::jsonb
  ),
  'total', (select total_count from filtered_count),
  'summary',
  jsonb_build_object(
    'thisMonth', (select this_month from summary_counts),
    'mostActiveName', coalesce((select user_name from most_active), ''),
    'mostActiveCount', coalesce((select activity_count from most_active), 0),
    'byType',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'type', entity_type,
            'count', activity_count
          )
          order by activity_count desc, entity_type asc
        )
        from by_type
      ),
      '[]'::jsonb
    )
  )
);
$$;

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
with membership as (
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
    e.id as expense_id
  from expenses e
  join group_context gc on true
  where e.group_id = p_group_id
    and e.is_active = true
    and e.created_at >= now() - make_interval(days => greatest(coalesce(p_cutoff_days, 30), 1))
  order by e.created_at desc
  limit greatest(coalesce(p_limit, 30), 1)
),
recent_payments as (
  select
    'payment-' || pr.id::text as id,
    'payment_made'::text as type,
    'Payment received'::text as title,
    gc.currency_symbol || trim(to_char(pr.amount::numeric, 'FM9999999999990.00')) || ' paid for ' || e.title as description,
    pr.paid_at as created_at,
    e.id as expense_id
  from payment_records pr
  join expenses e
    on e.id = pr.expense_id
  join group_context gc on true
  where e.group_id = p_group_id
    and pr.status = 'paid'
    and pr.user_id <> auth.uid()
    and pr.paid_at >= now() - make_interval(days => greatest(coalesce(p_cutoff_days, 30), 1))
  order by pr.paid_at desc
  limit greatest(coalesce(p_limit, 30), 1)
),
overdue_items as (
  select distinct on (pr.id)
    'overdue-' || pr.id::text as id,
    'payment_overdue'::text as type,
    'Payment overdue'::text as title,
    gc.currency_symbol || trim(to_char(pr.amount::numeric, 'FM9999999999990.00')) || ' for ' || e.title || ' was due ' || e.due_date::text as description,
    e.due_date::timestamptz as created_at,
    e.id as expense_id
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
  order by created_at desc
  limit greatest(coalesce(p_limit, 30), 1)
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
    order by ranked.created_at desc
  ),
  '[]'::jsonb
)
from ranked
left join read_rows
  on read_rows.notification_id = ranked.id;
$$;
