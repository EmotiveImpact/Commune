import { createLazyFileRoute } from '@tanstack/react-router';
import { PaginationBar, PAGE_SIZE } from '../../components/pagination';
import {
  Avatar,
  Badge,
  Button,
  Grid,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconActivity,
  IconCash,
  IconChecklist,
  IconCreditCard,
  IconDownload,
  IconHistory,
  IconReceipt,
  IconTrash,
  IconUserCheck,
  IconUserMinus,
  IconUserPlus,
  IconSettings,
  IconArrowsTransferDown,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { setPageTitle } from '../../utils/seo';
import { formatCurrency, formatDate } from '@commune/utils';
import type { ActivityEntry } from '@commune/api';
import { useGroupStore } from '../../stores/group';
import { useAuthStore } from '../../stores/auth';
import { useGroup } from '../../hooks/use-groups';
import { useGroupExpenses } from '../../hooks/use-expenses';
import { usePlanLimits } from '../../hooks/use-plan-limits';
import {
  getActivityWorkspaceBillingContext,
  hasActivityWorkspaceBillingContext,
  useActivityLog,
} from '../../hooks/use-activity';
import { getWorkspaceBillingSummary } from '../../hooks/use-dashboard';
import { ActivitySkeleton } from '../../components/page-skeleton';
import { EmptyState } from '../../components/empty-state';
import { PageHeader } from '../../components/page-header';
import { generateActivityCSV, downloadCSV } from '../../utils/export-csv';

export const Route = createLazyFileRoute('/_app/activity')({
  component: ActivityPage,
});

const actionIcons: Record<string, typeof IconReceipt> = {
  expense_created: IconReceipt,
  expense_updated: IconSettings,
  expense_deleted: IconTrash,
  payment_marked: IconCash,
  payment_confirmed: IconCreditCard,
  member_invited: IconUserPlus,
  member_joined: IconUserCheck,
  member_left: IconUserMinus,
  member_removed: IconUserMinus,
  group_updated: IconSettings,
  ownership_transferred: IconArrowsTransferDown,
  chore_completed: IconChecklist,
};

const actionColors: Record<string, string> = {
  expense_created: 'emerald',
  expense_updated: 'blue',
  expense_deleted: 'red',
  payment_marked: 'orange',
  payment_confirmed: 'green',
  member_invited: 'violet',
  member_joined: 'teal',
  member_left: 'gray',
  member_removed: 'red',
  group_updated: 'blue',
  ownership_transferred: 'indigo',
  chore_completed: 'teal',
};

function describeAction(entry: ActivityEntry): string {
  const meta = entry.metadata as Record<string, string | number | undefined>;
  const actorName = entry.user?.name ?? 'Someone';
  const billingContext = getActivityWorkspaceBillingContext(entry);
  const billingLabel =
    billingContext.vendor_name || billingContext.invoice_reference
      ? `${billingContext.vendor_name || 'a vendor'}${billingContext.invoice_reference ? ` · Ref ${billingContext.invoice_reference}` : ''}`
      : '';

  switch (entry.action) {
    case 'expense_created':
      return `${actorName} created expense '${meta.title ?? 'Untitled'}'${billingLabel ? ` for ${billingLabel}` : ''}`;
    case 'expense_updated': {
      const changes = (entry.metadata as any)?.changes as Record<string, { from: any; to: any }> | undefined;
      if (changes) {
        const parts: string[] = [];
        if (changes.amount) parts.push(`amount ${changes.amount.from} → ${changes.amount.to}`);
        if (changes.title) parts.push(`title → '${changes.title.to}'`);
        if (changes.category) parts.push(`category → ${changes.category.to}`);
        if (changes.due_date) parts.push(`due date → ${changes.due_date.to}`);
        if (changes.approval_status) parts.push(`${changes.approval_status.to}`);
        if (parts.length > 0) {
          return `${actorName} updated '${meta.title ?? 'Untitled'}' — ${parts.join(', ')}`;
        }
      }
      return `${actorName} updated expense '${meta.title ?? 'Untitled'}'${billingLabel ? ` · ${billingLabel}` : ''}`;
    }
    case 'expense_deleted':
      return `${actorName} archived expense '${meta.title ?? 'Untitled'}'`;
    case 'payment_marked':
      return `${actorName} marked a payment on '${meta.expense_title ?? 'an expense'}'`;
    case 'payment_confirmed':
      return `${actorName} confirmed a payment on '${meta.expense_title ?? 'an expense'}'`;
    case 'member_invited':
      return `${actorName} invited ${meta.member_name ?? 'a member'} to the group`;
    case 'member_joined':
      return `${meta.member_name ?? actorName} joined the group`;
    case 'member_left':
      return `${meta.member_name ?? actorName} left the group`;
    case 'member_removed':
      return `${actorName} removed ${meta.member_name ?? 'a member'} from the group`;
    case 'group_updated':
      return `${actorName} updated the group settings`;
    case 'ownership_transferred':
      return `${actorName} transferred group ownership to ${meta.new_owner_name ?? 'another member'}`;
    case 'chore_completed':
      return `${actorName} completed chore '${meta.chore_title ?? 'a task'}'`;
    default:
      return `${actorName} performed an action`;
  }
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    .toISOString()
    .slice(0, 10);
  const dateKey = date.toISOString().slice(0, 10);

  if (dateKey === today) return 'Today';
  if (dateKey === yesterday) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

type TypeFilter = 'all' | 'expense' | 'payment' | 'member' | 'chore';

function ActivityPage() {
  useEffect(() => {
    setPageTitle('Activity');
  }, []);

  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();
  const { canExport } = usePlanLimits(user?.id ?? '');
  const { data: group, isLoading: groupLoading } = useGroup(activeGroupId ?? '');
  const workspaceExpenseGroupId = group?.type === 'workspace' ? activeGroupId ?? '' : '';
  const { data: workspaceExpenses = [] } = useGroupExpenses(workspaceExpenseGroupId);
  const [page, setPage] = useState(0);
  const [activeFilters, setActiveFilters] = useState<Set<TypeFilter>>(new Set(['all']));
  const { data: entries = [], isLoading } = useActivityLog(activeGroupId ?? '');

  function toggleFilter(key: TypeFilter) {
    setPage(0);
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (key === 'all') {
        return new Set(['all']);
      }
      next.delete('all');
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      if (next.size === 0) {
        return new Set(['all']);
      }
      return next;
    });
  }

  const filteredEntries = useMemo(() => {
    if (activeFilters.has('all')) return entries;
    return entries.filter((e) => {
      const type = e.entity_type;
      if (!type) return false;
      return activeFilters.has(type as TypeFilter);
    });
  }, [entries, activeFilters]);

  const paginatedEntries = useMemo(
    () => filteredEntries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredEntries, page],
  );

  const grouped = useMemo(() => {
    const groups: { label: string; items: typeof paginatedEntries }[] = [];
    let currentLabel = '';

    for (const entry of paginatedEntries) {
      const label = getDateLabel(entry.created_at);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, items: [] });
      }
      groups[groups.length - 1]!.items.push(entry);
    }

    return groups;
  }, [paginatedEntries]);

  const workspaceBillingSummary = getWorkspaceBillingSummary(workspaceExpenses);
  const showWorkspaceBillingWatch = group?.type === 'workspace' && workspaceBillingSummary.expenseCount > 0;

  // Compute sidebar stats — MUST be before early returns (React hooks rules)
  const activityStats = useMemo(() => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonthEntries = entries.filter((e) => e.created_at.startsWith(thisMonth));
    const byMember = new Map<string, number>();
    for (const e of thisMonthEntries) {
      byMember.set(e.user_id, (byMember.get(e.user_id) ?? 0) + 1);
    }
    let mostActiveName = '';
    let mostActiveCount = 0;
    for (const [uid, count] of byMember) {
      if (count > mostActiveCount) {
        mostActiveCount = count;
        const member = group?.members?.find((m: any) => m.user_id === uid);
        mostActiveName = member?.user?.name ?? member?.user?.email ?? 'Unknown';
      }
    }
    const byType = new Map<string, number>();
    for (const e of thisMonthEntries) {
      byType.set(e.entity_type ?? 'other', (byType.get(e.entity_type ?? 'other') ?? 0) + 1);
    }
    return { total: entries.length, thisMonth: thisMonthEntries.length, mostActiveName, mostActiveCount, byType };
  }, [entries, group]);

  if (!activeGroupId) {
    return (
      <EmptyState
        icon={IconHistory}
        iconColor="emerald"
        title="Select a group first"
        description="Choose a group in the sidebar to view its activity log."
      />
    );
  }

  if (isLoading || groupLoading) {
    return <ActivitySkeleton />;
  }

  const filterChips: { key: TypeFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'expense', label: 'Expenses' },
    { key: 'payment', label: 'Payments' },
    { key: 'member', label: 'Members' },
    { key: 'chore', label: 'Chores' },
  ];

  return (
    <Stack gap="lg">
      <PageHeader
        title="Activity"
        subtitle={`Everything that happened in ${group?.name ?? 'this group'}`}
      >
        {canExport ? (
          <Button
            variant="default"
            leftSection={<IconDownload size={16} />}
            disabled={filteredEntries.length === 0}
            onClick={() => {
              const csv = generateActivityCSV(filteredEntries);
              const dateStr = new Date().toISOString().slice(0, 10);
              downloadCSV(csv, `commune-activity-${group?.name ?? 'group'}-${dateStr}.csv`);
              notifications.show({
                title: 'Exported',
                message: `${filteredEntries.length} activity entries downloaded.`,
                color: 'green',
              });
            }}
          >
            Export CSV
          </Button>
        ) : (
          <Tooltip label="Pro feature — upgrade to unlock" withArrow>
            <Button
              variant="default"
              leftSection={<IconDownload size={16} />}
              disabled
              data-disabled
            >
              Export CSV
            </Button>
          </Tooltip>
        )}
      </PageHeader>

      <div className="commune-filter-chips">
        {filterChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className="commune-filter-chip"
            data-active={activeFilters.has(chip.key)}
            onClick={() => toggleFilter(chip.key)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <Grid gap="lg">
        {/* Left column — context sidebar (1/3 width) */}
        <Grid.Col span={{ base: 12, md: 4 }}>
        <Stack gap="lg">
          <Paper className="commune-soft-panel" p="lg" radius="lg">
            <Text className="commune-section-heading" mb="sm">This month</Text>
            <SimpleGrid cols={2} spacing="sm">
              <Paper className="commune-stat-card" p="sm" radius="md">
                <Text size="xs" c="dimmed">Events</Text>
                <Text fw={700} size="lg">{activityStats.thisMonth}</Text>
              </Paper>
              <Paper className="commune-stat-card" p="sm" radius="md">
                <Text size="xs" c="dimmed">All time</Text>
                <Text fw={700} size="lg">{activityStats.total}</Text>
              </Paper>
            </SimpleGrid>
            {activityStats.mostActiveName && (
              <Group mt="sm" gap="xs">
                <Text size="xs" c="dimmed">Most active:</Text>
                <Badge size="sm" variant="light" color="green">{activityStats.mostActiveName}</Badge>
                <Text size="xs" c="dimmed">({activityStats.mostActiveCount})</Text>
              </Group>
            )}
          </Paper>

          <Paper className="commune-soft-panel" p="lg" radius="lg">
            <Text className="commune-section-heading" mb="sm">By type</Text>
            <Stack gap="xs">
              {Array.from(activityStats.byType.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <Group key={type} justify="space-between">
                    <Text size="sm" tt="capitalize">{type.replace('_', ' ')}</Text>
                    <Badge size="sm" variant="light" color="gray">{count}</Badge>
                  </Group>
                ))}
              {activityStats.byType.size === 0 && (
                <Text size="sm" c="dimmed">No activity this month</Text>
              )}
            </Stack>
          </Paper>

          <Paper className="commune-soft-panel" p="lg" radius="lg">
            <Text className="commune-section-heading" mb="sm">Members</Text>
            <Stack gap="xs">
              {(group?.members ?? [])
                .filter((m: any) => m.status === 'active')
                .slice(0, 6)
                .map((m: any) => (
                  <Group key={m.user_id} gap="xs">
                    <Avatar src={m.user?.avatar_url} name={m.user?.name} color="initials" size="sm" radius="xl" />
                    <Text size="sm" style={{ flex: 1 }} truncate>{m.user?.name ?? m.user?.email}</Text>
                    {m.role === 'admin' && <Badge size="xs" variant="light" color="blue">Admin</Badge>}
                  </Group>
                ))}
            </Stack>
          </Paper>
        </Stack>
        </Grid.Col>

        {/* Right column — activity feed (2/3 width) */}
        <Grid.Col span={{ base: 12, md: 8 }}>
        <Stack gap="lg">

      {showWorkspaceBillingWatch && (
        <Paper className="commune-soft-panel" p="xl">
          <Group justify="space-between" align="flex-start" mb="md">
            <div>
              <Text className="commune-section-heading">Shared subscriptions &amp; tools</Text>
              <Text size="sm" c="dimmed">
                Recent invoice refs, due dates, recurring subscriptions, and tool costs for {group?.name ?? 'this workspace'}.
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

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="md">
            <Paper className="commune-stat-card" p="md" radius="lg">
              <Text size="xs" c="dimmed">Tracked bills</Text>
              <Text fw={700} size="lg">
                {workspaceBillingSummary.expenseCount}
              </Text>
            </Paper>
            <Paper className="commune-stat-card" p="md" radius="lg">
              <Text size="xs" c="dimmed">Work tools spend</Text>
              <Text fw={700} size="lg">
                {formatCurrency(workspaceBillingSummary.toolCostSpend, group?.currency)}
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
          </SimpleGrid>

          <Stack gap="sm">
            {workspaceBillingSummary.nextDueBill && (
              <Paper className="commune-stat-card" p="md" radius="lg">
                <Group justify="space-between" align="flex-start">
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

            {workspaceBillingSummary.upcomingBills.length > 1 && (
              <Stack gap="xs">
                <Text size="xs" c="dimmed">
                  More due next
                </Text>
                {workspaceBillingSummary.upcomingBills.slice(1, 3).map((bill) => (
                  <Paper key={bill.id} className="commune-stat-card" p="md" radius="lg">
                    <Group justify="space-between" align="flex-start">
                      <Stack gap={2}>
                        <Group gap="xs" wrap="nowrap">
                          <Text fw={700}>{bill.vendor_name || bill.title}</Text>
                          {bill.recurrence_type && bill.recurrence_type !== 'none' && (
                            <Badge size="xs" variant="light" color="violet">
                              Subscription
                            </Badge>
                          )}
                          {bill.category === 'work_tools' && (
                            <Badge size="xs" variant="light" color="teal">
                              Tool cost
                            </Badge>
                          )}
                        </Group>
                        <Text size="sm" c="dimmed">
                          {bill.invoice_reference ? `Ref ${bill.invoice_reference}` : 'No reference yet'}
                        </Text>
                      </Stack>
                      <Text size="sm" fw={600}>
                        {bill.payment_due_date ? formatDate(bill.payment_due_date) : formatDate(bill.due_date)}
                      </Text>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        </Paper>
      )}

      {filteredEntries.length === 0 ? (
        <EmptyState
          icon={IconHistory}
          iconColor="gray"
          title="No activity yet"
          description="Actions like creating expenses, marking payments, and inviting members will appear here automatically."
          h={200}
        />
      ) : (
        <Stack gap="xs">
          {grouped.map((dateGroup) => (
            <Stack key={dateGroup.label} gap="xs">
              <div className="commune-date-header">{dateGroup.label}</div>
              {dateGroup.items.map((entry) => {
                const IconComponent = actionIcons[entry.action] ?? IconActivity;
                const color = actionColors[entry.action] ?? 'gray';

                return (
                  <Paper key={entry.id} className="commune-stat-card" p="md" radius="lg">
                    <Group wrap="nowrap" align="flex-start">
                      <ThemeIcon variant="light" color={color} size="lg" radius="xl">
                        <IconComponent size={18} />
                      </ThemeIcon>

                      <Stack gap={2} style={{ flex: 1 }}>
                        <Group justify="space-between" wrap="nowrap">
                          <Group gap="xs" wrap="nowrap">
                            <Avatar
                              src={entry.user?.avatar_url}
                              name={entry.user?.name}
                              color="initials"
                              size="sm"
                            />
                            <Text size="sm" fw={600}>
                              {entry.user?.name ?? 'Unknown'}
                            </Text>
                          </Group>
                          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                            {formatRelativeTime(entry.created_at)}
                          </Text>
                        </Group>

                        <Text size="sm" c="dimmed">
                          {describeAction(entry)}
                        </Text>
                        {entry.action.startsWith('expense_') && hasActivityWorkspaceBillingContext(entry) && (
                          <Group gap="xs" mt={4}>
                            {(() => {
                              const billingContext = getActivityWorkspaceBillingContext(entry);
                              return (
                                <>
                                  {billingContext.vendor_name ? (
                                    <Badge size="xs" variant="light" color="gray">
                                      {billingContext.vendor_name}
                                    </Badge>
                                  ) : null}
                                  {billingContext.invoice_reference ? (
                                    <Badge size="xs" variant="light" color="gray">
                                      Ref {billingContext.invoice_reference}
                                    </Badge>
                                  ) : null}
                                  {billingContext.payment_due_date ? (
                                    <Badge size="xs" variant="light" color="indigo">
                                      Due {formatDate(billingContext.payment_due_date)}
                                    </Badge>
                                  ) : null}
                                </>
                              );
                            })()}
                          </Group>
                        )}
                      </Stack>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          ))}

          <PaginationBar
            page={page}
            totalItems={filteredEntries.length}
            onPageChange={setPage}
          />
        </Stack>
      )}

        </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
