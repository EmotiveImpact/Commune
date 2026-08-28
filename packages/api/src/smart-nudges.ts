import { supabase } from './client';
import { generateSmartNudges } from '@commune/core';
import type { SmartNudgeInput } from '@commune/core';
import type { CrossGroupOverviewResult } from '@commune/types';
import { getCrossGroupOverview } from './cross-group';

interface SmartNudgePayload {
  groups: SmartNudgeInput['groups'];
  thisMonthExpenses: SmartNudgeInput['thisMonthExpenses'];
  lastMonthExpenses: SmartNudgeInput['lastMonthExpenses'];
  recurringExpenses: SmartNudgeInput['recurringExpenses'];
}

function parseGroups(value: unknown): SmartNudgeInput['groups'] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: Array<SmartNudgeInput['groups'][number] | null> = value.map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const source = item as Record<string, unknown>;
      const id = typeof source.id === 'string' ? source.id : '';
      const name = typeof source.name === 'string' ? source.name : '';
      const currency = typeof source.currency === 'string' ? source.currency : 'GBP';
      const budgetAmount =
        source.budgetAmount == null
          ? null
          : typeof source.budgetAmount === 'number'
            ? source.budgetAmount
            : Number(source.budgetAmount);

      if (!id || !name) {
        return null;
      }

      return {
        id,
        name,
        currency,
        budgetAmount: budgetAmount != null && Number.isFinite(budgetAmount) ? budgetAmount : null,
      };
    });

  return items.filter((item): item is SmartNudgeInput['groups'][number] => item !== null);
}

function parseThisMonthExpenses(value: unknown): SmartNudgeInput['thisMonthExpenses'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const source = item as Record<string, unknown>;
      const id = typeof source.id === 'string' ? source.id : '';
      const groupId = typeof source.group_id === 'string' ? source.group_id : '';
      const title = typeof source.title === 'string' ? source.title : '';
      const amount = typeof source.amount === 'number' ? source.amount : Number(source.amount);
      const dueDate = typeof source.due_date === 'string' ? source.due_date : '';
      const createdAt = typeof source.created_at === 'string' ? source.created_at : '';

      if (!id || !groupId || !title || !dueDate || !createdAt || !Number.isFinite(amount)) {
        return null;
      }

      return {
        id,
        group_id: groupId,
        title,
        amount,
        due_date: dueDate,
        created_at: createdAt,
      };
    })
    .filter((item): item is SmartNudgeInput['thisMonthExpenses'][number] => item !== null);
}

function parseLastMonthExpenses(value: unknown): SmartNudgeInput['lastMonthExpenses'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const source = item as Record<string, unknown>;
      const groupId = typeof source.group_id === 'string' ? source.group_id : '';
      const amount = typeof source.amount === 'number' ? source.amount : Number(source.amount);

      if (!groupId || !Number.isFinite(amount)) {
        return null;
      }

      return {
        group_id: groupId,
        amount,
      };
    })
    .filter((item): item is SmartNudgeInput['lastMonthExpenses'][number] => item !== null);
}

function parseRecurringExpenses(value: unknown): SmartNudgeInput['recurringExpenses'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const source = item as Record<string, unknown>;
      const id = typeof source.id === 'string' ? source.id : '';
      const title = typeof source.title === 'string' ? source.title : '';
      const groupId = typeof source.group_id === 'string' ? source.group_id : '';
      const dueDate = typeof source.due_date === 'string' ? source.due_date : '';
      const amount = typeof source.amount === 'number' ? source.amount : Number(source.amount);

      if (!id || !title || !groupId || !dueDate || !Number.isFinite(amount)) {
        return null;
      }

      return {
        id,
        title,
        group_id: groupId,
        due_date: dueDate,
        amount,
      };
    })
    .filter((item): item is SmartNudgeInput['recurringExpenses'][number] => item !== null);
}

function parseSmartNudgePayload(value: unknown): SmartNudgePayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      groups: [],
      thisMonthExpenses: [],
      lastMonthExpenses: [],
      recurringExpenses: [],
    };
  }

  const source = value as Record<string, unknown>;
  return {
    groups: parseGroups(source.groups),
    thisMonthExpenses: parseThisMonthExpenses(source.this_month_expenses),
    lastMonthExpenses: parseLastMonthExpenses(source.last_month_expenses),
    recurringExpenses: parseRecurringExpenses(source.recurring_expenses),
  };
}

function buildSmartNudgeSettlements(
  userId: string,
  overview?: CrossGroupOverviewResult | null,
): SmartNudgeInput['settlements'] {
  return (overview?.groupSummaries ?? [])
    .filter((groupSummary) => groupSummary.waitingCount > 0 || groupSummary.owesAmount > 0)
    .map((groupSummary) => ({
      groupId: groupSummary.groupId,
      groupName: groupSummary.groupName,
      transactions: [
        ...Array.from({ length: groupSummary.waitingCount }, (_value, index) => ({
          fromUserId: `pending-${groupSummary.groupId}-${index}`,
          toUserId: userId,
          amount: 0,
        })),
        ...(groupSummary.owesAmount > 0
          ? [{
              fromUserId: userId,
              toUserId: `group-${groupSummary.groupId}`,
              amount: groupSummary.owesAmount,
            }]
          : []),
      ],
    }));
}

export async function getUserSmartNudges(
  userId: string,
  options?: { overview?: CrossGroupOverviewResult | null },
) {
  if (!userId) return [];

  const { data, error } = await supabase.rpc('fn_get_smart_nudge_payload', {
    p_due_soon_days: 3,
  });

  if (error) throw error;

  const payload = parseSmartNudgePayload(data);
  if (!payload.groups.length) return [];

  const settlements = options?.overview
    ? buildSmartNudgeSettlements(userId, options.overview)
    : buildSmartNudgeSettlements(userId, await getCrossGroupOverview(userId));

  const input: SmartNudgeInput = {
    groups: payload.groups,
    thisMonthExpenses: payload.thisMonthExpenses,
    lastMonthExpenses: payload.lastMonthExpenses,
    settlements,
    recurringExpenses: payload.recurringExpenses,
    userId,
  };

  return generateSmartNudges(input);
}
