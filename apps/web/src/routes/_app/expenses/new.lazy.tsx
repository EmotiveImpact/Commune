import { createLazyFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Alert,
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
import { useMemo, useState, useEffect, useRef } from 'react';
import { IconFileAlert } from '@tabler/icons-react';
import {
  calculateEqualSplit,
  calculatePercentageSplit,
  getCategoriesByGroupType,
  getSpacePreset,
} from '@commune/core';
import { formatCurrency } from '@commune/utils';
import { uploadReceipt } from '@commune/api';
import { useGroupStore } from '../../../stores/group';
import { useGroup } from '../../../hooks/use-groups';
import {
  getWorkspaceExpenseContext,
  toWorkspaceExpenseContextPayload,
  useCreateExpense,
} from '../../../hooks/use-expenses';
import { useTemplates } from '../../../hooks/use-templates';
import { useAuthStore } from '../../../stores/auth';
import { ExpenseFormSkeleton } from '../../../components/page-skeleton';
import { EmptyState } from '../../../components/empty-state';
import { PageHeader } from '../../../components/page-header';
import { ReceiptDropzone } from '../../../components/receipt-dropzone';

// ─── Draft persistence helpers ──────────────────────────────────────────────
interface ExpenseDraft {
  title: string;
  description: string;
  amount: number;
  category: string;
  due_date: string;
  recurrence_type: string;
  paid_by_user_id: string;
  participant_ids: string[];
  percentages: Record<string, number>;
  custom_amounts: Record<string, number>;
  vendor_name: string;
  invoice_reference: string;
  invoice_date: string;
  payment_due_date: string;
  splitMethod: string;
  isRecurring: boolean;
  savedAt: number;
}

function getDraftKey(groupId: string) {
  return `commune-expense-draft-${groupId}`;
}

function loadDraft(groupId: string): ExpenseDraft | null {
  try {
    const raw = localStorage.getItem(getDraftKey(groupId));
    if (!raw) return null;
    return JSON.parse(raw) as ExpenseDraft;
  } catch {
    return null;
  }
}

function saveDraft(groupId: string, draft: Omit<ExpenseDraft, 'savedAt'>) {
  try {
    localStorage.setItem(getDraftKey(groupId), JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function clearDraft(groupId: string) {
  try {
    localStorage.removeItem(getDraftKey(groupId));
  } catch {
    // ignore
  }
}

function hasDraftContent(values: {
  title?: string;
  amount?: number;
  participant_ids?: string[];
  vendor_name?: string;
  invoice_reference?: string;
  invoice_date?: string;
  payment_due_date?: string;
  splitMethod?: string;
  isRecurring?: boolean;
}) {
  return Boolean(
    values.title
      || values.amount
      || (values.participant_ids?.length ?? 0) > 0
      || values.vendor_name
      || values.invoice_reference
      || values.invoice_date
      || values.payment_due_date,
  );
}

export const Route = createLazyFileRoute('/_app/expenses/new')({
  component: AddExpensePage,
});

function formatCategoryLabel(cat: string) {
  return cat
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function AddExpensePage() {
  const { activeGroupId } = useGroupStore();
  const { data: group, isLoading } = useGroup(activeGroupId ?? '');
  const createExpense = useCreateExpense(activeGroupId ?? '');
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [splitMethod, setSplitMethod] = useState<string>('equal');
  const [isRecurring, setIsRecurring] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [draftBanner, setDraftBanner] = useState<ExpenseDraft | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: templates } = useTemplates(activeGroupId ?? '');
  const preset = useMemo(
    () => getSpacePreset(group?.type, group?.subtype),
    [group?.subtype, group?.type],
  );
  const categoryOptions = useMemo(
    () =>
      getCategoriesByGroupType(group?.type, group?.subtype).map((cat) => ({
        value: cat,
        label: formatCategoryLabel(cat),
      })),
    [group?.subtype, group?.type],
  );

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
      vendor_name: '',
      invoice_reference: '',
      invoice_date: '',
      payment_due_date: '',
    },
    onValuesChange(values) {
      if (!activeGroupId) return;
      // Only save if user has entered something meaningful
      if (
        !hasDraftContent({
          ...values,
          splitMethod,
          isRecurring,
        })
      ) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        saveDraft(activeGroupId, {
          ...values,
          splitMethod,
          isRecurring,
        });
      }, 300);
    },
  });

  const workspaceContext = getWorkspaceExpenseContext(form.getValues());

  // ─── Check for existing draft on mount ──────────────────────────────────
  useEffect(() => {
    if (!activeGroupId) return;
    const draft = loadDraft(activeGroupId);
    if (draft) {
      setDraftBanner(draft);
    }
  }, [activeGroupId]);

  // ─── Save on splitMethod / isRecurring change ───────────────────────────
  useEffect(() => {
    if (!activeGroupId) return;
    const values = form.getValues();
    if (
      !hasDraftContent({
        ...values,
        splitMethod,
        isRecurring,
      })
    ) return;
    saveDraft(activeGroupId, {
      ...values,
      splitMethod,
      isRecurring,
    });
  }, [splitMethod, isRecurring]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRestoreDraft() {
    if (!draftBanner) return;
    form.setValues({
      title: draftBanner.title,
      description: draftBanner.description,
      amount: draftBanner.amount,
      category: draftBanner.category,
      due_date: draftBanner.due_date,
      recurrence_type: draftBanner.recurrence_type,
      paid_by_user_id: draftBanner.paid_by_user_id,
      participant_ids: draftBanner.participant_ids,
      percentages: draftBanner.percentages,
      custom_amounts: draftBanner.custom_amounts,
      vendor_name: draftBanner.vendor_name ?? '',
      invoice_reference: draftBanner.invoice_reference ?? '',
      invoice_date: draftBanner.invoice_date ?? '',
      payment_due_date: draftBanner.payment_due_date ?? '',
    });
    setSplitMethod(draftBanner.splitMethod || 'equal');
    setIsRecurring(draftBanner.isRecurring || false);
    setDraftBanner(null);
  }

  function handleDiscardDraft() {
    if (activeGroupId) clearDraft(activeGroupId);
    setDraftBanner(null);
  }

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

  const templateOptions = useMemo(
    () =>
      (templates ?? []).map((t) => ({
        value: t.id,
        label: t.name,
      })),
    [templates],
  );

  function handleApplyTemplate(templateId: string | null) {
    if (!templateId) return;
    const template = templates?.find((t) => t.id === templateId);
    if (!template) return;

    const participantIds = template.participants.map((p) => p.user_id);
    const percentages: Record<string, number> = {};
    const customAmounts: Record<string, number> = {};

    for (const p of template.participants) {
      if (p.percentage !== undefined) percentages[p.user_id] = p.percentage;
      if (p.amount !== undefined) customAmounts[p.user_id] = p.amount;
    }

    form.setFieldValue('participant_ids', participantIds);
    form.setFieldValue('percentages', percentages);
    form.setFieldValue('custom_amounts', customAmounts);
    setSplitMethod(template.split_method);

    notifications.show({
      title: 'Template applied',
      message: `"${template.name}" applied — participants and split method updated.`,
      color: 'blue',
    });
  }

  if (!activeGroupId) {
    return (
      <EmptyState
        title="Select a group first"
        description="Choose a group from the sidebar before creating a shared expense."
      />
    );
  }

  if (isLoading) {
    return <ExpenseFormSkeleton />;
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
      ...toWorkspaceExpenseContextPayload({
        vendor_name: values.vendor_name,
        invoice_reference: values.invoice_reference,
        invoice_date: values.invoice_date,
        payment_due_date: values.payment_due_date,
      }),
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
      const created = await createExpense.mutateAsync(expenseData);

      // Upload receipt if a file was selected
      if (receiptFile && user && created) {
        try {
          await uploadReceipt(receiptFile, user.id, (created as { id: string }).id);
        } catch {
          // Non-blocking: expense was created, receipt upload failed
          notifications.show({
            title: 'Receipt upload failed',
            message: 'The expense was created but the receipt could not be attached. You can add it from the expense detail page.',
            color: 'orange',
          });
        }
      }

      // Clear draft on successful creation
      if (activeGroupId) clearDraft(activeGroupId);

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

      {draftBanner && (
        <Alert
          icon={<IconFileAlert size={18} />}
          color="blue"
          title="You have an unsaved expense draft"
          withCloseButton
          onClose={handleDiscardDraft}
        >
          <Group gap="xs" mt="xs">
            <Text size="sm">
              {draftBanner.title ? `"${draftBanner.title}"` : 'Untitled'} — saved{' '}
              {new Date(draftBanner.savedAt).toLocaleString()}
            </Text>
            <Group gap="xs">
              <Button size="xs" variant="filled" onClick={handleRestoreDraft}>
                Restore
              </Button>
              <Button size="xs" variant="default" onClick={handleDiscardDraft}>
                Discard
              </Button>
            </Group>
          </Group>
        </Alert>
      )}

      {templateOptions.length > 0 && (
        <Paper className="commune-soft-panel" p="lg">
          <Select
            label="Use a template"
            description="Auto-fill participants and split method from a saved template."
            placeholder="Select a template..."
            data={templateOptions}
            clearable
            onChange={handleApplyTemplate}
          />
        </Paper>
      )}

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <div className="commune-expense-form-grid">
          <Stack gap="lg">
              <Stack gap="lg">
                <Paper className="commune-soft-panel" p="xl">
                  <Stack gap="md">
                    <Title order={3}>{preset.title}</Title>
                    <Text c="dimmed" size="sm">
                      {preset.summary}
                    </Text>
                    <Group gap="xs">
                      {preset.suggestedCategories.slice(0, 4).map((category) => (
                        <Badge key={category} variant="light" color="gray">
                          {formatCategoryLabel(category)}
                        </Badge>
                      ))}
                    </Group>
                    {preset.firstExpenseIdeas.slice(0, 2).map((idea) => (
                      <Text key={idea} size="sm" c="dimmed">
                        • {idea}
                      </Text>
                    ))}
                  </Stack>
                </Paper>

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

                {(group?.type === 'workspace' || Object.values(workspaceContext).some(Boolean)) && (
                  <Paper className="commune-soft-panel" p="xl">
                    <Stack gap="md">
                      <Title order={3}>Workspace context</Title>
                      <Text size="sm" c="dimmed">
                        Optional fields for vendor invoices, subscriptions, and internal cost tracking.
                      </Text>
                      <Group grow align="flex-start">
                        <TextInput
                          label="Vendor / supplier"
                          placeholder="e.g. OfficeCo"
                          key={form.key('vendor_name')}
                          {...form.getInputProps('vendor_name')}
                        />
                        <TextInput
                          label="Invoice reference"
                          placeholder="e.g. INV-1042"
                          key={form.key('invoice_reference')}
                          {...form.getInputProps('invoice_reference')}
                        />
                      </Group>
                      <Group grow align="flex-start">
                        <TextInput
                          label="Invoice date"
                          type="date"
                          description="Optional issue date from the vendor invoice."
                          key={form.key('invoice_date')}
                          {...form.getInputProps('invoice_date')}
                        />
                        <TextInput
                          label="Payment due date"
                          type="date"
                          description="Optional vendor due date if it differs from the expense due date."
                          key={form.key('payment_due_date')}
                          {...form.getInputProps('payment_due_date')}
                        />
                      </Group>
                    </Stack>
                  </Paper>
                )}

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

          <div className="commune-receipt-sidebar">
            <Paper className="commune-soft-panel" p="xl">
              <Stack gap="md">
                <Title order={3}>Receipt</Title>
                <Text size="sm" c="dimmed">
                  Attach a photo or PDF of the receipt (optional).
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
