import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconFileAlert } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { ExpenseCategory } from '@commune/types';
import { uploadReceipt } from '@commune/api';
import { useGroupStore } from '../../../stores/group';
import { useGroup } from '../../../hooks/use-groups';
import {
  getWorkspaceExpenseContext,
  toWorkspaceExpenseContextPayload,
  useExpenseDetail,
  useUpdateExpense,
} from '../../../hooks/use-expenses';
import { useAuthStore } from '../../../stores/auth';
import { ExpenseFormSkeleton } from '../../../components/page-skeleton';
import { EmptyState } from '../../../components/empty-state';
import { PageHeader } from '../../../components/page-header';
import { ReceiptDropzone } from '../../../components/receipt-dropzone';
import { QueryErrorState } from '../../../components/query-error-state';

export const Route = createLazyFileRoute('/_app/expenses/$expenseId/edit')({
  component: EditExpensePage,
});

const categoryOptions = Object.entries(ExpenseCategory).map(([key, value]) => ({
  value,
  label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
}));

export function EditExpensePage() {
  const { expenseId } = Route.useParams();
  const { activeGroupId } = useGroupStore();
  const {
    data: group,
    error: groupError,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroup(activeGroupId ?? '');
  const { data: expense, isLoading } = useExpenseDetail(expenseId);
  const updateExpense = useUpdateExpense(activeGroupId ?? '');
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const form = useForm({
    initialValues: {
      title: '',
      description: '',
      category: 'miscellaneous',
      amount: 0,
      due_date: '',
      recurrence_type: 'none' as string,
      vendor_name: '',
      invoice_reference: '',
      invoice_date: '',
      payment_due_date: '',
    },
  });

  useEffect(() => {
    if (expense) {
      const context = getWorkspaceExpenseContext(expense);
      form.setValues({
        title: expense.title,
        description: expense.description ?? '',
        category: expense.category,
        amount: expense.amount,
        due_date: expense.due_date,
        recurrence_type: expense.recurrence_type,
        ...context,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense?.id, expense?.updated_at]);

  if (!activeGroupId) {
    return (
      <EmptyState
        title="Select a group first"
        description="Choose a group before editing one of its expenses."
      />
    );
  }

  if (isLoading) {
    return <ExpenseFormSkeleton />;
  }

  if (isGroupError) {
    return (
      <QueryErrorState
        title="Failed to load expense editor"
        error={groupError}
        onRetry={() => {
          void refetchGroup();
        }}
        icon={IconFileAlert}
      />
    );
  }

  if (!expense) {
    return (
      <EmptyState
        title="Expense not found"
        description="This expense may have been archived or removed."
      />
    );
  }

  async function handleSubmit(values: ReturnType<typeof form.getValues>) {
    try {
      await updateExpense.mutateAsync({
        expenseId,
        data: {
          title: values.title,
          description: values.description || undefined,
          category: values.category,
          amount: values.amount,
          due_date: values.due_date,
          recurrence_type: values.recurrence_type,
          ...toWorkspaceExpenseContextPayload({
            vendor_name: values.vendor_name,
            invoice_reference: values.invoice_reference,
            invoice_date: values.invoice_date,
            payment_due_date: values.payment_due_date,
          }),
        },
      });

      // Upload receipt if a file was selected
      if (receiptFile && user) {
        try {
          await uploadReceipt(receiptFile, user.id, expenseId);
        } catch {
          notifications.show({
            title: 'Receipt upload failed',
            message: 'The expense was updated but the receipt could not be attached.',
            color: 'orange',
          });
        }
      }

      notifications.show({
        title: 'Expense updated',
        message: '',
        color: 'green',
      });
      navigate({ to: `/expenses/${expenseId}` });
    } catch (err) {
      notifications.show({
        title: 'Failed to update expense',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="Edit expense"
        subtitle="Update the amount, dates, category, and description"
      />

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <div className="commune-expense-form-grid">
          <Stack gap="lg">
            <Paper className="commune-soft-panel" p="xl">
              <Stack gap="md">
                <TextInput
                  label="Title"
                  withAsterisk
                  {...form.getInputProps('title')}
                />
                <Group grow>
                  <NumberInput
                    label="Amount"
                    prefix={group?.currency === 'GBP' ? '£' : ''}
                    min={0}
                    decimalScale={2}
                    withAsterisk
                    {...form.getInputProps('amount')}
                  />
                  <Select
                    label="Category"
                    data={categoryOptions}
                    withAsterisk
                    {...form.getInputProps('category')}
                  />
                </Group>
                <TextInput
                  label="Due date"
                  type="date"
                  withAsterisk
                  {...form.getInputProps('due_date')}
                />
                <Textarea
                  label="Description"
                  autosize
                  minRows={3}
                  {...form.getInputProps('description')}
                />
                <Select
                  label="Recurrence"
                  data={[
                    { value: 'none', label: 'None' },
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'monthly', label: 'Monthly' },
                  ]}
                  {...form.getInputProps('recurrence_type')}
                />
              </Stack>
            </Paper>

            {(group?.type === 'workspace' || Object.values(getWorkspaceExpenseContext(expense)).some(Boolean)) && (
              <Paper className="commune-soft-panel" p="xl">
                <Stack gap="md">
                  <Text fw={700} size="lg">
                    Workspace context
                  </Text>
                  <Text size="sm" c="dimmed">
                    Optional fields for vendor invoices, subscriptions, and internal cost tracking.
                  </Text>
                  <Group grow align="flex-start">
                    <TextInput
                      label="Vendor / supplier"
                      placeholder="e.g. OfficeCo"
                      {...form.getInputProps('vendor_name')}
                    />
                    <TextInput
                      label="Invoice reference"
                      placeholder="e.g. INV-1042"
                      {...form.getInputProps('invoice_reference')}
                    />
                  </Group>
                  <Group grow align="flex-start">
                    <TextInput
                      label="Invoice date"
                      type="date"
                      description="Optional issue date from the vendor invoice."
                      {...form.getInputProps('invoice_date')}
                    />
                    <TextInput
                      label="Payment due date"
                      type="date"
                      description="Optional vendor due date if it differs from the expense due date."
                      {...form.getInputProps('payment_due_date')}
                    />
                  </Group>
                </Stack>
              </Paper>
            )}

            <Paper className="commune-soft-panel" p="xl">
              <Text size="sm" c="dimmed">
                Split method and participant changes still require a new expense, but vendor and invoice context
                can be updated here.
              </Text>
            </Paper>

            <Group>
              <Button type="submit" loading={updateExpense.isPending}>
                Save changes
              </Button>
              <Button variant="default" onClick={() => navigate({ to: `/expenses/${expenseId}` })}>
                Cancel
              </Button>
            </Group>
          </Stack>

          <div className="commune-receipt-sidebar">
            <Paper className="commune-soft-panel" p="xl">
              <Stack gap="md">
                <Title order={3}>Receipt</Title>
                <Text size="sm" c="dimmed">
                  Attach or replace the receipt photo or PDF (optional).
                </Text>
                <ReceiptDropzone
                  value={receiptFile}
                  onChange={setReceiptFile}
                />
              </Stack>
            </Paper>
          </div>
        </div>
      </form>
    </Stack>
  );
}
