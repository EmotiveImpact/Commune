import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Title, Stack, TextInput, NumberInput, Select, Textarea,
  MultiSelect, SegmentedControl, Button, Card, Text, Group, Switch, Table,
  Center, Loader,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useState, useMemo } from 'react';
import { ExpenseCategory, SplitMethod, RecurrenceType } from '@commune/types';
import { calculateEqualSplit, calculatePercentageSplit } from '@commune/core';
import { formatCurrency } from '@commune/utils';
import { useGroupStore } from '../../../stores/group';
import { useGroup } from '../../../hooks/use-groups';
import { useCreateExpense } from '../../../hooks/use-expenses';

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

  const memberOptions = useMemo(() =>
    (group?.members ?? [])
      .filter((m) => m.status === 'active')
      .map((m) => ({ value: m.user_id, label: m.user.name })),
    [group]
  );

  const paidByOptions = useMemo(() =>
    [{ value: '', label: 'Nobody (group expense)' }, ...memberOptions],
    [memberOptions]
  );

  if (!activeGroupId) return <Text c="dimmed">Select a group first.</Text>;
  if (isLoading) return <Center h={400}><Loader /></Center>;

  const selectedParticipants = form.getValues().participant_ids;
  const amount = form.getValues().amount || 0;

  // Calculate split preview
  let splitPreview: { userId: string; name: string; amount: number }[] = [];
  if (selectedParticipants.length > 0 && amount > 0) {
    if (splitMethod === 'equal') {
      const shares = calculateEqualSplit(amount, selectedParticipants.length);
      splitPreview = selectedParticipants.map((id, i) => ({
        userId: id,
        name: group?.members.find((m) => m.user_id === id)?.user.name ?? id,
        amount: shares[i] ?? 0,
      }));
    } else if (splitMethod === 'percentage') {
      const percentages = form.getValues().percentages;
      const entries = selectedParticipants.map((id) => ({
        userId: id,
        percentage: percentages[id] ?? 0,
      }));
      const totalPct = entries.reduce((s, e) => s + e.percentage, 0);
      if (Math.abs(totalPct - 100) < 0.01) {
        const result = calculatePercentageSplit(amount, entries);
        splitPreview = result.map((r) => ({
          userId: r.userId,
          name: group?.members.find((m) => m.user_id === r.userId)?.user.name ?? r.userId,
          amount: r.amount,
        }));
      }
    } else if (splitMethod === 'custom') {
      const customAmounts = form.getValues().custom_amounts;
      splitPreview = selectedParticipants.map((id) => ({
        userId: id,
        name: group?.members.find((m) => m.user_id === id)?.user.name ?? id,
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
      notifications.show({ title: 'Expense created', message: `${values.title} added`, color: 'green' });
      navigate({ to: '/expenses' });
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
      <Title order={2}>Add expense</Title>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {/* Basic fields */}
          <Card withBorder padding="md">
            <Stack gap="sm">
              <TextInput label="Title" placeholder="e.g. Electricity" withAsterisk key={form.key('title')} {...form.getInputProps('title')} />
              <Group grow>
                <NumberInput label="Amount" prefix="£" min={0} decimalScale={2} withAsterisk key={form.key('amount')} {...form.getInputProps('amount')} />
                <Select label="Category" data={categoryOptions} withAsterisk key={form.key('category')} {...form.getInputProps('category')} />
              </Group>
              <TextInput label="Due date" type="date" withAsterisk key={form.key('due_date')} {...form.getInputProps('due_date')} />
              <Textarea label="Description" placeholder="Optional notes" key={form.key('description')} {...form.getInputProps('description')} />
            </Stack>
          </Card>

          {/* Recurrence */}
          <Card withBorder padding="md">
            <Stack gap="sm">
              <Switch label="Recurring expense" checked={isRecurring} onChange={(e) => setIsRecurring(e.currentTarget.checked)} />
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
          </Card>

          {/* Participants */}
          <Card withBorder padding="md">
            <Stack gap="sm">
              <MultiSelect
                label="Who shares this expense?"
                data={memberOptions}
                withAsterisk
                key={form.key('participant_ids')}
                {...form.getInputProps('participant_ids')}
              />
              <Select
                label="Who paid?"
                description="If someone already paid the full amount upfront"
                data={paidByOptions}
                key={form.key('paid_by_user_id')}
                {...form.getInputProps('paid_by_user_id')}
              />
            </Stack>
          </Card>

          {/* Split method */}
          <Card withBorder padding="md">
            <Stack gap="sm">
              <Text fw={500} size="sm">How to split</Text>
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

              {/* Percentage inputs */}
              {splitMethod === 'percentage' && selectedParticipants.length > 0 && (
                <Stack gap="xs">
                  {selectedParticipants.map((id) => {
                    const name = group?.members.find((m) => m.user_id === id)?.user.name ?? id;
                    return (
                      <NumberInput
                        key={id}
                        label={name}
                        suffix="%"
                        min={0}
                        max={100}
                        decimalScale={2}
                        value={form.getValues().percentages[id] ?? 0}
                        onChange={(val) => {
                          const current = form.getValues().percentages;
                          form.setFieldValue('percentages', { ...current, [id]: Number(val) || 0 });
                        }}
                      />
                    );
                  })}
                </Stack>
              )}

              {/* Custom amount inputs */}
              {splitMethod === 'custom' && selectedParticipants.length > 0 && (
                <Stack gap="xs">
                  {selectedParticipants.map((id) => {
                    const name = group?.members.find((m) => m.user_id === id)?.user.name ?? id;
                    return (
                      <NumberInput
                        key={id}
                        label={name}
                        prefix="£"
                        min={0}
                        decimalScale={2}
                        value={form.getValues().custom_amounts[id] ?? 0}
                        onChange={(val) => {
                          const current = form.getValues().custom_amounts;
                          form.setFieldValue('custom_amounts', { ...current, [id]: Number(val) || 0 });
                        }}
                      />
                    );
                  })}
                </Stack>
              )}

              {/* Split preview */}
              {splitPreview.length > 0 && (
                <Card withBorder bg="gray.0" padding="sm">
                  <Text size="sm" fw={600} mb="xs">Split preview</Text>
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Person</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Share</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {splitPreview.map((p) => (
                        <Table.Tr key={p.userId}>
                          <Table.Td>{p.name}</Table.Td>
                          <Table.Td style={{ textAlign: 'right' }}>{formatCurrency(p.amount, group?.currency)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Card>
              )}
            </Stack>
          </Card>

          <Button type="submit" size="lg" loading={createExpense.isPending} fullWidth>
            Create expense
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}
