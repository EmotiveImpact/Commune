import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Title, Text, Stack, Card, SimpleGrid, Group, ThemeIcon,
  Button, Progress, Badge,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconReceipt, IconCash, IconAlertTriangle, IconCalendar,
  IconWallet, IconArrowRight,
} from '@tabler/icons-react';
import { useGroupStore } from '../../stores/group';
import { useAuthStore } from '../../stores/auth';
import { useGroup } from '../../hooks/use-groups';
import { useDashboardStats } from '../../hooks/use-dashboard';
import { formatCurrency, getMonthKey, formatDate } from '@commune/utils';
import { CreateGroupModal } from '../../components/create-group-modal';
import { PageLoader } from '../../components/page-loader';

export const Route = createFileRoute('/_app/')({
  component: DashboardPage,
});

function DashboardPage() {
  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();
  const { data: group, isLoading: groupLoading } = useGroup(activeGroupId ?? '');
  const currentMonth = getMonthKey();
  const { data: stats, isLoading: statsLoading } = useDashboardStats(
    activeGroupId ?? '',
    user?.id ?? '',
    currentMonth,
  );
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  if (!activeGroupId) {
    return (
      <Stack align="center" justify="center" h={400}>
        <Title order={3}>Welcome to Commune</Title>
        <Text c="dimmed">Create your first group to get started.</Text>
        <Button onClick={openCreate}>Create a group</Button>
        <CreateGroupModal opened={createOpened} onClose={closeCreate} />
      </Stack>
    );
  }

  if (groupLoading || statsLoading) {
    return <PageLoader message="Loading dashboard..." />;
  }

  const paidPct = stats && stats.your_share > 0
    ? Math.round((stats.amount_paid / stats.your_share) * 100)
    : 0;

  const statCards = [
    { label: 'Group spend', value: formatCurrency(stats?.total_spend ?? 0, group?.currency), icon: IconReceipt, color: 'blue' },
    { label: 'Your share', value: formatCurrency(stats?.your_share ?? 0, group?.currency), icon: IconWallet, color: 'violet' },
    { label: 'Remaining', value: formatCurrency(stats?.amount_remaining ?? 0, group?.currency), icon: IconCash, color: 'orange' },
    { label: 'Overdue', value: (stats?.overdue_count ?? 0).toString(), icon: IconAlertTriangle, color: 'red' },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>{group?.name}</Title>
        <Button component={Link} to="/breakdown" variant="subtle" rightSection={<IconArrowRight size={16} />}>
          My Breakdown
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
        {statCards.map((stat) => (
          <Card key={stat.label} withBorder padding="lg" radius="md">
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{stat.label}</Text>
                <Text fw={700} size="xl">{stat.value}</Text>
              </div>
              <ThemeIcon variant="light" color={stat.color} size="lg" radius="md">
                <stat.icon size={20} />
              </ThemeIcon>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      {/* Payment progress */}
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" mb="xs">
          <Text fw={600}>Your payment progress</Text>
          <Text size="sm" c="dimmed">{paidPct}% complete</Text>
        </Group>
        <Progress value={paidPct} size="lg" radius="md" color={paidPct === 100 ? 'green' : 'blue'} />
        <Group justify="space-between" mt="xs">
          <Text size="sm" c="dimmed">Paid: {formatCurrency(stats?.amount_paid ?? 0, group?.currency)}</Text>
          <Text size="sm" c="dimmed">Total: {formatCurrency(stats?.your_share ?? 0, group?.currency)}</Text>
        </Group>
      </Card>

      {/* Upcoming expenses */}
      {(stats?.upcoming_items ?? []).length > 0 && (
        <Card withBorder padding="lg" radius="md">
          <Group justify="space-between" mb="sm">
            <Text fw={600}>Upcoming this week</Text>
            <Badge variant="light" color="orange">{stats!.upcoming_items.length}</Badge>
          </Group>
          <Stack gap="xs">
            {stats!.upcoming_items.map((expense) => (
              <Card
                key={expense.id}
                component={Link}
                to={`/expenses/${expense.id}`}
                withBorder
                padding="sm"
                radius="sm"
                style={{ cursor: 'pointer', textDecoration: 'none' }}
              >
                <Group justify="space-between">
                  <div>
                    <Text size="sm" fw={500}>{expense.title}</Text>
                    <Text size="xs" c="dimmed">{formatDate(expense.due_date)}</Text>
                  </div>
                  <Text fw={600}>{formatCurrency(expense.amount, group?.currency)}</Text>
                </Group>
              </Card>
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
