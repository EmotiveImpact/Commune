// ─── F37: Cross-Group Debt Netting — API Layer ─────────────────────────────
// Fetches settlements from every active group the user belongs to, batches the
// required reads, then produces either the full per-group settlement detail or
// a slimmer overview payload for the web command centre.

import type {
  CrossGroupGroupSummary,
  CrossGroupOverviewResult,
  CrossGroupPerGroupData,
  CrossGroupResult,
  GroupSettlementInput,
  LinkedPair,
  PaymentProvider,
  SettlementTransaction,
} from '@commune/types';
import {
  buildPaymentUrl,
  calculateNetBalances,
  mergeLinkedBalances,
  netCrossGroupDebts,
  simplifyDebts,
} from '@commune/core';
import { supabase } from './client';

interface CrossGroupMembershipGroup {
  id: string;
  name: string;
  type: string;
  currency: string;
}

interface CrossGroupExpenseParticipantRow {
  user_id: string;
  share_amount: number;
}

interface CrossGroupPaymentRecordRow {
  user_id: string;
  status: string;
}

interface CrossGroupExpenseRow {
  group_id: string;
  paid_by_user_id: string | null;
  participants: CrossGroupExpenseParticipantRow[] | null;
  payment_records: CrossGroupPaymentRecordRow[] | null;
}

interface CrossGroupLinkedMemberRow {
  group_id: string;
  id: string;
  user_id: string;
  linked_partner_id: string | null;
}

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

const PAID_PAYMENT_STATUSES = new Set(['paid', 'confirmed']);

function emptyCrossGroupResult(): CrossGroupResult {
  return { transactions: [], transactionCount: 0, isSettled: true };
}

function buildLinkedPairsByGroup(
  members: CrossGroupLinkedMemberRow[],
): Map<string, LinkedPair[]> {
  if (members.length === 0) {
    return new Map();
  }

  const memberMap = new Map(members.map((member) => [member.id, member]));
  const linkedPairsByGroup = new Map<string, LinkedPair[]>();
  const seen = new Set<string>();

  for (const member of members) {
    const partnerId = member.linked_partner_id;
    if (!partnerId) continue;

    const partner = memberMap.get(partnerId);
    if (!partner || partner.group_id !== member.group_id) continue;

    const pairKey = `${member.group_id}::${[member.id, partnerId].sort().join('::')}`;
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);

    const groupPairs = linkedPairsByGroup.get(member.group_id) ?? [];
    groupPairs.push({
      userIdA: member.user_id,
      userIdB: partner.user_id,
    });
    linkedPairsByGroup.set(member.group_id, groupPairs);
  }

  return linkedPairsByGroup;
}

function buildSettlementTransactions(
  expenses: CrossGroupExpenseRow[],
  linkedPairs: LinkedPair[],
  nameMap: Map<string, string>,
): SettlementTransaction[] {
  if (expenses.length === 0) {
    return [];
  }

  const expenseData = expenses
    .filter((expense) => expense.paid_by_user_id != null)
    .map((expense) => {
      const paidUserIds = new Set(
        (expense.payment_records ?? [])
          .filter((record) => PAID_PAYMENT_STATUSES.has(record.status))
          .map((record) => record.user_id),
      );

      return {
        payerId: expense.paid_by_user_id!,
        participants: (expense.participants ?? [])
          .filter((participant) => !paidUserIds.has(participant.user_id))
          .map((participant) => ({
            userId: participant.user_id,
            shareAmount: participant.share_amount,
          })),
      };
    })
    .filter((expense) => expense.participants.length > 0);

  if (expenseData.length === 0) {
    return [];
  }

  const balances = calculateNetBalances(expenseData);
  const { mergedBalances, mergedNames } =
    linkedPairs.length > 0
      ? mergeLinkedBalances(balances, linkedPairs, nameMap)
      : { mergedBalances: balances, mergedNames: nameMap };

  return simplifyDebts(mergedBalances).map((transaction) => ({
    ...transaction,
    fromUserName: mergedNames.get(transaction.fromUserId) ?? 'Unknown',
    toUserName: mergedNames.get(transaction.toUserId) ?? 'Unknown',
  }));
}

function buildGroupSummary(
  userId: string,
  group: CrossGroupMembershipGroup,
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
    groupId: group.id,
    groupName: group.name,
    groupType: group.type,
    currency: group.currency,
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
  const { data: memberships, error: memberError } = await supabase
    .from('group_members')
    .select('group:groups(id, name, type, currency)')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (memberError) throw memberError;

  const groups = (memberships ?? [])
    .map(
      (membership) =>
        (membership as unknown as { group: CrossGroupMembershipGroup | null }).group,
    )
    .filter((group): group is CrossGroupMembershipGroup => group !== null);

  if (groups.length === 0) {
    return {
      netted: emptyCrossGroupResult(),
      groupSummaries: [],
      perGroupData: [],
    };
  }

  const groupIds = groups.map((group) => group.id);
  const [{ data: expenseRows, error: expenseError }, { data: linkedMemberRows, error: linkedError }] =
    await Promise.all([
      supabase
        .from('expenses')
        .select(
          `
          group_id,
          paid_by_user_id,
          participants:expense_participants(user_id, share_amount),
          payment_records(user_id, status)
        `,
        )
        .in('group_id', groupIds)
        .eq('is_active', true)
        .eq('approval_status', 'approved'),
      supabase
        .from('group_members')
        .select('group_id, id, user_id, linked_partner_id')
        .in('group_id', groupIds)
        .eq('status', 'active')
        .not('linked_partner_id', 'is', null),
    ]);

  if (expenseError) throw expenseError;
  if (linkedError) throw linkedError;

  const expensesByGroup = new Map<string, CrossGroupExpenseRow[]>();
  const allUserIds = new Set<string>();

  for (const row of (expenseRows ?? []) as unknown as CrossGroupExpenseRow[]) {
    const groupExpenses = expensesByGroup.get(row.group_id) ?? [];
    groupExpenses.push(row);
    expensesByGroup.set(row.group_id, groupExpenses);

    if (row.paid_by_user_id) {
      allUserIds.add(row.paid_by_user_id);
    }

    for (const participant of row.participants ?? []) {
      allUserIds.add(participant.user_id);
    }
  }

  const linkedPairsByGroup = buildLinkedPairsByGroup(
    (linkedMemberRows ?? []) as unknown as CrossGroupLinkedMemberRow[],
  );

  for (const groupPairs of linkedPairsByGroup.values()) {
    for (const pair of groupPairs) {
      allUserIds.add(pair.userIdA);
      allUserIds.add(pair.userIdB);
    }
  }

  const userNameMap = new Map<string, string>();
  if (allUserIds.size > 0) {
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, name')
      .in('id', Array.from(allUserIds));

    if (userError) throw userError;

    for (const user of users ?? []) {
      userNameMap.set(user.id as string, user.name as string);
    }
  }

  const perGroupData: CrossGroupPerGroupData[] = [];
  const groupSummaries: CrossGroupGroupSummary[] = [];
  const validSettlements: GroupSettlementInput[] = [];

  for (const group of groups) {
    const transactions = buildSettlementTransactions(
      expensesByGroup.get(group.id) ?? [],
      linkedPairsByGroup.get(group.id) ?? [],
      userNameMap,
    );

    if (transactions.length === 0) {
      continue;
    }

    validSettlements.push({
      groupId: group.id,
      groupName: group.name,
      currency: group.currency,
      settlements: transactions,
    });

    groupSummaries.push(buildGroupSummary(userId, group, transactions));

    if (includePerGroupData) {
      perGroupData.push({
        groupId: group.id,
        groupName: group.name,
        groupType: group.type,
        currency: group.currency,
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
