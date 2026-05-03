import type {
  WorkspaceBillingPackData,
  WorkspaceBillingExportRow,
  WorkspaceBillingSnapshot,
  WorkspaceBillingTrendPoint,
  WorkspaceBillingVendorSummary,
} from '@commune/api';
import { isOverdue } from '@commune/utils';
import { getLocalDateKey } from './date-key';

function formatCategoryLabel(category: string) {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function firstTextValue(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const text = value.trim();
    if (text) return text;
  }
  return '';
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatStatusLabel(status?: string | null): string {
  if (!status) return 'Unknown';
  return status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatMonthLabel(monthKey: string): string {
  if (!monthKey) return '';
  const date = new Date(`${monthKey}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return monthKey;
  return date.toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatCostKindLabel(kind?: string | null): string {
  if (!kind) return '';
  return kind
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatBillingStateLabel(row: WorkspaceBillingExportRow): string {
  return row.is_overdue ? 'Overdue' : 'Open';
}

function formatRecurrenceLabel(value?: string | null): string {
  if (!value || value === 'none') return 'None';
  return formatStatusLabel(value);
}

function getPaymentStatus(expense: ExportableExpense): string {
  const paidCount =
    typeof expense.paid_count === 'number'
      ? expense.paid_count
      : expense.payment_records?.filter((p) => p.status !== 'unpaid').length ?? 0;
  const totalParticipants =
    typeof expense.participant_count === 'number'
      ? expense.participant_count
      : expense.participants?.length ?? 0;
  const isSettled = totalParticipants > 0 && paidCount === totalParticipants;

  if (expense.approval_status && expense.approval_status !== 'approved') {
    return 'Not applicable';
  }

  return isSettled ? 'Settled' : isOverdue(expense.payment_due_date || expense.due_date) ? 'Overdue' : 'Open';
}

export interface ExportableExpense {
  title: string;
  category: string | null;
  due_date: string;
  amount: number;
  approval_status?: string | null;
  vendor_name?: string | null;
  vendor?: string | null;
  supplier_name?: string | null;
  supplier?: string | null;
  invoice_reference?: string | null;
  invoice_number?: string | null;
  invoice_no?: string | null;
  invoice_ref?: string | null;
  bill_number?: string | null;
  reference_code?: string | null;
  invoice_date?: string | null;
  bill_date?: string | null;
  document_date?: string | null;
  payment_due_date?: string | null;
  invoice_due_date?: string | null;
  participants?: Array<{ id?: string; user_id?: string }>;
  payment_records?: { status: string }[];
  participant_count?: number;
  paid_count?: number;
}

export function generateExpenseCSV(expenses: ExportableExpense[]): string {
  const headers = [
    'Expense',
    'Vendor',
    'Invoice reference',
    'Invoice date',
    'Due date',
    'Category',
    'Participants',
    'Paid participants',
    'Approval status',
    'Payment status',
    'Amount',
  ];
  const rows = expenses.map((expense) => {
    const vendorName = firstTextValue(expense.vendor_name, expense.vendor, expense.supplier_name, expense.supplier);
    const invoiceReference = firstTextValue(
      expense.invoice_reference,
      expense.invoice_number,
      expense.invoice_no,
      expense.invoice_ref,
      expense.bill_number,
      expense.reference_code,
    );
    const invoiceDate = firstTextValue(expense.invoice_date, expense.bill_date, expense.document_date);
    const dueDate = firstTextValue(expense.payment_due_date, expense.invoice_due_date, expense.due_date);
    const paidCount =
      typeof expense.paid_count === 'number'
        ? expense.paid_count
        : expense.payment_records?.filter((p) => p.status !== 'unpaid').length ?? 0;
    const totalParticipants =
      typeof expense.participant_count === 'number'
        ? expense.participant_count
        : expense.participants?.length ?? 0;
    const approvalStatus = formatStatusLabel(expense.approval_status);
    const paymentStatus = getPaymentStatus(expense);
    return [
      csvCell(expense.title),
      csvCell(vendorName),
      csvCell(invoiceReference),
      csvCell(invoiceDate),
      csvCell(dueDate),
      csvCell(formatCategoryLabel(expense.category ?? 'uncategorized')),
      String(totalParticipants),
      String(paidCount),
      csvCell(approvalStatus),
      csvCell(paymentStatus),
      expense.amount.toFixed(2),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export interface ExportableActivity {
  action: string;
  entity_type?: string | null;
  created_at: string;
  user?: { name: string } | null;
  metadata?: Record<string, unknown> | null;
}

export function generateActivityCSV(entries: ExportableActivity[]): string {
  const headers = ['Date', 'Time', 'Actor', 'Action', 'Type', 'Details'];
  const rows = entries.map((entry) => {
    const date = new Date(entry.created_at);
    const dateStr = date.toISOString().slice(0, 10);
    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const actor = entry.user?.name ?? 'Unknown';
    const action = entry.action.replace(/_/g, ' ');
    const type = entry.entity_type ?? '';
    const meta = entry.metadata ?? {};
    const details = Object.entries(meta)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join('; ');

    return [
      dateStr,
      timeStr,
      `"${actor.replace(/"/g, '""')}"`,
      action,
      type,
      `"${details.replace(/"/g, '""')}"`,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

export interface WorkspaceBillingPackFile {
  filename: string;
  contents: string;
}

export function generateWorkspaceBillingLedgerCSV(rows: WorkspaceBillingExportRow[]): string {
  const headers = [
    'Bill',
    'Vendor',
    'Cost kind',
    'Invoice reference',
    'Invoice date',
    'Due date',
    'Effective due date',
    'Payment due date',
    'Category',
    'Recurrence',
    'Billing state',
    'Amount',
    'Currency',
  ];

  const csvRows = rows.map((row) => [
    csvCell(row.title),
    csvCell(row.vendor_name ?? ''),
    csvCell(formatCostKindLabel(row.cost_kind)),
    csvCell(row.invoice_reference ?? ''),
    csvCell(row.invoice_date ?? ''),
    csvCell(row.due_date),
    csvCell(row.effective_due_date),
    csvCell(row.payment_due_date ?? ''),
    csvCell(row.category ? formatCategoryLabel(row.category) : ''),
    csvCell(formatRecurrenceLabel(row.recurrence_type)),
    csvCell(formatBillingStateLabel(row)),
    row.amount.toFixed(2),
    csvCell(row.currency),
  ].join(','));

  return [headers.join(','), ...csvRows].join('\n');
}

export function generateWorkspaceBillingVendorSummaryCSV(
  vendors: WorkspaceBillingVendorSummary[],
  currency: string,
): string {
  const headers = [
    'Vendor',
    'Total spend',
    'Currency',
    'Invoice count',
    'Overdue bills',
    'Next due date',
    'Latest invoice reference',
    'Latest invoice date',
    'Latest payment due date',
  ];

  const csvRows = vendors.map((vendor) => [
    csvCell(vendor.vendor_name),
    vendor.total_spend.toFixed(2),
    csvCell(currency),
    String(vendor.invoice_count),
    String(vendor.overdue_count),
    csvCell(vendor.next_due_date ?? ''),
    csvCell(vendor.latest_invoice_reference ?? ''),
    csvCell(vendor.latest_invoice_date ?? ''),
    csvCell(vendor.latest_payment_due_date ?? ''),
  ].join(','));

  return [headers.join(','), ...csvRows].join('\n');
}

export function generateWorkspaceBillingTrendCSV(
  trend: WorkspaceBillingTrendPoint[],
  currency: string,
): string {
  const headers = [
    'Month',
    'Month label',
    'Amount',
    'Currency',
    'Bill count',
    'Overdue bills',
    'Shared subscriptions',
    'Tool costs',
    'Vendor bills',
  ];

  const csvRows = trend.map((point) => [
    csvCell(point.month),
    csvCell(formatMonthLabel(point.month)),
    point.amount.toFixed(2),
    csvCell(currency),
    String(point.invoice_count),
    String(point.overdue_count),
    String(point.shared_subscription_count),
    String(point.tool_cost_count),
    String(point.vendor_bill_count),
  ].join(','));

  return [headers.join(','), ...csvRows].join('\n');
}

export function generateWorkspaceBillingSummaryCSV(
  snapshot: WorkspaceBillingSnapshot,
  currency: string,
): string {
  const headers = ['Metric', 'Value', 'Currency'];
  const rows: Array<[string, string, string]> = [
    ['Tracked spend', snapshot.total_invoiced.toFixed(2), currency],
    ['Tracked bills', String(snapshot.invoice_count), ''],
    ['Vendors', String(snapshot.vendor_count), ''],
    ['Overdue bills', String(snapshot.overdue_count), ''],
    ['Due soon', String(snapshot.due_soon_count), ''],
    ['Shared subscriptions', String(snapshot.shared_subscription_count), ''],
    ['Tool costs', String(snapshot.tool_cost_count), ''],
    ['Vendor bills', String(snapshot.vendor_bill_count), ''],
  ];

  return [
    headers.join(','),
    ...rows.map(([metric, value, currencyCode]) => [
      csvCell(metric),
      csvCell(value),
      csvCell(currencyCode),
    ].join(',')),
  ].join('\n');
}

export function buildWorkspaceBillingPackFiles(
  data: WorkspaceBillingPackData,
  currency = 'GBP',
  dateKey = getLocalDateKey(),
): WorkspaceBillingPackFile[] {
  return [
    {
      filename: `workspace-billing-summary-${dateKey}.csv`,
      contents: generateWorkspaceBillingSummaryCSV(data.snapshot, currency),
    },
    {
      filename: `workspace-billing-ledger-${dateKey}.csv`,
      contents: generateWorkspaceBillingLedgerCSV(data.export_rows),
    },
    {
      filename: `workspace-billing-vendors-${dateKey}.csv`,
      contents: generateWorkspaceBillingVendorSummaryCSV(data.snapshot.vendors, currency),
    },
    {
      filename: `workspace-billing-trend-${dateKey}.csv`,
      contents: generateWorkspaceBillingTrendCSV(data.trend, currency),
    },
    {
      filename: `workspace-billing-readme-${dateKey}.txt`,
      contents: [
        'Commune workspace billing pack',
        `Generated: ${dateKey}`,
        '',
        'Files included:',
        '- workspace-billing-summary: headline billing metrics for the current report view',
        '- workspace-billing-ledger: line-by-line bills, subscriptions, and tool costs',
        '- workspace-billing-vendors: vendor rollup with overdue and latest-reference context',
        '- workspace-billing-trend: monthly tracked billing trend',
      ].join('\n'),
    },
  ];
}

export async function downloadWorkspaceBillingPack(
  data: WorkspaceBillingPackData,
  currency = 'GBP',
  filenameBase = 'workspace-billing-pack',
) {
  const dateKey = getLocalDateKey();
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  for (const file of buildWorkspaceBillingPackFiles(data, currency, dateKey)) {
    zip.file(file.filename, file.contents);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `${filenameBase}-${dateKey}.zip`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
