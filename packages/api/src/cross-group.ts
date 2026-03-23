// ─── F37: Cross-Group Debt Netting — API Layer ─────────────────────────────
// Fetches settlements from ALL groups the user belongs to, then runs
// cross-group netting to produce a single optimised list of transfers.

import type {
  CrossGroupPerGroupData,
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
    .select('group:groups(id, name, type, currency)')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (memberError) throw memberError;

  const groups = (memberships ?? [])
    .map((m) => (m as unknown as { group: { id: string; name: string; type: string; currency: string } }).group)
    .filter(Boolean);

  if (groups.length === 0) {
    return { transactions: [], transactionCount: 0, isSettled: true, perGroupData: [] };
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
    return { transactions: [], transactionCount: 0, isSettled: true, perGroupData: [] };
  }

  // ── 3. Build per-group data for the un-netted view ───────────────────
  const groupTypeMap = new Map(groups.map((g) => [g.id, g.type]));
  const perGroupData: CrossGroupPerGroupData[] = validSettlements.map((s) => ({
    groupId: s.groupId,
    groupName: s.groupName,
    groupType: groupTypeMap.get(s.groupId) ?? 'other',
    currency: s.currency,
    settlement: {
      transactions: s.settlements,
      transactionCount: s.settlements.length,
      isSettled: false,
    },
  }));

  // ── 4. Run cross-group netting ────────────────────────────────────────
  const result = netCrossGroupDebts(validSettlements);

  // ── 4. Enrich with payment links from user_payment_methods ────────────
  if (result.transactions.length > 0) {
    const payeeIds = [...new Set(result.transactions.map((t) => t.toUserId))];

    const { data: paymentMethodRows } = await supabase
      .from('user_payment_methods')
      .select('*')
      .in('user_id', payeeIds)
      .eq('is_default', true);

    if (paymentMethodRows) {
      const methodMap = new Map(
        paymentMethodRows.map((pm) => [pm.user_id as string, pm]),
      );

      for (const tx of result.transactions) {
        const method = methodMap.get(tx.toUserId);
        if (method?.provider) {
          tx.paymentProvider = method.provider;
          tx.paymentLink = method.payment_link as string | null;
        }
      }
    }
  }

  return { ...result, perGroupData };
}
