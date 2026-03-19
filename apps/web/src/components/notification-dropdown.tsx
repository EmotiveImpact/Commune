import { ActionIcon, Badge, Indicator, Menu, Text, Group, Stack, Box } from '@mantine/core';
import { IconBell, IconReceipt, IconCheck, IconAlertTriangle } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { useNotifications, type AppNotification } from '../hooks/use-notifications';

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
  const { data: notifications = [] } = useNotifications();
  const navigate = useNavigate();
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Menu shadow="md" width={360} position="bottom-end">
      <Menu.Target>
        <Indicator
          size={18}
          label={unreadCount > 0 ? String(Math.min(unreadCount, 9)) : undefined}
          disabled={unreadCount === 0}
          color="red"
          offset={4}
        >
          <ActionIcon variant="subtle" color="gray" size={40}>
            <IconBell size={18} />
          </ActionIcon>
        </Indicator>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>
          <Group justify="space-between">
            <Text fw={700}>Notifications</Text>
            {unreadCount > 0 && (
              <Badge size="sm" variant="light" color="commune">
                {unreadCount} new
              </Badge>
            )}
          </Group>
        </Menu.Label>

        {notifications.length === 0 ? (
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
              onClick={() => {
                if (n.expense_id) {
                  navigate({ to: '/expenses/$expenseId', params: { expenseId: n.expense_id } });
                }
              }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2}>
                  <Text size="sm" fw={600}>
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
            <Menu.Item ta="center" onClick={() => navigate({ to: '/expenses' })}>
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
