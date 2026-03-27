import { createLazyFileRoute, Link } from '@tanstack/react-router';
import {
  Badge,
  Button,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  useComputedColorScheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconChartBar,
  IconClockCheck,
  IconDownload,
  IconReceipt,
  IconSparkles,
} from '@tabler/icons-react';
import { Suspense, lazy, useEffect, useState } from 'react';
import {
  getWorkspaceBillingExportRows,
  type WorkspaceBillingPackData,
} from '@commune/api';
import { formatCurrency, formatDate } from '@commune/utils';
import { setPageTitle } from '../../utils/seo';
import { useGroupStore } from '../../stores/group';
import { useAuthStore } from '../../stores/auth';
import { useGroupSummary } from '../../hooks/use-groups';
import { useSubscription } from '../../hooks/use-subscriptions';
import { usePlanLimits } from '../../hooks/use-plan-limits';
import { useAnalytics } from '../../hooks/use-analytics';
import { getWorkspaceBillingSummary } from '../../hooks/use-dashboard';
import { useWorkspaceBilling } from '../../hooks/use-workspace-billing';
import { useDeferredSection } from '../../hooks/use-deferred-section';
import { PageHeader } from '../../components/page-header';

export const Route = createLazyFileRoute('/_app/analytics')({
  component: AnalyticsPage,
});

const AnalyticsSpendingTrendChart = lazy(() =>
  import('../../components/analytics-charts').then((module) => ({
    default: module.AnalyticsSpendingTrendChart,
  })),
);

const AnalyticsCategoryBreakdownChart = lazy(() =>
  import('../../components/analytics-charts').then((module) => ({
    default: module.AnalyticsCategoryBreakdownChart,
  })),
);

const AnalyticsTopSpendersChart = lazy(() =>
  import('../../components/analytics-charts').then((module) => ({
    default: module.AnalyticsTopSpendersChart,
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

function formatMonthLabel(monthKey: string) {
  return new Date(`${monthKey}-01`).toLocaleDateString('en-GB', { month: 'short' });
}

function AnalyticsSkeleton() {
  return (
    <Stack gap="lg">
      <Skeleton height={48} radius={12} />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        <Skeleton height={140} radius={14} />
        <Skeleton height={140} radius={14} />
      </SimpleGrid>
      <Skeleton height={300} radius={14} />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Skeleton height={320} radius={14} />
        <Skeleton height={320} radius={14} />
      </SimpleGrid>
    </Stack>
  );
}

function ChartFallback({ height = 280 }: { height?: number }) {
  return <Skeleton height={height} radius={14} />;
}

function UpgradeCTA() {
  return (
    <Stack gap="xl">
      <PageHeader
        title="Analytics"
        subtitle="Deep insights into your group spending patterns."
      />
      <Paper className="commune-soft-panel" p="xl">
        <Stack align="center" gap="lg" py="xl">
          <ThemeIcon size={64} variant="light" color="commune" radius="xl">
            <IconChartBar size={32} />
          </ThemeIcon>
          <Stack align="center" gap="xs">
            <Text fw={800} size="1.5rem" ta="center">
              Upgrade to Pro
            </Text>
            <Text size="md" c="dimmed" ta="center" maw={480}>
              Advanced analytics is available on the Pro and Agency plans.
              Get detailed spending trends, category breakdowns, compliance
              tracking, and more.
            </Text>
          </Stack>
          <Button component={Link} to="/pricing" size="lg" leftSection={<IconSparkles size={18} />}>
            View plans
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}

export function AnalyticsPage() {
  useEffect(() => {
    setPageTitle('Analytics');
  }, []);

  const { activeGroupId } = useGroupStore();
  const { user } = useAuthStore();
  const { isLoading: subLoading, isError: subError, fetchStatus: subFetchStatus } = useSubscription(user?.id ?? '');
  const { canAccessAnalytics, isLoading: planLoading } = usePlanLimits(user?.id ?? '');
  const { data: group } = useGroupSummary(activeGroupId ?? '');
  const { data: analytics, isLoading: analyticsLoading, isError: analyticsError, fetchStatus: analyticsFetchStatus } = useAnalytics(activeGroupId ?? '');
  const workspaceBillingGroupId = group?.type === 'workspace' ? activeGroupId ?? '' : '';
  const { data: workspaceBilling } = useWorkspaceBilling(workspaceBillingGroupId);
  const colorScheme = useComputedColorScheme('light');
  const [exportingWorkspacePack, setExportingWorkspacePack] = useState(false);
  const spendingTrend = analytics?.spendingTrend ?? [];
  const categoryBreakdown = analytics?.categoryBreakdown ?? [];
  const topSpenders = analytics?.topSpenders ?? [];
  const complianceRate = analytics?.complianceRate ?? {
    total: 0,
    onTime: 0,
    overdue: 0,
  };
  const monthComparison = analytics?.monthComparison ?? {
    thisMonth: 0,
    lastMonth: 0,
    delta: 0,
    deltaPercent: 0,
  };
  const trendData = spendingTrend.map((item) => ({
    ...item,
    label: formatMonthLabel(item.month),
  }));
  const pieData = categoryBreakdown.map((item, i) => ({
    ...item,
    label: formatCategoryLabel(item.category),
    color: categoryPalette[i % categoryPalette.length]!,
  }));
  const workspaceBillingSummary = getWorkspaceBillingSummary(workspaceBilling?.snapshot ?? null);
  const showWorkspaceBillingWatch = group?.type === 'workspace' && workspaceBillingSummary.expenseCount > 0;
  const tickFill = colorScheme === 'dark' ? '#909296' : '#667085';
  const gridStroke = colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(22,19,29,0.06)';
  const hasData = spendingTrend.some((item) => item.amount > 0);
  const {
    ref: trendChartRef,
    ready: showTrendChart,
  } = useDeferredSection({
    enabled: hasData,
  });
  const {
    ref: categoryChartRef,
    ready: showCategoryChart,
  } = useDeferredSection({
    enabled: pieData.length > 0,
  });
  const {
    ref: topSpendersChartRef,
    ready: showTopSpendersChart,
  } = useDeferredSection({
    enabled: topSpenders.length > 0,
  });

  if (!activeGroupId) {
    return (
      <Stack gap="xl">
        <PageHeader
          title="Analytics"
          subtitle="Deep insights into your group spending patterns."
        />
        <Paper className="commune-soft-panel" p="xl">
          <Stack align="center" gap="md" py="xl">
            <ThemeIcon size={48} variant="light" color="gray" radius="xl">
              <IconChartBar size={24} />
            </ThemeIcon>
            <Text fw={700} size="lg">Select a group first</Text>
            <Text size="sm" c="dimmed" ta="center" maw={400}>
              Choose a group in the sidebar to view analytics.
            </Text>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  // When enabled is false (no user id yet), fetchStatus is 'idle' — treat that as
  // "not loading" so the page doesn't stay stuck on skeleton forever.
  const subActuallyLoading = (subLoading && subFetchStatus !== 'idle') || planLoading;
  if (subActuallyLoading) return <AnalyticsSkeleton />;

  if (subError) {
    return (
      <Stack gap="xl">
        <PageHeader
          title="Analytics"
          subtitle="Deep insights into your group spending patterns."
        />
        <Paper className="commune-soft-panel" p="xl">
          <Stack align="center" gap="md" py="xl">
            <ThemeIcon size={48} variant="light" color="red" radius="xl">
              <IconChartBar size={24} />
            </ThemeIcon>
            <Text fw={700} size="lg">Failed to load subscription</Text>
            <Text size="sm" c="dimmed" ta="center" maw={400}>
              We couldn&apos;t verify your subscription status. Please try refreshing the page.
            </Text>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  if (!canAccessAnalytics) return <UpgradeCTA />;

  const analyticsActuallyLoading = analyticsLoading && analyticsFetchStatus !== 'idle';
  if (analyticsActuallyLoading) return <AnalyticsSkeleton />;

  if (analyticsError || !analytics) {
    return (
      <Stack gap="xl">
        <PageHeader
          title="Analytics"
          subtitle="Deep insights into your group spending patterns."
        />
        <Paper className="commune-soft-panel" p="xl">
          <Stack align="center" gap="md" py="xl">
            <ThemeIcon size={48} variant="light" color="red" radius="xl">
              <IconChartBar size={24} />
            </ThemeIcon>
            <Text fw={700} size="lg">Failed to load analytics</Text>
            <Text size="sm" c="dimmed" ta="center" maw={400}>
              Something went wrong while fetching your analytics data. Please try
              refreshing the page.
            </Text>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  const compliancePct = complianceRate.total > 0
    ? Math.round((complianceRate.onTime / complianceRate.total) * 100)
    : 100;

  const deltaPositive = monthComparison.delta >= 0;
  const DeltaIcon = deltaPositive ? IconArrowUpRight : IconArrowDownRight;

  async function handleExportWorkspacePack() {
    if (!showWorkspaceBillingWatch || !workspaceBilling || !activeGroupId) return;

    setExportingWorkspacePack(true);
    try {
      const exportRows = await getWorkspaceBillingExportRows(activeGroupId);
      const { downloadWorkspaceBillingPack } = await import('../../utils/export-csv');
      const pack: WorkspaceBillingPackData = {
        ...workspaceBilling,
        export_rows: exportRows,
      };
      await downloadWorkspaceBillingPack(
        pack,
        group?.currency ?? 'GBP',
      );
      notifications.show({
        title: 'Billing pack exported',
        message: 'Workspace summary, ledger, vendor, and trend files were downloaded.',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Export failed',
        message: error instanceof Error ? error.message : 'Failed to build the billing pack.',
        color: 'red',
      });
    } finally {
      setExportingWorkspacePack(false);
    }
  }

  if (!hasData) {
    return (
      <Stack gap="xl">
        <PageHeader
          title="Analytics"
          subtitle="Deep insights into your group spending patterns."
        />
        <Paper className="commune-soft-panel" p="xl">
          <Stack align="center" gap="md" py="xl">
            <ThemeIcon size={48} variant="light" color="gray" radius="xl">
              <IconChartBar size={24} />
            </ThemeIcon>
            <Text fw={700} size="lg">No analytics data yet</Text>
            <Text size="sm" c="dimmed" ta="center" maw={400}>
              Once your group starts tracking expenses, spending trends and
              insights will appear here automatically.
            </Text>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      <PageHeader
        title="Analytics"
        subtitle="Deep insights into your group spending patterns."
      />

      {/* Row 1: Stat cards */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        <Paper className="commune-soft-panel commune-kpi-card" p="xl" data-tone="sage">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text size="sm" c="dimmed">This month</Text>
              <Text fw={800} size="2rem" lh={1.05}>
                {formatCurrency(monthComparison.thisMonth, group?.currency)}
              </Text>
              <Text size="sm" c="dimmed">
                vs {formatCurrency(monthComparison.lastMonth, group?.currency)} last month
              </Text>
            </Stack>
            <Stack align="flex-end" gap={4}>
              <ThemeIcon
                size={42}
                variant="light"
                color={deltaPositive ? 'red' : 'green'}
                style={{
                  backgroundColor: deltaPositive
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'rgba(16, 185, 129, 0.1)',
                }}
              >
                <DeltaIcon size={20} />
              </ThemeIcon>
              <Badge
                variant="light"
                color={deltaPositive ? 'red' : 'green'}
              >
                {deltaPositive ? '+' : ''}{monthComparison.deltaPercent.toFixed(1)}%
              </Badge>
            </Stack>
          </Group>
        </Paper>

        <Paper className="commune-soft-panel commune-kpi-card" p="xl" data-tone="lilac">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text size="sm" c="dimmed">Payment compliance</Text>
              <Text fw={800} size="2rem" lh={1.05}>
                {compliancePct}% on time
              </Text>
              <Text size="sm" c="dimmed">
                {complianceRate.onTime} on time, {complianceRate.overdue} overdue of {complianceRate.total}
              </Text>
            </Stack>
            <ThemeIcon
              size={42}
              variant="light"
              color="emerald"
              style={{ backgroundColor: 'var(--commune-icon-bg-primary)' }}
            >
              <IconClockCheck size={20} />
            </ThemeIcon>
          </Group>
          <Progress value={compliancePct} size="lg" color="commune" mt="md" />
        </Paper>
      </SimpleGrid>

      {showWorkspaceBillingWatch && (
        <Paper className="commune-soft-panel" p="xl">
          <Group justify="space-between" align="flex-start" mb="md">
            <div>
              <Text className="commune-section-heading">Shared subscriptions &amp; tools</Text>
              <Text size="sm" c="dimmed">
                Invoice cadence, recurring subscriptions, tool spend, and bills due next.
              </Text>
            </div>
            <Group gap="xs">
              <Button
                variant="default"
                size="xs"
                leftSection={<IconDownload size={14} />}
                onClick={handleExportWorkspacePack}
                loading={exportingWorkspacePack}
              >
                Export billing pack
              </Button>
              <Badge className="commune-pill-badge" variant="light" color="indigo">
                {workspaceBillingSummary.vendorCount} vendors
              </Badge>
              {workspaceBillingSummary.sharedSubscriptionCount > 0 && (
                <Badge className="commune-pill-badge" variant="light" color="violet">
                  {workspaceBillingSummary.sharedSubscriptionCount} subscriptions
                </Badge>
              )}
              <Badge className="commune-pill-badge" variant="light" color="teal">
                {workspaceBillingSummary.toolCostCount} work tools
              </Badge>
            </Group>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Paper className="commune-stat-card" p="md" radius="lg">
              <Text size="xs" c="dimmed">Tracked bills</Text>
              <Text fw={700} size="lg">
                {workspaceBillingSummary.expenseCount}
              </Text>
            </Paper>
            <Paper className="commune-stat-card" p="md" radius="lg">
              <Text size="xs" c="dimmed">Work tools spend</Text>
              <Text fw={700} size="lg">
                {formatCurrency(workspaceBillingSummary.toolCostSpend, group?.currency)}
              </Text>
            </Paper>
            <Paper className="commune-stat-card" p="md" radius="lg">
              <Text size="xs" c="dimmed">Due soon</Text>
              <Text fw={700} size="lg">
                {workspaceBillingSummary.dueSoonCount}
              </Text>
            </Paper>
            <Paper className="commune-stat-card" p="md" radius="lg">
              <Text size="xs" c="dimmed">Overdue</Text>
              <Text fw={700} size="lg" c={workspaceBillingSummary.overdueCount > 0 ? 'red' : undefined}>
                {workspaceBillingSummary.overdueCount}
              </Text>
            </Paper>
            <Paper className="commune-stat-card" p="md" radius="lg">
              <Text size="xs" c="dimmed">Top vendor</Text>
              <Text fw={700} size="sm">
                {workspaceBillingSummary.topVendor?.vendor_name || 'No vendor named yet'}
              </Text>
              {workspaceBillingSummary.topVendor ? (
                <Text size="xs" c="dimmed">
                  {workspaceBillingSummary.topVendor.count} bill{workspaceBillingSummary.topVendor.count !== 1 ? 's' : ''} · {formatCurrency(workspaceBillingSummary.topVendor.amount, group?.currency)}
                </Text>
              ) : null}
            </Paper>
            <Paper className="commune-stat-card" p="md" radius="lg">
              <Text size="xs" c="dimmed">Tracked spend</Text>
              <Text fw={700} size="lg">
                {formatCurrency(workspaceBillingSummary.totalSpend, group?.currency)}
              </Text>
            </Paper>
          </SimpleGrid>

          <Stack gap="sm" mt="lg">
            {workspaceBillingSummary.nextDueBill && (
              <Paper className="commune-stat-card" p="md" radius="lg">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={2}>
                    <Group gap="xs" wrap="nowrap">
                      <Text fw={700}>{workspaceBillingSummary.nextDueBill.vendor_name || workspaceBillingSummary.nextDueBill.title}</Text>
                      {workspaceBillingSummary.nextDueBill.recurrence_type && workspaceBillingSummary.nextDueBill.recurrence_type !== 'none' && (
                        <Badge size="xs" variant="light" color="violet">
                          Subscription
                        </Badge>
                      )}
                      {workspaceBillingSummary.nextDueBill.category === 'work_tools' && (
                        <Badge size="xs" variant="light" color="teal">
                          Tool cost
                        </Badge>
                      )}
                    </Group>
                    <Text size="sm" c="dimmed">
                      {workspaceBillingSummary.nextDueBill.invoice_reference
                        ? `Ref ${workspaceBillingSummary.nextDueBill.invoice_reference}`
                        : 'No reference yet'}
                    </Text>
                  </Stack>
                  <Stack gap={2} align="flex-end">
                    <Text fw={700}>
                      {formatCurrency(workspaceBillingSummary.nextDueBill.amount, workspaceBillingSummary.nextDueBill.currency)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Due {formatDate(workspaceBillingSummary.nextDueBill.payment_due_date || workspaceBillingSummary.nextDueBill.due_date)}
                    </Text>
                  </Stack>
                </Group>
              </Paper>
            )}

            {workspaceBillingSummary.latestBill && (
              <Paper className="commune-stat-card" p="md" radius="lg">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={2}>
                    <Group gap="xs">
                      <ThemeIcon size={20} variant="light" color="indigo" radius="xl">
                        <IconReceipt size={12} />
                      </ThemeIcon>
                      <Text fw={700}>Latest invoice</Text>
                      {workspaceBillingSummary.latestBill.recurrence_type && workspaceBillingSummary.latestBill.recurrence_type !== 'none' && (
                        <Badge size="xs" variant="light" color="violet">
                          Subscription
                        </Badge>
                      )}
                      {workspaceBillingSummary.latestBill.category === 'work_tools' && (
                        <Badge size="xs" variant="light" color="teal">
                          Tool cost
                        </Badge>
                      )}
                    </Group>
                    <Text size="sm" c="dimmed">
                      {workspaceBillingSummary.latestBill.vendor_name || workspaceBillingSummary.latestBill.title}
                    </Text>
                  </Stack>
                  <Stack gap={2} align="flex-end">
                    <Text fw={700}>
                      {workspaceBillingSummary.latestBill.invoice_reference || 'No reference'}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {workspaceBillingSummary.latestBill.invoice_date
                        ? `Issued ${formatDate(workspaceBillingSummary.latestBill.invoice_date)}`
                        : `Due ${formatDate(workspaceBillingSummary.latestBill.due_date)}`}
                    </Text>
                  </Stack>
                </Group>
              </Paper>
            )}
          </Stack>
        </Paper>
      )}

      {/* Row 2: Spending trend line chart */}
      <Paper className="commune-soft-panel" p="xl">
        <Group justify="space-between" align="flex-start" mb="md">
          <div>
            <Text className="commune-section-heading">Spending trend</Text>
            <Text size="sm" c="dimmed">Monthly totals across the last six months.</Text>
          </div>
          <Badge className="commune-pill-badge" variant="light" color="gray">
            Last 6 months
          </Badge>
        </Group>

        <div ref={trendChartRef}>
          {showTrendChart ? (
            <Suspense fallback={<ChartFallback />}>
              <AnalyticsSpendingTrendChart
                currency={group?.currency}
                data={trendData}
                tickFill={tickFill}
                gridStroke={gridStroke}
              />
            </Suspense>
          ) : (
            <ChartFallback />
          )}
        </div>
      </Paper>

      {/* Row 3: Category pie + Top spenders bar */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Paper className="commune-soft-panel" p="xl">
          <Group justify="space-between" align="flex-start" mb="md">
            <div>
              <Text className="commune-section-heading">Category breakdown</Text>
              <Text size="sm" c="dimmed">Where the money is going this month.</Text>
            </div>
            <Badge className="commune-pill-badge" variant="light" color="gray">
              This month
            </Badge>
          </Group>

          {pieData.length > 0 ? (
            <div ref={categoryChartRef}>
              {showCategoryChart ? (
                <Suspense fallback={<ChartFallback height={320} />}>
                  <AnalyticsCategoryBreakdownChart
                    currency={group?.currency}
                    data={pieData}
                  />
                </Suspense>
              ) : (
                <ChartFallback height={320} />
              )}
            </div>
          ) : (
            <Paper className="commune-stat-card" p="lg" radius="lg">
              <Text fw={600}>No category data yet.</Text>
              <Text size="sm" c="dimmed">
                Once expenses are added this month, category data will appear here.
              </Text>
            </Paper>
          )}
        </Paper>

        <Paper className="commune-soft-panel" p="xl">
          <Group justify="space-between" align="flex-start" mb="md">
            <div>
              <Text className="commune-section-heading">Top spenders</Text>
              <Text size="sm" c="dimmed">Members with the highest expense volume.</Text>
            </div>
            <Badge className="commune-pill-badge" variant="light" color="gray">
              Last 6 months
            </Badge>
          </Group>

          {topSpenders.length > 0 ? (
            <div ref={topSpendersChartRef}>
              {showTopSpendersChart ? (
                <Suspense fallback={<ChartFallback />}>
                  <AnalyticsTopSpendersChart
                    currency={group?.currency}
                    data={topSpenders}
                    tickFill={tickFill}
                    gridStroke={gridStroke}
                  />
                </Suspense>
              ) : (
                <ChartFallback />
              )}
            </div>
          ) : (
            <Paper className="commune-stat-card" p="lg" radius="lg">
              <Text fw={600}>No spender data yet.</Text>
              <Text size="sm" c="dimmed">
                Top spenders will show here once expenses are tracked.
              </Text>
            </Paper>
          )}
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}
