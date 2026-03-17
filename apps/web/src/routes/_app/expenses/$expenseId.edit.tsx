import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Title, Stack, TextInput, NumberInput, Select, Textarea,
  Button, Card, Text, Group,
  Center, Loader,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useEffect } from 'react';
import { ExpenseCategory } from '@commune/types';
import { useGroupStore } from '../../../stores/group';
import { useGroup } from '../../../hooks/use-groups';
import { useExpenseDetail, useUpdateExpense } from '../../../hooks/use-expenses';

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

  // Populate form when expense loads
  useEffect(() => {
    if (expense) {
      form.setValues({
        title: expense.title,
        description: expense.description ?? '',
        category: expense.category,
        amount: expense.amount,
        due_date: expense.due_date,
        recurrence_type: expense.recurrence_type,
      });
    }
  }, [expense]);

  if (!activeGroupId) return <Text c="dimmed">Select a group first.</Text>;
  if (isLoading) return <Center h={400}><Loader /></Center>;
  if (!expense) return <Text c="dimmed">Expense not found.</Text>;

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
      notifications.show({ title: 'Expense updated', message: '', color: 'green' });
      navigate({ to: `/expenses/${expenseId}` });
    } catch (err) {
      notifications.show({
        title: 'Failed',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  return (
    <Stack>
      <Title order={2}>Edit expense</Title>
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Card withBorder padding="md">
            <Stack gap="sm">
              <TextInput label="Title" withAsterisk key={form.key('title')} {...form.getInputProps('title')} />
              <Group grow>
                <NumberInput label="Amount" prefix="£" min={0} decimalScale={2} withAsterisk key={form.key('amount')} {...form.getInputProps('amount')} />
                <Select label="Category" data={categoryOptions} withAsterisk key={form.key('category')} {...form.getInputProps('category')} />
              </Group>
              <TextInput label="Due date" type="date" withAsterisk key={form.key('due_date')} {...form.getInputProps('due_date')} />
              <Textarea label="Description" key={form.key('description')} {...form.getInputProps('description')} />
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
          </Card>

          <Text size="sm" c="dimmed">
            Note: Editing basic fields only. To change split method or participants, archive and create a new expense.
          </Text>

          <Group>
            <Button type="submit" loading={updateExpense.isPending}>
              Save changes
            </Button>
            <Button variant="light" onClick={() => navigate({ to: `/expenses/${expenseId}` })}>
              Cancel
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}
