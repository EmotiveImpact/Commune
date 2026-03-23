import { supabase } from './client';
import { generateSmartNudges } from '@commune/core';
import type { SmartNudgeInput } from '@commune/core';

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

  // Build settlements from cross-group data (simplified — just check who owes whom)
  // We'll use a lightweight approach: query settlement-relevant data per group
  const settlements: SmartNudgeInput['settlements'] = [];

  // For each group, get basic settlement info from the settlement module
  // To keep this lightweight, we'll use the expense participants to derive basic "who owes"
  // This is approximate but avoids running the full settlement algorithm per group
  for (const group of groups) {
    const groupExpenses = (thisMonthExpenses ?? []).filter((e) => e.group_id === group.id);
    if (groupExpenses.length === 0) continue;

    // Simple heuristic: if there are expenses, there might be unsettled debts
    // The real settlement data comes from the command centre hooks
    settlements.push({
      groupId: group.id,
      groupName: group.name,
      transactions: [], // Will be populated by the command centre separately
    });
  }

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
