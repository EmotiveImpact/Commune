import { supabase } from './client';
import {
  toDateKey,
  toMonthKey,
} from './workspace-billing';

export interface AnalyticsData {
  spendingTrend: { month: string; amount: number }[];
  categoryBreakdown: { category: string; amount: number }[];
  topSpenders: { name: string; amount: number }[];
  complianceRate: { onTime: number; overdue: number; total: number };
  monthComparison: {
    thisMonth: number;
    lastMonth: number;
    delta: number;
    deltaPercent: number;
  };
}

function getMonthRange(offset: number): { start: string; end: string; key: string } {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  const key = toMonthKey(d);
  const start = toDateKey(d);
  const end = toDateKey(next);
  return { start, end, key };
}

type AnalyticsExpenseRow = {
  amount: number;
  due_date: string;
  category: string | null;
  payment_records: Array<{ status: string; paid_at: string | null; created_at: string }>;
  created_by: string;
  created_by_user?:
    | { id: string; name: string | null; email: string | null }
    | Array<{ id: string; name: string | null; email: string | null }>
    | null;
};

function getCreator(
  user: AnalyticsExpenseRow['created_by_user'],
): { id: string; name: string | null; email: string | null } | null {
  if (!user) return null;
  return Array.isArray(user) ? user[0] ?? null : user;
}

export async function getAnalyticsData(
  groupId: string,
): Promise<AnalyticsData> {
  const sixMonthsAgo = getMonthRange(5);
  const currentMonth = getMonthRange(0);
  const lastMonth = getMonthRange(1);

  const { data: expenses, error } = await supabase
    .from('expenses')
    .select(
      `
      amount,
      due_date,
      category,
      created_by,
      payment_records(status, paid_at, created_at),
      created_by_user:users!expenses_created_by_fkey(id, name, email)
    `,
    )
    .eq('group_id', groupId)
    .eq('is_active', true)
    .gte('due_date', sixMonthsAgo.start)
    .lt('due_date', currentMonth.end)
    .order('due_date', { ascending: false });

  if (error) throw error;

  const rows = (expenses ?? []) as AnalyticsExpenseRow[];

  const monthBuckets = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    monthBuckets.set(getMonthRange(i).key, 0);
  }
  for (const row of rows) {
    const key = row.due_date.slice(0, 7);
    if (monthBuckets.has(key)) {
      monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + row.amount);
    }
  }
  const spendingTrend = Array.from(monthBuckets.entries()).map(([month, amount]) => ({
    month,
    amount,
  }));

  const catMap = new Map<string, number>();
  for (const row of rows) {
    if (row.due_date.startsWith(currentMonth.key)) {
      const category = String(row.category ?? 'uncategorized');
      catMap.set(category, (catMap.get(category) ?? 0) + row.amount);
    }
  }
  const categoryBreakdown = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({ category, amount }));

  const spenderMap = new Map<string, { name: string; amount: number }>();
  for (const row of rows) {
    const user = getCreator(row.created_by_user);
    const userId = user?.id ?? row.created_by;
    const existing = spenderMap.get(userId);
    if (existing) {
      existing.amount += row.amount;
    } else {
      spenderMap.set(userId, {
        name: user?.name ?? user?.email ?? 'Unknown',
        amount: row.amount,
      });
    }
  }
  const topSpenders = Array.from(spenderMap.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  let onTime = 0;
  let overdue = 0;
  for (const row of rows) {
    const dueDate = new Date(row.due_date);
    for (const pr of row.payment_records ?? []) {
      if (pr.status === 'unpaid') continue;
      const paidDate = new Date(pr.paid_at ?? pr.created_at);
      if (paidDate <= dueDate) {
        onTime++;
      } else {
        overdue++;
      }
    }
  }
  const complianceRate = { onTime, overdue, total: onTime + overdue };

  let thisMonthTotal = 0;
  let lastMonthTotal = 0;
  for (const row of rows) {
    const dateKey = row.due_date.slice(0, 7);
    if (dateKey === currentMonth.key) thisMonthTotal += row.amount;
    else if (dateKey === lastMonth.key) lastMonthTotal += row.amount;
  }
  const delta = thisMonthTotal - lastMonthTotal;
  const deltaPercent = lastMonthTotal > 0 ? (delta / lastMonthTotal) * 100 : 0;

  return {
    spendingTrend,
    categoryBreakdown,
    topSpenders,
    complianceRate,
    monthComparison: { thisMonth: thisMonthTotal, lastMonth: lastMonthTotal, delta, deltaPercent },
  };
}
