import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  Title, Stack, Card, Group, Text, Badge, Table, Avatar, Button,
  Center, Loader, ActionIcon, Modal, TextInput, Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft, IconCheck, IconX, IconArchive, IconCheckbox,
  IconNote, IconEdit,
} from '@tabler/icons-react';
import { useState } from 'react';
import { formatCurrency, formatDate, isOverdue } from '@commune/utils';
import { calculateReimbursements } from '@commune/core';
import {
  useExpenseDetail, useMarkPayment, useArchiveExpense, useConfirmPayment,
} from '../../../hooks/use-expenses';
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
  const confirmPayment = useConfirmPayment(activeGroupId ?? '');
  const archive = useArchiveExpense(activeGroupId ?? '');
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Payment note modal
  const [noteOpened, { open: openNote, close: closeNote }] = useDisclosure(false);
  const [paymentNote, setPaymentNote] = useState('');
  const [pendingPayment, setPendingPayment] = useState<{ userId: string } | null>(null);

  if (isLoading) return <Center h={400}><Loader /></Center>;
  if (!expense) return <Text c="dimmed">Expense not found.</Text>;

  const isAdmin = group?.members.some(
    (m) => m.user_id === user?.id && m.role === 'admin'
  );

  const overdue = isOverdue(expense.due_date);

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

  function handlePayClick(userId: string) {
    setPendingPayment({ userId });
    setPaymentNote('');
    openNote();
  }

  async function handleConfirmPay() {
    if (!pendingPayment) return;
    try {
      await markPayment.mutateAsync({
        expenseId: expense!.id,
        userId: pendingPayment.userId,
        status: 'paid',
        note: paymentNote || undefined,
      });
      notifications.show({ title: 'Marked as paid', message: '', color: 'green' });
      closeNote();
      setPendingPayment(null);
    } catch (err) {
      notifications.show({
        title: 'Failed',
        message: err instanceof Error ? err.message : 'Error',
        color: 'red',
      });
    }
  }

  async function handleUnpay(userId: string) {
    try {
      await markPayment.mutateAsync({
        expenseId: expense!.id,
        userId,
        status: 'unpaid',
      });
      notifications.show({ title: 'Marked as unpaid', message: '', color: 'green' });
    } catch (err) {
      notifications.show({
        title: 'Failed',
        message: err instanceof Error ? err.message : 'Error',
        color: 'red',
      });
    }
  }

  async function handleConfirmPayment(userId: string) {
    try {
      await confirmPayment.mutateAsync({
        expenseId: expense!.id,
        userId,
      });
      notifications.show({ title: 'Payment confirmed', message: '', color: 'blue' });
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
      navigate({ to: '/expenses' });
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
      <Group justify="space-between">
        <Group>
          <ActionIcon variant="subtle" component={Link} to="/expenses">
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Title order={2}>{expense.title}</Title>
        </Group>
        {isAdmin && (
          <Button
            variant="light"
            leftSection={<IconEdit size={16} />}
            component={Link}
            to={`/expenses/${expense.id}/edit`}
          >
            Edit
          </Button>
        )}
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
              <Table.Th>Details</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>Actions</Table.Th>
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
                  <Table.Td>
                    <Stack gap={2}>
                      {payment?.paid_at && (
                        <Text size="xs" c="dimmed">Paid: {formatDate(payment.paid_at)}</Text>
                      )}
                      {payment?.note && (
                        <Tooltip label={payment.note}>
                          <Group gap={4} style={{ cursor: 'pointer' }}>
                            <IconNote size={12} />
                            <Text size="xs" c="dimmed" truncate style={{ maxWidth: 120 }}>{payment.note}</Text>
                          </Group>
                        </Tooltip>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Group gap={4} justify="center">
                      {canToggle && paymentStatus === 'unpaid' && (
                        <ActionIcon variant="light" color="green" size="sm" onClick={() => handlePayClick(p.user_id)}>
                          <IconCheck size={14} />
                        </ActionIcon>
                      )}
                      {canToggle && paymentStatus === 'paid' && (
                        <ActionIcon variant="light" color="red" size="sm" onClick={() => handleUnpay(p.user_id)}>
                          <IconX size={14} />
                        </ActionIcon>
                      )}
                      {isAdmin && paymentStatus === 'paid' && (
                        <ActionIcon variant="light" color="blue" size="sm" onClick={() => handleConfirmPayment(p.user_id)}>
                          <IconCheckbox size={14} />
                        </ActionIcon>
                      )}
                    </Group>
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

      {/* Payment note modal */}
      <Modal opened={noteOpened} onClose={closeNote} title="Mark as paid" size="sm">
        <Stack gap="sm">
          <TextInput
            label="Payment note (optional)"
            placeholder="e.g. Bank transfer ref: ABC123"
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.currentTarget.value)}
          />
          <Button onClick={handleConfirmPay} loading={markPayment.isPending} fullWidth>
            Confirm payment
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
