import { supabase } from './client';
import { generateSmartNudges } from '@commune/core';
import type { SmartNudgeInput } from '@commune/core';
import { getGroupSettlement } from './settlement';

export async function getUserSmartNudges(userId: string) {
  if (!userId) return [];

  // Get user's groups
  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id, groups(id, name, currency)')
    .eq('user_id', userId)
    .eq('status', 'active');

  if (!memberships?.length) return [];

  const groupIds = memberships.map((m) => m.group_id);
  const groups = memberships.map((m) => {
    const g = m.groups as any;
    return { id: g.id, name: g.name, currency: g.currency ?? 'GBP', budgetAmount: null as number | null };
  });

  // Get this month's date range
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  // Fetch this month's expenses
  const { data: thisMonthExpenses } = await supabase
    .from('expenses')
    .select('id, group_id, title, amount, due_date, created_at')
    .in('group_id', groupIds)
    .eq('is_active', true)
    .eq('approval_status', 'approved')
    .gte('due_date', thisMonthStart)
    .lte('due_date', thisMonthEnd);

  // Fetch last month's expenses (just amounts for comparison)
  const { data: lastMonthExpenses } = await supabase
    .from('expenses')
    .select('amount, group_id')
    .in('group_id', groupIds)
    .eq('is_active', true)
    .gte('due_date', lastMonthStart)
    .lte('due_date', lastMonthEnd);

  // Fetch recurring expenses due soon
  const threeDays = new Date(now);
  threeDays.setDate(threeDays.getDate() + 3);
  const { data: recurringExpenses } = await supabase
    .from('expenses')
    .select('id, title, group_id, due_date, amount')
    .in('group_id', groupIds)
    .eq('is_active', true)
    .neq('recurrence_type', 'none')
    .gte('due_date', now.toISOString().slice(0, 10))
    .lte('due_date', threeDays.toISOString().slice(0, 10));

  // Fetch budgets for this month
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const { data: budgets } = await supabase
    .from('group_budgets')
    .select('group_id, budget_amount')
    .in('group_id', groupIds)
    .eq('month', monthKey);

  // Merge budget data into groups
  if (budgets) {
    for (const b of budgets) {
      const group = groups.find((g) => g.id === b.group_id);
      if (group) group.budgetAmount = Number(b.budget_amount);
    }
  }

  // Build settlements from REAL settlement calculations per group
  const settlementResults = await Promise.all(
    groups.map(async (group) => {
      try {
        const result = await getGroupSettlement(group.id);
        return { group, result };
      } catch {
        return { group, result: null };
      }
    }),
  );

  const settlements: SmartNudgeInput['settlements'] = settlementResults
    .filter((s) => s.result && s.result.transactions.length > 0)
    .map((s) => ({
      groupId: s.group.id,
      groupName: s.group.name,
      transactions: s.result!.transactions.map((t) => ({
        fromUserId: t.fromUserId,
        toUserId: t.toUserId,
        amount: t.amount,
      })),
    }));

  const input: SmartNudgeInput = {
    groups,
    thisMonthExpenses: (thisMonthExpenses ?? []).map((e) => ({
      id: e.id,
      group_id: e.group_id,
      title: e.title,
      amount: Number(e.amount),
      due_date: e.due_date,
      created_at: e.created_at,
    })),
    lastMonthExpenses: (lastMonthExpenses ?? []).map((e) => ({
      amount: Number(e.amount),
      group_id: e.group_id,
    })),
    settlements,
    recurringExpenses: (recurringExpenses ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      group_id: e.group_id,
      due_date: e.due_date,
      amount: Number(e.amount),
    })),
    userId,
  };

  return generateSmartNudges(input);
}
