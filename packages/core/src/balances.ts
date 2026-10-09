export type BalanceShare = { userId: string; amountMinor: number; settledMinor: number };
export type BalanceExpense = { paidByUserId: string; voidedAt?: string | null; shares: BalanceShare[] };

/**
 * What stands between the viewer and each other member, from the unpaid part of
 * every share one of them owes the other: positive when they owe the viewer,
 * negative when the viewer owes them. Debts in both directions offset, so each
 * person has one figure with a direction, and the figures add up to the
 * viewer's own net. Voided expenses never count. Someone with nothing
 * outstanding either way is absent or zero.
 */
export function netBalances(expenses: BalanceExpense[], viewerId: string): Map<string, number> {
  const nets = new Map<string, number>();
  for (const expense of expenses) {
    if (expense.voidedAt) continue;
    for (const share of expense.shares) {
      if (share.userId === expense.paidByUserId) continue;
      const due = Math.max(0, share.amountMinor - share.settledMinor);
      if (!due) continue;
      if (expense.paidByUserId === viewerId) nets.set(share.userId, (nets.get(share.userId) ?? 0) + due);
      else if (share.userId === viewerId) nets.set(expense.paidByUserId, (nets.get(expense.paidByUserId) ?? 0) - due);
    }
  }
  return nets;
}

/** The viewer's position across everyone: positive when they are owed overall. */
export function overallNet(nets: Map<string, number>): number {
  let total = 0;
  for (const net of nets.values()) total += net;
  return total;
}
