import { isOverdue } from '@commune/utils';

function formatCategoryLabel(category: string) {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

interface ExportableExpense {
  title: string;
  category: string;
  due_date: string;
  amount: number;
  participants?: { id: string }[];
  payment_records?: { status: string }[];
}

export function generateExpenseCSV(expenses: ExportableExpense[]): string {
  const headers = ['Title', 'Category', 'Due Date', 'Participants', 'Status', 'Amount'];
  const rows = expenses.map((expense) => {
    const paidCount = expense.payment_records?.filter((p) => p.status !== 'unpaid').length ?? 0;
    const totalParticipants = expense.participants?.length ?? 0;
    const isSettled = totalParticipants > 0 && paidCount === totalParticipants;
    const status = isSettled ? 'Settled' : isOverdue(expense.due_date) ? 'Overdue' : 'Open';
    return [
      `"${expense.title.replace(/"/g, '""')}"`,
      formatCategoryLabel(expense.category),
      expense.due_date,
      `${paidCount}/${totalParticipants}`,
      status,
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
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
