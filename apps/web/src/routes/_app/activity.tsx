import { createFileRoute } from '@tanstack/react-router';
import {
  Avatar,
  Badge,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconActivity,
  IconCash,
  IconCreditCard,
  IconHistory,
  IconReceipt,
  IconTrash,
  IconUserCheck,
  IconUserMinus,
  IconUserPlus,
  IconUsers,
  IconSettings,
  IconArrowsTransferDown,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import type { ActivityEntry } from '@commune/api';
import { useGroupStore } from '../../stores/group';
import { useGroup } from '../../hooks/use-groups';
import { useActivityLog } from '../../hooks/use-activity';
import { PageLoader } from '../../components/page-loader';
import { EmptyState } from '../../components/empty-state';

export const Route = createFileRoute('/_app/activity')({
  component: ActivityPage,
});

const PAGE_SIZE = 50;

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
};

function describeAction(entry: ActivityEntry): string {
  const meta = entry.metadata;
  const actorName = entry.user?.name ?? 'Someone';

  switch (entry.action) {
    case 'expense_created':
      return `${actorName} created expense '${meta.title ?? 'Untitled'}' for ${meta.currency ?? ''}${meta.amount ?? ''}`;
    case 'expense_updated':
      return `${actorName} updated expense '${meta.title ?? 'Untitled'}'`;
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

function ActivityPage() {
  const { activeGroupId } = useGroupStore();
  const { data: group, isLoading: groupLoading } = useGroup(activeGroupId ?? '');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { data: entries = [], isLoading } = useActivityLog(activeGroupId ?? '', limit);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = entries.filter((e) => e.created_at.slice(0, 10) === today).length;
    const expenseActions = entries.filter((e) => e.entity_type === 'expense').length;
    const paymentActions = entries.filter((e) => e.entity_type === 'payment').length;
    const memberActions = entries.filter((e) => e.entity_type === 'member').length;

    return { todayCount, expenseActions, paymentActions, memberActions };
  }, [entries]);

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
    return <PageLoader message="Loading activity..." />;
  }

  return (
    <Stack gap="xl">
      {/* ── Hero card ── */}
      <Paper className="commune-hero-card" p={{ base: 'xl', md: '2rem' }}>
        <div className="commune-hero-grid">
          <Stack gap="md" maw={620}>
            <div className="commune-hero-chip">Audit trail</div>
            <Stack gap="xs">
              <Title order={1}>Activity</Title>
              <Text className="commune-hero-copy">
                A persistent history of every action taken inside {group?.name ?? 'this group'}.
                Expenses, payments, and membership changes are all logged here.
              </Text>
            </Stack>
          </Stack>

          <Stack className="commune-hero-aside" gap="md">
            <Group justify="space-between">
              <div>
                <Text size="sm" c="rgba(255, 250, 246, 0.65)">
                  Total events
                </Text>
                <Text fw={800} size="2rem" c="white">
                  {entries.length}
                </Text>
              </div>
              <Badge variant="light" color="emerald" size="lg">
                {group?.name ?? 'Group'}
              </Badge>
            </Group>

            <SimpleGrid cols={2} spacing="sm">
              <div className="commune-hero-aside-stat">
                <Text size="xs" c="rgba(255, 250, 246, 0.55)" tt="uppercase">
                  Today
                </Text>
                <Text fw={700} size="lg" c="white">
                  {stats.todayCount}
                </Text>
              </div>
              <div className="commune-hero-aside-stat">
                <Text size="xs" c="rgba(255, 250, 246, 0.55)" tt="uppercase">
                  Expenses
                </Text>
                <Text fw={700} size="lg" c="white">
                  {stats.expenseActions}
                </Text>
              </div>
            </SimpleGrid>
          </Stack>
        </div>
      </Paper>

      {/* ── KPI cards ── */}
      <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="lg">
        <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="sage">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">Today</Text>
              <Text fw={800} size="1.9rem">{stats.todayCount}</Text>
              <Text size="sm" c="dimmed">Actions logged today</Text>
            </Stack>
            <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--commune-primary-strong)' }}>
              <IconActivity size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="lilac">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">Expense events</Text>
              <Text fw={800} size="1.9rem">{stats.expenseActions}</Text>
              <Text size="sm" c="dimmed">Created, updated, or archived</Text>
            </Stack>
            <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'rgba(98, 195, 138, 0.16)', color: 'var(--commune-forest-soft)' }}>
              <IconReceipt size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="ink">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">Payment events</Text>
              <Text fw={800} size="1.9rem">{stats.paymentActions}</Text>
              <Text size="sm" c="dimmed">Marked or confirmed</Text>
            </Stack>
            <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'rgba(16, 69, 54, 0.1)', color: 'var(--commune-forest)' }}>
              <IconCash size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="peach">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">Member events</Text>
              <Text fw={800} size="1.9rem">{stats.memberActions}</Text>
              <Text size="sm" c="dimmed">Invited, joined, or removed</Text>
            </Stack>
            <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'rgba(245, 154, 118, 0.18)', color: '#F59A76' }}>
              <IconUsers size={20} />
            </ThemeIcon>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* ── Timeline ── */}
      <Paper className="commune-soft-panel" p="xl">
        <Group justify="space-between" align="flex-start" mb="lg">
          <div>
            <Text className="commune-section-heading">Timeline</Text>
            <Text size="sm" c="dimmed">
              Every change is recorded so nothing slips through the cracks.
            </Text>
          </div>
          <Badge className="commune-pill-badge" variant="light" color="gray">
            {entries.length} events
          </Badge>
        </Group>

        {entries.length === 0 ? (
          <EmptyState
            icon={IconHistory}
            iconColor="gray"
            title="No activity yet"
            description="Actions like creating expenses, marking payments, and inviting members will appear here automatically."
            h={200}
          />
        ) : (
          <Stack gap="sm">
            {entries.map((entry) => {
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
                    </Stack>
                  </Group>
                </Paper>
              );
            })}

            {entries.length >= limit && (
              <Button
                variant="light"
                fullWidth
                mt="sm"
                onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
              >
                Load more
              </Button>
            )}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}
