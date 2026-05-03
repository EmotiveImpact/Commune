create index if not exists idx_expenses_group_active_created_at
  on public.expenses (group_id, created_at desc)
  where is_active = true;

create index if not exists idx_payment_records_paid_at_expense_paid
  on public.payment_records (paid_at desc, expense_id)
  where status = 'paid';

create index if not exists idx_payment_records_expense_unpaid
  on public.payment_records (expense_id)
  where status = 'unpaid';

create index if not exists idx_group_members_active_group_user_covering
  on public.group_members (group_id, user_id)
  include (role, responsibility_label)
  where status = 'active';

create index if not exists idx_group_members_active_user_group_covering_v2
  on public.group_members (user_id, group_id)
  include (role, responsibility_label)
  where status = 'active';
