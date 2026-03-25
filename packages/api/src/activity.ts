import { supabase } from './client';
import {
  createWorkspaceBillingContext,
  type WorkspaceBillingContext,
  type WorkspaceBillingExpenseRecord,
} from './workspace-billing';

export interface ActivityEntry {
  id: string;
  group_id: string;
  user_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  workspace_billing_context?: ActivityWorkspaceBillingContext | null;
  user: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
  };
}

export type ActivityWorkspaceBillingContext = WorkspaceBillingContext;

export async function getActivityLog(
  groupId: string,
  limit = 50,
  offset = 0,
): Promise<ActivityEntry[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select(
      `
      *,
      user:users(id, name, email, avatar_url)
    `,
    )
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const entries = (data ?? []) as ActivityEntry[];
  const expenseIds = [
    ...new Set(
      entries
        .filter((entry) => entry.entity_type === 'expense' && entry.entity_id)
        .map((entry) => entry.entity_id as string),
    ),
  ];
  const paymentIds = [
    ...new Set(
      entries
        .filter((entry) => entry.entity_type === 'payment' && entry.entity_id)
        .map((entry) => entry.entity_id as string),
    ),
  ];

  const paymentRows = paymentIds.length > 0
    ? await supabase.from('payment_records').select('id, expense_id').in('id', paymentIds)
    : { data: [], error: null as null };

  if (paymentRows.error) throw paymentRows.error;

  const paymentExpenseIds = new Set(
    (paymentRows.data ?? []).map((row) => row.expense_id as string),
  );
  const relatedExpenseIds = [...new Set([...expenseIds, ...paymentExpenseIds])];

  const relatedExpenses =
    relatedExpenseIds.length > 0
      ? await supabase
          .from('expenses')
          .select(
            'id, title, amount, currency, due_date, vendor_name, invoice_reference, invoice_date, payment_due_date',
          )
          .in('id', relatedExpenseIds)
      : { data: [], error: null as null };

  if (relatedExpenses.error) throw relatedExpenses.error;

  const billingByExpenseId = new Map<string, ActivityWorkspaceBillingContext>();
  for (const row of (relatedExpenses.data ?? []) as WorkspaceBillingExpenseRecord[]) {
    billingByExpenseId.set(row.id, createWorkspaceBillingContext(row));
  }

  const billingByPaymentId = new Map<string, ActivityWorkspaceBillingContext>();
  for (const row of (paymentRows.data ?? []) as Array<{ id: string; expense_id: string }>) {
    const context = billingByExpenseId.get(row.expense_id);
    if (context) {
      billingByPaymentId.set(row.id, context);
    }
  }

  return entries.map((entry) => {
    if (entry.entity_type === 'expense' && entry.entity_id) {
      return {
        ...entry,
        workspace_billing_context: billingByExpenseId.get(entry.entity_id) ?? null,
      };
    }

    if (entry.entity_type === 'payment' && entry.entity_id) {
      return {
        ...entry,
        workspace_billing_context: billingByPaymentId.get(entry.entity_id) ?? null,
      };
    }

    return entry;
  });
}
