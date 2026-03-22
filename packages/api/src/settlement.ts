import type {
  SettlementResult,
  SettlementTransaction,
  ExpenseWithParticipants,
} from '@commune/types';
import { calculateNetBalances, simplifyDebts } from '@commune/core';
import { buildPaymentUrl } from '@commune/core';
import { supabase } from './client';

/**
 * Fetch all active expenses for a group and compute the minimum set of
 * settlement transactions needed to clear all debts.
 *
 * Optionally scoped to a single month (YYYY-MM). If no month is provided,
 * all active expenses in the group are considered.
 */
export async function getGroupSettlement(
  groupId: string,
  month?: string,
): Promise<SettlementResult> {
  // ── 1. Fetch expenses with participants and payer info ────────────────
  let query = supabase
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
    .eq('is_active', true);

  if (month) {
    const startDate = `${month}-01`;
    const [year, mon] = month.split('-').map(Number);
    const endDate = new Date(year!, mon!, 1).toISOString().split('T')[0];
    query = query.gte('due_date', startDate).lt('due_date', endDate!);
  }

  const { data: expenses, error } = await query.order('due_date', {
    ascending: false,
  });

  if (error) throw error;

  const typed = (expenses ?? []) as unknown as ExpenseWithParticipants[];

  if (typed.length === 0) {
    return { transactions: [], transactionCount: 0, isSettled: true };
  }

  // ── 2. Build expense data for the algorithm ──────────────────────────
  // Only consider expenses that have a payer (paid_by_user_id).
  // Exclude participant shares that are already marked paid/confirmed.
  const expenseData = typed
    .filter((e) => e.paid_by_user_id != null)
    .map((e) => {
      const paidUserIds = new Set(
        e.payment_records
          .filter((pr) => pr.status === 'paid' || pr.status === 'confirmed')
          .map((pr) => pr.user_id),
      );

      return {
        payerId: e.paid_by_user_id!,
        participants: e.participants
          .filter((p) => !paidUserIds.has(p.user_id)) // exclude already-paid shares
          .map((p) => ({
            userId: p.user_id,
            shareAmount: p.share_amount,
          })),
      };
    })
    .filter((e) => e.participants.length > 0);

  // ── 3. Run the algorithm ─────────────────────────────────────────────
  const balances = calculateNetBalances(expenseData);
  const rawTransactions = simplifyDebts(balances);

  if (rawTransactions.length === 0) {
    return { transactions: [], transactionCount: 0, isSettled: true };
  }

  // ── 4. Fetch member profiles for names + payment links ───────────────
  const allUserIds = new Set<string>();
  for (const t of rawTransactions) {
    allUserIds.add(t.fromUserId);
    allUserIds.add(t.toUserId);
  }

  const { data: users } = await supabase
    .from('users')
    .select('id, name, payment_provider, payment_link')
    .in('id', Array.from(allUserIds));

  const userMap = new Map(
    (users ?? []).map((u) => [
      u.id as string,
      {
        name: u.name as string,
        paymentProvider: u.payment_provider as string | null,
        paymentLink: u.payment_link as string | null,
      },
    ]),
  );

  // ── 5. Enrich transactions with names + payment links ────────────────
  const transactions: SettlementTransaction[] = rawTransactions.map((t) => {
    const toUser = userMap.get(t.toUserId);
    const fromUser = userMap.get(t.fromUserId);

    let paymentLink: string | null = null;
    let paymentProvider = (toUser?.paymentProvider as SettlementTransaction['paymentProvider']) ?? null;

    if (toUser?.paymentProvider && toUser?.paymentLink) {
      const result = buildPaymentUrl(
        {
          provider: toUser.paymentProvider as any,
          link: toUser.paymentLink,
        },
        t.amount,
      );
      if (result) {
        paymentLink = result.url;
      }
    }

    return {
      fromUserId: t.fromUserId,
      toUserId: t.toUserId,
      amount: t.amount,
      fromUserName: fromUser?.name ?? 'Unknown',
      toUserName: toUser?.name ?? 'Unknown',
      paymentLink,
      paymentProvider,
    };
  });

  return {
    transactions,
    transactionCount: transactions.length,
    isSettled: false,
  };
}
