import type {
  MonthlyBreakdown,
  BreakdownItem,
  ExpenseWithParticipants,
} from '@commune/types';
import { supabase } from './client';

export async function getUserBreakdown(
  groupId: string,
  userId: string,
  month: string,
): Promise<MonthlyBreakdown> {
  const startDate = `${month}-01`;
  const [year, mon] = month.split('-').map(Number);
  const endDate = new Date(year!, mon!, 1).toISOString().split('T')[0];

  const { data: expenses, error } = await supabase
    .from('expenses')
    .select(
      `
      *,
      participants:expense_participants(
        *,
        user:users(*)
      ),
      payment_records(*),
      paid_by_user:users!expenses_paid_by_user_id_fkey(*)
    `,
    )
    .eq('group_id', groupId)
    .eq('is_active', true)
    .gte('due_date', startDate)
    .lt('due_date', endDate!)
    .order('due_date', { ascending: false });

  if (error) throw error;

  const typed = (expenses ?? []) as unknown as ExpenseWithParticipants[];

  let totalOwed = 0;
  let totalPaid = 0;
  const items: BreakdownItem[] = [];

  for (const expense of typed) {
    const participation = expense.participants.find(
      (p) => p.user_id === userId,
    );
    if (!participation) continue;

    const payment = expense.payment_records.find(
      (pr) => pr.user_id === userId,
    );
    const paymentStatus = payment?.status ?? 'unpaid';

    totalOwed += participation.share_amount;
    if (paymentStatus !== 'unpaid') {
      totalPaid += participation.share_amount;
    }

    items.push({
      expense,
      share_amount: participation.share_amount,
      payment_status: paymentStatus as 'unpaid' | 'paid' | 'confirmed',
      paid_by_user: expense.paid_by_user,
    });
  }

  return {
    month,
    total_owed: totalOwed,
    total_paid: totalPaid,
    remaining: totalOwed - totalPaid,
    items,
  };
}
