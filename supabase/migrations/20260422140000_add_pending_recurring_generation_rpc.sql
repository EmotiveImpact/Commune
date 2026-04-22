create or replace function fn_has_pending_recurring_generation(
  p_group_id uuid,
  p_month text default to_char(current_date, 'YYYY-MM')
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
select exists (
  select 1
  from expenses e
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
);
$$;
