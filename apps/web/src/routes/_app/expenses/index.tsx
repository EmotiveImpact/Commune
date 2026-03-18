import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconCalendarTime, IconPlus, IconReceipt, IconRepeat, IconSearch } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { ExpenseCategory } from '@commune/types';
import { formatCurrency, formatDate, isOverdue, isUpcoming } from '@commune/utils';
import { useGroupStore } from '../../../stores/group';
import { useSearchStore } from '../../../stores/search';
import { useGroup } from '../../../hooks/use-groups';
import { useGroupExpenses } from '../../../hooks/use-expenses';
import { PageLoader } from '../../../components/page-loader';
import { EmptyState } from '../../../components/empty-state';

export const Route = createFileRoute('/_app/expenses/')({
  component: ExpensesPage,
});

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

function ExpensesPage() {
  const navigate = useNavigate();
  const { activeGroupId } = useGroupStore();
  const { query: searchQuery } = useSearchStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const [categoryFilter, setCategoryFilter] = useState('');

  const { data: expenses, isLoading } = useGroupExpenses(
    activeGroupId ?? '',
    categoryFilter ? { category: categoryFilter } : undefined,
  );

  const filtered = useMemo(() => {
    if (!expenses) return [];
    if (!searchQuery) return expenses;
    const q = searchQuery.toLowerCase();
    return expenses.filter(
      (expense) =>
        expense.title.toLowerCase().includes(q)
        || expense.category.toLowerCase().includes(q),
    );
  }, [expenses, searchQuery]);

  const summary = useMemo(() => {
    const totalAmount = filtered.reduce((sum, expense) => sum + expense.amount, 0);
    const overdueCount = filtered.filter((expense) => isOverdue(expense.due_date)).length;
    const recurringCount = filtered.filter((expense) => expense.recurrence_type !== 'none').length;
    const dueSoonCount = filtered.filter((expense) => isUpcoming(expense.due_date)).length;

    return {
      totalAmount,
      overdueCount,
      recurringCount,
      dueSoonCount,
    };
  }, [filtered]);

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

  return (
    <Stack gap="xl">
      <Paper className="commune-hero-card" p={{ base: 'xl', md: '2rem' }}>
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs" maw={620}>
            <Badge variant="light" color="emerald" w="fit-content">
              Expense ledger
            </Badge>
            <Title order={1}>Expenses</Title>
            <Text size="lg" c="dimmed">
              Track recurring costs, one-off bills, due dates, and what still needs to be settled for {group?.name}.
            </Text>
          </Stack>

          <Button component={Link} to="/expenses/new" leftSection={<IconPlus size={16} />}>
            Add expense
          </Button>
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="lg">
        <Paper className="commune-stat-card" p="lg">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">Tracked spend</Text>
              <Text fw={800} size="1.9rem">{formatCurrency(summary.totalAmount, group?.currency)}</Text>
              <Text size="sm" c="dimmed">Across {filtered.length} expenses</Text>
            </Stack>
            <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--commune-primary-strong)' }}>
              <IconReceipt size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper className="commune-stat-card" p="lg">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">Overdue</Text>
              <Text fw={800} size="1.9rem">{summary.overdueCount}</Text>
              <Text size="sm" c="dimmed">Past the due date</Text>
            </Stack>
            <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'rgba(245, 154, 118, 0.18)', color: '#F59A76' }}>
              <IconAlertTriangle size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper className="commune-stat-card" p="lg">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">Due this week</Text>
              <Text fw={800} size="1.9rem">{summary.dueSoonCount}</Text>
              <Text size="sm" c="dimmed">Coming up soon</Text>
            </Stack>
            <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'rgba(98, 195, 138, 0.16)', color: 'var(--commune-forest-soft)' }}>
              <IconCalendarTime size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper className="commune-stat-card" p="lg">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">Recurring</Text>
              <Text fw={800} size="1.9rem">{summary.recurringCount}</Text>
              <Text size="sm" c="dimmed">Repeating expenses</Text>
            </Stack>
            <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'rgba(16, 69, 54, 0.1)', color: 'var(--commune-forest)' }}>
              <IconRepeat size={20} />
            </ThemeIcon>
          </Group>
        </Paper>
      </SimpleGrid>

      <Paper className="commune-soft-panel" p="xl">
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={700} size="lg">Filter expenses</Text>
              <Text size="sm" c="dimmed">
                Search by title or category, then narrow the ledger down by type.
              </Text>
            </div>
          </Group>

          <Group align="end" grow>
            <TextInput
              placeholder="Use the top-bar search"
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              readOnly
                          />
            <Select
              placeholder="Category"
              data={categoryOptions}
              value={categoryFilter}
              onChange={(value) => setCategoryFilter(value ?? '')}
              clearable
                          />
          </Group>
        </Stack>
      </Paper>

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
        <Paper className="commune-soft-panel" p="xl">
          <Group justify="space-between" align="flex-start" mb="md">
            <div>
              <Text fw={700} size="lg">Expense table</Text>
              <Text size="sm" c="dimmed">
                Shared costs ordered by due date and payment status.
              </Text>
            </div>
            <Badge variant="light" color="gray">
              {filtered.length} items
            </Badge>
          </Group>

          <div style={{ overflowX: 'auto' }}>
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
                {filtered.map((expense) => {
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
                        <Badge size="sm" variant="light" color="gray">
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
        </Paper>
      )}
    </Stack>
  );
}
