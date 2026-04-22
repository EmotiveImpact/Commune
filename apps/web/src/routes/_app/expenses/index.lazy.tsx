import { createLazyFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconDownload, IconFileTypePdf, IconPlus, IconReceipt, IconShieldCheck, IconTrash } from '@tabler/icons-react';
import { DatePickerInput, DatesProvider } from '@mantine/dates';
import 'dayjs/locale/en-gb';
import { useEffect, useMemo, useRef, useState } from 'react';
import { setPageTitle } from '../../../utils/seo';
import { ExpenseCategory } from '@commune/types';
import { formatCurrency, formatDate, getMonthKey, isOverdue } from '@commune/utils';
import { getLocalDateKey } from '../../../utils/date-key';
import {
  downloadStatement,
  getExpenseLedgerExportRows,
  type ExpenseLedgerItem,
} from '@commune/api';
import { canMemberApproveWithPolicy } from '@commune/core';
import { usePlanLimits } from '../../../hooks/use-plan-limits';
import { IconAlertTriangle, IconX } from '@tabler/icons-react';
import { useGroupStore } from '../../../stores/group';
import { useSearchStore } from '../../../stores/search';
import { useGroup } from '../../../hooks/use-groups';
import { useWorkspaceGovernance } from '../../../hooks/use-workspace-governance';
import {
  getWorkspaceExpenseContext,
  hasWorkspaceExpenseContext,
  useExpenseLedger,
  useBatchArchive,
  useBatchMarkPaid,
} from '../../../hooks/use-expenses';
import { usePendingApprovals, useApproveExpense, useRejectExpense } from '../../../hooks/use-approvals';
import { useAuthStore } from '../../../stores/auth';
import { ExpenseListSkeleton } from '../../../components/page-skeleton';
import { EmptyState } from '../../../components/empty-state';
import { PageHeader } from '../../../components/page-header';

export const Route = createLazyFileRoute('/_app/expenses/')({
  component: ExpensesPage,
});

import { PaginationBar, PAGE_SIZE } from '../../../components/pagination';

const categoryOptions = [
  { value: '', label: 'All categories' },
  ...Object.entries(ExpenseCategory).map(([key, value]) => ({
    value,
    label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
  })),
];

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = getMonthKey(d);
    const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    options.push({ value: key, label });
  }
  return [
    ...options,
    { value: 'all', label: 'All time' },
  ];
}

function formatCategoryLabel(category: string) {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

type StatusFilter = 'all' | 'open' | 'overdue' | 'settled';
type WorkspaceViewFilter = 'all' | 'linked' | 'missing' | 'due-soon';

const workspaceViewOptions: Array<{ value: WorkspaceViewFilter; label: string }> = [
  { value: 'all', label: 'All workspace expenses' },
  { value: 'linked', label: 'Linked invoices' },
  { value: 'missing', label: 'Missing details' },
  { value: 'due-soon', label: 'Due soon' },
];

function isExpenseSettled(expense: {
  paid_count?: number;
  participant_count?: number;
}) {
  const paidCount = expense.paid_count ?? 0;
  const totalParticipants = expense.participant_count ?? 0;
  return totalParticipants > 0 && paidCount === totalParticipants;
}

function isDueSoon(dateKey: string) {
  if (!dateKey) return false;
  const date = new Date(dateKey);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const sevenDaysAhead = todayKey + 7 * 24 * 60 * 60 * 1000;
  const targetKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return targetKey >= todayKey && targetKey <= sevenDaysAhead;
}

export function ExpensesPage() {
  const isMountedRef = useRef(true);

  useEffect(() => {
    setPageTitle('Expenses');
  }, []);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  const navigate = useNavigate();
  const { activeGroupId } = useGroupStore();
  const { query: searchQuery } = useSearchStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const workspaceGovernance = useWorkspaceGovernance(group);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [workspaceViewFilter, setWorkspaceViewFilter] = useState<WorkspaceViewFilter>('all');
  const [page, setPage] = useState(0);
  const [datePreset, setDatePreset] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[string | null, string | null]>([null, null]);

  // PDF export & tier gating
  const { user } = useAuthStore();
  const { canExport, canDownloadStatements } = usePlanLimits(user?.id ?? '');
  const isPaidPlan = canDownloadStatements;
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Bulk actions
  const batchArchive = useBatchArchive(activeGroupId ?? '');
  const batchMarkPaid = useBatchMarkPaid(activeGroupId ?? '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false);

  const isAdmin = group?.members?.some(
    (m: { user_id: string; role: string }) => m.user_id === user?.id && m.role === 'admin',
  ) ?? false;
  const isWorkspaceGroup = group?.type === 'workspace';
  const currentMember = group?.members?.find(
    (member: { user_id: string }) => member.user_id === user?.id,
  ) ?? null;
  const canApprovePendingExpenses = isWorkspaceGroup
    ? canMemberApproveWithPolicy(currentMember, group?.approval_policy)
    : isAdmin;

  // Approval flow
  const { data: pendingApprovals } = usePendingApprovals(activeGroupId ?? '');
  const approveExp = useApproveExpense(activeGroupId ?? '');
  const rejectExp = useRejectExpense(activeGroupId ?? '');

  const monthFilter = datePreset && datePreset !== 'all' ? datePreset : undefined;
  const hasCustomDateRange = Boolean(dateRange[0] || dateRange[1]);
  const ledgerFilters = useMemo(
    () => ({
      ...(categoryFilter ? { category: categoryFilter } : {}),
      ...(monthFilter ? { month: monthFilter } : {}),
      ...(dateRange[0] ? { dateFrom: dateRange[0] } : {}),
      ...(dateRange[1] ? { dateTo: dateRange[1] } : {}),
      ...(searchQuery ? { search: searchQuery } : {}),
      ...(isWorkspaceGroup ? { workspaceView: workspaceViewFilter } : {}),
      status: statusFilter,
      isWorkspaceGroup,
      page,
      pageSize: PAGE_SIZE,
    }),
    [
      categoryFilter,
      monthFilter,
      dateRange,
      searchQuery,
      isWorkspaceGroup,
      workspaceViewFilter,
      statusFilter,
      page,
    ],
  );

  const { data: ledger, isLoading } = useExpenseLedger(activeGroupId ?? '', ledgerFilters);
  const paginatedExpenses = ledger?.items ?? [];
  const filteredCount = ledger?.filtered_count ?? 0;
  const summary = ledger?.summary;
  const counts = {
    openCount: summary?.open_count ?? 0,
    overdueCount: summary?.overdue_count ?? 0,
    settledCount: summary?.settled_count ?? 0,
  };
  const totalAmount = summary?.total_amount ?? 0;
  const totalLedgerCount = summary?.total_count ?? 0;
  const workspaceSummary = isWorkspaceGroup && summary
    ? {
        linkedCount: summary.workspace.linked_count,
        missingCount: summary.workspace.missing_count,
        dueSoonCount: summary.workspace.due_soon_count,
      }
    : null;

  const canExportPdf =
    isPaidPlan && Boolean(monthFilter) && !hasCustomDateRange && filteredCount > 0;

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [categoryFilter, statusFilter, datePreset, dateRange, searchQuery, page]);

  async function exportExpenseCSV(rows: ExpenseLedgerItem[], filenamePrefix: string, message: string) {
    if (rows.length === 0) {
      notifications.show({
        title: 'Nothing to export',
        message: 'No expenses matched the current filters.',
        color: 'yellow',
      });
      return;
    }
    const { generateExpenseCSV, downloadCSV } = await import('../../../utils/export-csv');
    const csv = generateExpenseCSV(rows);
    const dateStr = getLocalDateKey();
    downloadCSV(csv, `${filenamePrefix}-${dateStr}.csv`);
    notifications.show({
      title: 'CSV exported',
      message,
      color: 'green',
    });
  }

  async function handleExportCSV() {
    if (!activeGroupId || filteredCount === 0) {
      await exportExpenseCSV([], 'expenses-filtered', '');
      return;
    }

    setExportingCsv(true);
    try {
      const rows = await getExpenseLedgerExportRows(activeGroupId, {
        ...(categoryFilter ? { category: categoryFilter } : {}),
        ...(monthFilter ? { month: monthFilter } : {}),
        ...(dateRange[0] ? { dateFrom: dateRange[0] } : {}),
        ...(dateRange[1] ? { dateTo: dateRange[1] } : {}),
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(isWorkspaceGroup ? { workspaceView: workspaceViewFilter } : {}),
        status: statusFilter,
        isWorkspaceGroup,
      });

      await exportExpenseCSV(
        rows,
        'expenses-filtered',
        `${filteredCount} filtered expense${filteredCount === 1 ? '' : 's'} exported from the current view.`,
      );
    } catch (err) {
      notifications.show({
        title: 'CSV export failed',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    } finally {
      if (isMountedRef.current) {
        setExportingCsv(false);
      }
    }
  }

  async function handleExportPDF() {
    if (!activeGroupId || !monthFilter || hasCustomDateRange) return;
    setDownloadingPdf(true);
    try {
      const month = monthFilter;
      const blob = await downloadStatement(activeGroupId, month);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `expenses-${month}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notifications.show({ title: 'Statement downloaded', message: '', color: 'green' });
    } catch (err) {
      notifications.show({
        title: 'Failed to generate statement',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    } finally {
      if (isMountedRef.current) {
        setDownloadingPdf(false);
      }
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === paginatedExpenses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedExpenses.map((e) => e.id)));
    }
  }

  async function handleBulkArchive() {
    try {
      await batchArchive.mutateAsync(Array.from(selectedIds));
      setSelectedIds(new Set());
      setArchiveModalOpen(false);
      notifications.show({
        title: 'Expenses archived',
        message: `${selectedIds.size} expense${selectedIds.size > 1 ? 's' : ''} archived successfully.`,
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Archive failed',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  async function handleBulkMarkPaid() {
    if (!user?.id) return;
    try {
      await batchMarkPaid.mutateAsync({ expenseIds: Array.from(selectedIds), userId: user.id });
      setSelectedIds(new Set());
      setMarkPaidModalOpen(false);
      notifications.show({
        title: 'Expenses marked as paid',
        message: `${selectedIds.size} expense${selectedIds.size > 1 ? 's' : ''} marked as paid successfully.`,
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Mark as paid failed',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  function handleBulkExport() {
    const selected = paginatedExpenses.filter((expense) => selectedIds.has(expense.id));
    exportExpenseCSV(
      selected,
      'expenses-selected',
      `${selected.length} selected expense${selected.length === 1 ? '' : 's'} exported.`,
    );
  }

  if (!activeGroupId) {
    return (
      <EmptyState
        icon={IconReceipt}
        iconColor="emerald"
        title="Select a group first"
        description="Pick a group from the sidebar to see the expense ledger for that space."
      />
    );
  }

  const chipData: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: totalLedgerCount },
    { key: 'open', label: 'Open', count: counts.openCount },
    { key: 'overdue', label: 'Overdue', count: counts.overdueCount },
    { key: 'settled', label: 'Settled', count: counts.settledCount },
  ];

  return (
    <Stack gap="lg">
      <PageHeader
        title="Expenses"
        subtitle={`${totalLedgerCount} expenses · ${formatCurrency(totalAmount, group?.currency)} tracked`}
      >
        <Group gap="sm">
          <Button component={Link} to="/expenses/new" leftSection={<IconPlus size={16} />}>
            Add expense
          </Button>
          {canExport ? (
            <Button
              variant="default"
              leftSection={<IconDownload size={16} />}
              onClick={() => {
                void handleExportCSV();
              }}
              loading={exportingCsv}
              disabled={filteredCount === 0}
              title="Export the current filtered expenses to CSV"
            >
              Export filtered CSV
            </Button>
          ) : (
            <Tooltip label="Pro feature — upgrade to unlock" withArrow>
              <Button variant="default" leftSection={<IconDownload size={16} />} disabled data-disabled>
                Export filtered CSV
              </Button>
            </Tooltip>
          )}
          <Button
            variant="default"
            leftSection={<IconFileTypePdf size={16} />}
            onClick={handleExportPDF}
            loading={downloadingPdf}
            disabled={!canExportPdf}
            title={
              !isPaidPlan
                ? 'Upgrade to Pro to export PDF statements'
                : hasCustomDateRange
                ? 'PDF statements are only available for a single month'
                : !monthFilter
                ? 'Select a month to export a PDF statement'
                : filteredCount === 0
                ? 'No expenses available for the selected month'
                : 'Download PDF statement'
            }
          >
            Export PDF
          </Button>
        </Group>
      </PageHeader>

      {workspaceSummary && (
        <Paper className="commune-stat-card" p="md">
          <Group justify="space-between" gap="md" wrap="wrap">
            <Text fw={700}>Workspace billing</Text>
            <Group gap="xs">
              <Badge variant="light" color="green">
                {workspaceSummary.linkedCount} linked
              </Badge>
              <Badge variant="light" color="orange">
                {workspaceSummary.missingCount} missing details
              </Badge>
              <Badge variant="light" color="blue">
                {workspaceSummary.dueSoonCount} due soon
              </Badge>
            </Group>
          </Group>
        </Paper>
      )}

      {workspaceGovernance.isWorkspaceGroup && (
        <Paper className="commune-stat-card" p="md">
          <Group justify="space-between" gap="md" wrap="wrap" align="flex-start">
            <div>
              <Group gap={6} mb={4}>
                <IconShieldCheck size={18} />
                <Text fw={700}>Workspace roles and approvals</Text>
              </Group>
              <Text size="sm" c="dimmed">
                {workspaceGovernance.approvalSummary}
              </Text>
            </div>
            <Group gap="xs" wrap="wrap">
              {workspaceGovernance.responsibilityLabels.slice(0, 3).map((label) => (
                <Badge key={label} variant="light" color="gray">
                  {label}
                </Badge>
              ))}
            </Group>
          </Group>
        </Paper>
      )}

      {/* Pending Approvals */}
      {canApprovePendingExpenses && pendingApprovals && pendingApprovals.length > 0 && (
        <Stack gap="xs">
          <Group gap="xs">
            <IconAlertTriangle size={18} color="var(--mantine-color-orange-6)" />
            <Text fw={700} size="sm" c="orange">
              {pendingApprovals.length} expense{pendingApprovals.length !== 1 ? 's' : ''} awaiting approval
            </Text>
          </Group>
          {pendingApprovals.map((exp: any) => (
            <Group key={exp.id} justify="space-between" align="center" p="sm"
              style={{ background: 'var(--commune-surface-alt)', borderRadius: 8, border: '1px solid var(--mantine-color-orange-3)' }}>
              <Stack gap={2}>
                <Text fw={600} size="sm">{exp.title}</Text>
                <Text size="xs" c="dimmed">
                  {formatCurrency(exp.amount, exp.currency)} · Added by {exp.created_by_user?.name ?? 'Unknown'}
                </Text>
              </Stack>
              <Group gap="xs">
                <Button size="compact-xs" color="green" variant="light"
                  leftSection={<IconCheck size={14} />}
                  loading={approveExp.isPending}
                  onClick={() => {
                    approveExp.mutate(exp.id, {
                      onSuccess: () => notifications.show({ title: 'Approved', message: `${exp.title} has been approved.`, color: 'green' }),
                    });
                  }}>
                  Approve
                </Button>
                <Button size="compact-xs" color="red" variant="light"
                  leftSection={<IconX size={14} />}
                  loading={rejectExp.isPending}
                  onClick={() => {
                    rejectExp.mutate(exp.id, {
                      onSuccess: () => notifications.show({ title: 'Rejected', message: `${exp.title} has been rejected.`, color: 'red' }),
                    });
                  }}>
                  Reject
                </Button>
              </Group>
            </Group>
          ))}
        </Stack>
      )}

      <Group gap="sm" wrap="wrap">
        <Select
          placeholder="Category"
          data={categoryOptions}
          value={categoryFilter}
          onChange={(value) => { setCategoryFilter(value ?? ''); setPage(0); }}
          clearable
          w={180}
        />
        {isWorkspaceGroup && (
          <Select
            label="Workspace view"
            placeholder="Workspace view"
            data={workspaceViewOptions}
            value={workspaceViewFilter}
            onChange={(value) => {
              setWorkspaceViewFilter((value as WorkspaceViewFilter) ?? 'all');
              setPage(0);
            }}
            w={220}
          />
        )}
        <Select
          placeholder="Period"
          data={getMonthOptions()}
          value={datePreset}
          onChange={(value) => {
            setDatePreset(value);
            setPage(0);
          }}
          clearable
          w={180}
        />
        <DatesProvider settings={{ locale: 'en-gb' }}>
          <DatePickerInput
            type="range"
            placeholder="Date range"
            value={dateRange}
            onChange={(value) => { setDateRange(value); setPage(0); }}
            valueFormat="DD MMM YYYY"
            w={260}
            size="sm"
            clearable
          />
        </DatesProvider>
      </Group>

      <div className="commune-filter-chips">
        {chipData.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className="commune-filter-chip"
            data-active={statusFilter === chip.key}
            onClick={() => { setStatusFilter(chip.key); setPage(0); }}
          >
            {chip.label} ({chip.count})
          </button>
        ))}
      </div>

      {searchQuery && (
        <Group gap="xs" align="center">
          <Text size="sm" c="dimmed">
            {filteredCount} result{filteredCount !== 1 ? 's' : ''} for "{searchQuery}"
          </Text>
          <Button variant="subtle" size="xs" color="gray" onClick={() => useSearchStore.getState().clearQuery()}>
            Clear
          </Button>
        </Group>
      )}

      {isLoading ? (
        <ExpenseListSkeleton />
      ) : filteredCount === 0 ? (
        <EmptyState
          icon={IconReceipt}
          iconColor="emerald"
          title="No expenses match this view"
          description="Add your first expense or change the current filters to bring the ledger into view."
          action={{
            label: 'Add expense',
            onClick: () => {
              navigate({ to: '/expenses/new' });
            },
          }}
        />
      ) : (
        <>
          <div className="commune-table-shell">
            <Table verticalSpacing="md" horizontalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  {isAdmin && (
                    <Table.Th w={40}>
                      <Checkbox
                        checked={paginatedExpenses.length > 0 && selectedIds.size === paginatedExpenses.length}
                        indeterminate={selectedIds.size > 0 && selectedIds.size < paginatedExpenses.length}
                        onChange={toggleSelectAll}
                        aria-label="Select all expenses"
                      />
                    </Table.Th>
                  )}
                  <Table.Th>Expense</Table.Th>
                  <Table.Th>Category</Table.Th>
                  <Table.Th>Due date</Table.Th>
                  <Table.Th>Participants</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Amount</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginatedExpenses.map((expense) => {
                  const overdue = isOverdue(expense.due_date);
                  const paidCount = expense.paid_count ?? 0;
                  const totalParticipants = expense.participant_count ?? 0;
                  const settled = isExpenseSettled(expense);
                  const approvalStatus = expense.approval_status ?? 'approved';
                  const workspaceContext = getWorkspaceExpenseContext(expense);
                  const showWorkspaceContext = hasWorkspaceExpenseContext(expense) || group?.type === 'workspace';
                  const statusBadge =
                    approvalStatus === 'pending'
                      ? { color: 'orange', label: 'Pending approval' }
                      : approvalStatus === 'rejected'
                        ? { color: 'red', label: 'Rejected' }
                        : settled
                          ? { color: 'emerald', label: 'Settled' }
                          : overdue
                            ? { color: 'red', label: 'Overdue' }
                            : { color: 'orange', label: 'Open' };

                  return (
                    <Table.Tr
                      key={expense.id}
                      style={selectedIds.has(expense.id) ? { background: 'rgba(150, 232, 95, 0.04)' } : undefined}
                    >
                      {isAdmin && (
                        <Table.Td>
                          <Checkbox
                            checked={selectedIds.has(expense.id)}
                            onChange={() => toggleSelectOne(expense.id)}
                            aria-label={`Select ${expense.title}`}
                          />
                        </Table.Td>
                      )}
                      <Table.Td>
                        <Stack gap={4}>
                          <Text component={Link} to={`/expenses/${expense.id}`} fw={600} style={{ textDecoration: 'none' }}>
                            {expense.title}
                          </Text>
                          {showWorkspaceContext && (workspaceContext.vendor_name || workspaceContext.invoice_reference) && (
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              {workspaceContext.vendor_name || 'Workspace'}
                              {workspaceContext.invoice_reference
                                ? ` · Ref ${workspaceContext.invoice_reference}`
                                : ''}
                            </Text>
                          )}
                          {showWorkspaceContext && (workspaceContext.invoice_date || workspaceContext.payment_due_date) && (
                            <Group gap={6} wrap="wrap">
                              {workspaceContext.invoice_date && (
                                <Badge size="xs" variant="light" color="gray">
                                  Invoice {formatDate(workspaceContext.invoice_date)}
                                </Badge>
                              )}
                              {workspaceContext.payment_due_date && (
                                <Badge size="xs" variant="light" color={isDueSoon(workspaceContext.payment_due_date) ? 'orange' : 'gray'}>
                                  Due {formatDate(workspaceContext.payment_due_date)}
                                </Badge>
                              )}
                            </Group>
                          )}
                          {expense.recurrence_type !== 'none' && (
                            <Badge size="xs" variant="light" color="emerald" w="fit-content">
                              Recurring
                            </Badge>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Badge className="commune-pill-badge" size="sm" variant="light" color="gray">
                          {formatCategoryLabel(expense.category ?? 'uncategorized')}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">{formatDate(expense.due_date)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {paidCount}/{totalParticipants} paid
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={statusBadge.color} variant="light">
                          {statusBadge.label}
                        </Badge>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text fw={700}>{formatCurrency(expense.amount, group?.currency)}</Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </div>
          <PaginationBar
            page={page}
            totalItems={filteredCount}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Floating bulk action bar */}
      {isAdmin && selectedIds.size > 0 && (
        <div className="commune-bulk-bar">
          <Text size="sm" fw={600} c="green">
            {selectedIds.size} selected
          </Text>
          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={() => setArchiveModalOpen(true)}
            >
              Archive
            </Button>
            <Button
              size="xs"
              variant="light"
              color="green"
              leftSection={<IconCheck size={14} />}
              onClick={() => setMarkPaidModalOpen(true)}
            >
              Mark paid
            </Button>
            {canExport ? (
              <Button
                size="xs"
                variant="default"
                leftSection={<IconDownload size={14} />}
                onClick={handleBulkExport}
              >
                Export selected CSV
              </Button>
            ) : (
              <Tooltip label="Pro feature — upgrade to unlock" withArrow>
                <Button
                  size="xs"
                  variant="default"
                  leftSection={<IconDownload size={14} />}
                  disabled
                  data-disabled
                >
                  Export selected CSV
                </Button>
              </Tooltip>
            )}
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </Group>
        </div>
      )}

      {/* Bulk archive confirmation modal */}
      <Modal
        opened={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        title="Archive expenses"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Archive {selectedIds.size} expense{selectedIds.size > 1 ? 's' : ''}? This will remove them from the active list.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setArchiveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleBulkArchive}
              loading={batchArchive.isPending}
            >
              Archive
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Bulk mark as paid confirmation modal */}
      <Modal
        opened={markPaidModalOpen}
        onClose={() => setMarkPaidModalOpen(false)}
        title="Mark as paid"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Mark {selectedIds.size} expense{selectedIds.size > 1 ? 's' : ''} as paid? This will update your payment status for the selected expenses.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setMarkPaidModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="green"
              onClick={handleBulkMarkPaid}
              loading={batchMarkPaid.isPending}
            >
              Mark paid
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
