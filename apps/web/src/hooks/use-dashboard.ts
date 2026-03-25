import { useQuery } from '@tanstack/react-query';
import {
  getDashboardStats,
  getUserBreakdown,
  getWorkspaceBillingContext as getApiWorkspaceBillingContext,
  isWorkspaceBillingExpense,
} from '@commune/api';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: (groupId: string, userId: string, month: string) =>
    [...dashboardKeys.all, 'stats', groupId, userId, month] as const,
  breakdown: (groupId: string, userId: string, month: string) =>
    [...dashboardKeys.all, 'breakdown', groupId, userId, month] as const,
};

export interface DashboardWorkspaceExpenseContext {
  vendor_name: string;
  invoice_reference: string;
  invoice_date: string;
  payment_due_date: string;
}

export interface WorkspaceBillingSummaryItem extends DashboardWorkspaceExpenseContext {
  id: string;
  title: string;
  amount: number;
  currency: string;
  due_date: string;
  category: string;
  recurrence_type: string;
}

export interface WorkspaceBillingSummary {
  expenseCount: number;
  metadataCount: number;
  sharedSubscriptionCount: number;
  toolCostCount: number;
  toolCostSpend: number;
  vendorCount: number;
  overdueCount: number;
  dueSoonCount: number;
  totalSpend: number;
  latestBill: WorkspaceBillingSummaryItem | null;
  nextDueBill: WorkspaceBillingSummaryItem | null;
  topVendor: { vendor_name: string; amount: number; count: number } | null;
  upcomingBills: WorkspaceBillingSummaryItem[];
}

export function getDashboardWorkspaceExpenseContext(expense?: unknown): DashboardWorkspaceExpenseContext {
  const context = getApiWorkspaceBillingContext(expense as Record<string, unknown> | null | undefined);
  return {
    vendor_name: context.vendor_name ?? '',
    invoice_reference: context.invoice_reference ?? '',
    invoice_date: context.invoice_date ?? '',
    payment_due_date: context.payment_due_date ?? '',
  };
}

export function hasDashboardWorkspaceExpenseContext(expense?: unknown): boolean {
  const context = getDashboardWorkspaceExpenseContext(expense);
  return Object.values(context).some(Boolean);
}

function parseWorkspaceBillingItem(expense?: unknown): WorkspaceBillingSummaryItem | null {
  if (!expense || typeof expense !== 'object') {
    return null;
  }

  const source = expense as Record<string, unknown>;
  const id = typeof source.id === 'string' ? source.id.trim() : '';
  const dueDate = typeof source.due_date === 'string' ? source.due_date.trim() : '';
  const amount = typeof source.amount === 'number' ? source.amount : Number(source.amount);
  const recurrenceType = typeof source.recurrence_type === 'string' ? source.recurrence_type.trim() : '';

  if (!id || !dueDate || !Number.isFinite(amount)) {
    return null;
  }

  const context = getDashboardWorkspaceExpenseContext(source);
  const title =
    typeof source.title === 'string' && source.title.trim()
      ? source.title.trim()
      : context.vendor_name || context.invoice_reference || 'Unlabelled bill';

  return {
    id,
    title,
    amount,
    currency: typeof source.currency === 'string' && source.currency.trim() ? source.currency.trim() : 'GBP',
    due_date: dueDate,
    category: typeof source.category === 'string' ? source.category.trim() : '',
    recurrence_type: recurrenceType,
    ...context,
  };
}

function parseDateKey(value: string): number {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

export function getWorkspaceBillingSummary(
  expenses?: unknown[],
  referenceDate = new Date(),
): WorkspaceBillingSummary {
  const items = (expenses ?? [])
    .map((expense) => parseWorkspaceBillingItem(expense))
    .filter((item): item is WorkspaceBillingSummaryItem => item !== null);
  const billingItems = items.filter((item) => isWorkspaceBillingExpense(item));

  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  const dueSoonCutoff = new Date(today);
  dueSoonCutoff.setDate(dueSoonCutoff.getDate() + 7);
  const dueSoonCutoffTime = dueSoonCutoff.getTime();
  const todayTime = today.getTime();

  const metadataCount = billingItems.filter((item) => hasDashboardWorkspaceExpenseContext(item)).length;
  const sharedSubscriptionCount = billingItems.filter(
    (item) => item.recurrence_type !== '' && item.recurrence_type !== 'none',
  ).length;
  const toolCostItems = billingItems.filter((item) => item.category === 'work_tools');
  const vendorTotals = new Map<string, { amount: number; count: number }>();
  let totalSpend = 0;
  let toolCostSpend = 0;
  let overdueCount = 0;
  let dueSoonCount = 0;

  for (const item of billingItems) {
    totalSpend += item.amount;
    if (item.category === 'work_tools') {
      toolCostSpend += item.amount;
    }

    const vendorName = item.vendor_name.trim() || item.title.trim();
    if (vendorName) {
      const existing = vendorTotals.get(vendorName) ?? { amount: 0, count: 0 };
      vendorTotals.set(vendorName, {
        amount: existing.amount + item.amount,
        count: existing.count + 1,
      });
    }

    const dueTime = parseDateKey(item.payment_due_date || item.due_date);
    if (dueTime < todayTime) {
      overdueCount += 1;
    } else if (dueTime <= dueSoonCutoffTime) {
      dueSoonCount += 1;
    }
  }

  const latestBill = [...billingItems].sort((a, b) => {
    const aDate = parseDateKey(a.invoice_date || a.payment_due_date || a.due_date);
    const bDate = parseDateKey(b.invoice_date || b.payment_due_date || b.due_date);
    return bDate - aDate;
  })[0] ?? null;

  const upcomingBills = [...billingItems]
    .filter((item) => parseDateKey(item.payment_due_date || item.due_date) >= todayTime)
    .sort((a, b) => parseDateKey(a.payment_due_date || a.due_date) - parseDateKey(b.payment_due_date || b.due_date))
    .slice(0, 3);

  const nextDueBill = upcomingBills[0] ?? null;
  const topVendorEntry = [...vendorTotals.entries()].sort((a, b) => b[1].amount - a[1].amount)[0];

  return {
    expenseCount: billingItems.length,
    metadataCount,
    sharedSubscriptionCount,
    toolCostCount: toolCostItems.length,
    toolCostSpend,
    vendorCount: vendorTotals.size,
    overdueCount,
    dueSoonCount,
    totalSpend,
    latestBill,
    nextDueBill,
    topVendor: topVendorEntry
      ? {
          vendor_name: topVendorEntry[0],
          amount: topVendorEntry[1].amount,
          count: topVendorEntry[1].count,
        }
      : null,
    upcomingBills,
  };
}

export function useDashboardStats(groupId: string, userId: string, month: string) {
  return useQuery({
    queryKey: dashboardKeys.stats(groupId, userId, month),
    queryFn: () => getDashboardStats(groupId, userId, month),
    enabled: !!groupId && !!userId,
  });
}

export function useUserBreakdown(groupId: string, userId: string, month: string) {
  return useQuery({
    queryKey: dashboardKeys.breakdown(groupId, userId, month),
    queryFn: () => getUserBreakdown(groupId, userId, month),
    enabled: !!groupId && !!userId,
  });
}
