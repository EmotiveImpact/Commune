import { createLazyFileRoute } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import {
  Avatar,
  Badge,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowRight,
  IconArrowsExchange,
  IconBriefcase,
  IconCash,
  IconCheck,
  IconChevronRight,
  IconExternalLink,
  IconHeart,
  IconHome,
  IconMap,
  IconPuzzle,
  IconTarget,
  IconTrendingUp,
  IconTrendingDown,
  IconBulb,
  IconUsers,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { formatCurrency, formatDate } from '@commune/utils';
import { setPageTitle } from '../../utils/seo';
import { useAuthStore } from '../../stores/auth';
import { useUserGroups } from '../../hooks/use-groups';
import { useCrossGroupSettlements } from '../../hooks/use-cross-group';
import { useSmartNudges } from '../../hooks/use-smart-nudges';
import { useGroupStore } from '../../stores/group';
import { useGroup } from '../../hooks/use-groups';
import { useGroupExpenses } from '../../hooks/use-expenses';
import { getWorkspaceBillingSummary } from '../../hooks/use-dashboard';
import { PageHeader } from '../../components/page-header';
import { EmptyState } from '../../components/empty-state';
import { PageLoader } from '../../components/page-loader';

const GROUP_TYPE_ICONS: Record<string, typeof IconHome> = {
  home: IconHome,
  couple: IconHeart,
  workspace: IconBriefcase,
  project: IconPuzzle,
  trip: IconMap,
  other: IconUsers,
};

const NETTING_STORAGE_KEY = 'commune-cross-group-netting';

function readNettingPreference(): boolean {
  try {
    const stored = localStorage.getItem(NETTING_STORAGE_KEY);
    if (stored === null) return true; // default: enabled
    return stored === 'true';
  } catch {
    return true;
  }
}

function formatCurrencyBreakdown(
  totals: Map<string, number>,
  fallbackCurrency = 'GBP',
): string {
  if (totals.size === 0) {
    return formatCurrency(0, fallbackCurrency);
  }

  return Array.from(totals.entries())
    .map(([currency, amount]) => formatCurrency(amount, currency))
    .join(' + ');
}

export const Route = createLazyFileRoute('/_app/overview')({
  component: CrossGroupOverviewPage,
});

function CrossGroupOverviewPage() {
  useEffect(() => {
    setPageTitle('Command Centre');
  }, []);

  const { user } = useAuthStore();
  const { data: groups } = useUserGroups();
  const { data: smartNudges } = useSmartNudges(user?.id ?? '');
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { data: result, isLoading } = useCrossGroupSettlements(user?.id ?? '');
  const { data: activeGroup } = useGroup(activeGroupId ?? '');
  const workspaceExpenseGroupId = activeGroup?.type === 'workspace' ? activeGroupId ?? '' : '';
  const { data: workspaceExpenses = [] } = useGroupExpenses(workspaceExpenseGroupId);

  const [nettingEnabled, setNettingEnabled] = useState(readNettingPreference);

  const handleNettingToggle = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.currentTarget.checked;
    setNettingEnabled(checked);
    try {
      localStorage.setItem(NETTING_STORAGE_KEY, String(checked));
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  if (isLoading) {
    return <PageLoader />;
  }

  const workspaceBillingSummary = getWorkspaceBillingSummary(workspaceExpenses);
  const showWorkspaceBillingWatch =
    activeGroup?.type === 'workspace' && workspaceBillingSummary.expenseCount > 0;

  // Build group status map from perGroupData
  const groupStatusMap = new Map<string, { owes: number; owed: number; currency: string; waiting: number }>();
  for (const pg of result?.perGroupData ?? []) {
    let owes = 0;
    let owed = 0;
    let waiting = 0;
    for (const tx of pg.settlement.transactions) {
      if (tx.fromUserId === user?.id) owes += tx.amount;
      if (tx.toUserId === user?.id) { owed += tx.amount; waiting++; }
    }
    groupStatusMap.set(pg.groupId, { owes, owed, currency: pg.currency, waiting });
  }

  if (!result || result.isSettled) {
    return (
      <Stack gap="lg">
        <PageHeader
          title="Command Centre"
          subtitle="Your priorities across all groups"
        />

        {/* My Groups (always shown) */}
        {groups && groups.length > 0 && (
          <Stack gap="md">
            <Group gap="xs">
              <IconTarget size={18} />
              <Text className="commune-section-heading">My Groups</Text>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
              {groups.map((g) => {
                const GIcon = GROUP_TYPE_ICONS[g.type] ?? IconUsers;
                return (
                  <Paper key={g.id} className="commune-stat-card" p="md" radius="lg" component={Link} to={`/groups/${g.id}`} style={{ textDecoration: 'none', cursor: 'pointer' }}>
                    <Group justify="space-between" align="center">
                      <Group gap="sm">
                        <Avatar size={36} radius="xl" src={g.avatar_url} color="commune"><GIcon size={18} /></Avatar>
                        <Text fw={600} size="sm">{g.name}</Text>
                      </Group>
                      <Badge size="sm" variant="dot" color="green">Settled</Badge>
                    </Group>
                  </Paper>
                );
              })}
            </SimpleGrid>
          </Stack>
        )}

        <EmptyState
          icon={IconCheck}
          iconColor="emerald"
          title="All squared away!"
          description="No outstanding balances across any of your groups."
        />
      </Stack>
    );
  }

  // Separate into what you owe vs what others owe you
  const youOwe = result.transactions.filter((tx) => tx.fromUserId === user?.id);
  const owedToYou = result.transactions.filter((tx) => tx.toUserId === user?.id);
  const otherTransactions = result.transactions.filter(
    (tx) => tx.fromUserId !== user?.id && tx.toUserId !== user?.id,
  );

  const nettedYouOweTotals = youOwe.reduce((totals, tx) => {
    totals.set(tx.currency, (totals.get(tx.currency) ?? 0) + tx.netAmount);
    return totals;
  }, new Map<string, number>());

  const nettedOwedToYouTotals = owedToYou.reduce((totals, tx) => {
    totals.set(tx.currency, (totals.get(tx.currency) ?? 0) + tx.netAmount);
    return totals;
  }, new Map<string, number>());

  const perGroupYouOweTotals = (result.perGroupData ?? []).reduce((totals, group) => {
    const groupAmount = group.settlement.transactions
      .filter((tx) => tx.fromUserId === user?.id)
      .reduce((sum, tx) => sum + tx.amount, 0);

    if (groupAmount > 0) {
      totals.set(group.currency, (totals.get(group.currency) ?? 0) + groupAmount);
    }

    return totals;
  }, new Map<string, number>());

  const perGroupOwedToYouTotals = (result.perGroupData ?? []).reduce((totals, group) => {
    const groupAmount = group.settlement.transactions
      .filter((tx) => tx.toUserId === user?.id)
      .reduce((sum, tx) => sum + tx.amount, 0);

    if (groupAmount > 0) {
      totals.set(group.currency, (totals.get(group.currency) ?? 0) + groupAmount);
    }

    return totals;
  }, new Map<string, number>());

  return (
    <Stack gap="lg">
      <PageHeader
        title="Command Centre"
        subtitle="Your priorities across all groups"
      />

      {/* Smart Nudges */}
      {smartNudges && smartNudges.length > 0 && (
        <Paper className="commune-soft-panel" p="md">
          <Group gap="xs" mb="sm">
            <IconBulb size={18} color="var(--mantine-color-yellow-6)" />
            <Text fw={700} size="sm">Insights</Text>
          </Group>
          <Stack gap="xs">
            {smartNudges.map((nudge: any) => {
              const NudgeIcon = nudge.type === 'spending_increase' ? IconTrendingUp
                : nudge.type === 'spending_decrease' ? IconTrendingDown
                : nudge.type === 'budget_warning' ? IconAlertTriangle
                : nudge.type === 'upcoming_due' ? IconCash
                : nudge.type === 'unpaid_expense' ? IconAlertTriangle
                : IconUsers;
              const nudgeColor = nudge.color ?? 'gray';
              return (
                <Group key={nudge.id} gap="sm" wrap="nowrap">
                  <ThemeIcon size={28} variant="light" color={nudgeColor} radius="xl">
                    <NudgeIcon size={14} />
                  </ThemeIcon>
                  <Stack gap={0} style={{ flex: 1 }}>
                    <Text size="sm" fw={600}>{nudge.title}</Text>
                    <Text size="xs" c="dimmed">{nudge.description}</Text>
                  </Stack>
                  {nudge.groupName && (
                    <Badge size="xs" variant="light" color="gray">{nudge.groupName}</Badge>
                  )}
                </Group>
              );
            })}
          </Stack>
        </Paper>
      )}

      {showWorkspaceBillingWatch && (
        <Paper className="commune-soft-panel" p="xl">
          <Group justify="space-between" align="flex-start" mb="md">
            <div>
              <Text className="commune-section-heading">Shared subscriptions &amp; tools</Text>
              <Text size="sm" c="dimmed">
                {activeGroup?.name ?? 'This workspace'} bills, invoice refs, due dates, recurring subscriptions, and shared tool costs.
              </Text>
            </div>
            <Group gap="xs">
              <Badge variant="light" color="indigo">
                {workspaceBillingSummary.expenseCount} tracked
              </Badge>
              {workspaceBillingSummary.sharedSubscriptionCount > 0 && (
                <Badge variant="light" color="violet">
                  {workspaceBillingSummary.sharedSubscriptionCount} subscriptions
                </Badge>
              )}
              <Badge variant="light" color="teal">
                {workspaceBillingSummary.toolCostCount} work tools
              </Badge>
            </Group>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Paper className="commune-stat-card" p="md" radius="lg">
              <Text size="xs" c="dimmed">Tracked bills</Text>
              <Text fw={700} size="lg">
                {workspaceBillingSummary.expenseCount}
              </Text>
            </Paper>
            <Paper className="commune-stat-card" p="md" radius="lg">
              <Text size="xs" c="dimmed">Work tools spend</Text>
              <Text fw={700} size="lg">
                {formatCurrency(workspaceBillingSummary.toolCostSpend, activeGroup?.currency)}
              </Text>
            </Paper>
            <Paper className="commune-stat-card" p="md" radius="lg">
              <Text size="xs" c="dimmed">Due soon</Text>
              <Text fw={700} size="lg">
                {workspaceBillingSummary.dueSoonCount}
              </Text>
            </Paper>
            <Paper className="commune-stat-card" p="md" radius="lg">
              <Text size="xs" c="dimmed">Overdue</Text>
              <Text fw={700} size="lg" c={workspaceBillingSummary.overdueCount > 0 ? 'red' : undefined}>
                {workspaceBillingSummary.overdueCount}
              </Text>
            </Paper>
            <Paper className="commune-stat-card" p="md" radius="lg">
              <Text size="xs" c="dimmed">Top vendor</Text>
              <Text fw={700} size="sm">
                {workspaceBillingSummary.topVendor?.vendor_name || 'No vendor named yet'}
              </Text>
              {workspaceBillingSummary.topVendor ? (
                <Text size="xs" c="dimmed">
                  {workspaceBillingSummary.topVendor.count} bill{workspaceBillingSummary.topVendor.count !== 1 ? 's' : ''} · {formatCurrency(workspaceBillingSummary.topVendor.amount, activeGroup?.currency)}
                </Text>
              ) : null}
            </Paper>
            <Paper className="commune-stat-card" p="md" radius="lg">
              <Text size="xs" c="dimmed">Tracked spend</Text>
              <Text fw={700} size="lg">
                {formatCurrency(workspaceBillingSummary.totalSpend, activeGroup?.currency)}
              </Text>
            </Paper>
          </SimpleGrid>

          <Stack gap="sm" mt="lg">
            {workspaceBillingSummary.nextDueBill && (
              <Paper className="commune-stat-card" p="md" radius="lg">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={2}>
                    <Group gap="xs" wrap="nowrap">
                      <Text fw={700}>{workspaceBillingSummary.nextDueBill.vendor_name || workspaceBillingSummary.nextDueBill.title}</Text>
                      {workspaceBillingSummary.nextDueBill.recurrence_type && workspaceBillingSummary.nextDueBill.recurrence_type !== 'none' && (
                        <Badge size="xs" variant="light" color="violet">
                          Subscription
                        </Badge>
                      )}
                      {workspaceBillingSummary.nextDueBill.category === 'work_tools' && (
                        <Badge size="xs" variant="light" color="teal">
                          Tool cost
                        </Badge>
                      )}
                    </Group>
                    <Text size="sm" c="dimmed">
                      {workspaceBillingSummary.nextDueBill.invoice_reference
                        ? `Ref ${workspaceBillingSummary.nextDueBill.invoice_reference}`
                        : 'No invoice reference yet'}
                    </Text>
                  </Stack>
                  <Stack gap={2} align="flex-end">
                    <Text fw={700}>
                      {formatCurrency(workspaceBillingSummary.nextDueBill.amount, workspaceBillingSummary.nextDueBill.currency)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Due {formatDate(workspaceBillingSummary.nextDueBill.payment_due_date || workspaceBillingSummary.nextDueBill.due_date)}
                    </Text>
                  </Stack>
                </Group>
              </Paper>
            )}
            {workspaceBillingSummary.latestBill && (
              <Paper className="commune-stat-card" p="md" radius="lg">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={2}>
                    <Group gap="xs">
                      <Text fw={700}>Latest invoice</Text>
                      {workspaceBillingSummary.latestBill.recurrence_type && workspaceBillingSummary.latestBill.recurrence_type !== 'none' && (
                        <Badge size="xs" variant="light" color="violet">
                          Subscription
                        </Badge>
                      )}
                      {workspaceBillingSummary.latestBill.category === 'work_tools' && (
                        <Badge size="xs" variant="light" color="teal">
                          Tool cost
                        </Badge>
                      )}
                    </Group>
                    <Text size="sm" c="dimmed">
                      {workspaceBillingSummary.latestBill.vendor_name || workspaceBillingSummary.latestBill.title}
                    </Text>
                  </Stack>
                  <Stack gap={2} align="flex-end">
                    <Text fw={700}>
                      {workspaceBillingSummary.latestBill.invoice_reference || 'No reference'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {workspaceBillingSummary.latestBill.invoice_date
                        ? `Issued ${formatDate(workspaceBillingSummary.latestBill.invoice_date)}`
                        : `Due ${formatDate(workspaceBillingSummary.latestBill.due_date)}`}
                    </Text>
                  </Stack>
                </Group>
              </Paper>
            )}
          </Stack>
        </Paper>
      )}

      {/* Next 3 Actions */}
      {youOwe.length > 0 && (
        <Paper className="commune-soft-panel" p="lg" style={{ borderLeft: '4px solid var(--mantine-color-red-5)' }}>
          <Group gap="xs" mb="sm">
            <IconAlertTriangle size={18} color="var(--mantine-color-red-6)" />
            <Text fw={700} size="sm">Priority Actions</Text>
          </Group>
          <Stack gap="xs">
            {youOwe.slice(0, 3).map((tx) => (
              <Group key={`action-${tx.toUserId}-${tx.currency}`} justify="space-between" align="center">
                <Group gap="xs">
                  <Badge size="xs" variant="light" color="gray">{tx.groups[0]}</Badge>
                  <Text size="sm">Pay <Text span fw={600}>{tx.toName}</Text></Text>
                </Group>
                <Group gap="sm">
                  <Text fw={700} size="sm" c="red">{formatCurrency(tx.netAmount, tx.currency)}</Text>
                  {tx.paymentLink && (
                    <Button component="a" href={tx.paymentLink} target="_blank" size="compact-xs" variant="light" rightSection={<IconChevronRight size={12} />}>
                      Pay
                    </Button>
                  )}
                </Group>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}

      {/* My Groups with status pills */}
      {groups && groups.length > 0 && (
        <Stack gap="md">
          <Group gap="xs">
            <IconTarget size={18} />
            <Text className="commune-section-heading">My Groups</Text>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
            {groups.map((g) => {
              const GIcon = GROUP_TYPE_ICONS[g.type] ?? IconUsers;
              const status = groupStatusMap.get(g.id);
              let statusBadge;
              if (!status || (status.owes === 0 && status.owed === 0)) {
                statusBadge = <Badge size="sm" variant="dot" color="green">Settled</Badge>;
              } else if (status.owes > 0) {
                statusBadge = <Badge size="sm" variant="dot" color="red">{formatCurrency(status.owes, status.currency)} outstanding</Badge>;
              } else if (status.waiting > 0) {
                statusBadge = <Badge size="sm" variant="dot" color="orange">Waiting on {status.waiting}</Badge>;
              }
              return (
                <Paper key={g.id} className="commune-stat-card" p="md" radius="lg" component={Link} to={`/groups/${g.id}`} style={{ textDecoration: 'none', cursor: 'pointer' }}>
                  <Group justify="space-between" align="center">
                    <Group gap="sm">
                      <Avatar size={36} radius="xl" src={g.avatar_url} color="commune"><GIcon size={18} /></Avatar>
                      <Text fw={600} size="sm">{g.name}</Text>
                    </Group>
                    {statusBadge}
                  </Group>
                </Paper>
              );
            })}
          </SimpleGrid>
        </Stack>
      )}

      {/* Netting toggle */}
      <Paper className="commune-soft-panel" p="md">
        <Switch
          label="Cross-group netting"
          description="Combine debts across groups to minimise payments"
          checked={nettingEnabled}
          onChange={handleNettingToggle}
        />
      </Paper>

      {nettingEnabled ? (
        /* ── Netted view (existing) ──────────────────────────────────────── */
        <>
          {/* Summary cards */}
          <Group gap="lg">
            <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="peach" style={{ flex: 1 }}>
              <Text size="sm" c="dimmed">Outstanding</Text>
              <Text fw={800} size="1.5rem">
                {formatCurrencyBreakdown(
                  nettedYouOweTotals,
                  result.transactions[0]?.currency ?? 'GBP',
                )}
              </Text>
              <Text size="xs" c="dimmed">
                {youOwe.length} payment{youOwe.length !== 1 ? 's' : ''} to make
              </Text>
            </Paper>

            <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="sage" style={{ flex: 1 }}>
              <Text size="sm" c="dimmed">Coming your way</Text>
              <Text fw={800} size="1.5rem">
                {formatCurrencyBreakdown(
                  nettedOwedToYouTotals,
                  result.transactions[0]?.currency ?? 'GBP',
                )}
              </Text>
              <Text size="xs" c="dimmed">
                {owedToYou.length} payment{owedToYou.length !== 1 ? 's' : ''} incoming
              </Text>
            </Paper>
          </Group>

          {/* You owe */}
          {youOwe.length > 0 && (
            <Paper className="commune-soft-panel" p="xl">
              <Text className="commune-section-heading" mb="xs">Outstanding</Text>
              <Text size="sm" c="dimmed" mb="lg">
                These debts have been netted across groups. One transfer per person settles everything.
              </Text>
              <Stack gap="sm">
                {youOwe.map((tx) => (
                  <Paper key={`${tx.toUserId}-${tx.currency}`} className="commune-stat-card" p="md" radius="lg">
                    <Group justify="space-between" align="center">
                      <Stack gap={4}>
                        <Group gap="xs">
                          <IconArrowRight size={16} color="var(--mantine-color-red-6)" />
                          <Text fw={600}>{tx.toName}</Text>
                        </Group>
                        <Group gap={4}>
                          {tx.groups.map((g) => (
                            <Badge key={g} size="xs" variant="light" color="gray">{g}</Badge>
                          ))}
                        </Group>
                      </Stack>

                      <Group gap="sm">
                        <Text fw={700} size="lg" c="red">
                          {formatCurrency(tx.netAmount, tx.currency)}
                        </Text>
                        {tx.paymentLink && (
                          <Tooltip label={`Pay via ${tx.paymentProvider ?? 'link'}`}>
                            <Button
                              component="a"
                              href={tx.paymentLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              size="xs"
                              variant="light"
                              leftSection={<IconExternalLink size={14} />}
                            >
                              Pay
                            </Button>
                          </Tooltip>
                        )}
                      </Group>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          )}

          {/* Owed to you */}
          {owedToYou.length > 0 && (
            <Paper className="commune-soft-panel" p="xl">
              <Text className="commune-section-heading" mb="xs">Coming your way</Text>
              <Text size="sm" c="dimmed" mb="lg">
                People who owe you money across your groups.
              </Text>
              <Stack gap="sm">
                {owedToYou.map((tx) => (
                  <Paper key={`${tx.fromUserId}-${tx.currency}`} className="commune-stat-card" p="md" radius="lg">
                    <Group justify="space-between" align="center">
                      <Stack gap={4}>
                        <Group gap="xs">
                          <ThemeIcon size={20} variant="light" color="green" radius="xl">
                            <IconCash size={12} />
                          </ThemeIcon>
                          <Text fw={600}>{tx.fromName}</Text>
                        </Group>
                        <Group gap={4}>
                          {tx.groups.map((g) => (
                            <Badge key={g} size="xs" variant="light" color="gray">{g}</Badge>
                          ))}
                        </Group>
                      </Stack>
                      <Text fw={700} size="lg" c="green">
                        {formatCurrency(tx.netAmount, tx.currency)}
                      </Text>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          )}

          {/* Other transactions (not involving the current user) */}
          {otherTransactions.length > 0 && (
            <Paper className="commune-soft-panel" p="xl">
              <Text className="commune-section-heading" mb="xs">Other balances</Text>
              <Text size="sm" c="dimmed" mb="lg">
                Cross-group debts between other members in your groups.
              </Text>
              <Stack gap="sm">
                {otherTransactions.map((tx) => (
                  <Paper key={`${tx.fromUserId}-${tx.toUserId}-${tx.currency}`} className="commune-stat-card" p="md" radius="lg">
                    <Group justify="space-between" align="center">
                      <Stack gap={4}>
                        <Text size="sm">
                          <Text span fw={600}>{tx.fromName}</Text>
                          {' owes '}
                          <Text span fw={600}>{tx.toName}</Text>
                        </Text>
                        <Group gap={4}>
                          {tx.groups.map((g) => (
                            <Badge key={g} size="xs" variant="light" color="gray">{g}</Badge>
                          ))}
                        </Group>
                      </Stack>
                      <Text fw={600} c="dimmed">
                        {formatCurrency(tx.netAmount, tx.currency)}
                      </Text>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          )}
        </>
      ) : (
        /* ── Per-group view (un-netted) ──────────────────────────────────── */
        <>
          {/* Per-group summary */}
          <Group gap="lg">
            <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="peach" style={{ flex: 1 }}>
              <Text size="sm" c="dimmed">Total you owe</Text>
              <Text fw={800} size="1.5rem">
                {formatCurrencyBreakdown(
                  perGroupYouOweTotals,
                  result.perGroupData?.[0]?.currency ?? 'GBP',
                )}
              </Text>
            </Paper>
            <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="sage" style={{ flex: 1 }}>
              <Text size="sm" c="dimmed">Total owed to you</Text>
              <Text fw={800} size="1.5rem">
                {formatCurrencyBreakdown(
                  perGroupOwedToYouTotals,
                  result.perGroupData?.[0]?.currency ?? 'GBP',
                )}
              </Text>
            </Paper>
          </Group>

          {(result.perGroupData ?? []).map((group) => {
            const GroupIcon = GROUP_TYPE_ICONS[group.groupType] ?? IconUsers;
            return (
            <Paper key={group.groupId} className="commune-soft-panel" p="xl">
              <Group gap="xs" mb="xs">
                <ThemeIcon size={24} variant="light" color="gray" radius="xl">
                  <GroupIcon size={14} />
                </ThemeIcon>
                <Text className="commune-section-heading">{group.groupName}</Text>
              </Group>
              <Text size="sm" c="dimmed" mb="lg">
                {group.settlement.transactionCount} settlement{group.settlement.transactionCount !== 1 ? 's' : ''} in {group.currency}
              </Text>
              <Stack gap="sm">
                {group.settlement.transactions.map((tx) => (
                  <Paper
                    key={`${tx.fromUserId}-${tx.toUserId}`}
                    className="commune-stat-card"
                    p="md"
                    radius="lg"
                  >
                    <Group justify="space-between" align="center">
                      <Stack gap={4}>
                        <Group gap="xs">
                          {tx.fromUserId === user?.id ? (
                            <IconArrowRight size={16} color="var(--mantine-color-red-6)" />
                          ) : tx.toUserId === user?.id ? (
                            <ThemeIcon size={20} variant="light" color="green" radius="xl">
                              <IconCash size={12} />
                            </ThemeIcon>
                          ) : null}
                          <Text size="sm">
                            <Text span fw={600}>{tx.fromUserName ?? tx.fromUserId}</Text>
                            {' owes '}
                            <Text span fw={600}>{tx.toUserName ?? tx.toUserId}</Text>
                          </Text>
                        </Group>
                      </Stack>
                      <Text
                        fw={700}
                        size="lg"
                        c={
                          tx.fromUserId === user?.id
                            ? 'red'
                            : tx.toUserId === user?.id
                              ? 'green'
                              : 'dimmed'
                        }
                      >
                        {formatCurrency(tx.amount, group.currency)}
                      </Text>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Paper>
            );
          })}

          {(result.perGroupData ?? []).length === 0 && (
            <EmptyState
              icon={IconArrowsExchange}
              iconColor="emerald"
              title="No per-group settlements"
              description="There are no outstanding settlements in any of your groups."
            />
          )}
        </>
      )}
    </Stack>
  );
}
