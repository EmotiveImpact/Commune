# Page Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each page (Expenses, Breakdown, Activity, Members) a distinct visual identity by removing the repeated hero → KPI → table template, keeping the hero only on Dashboard.

**Architecture:** Create a shared `PageHeader` component for compact page headers. Rewrite each page's JSX to use its purpose-built layout. Add new CSS classes for filter chips, date headers, member grid, and summary cards. No backend changes.

**Tech Stack:** React, Mantine 9, TanStack Router, CSS custom properties

**Spec:** `docs/superpowers/specs/2026-03-19-page-layout-redesign-design.md`

---

### Task 1: Add new CSS classes to styles.css

**Files:**
- Modify: `apps/web/src/styles.css` (append after line 520, before the closing blank line)

- [ ] **Step 1: Add compact page header styles**

Append to `apps/web/src/styles.css` before the final blank line:

```css
/* ── Compact page header ── */
.commune-page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 1rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--commune-border);
}

.commune-page-header-title {
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--commune-ink);
}

.commune-page-header-subtitle {
  font-size: 0.875rem;
  color: var(--commune-ink-soft);
  margin-top: 2px;
}

/* ── Status filter chips ── */
.commune-filter-chips {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.commune-filter-chip {
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: var(--commune-paper);
  color: var(--commune-ink-soft);
  transition:
    background-color var(--commune-motion-fast),
    color var(--commune-motion-fast);
}

.commune-filter-chip[data-active='true'] {
  background: var(--commune-mist);
  color: var(--commune-primary-strong);
  font-weight: 600;
}

.commune-filter-chip:hover {
  background: var(--commune-sage);
  color: var(--commune-primary-strong);
}

/* ── Breakdown summary card ── */
.commune-summary-stats {
  display: flex;
  justify-content: space-between;
  gap: 1.5rem;
}

.commune-summary-stat {
  flex: 1;
}

.commune-summary-stat-value {
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1.15;
}

.commune-summary-stat-value[data-color='green'] {
  color: var(--commune-primary);
}

.commune-summary-stat-value[data-color='coral'] {
  color: var(--commune-coral);
}

/* ── Activity date headers ── */
.commune-date-header {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--commune-ink-soft);
  padding: 0.5rem 0 0.25rem;
}

/* ── Members grid ── */
.commune-member-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.commune-invite-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--commune-border-strong);
  border-radius: 14px;
  padding: 1.25rem;
  color: var(--commune-ink-soft);
  font-size: 0.875rem;
  cursor: pointer;
  min-height: 88px;
  transition:
    border-color var(--commune-motion-fast),
    background-color var(--commune-motion-fast);
}

.commune-invite-placeholder:hover {
  border-color: var(--commune-primary);
  background: rgba(45, 106, 79, 0.04);
  color: var(--commune-primary);
}
```

- [ ] **Step 2: Add responsive rules for new components**

Append inside the existing `@media (max-width: 900px)` block in `styles.css`:

```css
  .commune-page-header {
    flex-direction: column;
    gap: 0.75rem;
  }

  .commune-page-header > *:last-child {
    width: 100%;
  }

  .commune-summary-stats {
    flex-direction: column;
    gap: 1rem;
  }

  .commune-member-grid {
    grid-template-columns: 1fr;
  }
```

- [ ] **Step 3: Verify the dev server picks up CSS changes**

Run: Check `http://localhost:5173` — the app should still load without errors. The new classes exist but aren't used yet.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/styles.css
git commit -m "style: add CSS classes for page header, filter chips, summary card, date headers, member grid"
```

---

### Task 2: Create shared PageHeader component

**Files:**
- Create: `apps/web/src/components/page-header.tsx`

- [ ] **Step 1: Create the PageHeader component**

Create `apps/web/src/components/page-header.tsx`:

```tsx
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="commune-page-header">
      <div>
        <div className="commune-page-header-title">{title}</div>
        <div className="commune-page-header-subtitle">{subtitle}</div>
      </div>
      {children && <div>{children}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/page-header.tsx
git commit -m "feat: add shared PageHeader component for compact page headers"
```

---

### Task 3: Redesign Expenses page — The Ledger

**Files:**
- Modify: `apps/web/src/routes/_app/expenses/index.tsx` (full rewrite of the return JSX)

- [ ] **Step 1: Rewrite the Expenses page**

Replace the entire file `apps/web/src/routes/_app/expenses/index.tsx` with this content. Key changes:
- Remove hero card, 4 KPI cards, and filter soft-panel
- Add PageHeader with inline category Select + "Add expense" button
- Add status filter chips (All, Open, Overdue, Settled)
- Add `statusFilter` state and derive `openCount` / `settledCount` from `filtered`
- Table renders directly without wrapper panel

```tsx
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Group,
  Select,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconPlus, IconReceipt } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { ExpenseCategory } from '@commune/types';
import { formatCurrency, formatDate, isOverdue, isUpcoming } from '@commune/utils';
import { useGroupStore } from '../../../stores/group';
import { useSearchStore } from '../../../stores/search';
import { useGroup } from '../../../hooks/use-groups';
import { useGroupExpenses } from '../../../hooks/use-expenses';
import { PageLoader } from '../../../components/page-loader';
import { EmptyState } from '../../../components/empty-state';
import { PageHeader } from '../../../components/page-header';

export const Route = createFileRoute('/_app/expenses/')({
  component: ExpensesPage,
});

const categoryOptions = [
  { value: '', label: 'All categories' },
  ...Object.entries(ExpenseCategory).map(([key, value]) => ({
    value,
    label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
  })),
];

function formatCategoryLabel(category: string) {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

type StatusFilter = 'all' | 'open' | 'overdue' | 'settled';

function ExpensesPage() {
  const navigate = useNavigate();
  const { activeGroupId } = useGroupStore();
  const { query: searchQuery } = useSearchStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: expenses, isLoading } = useGroupExpenses(
    activeGroupId ?? '',
    categoryFilter ? { category: categoryFilter } : undefined,
  );

  const searchFiltered = useMemo(() => {
    if (!expenses) return [];
    if (!searchQuery) return expenses;
    const q = searchQuery.toLowerCase();
    return expenses.filter(
      (expense) =>
        expense.title.toLowerCase().includes(q)
        || expense.category.toLowerCase().includes(q),
    );
  }, [expenses, searchQuery]);

  const counts = useMemo(() => {
    let openCount = 0;
    let overdueCount = 0;
    let settledCount = 0;

    for (const expense of searchFiltered) {
      const paidCount = expense.payment_records?.filter((p) => p.status !== 'unpaid').length ?? 0;
      const totalParticipants = expense.participants?.length ?? 0;
      const isSettled = totalParticipants > 0 && paidCount === totalParticipants;

      if (isSettled) {
        settledCount += 1;
      } else if (isOverdue(expense.due_date)) {
        overdueCount += 1;
      } else {
        openCount += 1;
      }
    }

    return { openCount, overdueCount, settledCount };
  }, [searchFiltered]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return searchFiltered;

    return searchFiltered.filter((expense) => {
      const paidCount = expense.payment_records?.filter((p) => p.status !== 'unpaid').length ?? 0;
      const totalParticipants = expense.participants?.length ?? 0;
      const isSettled = totalParticipants > 0 && paidCount === totalParticipants;

      if (statusFilter === 'settled') return isSettled;
      if (statusFilter === 'overdue') return !isSettled && isOverdue(expense.due_date);
      return !isSettled && !isOverdue(expense.due_date);
    });
  }, [searchFiltered, statusFilter]);

  const totalAmount = useMemo(
    () => searchFiltered.reduce((sum, expense) => sum + expense.amount, 0),
    [searchFiltered],
  );

  if (!activeGroupId) {
    return (
      <EmptyState
        icon={IconReceipt}
        iconColor="emerald"
        title="Select a group first"
        description="Pick a group from the sidebar to see the expense ledger for that space."
      />
    );
  }

  const chipData: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: searchFiltered.length },
    { key: 'open', label: 'Open', count: counts.openCount },
    { key: 'overdue', label: 'Overdue', count: counts.overdueCount },
    { key: 'settled', label: 'Settled', count: counts.settledCount },
  ];

  return (
    <Stack gap="lg">
      <PageHeader
        title="Expenses"
        subtitle={`${searchFiltered.length} expenses · ${formatCurrency(totalAmount, group?.currency)} tracked`}
      >
        <Group gap="sm" wrap="wrap">
          <Select
            placeholder="Category"
            data={categoryOptions}
            value={categoryFilter}
            onChange={(value) => setCategoryFilter(value ?? '')}
            clearable
            w={180}
          />
          <Button component={Link} to="/expenses/new" leftSection={<IconPlus size={16} />}>
            Add expense
          </Button>
        </Group>
      </PageHeader>

      <div className="commune-filter-chips">
        {chipData.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className="commune-filter-chip"
            data-active={statusFilter === chip.key}
            onClick={() => setStatusFilter(chip.key)}
          >
            {chip.label} ({chip.count})
          </button>
        ))}
      </div>

      {isLoading ? (
        <PageLoader message="Loading expenses..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={IconReceipt}
          iconColor="emerald"
          title="No expenses match this view"
          description="Add your first expense or change the current filters to bring the ledger into view."
          action={{
            label: 'Add expense',
            onClick: () => {
              navigate({ to: '/expenses/new' });
            },
          }}
        />
      ) : (
        <div className="commune-table-shell">
          <Table verticalSpacing="md" horizontalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Expense</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th>Due date</Table.Th>
                <Table.Th>Participants</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((expense) => {
                const overdue = isOverdue(expense.due_date);
                const paidCount = expense.payment_records?.filter((payment) => payment.status !== 'unpaid').length ?? 0;
                const totalParticipants = expense.participants?.length ?? 0;
                const settled = totalParticipants > 0 && paidCount === totalParticipants;

                return (
                  <Table.Tr key={expense.id}>
                    <Table.Td>
                      <Stack gap={4}>
                        <Text component={Link} to={`/expenses/${expense.id}`} fw={600} style={{ textDecoration: 'none' }}>
                          {expense.title}
                        </Text>
                        {expense.recurrence_type !== 'none' && (
                          <Badge size="xs" variant="light" color="emerald" w="fit-content">
                            Recurring
                          </Badge>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Badge className="commune-pill-badge" size="sm" variant="light" color="gray">
                        {formatCategoryLabel(expense.category)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">{formatDate(expense.due_date)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {paidCount}/{totalParticipants} paid
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={settled ? 'emerald' : overdue ? 'red' : 'orange'} variant="light">
                        {settled ? 'Settled' : overdue ? 'Overdue' : 'Open'}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={700}>{formatCurrency(expense.amount, group?.currency)}</Text>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </div>
      )}
    </Stack>
  );
}
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:5173/expenses` — should show compact header, filter chips, and dense table. No hero card, no KPI cards.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/_app/expenses/index.tsx
git commit -m "refactor: redesign Expenses page as compact ledger layout"
```

---

### Task 4: Redesign Breakdown page — Personal Statement

**Files:**
- Modify: `apps/web/src/routes/_app/breakdown.tsx` (full rewrite of the return JSX)

- [ ] **Step 1: Rewrite the Breakdown page**

Replace the entire file `apps/web/src/routes/_app/breakdown.tsx`. Key changes:
- Remove hero card and 4 KPI cards
- Add PageHeader with month picker in the action area
- Add summary card with 3 inline stats (Total owed, Paid, Remaining) + progress bar
- Category filter is inline above the table, not in its own panel
- Table kept as-is (all 7 columns preserved)

```tsx
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  ActionIcon,
  Badge,
  Group,
  Paper,
  Progress,
  Select,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconCheck, IconReceipt, IconWallet, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useMemo, useState } from 'react';
import { ExpenseCategory } from '@commune/types';
import { formatCurrency, formatDate, getMonthKey } from '@commune/utils';
import { useGroupStore } from '../../stores/group';
import { useAuthStore } from '../../stores/auth';
import { useGroup } from '../../hooks/use-groups';
import { useUserBreakdown } from '../../hooks/use-dashboard';
import { useMarkPayment } from '../../hooks/use-expenses';
import { PageLoader } from '../../components/page-loader';
import { EmptyState } from '../../components/empty-state';
import { PageHeader } from '../../components/page-header';

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

  for (let index = 0; index < 12; index += 1) {
    const value = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const key = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
    const label = value.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    options.push({ value: key, label });
  }

  return options;
}

function formatCategoryLabel(category: string) {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function BreakdownPage() {
  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const [selectedMonth, setSelectedMonth] = useState(getMonthKey());
  const [categoryFilter, setCategoryFilter] = useState('');
  const markPayment = useMarkPayment(activeGroupId ?? '');

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

  const paidPct = breakdown && breakdown.total_owed > 0
    ? Math.round((breakdown.total_paid / breakdown.total_owed) * 100)
    : 0;

  async function handleTogglePayment(expenseId: string, currentStatus: string) {
    try {
      await markPayment.mutateAsync({
        expenseId,
        userId: user?.id ?? '',
        status: currentStatus === 'unpaid' ? 'paid' : 'unpaid',
      });
      notifications.show({
        title: currentStatus === 'unpaid' ? 'Marked as paid' : 'Marked as unpaid',
        message: '',
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to update payment',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  if (!activeGroupId) {
    return (
      <EmptyState
        icon={IconWallet}
        iconColor="emerald"
        title="Select a group first"
        description="Choose a group from the sidebar to see your personal monthly breakdown."
      />
    );
  }

  return (
    <Stack gap="lg">
      <PageHeader
        title="Your Breakdown"
        subtitle="What you owe and what you've paid"
      >
        <Select
          data={monthOptions}
          value={selectedMonth}
          onChange={(value) => setSelectedMonth(value ?? getMonthKey())}
          w={200}
        />
      </PageHeader>

      {isLoading ? (
        <PageLoader message="Loading breakdown..." />
      ) : (
        <>
          <Paper className="commune-soft-panel" p="xl">
            <div className="commune-summary-stats">
              <div className="commune-summary-stat">
                <Text size="sm" c="dimmed">Total owed</Text>
                <div className="commune-summary-stat-value">
                  {formatCurrency(breakdown?.total_owed ?? 0, group?.currency)}
                </div>
              </div>
              <div className="commune-summary-stat" style={{ textAlign: 'center' }}>
                <Text size="sm" c="dimmed">Paid</Text>
                <div className="commune-summary-stat-value" data-color="green">
                  {formatCurrency(breakdown?.total_paid ?? 0, group?.currency)}
                </div>
              </div>
              <div className="commune-summary-stat" style={{ textAlign: 'right' }}>
                <Text size="sm" c="dimmed">Remaining</Text>
                <div className="commune-summary-stat-value" data-color="coral">
                  {formatCurrency(breakdown?.remaining ?? 0, group?.currency)}
                </div>
              </div>
            </div>
            <Group justify="space-between" mt="md" mb={6}>
              <Text size="sm" fw={600}>Payment progress</Text>
              <Badge variant="light" color={paidPct === 100 ? 'emerald' : 'orange'}>
                {paidPct}% paid
              </Badge>
            </Group>
            <div className="commune-soft-progress">
              <Progress value={paidPct} size="xl" color="commune" />
            </div>
          </Paper>

          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">{filteredItems.length} expenses</Text>
            <Select
              placeholder="Filter by category"
              data={categoryOptions}
              value={categoryFilter}
              onChange={(value) => setCategoryFilter(value ?? '')}
              clearable
              w={220}
            />
          </Group>

          {filteredItems.length === 0 ? (
            <EmptyState
              icon={IconReceipt}
              iconColor="emerald"
              title="No expenses for this period"
              description="There are no expenses matching the selected month and category."
            />
          ) : (
            <div className="commune-table-shell" style={{ overflowX: 'auto' }}>
              <Table verticalSpacing="md" horizontalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Expense</Table.Th>
                    <Table.Th>Category</Table.Th>
                    <Table.Th>Due</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Your share</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Paid by</Table.Th>
                    <Table.Th style={{ textAlign: 'center' }}>Action</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredItems.map((item) => (
                    <Table.Tr key={item.expense.id}>
                      <Table.Td>
                        <Text component={Link} to={`/expenses/${item.expense.id}`} fw={600} style={{ textDecoration: 'none' }}>
                          {item.expense.title}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="sm" variant="light" color="gray" className="commune-pill-badge">
                          {formatCategoryLabel(item.expense.category)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">{formatDate(item.expense.due_date)}</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" fw={700}>
                          {formatCurrency(item.share_amount, group?.currency)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={item.payment_status === 'confirmed' ? 'blue' : item.payment_status === 'paid' ? 'emerald' : 'orange'}
                          variant="light"
                        >
                          {item.payment_status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {item.paid_by_user?.name ?? '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        {item.payment_status !== 'confirmed' && (
                          <ActionIcon
                            variant="light"
                            color={item.payment_status === 'unpaid' ? 'emerald' : 'red'}
                            onClick={() => handleTogglePayment(item.expense.id, item.payment_status)}
                          >
                            {item.payment_status === 'unpaid' ? <IconCheck size={16} /> : <IconX size={16} />}
                          </ActionIcon>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          )}
        </>
      )}
    </Stack>
  );
}
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:5173/breakdown` — should show compact header with month picker, summary card with 3 stats + progress bar, then the table. No hero card, no KPI cards.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/_app/breakdown.tsx
git commit -m "refactor: redesign Breakdown page as personal statement layout"
```

---

### Task 5: Redesign Activity page — Timeline Feed

**Files:**
- Modify: `apps/web/src/routes/_app/activity.tsx` (full rewrite of the return JSX)

- [ ] **Step 1: Rewrite the Activity page**

Replace the entire file `apps/web/src/routes/_app/activity.tsx`. Key changes:
- Remove hero card and 4 KPI cards
- Add PageHeader with filter chips in the action area
- Add `typeFilter` state for client-side filtering by `entity_type`
- Group entries by date with date headers ("Today", "Yesterday", "Mar 17")
- Keep existing event card structure

```tsx
import { createFileRoute } from '@tanstack/react-router';
import {
  Avatar,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconActivity,
  IconCash,
  IconCreditCard,
  IconHistory,
  IconReceipt,
  IconTrash,
  IconUserCheck,
  IconUserMinus,
  IconUserPlus,
  IconUsers,
  IconSettings,
  IconArrowsTransferDown,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import type { ActivityEntry } from '@commune/api';
import { useGroupStore } from '../../stores/group';
import { useGroup } from '../../hooks/use-groups';
import { useActivityLog } from '../../hooks/use-activity';
import { PageLoader } from '../../components/page-loader';
import { EmptyState } from '../../components/empty-state';
import { PageHeader } from '../../components/page-header';

export const Route = createFileRoute('/_app/activity')({
  component: ActivityPage,
});

const PAGE_SIZE = 50;

const actionIcons: Record<string, typeof IconReceipt> = {
  expense_created: IconReceipt,
  expense_updated: IconSettings,
  expense_deleted: IconTrash,
  payment_marked: IconCash,
  payment_confirmed: IconCreditCard,
  member_invited: IconUserPlus,
  member_joined: IconUserCheck,
  member_left: IconUserMinus,
  member_removed: IconUserMinus,
  group_updated: IconSettings,
  ownership_transferred: IconArrowsTransferDown,
};

const actionColors: Record<string, string> = {
  expense_created: 'emerald',
  expense_updated: 'blue',
  expense_deleted: 'red',
  payment_marked: 'orange',
  payment_confirmed: 'green',
  member_invited: 'violet',
  member_joined: 'teal',
  member_left: 'gray',
  member_removed: 'red',
  group_updated: 'blue',
  ownership_transferred: 'indigo',
};

function describeAction(entry: ActivityEntry): string {
  const meta = entry.metadata;
  const actorName = entry.user?.name ?? 'Someone';

  switch (entry.action) {
    case 'expense_created':
      return `${actorName} created expense '${meta.title ?? 'Untitled'}' for ${meta.currency ?? ''}${meta.amount ?? ''}`;
    case 'expense_updated':
      return `${actorName} updated expense '${meta.title ?? 'Untitled'}'`;
    case 'expense_deleted':
      return `${actorName} archived expense '${meta.title ?? 'Untitled'}'`;
    case 'payment_marked':
      return `${actorName} marked a payment on '${meta.expense_title ?? 'an expense'}'`;
    case 'payment_confirmed':
      return `${actorName} confirmed a payment on '${meta.expense_title ?? 'an expense'}'`;
    case 'member_invited':
      return `${actorName} invited ${meta.member_name ?? 'a member'} to the group`;
    case 'member_joined':
      return `${meta.member_name ?? actorName} joined the group`;
    case 'member_left':
      return `${meta.member_name ?? actorName} left the group`;
    case 'member_removed':
      return `${actorName} removed ${meta.member_name ?? 'a member'} from the group`;
    case 'group_updated':
      return `${actorName} updated the group settings`;
    case 'ownership_transferred':
      return `${actorName} transferred group ownership to ${meta.new_owner_name ?? 'another member'}`;
    default:
      return `${actorName} performed an action`;
  }
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    .toISOString()
    .slice(0, 10);
  const dateKey = date.toISOString().slice(0, 10);

  if (dateKey === today) return 'Today';
  if (dateKey === yesterday) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

type TypeFilter = 'all' | 'expense' | 'payment' | 'member';

function ActivityPage() {
  const { activeGroupId } = useGroupStore();
  const { data: group, isLoading: groupLoading } = useGroup(activeGroupId ?? '');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const { data: entries = [], isLoading } = useActivityLog(activeGroupId ?? '', limit);

  const filteredEntries = useMemo(() => {
    if (typeFilter === 'all') return entries;
    return entries.filter((e) => e.entity_type === typeFilter);
  }, [entries, typeFilter]);

  const grouped = useMemo(() => {
    const groups: { label: string; items: typeof filteredEntries }[] = [];
    let currentLabel = '';

    for (const entry of filteredEntries) {
      const label = getDateLabel(entry.created_at);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, items: [] });
      }
      groups[groups.length - 1]!.items.push(entry);
    }

    return groups;
  }, [filteredEntries]);

  if (!activeGroupId) {
    return (
      <EmptyState
        icon={IconHistory}
        iconColor="emerald"
        title="Select a group first"
        description="Choose a group in the sidebar to view its activity log."
      />
    );
  }

  if (isLoading || groupLoading) {
    return <PageLoader message="Loading activity..." />;
  }

  const filterChips: { key: TypeFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'expense', label: 'Expenses' },
    { key: 'payment', label: 'Payments' },
    { key: 'member', label: 'Members' },
  ];

  return (
    <Stack gap="lg">
      <PageHeader
        title="Activity"
        subtitle={`Everything that happened in ${group?.name ?? 'this group'}`}
      >
        <div className="commune-filter-chips">
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="commune-filter-chip"
              data-active={typeFilter === chip.key}
              onClick={() => setTypeFilter(chip.key)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </PageHeader>

      {filteredEntries.length === 0 ? (
        <EmptyState
          icon={IconHistory}
          iconColor="gray"
          title="No activity yet"
          description="Actions like creating expenses, marking payments, and inviting members will appear here automatically."
          h={200}
        />
      ) : (
        <Stack gap="xs">
          {grouped.map((dateGroup) => (
            <Stack key={dateGroup.label} gap="xs">
              <div className="commune-date-header">{dateGroup.label}</div>
              {dateGroup.items.map((entry) => {
                const IconComponent = actionIcons[entry.action] ?? IconActivity;
                const color = actionColors[entry.action] ?? 'gray';

                return (
                  <Paper key={entry.id} className="commune-stat-card" p="md" radius="lg">
                    <Group wrap="nowrap" align="flex-start">
                      <ThemeIcon variant="light" color={color} size="lg" radius="xl">
                        <IconComponent size={18} />
                      </ThemeIcon>

                      <Stack gap={2} style={{ flex: 1 }}>
                        <Group justify="space-between" wrap="nowrap">
                          <Group gap="xs" wrap="nowrap">
                            <Avatar
                              src={entry.user?.avatar_url}
                              name={entry.user?.name}
                              color="initials"
                              size="sm"
                            />
                            <Text size="sm" fw={600}>
                              {entry.user?.name ?? 'Unknown'}
                            </Text>
                          </Group>
                          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                            {formatRelativeTime(entry.created_at)}
                          </Text>
                        </Group>

                        <Text size="sm" c="dimmed">
                          {describeAction(entry)}
                        </Text>
                      </Stack>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          ))}

          {entries.length >= limit && (
            <Button
              variant="light"
              fullWidth
              mt="sm"
              onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
            >
              Load more
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
}
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:5173/activity` — should show compact header with filter chips, date-grouped timeline. No hero card, no KPI cards.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/_app/activity.tsx
git commit -m "refactor: redesign Activity page as date-grouped timeline feed"
```

---

### Task 6: Redesign Members page — People Directory

**Files:**
- Modify: `apps/web/src/routes/_app/members.tsx` (rewrite the return JSX, keep all handler functions and state)

- [ ] **Step 1: Rewrite the Members page**

Replace the entire file `apps/web/src/routes/_app/members.tsx`. Key changes:
- Remove hero card and 4 KPI cards
- Add PageHeader with "Invite member" button in the action area
- Switch member list from vertical Stack inside a `commune-soft-panel` to a 2-column `commune-member-grid`
- Add dashed invite placeholder card at the end of the grid
- Keep all existing handler functions (handleRoleChange, handleRemove, handleLeaveGroup, handleTransferOwnership)
- Keep Group actions panel and modals as-is

```tsx
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Group,
  Menu,
  Modal,
  Paper,
  Stack,
  Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCrown,
  IconDoorExit,
  IconDots,
  IconSettings,
  IconShield,
  IconShieldCheck,
  IconUserMinus,
  IconUserPlus,
  IconUsers,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useGroupStore } from '../../stores/group';
import { useSearchStore } from '../../stores/search';
import { useGroup, useLeaveGroup, useRemoveMember, useTransferOwnership, useUpdateMemberRole, useUserGroups } from '../../hooks/use-groups';
import { useAuthStore } from '../../stores/auth';
import { InviteMemberModal } from '../../components/invite-member-modal';
import { PageLoader } from '../../components/page-loader';
import { EmptyState } from '../../components/empty-state';
import { PageHeader } from '../../components/page-header';

export const Route = createFileRoute('/_app/members')({
  component: MembersPage,
});

function MembersPage() {
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { data: group, isLoading } = useGroup(activeGroupId ?? '');
  const { data: userGroups } = useUserGroups();
  const { query: searchQuery } = useSearchStore();
  const { user } = useAuthStore();
  const updateRole = useUpdateMemberRole(activeGroupId ?? '');
  const removeMember = useRemoveMember(activeGroupId ?? '');
  const leaveGroupMutation = useLeaveGroup();
  const navigate = useNavigate();
  const transferOwnership = useTransferOwnership(activeGroupId ?? '');
  const [inviteOpened, { open: openInvite, close: closeInvite }] = useDisclosure(false);
  const [leaveOpened, { open: openLeave, close: closeLeave }] = useDisclosure(false);
  const [transferOpened, { open: openTransfer, close: closeTransfer }] = useDisclosure(false);
  const [transferTarget, setTransferTarget] = useState<{ userId: string; name: string } | null>(null);

  if (!activeGroupId) {
    return (
      <EmptyState
        icon={IconUsers}
        iconColor="emerald"
        title="Select a group first"
        description="Choose a group in the sidebar to see who is in it and who still needs an invite."
      />
    );
  }

  if (isLoading) {
    return <PageLoader message="Loading members..." />;
  }

  const isAdmin = group?.members.some((member) => member.user_id === user?.id && member.role === 'admin');
  const totalMembers = group?.members.length ?? 0;
  const adminCount = group?.members.filter((member) => member.role === 'admin').length ?? 0;
  const filteredMembers = (() => {
    const members = group?.members ?? [];
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return members;
    }

    return members.filter((member) => {
      const haystack = [
        member.user.name,
        member.user.email,
        member.role,
        member.status,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  })();

  const statusColor: Record<string, string> = {
    active: 'emerald',
    invited: 'orange',
    inactive: 'gray',
    removed: 'red',
  };

  async function handleRoleChange(memberId: string, role: 'admin' | 'member') {
    try {
      await updateRole.mutateAsync({ memberId, role });
      notifications.show({
        title: 'Role updated',
        message: `Member role changed to ${role}.`,
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to update role',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  async function handleRemove(memberId: string) {
    try {
      await removeMember.mutateAsync(memberId);
      notifications.show({
        title: 'Member removed',
        message: 'That member has been removed from the group.',
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to remove member',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  async function handleLeaveGroup() {
    if (!activeGroupId || !user?.id) return;
    try {
      await leaveGroupMutation.mutateAsync({ groupId: activeGroupId, userId: user.id });
      closeLeave();
      notifications.show({
        title: 'Left group',
        message: `You have left ${group?.name ?? 'the group'}.`,
        color: 'green',
      });

      const remainingGroups = (userGroups ?? []).filter((g) => g.id !== activeGroupId);
      if (remainingGroups.length > 0 && remainingGroups[0]) {
        setActiveGroupId(remainingGroups[0].id);
        navigate({ to: '/' });
      } else {
        setActiveGroupId(null);
        navigate({ to: '/onboarding' });
      }
    } catch (err) {
      notifications.show({
        title: 'Failed to leave group',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  const isOwner = user?.id === group?.owner_id;

  async function handleTransferOwnership() {
    if (!transferTarget) return;
    try {
      await transferOwnership.mutateAsync(transferTarget.userId);
      closeTransfer();
      setTransferTarget(null);
      notifications.show({
        title: 'Ownership transferred',
        message: `${transferTarget.name} is now the owner of ${group?.name ?? 'the group'}.`,
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Failed to transfer ownership',
        message: err instanceof Error ? err.message : 'Something went wrong',
        color: 'red',
      });
    }
  }

  const canLeave = user && group?.members.some((m) => m.user_id === user.id && m.status === 'active') && (
    !isAdmin || adminCount > 1
  );

  return (
    <Stack gap="lg">
      <PageHeader
        title="Members"
        subtitle={`${totalMembers} people in ${group?.name ?? 'this group'}`}
      >
        {isAdmin && (
          <Button leftSection={<IconUserPlus size={16} />} onClick={openInvite}>
            Invite member
          </Button>
        )}
      </PageHeader>

      {filteredMembers.length === 0 ? (
        <Text size="sm" c="dimmed">
          No members match the current top-bar search.
        </Text>
      ) : (
        <div className="commune-member-grid">
          {filteredMembers.map((member) => (
            <Paper key={member.id} className="commune-stat-card" p="md" radius="lg">
              <Group justify="space-between" align="center">
                <Group wrap="nowrap">
                  <Avatar src={member.user.avatar_url} name={member.user.name} color="initials" size="lg" />
                  <div>
                    <Group gap="xs">
                      <Text fw={600}>{member.user.name}</Text>
                      {member.user_id === user?.id && (
                        <Badge size="xs" variant="light" color="emerald">
                          You
                        </Badge>
                      )}
                    </Group>
                    <Text size="sm" c="dimmed">{member.user.email}</Text>
                  </div>
                </Group>

                <Group gap="xs">
                  <Badge color={statusColor[member.status] ?? 'gray'} variant="light">
                    {member.status}
                  </Badge>
                  <Badge color={member.role === 'admin' ? 'dark' : 'gray'} variant="light">
                    {member.role}
                  </Badge>
                  {isAdmin && member.user_id !== user?.id && (
                    <Menu shadow="md" width={220}>
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray">
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        {member.role === 'member' ? (
                          <Menu.Item
                            leftSection={<IconShieldCheck size={14} />}
                            onClick={() => handleRoleChange(member.id, 'admin')}
                          >
                            Make admin
                          </Menu.Item>
                        ) : (
                          <Menu.Item
                            leftSection={<IconShield size={14} />}
                            onClick={() => handleRoleChange(member.id, 'member')}
                          >
                            Make member
                          </Menu.Item>
                        )}
                        {isOwner && member.status === 'active' && (
                          <Menu.Item
                            leftSection={<IconCrown size={14} />}
                            onClick={() => {
                              setTransferTarget({ userId: member.user_id, name: member.user.name });
                              openTransfer();
                            }}
                          >
                            Transfer ownership
                          </Menu.Item>
                        )}
                        <Menu.Divider />
                        <Menu.Item
                          color="red"
                          leftSection={<IconUserMinus size={14} />}
                          onClick={() => handleRemove(member.id)}
                        >
                          Remove member
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  )}
                </Group>
              </Group>
            </Paper>
          ))}

          {isAdmin && (
            <div
              className="commune-invite-placeholder"
              onClick={openInvite}
              onKeyDown={(e) => { if (e.key === 'Enter') openInvite(); }}
              role="button"
              tabIndex={0}
            >
              <Group gap="xs">
                <IconUserPlus size={16} />
                <Text size="sm">Invite someone</Text>
              </Group>
            </div>
          )}
        </div>
      )}

      {/* ── Group actions (kept as-is) ── */}
      <Paper className="commune-soft-panel" p="xl">
        <Text className="commune-section-heading" mb="xs">Group actions</Text>
        <Text size="sm" c="dimmed" mb="lg">
          Manage your relationship with this group.
        </Text>

        <Group>
          {isAdmin && (
            <Button
              component={Link}
              to={`/groups/${activeGroupId}/edit`}
              leftSection={<IconSettings size={16} />}
              variant="light"
            >
              Edit group settings
            </Button>
          )}

          {canLeave && (
            <Button
              leftSection={<IconDoorExit size={16} />}
              variant="outline"
              color="red"
              onClick={openLeave}
            >
              Leave group
            </Button>
          )}
        </Group>

        {isAdmin && adminCount <= 1 && (
          <Text size="xs" c="dimmed" mt="sm">
            You are the only admin. Transfer admin to another member before you can leave.
          </Text>
        )}
      </Paper>

      <Modal opened={leaveOpened} onClose={closeLeave} title="Leave group" centered>
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to leave <Text span fw={600}>{group?.name}</Text>? You'll lose access to all expenses and payment history.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeLeave}>
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleLeaveGroup}
              loading={leaveGroupMutation.isPending}
            >
              Leave group
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={transferOpened}
        onClose={() => {
          closeTransfer();
          setTransferTarget(null);
        }}
        title="Transfer ownership"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Are you sure you want to transfer ownership of{' '}
            <Text span fw={600}>{group?.name}</Text> to{' '}
            <Text span fw={600}>{transferTarget?.name}</Text>?
            You will be demoted to a regular member.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                closeTransfer();
                setTransferTarget(null);
              }}
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleTransferOwnership}
              loading={transferOwnership.isPending}
            >
              Transfer ownership
            </Button>
          </Group>
        </Stack>
      </Modal>

      {activeGroupId && (
        <InviteMemberModal opened={inviteOpened} onClose={closeInvite} groupId={activeGroupId} />
      )}
    </Stack>
  );
}
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:5173/members` — should show compact header with invite button, 2-column member card grid, dashed invite placeholder, and group actions panel. No hero card, no KPI cards.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/_app/members.tsx
git commit -m "refactor: redesign Members page as people directory grid layout"
```

---

### Task 7: Final verification

- [ ] **Step 1: Navigate through all pages**

Check each page at `http://localhost:5173`:
- `/` (Dashboard) — hero card + KPIs + charts should be unchanged
- `/expenses` — compact header + filter chips + dense table
- `/breakdown` — compact header + summary card + progress bar + table
- `/activity` — compact header + filter chips + date-grouped timeline
- `/members` — compact header + 2-column grid + invite placeholder

- [ ] **Step 2: Check responsive behavior**

Resize browser to < 900px width. Verify:
- Page headers stack vertically
- Member grid becomes single column
- Summary stats stack vertically
- Filter chips wrap naturally

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @commune/web typecheck`
Expected: No TypeScript errors

- [ ] **Step 4: Run build**

Run: `pnpm --filter @commune/web build`
Expected: Build succeeds with no errors

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address any issues found during final verification"
```
