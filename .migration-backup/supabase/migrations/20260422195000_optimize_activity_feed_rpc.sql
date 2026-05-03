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
activity_scope as (
  select
    al.id,
    al.group_id,
    al.user_id,
    al.action,
    al.entity_type,
    al.entity_id,
    al.metadata,
    al.created_at
  from activity_log al
  join membership on true
  where al.group_id = p_group_id
    and (
      coalesce(array_length(p_entity_types, 1), 0) = 0
      or al.entity_type = any(p_entity_types)
    )
),
summary_rows as (
  select
    user_id,
    coalesce(entity_type, 'other') as entity_type
  from activity_scope
  where created_at >= date_trunc('month', timezone('utc', now()))
),
summary_counts as (
  select count(*)::int as this_month
  from summary_rows
),
most_active_counts as (
  select
    user_id,
    count(*)::int as activity_count
  from summary_rows
  group by user_id
  order by activity_count desc, user_id asc
  limit 1
),
most_active as (
  select
    coalesce(u.name, u.email, 'Unknown') as user_name,
    mac.activity_count
  from most_active_counts mac
  left join users u on u.id = mac.user_id
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
  from activity_scope
),
page_items as (
  select *
  from activity_scope
  order by created_at desc
  limit greatest(coalesce(p_limit, 20), 1)
  offset greatest(coalesce(p_offset, 0), 0)
),
enriched_page as (
  select
    pi.id,
    pi.group_id,
    pi.user_id,
    pi.action,
    pi.entity_type,
    pi.entity_id,
    pi.metadata,
    pi.created_at,
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
  from page_items pi
  left join users u
    on u.id = pi.user_id
  left join expenses expense_context
    on pi.entity_type = 'expense'
   and expense_context.id = pi.entity_id
  left join payment_records pr
    on pi.entity_type = 'payment'
   and pr.id = pi.entity_id
  left join expenses payment_expense
    on payment_expense.id = pr.expense_id
)
select jsonb_build_object(
  'entries',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', enriched_page.id,
          'group_id', enriched_page.group_id,
          'user_id', enriched_page.user_id,
          'action', enriched_page.action,
          'entity_type', enriched_page.entity_type,
          'entity_id', enriched_page.entity_id,
          'metadata', enriched_page.metadata,
          'created_at', enriched_page.created_at,
          'workspace_billing_context', enriched_page.workspace_billing_context,
          'user', enriched_page.user_payload
        )
        order by enriched_page.created_at desc
      )
      from enriched_page
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
