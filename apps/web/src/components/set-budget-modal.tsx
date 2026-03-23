import { Modal, NumberInput, Button, Stack, Text, Group, Collapse, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { getMonthKey } from '@commune/utils';
import { ExpenseCategory } from '@commune/types';
import { useSetGroupBudget } from '../hooks/use-budgets';

interface SetBudgetModalProps {
  opened: boolean;
  onClose: () => void;
  groupId: string;
  currency?: string;
  currentAmount?: number;
  currentCategoryBudgets?: Record<string, number> | null;
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

function formatCategoryLabel(category: string) {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

const allCategories = Object.values(ExpenseCategory);

export function SetBudgetModal({
  opened,
  onClose,
  groupId,
  currency = 'GBP',
  currentAmount,
  currentCategoryBudgets,
}: SetBudgetModalProps) {
  const [month, setMonth] = useState(getMonthKey());
  const [amount, setAmount] = useState<number | ''>(currentAmount ?? '');
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>(
    currentCategoryBudgets ?? {},
  );
  const [categoryExpanded, { toggle: toggleCategory }] = useDisclosure(false);
  const setBudget = useSetGroupBudget(groupId);

  const monthOptions = getMonthOptions();

  const currencyPrefix =
    currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : `${currency} `;

  function handleCategoryChange(category: string, value: number | '') {
    setCategoryBudgets((prev) => {
      const next = { ...prev };
      if (value === '' || value === 0) {
        delete next[category];
      } else {
        next[category] = value;
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (!amount || amount <= 0) {
      notifications.show({
        title: 'Invalid amount',
        message: 'Budget amount must be greater than zero.',
        color: 'red',
      });
      return;
    }

    // Only include categories with non-zero amounts
    const filteredCategoryBudgets = Object.fromEntries(
      Object.entries(categoryBudgets).filter(([, v]) => v > 0),
    );
    const hasCategoryBudgets = Object.keys(filteredCategoryBudgets).length > 0;

    try {
      await setBudget.mutateAsync({
        month,
        amount,
        categoryBudgets: hasCategoryBudgets ? filteredCategoryBudgets : null,
      });
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
    <Modal opened={opened} onClose={onClose} title="Set monthly budget" centered size="lg">
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
          prefix={currencyPrefix}
          value={amount}
          onChange={(val) => setAmount(typeof val === 'number' ? val : '')}
          decimalScale={2}
        />

        {/* Collapsible category budgets section */}
        <div>
          <UnstyledButton onClick={toggleCategory} style={{ width: '100%' }}>
            <Group gap={6}>
              {categoryExpanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
              <Text size="sm" fw={500} c="dimmed">
                Set category budgets (optional)
              </Text>
            </Group>
          </UnstyledButton>

          <Collapse expanded={categoryExpanded}>
            <Stack gap="xs" mt="sm">
              {allCategories.map((category) => (
                <NumberInput
                  key={category}
                  label={formatCategoryLabel(category)}
                  placeholder="0"
                  min={0}
                  step={50}
                  prefix={currencyPrefix}
                  value={categoryBudgets[category] ?? ''}
                  onChange={(val) =>
                    handleCategoryChange(category, typeof val === 'number' ? val : '')
                  }
                  decimalScale={2}
                  size="sm"
                />
              ))}
            </Stack>
          </Collapse>
        </div>

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
