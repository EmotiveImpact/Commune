import { createLazyFileRoute, Link } from '@tanstack/react-router';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  Progress,
  Select,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconCheck, IconDownload, IconReceipt, IconWallet, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useEffect, useMemo, useState } from 'react';
import { setPageTitle } from '../../utils/seo';
import { downloadStatement } from '@commune/api';
import { ExpenseCategory } from '@commune/types';
import { formatCurrency, formatDate, getMonthKey } from '@commune/utils';
import { useGroupStore } from '../../stores/group';
import { useAuthStore } from '../../stores/auth';
import { useGroup } from '../../hooks/use-groups';
import { useUserBreakdown } from '../../hooks/use-dashboard';
import { useMarkPayment } from '../../hooks/use-expenses';
import { useSubscription } from '../../hooks/use-subscriptions';
import { BreakdownSkeleton } from '../../components/page-skeleton';
import { EmptyState } from '../../components/empty-state';
import { PageHeader } from '../../components/page-header';

export const Route = createLazyFileRoute('/_app/breakdown')({
  component: BreakdownPage,
});

const PAGE_SIZE = 30;

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
  useEffect(() => {
    setPageTitle('My Breakdown');
  }, []);

  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey());
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(0);
  const markPayment = useMarkPayment(activeGroupId ?? '');
  const { data: subscription } = useSubscription(user?.id ?? '');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const isPaidPlan =
    (subscription?.plan === 'pro' || subscription?.plan === 'agency') &&
    (subscription?.status === 'active' || subscription?.status === 'trialing');

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

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);
  const paginatedItems = useMemo(
    () => filteredItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredItems, page],
  );

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

  async function handleDownloadStatement() {
    if (!activeGroupId) return;
    setDownloadingPdf(true);
    try {
      const blob = await downloadStatement(activeGroupId, selectedMonth);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `statement-${selectedMonth}.pdf`;
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
      setDownloadingPdf(false);
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
    <Stack gap="lg">
      <PageHeader
        title="Your Breakdown"
        subtitle="What you owe and what you've paid"
      >
        <Group gap="sm">
          <Select
            data={monthOptions}
            value={selectedMonth}
            onChange={(value) => { setSelectedMonth(value ?? getMonthKey()); setPage(0); }}
            w={200}
          />
          {isPaidPlan ? (
            <Button
              variant="default"
              leftSection={<IconDownload size={16} />}
              loading={downloadingPdf}
              onClick={handleDownloadStatement}
              aria-label="Download PDF statement"
            >
              Export PDF
            </Button>
          ) : (
            <Button
              variant="default"
              leftSection={<IconDownload size={16} />}
              disabled
              aria-label="Download PDF statement (upgrade required)"
            >
              Export PDF
            </Button>
          )}
        </Group>
      </PageHeader>

      {isLoading ? (
        <BreakdownSkeleton />
      ) : (
        <>
          <Paper className="commune-soft-panel" p="xl">
            <div className="commune-summary-stats">
              <div className="commune-summary-stat">
                <Text size="sm" c="dimmed">Total owed</Text>
                <div className="commune-summary-stat-value">
                  {formatCurrency(breakdown?.total_owed ?? 0, group?.currency)}
                </div>
              </div>
              <div className="commune-summary-stat" style={{ textAlign: 'center' }}>
                <Text size="sm" c="dimmed">Paid</Text>
                <div className="commune-summary-stat-value" data-color="green">
                  {formatCurrency(breakdown?.total_paid ?? 0, group?.currency)}
                </div>
              </div>
              <div className="commune-summary-stat" style={{ textAlign: 'right' }}>
                <Text size="sm" c="dimmed">Remaining</Text>
                <div className="commune-summary-stat-value" data-color="coral">
                  {formatCurrency(breakdown?.remaining ?? 0, group?.currency)}
                </div>
              </div>
            </div>
            <Group justify="space-between" mt="md" mb={6}>
              <Text size="sm" fw={600}>Payment progress</Text>
              <Badge variant="light" color={paidPct === 100 ? 'emerald' : 'orange'}>
                {paidPct}% paid
              </Badge>
            </Group>
            <div className="commune-soft-progress">
              <Progress value={paidPct} size="xl" color="commune" />
            </div>
          </Paper>

          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">{filteredItems.length} expenses</Text>
            <Select
              placeholder="Filter by category"
              data={categoryOptions}
              value={categoryFilter}
              onChange={(value) => { setCategoryFilter(value ?? ''); setPage(0); }}
              clearable
              w={220}
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
                  {paginatedItems.map((item) => (
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
                            aria-label={item.payment_status === 'unpaid' ? `Mark ${item.expense.title} as paid` : `Mark ${item.expense.title} as unpaid`}
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
          {totalPages > 1 && (
            <Group justify="space-between" mt="sm">
              <Text size="sm" c="dimmed">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredItems.length)} of {filteredItems.length}
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
