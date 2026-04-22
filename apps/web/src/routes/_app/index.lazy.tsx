import { createLazyFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Group,
  Paper,
  Progress,
  Skeleton,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
  useComputedColorScheme,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowRight,
  IconArrowsExchange,
  IconCash,
  IconCheck,
  IconCoin,
  IconDashboard,
  IconDownload,
  IconFileExport,
  IconPlus,
  IconReceipt,
  IconRefresh,
  IconTargetArrow,
  IconTemplate,
  IconUsers,
  IconWallet,
} from '@tabler/icons-react';
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { formatCurrency, formatDate, formatMonthKey, getMonthKey, isOverdue } from '@commune/utils';
import type { GroupType } from '@commune/types';
import { getOnboardingTips } from '@commune/core';
import { setPageTitle } from '../../utils/seo';
import { useGroupStore } from '../../stores/group';
import { useAuthStore } from '../../stores/auth';
import { useGroupSummary, useUserGroupSummaries } from '../../hooks/use-groups';
import { useDashboardStats, useDashboardSummary } from '../../hooks/use-dashboard';
import { DashboardSkeleton } from '../../components/page-skeleton';
import { useGenerateRecurring, usePendingRecurringGeneration } from '../../hooks/use-recurring';
import { useDeferredSection } from '../../hooks/use-deferred-section';
import { SetBudgetModal } from '../../components/set-budget-modal';

export const Route = createLazyFileRoute('/_app/')({
  component: DashboardPage,
});

const DashboardTransactionOverviewChart = lazy(() =>
  import('../../components/dashboard-charts').then((module) => ({
    default: module.DashboardTransactionOverviewChart,
  })),
);

const DashboardCategoryBreakdownChart = lazy(() =>
  import('../../components/dashboard-charts').then((module) => ({
    default: module.DashboardCategoryBreakdownChart,
  })),
);

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

// ─── F36: Group-Type-Aware Configuration ─────────────────────────────────────

interface QuickAction {
  label: string;
  to: string;
  icon: typeof IconPlus;
  variant?: 'filled' | 'default' | 'light';
}

function getQuickActions(groupType: GroupType | undefined): QuickAction[] {
  switch (groupType) {
    case 'home':
      return [
        { label: 'Add recurring bill', to: '/recurring', icon: IconRefresh },
        { label: 'View settlement', to: '/breakdown', icon: IconArrowsExchange },
        { label: 'Set auto-split', to: '/templates', icon: IconTemplate, variant: 'light' },
      ];
    case 'trip':
      return [
        { label: 'Quick expense', to: '/expenses/new', icon: IconPlus },
        { label: 'View settlement', to: '/breakdown', icon: IconArrowsExchange },
        { label: 'Import expenses', to: '/import', icon: IconDownload, variant: 'light' },
      ];
    case 'couple':
      return [
        { label: 'Add expense', to: '/expenses/new', icon: IconPlus },
        { label: 'View balance', to: '/breakdown', icon: IconArrowsExchange },
      ];
    case 'workspace':
      return [
        { label: 'Add shared cost', to: '/expenses/new', icon: IconPlus },
        { label: 'Export', to: '/analytics', icon: IconFileExport, variant: 'light' },
      ];
    case 'project':
      return [
        { label: 'Add expense', to: '/expenses/new', icon: IconPlus },
        { label: 'View budget', to: '/analytics', icon: IconCoin },
        { label: 'Export', to: '/analytics', icon: IconFileExport, variant: 'light' },
      ];
    default:
      return [
        { label: 'Add expense', to: '/expenses/new', icon: IconPlus },
        { label: 'View settlement', to: '/breakdown', icon: IconArrowsExchange },
      ];
  }
}

function getEmptyStateConfig(groupType: GroupType | undefined, groupName: string | undefined) {
  switch (groupType) {
    case 'home':
      return {
        heroCopy: `${groupName ?? 'Your home group'} is set up. Start by adding your recurring household bills like rent and utilities.`,
        addExpenseLabel: 'Add recurring bill',
        addExpenseTo: '/recurring',
        checklistDescription: 'Start with one real bill like rent or utilities so the dashboard can replace setup mode with real numbers.',
        bottomTitle: 'Start by adding your recurring household bills like rent and utilities.',
        bottomDescription: 'Add a recurring bill, include the housemates, and the monthly totals, category split, and payment focus will all start populating automatically.',
      };
    case 'trip':
      return {
        heroCopy: `${groupName ?? 'Your trip group'} is ready. Log your first shared trip expense to get started.`,
        addExpenseLabel: 'Quick expense',
        addExpenseTo: '/expenses/new',
        checklistDescription: 'Log your first shared trip expense so everyone knows what they owe.',
        bottomTitle: 'Log your first shared trip expense.',
        bottomDescription: 'Add an expense, tag the participants, and the group balance will calculate automatically.',
      };
    case 'couple':
      return {
        heroCopy: `${groupName ?? 'Your shared space'} is ready. Track your first shared expense together.`,
        addExpenseLabel: 'Add expense',
        addExpenseTo: '/expenses/new',
        checklistDescription: 'Track your first shared expense together to see how the balance looks.',
        bottomTitle: 'Track your first shared expense together.',
        bottomDescription: 'Add a shared cost and the dashboard will show who owes what at a glance.',
      };
    case 'workspace':
      return {
        heroCopy: `${groupName ?? 'Your workspace'} is set up. Add your first shared office expense to get started.`,
        addExpenseLabel: 'Add shared cost',
        addExpenseTo: '/expenses/new',
        checklistDescription: 'Add your first shared office expense so the team can track costs.',
        bottomTitle: 'Add your first shared office expense.',
        bottomDescription: 'Log shared costs, split them across the team, and the analytics will populate automatically.',
      };
    case 'project':
      return {
        heroCopy: `${groupName ?? 'Your project'} is ready. Add your first project expense to start tracking the budget.`,
        addExpenseLabel: 'Add expense',
        addExpenseTo: '/expenses/new',
        checklistDescription: 'Add your first project expense so the budget tracking can begin.',
        bottomTitle: 'Add your first project expense.',
        bottomDescription: 'Start logging project costs and the budget tracker will show progress against your targets.',
      };
    default:
      return {
        heroCopy: `${groupName ?? 'Your group'} is ready, but it still needs one real cycle before the dashboard can show anything useful.`,
        addExpenseLabel: 'Add expense',
        addExpenseTo: '/expenses/new',
        checklistDescription: 'Start with one real bill so the dashboard can replace setup mode with real numbers.',
        bottomTitle: 'This workspace needs one clean cycle to come alive.',
        bottomDescription: 'Right now there is nothing to calculate, so showing a full analytics dashboard would just be noise. Add one shared expense, include the real members, and the monthly totals, category split, and payment focus will all start populating automatically.',
      };
  }
}

// ─── F35: Budget progress helpers ────────────────────────────────────────────

function getBudgetColor(pct: number): string {
  if (pct >= 100) return 'red';
  if (pct >= 80) return 'yellow';
  return 'green';
}

function DashboardOverviewChartFallback() {
  return (
    <Stack gap="md">
      <Skeleton height={240} radius="md" />
      <Group justify="space-between">
        <Skeleton height={20} width={150} radius="sm" />
        <Skeleton height={20} width={140} radius="sm" />
      </Group>
    </Stack>
  );
}

function DashboardCategoryChartFallback() {
  return (
    <Stack gap="xl">
      <Skeleton height={260} radius="md" />
      <Stack gap="sm">
        <Skeleton height={20} radius="sm" />
        <Skeleton height={20} radius="sm" />
        <Skeleton height={20} radius="sm" />
      </Stack>
    </Stack>
  );
}

// ─── Dashboard Page ──────────────────────────────────────────────────────────

function DashboardPage() {
  const colorScheme = useComputedColorScheme('light');
  const tickFill = colorScheme === 'dark' ? '#909296' : '#667085';
  const gridStroke = colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(22,19,29,0.06)';

  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { data: groups, isLoading: groupsLoading } = useUserGroupSummaries();
  const resolvedActiveGroupId = useMemo(() => {
    if (!groups?.length) {
      return null;
    }

    if (activeGroupId && groups.some((candidate) => candidate.id === activeGroupId)) {
      return activeGroupId;
    }

    return groups[0]?.id ?? null;
  }, [activeGroupId, groups]);
  const { data: group, isLoading: groupLoading } = useGroupSummary(resolvedActiveGroupId ?? '');
  const activeGroupSummary = useMemo(
    () => groups?.find((candidate) => candidate.id === resolvedActiveGroupId) ?? null,
    [groups, resolvedActiveGroupId],
  );
  const currentMonth = getMonthKey();
  const { data: dashboardSummary, isLoading: summaryLoading } = useDashboardSummary(
    resolvedActiveGroupId ?? '',
    currentMonth,
  );
  const needsStatsFallback = !summaryLoading && dashboardSummary?.stats == null;
  const { data: fallbackStats, isLoading: fallbackStatsLoading } = useDashboardStats(
    resolvedActiveGroupId ?? '',
    user?.id ?? '',
    currentMonth,
    { enabled: needsStatsFallback },
  );
  const generateRecurring = useGenerateRecurring(resolvedActiveGroupId ?? '');
  const { data: hasPendingRecurringGeneration } = usePendingRecurringGeneration(
    resolvedActiveGroupId ?? '',
    currentMonth,
    { enabled: !!resolvedActiveGroupId && activeGroupSummary?.current_user_role === 'admin' },
  );
  const recurringGenerationKeyRef = useRef<string | null>(null);

  // F35: Budget data
  const [budgetModalOpened, setBudgetModalOpened] = useState(false);

  useEffect(() => {
    const generationKey = resolvedActiveGroupId
      ? `${resolvedActiveGroupId}:${currentMonth}`
      : null;

    if (
      generationKey
      && hasPendingRecurringGeneration
      && recurringGenerationKeyRef.current !== generationKey
    ) {
      recurringGenerationKeyRef.current = generationKey;
      generateRecurring.mutate(undefined, {
        onError: () => {
          if (recurringGenerationKeyRef.current === generationKey) {
            recurringGenerationKeyRef.current = null;
          }
        },
      });
    }
  }, [currentMonth, generateRecurring, hasPendingRecurringGeneration, resolvedActiveGroupId]);

  useEffect(() => {
    setPageTitle('Dashboard');
  }, []);

  useEffect(() => {
    if (resolvedActiveGroupId || groupsLoading) {
      return;
    }

    if ((groups?.length ?? 0) === 0) {
      navigate({ to: '/onboarding', replace: true });
    }
  }, [resolvedActiveGroupId, groups?.length, groupsLoading, navigate]);

  const monthLabel = formatMonthKey(currentMonth, 'en-GB', {
    month: 'long',
    year: 'numeric',
  });

  const monthlyTrend = useMemo(() => {
    const keys = getRecentMonthKeys(6);
    const totals = new Map(keys.map((key) => [key, 0]));

    for (const item of dashboardSummary?.trend ?? []) {
      if (totals.has(item.month)) {
        totals.set(item.month, item.total);
      }
    }

    const values = keys.map((key) => totals.get(key) ?? 0);
    const max = Math.max(...values, 1);

    return {
      max,
      currentTotal: totals.get(currentMonth) ?? 0,
      items: keys.map((key) => ({
        key,
        label: formatMonthKey(key, 'en-GB', { month: 'short' }),
        total: totals.get(key) ?? 0,
      })),
    };
  }, [currentMonth, dashboardSummary?.trend]);

  const categoryBreakdown = useMemo(
    () =>
      (dashboardSummary?.category_breakdown ?? []).map((item, index) => ({
        ...item,
        color: categoryPalette[index % categoryPalette.length]!,
      })),
    [dashboardSummary?.category_breakdown],
  );

  const hasTrendData = monthlyTrend.items.some((item) => item.total > 0);
  const hasCategoryData = categoryBreakdown.length > 0;
  const {
    ref: overviewChartRef,
    ready: showOverviewChart,
  } = useDeferredSection({
    enabled: hasTrendData,
  });
  const {
    ref: categoryChartRef,
    ready: showCategoryChart,
  } = useDeferredSection({
    enabled: hasCategoryData,
  });

  const recentExpenses = dashboardSummary?.recent_expenses ?? [];
  const stats = dashboardSummary?.stats ?? fallbackStats;
  const currentBudget = dashboardSummary?.budget ?? null;

  const focusItems = useMemo(() => {
    const cycleTotal = dashboardSummary?.current_month_total ?? 0;

    if (dashboardSummary?.stats) {
      return dashboardSummary.stats.upcoming_items
        .slice()
        .sort((left, right) => new Date(left.due_date).getTime() - new Date(right.due_date).getTime())
        .slice(0, 3)
        .map((expense) => ({
          ...expense,
          userShare: expense.user_share,
          weight: cycleTotal > 0 ? Math.round((expense.user_share / cycleTotal) * 100) : 0,
        }));
    }

    return (fallbackStats?.upcoming_items ?? [])
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
  }, [dashboardSummary?.current_month_total, dashboardSummary?.stats, fallbackStats?.upcoming_items, user?.id]);
  const hasExpenses = (dashboardSummary?.expense_count ?? 0) > 0;

  // F35: Budget calculations
  const budgetPct = currentBudget && currentBudget.budget_amount > 0
    ? Math.round(((dashboardSummary?.current_month_total ?? 0) / currentBudget.budget_amount) * 100)
    : null;

  // F35.7: Category budget spend breakdown
  const categorySpend = useMemo(() => {
    if (!currentBudget?.category_budgets) return [];
    const budgets = currentBudget.category_budgets as Record<string, number>;
    const spendByCategory = dashboardSummary?.current_month_category_totals ?? {};

    return Object.entries(budgets)
      .filter(([, budget]) => budget > 0)
      .map(([category, budget]) => ({
        category,
        budget,
        spent: spendByCategory[category] ?? 0,
        pct: Math.round(((spendByCategory[category] ?? 0) / budget) * 100),
      }));
  }, [currentBudget?.category_budgets, dashboardSummary?.current_month_category_totals]);

  // F36: Onboarding tips (group-type-aware)
  const onboardingTips = useMemo(
    () => (group && !hasExpenses ? getOnboardingTips(group.type) : []),
    [group, hasExpenses],
  );

  if (!resolvedActiveGroupId) {
    if (groupsLoading) {
      return <DashboardSkeleton />;
    }

    if ((groups?.length ?? 0) > 0) {
      return (
        <Stack gap="xl" py="xl" align="center" maw={480} mx="auto">
          <IconDashboard size={48} style={{ color: 'var(--commune-primary)', opacity: 0.5 }} />
          <Text size="xl" fw={700} ta="center">Select a group to get started</Text>
          <Text size="sm" c="dimmed" ta="center">
            Choose one of your groups to view its dashboard, expenses, and members.
          </Text>
          <Button
            component={Link}
            to="/groups"
            size="md"
            variant="light"
          >
            View my groups
          </Button>
        </Stack>
      );
    }

    return <DashboardSkeleton />;
  }

  if (groupLoading || summaryLoading || (needsStatsFallback && fallbackStatsLoading)) {
    return <DashboardSkeleton />;
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

  // F36: Get group-type-specific configuration
  const quickActions = getQuickActions(group?.type);
  const emptyConfig = getEmptyStateConfig(group?.type, group?.name);

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
                  {emptyConfig.heroCopy}
                </Text>
              </Stack>

              {/* F36: Group-type-aware quick actions */}
              <Group className="commune-hero-actions">
                <Button
                  component={Link}
                  to={emptyConfig.addExpenseTo}
                  leftSection={<IconPlus size={16} />}
                  styles={{
                    root: {
                      background: 'linear-gradient(145deg, #f3decb 0%, #d8ebe4 100%)',
                      color: 'var(--commune-forest)',
                      boxShadow: 'none',
                    },
                  }}
                >
                  {emptyConfig.addExpenseLabel}
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
                    {group?.active_member_count ?? 0}
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

        {/* F36: Onboarding tips checklist */}
        {onboardingTips.length > 0 && (
          <Paper className="commune-soft-panel" p="lg" style={{ borderLeft: '3px solid var(--mantine-color-commune-5)' }}>
            <Text fw={600} mb="sm">Getting started</Text>
            <Stack gap="xs">
              {onboardingTips.map((tip) => (
                <Group key={tip} gap="sm" wrap="nowrap">
                  <ThemeIcon size={20} variant="light" color="commune" radius="xl">
                    <IconCheck size={12} />
                  </ThemeIcon>
                  <Text size="sm" c="dimmed">{tip}</Text>
                </Group>
              ))}
            </Stack>
          </Paper>
        )}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
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
              {emptyConfig.checklistDescription}
            </Text>
            <Button component={Link} to={emptyConfig.addExpenseTo} mt="lg">
              {emptyConfig.addExpenseLabel}
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
              <Title order={2}>{emptyConfig.bottomTitle}</Title>
              <Text size="md" c="dimmed">
                {emptyConfig.bottomDescription}
              </Text>
            </Stack>

            <Button component={Link} to={emptyConfig.addExpenseTo} rightSection={<IconTargetArrow size={16} />}>
              {emptyConfig.addExpenseLabel}
            </Button>
          </Group>
        </Paper>

        {/* F35: Budget modal */}
        <SetBudgetModal
          opened={budgetModalOpened}
          onClose={() => setBudgetModalOpened(false)}
          groupId={resolvedActiveGroupId}
          currency={group?.currency}
          currentAmount={currentBudget?.budget_amount}
          currentAlertThreshold={currentBudget?.alert_threshold}
        />
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

            {/* F36: Group-type-aware quick actions */}
            <Group className="commune-hero-actions" gap="sm">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  component={Link}
                  to={action.to}
                  leftSection={<action.icon size={16} />}
                  variant={action.variant}
                  styles={
                    !action.variant
                      ? {
                          root: {
                            background: 'linear-gradient(145deg, #f3decb 0%, #d8ebe4 100%)',
                            color: 'var(--commune-forest)',
                            boxShadow: 'none',
                          },
                        }
                      : action.variant === 'light'
                        ? {
                            root: {
                              background: 'rgba(255, 255, 255, 0.08)',
                              color: '#fffaf6',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                            },
                          }
                        : undefined
                  }
                >
                  {action.label}
                </Button>
              ))}
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

      {/* F35: Budget tracking widget */}
      <Paper className="commune-soft-panel" p="lg">
        {currentBudget && budgetPct !== null ? (
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <div>
                <Text className="commune-section-heading">Monthly budget</Text>
                <Text size="sm" c="dimmed">
                  {formatCurrency(monthlyTrend.currentTotal, group?.currency)} spent of{' '}
                  {formatCurrency(currentBudget.budget_amount, group?.currency)} budget
                </Text>
              </div>
              <Group gap="xs">
                <Badge color={getBudgetColor(budgetPct)} variant="light">
                  {budgetPct}%
                </Badge>
                <Button size="xs" variant="subtle" onClick={() => setBudgetModalOpened(true)}>
                  Edit
                </Button>
              </Group>
            </Group>
            <Progress
              value={Math.min(budgetPct, 100)}
              size="lg"
              color={getBudgetColor(budgetPct)}
            />
            {budgetPct >= 100 && (
              <Text size="xs" c="red" fw={600}>
                Over budget by {formatCurrency(monthlyTrend.currentTotal - currentBudget.budget_amount, group?.currency)}
              </Text>
            )}
            {budgetPct >= (currentBudget.alert_threshold ?? 80) && budgetPct < 100 && (
              <Text size="xs" c="yellow.7" fw={500}>
                Approaching budget ({budgetPct}% of {currentBudget.alert_threshold ?? 80}% threshold)
              </Text>
            )}
            {categorySpend.length > 0 && (
              <Stack gap={6} mt="xs">
                <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                  Category breakdown
                </Text>
                {categorySpend.map((item) => {
                  const catThreshold = currentBudget.alert_threshold ?? 80;
                  return (
                  <Group key={item.category} gap="xs" wrap="nowrap">
                    <Text size="xs" fw={item.pct >= 100 ? 700 : 500} c={item.pct >= 100 ? 'red' : item.pct >= catThreshold ? 'yellow.7' : undefined} w={120} style={{ flexShrink: 0 }}>
                      {formatCategoryLabel(item.category)}
                    </Text>
                    <Progress
                      value={Math.min(item.pct, 100)}
                      size="sm"
                      color={getBudgetColor(item.pct)}
                      style={{ flex: 1 }}
                    />
                    <Text size="xs" c="dimmed" w={120} ta="right" style={{ flexShrink: 0 }}>
                      {formatCurrency(item.spent, group?.currency)} / {formatCurrency(item.budget, group?.currency)}
                    </Text>
                  </Group>
                  );
                })}
              </Stack>
            )}
          </Stack>
        ) : (
          <Group justify="space-between" align="center">
            <Stack gap={2}>
              <Text fw={600}>No budget set for {monthLabel}</Text>
              <Text size="sm" c="dimmed">
                Set a monthly spending target to track progress.
              </Text>
            </Stack>
            <Button
              variant="light"
              leftSection={<IconTargetArrow size={16} />}
              onClick={() => setBudgetModalOpened(true)}
            >
              Set budget
            </Button>
          </Group>
        )}
      </Paper>

      {/* F36: Onboarding tips (hidden once expenses exist) */}
      {onboardingTips.length > 0 && (
        <Paper className="commune-soft-panel" p="lg" style={{ borderLeft: '3px solid var(--mantine-color-commune-5)' }}>
          <Text fw={600} mb="sm">Getting started</Text>
          <Stack gap="xs">
            {onboardingTips.map((tip) => (
              <Group key={tip} gap="sm" wrap="nowrap">
                <ThemeIcon size={20} variant="light" color="commune" radius="xl">
                  <IconCheck size={12} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">{tip}</Text>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
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

              {hasTrendData ? (
                <div ref={overviewChartRef}>
                  {showOverviewChart ? (
                    <Suspense fallback={<DashboardOverviewChartFallback />}>
                      <DashboardTransactionOverviewChart
                        currency={group?.currency}
                        currentTotal={monthlyTrend.currentTotal}
                        items={monthlyTrend.items}
                        tickFill={tickFill}
                        gridStroke={gridStroke}
                      />
                    </Suspense>
                  ) : (
                    <DashboardOverviewChartFallback />
                  )}
                </div>
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
                        const unpaid = expense.unpaid_count;
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
                                {formatCategoryLabel(expense.category ?? 'uncategorized')}
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

              {hasCategoryData ? (
                <div ref={categoryChartRef}>
                  {showCategoryChart ? (
                    <Suspense fallback={<DashboardCategoryChartFallback />}>
                      <DashboardCategoryBreakdownChart
                        currency={group?.currency}
                        items={categoryBreakdown}
                      />
                    </Suspense>
                  ) : (
                    <DashboardCategoryChartFallback />
                  )}
                </div>
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

      {/* F35: Budget modal */}
      <SetBudgetModal
        opened={budgetModalOpened}
        onClose={() => setBudgetModalOpened(false)}
        groupId={resolvedActiveGroupId}
        currency={group?.currency}
        currentAmount={currentBudget?.budget_amount}
        currentCategoryBudgets={currentBudget?.category_budgets}
        currentAlertThreshold={currentBudget?.alert_threshold}
      />
    </Stack>
  );
}
