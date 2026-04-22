import type {
  DashboardCategoryBreakdownItem,
  DashboardUpcomingExpenseItem,
  DashboardSummaryBudget,
  DashboardSummaryStats,
  DashboardRecentExpenseItem,
  DashboardStats,
  DashboardSummary,
  DashboardTrendItem,
  ExpenseWithParticipants,
} from '@commune/types';
import { getTypedSupabase } from './client';
import {
  buildWorkspaceBillingExportRows,
  buildWorkspaceBillingSnapshot,
  buildWorkspaceBillingTrend,
  type WorkspaceBillingData,
  type WorkspaceBillingExpenseRecord,
  type WorkspaceBillingExportRow,
  type WorkspaceBillingSnapshot,
} from './workspace-billing';

function getLocalDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const next = new Date(Date.UTC(year!, (month ?? 1) - 1, (day ?? 1) + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

export interface DashboardWorkspaceBillingData {
  workspace_billing: WorkspaceBillingSnapshot;
}

type DashboardExpenseRow = ExpenseWithParticipants & WorkspaceBillingExpenseRecord;

function parseDashboardTrendItems(value: unknown): DashboardTrendItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const source = item as Record<string, unknown>;
      const month = typeof source.month === 'string' ? source.month : '';
      const total = typeof source.total === 'number' ? source.total : Number(source.total);

      if (!month || !Number.isFinite(total)) {
        return null;
      }

      return { month, total };
    })
    .filter((item): item is DashboardTrendItem => item !== null);
}

function parseDashboardCategoryBreakdown(value: unknown): DashboardCategoryBreakdownItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const source = item as Record<string, unknown>;
      const category = typeof source.category === 'string' ? source.category : '';
      const amount = typeof source.amount === 'number' ? source.amount : Number(source.amount);
      const percent = typeof source.percent === 'number' ? source.percent : Number(source.percent);

      if (!category || !Number.isFinite(amount) || !Number.isFinite(percent)) {
        return null;
      }

      return { category, amount, percent };
    })
    .filter((item): item is DashboardCategoryBreakdownItem => item !== null);
}

function parseDashboardRecentExpenses(value: unknown): DashboardRecentExpenseItem[] {
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
      const category = typeof source.category === 'string' ? source.category : 'uncategorized';
      const amount = typeof source.amount === 'number' ? source.amount : Number(source.amount);
      const dueDate = typeof source.due_date === 'string' ? source.due_date : '';
      const unpaidCount =
        typeof source.unpaid_count === 'number' ? source.unpaid_count : Number(source.unpaid_count);

      if (!id || !title || !dueDate || !Number.isFinite(amount) || !Number.isFinite(unpaidCount)) {
        return null;
      }

      return {
        id,
        title,
        category,
        amount,
        due_date: dueDate,
        unpaid_count: unpaidCount,
      };
    })
    .filter((item): item is DashboardRecentExpenseItem => item !== null);
}

function parseDashboardSummaryBudget(value: unknown): DashboardSummaryBudget | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const budgetAmount =
    typeof source.budget_amount === 'number'
      ? source.budget_amount
      : Number(source.budget_amount);
  const alertThreshold =
    typeof source.alert_threshold === 'number'
      ? source.alert_threshold
      : Number(source.alert_threshold);
  const categoryBudgets =
    source.category_budgets && typeof source.category_budgets === 'object' && !Array.isArray(source.category_budgets)
      ? Object.fromEntries(
          Object.entries(source.category_budgets as Record<string, unknown>)
            .map(([key, rawValue]) => {
              const amount = typeof rawValue === 'number' ? rawValue : Number(rawValue);
              return Number.isFinite(amount) ? [key, amount] : null;
            })
            .filter((entry): entry is [string, number] => entry !== null),
        )
      : null;

  if (!Number.isFinite(budgetAmount)) {
    return null;
  }

  return {
    budget_amount: budgetAmount,
    category_budgets: categoryBudgets,
    alert_threshold: Number.isFinite(alertThreshold) ? alertThreshold : 80,
  };
}

function parseDashboardCategoryTotals(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const source = value as Record<string, unknown>;
  const totals: Record<string, number> = {};

  for (const [key, rawValue] of Object.entries(source)) {
    const amount = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    if (key && Number.isFinite(amount)) {
      totals[key] = amount;
    }
  }

  return totals;
}

function parseDashboardUpcomingItems(value: unknown): DashboardUpcomingExpenseItem[] {
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
      const amount = typeof source.amount === 'number' ? source.amount : Number(source.amount);
      const currency = typeof source.currency === 'string' ? source.currency : 'GBP';
      const dueDate = typeof source.due_date === 'string' ? source.due_date : '';
      const userShare =
        typeof source.user_share === 'number' ? source.user_share : Number(source.user_share);

      if (!id || !title || !dueDate || !Number.isFinite(amount) || !Number.isFinite(userShare)) {
        return null;
      }

      return {
        id,
        title,
        amount,
        currency,
        due_date: dueDate,
        user_share: userShare,
      };
    })
    .filter((item): item is DashboardUpcomingExpenseItem => item !== null);
}

function parseDashboardSummaryStats(value: unknown): DashboardSummaryStats {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      total_spend: 0,
      your_share: 0,
      amount_paid: 0,
      amount_remaining: 0,
      overdue_count: 0,
      upcoming_items: [],
    };
  }

  const source = value as Record<string, unknown>;
  const totalSpend = typeof source.total_spend === 'number' ? source.total_spend : Number(source.total_spend);
  const yourShare = typeof source.your_share === 'number' ? source.your_share : Number(source.your_share);
  const amountPaid = typeof source.amount_paid === 'number' ? source.amount_paid : Number(source.amount_paid);
  const amountRemaining =
    typeof source.amount_remaining === 'number'
      ? source.amount_remaining
      : Number(source.amount_remaining);
  const overdueCount =
    typeof source.overdue_count === 'number' ? source.overdue_count : Number(source.overdue_count);

  return {
    total_spend: Number.isFinite(totalSpend) ? totalSpend : 0,
    your_share: Number.isFinite(yourShare) ? yourShare : 0,
    amount_paid: Number.isFinite(amountPaid) ? amountPaid : 0,
    amount_remaining: Number.isFinite(amountRemaining) ? amountRemaining : 0,
    overdue_count: Number.isFinite(overdueCount) ? overdueCount : 0,
    upcoming_items: parseDashboardUpcomingItems(source.upcoming_items),
  };
}

export function parseDashboardSummary(value: unknown): DashboardSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      expense_count: 0,
      current_month_total: 0,
      stats: null,
      budget: null,
      has_pending_recurring_generation: false,
      trend: [],
      category_breakdown: [],
      current_month_category_totals: {},
      recent_expenses: [],
    };
  }

  const source = value as Record<string, unknown>;
  const expenseCount =
    typeof source.expense_count === 'number' ? source.expense_count : Number(source.expense_count);
  const currentMonthTotal =
    typeof source.current_month_total === 'number'
      ? source.current_month_total
      : Number(source.current_month_total);

  return {
    expense_count: Number.isFinite(expenseCount) ? expenseCount : 0,
    current_month_total: Number.isFinite(currentMonthTotal) ? currentMonthTotal : 0,
    stats: Object.prototype.hasOwnProperty.call(source, 'stats')
      ? parseDashboardSummaryStats(source.stats)
      : null,
    budget: Object.prototype.hasOwnProperty.call(source, 'budget')
      ? parseDashboardSummaryBudget(source.budget)
      : null,
    has_pending_recurring_generation:
      typeof source.has_pending_recurring_generation === 'boolean'
        ? source.has_pending_recurring_generation
        : false,
    trend: parseDashboardTrendItems(source.trend),
    category_breakdown: parseDashboardCategoryBreakdown(source.category_breakdown),
    current_month_category_totals: parseDashboardCategoryTotals(source.current_month_category_totals),
    recent_expenses: parseDashboardRecentExpenses(source.recent_expenses),
  };
}

export async function getDashboardStats(
  groupId: string,
  userId: string,
  month: string,
): Promise<DashboardStats & DashboardWorkspaceBillingData> {
  const startDate = `${month}-01`;
  const [year, mon] = month.split('-').map(Number);
  const endDate = new Date(Date.UTC(year!, mon!, 1)).toISOString().split('T')[0];

  const supabase = getTypedSupabase();
  const { data: expenses, error } = await supabase
    .from('expenses')
    .select(
      `
      id,
      title,
      amount,
      currency,
      due_date,
      category,
      recurrence_type,
      vendor_name,
      invoice_reference,
      invoice_date,
      payment_due_date,
      participants:expense_participants(
        user_id,
        share_amount
      ),
      payment_records(user_id, status)
    `,
    )
    .eq('group_id', groupId)
    .eq('is_active', true)
    .gte('due_date', startDate)
    .lt('due_date', endDate!);

  if (error) throw error;

  const typed = (expenses ?? []) as unknown as DashboardExpenseRow[];

  let totalSpend = 0;
  let yourShare = 0;
  let amountPaid = 0;
  let overdueCount = 0;
  const upcoming: ExpenseWithParticipants[] = [];

  const todayKey = getLocalDateKey();
  const weekFromNowKey = addDaysToDateKey(todayKey, 7);

  for (const expense of typed) {
    totalSpend += expense.amount;

    const participation = expense.participants.find(
      (p) => p.user_id === userId,
    );
    if (participation) {
      yourShare += participation.share_amount;

      const payment = expense.payment_records.find(
        (pr) => pr.user_id === userId,
      );
      if (payment && payment.status !== 'unpaid') {
        amountPaid += participation.share_amount;
      }
    }

    if (expense.due_date < todayKey) {
      const hasUnpaid = expense.payment_records.some(
        (pr) => pr.status === 'unpaid',
      );
      if (hasUnpaid) overdueCount++;
    } else if (expense.due_date <= weekFromNowKey) {
      upcoming.push(expense);
    }
  }

  return {
    total_spend: totalSpend,
    your_share: yourShare,
    amount_paid: amountPaid,
    amount_remaining: yourShare - amountPaid,
    overdue_count: overdueCount,
    upcoming_items: upcoming,
    workspace_billing: buildWorkspaceBillingSnapshot(typed),
  };
}

export async function getDashboardSummary(
  groupId: string,
  month: string,
  options?: { includeInsights?: boolean },
): Promise<DashboardSummary> {
  const supabase = getTypedSupabase();
  const includeInsights = options?.includeInsights ?? true;
  const { data, error } = includeInsights
    ? await supabase.rpc('fn_get_dashboard_summary', {
        p_group_id: groupId,
        p_month: month,
        p_include_insights: true,
      })
    : await supabase.rpc('fn_get_dashboard_core', {
        p_group_id: groupId,
        p_month: month,
      });

  if (error) throw error;
  return parseDashboardSummary(data);
}

export async function getWorkspaceBillingExpenseFeed(
  groupId: string,
): Promise<WorkspaceBillingExpenseRecord[]> {
  const supabase = getTypedSupabase();
  const { data, error } = await supabase
    .from('expenses')
    .select(
      `
      id,
      title,
      amount,
      currency,
      due_date,
      category,
      recurrence_type,
      vendor_name,
      invoice_reference,
      invoice_date,
      payment_due_date
    `,
    )
    .eq('group_id', groupId)
    .eq('is_active', true)
    .order('due_date', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as WorkspaceBillingExpenseRecord[];
}

export async function getWorkspaceBillingSnapshot(
  groupId: string,
): Promise<WorkspaceBillingSnapshot> {
  const rows = await getWorkspaceBillingExpenseFeed(groupId);
  return buildWorkspaceBillingSnapshot(rows);
}

export async function getWorkspaceBillingData(
  groupId: string,
): Promise<WorkspaceBillingData> {
  const rows = await getWorkspaceBillingExpenseFeed(groupId);
  return {
    snapshot: buildWorkspaceBillingSnapshot(rows),
    trend: buildWorkspaceBillingTrend(rows),
  };
}

export async function getWorkspaceBillingExportRows(
  groupId: string,
): Promise<WorkspaceBillingExportRow[]> {
  const rows = await getWorkspaceBillingExpenseFeed(groupId);
  return buildWorkspaceBillingExportRows(rows);
}
