import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Group,
  Select,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconPlus, IconReceipt } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { ExpenseCategory } from '@commune/types';
import { formatCurrency, formatDate, isOverdue } from '@commune/utils';
import { useGroupStore } from '../../../stores/group';
import { useSearchStore } from '../../../stores/search';
import { useGroup } from '../../../hooks/use-groups';
import { useGroupExpenses } from '../../../hooks/use-expenses';
import { PageLoader } from '../../../components/page-loader';
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

  const { data: expenses, isLoading } = useGroupExpenses(
    activeGroupId ?? '',
    categoryFilter ? { category: categoryFilter } : undefined,
  );

  const searchFiltered = useMemo(() => {
    if (!expenses) return [];
    if (!searchQuery) return expenses;
    const q = searchQuery.toLowerCase();
    return expenses.filter(
      (expense) =>
        expense.title.toLowerCase().includes(q)
        || expense.category.toLowerCase().includes(q),
    );
  }, [expenses, searchQuery]);

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
        <Group gap="sm" wrap="wrap">
          <Select
            placeholder="Category"
            data={categoryOptions}
            value={categoryFilter}
            onChange={(value) => { setCategoryFilter(value ?? ''); setPage(0); }}
            clearable
            w={180}
          />
          <Button component={Link} to="/expenses/new" leftSection={<IconPlus size={16} />}>
            Add expense
          </Button>
        </Group>
      </PageHeader>

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

      {isLoading ? (
        <PageLoader message="Loading expenses..." />
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
                    <Table.Tr key={expense.id}>
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
    </Stack>
  );
}
