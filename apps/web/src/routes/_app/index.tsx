import { createFileRoute } from '@tanstack/react-router';
import { Title, Text, Stack, Card, SimpleGrid, Group, ThemeIcon, Center, Loader, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconReceipt, IconCash, IconAlertTriangle, IconCalendar } from '@tabler/icons-react';
import { useGroupStore } from '../../stores/group';
import { useGroup } from '../../hooks/use-groups';
import { useGroupExpenses } from '../../hooks/use-expenses';
import { formatCurrency, getMonthKey, isOverdue, isUpcoming } from '@commune/utils';
import { CreateGroupModal } from '../../components/create-group-modal';

export const Route = createFileRoute('/_app/')({
  component: DashboardPage,
});

function DashboardPage() {
  const { activeGroupId } = useGroupStore();
  const { data: group, isLoading: groupLoading } = useGroup(activeGroupId ?? '');
  const currentMonth = getMonthKey();
  const { data: expenses, isLoading: expensesLoading } = useGroupExpenses(
    activeGroupId ?? '',
    { month: currentMonth }
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

  if (groupLoading || expensesLoading) {
    return <Center h={400}><Loader /></Center>;
  }

  const totalSpend = (expenses ?? []).reduce((sum, e) => sum + e.amount, 0);
  const overdueCount = (expenses ?? []).filter((e) => isOverdue(e.due_date)).length;
  const upcomingCount = (expenses ?? []).filter((e) => isUpcoming(e.due_date)).length;

  const stats = [
    { label: 'Total spend', value: formatCurrency(totalSpend, group?.currency), icon: IconReceipt, color: 'blue' },
    { label: 'Expenses', value: (expenses ?? []).length.toString(), icon: IconCash, color: 'green' },
    { label: 'Overdue', value: overdueCount.toString(), icon: IconAlertTriangle, color: 'red' },
    { label: 'Upcoming', value: upcomingCount.toString(), icon: IconCalendar, color: 'orange' },
  ];

  return (
    <Stack>
      <Title order={2}>{group?.name}</Title>
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
        {stats.map((stat) => (
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
    </Stack>
  );
}
