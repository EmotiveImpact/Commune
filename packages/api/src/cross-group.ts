// ─── F37: Cross-Group Debt Netting — API Layer ─────────────────────────────
// Fetches settlements from ALL groups the user belongs to, then runs
// cross-group netting to produce a single optimised list of transfers.

import type {
  CrossGroupResult,
  GroupSettlementInput,
} from '@commune/types';
import { netCrossGroupDebts } from '@commune/core';
import { supabase } from './client';
import { getGroupSettlement } from './settlement';

/**
 * Compute cross-group netted settlements for the authenticated user.
 *
 * 1. Fetch every group the user is an active member of.
 * 2. Compute per-group settlements (reuses getGroupSettlement).
 * 3. Run cross-group netting to collapse debts between the same pairs.
 *
 * @param userId - The authenticated user's id
 * @returns Cross-group netted result
 */
export async function getCrossGroupSettlements(
  userId: string,
): Promise<CrossGroupResult> {
  // ── 1. Get all groups the user belongs to ─────────────────────────────
  const { data: memberships, error: memberError } = await supabase
    .from('group_members')
    .select('group:groups(id, name, currency)')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (memberError) throw memberError;

  const groups = (memberships ?? [])
    .map((m) => (m as unknown as { group: { id: string; name: string; currency: string } }).group)
    .filter(Boolean);

  if (groups.length === 0) {
    return { transactions: [], transactionCount: 0, isSettled: true };
  }

  // ── 2. Compute per-group settlements in parallel ──────────────────────
  const groupSettlements = await Promise.all(
    groups.map(async (g): Promise<GroupSettlementInput | null> => {
      try {
        const result = await getGroupSettlement(g.id);
        if (result.isSettled) return null;
        return {
          groupId: g.id,
          groupName: g.name,
          currency: g.currency,
          settlements: result.transactions,
        };
      } catch {
        // If a single group fails, skip it rather than breaking everything
        return null;
      }
    }),
  );

  const validSettlements = groupSettlements.filter(
    (s): s is GroupSettlementInput => s !== null,
  );

  if (validSettlements.length === 0) {
    return { transactions: [], transactionCount: 0, isSettled: true };
  }

  // ── 3. Run cross-group netting ────────────────────────────────────────
  const result = netCrossGroupDebts(validSettlements);

  // ── 4. Enrich with payment links from the payee ───────────────────────
  if (result.transactions.length > 0) {
    const payeeIds = [...new Set(result.transactions.map((t) => t.toUserId))];

    const { data: users } = await supabase
      .from('users')
      .select('id, payment_provider, payment_link')
      .in('id', payeeIds);

    if (users) {
      const userMap = new Map(
        users.map((u) => [u.id as string, u]),
      );

      for (const tx of result.transactions) {
        const payee = userMap.get(tx.toUserId);
        if (payee?.payment_provider) {
          tx.paymentProvider = payee.payment_provider as any;
          tx.paymentLink = payee.payment_link as string | null;
        }
      }
    }
  }

  return result;
}
