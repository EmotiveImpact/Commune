import { createLazyFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCash,
  IconCheck,
  IconPlus,
  IconReceipt,
  IconTargetArrow,
  IconUsers,
  IconWallet,
} from '@tabler/icons-react';
import { useEffect, useMemo, useRef } from 'react';
import { formatCurrency, formatDate, getMonthKey, isOverdue } from '@commune/utils';
import { useGroupStore } from '../../stores/group';
import { useAuthStore } from '../../stores/auth';
import { useGroup, usePendingInvites, useUserGroups } from '../../hooks/use-groups';
import { useDashboardStats } from '../../hooks/use-dashboard';
import { useGroupExpenses } from '../../hooks/use-expenses';
import { PageLoader } from '../../components/page-loader';
import { useGenerateRecurring } from '../../hooks/use-recurring';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

export const Route = createLazyFileRoute('/_app/')({
  component: DashboardPage,
});

const categoryPalette = [
  '#96E85F',
  '#104536',
  '#62C38A',
  '#B8DA7D',
  '#74D43B',
  '#D9F3C3',
];

function formatCategoryLabel(category: string) {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function getRecentMonthKeys(count: number) {
  const current = new Date();
  const keys: string[] = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const value = new Date(current.getFullYear(), current.getMonth() - offset, 1);
    keys.push(`${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`);
  }

  return keys;
}

function DashboardPage() {
  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { data: groups, isLoading: groupsLoading } = useUserGroups();
  const { data: pendingInvites, isLoading: invitesLoading } = usePendingInvites();
  const { data: group, isLoading: groupLoading } = useGroup(activeGroupId ?? '');
  const currentMonth = getMonthKey();
  const { data: stats, isLoading: statsLoading } = useDashboardStats(
    activeGroupId ?? '',
    user?.id ?? '',
    currentMonth,
  );
  const { data: allExpenses, isLoading: expensesLoading } = useGroupExpenses(activeGroupId ?? '');
  const generateRecurring = useGenerateRecurring(activeGroupId ?? '');
  const recurringGeneratedRef = useRef(false);

  useEffect(() => {
    if (activeGroupId && !recurringGeneratedRef.current) {
      recurringGeneratedRef.current = true;
      generateRecurring.mutate();
    }
  }, [activeGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeGroupId || groupsLoading || invitesLoading) {
      return;
    }

    if ((groups?.length ?? 0) === 0) {
      navigate({ to: '/onboarding', replace: true });
    }
  }, [activeGroupId, groups?.length, groupsLoading, invitesLoading, navigate]);

  const monthLabel = new Date(`${currentMonth}-01`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  const monthExpenses = useMemo(
    () => (allExpenses ?? []).filter((expense) => expense.due_date.startsWith(currentMonth)),
    [allExpenses, currentMonth],
  );

  const monthlyTrend = useMemo(() => {
    const keys = getRecentMonthKeys(6);
    const totals = new Map(keys.map((key) => [key, 0]));

    for (const expense of allExpenses ?? []) {
      const key = expense.due_date.slice(0, 7);
      if (totals.has(key)) {
        totals.set(key, (totals.get(key) ?? 0) + expense.amount);
      }
    }

    const values = keys.map((key) => totals.get(key) ?? 0);
    const max = Math.max(...values, 1);

    return {
      max,
      currentTotal: totals.get(currentMonth) ?? 0,
      items: keys.map((key) => ({
        key,
        label: new Date(`${key}-01`).toLocaleDateString('en-GB', { month: 'short' }),
        total: totals.get(key) ?? 0,
      })),
    };
  }, [allExpenses, currentMonth]);

  const categoryBreakdown = useMemo(() => {
    const source = monthExpenses.length > 0 ? monthExpenses : allExpenses ?? [];
    const grouped = new Map<string, number>();

    for (const expense of source) {
      grouped.set(expense.category, (grouped.get(expense.category) ?? 0) + expense.amount);
    }

    const total = Array.from(grouped.values()).reduce((sum, value) => sum + value, 0);

    return Array.from(grouped.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount], index) => ({
        category,
        amount,
        color: categoryPalette[index % categoryPalette.length]!,
        percent: total > 0 ? Math.round((amount / total) * 100) : 0,
      }));
  }, [allExpenses, monthExpenses]);

  const recentExpenses = useMemo(
    () =>
      [...(allExpenses ?? [])]
        .sort((left, right) => new Date(right.due_date).getTime() - new Date(left.due_date).getTime())
        .slice(0, 5),
    [allExpenses],
  );

  const focusItems = useMemo(() => {
    const cycleTotal = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);

    return (stats?.upcoming_items ?? [])
      .slice()
      .sort((left, right) => new Date(left.due_date).getTime() - new Date(right.due_date).getTime())
      .slice(0, 3)
      .map((expense) => {
        const userShare = expense.participants.find((participant) => participant.user_id === user?.id)?.share_amount
          ?? expense.amount;

        return {
          ...expense,
          userShare,
          weight: cycleTotal > 0 ? Math.round((userShare / cycleTotal) * 100) : 0,
        };
      });
  }, [monthExpenses, stats?.upcoming_items, user?.id]);
  const hasExpenses = (allExpenses?.length ?? 0) > 0;

  if (!activeGroupId) {
    if (groupsLoading || invitesLoading || (groups?.length ?? 0) > 0) {
      return <PageLoader message="Loading workspace..." />;
    }

    return (
      <PageLoader
        message={
          (pendingInvites?.length ?? 0) > 0
            ? 'Opening your group invite...'
            : 'Opening onboarding...'
        }
      />
    );
  }

  if (groupLoading || statsLoading || expensesLoading) {
    return <PageLoader message="Loading dashboard..." />;
  }

  const paidPct = stats && stats.your_share > 0
    ? Math.round((stats.amount_paid / stats.your_share) * 100)
    : 0;

  const statCards = [
    {
      label: 'Monthly budget',
      value: formatCurrency(stats?.total_spend ?? 0, group?.currency),
      note: monthLabel,
      icon: IconReceipt,
      tone: '#10B981',
      tint: 'rgba(16, 185, 129, 0.1)',
      panelTone: 'sage',
    },
    {
      label: 'Your share',
      value: formatCurrency(stats?.your_share ?? 0, group?.currency),
      note: 'Across active expenses',
      icon: IconWallet,
      tone: '#104536',
      tint: 'rgba(16, 69, 54, 0.1)',
      panelTone: 'ink',
    },
    {
      label: 'Remaining',
      value: formatCurrency(stats?.amount_remaining ?? 0, group?.currency),
      note: 'Still unpaid or unconfirmed',
      icon: IconCash,
      tone: '#62C38A',
      tint: 'rgba(98, 195, 138, 0.14)',
      panelTone: 'lilac',
    },
    {
      label: 'Overdue',
      value: String(stats?.overdue_count ?? 0),
      note: 'Past the due date',
      icon: IconAlertTriangle,
      tone: '#F59A76',
      tint: 'rgba(245, 154, 118, 0.16)',
      panelTone: 'peach',
    },
  ];

  if (!hasExpenses) {
    return (
      <Stack gap="xl">
        <Paper className="commune-hero-card" p={{ base: 'xl', md: '2rem' }}>
          <div className="commune-hero-grid">
            <Stack gap="md" maw={620}>
              <div className="commune-hero-chip">{monthLabel}</div>
              <Stack gap="xs">
                <Title order={1}>
                  Shared money, <span className="commune-hero-highlight">without the friction.</span>
                </Title>
                <Text size="lg" className="commune-hero-copy">
                  {group?.name} is ready, but it still needs one real cycle before the dashboard can show anything useful.
                </Text>
              </Stack>

              <Group className="commune-hero-actions">
                <Button
                  component={Link}
                  to="/expenses/new"
                  leftSection={<IconPlus size={16} />}
                  styles={{
                    root: {
                      background: 'linear-gradient(145deg, #f3decb 0%, #d8ebe4 100%)',
                      color: 'var(--commune-forest)',
                      boxShadow: 'none',
                    },
                  }}
                >
                  Add expense
                </Button>
                <Button
                  component={Link}
                  to="/members"
                  variant="white"
                  leftSection={<IconUsers size={16} />}
                  styles={{
                    root: {
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: '#fffaf6',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    },
                  }}
                >
                  View members
                </Button>
              </Group>
            </Stack>

            <Stack className="commune-hero-aside" gap="md">
              <Group justify="space-between">
                <div>
                  <Text size="sm" c="rgba(255, 250, 246, 0.65)">
                    Setup snapshot
                  </Text>
                  <Text fw={800} size="1.8rem">
                    0 live expenses
                  </Text>
                </div>
                <Badge
                  variant="light"
                  styles={{ root: { background: 'rgba(255, 255, 255, 0.12)' } }}
                >
                  Ready to start
                </Badge>
              </Group>

              <SimpleGrid cols={2} spacing="sm">
                <div className="commune-hero-aside-stat">
                  <Text size="xs" c="rgba(255, 250, 246, 0.55)" tt="uppercase">
                    Members
                  </Text>
                  <Text fw={700} size="lg">
                    {group?.members.length ?? 0}
                  </Text>
                </div>
                <div className="commune-hero-aside-stat">
                  <Text size="xs" c="rgba(255, 250, 246, 0.55)" tt="uppercase">
                    Open items
                  </Text>
                  <Text fw={700} size="lg">
                    0
                  </Text>
                </div>
              </SimpleGrid>

              <div className="commune-soft-progress">
                <Group justify="space-between" mb={8}>
                  <Text size="sm" c="rgba(255, 250, 246, 0.7)">
                    First cycle progress
                  </Text>
                  <Text size="sm" c="rgba(255, 250, 246, 0.7)">
                    0%
                  </Text>
                </Group>
                <Progress value={0} size="lg" color="commune" />
              </div>
            </Stack>
          </div>
        </Paper>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
          <Paper className="commune-soft-panel commune-checklist-card" p="xl">
            <ThemeIcon size={42} variant="light" color="lime">
              <IconUsers size={20} />
            </ThemeIcon>
            <Text fw={700} size="lg" mt="md">Invite the group</Text>
            <Text size="sm" c="dimmed" mt={6}>
              Make sure the real members are in place before you start splitting costs.
            </Text>
            <Button component={Link} to="/members" variant="light" mt="lg">
              Manage members
            </Button>
          </Paper>

          <Paper className="commune-soft-panel commune-checklist-card" p="xl">
            <ThemeIcon size={42} variant="light" color="commune">
              <IconReceipt size={20} />
            </ThemeIcon>
            <Text fw={700} size="lg" mt="md">Add the first expense</Text>
            <Text size="sm" c="dimmed" mt={6}>
              Start with one real bill so the dashboard can replace setup mode with real numbers.
            </Text>
            <Button component={Link} to="/expenses/new" mt="lg">
              Create expense
            </Button>
          </Paper>

          <Paper className="commune-soft-panel commune-checklist-card" p="xl">
            <ThemeIcon size={42} variant="light" color="green">
              <IconCheck size={20} />
            </ThemeIcon>
            <Text fw={700} size="lg" mt="md">Mark the first payment</Text>
            <Text size="sm" c="dimmed" mt={6}>
              Once someone pays and it gets confirmed, the progress panels start telling the truth.
            </Text>
            <Button component={Link} to="/breakdown" variant="default" mt="lg">
              Open breakdown
            </Button>
          </Paper>
        </SimpleGrid>

        <Paper className="commune-soft-panel commune-empty-dashboard-panel" p="xl">
          <Group justify="space-between" align="flex-start">
            <Stack gap="xs" maw={620}>
              <Badge variant="light" color="gray" w="fit-content">
                Setup mode
              </Badge>
              <Title order={2}>This workspace needs one clean cycle to come alive.</Title>
              <Text size="md" c="dimmed">
                Right now there is nothing to calculate, so showing a full analytics dashboard would just be noise. Add one shared expense, include the real members, and the monthly totals, category split, and payment focus will all start populating automatically.
              </Text>
            </Stack>

            <Button component={Link} to="/expenses/new" rightSection={<IconTargetArrow size={16} />}>
              Start with an expense
            </Button>
          </Group>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <Paper className="commune-hero-card" p={{ base: 'xl', md: '2rem' }}>
        <div className="commune-hero-grid">
          <Stack gap="md" maw={620}>
            <div className="commune-hero-chip">{monthLabel}</div>
            <Stack gap="xs">
              <Title order={1}>
                Shared money, <span className="commune-hero-highlight">without the friction.</span>
              </Title>
              <Text size="lg" className="commune-hero-copy">
                Track what the group is spending, what each member owes, and what needs attention next for {group?.name}.
              </Text>
            </Stack>

            <Group className="commune-hero-actions">
              <Button
                component={Link}
                to="/expenses/new"
                leftSection={<IconPlus size={16} />}
                styles={{
                  root: {
                    background: 'linear-gradient(145deg, #f3decb 0%, #d8ebe4 100%)',
                    color: 'var(--commune-forest)',
                    boxShadow: 'none',
                  },
                }}
              >
                Add expense
              </Button>
              <Button
                component={Link}
                to="/members"
                variant="white"
                leftSection={<IconUsers size={16} />}
                styles={{
                  root: {
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#fffaf6',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  },
                }}
              >
                View members
              </Button>
            </Group>
          </Stack>

          <Stack className="commune-hero-aside" gap="md">
            <Group justify="space-between">
              <div>
                <Text size="sm" c="rgba(255, 250, 246, 0.65)">
                  Cycle snapshot
                </Text>
                <Text fw={800} size="1.8rem">
                  {formatCurrency(stats?.amount_remaining ?? 0, group?.currency)}
                </Text>
              </div>
              <Badge
                variant="light"
                color={stats?.overdue_count ? 'red' : 'commune'}
                styles={{ root: { background: 'rgba(255, 255, 255, 0.12)' } }}
              >
                {stats?.overdue_count ? 'Action needed' : 'On track'}
              </Badge>
            </Group>

            <SimpleGrid cols={2} spacing="sm">
              <div className="commune-hero-aside-stat">
                <Text size="xs" c="rgba(255, 250, 246, 0.55)" tt="uppercase">
                  Paid
                </Text>
                <Text fw={700} size="lg">
                  {formatCurrency(stats?.amount_paid ?? 0, group?.currency)}
                </Text>
              </div>
              <div className="commune-hero-aside-stat">
                <Text size="xs" c="rgba(255, 250, 246, 0.55)" tt="uppercase">
                  Open items
                </Text>
                <Text fw={700} size="lg">
                  {(stats?.upcoming_items ?? []).length}
                </Text>
              </div>
            </SimpleGrid>

            <div className="commune-soft-progress">
              <Group justify="space-between" mb={8}>
                <Text size="sm" c="rgba(255, 250, 246, 0.7)">
                  Payment completion
                </Text>
                <Text size="sm" c="rgba(255, 250, 246, 0.7)">
                  {paidPct}%
                </Text>
              </Group>
              <Progress value={paidPct} size="lg" color="commune" />
            </div>
          </Stack>
        </div>
      </Paper>

      <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="lg">
        {statCards.map((stat) => (
          <Paper key={stat.label} className="commune-stat-card commune-kpi-card" p="lg" data-tone={stat.panelTone}>
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  {stat.label}
                </Text>
                <Text fw={800} size="2rem" lh={1.05}>
                  {stat.value}
                </Text>
                <Text size="sm" c="dimmed">
                  {stat.note}
                </Text>
              </Stack>
              <ThemeIcon
                size={42}
                variant="light"
                style={{
                  backgroundColor: stat.tint,
                  color: stat.tone,
                }}
              >
                <stat.icon size={20} />
              </ThemeIcon>
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      <div className="commune-dashboard-grid">
        <Stack gap="lg">
          <Stack gap="lg">
            <Paper className="commune-soft-panel" p="xl">
              <Group justify="space-between" align="flex-start" mb="md">
                <div>
                  <Text className="commune-section-heading">
                    Transaction overview
                  </Text>
                  <Text size="sm" c="dimmed">
                    Active expense volume across the last six months.
                  </Text>
                </div>
                <Badge className="commune-pill-badge" variant="light" color="gray">
                  Last 6 months
                </Badge>
              </Group>

              {monthlyTrend.items.some((item) => item.total > 0) ? (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={monthlyTrend.items} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(22,19,29,0.06)" vertical={false} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#667085', fontSize: 13, fontWeight: 500 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#667085', fontSize: 12 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                      <Tooltip
                        contentStyle={{ background: '#1f2330', border: 'none', borderRadius: 10, color: '#f8f5f0', fontSize: 13, boxShadow: '0 8px 24px rgba(0,0,0,.18)' }}
                        formatter={(value) => [formatCurrency(Number(value), group?.currency), 'Spend']}
                        cursor={{ fill: 'rgba(32,92,84,0.06)' }}
                      />
                      <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={48} fill="url(#barGradient)" />
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2d6a4f" />
                          <stop offset="100%" stopColor="#1b4332" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>

                  <Group justify="space-between" mt="md">
                    <div>
                      <Text size="sm" c="dimmed">Current month total</Text>
                      <Text fw={800} size="1.85rem">{formatCurrency(monthlyTrend.currentTotal, group?.currency)}</Text>
                    </div>
                    <div>
                      <Text size="sm" c="dimmed" ta="right">Average per month</Text>
                      <Text fw={700} ta="right">
                        {formatCurrency(
                          monthlyTrend.items.reduce((sum, item) => sum + item.total, 0) / monthlyTrend.items.length,
                          group?.currency,
                        )}
                      </Text>
                    </div>
                  </Group>
                </>
              ) : (
                <Paper className="commune-stat-card" p="lg" radius="lg">
                  <Text fw={600}>No trend data yet.</Text>
                  <Text size="sm" c="dimmed">
                    Add expenses and this panel will start showing how the group changes over time.
                  </Text>
                </Paper>
              )}
            </Paper>

            <Paper className="commune-soft-panel" p="xl">
              <Group justify="space-between" align="flex-start" mb="md">
                <div>
                  <Text className="commune-section-heading">
                    Recent expenses
                  </Text>
                  <Text size="sm" c="dimmed">
                    Latest shared costs added to the group.
                  </Text>
                </div>
                <Button component={Link} to="/expenses" variant="subtle" rightSection={<IconArrowRight size={16} />}>
                  View all
                </Button>
              </Group>

              {recentExpenses.length > 0 ? (
                <div className="commune-table-shell">
                  <Table verticalSpacing="md" horizontalSpacing="sm">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Expense</Table.Th>
                        <Table.Th>Category</Table.Th>
                        <Table.Th>Due date</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th style={{ textAlign: 'right' }}>Amount</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {recentExpenses.map((expense) => {
                        const unpaid = expense.payment_records.filter((payment) => payment.status === 'unpaid').length;
                        const settled = unpaid === 0;
                        const overdue = isOverdue(expense.due_date);

                        return (
                          <Table.Tr key={expense.id}>
                            <Table.Td>
                              <Text component={Link} to={`/expenses/${expense.id}`} fw={600} style={{ textDecoration: 'none' }}>
                                {expense.title}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge className="commune-pill-badge" variant="light" color="gray">
                                {formatCategoryLabel(expense.category)}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" c="dimmed">
                                {formatDate(expense.due_date)}
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
              ) : (
                <Paper className="commune-stat-card" p="lg" radius="lg">
                  <Text fw={600}>No expenses added yet.</Text>
                  <Text size="sm" c="dimmed">
                    Create your first expense to populate this table.
                  </Text>
                </Paper>
              )}
            </Paper>
          </Stack>
        </Stack>

        <Stack gap="lg">
          <Stack gap="lg">
            <Paper className="commune-soft-panel" p="xl">
              <Group justify="space-between" align="flex-start" mb="md">
                <div>
                  <Text className="commune-section-heading">
                    Spending by category
                  </Text>
                  <Text size="sm" c="dimmed">
                    Where the money is going this cycle.
                  </Text>
                </div>
                <Badge className="commune-pill-badge" variant="light" color="gray">
                  This month
                </Badge>
              </Group>

              {categoryBreakdown.length > 0 ? (
                <Stack gap="xl" align="center">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        dataKey="amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={72}
                        outerRadius={110}
                        strokeWidth={2}
                        stroke="rgba(255,255,255,0.8)"
                        paddingAngle={3}
                      >
                        {categoryBreakdown.map((entry) => (
                          <Cell key={entry.category} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#1f2330', border: 'none', borderRadius: 10, color: '#f8f5f0', fontSize: 13, boxShadow: '0 8px 24px rgba(0,0,0,.18)' }}
                        formatter={(value) => [formatCurrency(Number(value), group?.currency), 'Spend']}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <Stack gap="sm" w="100%">
                    {categoryBreakdown.map((item) => (
                      <Group key={item.category} justify="space-between" wrap="nowrap">
                        <Group gap="sm" wrap="nowrap">
                          <div className="commune-legend-dot" style={{ background: item.color }} />
                          <div>
                            <Text fw={600}>{formatCategoryLabel(item.category)}</Text>
                            <Text size="xs" c="dimmed">
                              {formatCurrency(item.amount, group?.currency)}
                            </Text>
                          </div>
                        </Group>
                        <Text fw={700}>{item.percent}%</Text>
                      </Group>
                    ))}
                  </Stack>
                </Stack>
              ) : (
                <Paper className="commune-stat-card" p="lg" radius="lg">
                  <Text fw={600}>No category split yet.</Text>
                  <Text size="sm" c="dimmed">
                    Once expenses exist, category balance will show here.
                  </Text>
                </Paper>
              )}
            </Paper>

            <Paper className="commune-soft-panel" p="xl">
              <Stack gap="lg">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text className="commune-section-heading">
                      Payment focus
                    </Text>
                    <Text size="sm" c="dimmed">
                      What needs attention next.
                    </Text>
                  </div>
                  <Badge color={stats?.overdue_count ? 'red' : 'emerald'} variant="light">
                    {stats?.overdue_count ?? 0} overdue
                  </Badge>
                </Group>

                <SimpleGrid cols={2} spacing="md">
                  <Paper className="commune-stat-card commune-kpi-card" p="md" radius="lg" data-tone="sage">
                    <Text size="sm" c="dimmed">
                      Paid so far
                    </Text>
                    <Text fw={800} size="1.5rem">
                      {formatCurrency(stats?.amount_paid ?? 0, group?.currency)}
                    </Text>
                  </Paper>
                  <Paper className="commune-stat-card commune-kpi-card" p="md" radius="lg" data-tone="peach">
                    <Text size="sm" c="dimmed">
                      Still remaining
                    </Text>
                    <Text fw={800} size="1.5rem">
                      {formatCurrency(stats?.amount_remaining ?? 0, group?.currency)}
                    </Text>
                  </Paper>
                </SimpleGrid>

                <div className="commune-soft-progress">
                  <Group justify="space-between" mb={8}>
                    <Text fw={600}>Your cycle progress</Text>
                    <Text size="sm" c="dimmed">
                      {paidPct}% complete
                    </Text>
                  </Group>
                  <Progress value={paidPct} size="xl" color="commune" />
                </div>

                <Stack gap="sm">
                  {focusItems.length > 0 ? focusItems.map((expense) => (
                    <Paper key={expense.id} className="commune-stat-card commune-focus-card" p="md" radius="lg">
                      <Stack gap="sm">
                        <Group justify="space-between" align="flex-start">
                          <div>
                            <Text fw={600}>{expense.title}</Text>
                            <Text size="sm" c="dimmed">
                              Due {formatDate(expense.due_date)}
                            </Text>
                          </div>
                          <Stack gap={4} align="flex-end">
                            <Text fw={700}>{formatCurrency(expense.userShare, group?.currency)}</Text>
                            <Badge variant="light" color={isOverdue(expense.due_date) ? 'red' : 'emerald'}>
                              {isOverdue(expense.due_date) ? 'Urgent' : 'Upcoming'}
                            </Badge>
                          </Stack>
                        </Group>
                        <div className="commune-focus-progress">
                          <Progress value={Math.max(expense.weight, 6)} color="commune" />
                        </div>
                      </Stack>
                    </Paper>
                  )) : (
                    <Paper className="commune-stat-card" p="lg" radius="lg">
                      <Text fw={600}>Nothing urgent is due this week.</Text>
                      <Text size="sm" c="dimmed">
                        Upcoming group payments will appear here when they are close enough to matter.
                      </Text>
                    </Paper>
                  )}
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        </Stack>
      </div>
    </Stack>
  );
}
