// ─── F37: Cross-Group Debt Netting ──────────────────────────────────────────
// Aggregates settlement transactions across multiple groups and nets out debts
// between the same person-pairs. Only nets debts denominated in the same
// currency — mixed-currency debts are kept separate.

import type {
  GroupSettlementInput,
  CrossGroupTransaction,
  CrossGroupResult,
} from '@commune/types';

/**
 * Unique key for a directed debt between two users in a given currency.
 * We normalise the direction so A→B and B→A cancel out.
 */
function pairKey(userA: string, userB: string, currency: string): string {
  const [lo, hi] = userA < userB ? [userA, userB] : [userB, userA];
  return `${lo}::${hi}::${currency}`;
}

interface PairAccumulator {
  /** Canonical "lower" user id */
  loUserId: string;
  loName: string;
  /** Canonical "higher" user id */
  hiUserId: string;
  hiName: string;
  currency: string;
  /**
   * Net amount from lo's perspective:
   *   positive = lo is owed by hi (hi owes lo)
   *   negative = lo owes hi
   */
  netCents: number;
  /** Group names that contributed to this pair */
  groups: Set<string>;
}

/**
 * Aggregate settlement transactions from multiple groups and compute the
 * minimum set of cross-group transfers.
 *
 * @param settlementsByGroup - Per-group settlement results with group metadata
 * @returns Netted cross-group transactions
 */
export function netCrossGroupDebts(
  settlementsByGroup: GroupSettlementInput[],
): CrossGroupResult {
  const pairMap = new Map<string, PairAccumulator>();

  for (const group of settlementsByGroup) {
    for (const tx of group.settlements) {
      const key = pairKey(tx.fromUserId, tx.toUserId, group.currency);
      const isFromLo = tx.fromUserId < tx.toUserId;

      let acc = pairMap.get(key);
      if (!acc) {
        const [loId, hiId] = isFromLo
          ? [tx.fromUserId, tx.toUserId]
          : [tx.toUserId, tx.fromUserId];
        const [loName, hiName] = isFromLo
          ? [tx.fromUserName ?? 'Unknown', tx.toUserName ?? 'Unknown']
          : [tx.toUserName ?? 'Unknown', tx.fromUserName ?? 'Unknown'];

        acc = {
          loUserId: loId,
          loName,
          hiUserId: hiId,
          hiName,
          currency: group.currency,
          netCents: 0,
          groups: new Set<string>(),
        };
        pairMap.set(key, acc);
      }

      // tx represents: fromUser owes toUser `amount`
      // In our canonical form, if fromUser == lo, then lo owes hi → negative
      const amountCents = Math.round(tx.amount * 100);
      if (isFromLo) {
        // lo owes hi → decrease net (lo perspective)
        acc.netCents -= amountCents;
      } else {
        // hi owes lo → increase net (lo perspective)
        acc.netCents += amountCents;
      }

      acc.groups.add(group.groupName);
    }
  }

  // Build final transactions — skip zero-balance pairs
  const transactions: CrossGroupTransaction[] = [];

  for (const acc of pairMap.values()) {
    if (acc.netCents === 0) continue;

    const amount = Number((Math.abs(acc.netCents) / 100).toFixed(2));
    const groups = Array.from(acc.groups).sort();

    if (acc.netCents > 0) {
      // lo is owed → hi owes lo
      transactions.push({
        fromUserId: acc.hiUserId,
        fromName: acc.hiName,
        toUserId: acc.loUserId,
        toName: acc.loName,
        netAmount: amount,
        currency: acc.currency,
        groups,
      });
    } else {
      // lo owes hi
      transactions.push({
        fromUserId: acc.loUserId,
        fromName: acc.loName,
        toUserId: acc.hiUserId,
        toName: acc.hiName,
        netAmount: amount,
        currency: acc.currency,
        groups,
      });
    }
  }

  // Sort by amount descending for consistent output
  transactions.sort((a, b) => b.netAmount - a.netAmount);

  return {
    transactions,
    transactionCount: transactions.length,
    isSettled: transactions.length === 0,
  };
}
