// ─── F37: Cross-Group Debt Netting — API Layer ─────────────────────────────
// Fetches compact settlement rollups from Postgres, then produces either the
// full per-group settlement detail or a slimmer overview payload for the web
// command centre.

import type {
  CrossGroupGroupSummary,
  CrossGroupOverviewResult,
  CrossGroupPerGroupData,
  CrossGroupResult,
  GroupSettlementInput,
  GroupSettlementRollup,
  PaymentProvider,
  SettlementTransaction,
} from '@commune/types';
import { buildPaymentUrl, calculateSettlementWithCouples, netCrossGroupDebts } from '@commune/core';
import { supabase } from './client';

interface CrossGroupPaymentMethodRow {
  user_id: string;
  provider: string;
  payment_link: string | null;
}

interface CrossGroupBuildResult {
  netted: CrossGroupResult;
  groupSummaries: CrossGroupGroupSummary[];
  perGroupData: CrossGroupPerGroupData[];
}

function emptyCrossGroupResult(): CrossGroupResult {
  return { transactions: [], transactionCount: 0, isSettled: true };
}

function collectUserIdsFromRollups(rollups: GroupSettlementRollup[]): string[] {
  const userIds = new Set<string>();

  for (const rollup of rollups) {
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
  }

  return Array.from(userIds);
}

function buildSettlementTransactions(
  rollup: GroupSettlementRollup,
  nameMap: Map<string, string>,
): SettlementTransaction[] {
  return calculateSettlementWithCouples(
    rollup.settlementInputs,
    nameMap,
    rollup.linkedPairs,
  ).transactions;
}

function buildGroupSummary(
  userId: string,
  rollup: Pick<GroupSettlementRollup, 'groupId' | 'groupName' | 'groupType' | 'currency'>,
  transactions: SettlementTransaction[],
): CrossGroupGroupSummary {
  let owesAmount = 0;
  let owedAmount = 0;
  let waitingCount = 0;

  for (const transaction of transactions) {
    if (transaction.fromUserId === userId) {
      owesAmount += transaction.amount;
    }
    if (transaction.toUserId === userId) {
      owedAmount += transaction.amount;
      waitingCount += 1;
    }
  }

  return {
    groupId: rollup.groupId,
    groupName: rollup.groupName,
    groupType: rollup.groupType,
    currency: rollup.currency,
    transactionCount: transactions.length,
    owesAmount,
    owedAmount,
    waitingCount,
  };
}

async function enrichTransactionsWithPaymentLinks(
  transactions: CrossGroupResult['transactions'],
): Promise<void> {
  if (transactions.length === 0) {
    return;
  }

  const payeeIds = [...new Set(transactions.map((transaction) => transaction.toUserId))];
  const { data: paymentMethodRows, error } = await supabase
    .from('user_payment_methods')
    .select('user_id, provider, payment_link, is_default, created_at')
    .in('user_id', payeeIds)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;

  const defaultMethodMap = new Map<string, CrossGroupPaymentMethodRow>();
  for (const row of (paymentMethodRows ?? []) as unknown as CrossGroupPaymentMethodRow[]) {
    if (!defaultMethodMap.has(row.user_id)) {
      defaultMethodMap.set(row.user_id, row);
    }
  }

  for (const transaction of transactions) {
    const method = defaultMethodMap.get(transaction.toUserId);
    if (!method?.provider || !method.payment_link) continue;

    const paymentLink = buildPaymentUrl(
      {
        provider: method.provider as PaymentProvider,
        link: method.payment_link,
      },
      transaction.netAmount,
    );

    if (!paymentLink) continue;

    transaction.paymentProvider = method.provider as PaymentProvider;
    transaction.paymentLink = paymentLink.url;
  }
}

async function buildCrossGroupData(
  userId: string,
  options?: { includePerGroupData?: boolean },
): Promise<CrossGroupBuildResult> {
  const includePerGroupData = options?.includePerGroupData === true;
  const { data: rollupRows, error: rollupError } = await supabase.rpc(
    'fn_get_cross_group_settlement_rollup',
    {
      p_user_id: userId,
    },
  );

  if (rollupError) throw rollupError;

  const rollups = (rollupRows ?? []) as unknown as GroupSettlementRollup[];
  if (rollups.length === 0) {
    return {
      netted: emptyCrossGroupResult(),
      groupSummaries: [],
      perGroupData: [],
    };
  }

  const userIds = collectUserIdsFromRollups(rollups);
  const userNameMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, name')
      .in('id', userIds);

    if (userError) throw userError;

    for (const user of users ?? []) {
      userNameMap.set(user.id as string, user.name as string);
    }
  }

  const perGroupData: CrossGroupPerGroupData[] = [];
  const groupSummaries: CrossGroupGroupSummary[] = [];
  const validSettlements: GroupSettlementInput[] = [];

  for (const rollup of rollups) {
    const transactions = buildSettlementTransactions(rollup, userNameMap);
    if (transactions.length === 0) {
      continue;
    }

    validSettlements.push({
      groupId: rollup.groupId,
      groupName: rollup.groupName,
      currency: rollup.currency,
      settlements: transactions,
    });

    groupSummaries.push(buildGroupSummary(userId, rollup, transactions));

    if (includePerGroupData) {
      perGroupData.push({
        groupId: rollup.groupId,
        groupName: rollup.groupName,
        groupType: rollup.groupType,
        currency: rollup.currency,
        settlement: {
          transactions,
          transactionCount: transactions.length,
          isSettled: false,
        },
      });
    }
  }

  const netted =
    validSettlements.length > 0
      ? netCrossGroupDebts(validSettlements)
      : emptyCrossGroupResult();

  await enrichTransactionsWithPaymentLinks(netted.transactions);

  return {
    netted,
    groupSummaries,
    perGroupData,
  };
}

/**
 * Compute cross-group netted settlements for the authenticated user.
 *
 * Returns full per-group settlement detail for clients that need the
 * un-netted view as well as the cross-group netted transactions.
 */
export async function getCrossGroupSettlements(
  userId: string,
): Promise<CrossGroupResult> {
  const { netted, perGroupData } = await buildCrossGroupData(userId, {
    includePerGroupData: true,
  });

  return { ...netted, perGroupData };
}

/**
 * Compute the lighter-weight overview payload for the command-centre route.
 *
 * This keeps the netted transactions, but replaces the bulky per-group
 * settlement detail with group-level status summaries.
 */
export async function getCrossGroupOverview(
  userId: string,
): Promise<CrossGroupOverviewResult> {
  const { netted, groupSummaries } = await buildCrossGroupData(userId);

  return {
    ...netted,
    isSettled: groupSummaries.length === 0,
    groupSummaries,
  };
}
