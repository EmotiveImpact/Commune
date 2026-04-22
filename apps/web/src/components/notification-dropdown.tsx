import { ActionIcon, Badge, Indicator, Menu, Text, Group, Stack, Box, UnstyledButton } from '@mantine/core';
import { IconBell, IconReceipt, IconCheck, IconAlertTriangle, IconChecks } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  useNotificationSummary,
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type AppNotification,
} from '../hooks/use-notifications';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const iconMap: Record<AppNotification['type'], React.ReactNode> = {
  expense_added: <IconReceipt size={16} />,
  payment_made: <IconCheck size={16} />,
  payment_overdue: <IconAlertTriangle size={16} />,
};

export function NotificationDropdown() {
  const [opened, setOpened] = useState(false);
  const [summaryEnabled, setSummaryEnabled] = useState(false);
  const { data: summary } = useNotificationSummary({ enabled: summaryEnabled });
  const { data: notifications = [], isLoading } = useNotifications({ enabled: opened });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const navigate = useNavigate();
  const unreadCount = summary?.unread_count ?? 0;

  const enableSummary = () => {
    if (!summaryEnabled) {
      setSummaryEnabled(true);
    }
  };

  const handleNotificationClick = (n: AppNotification) => {
    // Mark as read
    if (!n.read) {
      markRead.mutate(n.id);
    }
    // Navigate to expense
    if (n.expense_id) {
      navigate({ to: '/expenses/$expenseId', params: { expenseId: n.expense_id } });
    }
  };

  const handleMarkAllRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length > 0) {
      markAllRead.mutate(unreadIds);
    }
  };

  return (
    <Menu
      shadow="md"
      width={360}
      position="bottom-end"
      opened={opened}
      onChange={(nextOpened) => {
        setOpened(nextOpened);
        if (nextOpened) {
          enableSummary();
        }
      }}
    >
      <Menu.Target>
        <Indicator
          size={18}
          label={unreadCount > 0 ? String(Math.min(unreadCount, 9)) : undefined}
          disabled={unreadCount === 0}
          color="red"
          offset={4}
        >
          <ActionIcon
            variant="subtle"
            color="gray"
            size={40}
            aria-label="Open notifications"
            onMouseEnter={enableSummary}
            onFocus={enableSummary}
          >
            <IconBell size={18} />
          </ActionIcon>
        </Indicator>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>
          <Group justify="space-between">
            <Text fw={700}>Notifications</Text>
            <Group gap="xs">
              {unreadCount > 0 && (
                <>
                  <Badge size="sm" variant="light" color="commune">
                    {unreadCount} new
                  </Badge>
                  <UnstyledButton onClick={handleMarkAllRead}>
                    <Group gap={4}>
                      <IconChecks size={14} color="var(--mantine-color-dimmed)" />
                      <Text size="xs" c="dimmed">
                        Mark all read
                      </Text>
                    </Group>
                  </UnstyledButton>
                </>
              )}
            </Group>
          </Group>
        </Menu.Label>

        {opened && isLoading ? (
          <Box p="md" ta="center">
            <Text c="dimmed" size="sm">
              Loading notifications...
            </Text>
          </Box>
        ) : notifications.length === 0 ? (
          <Box p="md" ta="center">
            <Text c="dimmed" size="sm">
              No recent notifications
            </Text>
          </Box>
        ) : (
          notifications.slice(0, 10).map((n) => (
            <Menu.Item
              key={n.id}
              leftSection={iconMap[n.type]}
              onClick={() => handleNotificationClick(n)}
              bg={n.read ? undefined : 'var(--mantine-color-blue-light)'}
            >
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Text size="sm" fw={n.read ? 400 : 600}>
                    {n.title}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {n.description}
                  </Text>
                </Stack>
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                  {timeAgo(n.created_at)}
                </Text>
              </Group>
            </Menu.Item>
          ))
        )}

        {notifications.length > 10 && (
          <>
            <Menu.Divider />
            <Menu.Item ta="center" onClick={() => navigate({ to: '/activity' })}>
              <Text size="sm" c="commune" fw={600}>
                View all activity
              </Text>
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
