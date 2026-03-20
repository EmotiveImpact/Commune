import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Group,
  MultiSelect,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useMemo, useState } from 'react';
import { ExpenseCategory } from '@commune/types';
import { calculateEqualSplit, calculatePercentageSplit } from '@commune/core';
import { formatCurrency } from '@commune/utils';
import { useGroupStore } from '../../../stores/group';
import { useGroup } from '../../../hooks/use-groups';
import { useCreateExpense } from '../../../hooks/use-expenses';
import { PageLoader } from '../../../components/page-loader';
import { EmptyState } from '../../../components/empty-state';
import { PageHeader } from '../../../components/page-header';

export const Route = createFileRoute('/_app/expenses/new')({
  component: AddExpensePage,
});

const categoryOptions = Object.entries(ExpenseCategory).map(([key, value]) => ({
  value,
  label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
}));

function AddExpensePage() {
  const { activeGroupId } = useGroupStore();
  const { data: group, isLoading } = useGroup(activeGroupId ?? '');
  const createExpense = useCreateExpense(activeGroupId ?? '');
  const navigate = useNavigate();
  const [splitMethod, setSplitMethod] = useState<string>('equal');
  const [isRecurring, setIsRecurring] = useState(false);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      title: '',
      description: '',
      amount: 0,
      category: 'miscellaneous',
      due_date: '',
      recurrence_type: 'none' as string,
      paid_by_user_id: '' as string,
      participant_ids: [] as string[],
      percentages: {} as Record<string, number>,
      custom_amounts: {} as Record<string, number>,
    },
  });

  const memberOptions = useMemo(
    () =>
      (group?.members ?? [])
        .filter((member) => member.status === 'active')
        .map((member) => ({ value: member.user_id, label: member.user.name })),
    [group],
  );

  const paidByOptions = useMemo(
    () => [{ value: '', label: 'Nobody (group expense)' }, ...memberOptions],
    [memberOptions],
  );

  if (!activeGroupId) {
    return (
      <EmptyState
        title="Select a group first"
        description="Choose a group from the sidebar before creating a shared expense."
      />
    );
  }

  if (isLoading) {
    return <PageLoader message="Loading expense form..." />;
  }

  const selectedParticipants = form.getValues().participant_ids;
  const amount = form.getValues().amount || 0;

  let splitPreview: { userId: string; name: string; amount: number }[] = [];
  if (selectedParticipants.length > 0 && amount > 0) {
    if (splitMethod === 'equal') {
      const shares = calculateEqualSplit(amount, selectedParticipants.length);
      splitPreview = selectedParticipants.map((id, index) => ({
        userId: id,
        name: group?.members.find((member) => member.user_id === id)?.user.name ?? id,
        amount: shares[index] ?? 0,
      }));
    } else if (splitMethod === 'percentage') {
      const percentages = form.getValues().percentages;
      const entries = selectedParticipants.map((id) => ({
        userId: id,
        percentage: percentages[id] ?? 0,
      }));
      const totalPct = entries.reduce((sum, entry) => sum + entry.percentage, 0);
      if (Math.abs(totalPct - 100) < 0.01) {
        const result = calculatePercentageSplit(amount, entries);
        splitPreview = result.map((entry) => ({
          userId: entry.userId,
          name: group?.members.find((member) => member.user_id === entry.userId)?.user.name ?? entry.userId,
          amount: entry.amount,
        }));
      }
    } else if (splitMethod === 'custom') {
      const customAmounts = form.getValues().custom_amounts;
      splitPreview = selectedParticipants.map((id) => ({
        userId: id,
        name: group?.members.find((member) => member.user_id === id)?.user.name ?? id,
        amount: customAmounts[id] ?? 0,
      }));
    }
  }

  async function handleSubmit(values: ReturnType<typeof form.getValues>) {
    if (!activeGroupId) return;

    const expenseData: Parameters<typeof createExpense.mutateAsync>[0] = {
      group_id: activeGroupId,
      title: values.title,
      description: values.description || undefined,
      category: values.category,
      amount: values.amount,
      currency: group?.currency ?? 'GBP',
      due_date: values.due_date,
      recurrence_type: isRecurring ? values.recurrence_type : 'none',
      split_method: splitMethod as 'equal' | 'percentage' | 'custom',
      paid_by_user_id: values.paid_by_user_id || undefined,
      participant_ids: values.participant_ids,
    };

    if (splitMethod === 'percentage') {
      expenseData.percentages = values.participant_ids.map((id) => ({
        userId: id,
        percentage: values.percentages[id] ?? 0,
      }));
    } else if (splitMethod === 'custom') {
      expenseData.custom_amounts = values.participant_ids.map((id) => ({
        userId: id,
        amount: values.custom_amounts[id] ?? 0,
      }));
    }

    try {
      await createExpense.mutateAsync(expenseData);
      notifications.show({
        title: 'Expense created',
        message: `${values.title} added`,
        color: 'green',
      });
      navigate({ to: '/expenses' });
    } catch (err) {
      notifications.show({
        title: 'Failed to create expense',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="Add expense"
        subtitle="Create a new shared cost, pick participants, and preview the split"
      />

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <div className="commune-dashboard-grid">
          <Stack gap="lg">
            <Paper className="commune-soft-panel" p="xl">
              <Stack gap="md">
                <Title order={3}>Basics</Title>
                <TextInput
                  label="Title"
                  placeholder="e.g. Electricity"
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
                  placeholder="Optional notes"
                                    autosize
                  minRows={3}
                  key={form.key('description')}
                  {...form.getInputProps('description')}
                />
              </Stack>
            </Paper>

            <Paper className="commune-soft-panel" p="xl">
              <Stack gap="md">
                <Title order={3}>Participants</Title>
                <MultiSelect
                  label="Who shares this expense?"
                  data={memberOptions}
                  withAsterisk
                                    key={form.key('participant_ids')}
                  {...form.getInputProps('participant_ids')}
                />
                <Select
                  label="Who paid?"
                  description="Use this when one member already covered the full amount."
                  data={paidByOptions}
                                    key={form.key('paid_by_user_id')}
                  {...form.getInputProps('paid_by_user_id')}
                />
                <Switch
                  label="Recurring expense"
                  checked={isRecurring}
                  onChange={(event) => setIsRecurring(event.currentTarget.checked)}
                />
                {isRecurring && (
                  <Select
                    label="Frequency"
                    data={[
                      { value: 'weekly', label: 'Weekly' },
                      { value: 'monthly', label: 'Monthly' },
                    ]}
                                        key={form.key('recurrence_type')}
                    {...form.getInputProps('recurrence_type')}
                  />
                )}
              </Stack>
            </Paper>
          </Stack>

          <Stack gap="lg">
            <Paper className="commune-soft-panel" p="xl">
              <Stack gap="md">
                <Title order={3}>Split method</Title>
                <SegmentedControl
                  value={splitMethod}
                  onChange={setSplitMethod}
                  data={[
                    { value: 'equal', label: 'Equal' },
                    { value: 'percentage', label: 'Percentage' },
                    { value: 'custom', label: 'Custom' },
                  ]}
                  fullWidth
                />

                {splitMethod === 'percentage' && selectedParticipants.length > 0 && (
                  <Stack gap="xs">
                    {selectedParticipants.map((id) => {
                      const name = group?.members.find((member) => member.user_id === id)?.user.name ?? id;
                      return (
                        <NumberInput
                          key={id}
                          label={name}
                          suffix="%"
                          min={0}
                          max={100}
                          decimalScale={2}
                                                    value={form.getValues().percentages[id] ?? 0}
                          onChange={(value) => {
                            const current = form.getValues().percentages;
                            form.setFieldValue('percentages', { ...current, [id]: Number(value) || 0 });
                          }}
                        />
                      );
                    })}
                  </Stack>
                )}

                {splitMethod === 'custom' && selectedParticipants.length > 0 && (
                  <Stack gap="xs">
                    {selectedParticipants.map((id) => {
                      const name = group?.members.find((member) => member.user_id === id)?.user.name ?? id;
                      return (
                        <NumberInput
                          key={id}
                          label={name}
                          prefix={group?.currency === 'GBP' ? '£' : ''}
                          min={0}
                          decimalScale={2}
                                                    value={form.getValues().custom_amounts[id] ?? 0}
                          onChange={(value) => {
                            const current = form.getValues().custom_amounts;
                            form.setFieldValue('custom_amounts', { ...current, [id]: Number(value) || 0 });
                          }}
                        />
                      );
                    })}
                  </Stack>
                )}
              </Stack>
            </Paper>

            <Paper className="commune-soft-panel" p="xl">
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <Title order={3}>Split preview</Title>
                  {splitPreview.length > 0 && (
                    <Badge variant="light" color="gray">
                      {splitMethod === 'equal' ? 'Equal split' : splitMethod === 'percentage' ? 'By percentage' : 'Custom amounts'}
                    </Badge>
                  )}
                </Group>
                {splitPreview.length > 0 ? (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <Table verticalSpacing="md" horizontalSpacing="sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Person</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>Share</Table.Th>
                          <Table.Th style={{ textAlign: 'right' }}>%</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {splitPreview.map((person) => (
                          <Table.Tr key={person.userId}>
                            <Table.Td>{person.name}</Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>
                              {formatCurrency(person.amount, group?.currency)}
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'right' }}>
                              <Text size="sm" c="dimmed">
                                {amount > 0 ? Math.round((person.amount / amount) * 100) : 0}%
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                      <Table.Tfoot>
                        <Table.Tr>
                          <Table.Td>
                            <Text fw={700}>Total</Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text fw={700}>
                              {formatCurrency(
                                splitPreview.reduce((sum, p) => sum + p.amount, 0),
                                group?.currency,
                              )}
                            </Text>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>
                            <Text size="sm" fw={600} c={Math.abs(splitPreview.reduce((sum, p) => sum + p.amount, 0) - amount) < 0.01 ? 'green' : 'red'}>
                              {amount > 0 ? Math.round((splitPreview.reduce((sum, p) => sum + p.amount, 0) / amount) * 100) : 0}%
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      </Table.Tfoot>
                    </Table>
                  </div>
                  {splitMethod === 'custom' && splitPreview.length > 0 && Math.abs(splitPreview.reduce((sum, p) => sum + p.amount, 0) - amount) > 0.01 && (
                    <Text size="sm" c="red">
                      Custom amounts ({formatCurrency(splitPreview.reduce((sum, p) => sum + p.amount, 0), group?.currency)}) don&apos;t match the expense total ({formatCurrency(amount, group?.currency)}).
                    </Text>
                  )}
                </>
                ) : (
                  <Text size="sm" c="dimmed">
                    Add an amount and choose participants to see the split preview.
                  </Text>
                )}
              </Stack>
            </Paper>

            <Group>
              <Button type="submit" size="lg" loading={createExpense.isPending}>
                Create expense
              </Button>
              <Button variant="default" onClick={() => navigate({ to: '/expenses' })}>
                Cancel
              </Button>
            </Group>
          </Stack>
        </div>
      </form>
    </Stack>
  );
}
