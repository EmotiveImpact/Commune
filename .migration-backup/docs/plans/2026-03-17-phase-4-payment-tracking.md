# Phase 4: Payment Tracking & Actions — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the payment lifecycle — admin confirm payments, payment notes, edit expense flow, payment actions from breakdown, and payment history display.

**Architecture:** New `useConfirmPayment` hook wraps existing `confirmPayment` API. New `updateExpense` API function for editing. Expense detail page gets enhanced with confirm button, note input modal, and payment history. Breakdown page gets inline payment toggle. Edit expense is a new route reusing the form pattern from the add expense page.

**Tech Stack:** React 19, Mantine 9, TanStack Router, TanStack Query, Zustand, Supabase JS

**Existing code to build on:**
- `packages/api/src/payments.ts` — markPayment (already accepts note), confirmPayment (already exists)
- `packages/api/src/expenses.ts` — createExpense, archiveExpense (already exists)
- `apps/web/src/hooks/use-expenses.ts` — useMarkPayment, useArchiveExpense, useExpenseDetail
- `apps/web/src/routes/_app/expenses/$expenseId.tsx` — expense detail with basic toggle
- `apps/web/src/routes/_app/breakdown.tsx` — breakdown page (read-only currently)
- `packages/types/src/database.ts` — PaymentRecord type (has paid_at, note, confirmed_by fields)

---

## Task 1: Add Confirm Payment Hook + Update Expense API

**Files:**
- Modify: `apps/web/src/hooks/use-expenses.ts`
- Create: `packages/api/src/update-expense.ts`
- Modify: `packages/api/src/index.ts`

**Step 1: Add useConfirmPayment hook to use-expenses.ts**

Add to the end of `apps/web/src/hooks/use-expenses.ts`:

```typescript
import { confirmPayment } from '@commune/api';

export function useConfirmPayment(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, userId }: {
      expenseId: string;
      userId: string;
    }) => confirmPayment(expenseId, userId, ''),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(groupId) });
    },
  });
}
```

Note: the `confirmPayment` function takes 3 args (expenseId, userId, confirmedBy). We'll pass the current user's ID as confirmedBy from the component.

**Step 2: Create updateExpense API function**

Create `packages/api/src/update-expense.ts`:

```typescript
import type { SplitMethod } from '@commune/types';
import {
  calculateEqualSplit,
  calculatePercentageSplit,
} from '@commune/core';
import { supabase } from './client';

interface UpdateExpenseData {
  title?: string;
  description?: string;
  category?: string;
  amount?: number;
  due_date?: string;
  recurrence_type?: string;
  split_method?: SplitMethod;
  participant_ids?: string[];
  percentages?: { userId: string; percentage: number }[];
  custom_amounts?: { userId: string; amount: number }[];
}

export async function updateExpense(expenseId: string, data: UpdateExpenseData) {
  const {
    participant_ids,
    percentages,
    custom_amounts,
    split_method,
    ...expenseFields
  } = data;

  // Update expense fields
  if (Object.keys(expenseFields).length > 0 || split_method) {
    const updateData = { ...expenseFields, ...(split_method && { split_method }) };
    const { error } = await supabase
      .from('expenses')
      .update(updateData)
      .eq('id', expenseId);

    if (error) throw error;
  }

  // If split recalculation needed (amount, split_method, or participants changed)
  if (participant_ids && split_method && data.amount) {
    // Delete existing participants and payment records
    await supabase.from('expense_participants').delete().eq('expense_id', expenseId);
    await supabase.from('payment_records').delete().eq('expense_id', expenseId);

    // Recalculate shares
    let shares: { userId: string; amount: number; percentage?: number }[];

    if (split_method === 'equal') {
      const amounts = calculateEqualSplit(data.amount, participant_ids.length);
      shares = participant_ids.map((userId, i) => ({
        userId,
        amount: amounts[i]!,
      }));
    } else if (split_method === 'percentage' && percentages) {
      const result = calculatePercentageSplit(data.amount, percentages);
      shares = result.map((r) => ({
        userId: r.userId,
        amount: r.amount,
        percentage: percentages.find((p) => p.userId === r.userId)?.percentage,
      }));
    } else if (split_method === 'custom' && custom_amounts) {
      shares = custom_amounts.map((c) => ({
        userId: c.userId,
        amount: c.amount,
      }));
    } else {
      throw new Error(`Invalid split config: method=${split_method}`);
    }

    // Re-insert participants
    const participants = shares.map((s) => ({
      expense_id: expenseId,
      user_id: s.userId,
      share_amount: s.amount,
      share_percentage: s.percentage ?? null,
    }));

    const { error: pError } = await supabase
      .from('expense_participants')
      .insert(participants);
    if (pError) throw pError;

    // Re-insert payment records
    const paymentRecords = shares.map((s) => ({
      expense_id: expenseId,
      user_id: s.userId,
      amount: s.amount,
      status: 'unpaid',
    }));

    const { error: prError } = await supabase
      .from('payment_records')
      .insert(paymentRecords);
    if (prError) throw prError;
  }

  // Return updated expense
  const { data: updated, error: fetchError } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', expenseId)
    .single();

  if (fetchError) throw fetchError;
  return updated;
}
```

**Step 3: Export from index**

Add to `packages/api/src/index.ts`: `export * from './update-expense';`

**Step 4: Commit**

```bash
git add packages/api/src/update-expense.ts packages/api/src/index.ts apps/web/src/hooks/use-expenses.ts
git commit -m "feat: add confirm payment hook and update expense API"
```

---

## Task 2: Enhanced Expense Detail — Confirm, Notes, History

**Files:**
- Modify: `apps/web/src/routes/_app/expenses/$expenseId.tsx`

**Step 1: Enhance the expense detail page**

Update the expense detail page to add:
1. Admin "Confirm" button for payments with status "paid"
2. Payment note modal (TextInput popup when marking as paid)
3. Payment history section showing paid_at, note, and confirmed_by

The `confirmPayment` API takes `(expenseId, userId, confirmedBy)` — pass the current user's ID as confirmedBy.

Add imports: `Modal, TextInput, Tooltip` from Mantine, `IconCheckbox` from Tabler, `useState`, `useConfirmPayment` from hooks.

Key changes to the split breakdown table:
- Add a "Confirm" button (admin only) when payment.status === 'paid'
- Add a note icon/tooltip when payment.note exists
- Show paid_at date when available
- Add a modal for entering payment note when marking as paid

Replace the full file with this enhanced version that includes:

```tsx
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  Title, Stack, Card, Group, Text, Badge, Table, Avatar, Button,
  Center, Loader, ActionIcon, Modal, TextInput, Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft, IconCheck, IconX, IconArchive, IconCheckbox,
  IconNote, IconEdit,
} from '@tabler/icons-react';
import { useState } from 'react';
import { formatCurrency, formatDate, isOverdue } from '@commune/utils';
import { calculateReimbursements } from '@commune/core';
import {
  useExpenseDetail, useMarkPayment, useArchiveExpense, useConfirmPayment,
} from '../../../hooks/use-expenses';
import { useGroupStore } from '../../../stores/group';
import { useGroup } from '../../../hooks/use-groups';
import { useAuthStore } from '../../../stores/auth';

export const Route = createFileRoute('/_app/expenses/$expenseId')({
  component: ExpenseDetailPage,
});

function ExpenseDetailPage() {
  const { expenseId } = Route.useParams();
  const { activeGroupId } = useGroupStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const { data: expense, isLoading } = useExpenseDetail(expenseId);
  const markPayment = useMarkPayment(activeGroupId ?? '');
  const confirmPayment = useConfirmPayment(activeGroupId ?? '');
  const archive = useArchiveExpense(activeGroupId ?? '');
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Payment note modal
  const [noteOpened, { open: openNote, close: closeNote }] = useDisclosure(false);
  const [paymentNote, setPaymentNote] = useState('');
  const [pendingPayment, setPendingPayment] = useState<{ userId: string } | null>(null);

  if (isLoading) return <Center h={400}><Loader /></Center>;
  if (!expense) return <Text c="dimmed">Expense not found.</Text>;

  const isAdmin = group?.members.some(
    (m) => m.user_id === user?.id && m.role === 'admin'
  );

  const overdue = isOverdue(expense.due_date);

  const reimbursements = expense.paid_by_user_id
    ? calculateReimbursements(
        expense.participants.map((p) => ({ userId: p.user_id, amount: p.share_amount })),
        expense.paid_by_user_id
      )
    : [];

  const statusColor: Record<string, string> = {
    unpaid: 'red',
    paid: 'green',
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
        expenseId: expense!.id,
        userId: pendingPayment.userId,
        status: 'paid',
        note: paymentNote || undefined,
      });
      notifications.show({ title: 'Marked as paid', message: '', color: 'green' });
      closeNote();
      setPendingPayment(null);
    } catch (err) {
      notifications.show({
        title: 'Failed',
        message: err instanceof Error ? err.message : 'Error',
        color: 'red',
      });
    }
  }

  async function handleUnpay(userId: string) {
    try {
      await markPayment.mutateAsync({
        expenseId: expense!.id,
        userId,
        status: 'unpaid',
      });
      notifications.show({ title: 'Marked as unpaid', message: '', color: 'green' });
    } catch (err) {
      notifications.show({
        title: 'Failed',
        message: err instanceof Error ? err.message : 'Error',
        color: 'red',
      });
    }
  }

  async function handleConfirmPayment(userId: string) {
    try {
      await confirmPayment.mutateAsync({
        expenseId: expense!.id,
        userId,
      });
      notifications.show({ title: 'Payment confirmed', message: '', color: 'blue' });
    } catch (err) {
      notifications.show({
        title: 'Failed',
        message: err instanceof Error ? err.message : 'Error',
        color: 'red',
      });
    }
  }

  async function handleArchive() {
    try {
      await archive.mutateAsync(expense!.id);
      notifications.show({ title: 'Expense archived', message: '', color: 'green' });
      navigate({ to: '/expenses' });
    } catch (err) {
      notifications.show({
        title: 'Failed',
        message: err instanceof Error ? err.message : 'Error',
        color: 'red',
      });
    }
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <ActionIcon variant="subtle" component={Link} to="/expenses">
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Title order={2}>{expense.title}</Title>
        </Group>
        {isAdmin && (
          <Button
            variant="light"
            leftSection={<IconEdit size={16} />}
            component={Link}
            to={`/expenses/${expense.id}/edit`}
          >
            Edit
          </Button>
        )}
      </Group>

      {/* Info card */}
      <Card withBorder padding="md">
        <Stack gap="xs">
          <Group justify="space-between">
            <Text fw={700} size="xl">{formatCurrency(expense.amount, expense.currency)}</Text>
            <Group gap="xs">
              <Badge variant="light">{expense.category.replace(/_/g, ' ')}</Badge>
              {expense.recurrence_type !== 'none' && <Badge variant="light">Recurring ({expense.recurrence_type})</Badge>}
              {overdue && <Badge color="red">Overdue</Badge>}
            </Group>
          </Group>
          <Text size="sm" c="dimmed">Due: {formatDate(expense.due_date)}</Text>
          <Text size="sm" c="dimmed">Split: {expense.split_method}</Text>
          {expense.description && <Text size="sm" mt="xs">{expense.description}</Text>}
          {expense.paid_by_user && (
            <Text size="sm" c="dimmed">
              Paid upfront by <Text span fw={500}>{expense.paid_by_user.name}</Text>
            </Text>
          )}
        </Stack>
      </Card>

      {/* Split breakdown */}
      <Card withBorder padding="md">
        <Text fw={600} mb="sm">Split breakdown</Text>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Person</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Share</Table.Th>
              {expense.paid_by_user_id && <Table.Th style={{ textAlign: 'right' }}>Owes to</Table.Th>}
              <Table.Th style={{ textAlign: 'center' }}>Status</Table.Th>
              <Table.Th>Details</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {expense.participants.map((p) => {
              const payment = expense.payment_records?.find((pr) => pr.user_id === p.user_id);
              const paymentStatus = payment?.status ?? 'unpaid';
              const reimbursement = reimbursements.find((r) => r.userId === p.user_id);
              const canToggle = p.user_id === user?.id || isAdmin;

              return (
                <Table.Tr key={p.id}>
                  <Table.Td>
                    <Group gap="xs">
                      <Avatar src={p.user.avatar_url} name={p.user.name} color="initials" size="sm" />
                      <Text size="sm">{p.user.name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    {formatCurrency(p.share_amount, expense.currency)}
                  </Table.Td>
                  {expense.paid_by_user_id && (
                    <Table.Td style={{ textAlign: 'right' }}>
                      {reimbursement ? expense.paid_by_user?.name : '—'}
                    </Table.Td>
                  )}
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Badge color={statusColor[paymentStatus] ?? 'gray'} variant="light" size="sm">
                      {paymentStatus}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      {payment?.paid_at && (
                        <Text size="xs" c="dimmed">Paid: {formatDate(payment.paid_at)}</Text>
                      )}
                      {payment?.note && (
                        <Tooltip label={payment.note}>
                          <Group gap={4} style={{ cursor: 'pointer' }}>
                            <IconNote size={12} />
                            <Text size="xs" c="dimmed" truncate style={{ maxWidth: 120 }}>{payment.note}</Text>
                          </Group>
                        </Tooltip>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Group gap={4} justify="center">
                      {canToggle && paymentStatus === 'unpaid' && (
                        <ActionIcon variant="light" color="green" size="sm" onClick={() => handlePayClick(p.user_id)}>
                          <IconCheck size={14} />
                        </ActionIcon>
                      )}
                      {canToggle && paymentStatus === 'paid' && (
                        <ActionIcon variant="light" color="red" size="sm" onClick={() => handleUnpay(p.user_id)}>
                          <IconX size={14} />
                        </ActionIcon>
                      )}
                      {isAdmin && paymentStatus === 'paid' && (
                        <ActionIcon variant="light" color="blue" size="sm" onClick={() => handleConfirmPayment(p.user_id)}>
                          <IconCheckbox size={14} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Admin actions */}
      {isAdmin && (
        <Group>
          <Button variant="light" color="red" leftSection={<IconArchive size={16} />} onClick={handleArchive}>
            Archive expense
          </Button>
        </Group>
      )}

      {/* Payment note modal */}
      <Modal opened={noteOpened} onClose={closeNote} title="Mark as paid" size="sm">
        <Stack gap="sm">
          <TextInput
            label="Payment note (optional)"
            placeholder="e.g. Bank transfer ref: ABC123"
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.currentTarget.value)}
          />
          <Button onClick={handleConfirmPay} loading={markPayment.isPending} fullWidth>
            Confirm payment
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_app/expenses/\$expenseId.tsx
git commit -m "feat: enhance expense detail with confirm payment, notes, and payment history"
```

---

## Task 3: Edit Expense Page

**Files:**
- Create: `apps/web/src/routes/_app/expenses/$expenseId.edit.tsx`
- Modify: `apps/web/src/hooks/use-expenses.ts` (add useUpdateExpense hook)

**Step 1: Add useUpdateExpense hook**

Add to `apps/web/src/hooks/use-expenses.ts`:

```typescript
import { updateExpense } from '@commune/api';

export function useUpdateExpense(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, data }: {
      expenseId: string;
      data: Parameters<typeof updateExpense>[1];
    }) => updateExpense(expenseId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: expenseKeys.detail(variables.expenseId) });
      queryClient.invalidateQueries({ queryKey: expenseKeys.list(groupId) });
    },
  });
}
```

**Step 2: Create edit expense page**

Create `apps/web/src/routes/_app/expenses/$expenseId.edit.tsx`:

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  Title, Stack, TextInput, NumberInput, Select, Textarea,
  MultiSelect, SegmentedControl, Button, Card, Text, Group, Switch,
  Center, Loader,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useState, useMemo, useEffect } from 'react';
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
```

**Step 3: Commit**

```bash
git add apps/web/src/hooks/use-expenses.ts apps/web/src/routes/_app/expenses/\$expenseId.edit.tsx
git commit -m "feat: add edit expense page and update expense hook"
```

---

## Task 4: Payment Toggle on Breakdown Page

**Files:**
- Modify: `apps/web/src/routes/_app/breakdown.tsx`

**Step 1: Add payment toggle to breakdown items**

Enhance the breakdown table to add a payment toggle action column. Import `useMarkPayment` from hooks, `ActionIcon` from Mantine, `IconCheck`/`IconX` from Tabler.

Add to the table:
- A new "Action" column header
- For each row where `item.payment_status === 'unpaid'`: a green check button
- For each row where `item.payment_status === 'paid'`: a red X button
- Only show for the current user's items (all breakdown items are already filtered to the current user)

The key addition to the Table.Thead:
```tsx
<Table.Th style={{ textAlign: 'center' }}>Action</Table.Th>
```

And in the Table.Tbody for each item:
```tsx
<Table.Td style={{ textAlign: 'center' }}>
  <ActionIcon
    variant="light"
    color={item.payment_status === 'unpaid' ? 'green' : 'red'}
    size="sm"
    onClick={(e) => {
      e.stopPropagation();
      handleTogglePayment(item.expense.id, item.payment_status);
    }}
  >
    {item.payment_status === 'unpaid' ? <IconCheck size={14} /> : <IconX size={14} />}
  </ActionIcon>
</Table.Td>
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_app/breakdown.tsx
git commit -m "feat: add payment toggle actions to breakdown page"
```

---

## Task 5: Final Build Verification

**Step 1: Run core tests**

Run: `cd /Users/augustusedem/Commune && pnpm --filter @commune/core test`
Expected: All tests pass

**Step 2: Build the web app**

Run: `cd /Users/augustusedem/Commune/apps/web && pnpm build`
Expected: Build succeeds

**Step 3: Check git log**

```bash
git log --oneline -8
```

---

## Phase 4 Complete

**What was built:**
- Confirm payment flow (admin confirms "paid" → "confirmed")
- Payment note modal when marking as paid
- Payment history display (paid_at date, note with tooltip)
- Edit expense page (basic field editing)
- Update expense API with share recalculation
- Payment toggle on breakdown page
- Edit button on expense detail linking to edit page

**Next:** Phase 5 — Subscription & Billing (Stripe integration)
