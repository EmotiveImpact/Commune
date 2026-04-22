import { createLazyFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Button,
  Grid,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArchive,
  IconAlertCircle,
  IconCheck,
  IconCheckbox,
  IconEdit,
  IconExternalLink,
  IconFlag,
  IconNote,
  IconPaperclip,
  IconReceipt,
  IconShieldCheck,
  IconUsers,
  IconWallet,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { setPageTitle } from '../../../utils/seo';
import { formatCurrency, formatDate, isOverdue } from '@commune/utils';
import { calculateReimbursements, buildPaymentUrl, canMemberApproveWithPolicy, isClickableProvider, getProviderDisplayName, getProviderSignupPrompt } from '@commune/core';
import type { PaymentProvider } from '@commune/types';
import {
  useArchiveExpense,
  useConfirmPayment,
  useExpenseDetail,
  useFlagExpense,
  useMarkPayment,
  useUnflagExpense,
} from '../../../hooks/use-expenses';
import { useApproveExpense, useRejectExpense } from '../../../hooks/use-approvals';
import { useGroupStore } from '../../../stores/group';
import { useGroup } from '../../../hooks/use-groups';
import { useAuthStore } from '../../../stores/auth';
import { useUploadReceipt, useDeleteReceipt } from '../../../hooks/use-receipts';
import { usePaymentMethods } from '../../../hooks/use-payment-methods';
import { getWorkspaceExpenseContext, hasWorkspaceExpenseContext } from '../../../hooks/use-expenses';
import { useWorkspaceGovernance } from '../../../hooks/use-workspace-governance';
import { ReceiptDropzone } from '../../../components/receipt-dropzone';
import { EmptyState } from '../../../components/empty-state';
import { ExpenseDetailSkeleton } from '../../../components/page-skeleton';
import { PageHeader } from '../../../components/page-header';
import { QueryErrorState } from '../../../components/query-error-state';

export const Route = createLazyFileRoute('/_app/expenses/$expenseId')({
  component: ExpenseDetailPage,
});

function formatCategoryLabel(category: string) {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function ExpenseDetailPage() {
  const { expenseId } = Route.useParams();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { data: expense, isLoading } = useExpenseDetail(expenseId);

  // Direct-link navigation: if we landed on an expense URL with no active
  // group selected, adopt the expense's group so subsequent mutations have
  // a scoped cache to invalidate.
  useEffect(() => {
    if (expense?.group_id && expense.group_id !== activeGroupId) {
      setActiveGroupId(expense.group_id);
    }
  }, [expense?.group_id, activeGroupId, setActiveGroupId]);

  const effectiveGroupId = activeGroupId ?? expense?.group_id ?? '';
  const {
    data: group,
    error: groupError,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup(effectiveGroupId);
  const markPayment = useMarkPayment(effectiveGroupId);
  const confirmPayment = useConfirmPayment(effectiveGroupId);
  const archive = useArchiveExpense(effectiveGroupId);
  const approveExpense = useApproveExpense(effectiveGroupId);
  const rejectExpense = useRejectExpense(effectiveGroupId);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const uploadReceipt = useUploadReceipt(effectiveGroupId);
  const deleteReceipt = useDeleteReceipt(effectiveGroupId);
  const workspaceGovernance = useWorkspaceGovernance(group);
  const flagExpenseMutation = useFlagExpense(effectiveGroupId || undefined);
  const unflagExpenseMutation = useUnflagExpense(effectiveGroupId || undefined);
  const [noteOpened, { open: openNote, close: closeNote }] = useDisclosure(false);
  const [flagOpened, { open: openFlag, close: closeFlag }] = useDisclosure(false);
  const [paymentNote, setPaymentNote] = useState('');
  const [flagReason, setFlagReason] = useState('');
  const [pendingPayment, setPendingPayment] = useState<{ userId: string } | null>(null);
  const paidByUserId = expense?.paid_by_user_id ?? '';
  const {
    data: paidByMethods,
    error: paymentMethodsError,
    isError: isPaymentMethodsError,
    refetch: refetchPaymentMethods,
  } = usePaymentMethods(paidByUserId);
  const workspaceContext = getWorkspaceExpenseContext(expense);
  const showWorkspaceContext = group?.type === 'workspace' || hasWorkspaceExpenseContext(expense);

  useEffect(() => {
    setPageTitle(expense?.title ?? 'Expense');
  }, [expense?.title]);

  if (isLoading) {
    return <ExpenseDetailSkeleton />;
  }

  if (!expense) {
    return (
      <EmptyState
        icon={IconReceipt}
        iconColor="emerald"
        title="Expense not found"
        description="This expense may have been archived or you may not have access to it anymore."
      />
    );
  }

  if (effectiveGroupId && isGroupError) {
    return (
      <QueryErrorState
        title="Failed to load expense details"
        error={groupError}
        onRetry={() => {
          void refetchGroup();
        }}
        icon={IconReceipt}
      />
    );
  }

  const isAdmin = group?.members.some((member) => member.user_id === user?.id && member.role === 'admin');
  const currentMember = group?.members.find((member) => member.user_id === user?.id) ?? null;
  const canApproveExpense = group?.type === 'workspace'
    ? canMemberApproveWithPolicy(currentMember, group?.approval_policy)
    : isAdmin;
  const overdue = isOverdue(expense.due_date);
  const expenseData = expense;
  const reimbursements = expense.paid_by_user_id
    ? calculateReimbursements(
        expense.participants.map((participant) => ({
          userId: participant.user_id,
          amount: participant.share_amount,
        })),
        expense.paid_by_user_id,
      )
    : [];
  const paidCount = expense.payment_records.filter((payment) => payment.status !== 'unpaid').length;
  const confirmedCount = expense.payment_records.filter((payment) => payment.status === 'confirmed').length;
  const approvalStatus = expense.approval_status ?? 'approved';
  const isApprovalBlocked = approvalStatus !== 'approved';
  const missingParticipantProfileCount = expense.participants.filter((participant) => !participant.user).length;

  // Fetch payment methods for the person who paid upfront
  const defaultMethod = paidByMethods?.find((m) => m.is_default) ?? paidByMethods?.[0] ?? null;
  const paymentLinkResult = defaultMethod?.provider && defaultMethod?.payment_link
    && isClickableProvider(defaultMethod.provider as PaymentProvider)
    ? buildPaymentUrl(
        { provider: defaultMethod.provider as PaymentProvider, link: defaultMethod.payment_link },
      )
    : null;

  const statusColor: Record<string, string> = {
    unpaid: 'orange',
    paid: 'emerald',
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
        expenseId: expenseData.id,
        userId: pendingPayment.userId,
        status: 'paid',
        note: paymentNote || undefined,
      });
      notifications.show({
        title: 'Marked as paid',
        message: '',
        color: 'green',
      });
      closeNote();
      setPendingPayment(null);
    } catch (err) {
      notifications.show({
        title: 'Failed to update payment',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  async function handleUnpay(userId: string) {
    try {
      await markPayment.mutateAsync({
        expenseId: expenseData.id,
        userId,
        status: 'unpaid',
      });
      notifications.show({
        title: 'Marked as unpaid',
        message: '',
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to update payment',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  async function handleConfirmPayment(userId: string) {
    try {
      await confirmPayment.mutateAsync({
        expenseId: expenseData.id,
        userId,
        confirmedBy: user!.id,
      });
      notifications.show({
        title: 'Payment confirmed',
        message: '',
        color: 'blue',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to confirm payment',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  async function handleArchive() {
    try {
      await archive.mutateAsync(expenseData.id);
      notifications.show({
        title: 'Expense archived',
        message: '',
        color: 'green',
      });
      navigate({ to: '/expenses' });
    } catch (err) {
      notifications.show({
        title: 'Failed to archive expense',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  async function handleReceiptUpload(file: File | null) {
    if (!file || !user) return;

    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      notifications.show({
        title: 'File too large',
        message: 'Please choose a file under 10 MB.',
        color: 'red',
      });
      return;
    }

    try {
      await uploadReceipt.mutateAsync({
        file,
        userId: user.id,
        expenseId: expenseData.id,
      });
      notifications.show({
        title: 'Receipt uploaded',
        message: 'The receipt has been attached to this expense.',
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Upload failed',
        message: err instanceof Error ? err.message : 'Could not upload receipt. Try again.',
        color: 'red',
      });
    }
  }

  async function handleDeleteReceipt() {
    try {
      await deleteReceipt.mutateAsync(expenseData.id);
      notifications.show({
        title: 'Receipt removed',
        message: 'The receipt has been deleted.',
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to remove receipt',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  async function handleFlagExpense() {
    if (!flagReason.trim()) return;
    try {
      await flagExpenseMutation.mutateAsync({ expenseId: expenseData.id, reason: flagReason.trim() });
      notifications.show({
        title: 'Expense queried',
        message: 'Your query has been submitted for this expense.',
        color: 'orange',
      });
      closeFlag();
      setFlagReason('');
    } catch (err) {
      notifications.show({
        title: 'Failed to query expense',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  async function handleUnflagExpense() {
    try {
      await unflagExpenseMutation.mutateAsync(expenseData.id);
      notifications.show({
        title: 'Query dismissed',
        message: 'The expense query has been dismissed.',
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to dismiss query',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  // Resolve flagger name from group members
  const flaggedBy = expense.flagged_by ?? [];
  const flaggerName = flaggedBy.length > 0
    ? group?.members.find((m) => m.user_id === flaggedBy[0])?.user?.name ?? 'A member'
    : null;

  // Resolve approver name from group members
  const approverName = expense.approved_by
    ? group?.members.find((m) => m.user_id === expense.approved_by)?.user?.name ?? 'Unknown'
    : null;

  return (
    <Stack gap="xl">
      <PageHeader
        title={expense.title}
        subtitle={expense.description || 'Review the split, payment status, and who this expense affects.'}
      >
        <Group gap="xs" wrap="wrap">
          <Badge variant="light" color="gray">
            {formatCategoryLabel(expense.category)}
          </Badge>
          {showWorkspaceContext && (
            <Badge variant="light" color="indigo">
              Workspace context
            </Badge>
          )}
          {approvalStatus === 'pending' && (
            <Badge variant="light" color="orange">
              Pending approval
            </Badge>
          )}
          {approvalStatus === 'rejected' && (
            <Badge variant="light" color="red">
              Rejected
            </Badge>
          )}
          {expense.recurrence_type !== 'none' && (
            <Badge variant="light" color="emerald">
              Recurring {expense.recurrence_type}
            </Badge>
          )}
          {overdue && <Badge color="red">Overdue</Badge>}
          {isAdmin && (
            <Button
              variant="default"
              leftSection={<IconEdit size={16} />}
              component={Link}
              to={`/expenses/${expense.id}/edit`}
            >
              Edit
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="light"
              color="red"
              leftSection={<IconArchive size={16} />}
              onClick={handleArchive}
            >
              Archive
            </Button>
          )}
          {!isAdmin && currentMember && (
            <Button
              variant="light"
              color="orange"
              leftSection={<IconFlag size={16} />}
              onClick={openFlag}
            >
              Query this expense
            </Button>
          )}
        </Group>
      </PageHeader>

      {flaggedBy.length > 0 && (
        <Alert
          variant="light"
          color="orange"
          title="This expense has been queried"
          icon={<IconFlag size={18} />}
        >
          <Group justify="space-between" align="center" wrap="wrap">
            <Text size="sm">
              Queried by {flaggerName} &mdash; {expense.flagged_reason ?? 'No reason provided'}
            </Text>
            {isAdmin && (
              <Button
                size="compact-sm"
                variant="light"
                color="orange"
                onClick={handleUnflagExpense}
                loading={unflagExpenseMutation.isPending}
              >
                Dismiss
              </Button>
            )}
          </Group>
        </Alert>
      )}

      {approvalStatus === 'approved' && expense.approved_by && (
        <Alert variant="light" color="green" icon={<IconCheck size={18} />}>
          <Text size="sm">
            Approved by {approverName} on {expense.approved_at ? formatDate(expense.approved_at) : 'unknown date'}
          </Text>
        </Alert>
      )}

      {approvalStatus === 'rejected' && expense.approved_by && (
        <Alert variant="light" color="red" icon={<IconX size={18} />}>
          <Text size="sm">
            Rejected by {approverName} on {expense.approved_at ? formatDate(expense.approved_at) : 'unknown date'}
          </Text>
        </Alert>
      )}

      {approvalStatus === 'pending' && (
        <Paper className="commune-soft-panel" p="md" style={{ borderLeft: '4px solid var(--mantine-color-orange-5)' }}>
          <Stack gap="sm">
            <div>
              <Text fw={600} size="sm">This expense is waiting for workspace approval.</Text>
              <Text size="sm" c="dimmed">
                Settlement and payment actions stay disabled until it is approved.
              </Text>
            </div>
            {canApproveExpense && (
              <Group gap="xs">
                <Button
                  size="compact-sm"
                  color="green"
                  leftSection={<IconCheck size={14} />}
                  loading={approveExpense.isPending}
                  onClick={() => {
                    approveExpense.mutate(expense.id, {
                      onSuccess: () => {
                        notifications.show({
                          title: 'Expense approved',
                          message: `${expense.title} is now live in balances and settlements.`,
                          color: 'green',
                        });
                      },
                    });
                  }}
                >
                  Approve expense
                </Button>
                <Button
                  size="compact-sm"
                  color="red"
                  variant="light"
                  leftSection={<IconX size={14} />}
                  loading={rejectExpense.isPending}
                  onClick={() => {
                    rejectExpense.mutate(expense.id, {
                      onSuccess: () => {
                        notifications.show({
                          title: 'Expense rejected',
                          message: `${expense.title} will stay out of balances until it is edited and resubmitted.`,
                          color: 'red',
                        });
                      },
                    });
                  }}
                >
                  Reject expense
                </Button>
              </Group>
            )}
          </Stack>
        </Paper>
      )}

      {approvalStatus === 'rejected' && (
        <Paper className="commune-soft-panel" p="md" style={{ borderLeft: '4px solid var(--mantine-color-red-5)' }}>
          <Text fw={600} size="sm">This expense was rejected.</Text>
          <Text size="sm" c="dimmed">
            It no longer affects balances, and payment actions are disabled.
          </Text>
        </Paper>
      )}

      {missingParticipantProfileCount > 0 && (
        <Alert
          color="yellow"
          variant="light"
          icon={<IconAlertCircle size={18} />}
          title="Some participant profiles are temporarily unavailable"
        >
          {missingParticipantProfileCount} participant{missingParticipantProfileCount === 1 ? '' : 's'} were shown with fallback labels because their profile rows did not load cleanly.
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        <Paper className="commune-stat-card" p="lg">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">Total amount</Text>
              <Text fw={800} size="1.9rem">{formatCurrency(expense.amount, expense.currency)}</Text>
              <Text size="sm" c="dimmed">Due {formatDate(expense.due_date)}</Text>
            </Stack>
            <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'var(--commune-icon-bg-primary)', color: 'var(--commune-primary-strong)' }}>
              <IconReceipt size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper className="commune-stat-card" p="lg">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">Participants</Text>
              <Text fw={800} size="1.9rem">{expense.participants.length}</Text>
              <Text size="sm" c="dimmed">Included in the split</Text>
            </Stack>
            <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'var(--commune-icon-bg-forest)', color: 'var(--commune-forest)' }}>
              <IconUsers size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper className="commune-stat-card" p="lg">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">Marked paid</Text>
              <Text fw={800} size="1.9rem">{paidCount}</Text>
              <Text size="sm" c="dimmed">Payments submitted</Text>
            </Stack>
            <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'var(--commune-icon-bg-success)', color: 'var(--commune-forest-soft)' }}>
              <IconCheck size={20} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper className="commune-stat-card" p="lg">
          <Group justify="space-between">
            <Stack gap={2}>
              <Text size="sm" c="dimmed">Confirmed</Text>
              <Text fw={800} size="1.9rem">{confirmedCount}</Text>
              <Text size="sm" c="dimmed">Admin-approved payments</Text>
            </Stack>
            <ThemeIcon size={42} variant="light" style={{ backgroundColor: 'var(--commune-icon-bg-info)', color: 'var(--commune-icon-info)' }}>
              <IconCheckbox size={20} />
            </ThemeIcon>
          </Group>
        </Paper>
      </SimpleGrid>

      <Grid gap="xl">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Paper className="commune-soft-panel" p="xl">
            <Group justify="space-between" align="flex-start" mb="lg">
              <div>
                <Text fw={700} size="lg">Split breakdown</Text>
                <Text size="sm" c="dimmed">
                  Who owes what, who paid already, and who still needs to settle.
                </Text>
              </div>
              {expense.paid_by_user && (
                <Badge variant="light" color="gray">
                  Paid upfront by {expense.paid_by_user.name}
                </Badge>
              )}
            </Group>

            <div style={{ overflowX: 'auto' }}>
              <Table verticalSpacing="md" horizontalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Person</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Share</Table.Th>
                    {expense.paid_by_user_id && (
                      <Table.Th style={{ textAlign: 'right' }}>Owes to</Table.Th>
                    )}
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Details</Table.Th>
                    <Table.Th style={{ textAlign: 'center' }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {expense.participants.map((participant) => {
                    const payment = expense.payment_records.find((record) => record.user_id === participant.user_id);
                    const paymentStatus = payment?.status ?? 'unpaid';
                    const reimbursement = reimbursements.find((item) => item.userId === participant.user_id);
                    const canToggle = participant.user_id === user?.id || isAdmin;
                    const participantName = participant.user?.name ?? 'Unknown member';
                    const participantAvatarUrl = participant.user?.avatar_url ?? null;

                    return (
                      <Table.Tr key={participant.id}>
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <Avatar src={participantAvatarUrl} name={participantName} color="initials" size="sm" />
                            <Text size="sm" fw={600}>{participantName}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm" fw={700}>
                            {formatCurrency(participant.share_amount, expense.currency)}
                          </Text>
                        </Table.Td>
                        {expense.paid_by_user_id && (
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="sm" c="dimmed">
                              {reimbursement ? expense.paid_by_user?.name : '—'}
                            </Text>
                          </Table.Td>
                        )}
                        <Table.Td>
                          <Badge color={statusColor[paymentStatus] ?? 'gray'} variant="light">
                            {paymentStatus}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={2}>
                            {payment?.paid_at && (
                              <Text size="xs" c="dimmed">
                                Paid {formatDate(payment.paid_at)}
                              </Text>
                            )}
                            {payment?.note && (
                              <Tooltip label={payment.note}>
                                <Group gap={4} style={{ cursor: 'pointer' }}>
                                  <IconNote size={12} />
                                  <Text size="xs" c="dimmed" truncate style={{ maxWidth: 120 }}>
                                    {payment.note}
                                  </Text>
                                </Group>
                              </Tooltip>
                            )}
                          </Stack>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          <Group gap={4} justify="center">
                            {!isApprovalBlocked && canToggle && paymentStatus === 'unpaid' && reimbursement && paymentLinkResult && (
                              <Tooltip label={`${paymentLinkResult.label} — ${formatCurrency(reimbursement.amount, expense.currency)}`}>
                                <ActionIcon
                                  variant="filled"
                                  color="emerald"
                                  component="a"
                                  href={buildPaymentUrl({ provider: paymentLinkResult.provider, link: defaultMethod?.payment_link ?? '' }, reimbursement.amount)?.url ?? '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Pay ${expense.paid_by_user?.name} via ${getProviderDisplayName(paymentLinkResult.provider)}`}
                                >
                                  <IconExternalLink size={16} />
                                </ActionIcon>
                              </Tooltip>
                            )}
                            {!isApprovalBlocked && canToggle && paymentStatus === 'unpaid' && (
                              <ActionIcon variant="light" color="emerald" onClick={() => handlePayClick(participant.user_id)} aria-label={`Mark ${participantName} as paid`}>
                                <IconCheck size={16} />
                              </ActionIcon>
                            )}
                            {!isApprovalBlocked && canToggle && paymentStatus === 'paid' && (
                              <ActionIcon variant="light" color="red" onClick={() => handleUnpay(participant.user_id)} aria-label={`Mark ${participantName} as unpaid`}>
                                <IconX size={16} />
                              </ActionIcon>
                            )}
                            {!isApprovalBlocked && isAdmin && paymentStatus === 'paid' && (
                              <ActionIcon variant="light" color="blue" onClick={() => handleConfirmPayment(participant.user_id)} aria-label={`Confirm payment from ${participantName}`}>
                                <IconCheckbox size={16} />
                              </ActionIcon>
                            )}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </div>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Paper className="commune-soft-panel" p="xl">
            <Group justify="space-between" align="flex-start" mb="lg">
              <div>
                <Group gap="xs">
                  <IconPaperclip size={20} />
                  <Text fw={700} size="lg">Receipt</Text>
                </Group>
                <Text size="sm" c="dimmed">
                  Attach a photo or PDF of the receipt for this expense.
                </Text>
              </div>
            </Group>

            <ReceiptDropzone
              existingUrl={expense.receipt_url}
              onChange={handleReceiptUpload}
              onDelete={isAdmin ? handleDeleteReceipt : undefined}
              deleteLoading={deleteReceipt.isPending}
              uploading={uploadReceipt.isPending}
              disabled={uploadReceipt.isPending}
            />
          </Paper>

          {showWorkspaceContext && (
            <Paper className="commune-soft-panel" p="xl">
              <Stack gap="md">
                <Group gap="xs" align="center">
                  <IconReceipt size={20} />
                  <Text fw={700} size="lg">Workspace context</Text>
                </Group>
                <Text size="sm" c="dimmed">
                  Vendor and invoice details stay attached to the expense so workspace bills are easier to trace.
                </Text>
                <Stack gap={6}>
                  <Group justify="space-between" gap="sm" wrap="nowrap">
                    <Text size="sm" c="dimmed">Vendor</Text>
                    <Text size="sm" fw={600} ta="right">
                      {workspaceContext.vendor_name || 'Not set'}
                    </Text>
                  </Group>
                  <Group justify="space-between" gap="sm" wrap="nowrap">
                    <Text size="sm" c="dimmed">Invoice reference</Text>
                    <Text size="sm" fw={600} ta="right">
                      {workspaceContext.invoice_reference || 'Not set'}
                    </Text>
                  </Group>
                  <Group justify="space-between" gap="sm" wrap="nowrap">
                    <Text size="sm" c="dimmed">Invoice date</Text>
                    <Text size="sm" fw={600} ta="right">
                      {workspaceContext.invoice_date ? formatDate(workspaceContext.invoice_date) : 'Not set'}
                    </Text>
                  </Group>
                  <Group justify="space-between" gap="sm" wrap="nowrap">
                    <Text size="sm" c="dimmed">Payment due date</Text>
                    <Text size="sm" fw={600} ta="right">
                      {workspaceContext.payment_due_date
                        ? formatDate(workspaceContext.payment_due_date)
                        : 'Not set'}
                    </Text>
                  </Group>
                </Stack>
              </Stack>
            </Paper>
          )}

          {workspaceGovernance.isWorkspaceGroup && (
            <Paper className="commune-soft-panel" p="xl">
              <Stack gap="md">
                <Group gap="xs" align="center">
                  <IconShieldCheck size={20} />
                  <Text fw={700} size="lg">Workspace approval chain</Text>
                </Group>
                <Text size="sm" c="dimmed">
                  {workspaceGovernance.approvalSummary}
                </Text>
                <Group gap={6} wrap="wrap">
                  {workspaceGovernance.rolePresets.slice(0, 3).map((role) => (
                    <Badge key={role.label} variant="light" color="gray">
                      {role.label}
                    </Badge>
                  ))}
                </Group>
                <Stack gap={4}>
                  {workspaceGovernance.approvalChain.map((step, index) => (
                    <Paper key={step.label} withBorder radius="md" p="sm">
                      <Group justify="space-between" align="flex-start" gap="sm">
                        <div>
                          <Text fw={600} size="sm">
                            {index + 1}. {step.label}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {step.description}
                          </Text>
                        </div>
                        <Badge variant="light" color={index === workspaceGovernance.approvalChain.length - 1 ? 'emerald' : 'gray'}>
                          {index === workspaceGovernance.approvalChain.length - 1 ? 'Final' : 'Review'}
                        </Badge>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          )}

          {expense.paid_by_user && !isApprovalBlocked && (
            <Paper className="commune-soft-panel" p="xl">
              <Group gap="xs" mb="md">
                <IconWallet size={20} />
                <Text fw={700} size="lg">Pay {expense.paid_by_user.name}</Text>
              </Group>

              {isPaymentMethodsError ? (
                <QueryErrorState
                  title="Failed to load payment options"
                  error={paymentMethodsError}
                  onRetry={() => {
                    void refetchPaymentMethods();
                  }}
                  icon={IconWallet}
                />
              ) : paymentLinkResult ? (
                <Stack gap="md">
                  <Text size="sm" c="dimmed">
                    {expense.paid_by_user.name} accepts payments via {getProviderDisplayName(paymentLinkResult.provider)}.
                    Click below to pay your share directly.
                  </Text>
                  {reimbursements
                    .filter((r) => r.userId === user?.id)
                    .map((r) => {
                      const link = buildPaymentUrl(
                        { provider: paymentLinkResult.provider, link: defaultMethod?.payment_link ?? '' },
                        r.amount,
                      );
                      if (!link) return null;
                      return (
                        <Button
                          key={r.userId}
                          component="a"
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          leftSection={<IconExternalLink size={16} />}
                          fullWidth
                        >
                          {link.label} — {formatCurrency(r.amount, expense.currency)}
                        </Button>
                      );
                    })}
                  {!reimbursements.some((r) => r.userId === user?.id) && (
                    <Text size="sm" c="dimmed">
                      You don&apos;t owe anything for this expense.
                    </Text>
                  )}
                  {(() => {
                    const signupPrompt = getProviderSignupPrompt(paymentLinkResult.provider);
                    return signupPrompt ? (
                      <Text size="xs" c="dimmed" ta="center">
                        {signupPrompt.message}{' '}
                        <Text
                          component="a"
                          href={signupPrompt.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="xs"
                          c="indigo"
                          td="underline"
                        >
                          {signupPrompt.cta}
                        </Text>
                      </Text>
                    ) : null;
                  })()}
                </Stack>
              ) : defaultMethod?.payment_info ? (
                <Stack gap="sm">
                  <Text size="sm" c="dimmed">Payment details:</Text>
                  <Paper p="sm" bg="gray.0" radius="md">
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{defaultMethod.payment_info}</Text>
                  </Paper>
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">
                  {expense.paid_by_user.name} hasn&apos;t set up a payment link yet.
                  {isAdmin && ' Go to Settings to add one.'}
                </Text>
              )}
            </Paper>
          )}
        </Grid.Col>
      </Grid>

      <Modal opened={noteOpened} onClose={closeNote} title="Mark as paid" size="sm">
        <Stack gap="sm">
          <TextInput
            label="Payment note (optional)"
            placeholder="e.g. Bank transfer ref: ABC123"
            value={paymentNote}
            onChange={(event) => setPaymentNote(event.currentTarget.value)}
                      />
          <Button onClick={handleConfirmPay} loading={markPayment.isPending} fullWidth>
            Confirm payment
          </Button>
        </Stack>
      </Modal>

      <Modal opened={flagOpened} onClose={closeFlag} title="Query this expense" size="sm">
        <Stack gap="sm">
          <TextInput
            label="Reason for querying"
            placeholder="e.g. The amount looks incorrect"
            value={flagReason}
            onChange={(event) => setFlagReason(event.currentTarget.value)}
          />
          <Button
            onClick={handleFlagExpense}
            loading={flagExpenseMutation.isPending}
            color="orange"
            fullWidth
            disabled={!flagReason.trim()}
          >
            Submit query
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
