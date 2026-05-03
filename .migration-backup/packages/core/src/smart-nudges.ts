/**
 * Smart Predictive Nudge System
 * Generates context-aware insights from spending patterns, payment status, and due dates.
 */

export interface SmartNudge {
  id: string;
  type: 'spending_increase' | 'spending_decrease' | 'unpaid_expense' | 'unsettled_purchases' | 'upcoming_due' | 'others_pending' | 'budget_warning';
  priority: number; // 1 = highest
  title: string;
  description: string;
  groupName?: string;
  actionUrl?: string;
  icon?: string;
  color?: string;
}

export interface SmartNudgeInput {
  groups: Array<{
    id: string;
    name: string;
    currency: string;
    budgetAmount?: number | null;
  }>;
  thisMonthExpenses: Array<{
    id: string;
    group_id: string;
    title: string;
    amount: number;
    due_date: string;
    created_at: string;
  }>;
  lastMonthExpenses: Array<{
    amount: number;
    group_id: string;
  }>;
  settlements: Array<{
    groupId: string;
    groupName: string;
    transactions: Array<{
      fromUserId: string;
      toUserId: string;
      amount: number;
    }>;
  }>;
  recurringExpenses: Array<{
    id: string;
    title: string;
    group_id: string;
    due_date: string;
    amount: number;
  }>;
  userId: string;
}

export function generateSmartNudges(input: SmartNudgeInput): SmartNudge[] {
  const nudges: SmartNudge[] = [];
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const groupNameMap = new Map(input.groups.map((g) => [g.id, g.name]));
  const groupCurrencyMap = new Map(input.groups.map((g) => [g.id, g.currency]));

  // 1. Spending increase/decrease vs last month
  const thisMonthTotal = input.thisMonthExpenses.reduce((s, e) => s + e.amount, 0);
  const lastMonthTotal = input.lastMonthExpenses.reduce((s, e) => s + e.amount, 0);

  if (lastMonthTotal > 0 && thisMonthTotal > 0) {
    const pctChange = Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100);
    if (pctChange > 10) {
      nudges.push({
        id: 'spending-increase',
        type: 'spending_increase',
        priority: 3,
        title: `Bills up ${pctChange}% this month`,
        description: `Your total spending is ${pctChange}% higher than last month across all groups.`,
        icon: 'trending-up',
        color: 'orange',
      });
    } else if (pctChange < -10) {
      nudges.push({
        id: 'spending-decrease',
        type: 'spending_decrease',
        priority: 4,
        title: `Bills down ${Math.abs(pctChange)}% this month`,
        description: `Your total spending is ${Math.abs(pctChange)}% lower than last month. Nice!`,
        icon: 'trending-down',
        color: 'green',
      });
    }
  }

  // 2. Unpaid expenses past due date
  const overdue = input.thisMonthExpenses.filter((e) => e.due_date < todayStr);
  if (overdue.length > 0) {
    const groupedByGroup = new Map<string, number>();
    for (const e of overdue) {
      groupedByGroup.set(e.group_id, (groupedByGroup.get(e.group_id) ?? 0) + 1);
    }
    for (const [groupId, count] of groupedByGroup) {
      nudges.push({
        id: `overdue-${groupId}`,
        type: 'unpaid_expense',
        priority: 1,
        title: `${count} expense${count > 1 ? 's' : ''} need${count === 1 ? 's' : ''} attention`,
        description: `${count} expense${count > 1 ? 's are' : ' is'} due in ${groupNameMap.get(groupId) ?? 'a group'}.`,
        groupName: groupNameMap.get(groupId),
        actionUrl: '/expenses',
        icon: 'alert-triangle',
        color: 'red',
      });
    }
  }

  // 3. Upcoming recurring expenses (due in next 3 days)
  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const threeDaysStr = threeDaysFromNow.toISOString().slice(0, 10);

  const upcoming = input.recurringExpenses.filter(
    (e) => e.due_date >= todayStr && e.due_date <= threeDaysStr,
  );
  for (const exp of upcoming) {
    const daysUntil = Math.ceil((new Date(exp.due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    nudges.push({
      id: `upcoming-${exp.id}`,
      type: 'upcoming_due',
      priority: 1,
      title: `${exp.title} due ${daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}`,
      description: `${formatAmount(exp.amount, groupCurrencyMap.get(exp.group_id) ?? 'GBP')} in ${groupNameMap.get(exp.group_id) ?? 'a group'}.`,
      groupName: groupNameMap.get(exp.group_id),
      actionUrl: '/recurring',
      icon: 'clock',
      color: 'blue',
    });
  }

  // 4. Others pending — user paid but others haven't
  for (const settlement of input.settlements) {
    const othersOweYou = settlement.transactions.filter((t) => t.toUserId === input.userId);
    if (othersOweYou.length > 0) {
      nudges.push({
        id: `others-pending-${settlement.groupId}`,
        type: 'others_pending',
        priority: 2,
        title: `Waiting on ${othersOweYou.length} other${othersOweYou.length > 1 ? 's' : ''}`,
        description: `In ${settlement.groupName}, ${othersOweYou.length} member${othersOweYou.length > 1 ? 's' : ''} haven't settled yet.`,
        groupName: settlement.groupName,
        actionUrl: '/breakdown',
        icon: 'users',
        color: 'amber',
      });
    }
  }

  // 4b. You owe — unsettled debts where user needs to pay
  for (const settlement of input.settlements) {
    const youOwe = settlement.transactions.filter((t) => t.fromUserId === input.userId);
    if (youOwe.length > 0) {
      const totalOwed = youOwe.reduce((sum, t) => sum + t.amount, 0);
      const currency = input.groups.find((g) => g.id === settlement.groupId)?.currency ?? 'GBP';
      nudges.push({
        id: `you-owe-${settlement.groupId}`,
        type: 'unsettled_purchases',
        priority: 1,
        title: `Settle up in ${settlement.groupName}`,
        description: `You have ${formatAmount(totalOwed, currency)} outstanding — tap to see who to pay.`,
        groupName: settlement.groupName,
        actionUrl: '/breakdown',
        icon: 'alert',
        color: 'red',
      });
    }
  }

  // 5. Budget warning
  for (const group of input.groups) {
    if (group.budgetAmount && group.budgetAmount > 0) {
      const groupSpend = input.thisMonthExpenses
        .filter((e) => e.group_id === group.id)
        .reduce((s, e) => s + e.amount, 0);
      const pct = (groupSpend / group.budgetAmount) * 100;
      if (pct >= 100) {
        nudges.push({
          id: `budget-over-${group.id}`,
          type: 'budget_warning',
          priority: 1,
          title: `Over budget in ${group.name}`,
          description: `Spent ${Math.round(pct)}% of the ${formatAmount(group.budgetAmount, group.currency)} budget.`,
          groupName: group.name,
          actionUrl: '/',
          icon: 'alert-circle',
          color: 'red',
        });
      } else if (pct >= 80) {
        nudges.push({
          id: `budget-warning-${group.id}`,
          type: 'budget_warning',
          priority: 2,
          title: `Approaching budget in ${group.name}`,
          description: `${Math.round(pct)}% of the monthly budget used.`,
          groupName: group.name,
          actionUrl: '/',
          icon: 'alert-circle',
          color: 'orange',
        });
      }
    }
  }

  // Sort by priority (1 = highest), then by type
  nudges.sort((a, b) => a.priority - b.priority);

  // Return max 5
  return nudges.slice(0, 5);
}

function formatAmount(amount: number, currency: string): string {
  const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };
  return `${symbols[currency] ?? currency + ' '}${amount.toFixed(2)}`;
}
