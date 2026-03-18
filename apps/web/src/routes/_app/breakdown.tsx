import { createFileRoute, Link } from '@tanstack/react-router';
import {
  ActionIcon,
  Badge,
  Group,
  Paper,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconCheck,
  IconClock,
  IconReceipt,
  IconWallet,
  IconX,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useMemo, useState } from 'react';
import { ExpenseCategory } from '@commune/types';
import { formatCurrency, formatDate, getMonthKey } from '@commune/utils';
import { useGroupStore } from '../../stores/group';
import { useAuthStore } from '../../stores/auth';
import { useGroup } from '../../hooks/use-groups';
import { useUserBreakdown } from '../../hooks/use-dashboard';
import { useMarkPayment } from '../../hooks/use-expenses';
import { PageLoader } from '../../components/page-loader';
import { EmptyState } from '../../components/empty-state';

export const Route = createFileRoute('/_app/breakdown')({
  component: BreakdownPage,
});

const categoryOptions = [
  { value: '', label: 'All categories' },
  ...Object.entries(ExpenseCategory).map(([key, value]) => ({
    value,
    label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
  })),
];

function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();

  for (let index = 0; index < 12; index += 1) {
    const value = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const key = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
    const label = value.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    options.push({ value: key, label });
  }

  return options;
}

function formatCategoryLabel(category: string) {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function BreakdownPage() {
  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey());
  const [categoryFilter, setCategoryFilter] = useState('');
  const markPayment = useMarkPayment(activeGroupId ?? '');

  const { data: breakdown, isLoading } = useUserBreakdown(
    activeGroupId ?? '',
    user?.id ?? '',
    selectedMonth,
  );

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  const filteredItems = useMemo(() => {
    if (!breakdown?.items) return [];
    if (!categoryFilter) return breakdown.items;
    return breakdown.items.filter((item) => item.expense.category === categoryFilter);
  }, [breakdown, categoryFilter]);

  const paidPct = breakdown && breakdown.total_owed > 0
    ? Math.round((breakdown.total_paid / breakdown.total_owed) * 100)
    : 0;

  async function handleTogglePayment(expenseId: string, currentStatus: string) {
    try {
      await markPayment.mutateAsync({
        expenseId,
        userId: user?.id ?? '',
        status: currentStatus === 'unpaid' ? 'paid' : 'unpaid',
      });
      notifications.show({
        title: currentStatus === 'unpaid' ? 'Marked as paid' : 'Marked as unpaid',
        message: '',
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to update payment',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  if (!activeGroupId) {
    return (
      <EmptyState
        icon={IconWallet}
        iconColor="emerald"
        title="Select a group first"
        description="Choose a group from the sidebar to see your personal monthly breakdown."
      />
    );
  }

  return (
    <Stack gap="xl">
      <Paper className="commune-hero-card" p={{ base: 'xl', md: '2rem' }}>
        <div className="commune-hero-grid">
          <Stack gap="md" maw={620}>
            <div className="commune-hero-chip">Personal statement</div>
            <Stack gap="xs">
              <Title order={1}>Your monthly breakdown, clearly laid out.</Title>
              <Text size="lg" className="commune-hero-copy">
                See what you owe, what has already been paid, and what is still open for {group?.name}.
              </Text>
            </Stack>
          </Stack>

          <Stack className="commune-hero-aside" gap="md">
            <div>
              <Text size="sm" c="rgba(255, 250, 246, 0.65)">
                Viewing cycle
              </Text>
              <Select
                data={monthOptions}
                value={selectedMonth}
                onChange={(value) => setSelectedMonth(value ?? getMonthKey())}
                styles={{
                  input: {
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#fffaf6',
                  },
                  dropdown: {
                    background: '#1f1a2a',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                  },
                }}
              />
            </div>

            <SimpleGrid cols={2} spacing="sm">
              <div className="commune-hero-aside-stat">
                <Text size="xs" c="rgba(255, 250, 246, 0.55)" tt="uppercase">
                  Total owed
                </Text>
                <Text fw={700} size="lg">
                  {formatCurrency(breakdown?.total_owed ?? 0, group?.currency)}
                </Text>
              </div>
              <div className="commune-hero-aside-stat">
                <Text size="xs" c="rgba(255, 250, 246, 0.55)" tt="uppercase">
                  Remaining
                </Text>
                <Text fw={700} size="lg">
                  {formatCurrency(breakdown?.remaining ?? 0, group?.currency)}
                </Text>
              </div>
            </SimpleGrid>
          </Stack>
        </div>
      </Paper>

      {isLoading ? (
        <PageLoader message="Loading breakdown..." />
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="lg">
            <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="sage">
              <Group justify="space-between">
                <Stack gap={2}>
                  <Text size="sm" c="dimmed">Total owed</Text>
                  <Text fw={800} size="1.9rem">
                    {formatCurrency(breakdown?.total_owed ?? 0, group?.currency)}
                  </Text>
                  <Text size="sm" c="dimmed">For the selected month</Text>
                </Stack>
                <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--commune-primary-strong)' }}>
                  <IconReceipt size={20} />
                </ThemeIcon>
              </Group>
            </Paper>

            <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="lilac">
              <Group justify="space-between">
                <Stack gap={2}>
                  <Text size="sm" c="dimmed">Paid</Text>
                  <Text fw={800} size="1.9rem">
                    {formatCurrency(breakdown?.total_paid ?? 0, group?.currency)}
                  </Text>
                  <Text size="sm" c="dimmed">Already marked as paid</Text>
                </Stack>
                <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'rgba(98, 195, 138, 0.16)', color: 'var(--commune-forest-soft)' }}>
                  <IconCheck size={20} />
                </ThemeIcon>
              </Group>
            </Paper>

            <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="peach">
              <Group justify="space-between">
                <Stack gap={2}>
                  <Text size="sm" c="dimmed">Remaining</Text>
                  <Text fw={800} size="1.9rem">
                    {formatCurrency(breakdown?.remaining ?? 0, group?.currency)}
                  </Text>
                  <Text size="sm" c="dimmed">Still outstanding</Text>
                </Stack>
                <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'rgba(245, 154, 118, 0.18)', color: '#F59A76' }}>
                  <IconClock size={20} />
                </ThemeIcon>
              </Group>
            </Paper>

            <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="ink">
              <Group justify="space-between">
                <Stack gap={2}>
                  <Text size="sm" c="dimmed">Items</Text>
                  <Text fw={800} size="1.9rem">{filteredItems.length}</Text>
                  <Text size="sm" c="dimmed">Expenses in this view</Text>
                </Stack>
                <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'rgba(16, 69, 54, 0.1)', color: 'var(--commune-forest)' }}>
                  <IconWallet size={20} />
                </ThemeIcon>
              </Group>
            </Paper>
          </SimpleGrid>

          <Paper className="commune-soft-panel" p="xl">
            <Group justify="space-between" align="center" mb="md">
              <div>
                <Text className="commune-section-heading">Payment progress</Text>
                <Text size="sm" c="dimmed">
                  Neutral, obvious, and month-specific.
                </Text>
              </div>
              <Badge variant="light" color={paidPct === 100 ? 'emerald' : 'orange'}>
                {paidPct}% paid
              </Badge>
            </Group>
            <div className="commune-soft-progress">
              <Progress value={paidPct} size="xl" color="commune" />
            </div>
          </Paper>

          <Paper className="commune-soft-panel" p="xl">
            <Group justify="space-between" align="flex-end" mb="md">
              <div>
                <Text className="commune-section-heading">Filter breakdown</Text>
                <Text size="sm" c="dimmed">
                  Narrow the statement by category.
                </Text>
              </div>
              <Select
                placeholder="Filter by category"
                data={categoryOptions}
                value={categoryFilter}
                onChange={(value) => setCategoryFilter(value ?? '')}
                clearable
                                w={240}
              />
            </Group>

            {filteredItems.length === 0 ? (
              <EmptyState
                icon={IconReceipt}
                iconColor="emerald"
                title="No expenses for this period"
                description="There are no expenses matching the selected month and category."
              />
            ) : (
              <div className="commune-table-shell" style={{ overflowX: 'auto' }}>
                <Table verticalSpacing="md" horizontalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Expense</Table.Th>
                      <Table.Th>Category</Table.Th>
                      <Table.Th>Due</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Your share</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Paid by</Table.Th>
                      <Table.Th style={{ textAlign: 'center' }}>Action</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredItems.map((item) => (
                      <Table.Tr key={item.expense.id}>
                        <Table.Td>
                          <Text component={Link} to={`/expenses/${item.expense.id}`} fw={600} style={{ textDecoration: 'none' }}>
                            {item.expense.title}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="sm" variant="light" color="gray" className="commune-pill-badge">
                            {formatCategoryLabel(item.expense.category)}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">{formatDate(item.expense.due_date)}</Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" fw={700}>
                            {formatCurrency(item.share_amount, group?.currency)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            color={item.payment_status === 'confirmed' ? 'blue' : item.payment_status === 'paid' ? 'emerald' : 'orange'}
                            variant="light"
                          >
                            {item.payment_status}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {item.paid_by_user?.name ?? '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          {item.payment_status !== 'confirmed' && (
                            <ActionIcon
                              variant="light"
                              color={item.payment_status === 'unpaid' ? 'emerald' : 'red'}
                              onClick={() => handleTogglePayment(item.expense.id, item.payment_status)}
                            >
                              {item.payment_status === 'unpaid' ? <IconCheck size={16} /> : <IconX size={16} />}
                            </ActionIcon>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            )}
          </Paper>
        </>
      )}
    </Stack>
  );
}
