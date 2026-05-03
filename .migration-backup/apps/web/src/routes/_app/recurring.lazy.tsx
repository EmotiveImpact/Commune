import { createLazyFileRoute } from '@tanstack/react-router';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Menu,
  Modal,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconDots,
  IconPlayerPause,
  IconPlayerPlay,
  IconRepeat,
  IconTrash,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { formatCurrency, formatDate } from '@commune/utils';
import { setPageTitle } from '../../utils/seo';
import { useGroupStore } from '../../stores/group';
import { useGroup } from '../../hooks/use-groups';
import {
  useRecurringExpenses,
  usePausedRecurringExpenses,
  usePauseRecurring,
  useResumeRecurring,
  useArchiveRecurring,
} from '../../hooks/use-recurring';
import { PageHeader } from '../../components/page-header';
import { EmptyState } from '../../components/empty-state';
import { ExpenseListSkeleton } from '../../components/page-skeleton';
import { QueryErrorState } from '../../components/query-error-state';

export const Route = createLazyFileRoute('/_app/recurring')({
  component: RecurringPage,
});

type Tab = 'active' | 'paused';

function formatCategoryLabel(category: string) {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function RecurringPage() {
  useEffect(() => {
    setPageTitle('Recurring');
  }, []);

  const { activeGroupId } = useGroupStore();
  const {
    data: group,
    error: groupError,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup(activeGroupId ?? '');
  const {
    data: activeExpenses,
    isLoading: activeLoading,
    isError: isActiveExpensesError,
    error: activeExpensesError,
    refetch: refetchActiveExpenses,
  } = useRecurringExpenses(activeGroupId ?? '');
  const {
    data: pausedExpenses,
    isLoading: pausedLoading,
    isError: isPausedExpensesError,
    error: pausedExpensesError,
    refetch: refetchPausedExpenses,
  } = usePausedRecurringExpenses(activeGroupId ?? '');

  const pauseMutation = usePauseRecurring(activeGroupId ?? '');
  const resumeMutation = useResumeRecurring(activeGroupId ?? '');
  const archiveMutation = useArchiveRecurring(activeGroupId ?? '');

  const [tab, setTab] = useState<Tab>('active');
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null);

  const isLoading = activeLoading || pausedLoading;
  const expenses = tab === 'active' ? (activeExpenses ?? []) : (pausedExpenses ?? []);

  if (!activeGroupId) {
    return (
      <EmptyState
        icon={IconRepeat}
        title="Select a group first"
        description="Choose a group in the sidebar to manage recurring expenses."
      />
    );
  }

  if (isGroupError) {
    return (
      <QueryErrorState
        title="Failed to load recurring expenses"
        error={groupError}
        onRetry={() => {
          void refetchGroup();
        }}
        icon={IconRepeat}
      />
    );
  }

  if (isActiveExpensesError || isPausedExpensesError) {
    return (
      <QueryErrorState
        title="Failed to load recurring expenses"
        error={activeExpensesError ?? pausedExpensesError}
        onRetry={() => {
          void refetchActiveExpenses();
          void refetchPausedExpenses();
        }}
        icon={IconRepeat}
      />
    );
  }

  function handlePause(expenseId: string) {
    pauseMutation.mutate(expenseId, {
      onSuccess: () => {
        notifications.show({
          title: 'Recurring expense paused',
          message: 'This expense will no longer generate new copies.',
          color: 'yellow',
          icon: <IconPlayerPause size={18} />,
        });
      },
      onError: () => {
        notifications.show({
          title: 'Failed to pause',
          message: 'Something went wrong. Please try again.',
          color: 'red',
        });
      },
    });
  }

  function handleResume(expenseId: string) {
    resumeMutation.mutate(expenseId, {
      onSuccess: () => {
        notifications.show({
          title: 'Recurring expense resumed',
          message: 'This expense will resume generating copies on schedule.',
          color: 'green',
          icon: <IconPlayerPlay size={18} />,
        });
      },
      onError: () => {
        notifications.show({
          title: 'Failed to resume',
          message: 'Something went wrong. Please try again.',
          color: 'red',
        });
      },
    });
  }

  function handleArchive(expenseId: string) {
    archiveMutation.mutate(expenseId, {
      onSuccess: () => {
        setConfirmArchive(null);
        notifications.show({
          title: 'Recurring expense archived',
          message: 'The expense has been removed.',
          color: 'green',
          icon: <IconCheck size={18} />,
        });
      },
      onError: () => {
        notifications.show({
          title: 'Failed to archive',
          message: 'Something went wrong. Please try again.',
          color: 'red',
        });
      },
    });
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="Recurring Expenses"
        subtitle="Manage expenses that automatically repeat on a schedule."
      />

      {/* Stats summary */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        <Paper className="commune-soft-panel commune-stat-card" p="lg">
          <Text size="sm" c="dimmed">Active · Paused</Text>
          <Text fw={800} size="1.8rem" lh={1.1}>
            {activeExpenses?.length ?? 0} · {pausedExpenses?.length ?? 0}
          </Text>
        </Paper>
        <Paper className="commune-soft-panel commune-stat-card" p="lg">
          <Text size="sm" c="dimmed">Monthly total</Text>
          <Text fw={800} size="1.8rem" lh={1.1}>
            {formatCurrency(
              (activeExpenses ?? []).reduce((sum, e) => sum + (e as any).amount, 0),
              group?.currency,
            )}
          </Text>
        </Paper>
      </SimpleGrid>

      {/* Tab toggle */}
      <SegmentedControl
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        data={[
          { label: `Active (${activeExpenses?.length ?? 0})`, value: 'active' },
          { label: `Paused (${pausedExpenses?.length ?? 0})`, value: 'paused' },
        ]}
      />

      {isLoading ? (
        <ExpenseListSkeleton />
      ) : expenses.length === 0 ? (
        <EmptyState
          icon={IconRepeat}
          title={tab === 'active' ? 'No active recurring expenses' : 'No paused recurring expenses'}
          description={
            tab === 'active'
              ? 'Create an expense with a weekly or monthly recurrence to see it here.'
              : 'Paused recurring expenses will appear here. You can resume them at any time.'
          }
        />
      ) : (
        <Paper className="commune-soft-panel" p={0} style={{ overflow: 'hidden' }}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Title</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th>Amount</Table.Th>
                <Table.Th>Frequency</Table.Th>
                <Table.Th>Next due</Table.Th>
                <Table.Th>Participants</Table.Th>
                <Table.Th style={{ width: 60 }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {expenses.map((expense: any) => {
                const freq = tab === 'paused'
                  ? extractPausedType(expense.description)
                  : expense.recurrence_type;

                return (
                  <Table.Tr key={expense.id}>
                    <Table.Td>
                      <Text fw={600} lineClamp={1}>{expense.title}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color="gray" size="sm">
                        {formatCategoryLabel(expense.category)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={600}>
                        {formatCurrency(expense.amount, group?.currency)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        color={tab === 'paused' ? 'yellow' : freq === 'weekly' ? 'blue' : 'green'}
                      >
                        {tab === 'paused' ? `Paused (${freq})` : freq}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatDate(expense.due_date)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {expense.participants?.length ?? 0} member{(expense.participants?.length ?? 0) !== 1 ? 's' : ''}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Menu shadow="md" width={180} position="bottom-end">
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${expense.title}`}>
                            <IconDots size={18} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          {tab === 'active' ? (
                            <Menu.Item
                              leftSection={<IconPlayerPause size={16} />}
                              onClick={() => handlePause(expense.id)}
                            >
                              Pause
                            </Menu.Item>
                          ) : (
                            <Menu.Item
                              leftSection={<IconPlayerPlay size={16} />}
                              onClick={() => handleResume(expense.id)}
                            >
                              Resume
                            </Menu.Item>
                          )}
                          <Menu.Divider />
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={16} />}
                            onClick={() => setConfirmArchive(expense.id)}
                          >
                            Archive
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {/* Archive confirmation modal */}
      <Modal
        opened={!!confirmArchive}
        onClose={() => setConfirmArchive(null)}
        title="Archive recurring expense?"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            This will stop the expense from generating new copies and remove it from your
            recurring list. Existing generated expenses will not be affected.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmArchive(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={archiveMutation.isPending}
              onClick={() => confirmArchive && handleArchive(confirmArchive)}
            >
              Archive
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

/** Extract original recurrence type from the pause tag in description */
function extractPausedType(description: string | null): string {
  if (!description) return 'unknown';
  const match = description.match(/\[paused:(weekly|monthly)\]/);
  return match?.[1] ?? 'unknown';
}
