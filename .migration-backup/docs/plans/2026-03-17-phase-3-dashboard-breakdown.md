# Phase 3: Dashboard & Breakdown — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give each user personal financial visibility — an enhanced dashboard with "your share" stats and recent activity, plus a full monthly breakdown page with itemised expenses, month selector, category filter, and payment progress.

**Architecture:** Two new API query functions (`getDashboardStats`, `getUserBreakdown`) join the existing Supabase queries. TanStack Query hooks wrap them. The existing dashboard page gets enhanced stats. The breakdown placeholder gets replaced with a full implementation. All computation stays client-side using data already fetched — no new database tables or migrations needed.

**Tech Stack:** React 19, Mantine 9, TanStack Router, TanStack Query, Zustand, Supabase JS

**Existing code to build on:**
- `packages/api/src/expenses.ts` — getGroupExpenses (fetches expenses with participants + payment_records)
- `packages/api/src/payments.ts` — markPayment, confirmPayment
- `packages/types/src/database.ts` — BreakdownItem, MonthlyBreakdown, DashboardStats types already defined
- `packages/utils/src/date.ts` — getMonthKey, isOverdue, isUpcoming, formatDate, getMonthRange
- `packages/utils/src/currency.ts` — formatCurrency
- `apps/web/src/routes/_app/index.tsx` — current dashboard with basic stats
- `apps/web/src/routes/_app/breakdown.tsx` — placeholder page
- `apps/web/src/hooks/use-expenses.ts` — useGroupExpenses, expenseKeys
- `apps/web/src/hooks/use-groups.ts` — useGroup, groupKeys
- `apps/web/src/stores/group.ts` — useGroupStore (activeGroupId)
- `apps/web/src/stores/auth.ts` — useAuthStore (user)

---

## Task 1: Dashboard Stats API Function

**Files:**
- Create: `packages/api/src/dashboard.ts`
- Modify: `packages/api/src/index.ts`

**Step 1: Create the dashboard API file**

```typescript
import type { DashboardStats, ExpenseWithParticipants } from '@commune/types';
import { supabase } from './client';

export async function getDashboardStats(
  groupId: string,
  userId: string,
  month: string,
): Promise<DashboardStats> {
  const startDate = `${month}-01`;
  const [year, mon] = month.split('-').map(Number);
  const endDate = new Date(year!, mon!, 1).toISOString().split('T')[0];

  const { data: expenses, error } = await supabase
    .from('expenses')
    .select(
      `
      *,
      participants:expense_participants(
        *,
        user:users(*)
      ),
      payment_records(*),
      paid_by_user:users!expenses_paid_by_user_id_fkey(*)
    `,
    )
    .eq('group_id', groupId)
    .eq('is_active', true)
    .gte('due_date', startDate)
    .lt('due_date', endDate!);

  if (error) throw error;

  const typed = (expenses ?? []) as unknown as ExpenseWithParticipants[];

  let totalSpend = 0;
  let yourShare = 0;
  let amountPaid = 0;
  let overdueCount = 0;
  const upcoming: ExpenseWithParticipants[] = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekFromNow = new Date(today);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  for (const expense of typed) {
    totalSpend += expense.amount;

    const participation = expense.participants.find(
      (p) => p.user_id === userId,
    );
    if (participation) {
      yourShare += participation.share_amount;

      const payment = expense.payment_records.find(
        (pr) => pr.user_id === userId,
      );
      if (payment && payment.status !== 'unpaid') {
        amountPaid += participation.share_amount;
      }
    }

    const dueDate = new Date(expense.due_date);
    if (dueDate < today) {
      const hasUnpaid = expense.payment_records.some(
        (pr) => pr.status === 'unpaid',
      );
      if (hasUnpaid) overdueCount++;
    } else if (dueDate <= weekFromNow) {
      upcoming.push(expense);
    }
  }

  return {
    total_spend: totalSpend,
    your_share: yourShare,
    amount_paid: amountPaid,
    amount_remaining: yourShare - amountPaid,
    overdue_count: overdueCount,
    upcoming_items: upcoming,
  };
}
```

**Step 2: Export from index**

Add to `packages/api/src/index.ts`:

```typescript
export * from './dashboard';
```

**Step 3: Commit**

```bash
git add packages/api/src/dashboard.ts packages/api/src/index.ts
git commit -m "feat: add dashboard stats API with personal share calculation"
```

---

## Task 2: User Breakdown API Function

**Files:**
- Create: `packages/api/src/breakdown.ts`
- Modify: `packages/api/src/index.ts`

**Step 1: Create the breakdown API file**

```typescript
import type {
  MonthlyBreakdown,
  BreakdownItem,
  ExpenseWithParticipants,
} from '@commune/types';
import { supabase } from './client';

export async function getUserBreakdown(
  groupId: string,
  userId: string,
  month: string,
): Promise<MonthlyBreakdown> {
  const startDate = `${month}-01`;
  const [year, mon] = month.split('-').map(Number);
  const endDate = new Date(year!, mon!, 1).toISOString().split('T')[0];

  const { data: expenses, error } = await supabase
    .from('expenses')
    .select(
      `
      *,
      participants:expense_participants(
        *,
        user:users(*)
      ),
      payment_records(*),
      paid_by_user:users!expenses_paid_by_user_id_fkey(*)
    `,
    )
    .eq('group_id', groupId)
    .eq('is_active', true)
    .gte('due_date', startDate)
    .lt('due_date', endDate!)
    .order('due_date', { ascending: false });

  if (error) throw error;

  const typed = (expenses ?? []) as unknown as ExpenseWithParticipants[];

  let totalOwed = 0;
  let totalPaid = 0;
  const items: BreakdownItem[] = [];

  for (const expense of typed) {
    const participation = expense.participants.find(
      (p) => p.user_id === userId,
    );
    if (!participation) continue;

    const payment = expense.payment_records.find(
      (pr) => pr.user_id === userId,
    );
    const paymentStatus = payment?.status ?? 'unpaid';

    totalOwed += participation.share_amount;
    if (paymentStatus !== 'unpaid') {
      totalPaid += participation.share_amount;
    }

    items.push({
      expense,
      share_amount: participation.share_amount,
      payment_status: paymentStatus as 'unpaid' | 'paid' | 'confirmed',
      paid_by_user: expense.paid_by_user,
    });
  }

  return {
    month,
    total_owed: totalOwed,
    total_paid: totalPaid,
    remaining: totalOwed - totalPaid,
    items,
  };
}
```

**Step 2: Export from index**

Add to `packages/api/src/index.ts`:

```typescript
export * from './breakdown';
```

**Step 3: Commit**

```bash
git add packages/api/src/breakdown.ts packages/api/src/index.ts
git commit -m "feat: add user breakdown API with monthly statement data"
```

---

## Task 3: TanStack Query Hooks for Dashboard & Breakdown

**Files:**
- Create: `apps/web/src/hooks/use-dashboard.ts`

**Step 1: Create the hooks file**

```typescript
import { useQuery } from '@tanstack/react-query';
import { getDashboardStats, getUserBreakdown } from '@commune/api';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: (groupId: string, userId: string, month: string) =>
    [...dashboardKeys.all, 'stats', groupId, userId, month] as const,
  breakdown: (groupId: string, userId: string, month: string) =>
    [...dashboardKeys.all, 'breakdown', groupId, userId, month] as const,
};

export function useDashboardStats(groupId: string, userId: string, month: string) {
  return useQuery({
    queryKey: dashboardKeys.stats(groupId, userId, month),
    queryFn: () => getDashboardStats(groupId, userId, month),
    enabled: !!groupId && !!userId,
  });
}

export function useUserBreakdown(groupId: string, userId: string, month: string) {
  return useQuery({
    queryKey: dashboardKeys.breakdown(groupId, userId, month),
    queryFn: () => getUserBreakdown(groupId, userId, month),
    enabled: !!groupId && !!userId,
  });
}
```

**Step 2: Commit**

```bash
git add apps/web/src/hooks/use-dashboard.ts
git commit -m "feat: add tanstack query hooks for dashboard stats and breakdown"
```

---

## Task 4: Enhanced Dashboard Page

**Files:**
- Modify: `apps/web/src/routes/_app/index.tsx`

**Step 1: Replace the dashboard with enhanced version**

The current dashboard shows group-level totals. Enhance it with:
- Personal "Your share" and "Remaining" stats using `useDashboardStats`
- Recent activity list (upcoming expenses)
- Progress ring showing payment completion

```tsx
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Title, Text, Stack, Card, SimpleGrid, Group, ThemeIcon, Center,
  Loader, Button, Progress, Badge, RingProgress,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconReceipt, IconCash, IconAlertTriangle, IconCalendar,
  IconWallet, IconArrowRight,
} from '@tabler/icons-react';
import { useGroupStore } from '../../stores/group';
import { useAuthStore } from '../../stores/auth';
import { useGroup } from '../../hooks/use-groups';
import { useDashboardStats } from '../../hooks/use-dashboard';
import { formatCurrency, getMonthKey, formatDate, isOverdue } from '@commune/utils';
import { CreateGroupModal } from '../../components/create-group-modal';

export const Route = createFileRoute('/_app/')({
  component: DashboardPage,
});

function DashboardPage() {
  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();
  const { data: group, isLoading: groupLoading } = useGroup(activeGroupId ?? '');
  const currentMonth = getMonthKey();
  const { data: stats, isLoading: statsLoading } = useDashboardStats(
    activeGroupId ?? '',
    user?.id ?? '',
    currentMonth,
  );
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  if (!activeGroupId) {
    return (
      <Stack align="center" justify="center" h={400}>
        <Title order={3}>Welcome to Commune</Title>
        <Text c="dimmed">Create your first group to get started.</Text>
        <Button onClick={openCreate}>Create a group</Button>
        <CreateGroupModal opened={createOpened} onClose={closeCreate} />
      </Stack>
    );
  }

  if (groupLoading || statsLoading) {
    return <Center h={400}><Loader /></Center>;
  }

  const paidPct = stats && stats.your_share > 0
    ? Math.round((stats.amount_paid / stats.your_share) * 100)
    : 0;

  const statCards = [
    { label: 'Group spend', value: formatCurrency(stats?.total_spend ?? 0, group?.currency), icon: IconReceipt, color: 'blue' },
    { label: 'Your share', value: formatCurrency(stats?.your_share ?? 0, group?.currency), icon: IconWallet, color: 'violet' },
    { label: 'Remaining', value: formatCurrency(stats?.amount_remaining ?? 0, group?.currency), icon: IconCash, color: 'orange' },
    { label: 'Overdue', value: (stats?.overdue_count ?? 0).toString(), icon: IconAlertTriangle, color: 'red' },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>{group?.name}</Title>
        <Button component={Link} to="/breakdown" variant="subtle" rightSection={<IconArrowRight size={16} />}>
          My Breakdown
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
        {statCards.map((stat) => (
          <Card key={stat.label} withBorder padding="lg" radius="md">
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{stat.label}</Text>
                <Text fw={700} size="xl">{stat.value}</Text>
              </div>
              <ThemeIcon variant="light" color={stat.color} size="lg" radius="md">
                <stat.icon size={20} />
              </ThemeIcon>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      {/* Payment progress */}
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" mb="xs">
          <Text fw={600}>Your payment progress</Text>
          <Text size="sm" c="dimmed">{paidPct}% complete</Text>
        </Group>
        <Progress value={paidPct} size="lg" radius="md" color={paidPct === 100 ? 'green' : 'blue'} />
        <Group justify="space-between" mt="xs">
          <Text size="sm" c="dimmed">Paid: {formatCurrency(stats?.amount_paid ?? 0, group?.currency)}</Text>
          <Text size="sm" c="dimmed">Total: {formatCurrency(stats?.your_share ?? 0, group?.currency)}</Text>
        </Group>
      </Card>

      {/* Upcoming expenses */}
      {(stats?.upcoming_items ?? []).length > 0 && (
        <Card withBorder padding="lg" radius="md">
          <Group justify="space-between" mb="sm">
            <Text fw={600}>Upcoming this week</Text>
            <Badge variant="light" color="orange">{stats!.upcoming_items.length}</Badge>
          </Group>
          <Stack gap="xs">
            {stats!.upcoming_items.map((expense) => (
              <Card
                key={expense.id}
                component={Link}
                to={`/expenses/${expense.id}`}
                withBorder
                padding="sm"
                radius="sm"
                style={{ cursor: 'pointer', textDecoration: 'none' }}
              >
                <Group justify="space-between">
                  <div>
                    <Text size="sm" fw={500}>{expense.title}</Text>
                    <Text size="xs" c="dimmed">{formatDate(expense.due_date)}</Text>
                  </div>
                  <Text fw={600}>{formatCurrency(expense.amount, group?.currency)}</Text>
                </Group>
              </Card>
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_app/index.tsx
git commit -m "feat: enhance dashboard with personal stats, payment progress, and upcoming expenses"
```

---

## Task 5: My Breakdown Page — Summary + Itemised List

**Files:**
- Modify: `apps/web/src/routes/_app/breakdown.tsx`

**Step 1: Replace placeholder with full implementation**

```tsx
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Title, Text, Stack, Card, Group, Badge, Select, Progress,
  Center, Loader, Table, ThemeIcon, SegmentedControl,
} from '@mantine/core';
import {
  IconWallet, IconCheck, IconClock, IconReceipt,
} from '@tabler/icons-react';
import { useState, useMemo } from 'react';
import { ExpenseCategory } from '@commune/types';
import { formatCurrency, formatDate, getMonthKey } from '@commune/utils';
import { useGroupStore } from '../../stores/group';
import { useAuthStore } from '../../stores/auth';
import { useGroup } from '../../hooks/use-groups';
import { useUserBreakdown } from '../../hooks/use-dashboard';

export const Route = createFileRoute('/_app/breakdown')({
  component: BreakdownPage,
});

const categoryOptions = [
  { value: '', label: 'All categories' },
  ...Object.entries(ExpenseCategory).map(([key, value]) => ({
    value,
    label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
  })),
];

function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    options.push({ value: key, label });
  }
  return options;
}

function BreakdownPage() {
  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey());
  const [categoryFilter, setCategoryFilter] = useState('');

  const { data: breakdown, isLoading } = useUserBreakdown(
    activeGroupId ?? '',
    user?.id ?? '',
    selectedMonth,
  );

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  const filteredItems = useMemo(() => {
    if (!breakdown?.items) return [];
    if (!categoryFilter) return breakdown.items;
    return breakdown.items.filter((item) => item.expense.category === categoryFilter);
  }, [breakdown, categoryFilter]);

  if (!activeGroupId) return <Text c="dimmed">Select a group first.</Text>;

  const paidPct = breakdown && breakdown.total_owed > 0
    ? Math.round((breakdown.total_paid / breakdown.total_owed) * 100)
    : 0;

  const statusColor: Record<string, string> = {
    unpaid: 'red',
    paid: 'green',
    confirmed: 'blue',
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>My Breakdown</Title>
        <Select
          data={monthOptions}
          value={selectedMonth}
          onChange={(v) => setSelectedMonth(v ?? getMonthKey())}
          w={220}
        />
      </Group>

      {isLoading ? (
        <Center h={400}><Loader /></Center>
      ) : (
        <>
          {/* Summary card */}
          <Card withBorder padding="lg" radius="md">
            <Group justify="space-between" mb="md">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Your total</Text>
                <Text fw={700} size="xl">{formatCurrency(breakdown?.total_owed ?? 0, group?.currency)}</Text>
              </div>
              <Group gap="xl">
                <div style={{ textAlign: 'center' }}>
                  <Group gap={4} justify="center">
                    <ThemeIcon variant="light" color="green" size="sm"><IconCheck size={14} /></ThemeIcon>
                    <Text size="sm" fw={600}>{formatCurrency(breakdown?.total_paid ?? 0, group?.currency)}</Text>
                  </Group>
                  <Text size="xs" c="dimmed">Paid</Text>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Group gap={4} justify="center">
                    <ThemeIcon variant="light" color="orange" size="sm"><IconClock size={14} /></ThemeIcon>
                    <Text size="sm" fw={600}>{formatCurrency(breakdown?.remaining ?? 0, group?.currency)}</Text>
                  </Group>
                  <Text size="xs" c="dimmed">Remaining</Text>
                </div>
              </Group>
            </Group>
            <Progress value={paidPct} size="lg" radius="md" color={paidPct === 100 ? 'green' : 'blue'} />
            <Text size="xs" c="dimmed" ta="right" mt={4}>{paidPct}% paid</Text>
          </Card>

          {/* Category filter */}
          <Group>
            <Select
              placeholder="Filter by category"
              data={categoryOptions}
              value={categoryFilter}
              onChange={(v) => setCategoryFilter(v ?? '')}
              clearable
              w={220}
            />
            <Text size="sm" c="dimmed">
              {filteredItems.length} expense{filteredItems.length !== 1 ? 's' : ''}
            </Text>
          </Group>

          {/* Itemised list */}
          {filteredItems.length === 0 ? (
            <Center h={200}>
              <Stack align="center" gap="sm">
                <IconReceipt size={40} color="gray" />
                <Text c="dimmed">No expenses for this period.</Text>
              </Stack>
            </Center>
          ) : (
            <Card withBorder padding={0} radius="md">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Expense</Table.Th>
                    <Table.Th>Category</Table.Th>
                    <Table.Th>Due</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Your share</Table.Th>
                    <Table.Th style={{ textAlign: 'center' }}>Status</Table.Th>
                    <Table.Th>Paid by</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredItems.map((item) => (
                    <Table.Tr
                      key={item.expense.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => window.location.href = `/expenses/${item.expense.id}`}
                    >
                      <Table.Td>
                        <Text size="sm" fw={500}>{item.expense.title}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" variant="light" color="gray">
                          {item.expense.category.replace(/_/g, ' ')}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">{formatDate(item.expense.due_date)}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" fw={600}>
                          {formatCurrency(item.share_amount, group?.currency)}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <Badge
                          color={statusColor[item.payment_status] ?? 'gray'}
                          variant="light"
                          size="sm"
                        >
                          {item.payment_status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {item.paid_by_user?.name ?? '—'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          )}
        </>
      )}
    </Stack>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_app/breakdown.tsx
git commit -m "feat: implement breakdown page with summary, itemised list, month selector, and category filter"
```

---

## Task 6: Final Build Verification

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

## Phase 3 Complete

**What was built:**
- Dashboard stats API (personal share, paid, remaining, overdue, upcoming)
- User breakdown API (monthly statement with itemised expenses)
- TanStack Query hooks for both
- Enhanced dashboard with personal stats, payment progress bar, and upcoming expenses
- Full breakdown page with summary card, itemised table, month selector, and category filter

**Next:** Phase 4 — Payment Tracking & Actions (mark/confirm payments, settlement flows)
