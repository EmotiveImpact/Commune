import { createFileRoute } from '@tanstack/react-router';
import {
  Avatar,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconActivity,
  IconCash,
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
import { useMemo, useState } from 'react';
import type { ActivityEntry } from '@commune/api';
import { useGroupStore } from '../../stores/group';
import { useGroup } from '../../hooks/use-groups';
import { useActivityLog } from '../../hooks/use-activity';
import { ActivitySkeleton } from '../../components/page-skeleton';
import { EmptyState } from '../../components/empty-state';
import { PageHeader } from '../../components/page-header';
import { generateActivityCSV, downloadCSV } from '../../utils/export-csv';

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
  const meta = entry.metadata as Record<string, string | number | undefined>;
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

type TypeFilter = 'all' | 'expense' | 'payment' | 'member';

function ActivityPage() {
  const { activeGroupId } = useGroupStore();
  const { data: group, isLoading: groupLoading } = useGroup(activeGroupId ?? '');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [activeFilters, setActiveFilters] = useState<Set<TypeFilter>>(new Set(['all']));
  const { data: entries = [], isLoading } = useActivityLog(activeGroupId ?? '', limit);

  function toggleFilter(key: TypeFilter) {
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

  const grouped = useMemo(() => {
    const groups: { label: string; items: typeof filteredEntries }[] = [];
    let currentLabel = '';

    for (const entry of filteredEntries) {
      const label = getDateLabel(entry.created_at);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, items: [] });
      }
      groups[groups.length - 1]!.items.push(entry);
    }

    return groups;
  }, [filteredEntries]);

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
  ];

  return (
    <Stack gap="lg">
      <PageHeader
        title="Activity"
        subtitle={`Everything that happened in ${group?.name ?? 'this group'}`}
      >
        <Group gap="sm" align="center">
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
          <Tooltip label="Export activity log as CSV">
            <Button
              variant="light"
              size="xs"
              leftSection={<IconDownload size={14} />}
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
          </Tooltip>
        </Group>
      </PageHeader>

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
                      </Stack>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          ))}

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
    </Stack>
  );
}
