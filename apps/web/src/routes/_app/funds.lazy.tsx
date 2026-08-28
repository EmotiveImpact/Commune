import { createLazyFileRoute } from '@tanstack/react-router';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Menu,
  Modal,
  NumberInput,
  Paper,
  Progress,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  createContributionSchema,
  createFundExpenseSchema,
  createFundSchema,
} from '@commune/core';
import {
  IconCheck,
  IconCash,
  IconDots,
  IconMinus,
  IconPigMoney,
  IconPlus,
  IconReceipt,
  IconTrash,
  IconArrowLeft,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { formatCurrency } from '@commune/utils';
import { setPageTitle } from '../../utils/seo';
import { useGroupStore } from '../../stores/group';
import { useGroupSummary } from '../../hooks/use-groups';
import {
  useFunds,
  useFundDetails,
  useCreateFund,
  useAddContribution,
  useAddFundExpense,
  useDeleteFund,
} from '../../hooks/use-funds';
import { PageHeader } from '../../components/page-header';
import { EmptyState } from '../../components/empty-state';
import { ExpenseListSkeleton } from '../../components/page-skeleton';
import { QueryErrorState } from '../../components/query-error-state';

export const Route = createLazyFileRoute('/_app/funds')({
  component: FundsPage,
});

export function FundsPage() {
  useEffect(() => {
    setPageTitle('Funds');
  }, []);

  const { activeGroupId } = useGroupStore();
  const {
    data: group,
    error: groupError,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useGroupSummary(activeGroupId ?? '');

  const [selectedFundId, setSelectedFundId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedFundId(null);
  }, [activeGroupId]);

  if (!activeGroupId) {
    return (
      <EmptyState
        icon={IconPigMoney}
        title="Select a group first"
        description="Choose a group in the sidebar to manage shared funds."
      />
    );
  }

  if (isGroupError) {
    return (
      <QueryErrorState
        title="Failed to load funds"
        error={groupError}
        onRetry={() => {
          void refetchGroup();
        }}
        icon={IconPigMoney}
      />
    );
  }

  if (selectedFundId) {
    return (
      <FundDetailView
        fundId={selectedFundId}
        groupId={activeGroupId}
        currency={group?.currency ?? 'GBP'}
        onBack={() => setSelectedFundId(null)}
      />
    );
  }

  return (
    <FundListView
      groupId={activeGroupId}
      currency={group?.currency ?? 'GBP'}
      selectedFundId={selectedFundId}
      onSelectFund={setSelectedFundId}
    />
  );
}

// ─── Fund List View ─────────────────────────────────────────────────────────

function FundListView({
  groupId,
  currency,
  selectedFundId,
  onSelectFund,
}: {
  groupId: string;
  currency: string;
  selectedFundId: string | null;
  onSelectFund: (fundId: string) => void;
}) {
  const {
    data: funds,
    error,
    isError,
    isLoading,
    refetch,
  } = useFunds(groupId);
  const createMutation = useCreateFund(groupId);
  const deleteMutation = useDeleteFund(groupId);

  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const createForm = useForm({
    mode: 'uncontrolled',
    initialValues: {
      name: '',
      target_amount: '' as number | '',
      currency,
    },
  });

  function handleCreate(values: ReturnType<typeof createForm.getValues>) {
    const validation = createFundSchema.safeParse({
      group_id: groupId,
      name: values.name,
      target_amount:
        values.target_amount !== '' ? Number(values.target_amount) : null,
      currency: (values.currency || currency).toUpperCase(),
    });

    if (!validation.success) {
      notifications.show({
        title: 'Invalid fund details',
        message: validation.error.issues[0]?.message ?? 'Please check the form and try again.',
        color: 'red',
      });
      return;
    }

    createMutation.mutate(
      validation.data,
      {
        onSuccess: (createdFund) => {
          setShowCreate(false);
          createForm.reset();
          onSelectFund(createdFund.id);
          notifications.show({
            title: 'Fund created',
            message: `"${values.name}" is ready for contributions.`,
            color: 'green',
            icon: <IconCheck size={18} />,
          });
        },
        onError: (error) => {
          notifications.show({
            title: 'Failed to create fund',
            message: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
            color: 'red',
          });
        },
      },
    );
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setConfirmDelete(null);
        notifications.show({
          title: 'Fund deleted',
          message: 'The shared fund has been removed.',
          color: 'green',
          icon: <IconCheck size={18} />,
        });
      },
      onError: () => {
        notifications.show({
          title: 'Failed to delete fund',
          message: 'Something went wrong. Please try again.',
          color: 'red',
        });
      },
    });
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="Shared Funds"
        subtitle="Pool money together for group goals, trips, or shared expenses."
      >
        <Button
          leftSection={<IconPlus size={18} />}
          onClick={() => setShowCreate(true)}
        >
          New fund
        </Button>
      </PageHeader>

      {isLoading ? (
        <ExpenseListSkeleton />
      ) : isError ? (
        <EmptyState
          icon={IconPigMoney}
          title="Could not load funds"
          description={error instanceof Error ? error.message : 'Try again in a moment.'}
          action={{ label: 'Retry', onClick: () => void refetch() }}
        />
      ) : !funds || funds.length === 0 ? (
        <EmptyState
          icon={IconPigMoney}
          title="No funds yet"
          description="Create a shared fund to start pooling money with your group."
          action={{ label: 'Create fund', onClick: () => setShowCreate(true) }}
        />
      ) : (
        <Paper
          className="commune-soft-panel"
          p={0}
          style={{ overflow: 'hidden' }}
        >
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Balance</Table.Th>
                <Table.Th>Target</Table.Th>
                <Table.Th>Progress</Table.Th>
                <Table.Th style={{ width: 60 }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {funds.map((fund) => {
                const progress =
                  fund.target_amount && fund.target_amount > 0
                    ? Math.min(
                        (fund.total_contributions / fund.target_amount) * 100,
                        100,
                      )
                    : null;

                return (
                  <Table.Tr
                    key={fund.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onSelectFund(fund.id)}
                    data-selected={selectedFundId === fund.id || undefined}
                  >
                    <Table.Td>
                      <Text fw={600} lineClamp={1}>
                        {fund.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text
                        fw={600}
                        c={fund.balance >= 0 ? 'teal' : 'red'}
                      >
                        {formatCurrency(fund.balance, fund.currency)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {fund.target_amount ? (
                        <Text size="sm">
                          {formatCurrency(fund.target_amount, fund.currency)}
                        </Text>
                      ) : (
                        <Badge variant="light" color="gray" size="sm">
                          No target
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td style={{ minWidth: 120 }}>
                      {progress !== null ? (
                        <Progress
                          value={progress}
                          size="md"
                          color={progress >= 100 ? 'teal' : 'blue'}
                          radius="xl"
                        />
                      ) : (
                        <Text size="sm" c="dimmed">
                          --
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Menu shadow="md" width={180} position="bottom-end">
                        <Menu.Target>
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label={`Actions for ${fund.name}`}
                          >
                            <IconDots size={18} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={16} />}
                            onClick={() => setConfirmDelete(fund.id)}
                          >
                            Delete
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {/* Create fund modal */}
      <Modal
        opened={showCreate}
        onClose={() => {
          setShowCreate(false);
          createForm.reset();
        }}
        title="New shared fund"
        centered
      >
        <form onSubmit={createForm.onSubmit(handleCreate)}>
          <Stack gap="md">
            <TextInput
              label="Fund name"
              placeholder="e.g. Holiday trip, House deposit"
              withAsterisk
              key={createForm.key('name')}
              {...createForm.getInputProps('name')}
            />

            <NumberInput
              label="Target amount"
              description="Optional goal amount for this fund."
              placeholder="0.00"
              min={0}
              decimalScale={2}
              key={createForm.key('target_amount')}
              {...createForm.getInputProps('target_amount')}
            />

            <TextInput
              label="Currency"
              placeholder="GBP"
              maxLength={3}
              key={createForm.key('currency')}
              {...createForm.getInputProps('currency')}
            />

            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => {
                  setShowCreate(false);
                  createForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Create fund
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        opened={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete fund?"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            This will permanently remove this fund and all its contributions and
            expenses. This action cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={deleteMutation.isPending}
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ─── Fund Detail View ───────────────────────────────────────────────────────

function FundDetailView({
  fundId,
  groupId,
  currency,
  onBack,
}: {
  fundId: string;
  groupId: string;
  currency: string;
  onBack: () => void;
}) {
  const {
    data: fund,
    error,
    isError,
    isLoading,
    refetch,
  } = useFundDetails(groupId, fundId);
  const contributionMutation = useAddContribution(groupId, fundId);
  const expenseMutation = useAddFundExpense(groupId, fundId);

  const [showContribution, setShowContribution] = useState(false);
  const [showExpense, setShowExpense] = useState(false);

  const contributionForm = useForm({
    mode: 'uncontrolled',
    initialValues: {
      amount: '' as number | '',
      note: '',
    },
  });

  const expenseForm = useForm({
    mode: 'uncontrolled',
    initialValues: {
      description: '',
      amount: '' as number | '',
    },
  });

  function handleAddContribution(
    values: ReturnType<typeof contributionForm.getValues>,
  ) {
    const validation = createContributionSchema.safeParse({
      amount: Number(values.amount),
      note: values.note || undefined,
    });

    if (!validation.success) {
      notifications.show({
        title: 'Invalid contribution',
        message: validation.error.issues[0]?.message ?? 'Please check the form and try again.',
        color: 'red',
      });
      return;
    }

    contributionMutation.mutate(
      validation.data,
      {
        onSuccess: () => {
          setShowContribution(false);
          contributionForm.reset();
          notifications.show({
            title: 'Contribution added',
            message: `${formatCurrency(Number(values.amount), fund?.currency ?? currency)} added to the fund.`,
            color: 'green',
            icon: <IconCheck size={18} />,
          });
        },
        onError: (error) => {
          notifications.show({
            title: 'Failed to add contribution',
            message: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
            color: 'red',
          });
        },
      },
    );
  }

  function handleAddExpense(
    values: ReturnType<typeof expenseForm.getValues>,
  ) {
    const validation = createFundExpenseSchema.safeParse({
      description: values.description,
      amount: Number(values.amount),
    });

    if (!validation.success) {
      notifications.show({
        title: 'Invalid expense',
        message: validation.error.issues[0]?.message ?? 'Please check the form and try again.',
        color: 'red',
      });
      return;
    }

    expenseMutation.mutate(
      validation.data,
      {
        onSuccess: () => {
          setShowExpense(false);
          expenseForm.reset();
          notifications.show({
            title: 'Expense recorded',
            message: `${formatCurrency(Number(values.amount), fund?.currency ?? currency)} spent from the fund.`,
            color: 'green',
            icon: <IconCheck size={18} />,
          });
        },
        onError: (error) => {
          notifications.show({
            title: 'Failed to record expense',
            message: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
            color: 'red',
          });
        },
      },
    );
  }

  if (isLoading) {
    return (
      <Stack gap="xl">
        <ExpenseListSkeleton />
      </Stack>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={IconPigMoney}
        title="Could not load fund"
        description={error instanceof Error ? error.message : 'Try again in a moment.'}
        action={{ label: 'Retry', onClick: () => void refetch() }}
      />
    );
  }

  if (!fund) {
    return (
      <EmptyState
        icon={IconPigMoney}
        title="Fund not found"
        description="This fund may have been deleted or may belong to another group."
        action={{ label: 'Go back', onClick: onBack }}
      />
    );
  }

  const progress =
    fund.target_amount && fund.target_amount > 0
      ? Math.min(
          (fund.total_contributions / fund.target_amount) * 100,
          100,
        )
      : null;

  const fundCurrency = fund.currency ?? currency;

  return (
    <Stack gap="xl">
      <Group>
        <ActionIcon variant="subtle" onClick={onBack} aria-label="Back to funds">
          <IconArrowLeft size={20} />
        </ActionIcon>
        <div style={{ flex: 1 }}>
          <Title order={3}>{fund.name}</Title>
          <Text size="sm" c="dimmed">
            Balance: {formatCurrency(fund.balance, fundCurrency)}
            {fund.target_amount
              ? ` / ${formatCurrency(fund.target_amount, fundCurrency)} target`
              : ''}
          </Text>
        </div>
      </Group>

      {progress !== null && (
        <Progress
          value={progress}
          size="lg"
          color={progress >= 100 ? 'teal' : 'blue'}
          radius="xl"
        />
      )}

      {/* Summary cards */}
      <Group grow>
        <Paper className="commune-soft-panel" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Total In
          </Text>
          <Text size="xl" fw={700} c="teal">
            {formatCurrency(fund.total_contributions, fundCurrency)}
          </Text>
        </Paper>
        <Paper className="commune-soft-panel" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Total Out
          </Text>
          <Text size="xl" fw={700} c="red">
            {formatCurrency(fund.total_expenses, fundCurrency)}
          </Text>
        </Paper>
        <Paper className="commune-soft-panel" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Balance
          </Text>
          <Text
            size="xl"
            fw={700}
            c={fund.balance >= 0 ? 'teal' : 'red'}
          >
            {formatCurrency(fund.balance, fundCurrency)}
          </Text>
        </Paper>
      </Group>

      {/* Action buttons */}
      <Group>
        <Button
          leftSection={<IconPlus size={18} />}
          color="teal"
          onClick={() => setShowContribution(true)}
        >
          Add contribution
        </Button>
        <Button
          leftSection={<IconMinus size={18} />}
          color="red"
          variant="light"
          onClick={() => setShowExpense(true)}
        >
          Record expense
        </Button>
      </Group>

      {/* Tabs for contributions and expenses */}
      <Tabs defaultValue="contributions">
        <Tabs.List>
          <Tabs.Tab value="contributions" leftSection={<IconCash size={16} />}>
            Contributions ({fund.contributions.length})
          </Tabs.Tab>
          <Tabs.Tab value="expenses" leftSection={<IconReceipt size={16} />}>
            Expenses ({fund.expenses.length})
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="contributions" pt="md">
          {fund.contributions.length === 0 ? (
            <EmptyState
              icon={IconCash}
              title="No contributions yet"
              description="Add the first contribution to this fund."
              h={200}
            />
          ) : (
            <Paper
              className="commune-soft-panel"
              p={0}
              style={{ overflow: 'hidden' }}
            >
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Member</Table.Th>
                    <Table.Th>Amount</Table.Th>
                    <Table.Th>Note</Table.Th>
                    <Table.Th>Date</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {fund.contributions.map((c) => (
                    <Table.Tr key={c.id}>
                      <Table.Td>
                        <Text fw={500}>{c.user?.name ?? 'Unknown'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={600} c="teal">
                          +{formatCurrency(Number(c.amount), fundCurrency)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed" lineClamp={1}>
                          {c.note || '--'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {new Date(c.contributed_at).toLocaleDateString()}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="expenses" pt="md">
          {fund.expenses.length === 0 ? (
            <EmptyState
              icon={IconReceipt}
              title="No expenses yet"
              description="Record an expense when money is spent from this fund."
              h={200}
            />
          ) : (
            <Paper
              className="commune-soft-panel"
              p={0}
              style={{ overflow: 'hidden' }}
            >
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Description</Table.Th>
                    <Table.Th>Amount</Table.Th>
                    <Table.Th>Spent by</Table.Th>
                    <Table.Th>Date</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {fund.expenses.map((e) => (
                    <Table.Tr key={e.id}>
                      <Table.Td>
                        <Text fw={500} lineClamp={1}>
                          {e.description}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={600} c="red">
                          -{formatCurrency(Number(e.amount), fundCurrency)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {e.user?.name ?? 'Unknown'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {new Date(e.spent_at).toLocaleDateString()}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}
        </Tabs.Panel>
      </Tabs>

      {/* Add contribution modal */}
      <Modal
        opened={showContribution}
        onClose={() => {
          setShowContribution(false);
          contributionForm.reset();
        }}
        title="Add contribution"
        centered
      >
        <form onSubmit={contributionForm.onSubmit(handleAddContribution)}>
          <Stack gap="md">
            <NumberInput
              label="Amount"
              placeholder="0.00"
              min={0.01}
              decimalScale={2}
              withAsterisk
              key={contributionForm.key('amount')}
              {...contributionForm.getInputProps('amount')}
            />

            <TextInput
              label="Note"
              placeholder="Optional note"
              key={contributionForm.key('note')}
              {...contributionForm.getInputProps('note')}
            />

            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => {
                  setShowContribution(false);
                  contributionForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                color="teal"
                loading={contributionMutation.isPending}
              >
                Add contribution
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Add expense modal */}
      <Modal
        opened={showExpense}
        onClose={() => {
          setShowExpense(false);
          expenseForm.reset();
        }}
        title="Record fund expense"
        centered
      >
        <form onSubmit={expenseForm.onSubmit(handleAddExpense)}>
          <Stack gap="md">
            <TextInput
              label="Description"
              placeholder="What was the money spent on?"
              withAsterisk
              key={expenseForm.key('description')}
              {...expenseForm.getInputProps('description')}
            />

            <NumberInput
              label="Amount"
              placeholder="0.00"
              min={0.01}
              decimalScale={2}
              withAsterisk
              key={expenseForm.key('amount')}
              {...expenseForm.getInputProps('amount')}
            />

            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => {
                  setShowExpense(false);
                  expenseForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                color="red"
                loading={expenseMutation.isPending}
              >
                Record expense
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
