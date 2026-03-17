import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Title, Stack, Card, Group, Text, Badge, Select, TextInput, Button,
} from '@mantine/core';
import { IconPlus, IconSearch, IconReceipt } from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import { ExpenseCategory } from '@commune/types';
import { formatCurrency, formatDate, isOverdue } from '@commune/utils';
import { useGroupStore } from '../../../stores/group';
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

function ExpensesPage() {
  const { activeGroupId } = useGroupStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: expenses, isLoading } = useGroupExpenses(
    activeGroupId ?? '',
    categoryFilter ? { category: categoryFilter } : undefined,
  );

  const filtered = useMemo(() => {
    if (!expenses) return [];
    if (!searchQuery) return expenses;
    const q = searchQuery.toLowerCase();
    return expenses.filter((e) => e.title.toLowerCase().includes(q));
  }, [expenses, searchQuery]);

  if (!activeGroupId) return <Text c="dimmed">Select a group first.</Text>;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Expenses</Title>
        <Button component={Link} to="/expenses/new" leftSection={<IconPlus size={16} />}>
          Add expense
        </Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Search expenses..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="Category"
          data={categoryOptions}
          value={categoryFilter}
          onChange={(v) => setCategoryFilter(v ?? '')}
          clearable
          w={200}
        />
      </Group>

      {isLoading ? (
        <PageLoader message="Loading expenses..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={IconReceipt}
          iconColor="blue"
          title="No expenses yet"
          description="Add your first expense to start tracking shared costs."
        />
      ) : (
        <Stack gap="sm">
          {filtered.map((expense) => {
            const overdue = isOverdue(expense.due_date);
            const paidCount = expense.payment_records?.filter((p) => p.status !== 'unpaid').length ?? 0;
            const totalParticipants = expense.participants?.length ?? 0;

            return (
              <Card
                key={expense.id}
                component={Link}
                to={`/expenses/${expense.id}`}
                withBorder
                padding="md"
                radius="md"
                style={{ cursor: 'pointer', textDecoration: 'none' }}
              >
                <Group justify="space-between">
                  <div>
                    <Group gap="xs">
                      <Text fw={600}>{expense.title}</Text>
                      {expense.recurrence_type !== 'none' && (
                        <Badge size="xs" variant="light">Recurring</Badge>
                      )}
                    </Group>
                    <Group gap="xs" mt={4}>
                      <Badge size="sm" variant="light" color="gray">
                        {expense.category.replace(/_/g, ' ')}
                      </Badge>
                      <Text size="sm" c="dimmed">{formatDate(expense.due_date)}</Text>
                      <Text size="sm" c="dimmed">
                        {paidCount}/{totalParticipants} paid
                      </Text>
                    </Group>
                  </div>
                  <Stack align="flex-end" gap={2}>
                    <Text fw={700} size="lg">
                      {formatCurrency(expense.amount, group?.currency)}
                    </Text>
                    {overdue && <Badge color="red" size="xs">Overdue</Badge>}
                  </Stack>
                </Group>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
