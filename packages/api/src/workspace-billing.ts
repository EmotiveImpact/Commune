import type { ExpenseVendorInvoiceContext } from '@commune/types';

export type WorkspaceBillingCostKind =
  | 'shared_subscription'
  | 'tool_cost'
  | 'vendor_bill';

export interface WorkspaceBillingExpenseRecord extends ExpenseVendorInvoiceContext {
  id: string;
  title: string;
  amount: number;
  currency: string;
  due_date: string;
  category?: string | null;
  recurrence_type?: string | null;
}

export interface WorkspaceBillingVendorSummary {
  vendor_name: string;
  total_spend: number;
  invoice_count: number;
  overdue_count: number;
  next_due_date: string | null;
  latest_invoice_reference: string | null;
  latest_invoice_date: string | null;
  latest_payment_due_date: string | null;
}

export interface WorkspaceBillingUpcomingExpense extends WorkspaceBillingExpenseRecord {
  effective_due_date: string;
  is_overdue: boolean;
}

export interface WorkspaceBillingSnapshot {
  total_invoiced: number;
  invoice_count: number;
  vendor_count: number;
  overdue_count: number;
  due_soon_count: number;
  shared_subscription_count: number;
  tool_cost_count: number;
  tool_cost_spend: number;
  vendor_bill_count: number;
  vendors: WorkspaceBillingVendorSummary[];
  upcoming_due: WorkspaceBillingUpcomingExpense[];
  latest_bill: WorkspaceBillingUpcomingExpense | null;
}

export interface WorkspaceBillingTrendPoint {
  month: string;
  amount: number;
  invoice_count: number;
  overdue_count: number;
  shared_subscription_count: number;
  tool_cost_count: number;
  vendor_bill_count: number;
}

export interface WorkspaceBillingExportRow {
  id: string;
  title: string;
  amount: number;
  currency: string;
  due_date: string;
  effective_due_date: string;
  is_overdue: boolean;
  vendor_name: string | null;
  invoice_reference: string | null;
  invoice_date: string | null;
  payment_due_date: string | null;
  category: string | null;
  recurrence_type: string | null;
  cost_kind: WorkspaceBillingCostKind;
}

export interface WorkspaceBillingReport {
  snapshot: WorkspaceBillingSnapshot;
  export_rows: WorkspaceBillingExportRow[];
}

export interface WorkspaceBillingData {
  snapshot: WorkspaceBillingSnapshot;
  trend: WorkspaceBillingTrendPoint[];
}

export interface WorkspaceBillingPackData extends WorkspaceBillingData {
  export_rows: WorkspaceBillingExportRow[];
}

export interface WorkspaceBillingContext extends WorkspaceBillingExpenseRecord {
  effective_due_date: string;
  is_overdue: boolean;
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function firstTextValue(...values: unknown[]): string {
  for (const value of values) {
    const text = toText(value);
    if (text) return text;
  }
  return '';
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function getWorkspaceBillingContext(
  expense?: Partial<ExpenseVendorInvoiceContext> | Record<string, unknown> | null,
): ExpenseVendorInvoiceContext {
  if (!expense || typeof expense !== 'object') {
    return {
      vendor_name: null,
      invoice_reference: null,
      invoice_date: null,
      payment_due_date: null,
    };
  }

  const source = expense as Record<string, unknown>;
  const vendor_name = firstTextValue(
    source.vendor_name,
    source.vendor,
    source.supplier_name,
    source.supplier,
  );
  const invoice_reference = firstTextValue(
    source.invoice_reference,
    source.invoice_number,
    source.invoice_no,
    source.invoice_ref,
    source.bill_number,
    source.reference_code,
  );
  const invoice_date = firstTextValue(
    source.invoice_date,
    source.bill_date,
    source.document_date,
  );
  const payment_due_date = firstTextValue(
    source.payment_due_date,
    source.invoice_due_date,
  );

  return {
    vendor_name: vendor_name || null,
    invoice_reference: invoice_reference || null,
    invoice_date: invoice_date || null,
    payment_due_date: payment_due_date || null,
  };
}

export function hasWorkspaceBillingContext(
  expense?: Partial<ExpenseVendorInvoiceContext> | Record<string, unknown> | null,
): boolean {
  const context = getWorkspaceBillingContext(expense);
  return Object.values(context).some(Boolean);
}

export function isWorkspaceBillingExpense(
  expense?: WorkspaceBillingExpenseRecord | Record<string, unknown> | null,
): boolean {
  if (!expense || typeof expense !== 'object') {
    return false;
  }

  const source = expense as WorkspaceBillingExpenseRecord;
  const recurrenceType = toText(source.recurrence_type);
  const category = toText(source.category);

  return (
    hasWorkspaceBillingContext(source)
    || (recurrenceType !== '' && recurrenceType !== 'none')
    || category === 'work_tools'
  );
}

function getEffectiveDueDate(expense: WorkspaceBillingExpenseRecord): string {
  return firstTextValue(expense.payment_due_date, expense.due_date);
}

function getWorkspaceBillingCostKind(
  expense: WorkspaceBillingExpenseRecord,
): WorkspaceBillingCostKind {
  const recurrenceType = toText(expense.recurrence_type);
  if (recurrenceType && recurrenceType !== 'none') {
    return 'shared_subscription';
  }

  if (toText(expense.category) === 'work_tools') {
    return 'tool_cost';
  }

  return 'vendor_bill';
}

function isOverdue(expense: WorkspaceBillingExpenseRecord, todayKey: string): boolean {
  return getEffectiveDueDate(expense) < todayKey;
}

function isDueSoon(
  expense: WorkspaceBillingExpenseRecord,
  todayKey: string,
  dueSoonKey: string,
): boolean {
  const effectiveDueDate = getEffectiveDueDate(expense);
  return effectiveDueDate >= todayKey && effectiveDueDate <= dueSoonKey;
}

export function createWorkspaceBillingContext(
  expense: WorkspaceBillingExpenseRecord,
  todayKey = toDateKey(new Date()),
): WorkspaceBillingContext {
  const effectiveDueDate = getEffectiveDueDate(expense);

  return {
    ...expense,
    effective_due_date: effectiveDueDate,
    is_overdue: effectiveDueDate < todayKey,
  };
}

export function buildWorkspaceBillingSnapshot(
  expenses: WorkspaceBillingExpenseRecord[],
  today = new Date(),
  dueSoonDays = 7,
): WorkspaceBillingSnapshot {
  const todayKey = toDateKey(today);
  const safeDueSoonDays = Number.isFinite(dueSoonDays)
    ? Math.max(0, Math.trunc(dueSoonDays))
    : 0;
  const dueSoonKey = toDateKey(addUtcDays(today, safeDueSoonDays));

  const vendorMap = new Map<string, WorkspaceBillingVendorSummary>();
  const upcomingDue: WorkspaceBillingUpcomingExpense[] = [];
  let totalInvoiced = 0;
  let invoiceCount = 0;
  let overdueCount = 0;
  let dueSoonCount = 0;
  let sharedSubscriptionCount = 0;
  let toolCostCount = 0;
  let toolCostSpend = 0;
  let vendorBillCount = 0;
  let latestBill: WorkspaceBillingUpcomingExpense | null = null;
  let latestBillActivityKey = '';

  for (const expense of expenses) {
    if (!isWorkspaceBillingExpense(expense)) continue;

    const context = getWorkspaceBillingContext(expense);

    totalInvoiced += expense.amount;
    invoiceCount += 1;

    switch (getWorkspaceBillingCostKind(expense)) {
      case 'shared_subscription':
        sharedSubscriptionCount += 1;
        break;
      case 'tool_cost':
        toolCostCount += 1;
        toolCostSpend += expense.amount;
        break;
      default:
        vendorBillCount += 1;
        break;
    }

    const effectiveDueDate = getEffectiveDueDate(expense);
    const overdue = isOverdue(expense, todayKey);
    const dueSoonFlag = isDueSoon(expense, todayKey, dueSoonKey);
    const enrichedExpense: WorkspaceBillingUpcomingExpense = {
      ...expense,
      ...context,
      effective_due_date: effectiveDueDate,
      is_overdue: overdue,
    };

    if (overdue) overdueCount += 1;
    if (dueSoonFlag) dueSoonCount += 1;

    if (dueSoonFlag) {
      upcomingDue.push(enrichedExpense);
    }

    const currentActivityKey = firstTextValue(
      context.invoice_date,
      context.payment_due_date,
      effectiveDueDate,
    );
    if (!latestBill || currentActivityKey > latestBillActivityKey) {
      latestBill = enrichedExpense;
      latestBillActivityKey = currentActivityKey;
    }

    const vendorKey = context.vendor_name ?? 'Unassigned vendor';
    const existing = vendorMap.get(vendorKey);
    if (!existing) {
      vendorMap.set(vendorKey, {
        vendor_name: vendorKey,
        total_spend: expense.amount,
        invoice_count: 1,
        overdue_count: overdue ? 1 : 0,
        next_due_date: effectiveDueDate,
        latest_invoice_reference: expense.invoice_reference,
        latest_invoice_date: expense.invoice_date,
        latest_payment_due_date: expense.payment_due_date,
      });
      continue;
    }

    existing.total_spend += expense.amount;
    existing.invoice_count += 1;
    if (overdue) existing.overdue_count += 1;
    if (!existing.next_due_date || effectiveDueDate < existing.next_due_date) {
      existing.next_due_date = effectiveDueDate;
    }
    const latestActivityKey = firstTextValue(
      context.invoice_date,
      context.payment_due_date,
      effectiveDueDate,
    );
    const existingActivityKey = firstTextValue(
      existing.latest_invoice_date,
      existing.latest_payment_due_date,
      existing.next_due_date,
    );
    if (!existingActivityKey || latestActivityKey > existingActivityKey) {
      existing.latest_invoice_date = context.invoice_date ?? existing.latest_invoice_date;
      existing.latest_invoice_reference =
        context.invoice_reference ?? existing.latest_invoice_reference;
      existing.latest_payment_due_date =
        context.payment_due_date ?? existing.latest_payment_due_date;
    }
  }

  return {
    total_invoiced: totalInvoiced,
    invoice_count: invoiceCount,
    vendor_count: vendorMap.size,
    overdue_count: overdueCount,
    due_soon_count: dueSoonCount,
    shared_subscription_count: sharedSubscriptionCount,
    tool_cost_count: toolCostCount,
    tool_cost_spend: toolCostSpend,
    vendor_bill_count: vendorBillCount,
    vendors: Array.from(vendorMap.values()).sort((a, b) => b.total_spend - a.total_spend),
    upcoming_due: upcomingDue
      .sort((a, b) => a.effective_due_date.localeCompare(b.effective_due_date) || b.amount - a.amount)
      .slice(0, 5),
    latest_bill: latestBill,
  };
}

export function buildWorkspaceBillingTrend(
  expenses: WorkspaceBillingExpenseRecord[],
  months = 6,
): WorkspaceBillingTrendPoint[] {
  const now = new Date();
  const buckets = new Map<string, WorkspaceBillingTrendPoint>();

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    const key = toMonthKey(monthDate);
    buckets.set(key, {
      month: key,
      amount: 0,
      invoice_count: 0,
      overdue_count: 0,
      shared_subscription_count: 0,
      tool_cost_count: 0,
      vendor_bill_count: 0,
    });
  }

  const todayKeyUtc = toDateKey(now);

  for (const expense of expenses) {
    if (!isWorkspaceBillingExpense(expense)) continue;

    const dueDate = getEffectiveDueDate(expense);
    const monthKey = dueDate.slice(0, 7);
    const bucket = buckets.get(monthKey);
    if (!bucket) continue;

    bucket.amount += expense.amount;
    bucket.invoice_count += 1;
    if (dueDate < todayKeyUtc) {
      bucket.overdue_count += 1;
    }

    switch (getWorkspaceBillingCostKind(expense)) {
      case 'shared_subscription':
        bucket.shared_subscription_count += 1;
        break;
      case 'tool_cost':
        bucket.tool_cost_count += 1;
        break;
      default:
        bucket.vendor_bill_count += 1;
        break;
    }
  }

  return Array.from(buckets.values());
}

export function buildWorkspaceBillingExportRows(
  expenses: WorkspaceBillingExpenseRecord[],
  today = new Date(),
): WorkspaceBillingExportRow[] {
  const todayKey = toDateKey(today);

  return expenses
    .filter((expense) => isWorkspaceBillingExpense(expense))
    .map((expense) => {
      const context = getWorkspaceBillingContext(expense);
      const effectiveDueDate = getEffectiveDueDate(expense);

      return {
        id: expense.id,
        title: expense.title,
        amount: expense.amount,
        currency: expense.currency,
        due_date: expense.due_date,
        effective_due_date: effectiveDueDate,
        is_overdue: effectiveDueDate < todayKey,
        vendor_name: context.vendor_name,
        invoice_reference: context.invoice_reference,
        invoice_date: context.invoice_date,
        payment_due_date: context.payment_due_date,
        category: toText(expense.category) || null,
        recurrence_type: toText(expense.recurrence_type) || null,
        cost_kind: getWorkspaceBillingCostKind(expense),
      };
    })
    .sort(
      (a, b) =>
        a.effective_due_date.localeCompare(b.effective_due_date) ||
        b.amount - a.amount ||
        a.title.localeCompare(b.title),
    );
}

export function buildWorkspaceBillingReport(
  expenses: WorkspaceBillingExpenseRecord[],
  today = new Date(),
  dueSoonDays = 7,
): WorkspaceBillingReport {
  return {
    snapshot: buildWorkspaceBillingSnapshot(expenses, today, dueSoonDays),
    export_rows: buildWorkspaceBillingExportRows(expenses, today),
  };
}
