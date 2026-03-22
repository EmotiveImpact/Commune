import { Modal, NumberInput, Button, Stack, Text, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { getMonthKey } from '@commune/utils';
import { useSetGroupBudget } from '../hooks/use-budgets';

interface SetBudgetModalProps {
  opened: boolean;
  onClose: () => void;
  groupId: string;
  currency?: string;
  currentAmount?: number;
}

function getMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();

  for (let offset = 0; offset < 6; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }

  return options;
}

export function SetBudgetModal({
  opened,
  onClose,
  groupId,
  currency = 'GBP',
  currentAmount,
}: SetBudgetModalProps) {
  const [month, setMonth] = useState(getMonthKey());
  const [amount, setAmount] = useState<number | ''>(currentAmount ?? '');
  const setBudget = useSetGroupBudget(groupId);

  const monthOptions = getMonthOptions();

  async function handleSubmit() {
    if (!amount || amount <= 0) {
      notifications.show({
        title: 'Invalid amount',
        message: 'Budget amount must be greater than zero.',
        color: 'red',
      });
      return;
    }

    try {
      await setBudget.mutateAsync({ month, amount });
      notifications.show({
        title: 'Budget set',
        message: `Monthly budget has been set to ${currency} ${amount.toLocaleString()}`,
        color: 'green',
      });
      onClose();
    } catch {
      notifications.show({
        title: 'Failed to set budget',
        message: 'Something went wrong. Please try again.',
        color: 'red',
      });
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Set monthly budget" centered>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Set a spending target for the group. The dashboard will track progress against this budget.
        </Text>

        <div>
          <Text size="sm" fw={500} mb={4}>
            Month
          </Text>
          <Group gap="xs" wrap="wrap">
            {monthOptions.map((opt) => (
              <Button
                key={opt.value}
                variant={month === opt.value ? 'filled' : 'default'}
                size="xs"
                onClick={() => setMonth(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </Group>
        </div>

        <NumberInput
          label="Budget amount"
          placeholder="e.g. 2000"
          min={1}
          step={100}
          prefix={currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : `${currency} `}
          value={amount}
          onChange={(val) => setAmount(typeof val === 'number' ? val : '')}
          decimalScale={2}
        />

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={setBudget.isPending}>
            Save budget
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
