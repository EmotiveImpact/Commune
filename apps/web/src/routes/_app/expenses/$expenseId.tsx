import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Title, Stack, Card, Group, Text, Badge, Table, Avatar, Button,
  Center, Loader, ActionIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconCheck, IconX, IconArchive } from '@tabler/icons-react';
import { formatCurrency, formatDate, isOverdue } from '@commune/utils';
import { calculateReimbursements } from '@commune/core';
import { useExpenseDetail, useMarkPayment, useArchiveExpense } from '../../../hooks/use-expenses';
import { useGroupStore } from '../../../stores/group';
import { useGroup } from '../../../hooks/use-groups';
import { useAuthStore } from '../../../stores/auth';

export const Route = createFileRoute('/_app/expenses/$expenseId')({
  component: ExpenseDetailPage,
});

function ExpenseDetailPage() {
  const { expenseId } = Route.useParams();
  const { activeGroupId } = useGroupStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const { data: expense, isLoading } = useExpenseDetail(expenseId);
  const markPayment = useMarkPayment(activeGroupId ?? '');
  const archive = useArchiveExpense(activeGroupId ?? '');
  const { user } = useAuthStore();

  if (isLoading) return <Center h={400}><Loader /></Center>;
  if (!expense) return <Text c="dimmed">Expense not found.</Text>;

  const isAdmin = group?.members.some(
    (m) => m.user_id === user?.id && m.role === 'admin'
  );

  const overdue = isOverdue(expense.due_date);

  // Reimbursement info
  const reimbursements = expense.paid_by_user_id
    ? calculateReimbursements(
        expense.participants.map((p) => ({ userId: p.user_id, amount: p.share_amount })),
        expense.paid_by_user_id
      )
    : [];

  const statusColor: Record<string, string> = {
    unpaid: 'red',
    paid: 'green',
    confirmed: 'blue',
  };

  async function handleTogglePayment(participantUserId: string, currentStatus: string) {
    const newStatus = currentStatus === 'unpaid' ? 'paid' : 'unpaid';
    try {
      await markPayment.mutateAsync({
        expenseId: expense!.id,
        userId: participantUserId,
        status: newStatus as 'paid' | 'unpaid',
      });
      notifications.show({
        title: newStatus === 'paid' ? 'Marked as paid' : 'Marked as unpaid',
        message: '',
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed',
        message: err instanceof Error ? err.message : 'Error',
        color: 'red',
      });
    }
  }

  async function handleArchive() {
    try {
      await archive.mutateAsync(expense!.id);
      notifications.show({ title: 'Expense archived', message: '', color: 'green' });
    } catch (err) {
      notifications.show({
        title: 'Failed',
        message: err instanceof Error ? err.message : 'Error',
        color: 'red',
      });
    }
  }

  return (
    <Stack>
      <Group>
        <ActionIcon variant="subtle" component={Link} to="/expenses">
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Title order={2}>{expense.title}</Title>
      </Group>

      {/* Info card */}
      <Card withBorder padding="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text fw={700} size="xl">{formatCurrency(expense.amount, expense.currency)}</Text>
            <Group gap="xs">
              <Badge variant="light">{expense.category.replace(/_/g, ' ')}</Badge>
              {expense.recurrence_type !== 'none' && <Badge variant="light">Recurring ({expense.recurrence_type})</Badge>}
              {overdue && <Badge color="red">Overdue</Badge>}
            </Group>
          </Group>
          <Text size="sm" c="dimmed">Due: {formatDate(expense.due_date)}</Text>
          <Text size="sm" c="dimmed">Split: {expense.split_method}</Text>
          {expense.description && <Text size="sm" mt="xs">{expense.description}</Text>}
          {expense.paid_by_user && (
            <Text size="sm" c="dimmed">
              Paid upfront by <Text span fw={500}>{expense.paid_by_user.name}</Text>
            </Text>
          )}
        </Stack>
      </Card>

      {/* Split breakdown */}
      <Card withBorder padding="md">
        <Text fw={600} mb="sm">Split breakdown</Text>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Person</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Share</Table.Th>
              {expense.paid_by_user_id && <Table.Th style={{ textAlign: 'right' }}>Owes to</Table.Th>}
              <Table.Th style={{ textAlign: 'center' }}>Status</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>Action</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {expense.participants.map((p) => {
              const payment = expense.payment_records?.find((pr) => pr.user_id === p.user_id);
              const paymentStatus = payment?.status ?? 'unpaid';
              const reimbursement = reimbursements.find((r) => r.userId === p.user_id);
              const canToggle = p.user_id === user?.id || isAdmin;

              return (
                <Table.Tr key={p.id}>
                  <Table.Td>
                    <Group gap="xs">
                      <Avatar src={p.user.avatar_url} name={p.user.name} color="initials" size="sm" />
                      <Text size="sm">{p.user.name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    {formatCurrency(p.share_amount, expense.currency)}
                  </Table.Td>
                  {expense.paid_by_user_id && (
                    <Table.Td style={{ textAlign: 'right' }}>
                      {reimbursement ? expense.paid_by_user?.name : '—'}
                    </Table.Td>
                  )}
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Badge color={statusColor[paymentStatus] ?? 'gray'} variant="light" size="sm">
                      {paymentStatus}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    {canToggle && (
                      <ActionIcon
                        variant="light"
                        color={paymentStatus === 'unpaid' ? 'green' : 'red'}
                        size="sm"
                        onClick={() => handleTogglePayment(p.user_id, paymentStatus)}
                      >
                        {paymentStatus === 'unpaid' ? <IconCheck size={14} /> : <IconX size={14} />}
                      </ActionIcon>
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Admin actions */}
      {isAdmin && (
        <Group>
          <Button variant="light" color="red" leftSection={<IconArchive size={16} />} onClick={handleArchive}>
            Archive expense
          </Button>
        </Group>
      )}
    </Stack>
  );
}
