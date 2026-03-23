import type {
  SettlementResult,
  SettlementTransaction,
  ExpenseWithParticipants,
  LinkedPair,
  PaymentProvider,
} from '@commune/types';
import { calculateNetBalances, simplifyDebts, mergeLinkedBalances } from '@commune/core';
import { buildPaymentUrl } from '@commune/core';
import { supabase } from './client';
import { getLinkedPairs } from './couple-linking';

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
    .eq('is_active', true)
    .eq('approval_status', 'approved');

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

  // ── 3. Run the algorithm (with couple mode support) ─────────────────
  const balances = calculateNetBalances(expenseData);

  // Fetch linked pairs for this group (couple mode)
  let linkedPairs: LinkedPair[] = [];
  try {
    linkedPairs = await getLinkedPairs(groupId);
  } catch {
    // If couple linking table doesn't exist yet, proceed without it
  }

  // Build a name map for merging linked balances
  const allBalanceUserIds = new Set<string>();
  for (const b of balances) allBalanceUserIds.add(b.userId);
  // Also include partner user IDs from linked pairs
  for (const pair of linkedPairs) {
    allBalanceUserIds.add(pair.userIdA);
    allBalanceUserIds.add(pair.userIdB);
  }

  const { data: balanceUsers } = await supabase
    .from('users')
    .select('id, name')
    .in('id', Array.from(allBalanceUserIds));

  const nameMap = new Map(
    (balanceUsers ?? []).map((u) => [u.id as string, u.name as string]),
  );

  // Merge linked pairs then simplify
  const { mergedBalances, mergedNames } =
    linkedPairs.length > 0
      ? mergeLinkedBalances(balances, linkedPairs, nameMap)
      : { mergedBalances: balances, mergedNames: nameMap };

  const rawTransactions = simplifyDebts(mergedBalances);

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
    .select('id, name')
    .in('id', Array.from(allUserIds));

  // Fetch payment methods from the new table for all users
  const { data: paymentMethodRows } = await supabase
    .from('user_payment_methods')
    .select('*')
    .in('user_id', Array.from(allUserIds))
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  // Build a map: userId -> default payment method (first one, which is default-sorted)
  const defaultMethodMap = new Map<string, { provider: string; link: string | null; info: string | null }>();
  for (const pm of paymentMethodRows ?? []) {
    if (!defaultMethodMap.has(pm.user_id as string)) {
      defaultMethodMap.set(pm.user_id as string, {
        provider: pm.provider as string,
        link: pm.payment_link as string | null,
        info: pm.payment_info as string | null,
      });
    }
  }

  const userMap = new Map(
    (users ?? []).map((u) => [
      u.id as string,
      {
        name: u.name as string,
        paymentProvider: defaultMethodMap.get(u.id as string)?.provider ?? null,
        paymentLink: defaultMethodMap.get(u.id as string)?.link ?? null,
      },
    ]),
  );

  // ── 5. Enrich transactions with names + payment links ────────────────
  const transactions: SettlementTransaction[] = rawTransactions.map((t) => {
    const toUser = userMap.get(t.toUserId);
    const fromUser = userMap.get(t.fromUserId);

    // Use merged couple names if available, otherwise fall back to individual names
    const fromName = mergedNames.get(t.fromUserId) ?? fromUser?.name ?? 'Unknown';
    const toName = mergedNames.get(t.toUserId) ?? toUser?.name ?? 'Unknown';

    let paymentLink: string | null = null;
    let paymentProvider = (toUser?.paymentProvider as SettlementTransaction['paymentProvider']) ?? null;

    if (toUser?.paymentProvider && toUser?.paymentLink) {
      const result = buildPaymentUrl(
        {
          provider: toUser.paymentProvider as PaymentProvider,
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
      fromUserName: fromName,
      toUserName: toName,
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
