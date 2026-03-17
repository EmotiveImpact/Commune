import { createFileRoute } from '@tanstack/react-router';
import {
  Title, Text, Stack, Card, Group, Badge, Select, Progress,
  Center, Loader, Table, ThemeIcon, ActionIcon,
} from '@mantine/core';
import {
  IconCheck, IconClock, IconReceipt, IconX,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useState, useMemo } from 'react';
import { ExpenseCategory } from '@commune/types';
import { formatCurrency, formatDate, getMonthKey } from '@commune/utils';
import { useGroupStore } from '../../stores/group';
import { useAuthStore } from '../../stores/auth';
import { useGroup } from '../../hooks/use-groups';
import { useUserBreakdown } from '../../hooks/use-dashboard';
import { useMarkPayment } from '../../hooks/use-expenses';

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
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    options.push({ value: key, label });
  }
  return options;
}

function BreakdownPage() {
  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey());
  const [categoryFilter, setCategoryFilter] = useState('');

  const markPayment = useMarkPayment(activeGroupId ?? '');

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
        title: 'Failed',
        message: err instanceof Error ? err.message : 'Error',
        color: 'red',
      });
    }
  }

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

  if (!activeGroupId) return <Text c="dimmed">Select a group first.</Text>;

  const paidPct = breakdown && breakdown.total_owed > 0
    ? Math.round((breakdown.total_paid / breakdown.total_owed) * 100)
    : 0;

  const statusColor: Record<string, string> = {
    unpaid: 'red',
    paid: 'green',
    confirmed: 'blue',
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>My Breakdown</Title>
        <Select
          data={monthOptions}
          value={selectedMonth}
          onChange={(v) => setSelectedMonth(v ?? getMonthKey())}
          w={220}
        />
      </Group>

      {isLoading ? (
        <Center h={400}><Loader /></Center>
      ) : (
        <>
          {/* Summary card */}
          <Card withBorder padding="lg" radius="md">
            <Group justify="space-between" mb="md">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Your total</Text>
                <Text fw={700} size="xl">{formatCurrency(breakdown?.total_owed ?? 0, group?.currency)}</Text>
              </div>
              <Group gap="xl">
                <div style={{ textAlign: 'center' }}>
                  <Group gap={4} justify="center">
                    <ThemeIcon variant="light" color="green" size="sm"><IconCheck size={14} /></ThemeIcon>
                    <Text size="sm" fw={600}>{formatCurrency(breakdown?.total_paid ?? 0, group?.currency)}</Text>
                  </Group>
                  <Text size="xs" c="dimmed">Paid</Text>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Group gap={4} justify="center">
                    <ThemeIcon variant="light" color="orange" size="sm"><IconClock size={14} /></ThemeIcon>
                    <Text size="sm" fw={600}>{formatCurrency(breakdown?.remaining ?? 0, group?.currency)}</Text>
                  </Group>
                  <Text size="xs" c="dimmed">Remaining</Text>
                </div>
              </Group>
            </Group>
            <Progress value={paidPct} size="lg" radius="md" color={paidPct === 100 ? 'green' : 'blue'} />
            <Text size="xs" c="dimmed" ta="right" mt={4}>{paidPct}% paid</Text>
          </Card>

          {/* Category filter */}
          <Group>
            <Select
              placeholder="Filter by category"
              data={categoryOptions}
              value={categoryFilter}
              onChange={(v) => setCategoryFilter(v ?? '')}
              clearable
              w={220}
            />
            <Text size="sm" c="dimmed">
              {filteredItems.length} expense{filteredItems.length !== 1 ? 's' : ''}
            </Text>
          </Group>

          {/* Itemised list */}
          {filteredItems.length === 0 ? (
            <Center h={200}>
              <Stack align="center" gap="sm">
                <IconReceipt size={40} color="gray" />
                <Text c="dimmed">No expenses for this period.</Text>
              </Stack>
            </Center>
          ) : (
            <Card withBorder padding={0} radius="md">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Expense</Table.Th>
                    <Table.Th>Category</Table.Th>
                    <Table.Th>Due</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Your share</Table.Th>
                    <Table.Th style={{ textAlign: 'center' }}>Status</Table.Th>
                    <Table.Th>Paid by</Table.Th>
                    <Table.Th style={{ textAlign: 'center' }}>Action</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredItems.map((item) => (
                    <Table.Tr
                      key={item.expense.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => window.location.href = `/expenses/${item.expense.id}`}
                    >
                      <Table.Td>
                        <Text size="sm" fw={500}>{item.expense.title}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" variant="light" color="gray">
                          {item.expense.category.replace(/_/g, ' ')}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">{formatDate(item.expense.due_date)}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" fw={600}>
                          {formatCurrency(item.share_amount, group?.currency)}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <Badge
                          color={statusColor[item.payment_status] ?? 'gray'}
                          variant="light"
                          size="sm"
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
                            color={item.payment_status === 'unpaid' ? 'green' : 'red'}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePayment(item.expense.id, item.payment_status);
                            }}
                          >
                            {item.payment_status === 'unpaid' ? <IconCheck size={14} /> : <IconX size={14} />}
                          </ActionIcon>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          )}
        </>
      )}
    </Stack>
  );
}
