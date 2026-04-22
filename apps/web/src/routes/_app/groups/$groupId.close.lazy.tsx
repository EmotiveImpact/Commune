import { createLazyFileRoute, Link } from '@tanstack/react-router';
import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCheck,
  IconChecklist,
  IconClock,
  IconReceipt,
  IconRefresh,
  IconUsers,
} from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import {
  countCompletedSetupChecklistItems,
  getIncompleteSetupChecklistItems,
} from '@commune/core';
import { formatCurrency, formatDate } from '@commune/utils';
import { EmptyState } from '../../../components/empty-state';
import { ContentSkeleton } from '../../../components/page-skeleton';
import { PageHeader } from '../../../components/page-header';
import { QueryErrorState } from '../../../components/query-error-state';
import {
  useCloseGroupCycle,
  useGroupCycleSummary,
  useReopenGroupCycle,
} from '../../../hooks/use-cycles';
import { useChores } from '../../../hooks/use-chores';
import { useGroup } from '../../../hooks/use-groups';
import { useAuthStore } from '../../../stores/auth';

export const Route = createLazyFileRoute('/_app/groups/$groupId/close')({
  component: GroupCycleClosePage,
});

function formatCycleRange(start: string, end: string) {
  return `${formatDate(start)} to ${formatDate(end)}`;
}

function getOrdinalLabel(value: number) {
  if (value === 1) return '1st';
  if (value === 2) return '2nd';
  if (value === 3) return '3rd';
  return `${value}th`;
}

export function GroupCycleClosePage() {
  const { groupId } = Route.useParams();
  const referenceDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const {
    data: group,
    error: groupError,
    isError: isGroupError,
    isLoading: groupLoading,
    refetch: refetchGroup,
  } = useGroup(groupId);
  const { data: summary, isLoading: summaryLoading } = useGroupCycleSummary(
    groupId,
    referenceDate,
  );
  const { data: operations } = useChores(groupId);
  const closeCycle = useCloseGroupCycle(groupId, referenceDate);
  const reopenCycle = useReopenGroupCycle(groupId, referenceDate);
  const { user } = useAuthStore();
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setNotes(summary?.closure?.notes ?? '');
  }, [summary?.closure?.notes]);

  if (groupLoading || summaryLoading) {
    return <ContentSkeleton />;
  }

  if (isGroupError) {
    return (
      <QueryErrorState
        title="Failed to load cycle close"
        error={groupError}
        onRetry={() => {
          void refetchGroup();
        }}
        icon={IconClock}
      />
    );
  }

  if (!group || !summary) {
    return (
      <EmptyState
        icon={IconAlertCircle}
        iconColor="emerald"
        title="Cycle data unavailable"
        description="We could not load the current cycle statement for this group."
      />
    );
  }

  const currentGroup = group;
  const currentSummary = summary;
  const isAdmin = currentGroup.members.some(
    (member) => member.user_id === user?.id && member.role === 'admin',
  );
  const overdueOperations = (operations ?? []).filter(
    (operation: any) => operation.next_due < referenceDate,
  );
  const incompleteChecklistItems = getIncompleteSetupChecklistItems(
    currentGroup.setup_checklist_progress,
  );
  const completedChecklistCount = countCompletedSetupChecklistItems(
    currentGroup.setup_checklist_progress,
  );
  const totalChecklistCount = Object.keys(
    currentGroup.setup_checklist_progress ?? {},
  ).length;

  async function handleCloseCycle() {
    try {
      await closeCycle.mutateAsync(notes);
      notifications.show({
        title: 'Cycle closed',
        message: `${currentGroup.name} is now locked for ${formatCycleRange(currentSummary.cycle_start, currentSummary.cycle_end)}.`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Unable to close cycle',
        message: error instanceof Error ? error.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  async function handleReopenCycle() {
    try {
      await reopenCycle.mutateAsync();
      notifications.show({
        title: 'Cycle reopened',
        message: `${currentGroup.name} can be edited again for this cycle.`,
        color: 'orange',
      });
    } catch (error) {
      notifications.show({
        title: 'Unable to reopen cycle',
        message: error instanceof Error ? error.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title={`${currentGroup.name} cycle close`}
        subtitle={`Review ${formatCycleRange(currentSummary.cycle_start, currentSummary.cycle_end)} before locking it.`}
      >
        <Group gap="sm">
          <Button
            component={Link}
            to={`/groups/${groupId}`}
            variant="default"
            leftSection={<IconArrowLeft size={16} />}
          >
            Back to group
          </Button>
          <Button component={Link} to={`/groups/${groupId}/edit`} variant="light">
            Group settings
          </Button>
        </Group>
      </PageHeader>

      <Paper className="commune-soft-panel" p="xl">
        <Group justify="space-between" align="flex-start">
          <Stack gap={6}>
            <Group gap="xs">
              <Text className="commune-section-heading">Current cycle</Text>
              <Badge color={currentSummary.is_closed ? 'green' : 'orange'} variant="light">
                {currentSummary.is_closed ? 'Closed' : 'Open'}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              Settlement day is the {getOrdinalLabel(currentSummary.cycle_date)} of each month.
            </Text>
            {currentSummary.closure && (
              <Text size="sm" c="dimmed">
                Last closed {formatDate(currentSummary.closure.closed_at)}.
                {currentSummary.closure.reopened_at
                  ? ` Reopened ${formatDate(currentSummary.closure.reopened_at)}.`
                  : ''}
              </Text>
            )}
          </Stack>
          <Group gap="xs">
            <Badge
              color={currentSummary.pending_expense_count > 0 ? 'yellow' : 'blue'}
              variant="light"
            >
              {currentSummary.pending_expense_count} pending approvals
            </Badge>
            <Badge
              color={currentSummary.overdue_expense_count > 0 ? 'red' : 'green'}
              variant="light"
            >
              {currentSummary.overdue_expense_count} overdue items
            </Badge>
            <Badge
              color={overdueOperations.length > 0 ? 'orange' : 'green'}
              variant="light"
            >
              {overdueOperations.length} overdue operations
            </Badge>
            <Badge
              color={incompleteChecklistItems.length > 0 ? 'yellow' : 'green'}
              variant="light"
            >
              {completedChecklistCount}/{totalChecklistCount} setup complete
            </Badge>
          </Group>
        </Group>

        {currentSummary.closure?.notes && (
          <>
            <Divider my="lg" />
            <Stack gap={4}>
              <Text fw={600} size="sm">Close notes</Text>
              <Text size="sm" c="dimmed">{currentSummary.closure.notes}</Text>
            </Stack>
          </>
        )}
      </Paper>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="sage">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text size="sm" c="dimmed">Approved spend</Text>
              <Text fw={800} size="2rem" lh={1.05}>
                {formatCurrency(currentSummary.total_spend, currentGroup.currency)}
              </Text>
            </Stack>
            <IconReceipt size={22} style={{ color: 'var(--commune-ink-soft)', opacity: 0.5 }} />
          </Group>
        </Paper>

        <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="peach">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text size="sm" c="dimmed">Outstanding</Text>
              <Text fw={800} size="2rem" lh={1.05}>
                {formatCurrency(currentSummary.total_outstanding, currentGroup.currency)}
              </Text>
            </Stack>
            <IconClock size={22} style={{ color: 'var(--commune-ink-soft)', opacity: 0.5 }} />
          </Group>
        </Paper>

        <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="mist">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text size="sm" c="dimmed">Unpaid expenses</Text>
              <Text fw={800} size="2rem" lh={1.05}>
                {currentSummary.unpaid_expense_count}
              </Text>
            </Stack>
            <IconAlertCircle size={22} style={{ color: 'var(--commune-ink-soft)', opacity: 0.5 }} />
          </Group>
        </Paper>

        <Paper className="commune-stat-card commune-kpi-card" p="lg" data-tone="sky">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text size="sm" c="dimmed">Members with balance</Text>
              <Text fw={800} size="2rem" lh={1.05}>
                {currentSummary.member_balances.filter((member) => member.remaining_amount > 0).length}
              </Text>
            </Stack>
            <IconUsers size={22} style={{ color: 'var(--commune-ink-soft)', opacity: 0.5 }} />
          </Group>
        </Paper>
      </SimpleGrid>

      <Paper className="commune-soft-panel" p="xl">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text className="commune-section-heading">Close workflow</Text>
              <Text size="sm" c="dimmed">
                Lock the current cycle once the expenses, approvals, and balances are ready.
              </Text>
            </div>
            {!isAdmin && (
              <Badge variant="light" color="gray">Read only</Badge>
            )}
          </Group>

          {incompleteChecklistItems.length > 0 && (
            <Alert
              color="yellow"
              variant="light"
              icon={<IconChecklist size={16} />}
              title="Setup checklist still has open items"
            >
              <Stack gap={6}>
                <Text size="sm">
                  Closing this cycle is still allowed, but the group setup is not fully complete yet.
                </Text>
                {incompleteChecklistItems.slice(0, 3).map((item) => (
                  <Text key={item.id} size="sm" c="dimmed">
                    • {item.label}
                  </Text>
                ))}
                {incompleteChecklistItems.length > 3 && (
                  <Text size="sm" c="dimmed">
                    +{incompleteChecklistItems.length - 3} more checklist items
                  </Text>
                )}
                <Group gap="xs" mt={4}>
                  <Button
                    component={Link}
                    to={`/groups/${groupId}/edit`}
                    size="compact-xs"
                    variant="light"
                  >
                    Open setup checklist
                  </Button>
                </Group>
              </Stack>
            </Alert>
          )}

          <Textarea
            label="Notes for this close"
            description="Optional handover notes, unresolved issues, or context for the next cycle."
            placeholder="Example: internet refund still pending, rent cleared, council tax waiting on confirmation."
            minRows={3}
            autosize
            value={notes}
            onChange={(event) => setNotes(event.currentTarget.value)}
            disabled={!isAdmin || currentSummary.is_closed}
          />

          <Group>
            {currentSummary.is_closed ? (
              <Button
                color="orange"
                leftSection={<IconRefresh size={16} />}
                onClick={handleReopenCycle}
                loading={reopenCycle.isPending}
                disabled={!isAdmin}
              >
                Reopen cycle
              </Button>
            ) : (
              <Button
                color="green"
                leftSection={<IconCheck size={16} />}
                onClick={handleCloseCycle}
                loading={closeCycle.isPending}
                disabled={!isAdmin}
              >
                {incompleteChecklistItems.length > 0
                  ? 'Close cycle with warnings'
                  : 'Close this cycle'}
              </Button>
            )}
            <Text size="sm" c="dimmed">
              Closing does not delete expenses. It marks this period as reviewed and locked.
            </Text>
          </Group>
          {overdueOperations.length > 0 && (
            <Text size="sm" c="orange">
              Shared operations still overdue: {overdueOperations
                .slice(0, 3)
                .map((operation: any) => operation.title)
                .join(', ')}
              {overdueOperations.length > 3 ? '...' : ''}
            </Text>
          )}
        </Stack>
      </Paper>

      <Paper className="commune-soft-panel" p="xl">
        <Stack gap="md">
          <Text className="commune-section-heading">Member balances</Text>
          {currentSummary.member_balances.length === 0 ? (
            <Text size="sm" c="dimmed">
              No participant balances were recorded for this cycle yet.
            </Text>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              {currentSummary.member_balances.map((member) => (
                <Paper key={member.user_id} withBorder radius="md" p="md">
                  <Stack gap={4}>
                    <Group justify="space-between">
                      <Text fw={600}>{member.user_name}</Text>
                      <Badge
                        color={member.remaining_amount > 0 ? 'orange' : 'green'}
                        variant="light"
                      >
                        {member.remaining_amount > 0 ? 'Outstanding' : 'Settled'}
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed">
                      Share {formatCurrency(member.total_share, currentGroup.currency)} · Paid {formatCurrency(member.paid_amount, currentGroup.currency)}
                    </Text>
                    <Text fw={700}>
                      Remaining {formatCurrency(member.remaining_amount, currentGroup.currency)}
                    </Text>
                    {member.overdue_expense_count > 0 && (
                      <Text size="xs" c="red">
                        {member.overdue_expense_count} overdue item{member.overdue_expense_count === 1 ? '' : 's'}
                      </Text>
                    )}
                  </Stack>
                </Paper>
              ))}
            </SimpleGrid>
          )}
        </Stack>
      </Paper>

      <Paper className="commune-soft-panel" p="xl">
        <Stack gap="md">
          <Text className="commune-section-heading">Cycle expenses</Text>
          {currentSummary.expenses.length === 0 ? (
            <Text size="sm" c="dimmed">
              No expenses fall into this cycle yet.
            </Text>
          ) : (
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Expense</Table.Th>
                  <Table.Th>Due</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Remaining</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {currentSummary.expenses.map((expense) => (
                  <Table.Tr key={expense.id}>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text fw={600}>{expense.title}</Text>
                        <Text size="xs" c="dimmed">
                          {formatCurrency(expense.amount, expense.currency)} · {expense.unpaid_participants} unpaid participant{expense.unpaid_participants === 1 ? '' : 's'}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>{formatDate(expense.due_date)}</Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        color={
                          expense.approval_status === 'approved'
                            ? expense.remaining_amount > 0
                              ? 'orange'
                              : 'green'
                            : expense.approval_status === 'pending'
                              ? 'yellow'
                              : 'red'
                        }
                      >
                        {expense.approval_status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{formatCurrency(expense.remaining_amount, expense.currency)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
