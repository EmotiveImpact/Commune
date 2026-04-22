import { createLazyFileRoute, Link } from '@tanstack/react-router';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  Progress,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { IconArrowRight, IconBellRinging, IconCheck, IconCash, IconChevronDown, IconChevronRight, IconDownload, IconExternalLink, IconHistory, IconReceipt, IconWallet, IconX } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useEffect, useMemo, useState } from 'react';
import { setPageTitle } from '../../utils/seo';
import { downloadStatement } from '@commune/api';
import { ExpenseCategory } from '@commune/types';
import type { SettlementTransaction } from '@commune/types';
import { formatCurrency, formatDate, getMonthKey } from '@commune/utils';
import { useGroupStore } from '../../stores/group';
import { useAuthStore } from '../../stores/auth';
import { useGroup } from '../../hooks/use-groups';
import { useUserBreakdown } from '../../hooks/use-dashboard';
import { useMarkPayment } from '../../hooks/use-expenses';
import { useSubscription } from '../../hooks/use-subscriptions';
import { usePlanLimits } from '../../hooks/use-plan-limits';
import { useGroupSettlement } from '../../hooks/use-settlement';
import { useCanNudge, useNudgeHistory, useSendNudge } from '../../hooks/use-nudges';
import { BreakdownSkeleton } from '../../components/page-skeleton';
import { EmptyState } from '../../components/empty-state';
import { PageHeader } from '../../components/page-header';
import { PaginationBar, paginate, PAGE_SIZE } from '../../components/pagination';
import { QueryErrorState } from '../../components/query-error-state';

export const Route = createLazyFileRoute('/_app/breakdown')({
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

function NudgeButton({
  groupId,
  toUserId,
  toUserName,
  amount,
  currency,
}: {
  groupId: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  currency?: string;
}) {
  const { data: nudgeStatus } = useCanNudge(groupId, toUserId);
  const sendNudge = useSendNudge(groupId);

  const daysAgoLabel = useMemo(() => {
    if (!nudgeStatus?.lastSentAt) return '';
    const diff = Date.now() - new Date(nudgeStatus.lastSentAt).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Nudge sent today';
    if (days === 1) return 'Nudge sent 1 day ago';
    return `Nudge sent ${days} days ago`;
  }, [nudgeStatus?.lastSentAt]);

  const disabled = nudgeStatus ? !nudgeStatus.allowed : false;

  function handleNudge() {
    const confirmed = window.confirm(
      `Send a gentle reminder to ${toUserName} about their ${formatCurrency(amount, currency)} outstanding balance?`,
    );
    if (!confirmed) return;

    sendNudge.mutate(
      { toUserId, amount },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Reminder sent!',
            message: `${toUserName} has been nudged.`,
            color: 'green',
          });
        },
        onError: (err) => {
          notifications.show({
            title: 'Failed to send reminder',
            message: err instanceof Error ? err.message : 'Something went wrong',
            color: 'red',
          });
        },
      },
    );
  }

  return (
    <Tooltip label={disabled ? daysAgoLabel : `Nudge ${toUserName}`} withArrow>
      <ActionIcon
        variant="subtle"
        color="orange"
        size="sm"
        disabled={disabled}
        loading={sendNudge.isPending}
        onClick={handleNudge}
        aria-label={`Send payment reminder to ${toUserName}`}
      >
        <IconBellRinging size={16} />
      </ActionIcon>
    </Tooltip>
  );
}

function SettlementSection({
  settlement,
  isLoading,
  currency,
  groupId,
  nudgesEnabled,
}: {
  settlement: { transactions: SettlementTransaction[]; transactionCount: number; isSettled: boolean } | undefined;
  isLoading: boolean;
  currency?: string;
  groupId: string;
  nudgesEnabled: boolean;
}) {
  if (isLoading) {
    return (
      <Paper className="commune-soft-panel" p="xl">
        <Group gap="sm" mb="md">
          <ThemeIcon size="lg" variant="light" color="emerald" radius="xl">
            <IconCash size={18} />
          </ThemeIcon>
          <Text fw={700} size="lg">Smart Settlement</Text>
        </Group>
        <Stack gap="sm">
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
        </Stack>
      </Paper>
    );
  }

  if (!settlement) return null;

  return (
    <Paper className="commune-soft-panel" p="xl">
      <Group gap="sm" mb="md">
        <ThemeIcon size="lg" variant="light" color="emerald" radius="xl">
          <IconCash size={18} />
        </ThemeIcon>
        <div>
          <Text fw={700} size="lg">Smart Settlement</Text>
          <Text size="xs" c="dimmed">
            Minimum transactions to settle all debts
          </Text>
        </div>
      </Group>

      {settlement.isSettled ? (
        <Paper p="lg" radius="md" style={{ textAlign: 'center', border: '1px dashed var(--mantine-color-green-3)' }}>
          <Text size="xl" fw={700} c="green">
            All squared away!
          </Text>
          <Text size="sm" c="dimmed" mt={4}>
            No outstanding balances — everyone's settled up.
          </Text>
        </Paper>
      ) : (
        <>
          <Stack gap="sm">
            {settlement.transactions.map((t, i) => (
              <Paper
                key={`${t.fromUserId}-${t.toUserId}-${i}`}
                p="md"
                radius="md"
                withBorder
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                    <Text fw={600} size="sm" truncate>
                      {t.fromUserName}
                    </Text>
                    <IconArrowRight size={16} style={{ flexShrink: 0, color: 'var(--mantine-color-dimmed)' }} />
                    <Text fw={600} size="sm" truncate>
                      {t.toUserName}
                    </Text>
                    <Text fw={700} size="sm" style={{ flexShrink: 0 }}>
                      {formatCurrency(t.amount, currency)}
                    </Text>
                  </Group>
                  <Group gap="xs" wrap="nowrap">
                    {nudgesEnabled && (
                      <NudgeButton
                        groupId={groupId}
                        toUserId={t.fromUserId}
                        toUserName={t.fromUserName ?? 'User'}
                        amount={t.amount}
                        currency={currency}
                      />
                    )}
                    {t.paymentLink ? (
                      <Button
                        component="a"
                        href={t.paymentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="xs"
                        variant="light"
                        color="emerald"
                        leftSection={<IconExternalLink size={14} />}
                      >
                        Pay
                      </Button>
                    ) : (
                      <Badge size="sm" variant="light" color="gray">
                        Payment link not set up yet
                      </Badge>
                    )}
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
          <Text size="sm" c="dimmed" mt="md" ta="center">
            Only {settlement.transactionCount} payment{settlement.transactionCount === 1 ? '' : 's'} needed to settle all debts
          </Text>
        </>
      )}
    </Paper>
  );
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function NudgeHistorySection({
  groupId,
  members,
  currency,
}: {
  groupId: string;
  members: { user_id: string; user: { name: string } }[];
  currency?: string;
}) {
  const [opened, { toggle }] = useDisclosure(false);
  const { data: nudges, isLoading } = useNudgeHistory(groupId);

  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      map.set(m.user_id, m.user?.name ?? 'Unknown');
    }
    return map;
  }, [members]);

  const resolveName = (userId: string) => memberNameMap.get(userId) ?? 'Unknown';

  if (isLoading || !nudges || nudges.length === 0) return null;

  return (
    <Paper className="commune-soft-panel" p="md">
      <Group
        gap="xs"
        onClick={toggle}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <ThemeIcon size="sm" variant="light" color="gray" radius="xl">
          <IconHistory size={14} />
        </ThemeIcon>
        <Text size="sm" fw={600} c="dimmed">
          Nudge History
        </Text>
        {opened ? (
          <IconChevronDown size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
        ) : (
          <IconChevronRight size={14} style={{ color: 'var(--mantine-color-dimmed)' }} />
        )}
        <Badge size="xs" variant="light" color="gray">
          {nudges.length}
        </Badge>
      </Group>

      {opened && (
        <Stack gap={4} mt="sm">
          {nudges.map((n) => (
            <Text key={n.id} size="xs" c="dimmed">
              {resolveName(n.from_user_id)} nudged {resolveName(n.to_user_id)} for{' '}
              {formatCurrency(n.amount, currency)} — {formatRelativeTime(n.sent_at)}
            </Text>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

function BreakdownPage() {
  useEffect(() => {
    setPageTitle('My Breakdown');
  }, []);

  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();
  const {
    data: group,
    error: groupError,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup(activeGroupId ?? '');
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey());
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(0);
  const markPayment = useMarkPayment(activeGroupId ?? '');
  const { data: subscription } = useSubscription(user?.id ?? '');
  const { canDownloadStatements } = usePlanLimits(user?.id ?? '');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const isPaidPlan = canDownloadStatements;

  const isAdmin = group?.members.some(
    (m) => m.user_id === user?.id && m.role === 'admin',
  ) ?? false;

  const { data: breakdown, isLoading } = useUserBreakdown(
    activeGroupId ?? '',
    user?.id ?? '',
    selectedMonth,
  );

  const { data: settlement, isLoading: isSettlementLoading } = useGroupSettlement(
    activeGroupId ?? '',
    selectedMonth,
  );

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  const filteredItems = useMemo(() => {
    if (!breakdown?.items) return [];
    if (!categoryFilter) return breakdown.items;
    return breakdown.items.filter((item) => item.expense.category === categoryFilter);
  }, [breakdown, categoryFilter]);

  const paginatedItems = useMemo(
    () => paginate(filteredItems, page),
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
        title="Select a group first"
        description="Choose a group in the sidebar to see your breakdown."
      />
    );
  }

  if (isGroupError) {
    return (
      <QueryErrorState
        title="Failed to load your breakdown"
        error={groupError}
        onRetry={() => {
          void refetchGroup();
        }}
        icon={IconWallet}
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
            <Tooltip label="Pro feature — upgrade to unlock" withArrow>
              <Button
                variant="default"
                leftSection={<IconDownload size={16} />}
                disabled
                data-disabled
                aria-label="Download PDF statement (upgrade required)"
              >
                Export PDF
              </Button>
            </Tooltip>
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

          <SettlementSection
            settlement={settlement}
            isLoading={isSettlementLoading}
            currency={group?.currency}
            groupId={activeGroupId}
            nudgesEnabled={group?.nudges_enabled ?? true}
          />

          {isAdmin && group?.members && (
            <NudgeHistorySection
              groupId={activeGroupId}
              members={group.members}
              currency={group?.currency}
            />
          )}

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
                        {item.proration && (
                          <Text size="xs" c="dimmed">
                            Prorated: {item.proration.daysPresent}/{item.proration.totalDays} days
                          </Text>
                        )}
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
          <PaginationBar
            page={page}
            totalItems={filteredItems.length}
            onPageChange={setPage}
          />
        </>
      )}
    </Stack>
  );
}
