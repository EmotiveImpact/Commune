import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDownload, IconPlus, IconReceipt, IconTrash } from '@tabler/icons-react';
import { DatePickerInput, DatesProvider } from '@mantine/dates';
import 'dayjs/locale/en-gb';
import { useEffect, useMemo, useState } from 'react';
import { ExpenseCategory } from '@commune/types';
import { formatCurrency, formatDate, getMonthKey, isOverdue } from '@commune/utils';
import { generateExpenseCSV, downloadCSV } from '../../../utils/export-csv';
import { useGroupStore } from '../../../stores/group';
import { useSearchStore } from '../../../stores/search';
import { useGroup } from '../../../hooks/use-groups';
import { useGroupExpenses, useBatchArchive } from '../../../hooks/use-expenses';
import { useAuthStore } from '../../../stores/auth';
import { ExpenseListSkeleton } from '../../../components/page-skeleton';
import { EmptyState } from '../../../components/empty-state';
import { PageHeader } from '../../../components/page-header';

export const Route = createFileRoute('/_app/expenses/')({
  component: ExpensesPage,
});

const PAGE_SIZE = 30;

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
    { value: 'custom', label: 'Custom range...' },
  ];
}

function formatCategoryLabel(category: string) {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

type StatusFilter = 'all' | 'open' | 'overdue' | 'settled';

function ExpensesPage() {
  const navigate = useNavigate();
  const { activeGroupId } = useGroupStore();
  const { query: searchQuery } = useSearchStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(0);
  const [datePreset, setDatePreset] = useState<string | null>(null);
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState<string | null>(null);

  // Bulk actions
  const { user } = useAuthStore();
  const batchArchive = useBatchArchive(activeGroupId ?? '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);

  const isAdmin = group?.members?.some(
    (m: { user_id: string; role: string }) => m.user_id === user?.id && m.role === 'admin',
  ) ?? false;

  const monthFilter = datePreset && datePreset !== 'all' && datePreset !== 'custom' ? datePreset : undefined;
  const expenseFilters = {
    ...(categoryFilter ? { category: categoryFilter } : {}),
    ...(monthFilter ? { month: monthFilter } : {}),
  };
  const hasFilters = Object.keys(expenseFilters).length > 0;

  const { data: expenses, isLoading } = useGroupExpenses(
    activeGroupId ?? '',
    hasFilters ? expenseFilters : undefined,
  );

  const searchFiltered = useMemo(() => {
    if (!expenses) return [];
    let result = expenses;

    // Custom date range (client-side)
    if (datePreset === 'custom' && customFrom && customTo) {
      result = result.filter((e) => e.due_date >= customFrom && e.due_date <= customTo);
    }

    // Search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) => e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q),
      );
    }

    return result;
  }, [expenses, searchQuery, datePreset, customFrom, customTo]);

  const counts = useMemo(() => {
    let openCount = 0;
    let overdueCount = 0;
    let settledCount = 0;

    for (const expense of searchFiltered) {
      const paidCount = expense.payment_records?.filter((p) => p.status !== 'unpaid').length ?? 0;
      const totalParticipants = expense.participants?.length ?? 0;
      const isSettled = totalParticipants > 0 && paidCount === totalParticipants;

      if (isSettled) {
        settledCount += 1;
      } else if (isOverdue(expense.due_date)) {
        overdueCount += 1;
      } else {
        openCount += 1;
      }
    }

    return { openCount, overdueCount, settledCount };
  }, [searchFiltered]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return searchFiltered;

    return searchFiltered.filter((expense) => {
      const paidCount = expense.payment_records?.filter((p) => p.status !== 'unpaid').length ?? 0;
      const totalParticipants = expense.participants?.length ?? 0;
      const isSettled = totalParticipants > 0 && paidCount === totalParticipants;

      if (statusFilter === 'settled') return isSettled;
      if (statusFilter === 'overdue') return !isSettled && isOverdue(expense.due_date);
      return !isSettled && !isOverdue(expense.due_date);
    });
  }, [searchFiltered, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedExpenses = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page],
  );

  const totalAmount = useMemo(
    () => searchFiltered.reduce((sum, expense) => sum + expense.amount, 0),
    [searchFiltered],
  );

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [categoryFilter, statusFilter, datePreset, customFrom, customTo, searchQuery, page]);

  function handleExportCSV() {
    if (!filtered || filtered.length === 0) return;
    const csv = generateExpenseCSV(filtered);
    downloadCSV(csv, `expenses-${new Date().toISOString().slice(0, 10)}.csv`);
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

  function handleBulkExport() {
    const selected = filtered.filter((e) => selectedIds.has(e.id));
    if (selected.length === 0) return;
    const csv = generateExpenseCSV(selected);
    downloadCSV(csv, `expenses-selected-${new Date().toISOString().slice(0, 10)}.csv`);
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
    { key: 'all', label: 'All', count: searchFiltered.length },
    { key: 'open', label: 'Open', count: counts.openCount },
    { key: 'overdue', label: 'Overdue', count: counts.overdueCount },
    { key: 'settled', label: 'Settled', count: counts.settledCount },
  ];

  return (
    <Stack gap="lg">
      <PageHeader
        title="Expenses"
        subtitle={`${searchFiltered.length} expenses · ${formatCurrency(totalAmount, group?.currency)} tracked`}
      >
        <Group gap="sm">
          <Button component={Link} to="/expenses/new" leftSection={<IconPlus size={16} />}>
            Add expense
          </Button>
          <Button variant="default" leftSection={<IconDownload size={16} />} onClick={handleExportCSV} disabled={filtered.length === 0}>
            Export
          </Button>
        </Group>
      </PageHeader>

      <Group gap="sm" wrap="wrap">
        <Select
          placeholder="Category"
          data={categoryOptions}
          value={categoryFilter}
          onChange={(value) => { setCategoryFilter(value ?? ''); setPage(0); }}
          clearable
          w={180}
        />
        <Select
          placeholder="Period"
          data={getMonthOptions()}
          value={datePreset}
          onChange={(value) => {
            setDatePreset(value);
            if (value !== 'custom') {
              setCustomFrom(null);
              setCustomTo(null);
            }
            setPage(0);
          }}
          clearable
          w={180}
        />
        {datePreset === 'custom' && (
          <DatesProvider settings={{ locale: 'en-gb' }}>
            <DatePickerInput
              placeholder="From"
              value={customFrom}
              onChange={(v) => { setCustomFrom(v); setPage(0); }}
              valueFormat="DD MMM YYYY"
              w={160}
              size="sm"
              clearable
            />
            <DatePickerInput
              placeholder="To"
              value={customTo}
              onChange={(v) => { setCustomTo(v); setPage(0); }}
              valueFormat="DD MMM YYYY"
              w={160}
              size="sm"
              clearable
            />
          </DatesProvider>
        )}
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
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{searchQuery}"
          </Text>
          <Button variant="subtle" size="xs" color="gray" onClick={() => useSearchStore.getState().clearQuery()}>
            Clear
          </Button>
        </Group>
      )}

      {isLoading ? (
        <ExpenseListSkeleton />
      ) : filtered.length === 0 ? (
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
                  const paidCount = expense.payment_records?.filter((payment) => payment.status !== 'unpaid').length ?? 0;
                  const totalParticipants = expense.participants?.length ?? 0;
                  const settled = totalParticipants > 0 && paidCount === totalParticipants;

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
                          {expense.recurrence_type !== 'none' && (
                            <Badge size="xs" variant="light" color="emerald" w="fit-content">
                              Recurring
                            </Badge>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Badge className="commune-pill-badge" size="sm" variant="light" color="gray">
                          {formatCategoryLabel(expense.category)}
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
                        <Badge color={settled ? 'emerald' : overdue ? 'red' : 'orange'} variant="light">
                          {settled ? 'Settled' : overdue ? 'Overdue' : 'Open'}
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
          {totalPages > 1 && (
            <Group justify="space-between" mt="sm">
              <Text size="sm" c="dimmed">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </Text>
              <Group gap="xs">
                <Button
                  variant="default"
                  size="xs"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="default"
                  size="xs"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </Group>
            </Group>
          )}
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
              variant="default"
              leftSection={<IconDownload size={14} />}
              onClick={handleBulkExport}
            >
              Export
            </Button>
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
    </Stack>
  );
}
