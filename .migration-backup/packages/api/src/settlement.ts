import type {
  GroupSettlementRollup,
  SettlementResult,
  SettlementTransaction,
  PaymentProvider,
} from '@commune/types';
import { buildPaymentUrl, calculateSettlementWithCouples } from '@commune/core';
import { supabase } from './client';

interface PaymentMethodRow {
  user_id: string;
  provider: string;
  payment_link: string | null;
}

function collectUserIdsFromRollup(rollup: GroupSettlementRollup): string[] {
  const userIds = new Set<string>();

  for (const input of rollup.settlementInputs) {
    if (input.payerId) {
      userIds.add(input.payerId);
    }
    for (const participant of input.participants) {
      userIds.add(participant.userId);
    }
  }

  for (const pair of rollup.linkedPairs) {
    userIds.add(pair.userIdA);
    userIds.add(pair.userIdB);
  }

  return Array.from(userIds);
}

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
  const { data: rollup, error } = await supabase.rpc(
    'fn_get_group_settlement_rollup',
    {
      p_group_id: groupId,
      p_month: month ?? null,
    },
  );

  if (error) throw error;

  const settlementRollup = rollup as unknown as GroupSettlementRollup | null;
  if (
    !settlementRollup ||
    settlementRollup.settlementInputs.length === 0
  ) {
    return { transactions: [], transactionCount: 0, isSettled: true };
  }

  const userIds = collectUserIdsFromRollup(settlementRollup);
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, name')
    .in('id', userIds);

  if (userError) throw userError;

  const nameMap = new Map(
    (users ?? []).map((user) => [user.id as string, user.name as string]),
  );

  const settlement = calculateSettlementWithCouples(
    settlementRollup.settlementInputs,
    nameMap,
    settlementRollup.linkedPairs,
  );

  if (settlement.transactions.length === 0) {
    return settlement;
  }

  const payeeIds = [
    ...new Set(settlement.transactions.map((transaction) => transaction.toUserId)),
  ];
  const { data: paymentMethodRows } = await supabase
    .from('user_payment_methods')
    .select('user_id, provider, payment_link, is_default, created_at')
    .in('user_id', payeeIds)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  const defaultMethodMap = new Map<string, PaymentMethodRow>();
  for (const row of (paymentMethodRows ?? []) as unknown as PaymentMethodRow[]) {
    if (!defaultMethodMap.has(row.user_id)) {
      defaultMethodMap.set(row.user_id, row);
    }
  }

  const transactions: SettlementTransaction[] = settlement.transactions.map(
    (transaction) => {
      const method = defaultMethodMap.get(transaction.toUserId);
      if (!method?.provider || !method.payment_link) {
        return transaction;
      }

      const paymentLink = buildPaymentUrl(
        {
          provider: method.provider as PaymentProvider,
          link: method.payment_link,
        },
        transaction.amount,
      );

      if (!paymentLink) {
        return transaction;
      }

      return {
        ...transaction,
        paymentLink: paymentLink.url,
        paymentProvider: method.provider as PaymentProvider,
      };
    },
  );

  return {
    ...settlement,
    transactions,
  };
}
