import { createFileRoute, useNavigate } from '@tanstack/react-router';
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
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useEffect, useRef } from 'react';
import { ExpenseCategory } from '@commune/types';
import { useGroupStore } from '../../../stores/group';
import { useGroup } from '../../../hooks/use-groups';
import { useExpenseDetail, useUpdateExpense } from '../../../hooks/use-expenses';
import { PageLoader } from '../../../components/page-loader';
import { EmptyState } from '../../../components/empty-state';
import { PageHeader } from '../../../components/page-header';

export const Route = createFileRoute('/_app/expenses/$expenseId/edit')({
  component: EditExpensePage,
});

const categoryOptions = Object.entries(ExpenseCategory).map(([key, value]) => ({
  value,
  label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
}));

function EditExpensePage() {
  const { expenseId } = Route.useParams();
  const { activeGroupId } = useGroupStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const { data: expense, isLoading } = useExpenseDetail(expenseId);
  const updateExpense = useUpdateExpense(activeGroupId ?? '');
  const navigate = useNavigate();
  const lastHydratedExpenseRef = useRef<string | null>(null);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      title: '',
      description: '',
      category: 'miscellaneous',
      amount: 0,
      due_date: '',
      recurrence_type: 'none' as string,
    },
  });

  useEffect(() => {
    if (expense) {
      const hydrationKey = JSON.stringify({
        id: expense.id,
        title: expense.title,
        description: expense.description,
        category: expense.category,
        amount: expense.amount,
        due_date: expense.due_date,
        recurrence_type: expense.recurrence_type,
      });

      if (lastHydratedExpenseRef.current === hydrationKey) {
        return;
      }

      lastHydratedExpenseRef.current = hydrationKey;
      form.setValues({
        title: expense.title,
        description: expense.description ?? '',
        category: expense.category,
        amount: expense.amount,
        due_date: expense.due_date,
        recurrence_type: expense.recurrence_type,
      });
    }
  }, [expense, form]);

  if (!activeGroupId) {
    return (
      <EmptyState
        title="Select a group first"
        description="Choose a group before editing one of its expenses."
      />
    );
  }

  if (isLoading) {
    return <PageLoader message="Loading expense..." />;
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
        },
      });
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
        <Stack gap="lg">
          <Paper className="commune-soft-panel" p="xl">
            <Stack gap="md">
              <TextInput
                label="Title"
                withAsterisk
                                key={form.key('title')}
                {...form.getInputProps('title')}
              />
              <Group grow>
                <NumberInput
                  label="Amount"
                  prefix={group?.currency === 'GBP' ? '£' : ''}
                  min={0}
                  decimalScale={2}
                  withAsterisk
                                    key={form.key('amount')}
                  {...form.getInputProps('amount')}
                />
                <Select
                  label="Category"
                  data={categoryOptions}
                  withAsterisk
                                    key={form.key('category')}
                  {...form.getInputProps('category')}
                />
              </Group>
              <TextInput
                label="Due date"
                type="date"
                withAsterisk
                                key={form.key('due_date')}
                {...form.getInputProps('due_date')}
              />
              <Textarea
                label="Description"
                                autosize
                minRows={3}
                key={form.key('description')}
                {...form.getInputProps('description')}
              />
              <Select
                label="Recurrence"
                data={[
                  { value: 'none', label: 'None' },
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'monthly', label: 'Monthly' },
                ]}
                                key={form.key('recurrence_type')}
                {...form.getInputProps('recurrence_type')}
              />
            </Stack>
          </Paper>

          <Paper className="commune-soft-panel" p="xl">
            <Text size="sm" c="dimmed">
              This form edits the basic fields only. To change the split method or participants, archive the
              original expense and create a new one.
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
      </form>
    </Stack>
  );
}
