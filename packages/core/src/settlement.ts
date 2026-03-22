// ─── Smart Settlement / Minimum Transactions Algorithm ──────────────────────
// All monetary calculations use cents internally to avoid floating-point errors.

import type { SettlementTransaction, SettlementResult } from '@commune/types';

/**
 * Represents the net balance for a single group member.
 * Positive = creditor (is owed money), Negative = debtor (owes money).
 */
export interface NetBalance {
  userId: string;
  amount: number; // in currency units (e.g. pounds), 2 decimal places
}

/**
 * Calculate the net balance for each member of a group.
 *
 * For each expense:
 *   - The payer gets credited the full expense amount
 *   - Each participant (including the payer) gets debited their share
 *
 * Net = total_credited - total_debited
 *   Positive net → creditor (others owe them)
 *   Negative net → debtor (they owe others)
 *
 * @param expenses - Array of { payerId, participants: { userId, shareAmount }[] }
 * @returns Array of net balances (zero-balance members excluded)
 */
export function calculateNetBalances(
  expenses: {
    payerId: string;
    participants: { userId: string; shareAmount: number }[];
  }[],
): NetBalance[] {
  const balanceMap = new Map<string, number>(); // userId → net cents

  for (const expense of expenses) {
    // Total expense amount is the sum of all participant shares
    const totalCents = expense.participants.reduce(
      (sum, p) => sum + Math.round(p.shareAmount * 100),
      0,
    );

    // Credit the payer for the full amount
    balanceMap.set(
      expense.payerId,
      (balanceMap.get(expense.payerId) ?? 0) + totalCents,
    );

    // Debit each participant for their share
    for (const p of expense.participants) {
      const shareCents = Math.round(p.shareAmount * 100);
      balanceMap.set(
        p.userId,
        (balanceMap.get(p.userId) ?? 0) - shareCents,
      );
    }
  }

  // Convert back to currency units, exclude zero balances
  const balances: NetBalance[] = [];
  for (const [userId, cents] of balanceMap) {
    if (cents === 0) continue;
    balances.push({
      userId,
      amount: Number((cents / 100).toFixed(2)),
    });
  }

  return balances;
}

/**
 * Simplify debts using a greedy algorithm that minimizes the number of transactions.
 *
 * Algorithm:
 *  1. Separate members into creditors (positive balance) and debtors (negative balance).
 *  2. Sort creditors descending by amount, debtors descending by |amount|.
 *  3. Match largest creditor with largest debtor:
 *     - Settle min(creditor.amount, |debtor.amount|)
 *     - Reduce both balances accordingly
 *     - Remove anyone whose balance reaches zero
 *  4. Repeat until all balances are zero.
 *
 * @param balances - Net balances from calculateNetBalances()
 * @returns Array of simplified transactions (from debtor → creditor)
 */
export function simplifyDebts(
  balances: NetBalance[],
): SettlementTransaction[] {
  if (balances.length <= 1) return [];

  // Work in cents to avoid floating-point drift
  const creditors: { userId: string; cents: number }[] = [];
  const debtors: { userId: string; cents: number }[] = [];

  for (const b of balances) {
    const cents = Math.round(b.amount * 100);
    if (cents > 0) {
      creditors.push({ userId: b.userId, cents });
    } else if (cents < 0) {
      debtors.push({ userId: b.userId, cents: Math.abs(cents) });
    }
  }

  // Sort descending by amount
  creditors.sort((a, b) => b.cents - a.cents);
  debtors.sort((a, b) => b.cents - a.cents);

  const transactions: SettlementTransaction[] = [];

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]!;
    const debtor = debtors[di]!;

    const settleCents = Math.min(creditor.cents, debtor.cents);
    if (settleCents > 0) {
      transactions.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amount: Number((settleCents / 100).toFixed(2)),
      });
    }

    creditor.cents -= settleCents;
    debtor.cents -= settleCents;

    if (creditor.cents === 0) ci++;
    if (debtor.cents === 0) di++;
  }

  return transactions;
}

/**
 * End-to-end settlement: calculate net balances then simplify debts.
 *
 * @param expenses - Group expenses with payer and participant shares
 * @param memberNames - Map of userId → display name (for UI labelling)
 * @returns Full settlement result with transactions, count, and settled flag
 */
export function calculateSettlement(
  expenses: {
    payerId: string;
    participants: { userId: string; shareAmount: number }[];
  }[],
  memberNames: Map<string, string>,
): SettlementResult {
  if (expenses.length === 0) {
    return { transactions: [], transactionCount: 0, isSettled: true };
  }

  const balances = calculateNetBalances(expenses);
  const rawTransactions = simplifyDebts(balances);

  // Attach display names
  const transactions: SettlementTransaction[] = rawTransactions.map((t) => ({
    ...t,
    fromUserName: memberNames.get(t.fromUserId) ?? 'Unknown',
    toUserName: memberNames.get(t.toUserId) ?? 'Unknown',
  }));

  return {
    transactions,
    transactionCount: transactions.length,
    isSettled: transactions.length === 0,
  };
}
