-- Paged expense ledger RPC for the web app.
-- Moves ledger filtering/counting into Postgres so the client does not need
-- to hydrate every matching expense just to render the table and summary chips.

CREATE INDEX IF NOT EXISTS idx_expenses_group_active_due_date
  ON expenses (group_id, is_active, due_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_group_active_approval_due_date
  ON expenses (group_id, is_active, approval_status, due_date DESC);

create or replace function fn_get_expense_ledger(
  p_group_id uuid,
  p_category text default null,
  p_month text default null,
  p_date_from date default null,
  p_date_to date default null,
  p_search text default null,
  p_workspace_view text default 'all',
  p_status text default 'all',
  p_is_workspace_group boolean default false,
  p_page integer default 0,
  p_page_size integer default 20,
  p_include_all boolean default false
) returns jsonb
language sql
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
    e.id,
    e.title,
    e.category::text as category,
    e.amount,
    e.currency,
    e.due_date,
    e.approval_status,
    e.recurrence_type::text as recurrence_type,
    e.vendor_name,
    e.invoice_reference,
    e.invoice_date,
    e.payment_due_date,
    coalesce(participants.participant_count, 0)::int as participant_count,
    coalesce(payments.paid_count, 0)::int as paid_count,
    coalesce(e.payment_due_date, e.due_date) as effective_due_date,
    (
      nullif(btrim(coalesce(e.vendor_name, '')), '') is not null
      or nullif(btrim(coalesce(e.invoice_reference, '')), '') is not null
      or e.invoice_date is not null
      or e.payment_due_date is not null
    ) as has_workspace_context,
    (
      coalesce(participants.participant_count, 0) > 0
      and coalesce(payments.paid_count, 0) = coalesce(participants.participant_count, 0)
    ) as is_settled
  from expenses e
  join membership on true
  left join lateral (
    select count(*) as participant_count
    from expense_participants ep
    where ep.expense_id = e.id
  ) participants on true
  left join lateral (
    select count(*) as paid_count
    from payment_records pr
    where pr.expense_id = e.id
      and pr.status <> 'unpaid'
  ) payments on true
  where e.group_id = p_group_id
    and e.is_active = true
    and (
      nullif(btrim(coalesce(p_category, '')), '') is null
      or e.category::text = p_category
    )
    and (
      nullif(btrim(coalesce(p_month, '')), '') is null
      or (
        e.due_date >= (p_month || '-01')::date
        and e.due_date < ((p_month || '-01')::date + interval '1 month')
      )
    )
),
pre_status as (
  select
    *,
    case
      when approval_status <> 'approved' then 'not_applicable'
      when is_settled then 'settled'
      when due_date < current_date then 'overdue'
      else 'open'
    end as payment_state
  from base
  where (p_date_from is null or due_date >= p_date_from)
    and (p_date_to is null or due_date <= p_date_to)
    and (
      nullif(btrim(coalesce(p_search, '')), '') is null
      or (
        lower(title) like '%' || lower(p_search) || '%'
        or lower(coalesce(category, '')) like '%' || lower(p_search) || '%'
        or lower(coalesce(vendor_name, '')) like '%' || lower(p_search) || '%'
        or lower(coalesce(invoice_reference, '')) like '%' || lower(p_search) || '%'
        or lower(coalesce(to_char(invoice_date, 'YYYY-MM-DD'), '')) like '%' || lower(p_search) || '%'
        or lower(coalesce(to_char(payment_due_date, 'YYYY-MM-DD'), '')) like '%' || lower(p_search) || '%'
      )
    )
    and (
      coalesce(nullif(btrim(coalesce(p_workspace_view, '')), ''), 'all') = 'all'
      or (p_workspace_view = 'linked' and has_workspace_context)
      or (p_workspace_view = 'missing' and not has_workspace_context)
      or (
        p_workspace_view = 'due-soon'
        and not is_settled
        and effective_due_date >= current_date
        and effective_due_date <= (current_date + 7)
      )
    )
),
summary as (
  select
    count(*)::int as total_count,
    coalesce(sum(amount), 0)::numeric as total_amount,
    count(*) filter (
      where approval_status = 'approved' and payment_state = 'open'
    )::int as open_count,
    count(*) filter (
      where approval_status = 'approved' and payment_state = 'overdue'
    )::int as overdue_count,
    count(*) filter (
      where approval_status = 'approved' and payment_state = 'settled'
    )::int as settled_count,
    count(*) filter (where has_workspace_context)::int as linked_count,
    count(*) filter (where not has_workspace_context)::int as missing_count,
    count(*) filter (
      where not is_settled
        and effective_due_date >= current_date
        and effective_due_date <= (current_date + 7)
    )::int as due_soon_count
  from pre_status
),
status_filtered as (
  select *
  from pre_status
  where coalesce(nullif(btrim(coalesce(p_status, '')), ''), 'all') = 'all'
    or (
      p_status = 'open'
      and approval_status = 'approved'
      and payment_state = 'open'
    )
    or (
      p_status = 'overdue'
      and approval_status = 'approved'
      and payment_state = 'overdue'
    )
    or (
      p_status = 'settled'
      and approval_status = 'approved'
      and payment_state = 'settled'
    )
),
filtered_count as (
  select count(*)::int as total_count
  from status_filtered
),
ordered as (
  select *
  from status_filtered
  order by
    case
      when p_is_workspace_group and not is_settled then 0
      when p_is_workspace_group then 1
      else 0
    end asc,
    case when p_is_workspace_group then effective_due_date end asc nulls last,
    case when p_is_workspace_group then title end asc nulls last,
    case when not p_is_workspace_group then due_date end desc nulls last,
    case when not p_is_workspace_group then title end asc nulls last
),
page_items as (
  select
    row_number() over () as page_order,
    *
  from ordered
  limit case
    when p_include_all then 2147483647
    else greatest(coalesce(p_page_size, 20), 1)
  end
  offset case
    when p_include_all then 0
    else greatest(coalesce(p_page, 0), 0) * greatest(coalesce(p_page_size, 20), 1)
  end
)
select jsonb_build_object(
  'summary',
  jsonb_build_object(
    'total_count', summary.total_count,
    'total_amount', summary.total_amount,
    'open_count', summary.open_count,
    'overdue_count', summary.overdue_count,
    'settled_count', summary.settled_count,
    'workspace', jsonb_build_object(
      'linked_count', summary.linked_count,
      'missing_count', summary.missing_count,
      'due_soon_count', summary.due_soon_count
    )
  ),
  'filtered_count', filtered_count.total_count,
  'items',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', page_items.id,
          'title', page_items.title,
          'category', page_items.category,
          'amount', page_items.amount,
          'currency', page_items.currency,
          'due_date', page_items.due_date,
          'approval_status', page_items.approval_status,
          'recurrence_type', page_items.recurrence_type,
          'vendor_name', page_items.vendor_name,
          'invoice_reference', page_items.invoice_reference,
          'invoice_date', page_items.invoice_date,
          'payment_due_date', page_items.payment_due_date,
          'participant_count', page_items.participant_count,
          'paid_count', page_items.paid_count
        )
        order by page_items.page_order
      )
      from page_items
    ),
    '[]'::jsonb
  )
)
from summary, filtered_count;
$$;
