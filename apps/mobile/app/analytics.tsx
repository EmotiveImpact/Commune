import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useGroup } from '@/hooks/use-groups';
import { useSubscription } from '@/hooks/use-subscriptions';
import { useAnalytics } from '@/hooks/use-analytics';
import {
  AppButton,
  ContentSkeleton,
  EmptyState,
  HeroPanel,
  Screen,
  StatCard,
  Surface,
} from '@/components/ui';

export default function AnalyticsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const { data: subscription, isLoading: subLoading } = useSubscription(user?.id ?? '');
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics(activeGroupId ?? '');

  if (!activeGroupId) {
    return (
      <Screen>
        <EmptyState
          icon="bar-chart-outline"
          title="Select a group first"
          description="Choose a group to view analytics."
        />
      </Screen>
    );
  }

  if (subLoading || analyticsLoading) {
    return <ContentSkeleton />;
  }

  const plan = subscription?.plan;
  const isProOrAgency = plan === 'pro' || plan === 'agency';

  if (!isProOrAgency) {
    return (
      <Screen>
        <HeroPanel
          eyebrow="Insights"
          title="Analytics"
          description="Deep insights into your group spending patterns."
        />
        <Surface>
          <View className="items-center py-6">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl bg-[#EEF6F3]">
              <Ionicons name="bar-chart-outline" size={28} color="#2d6a4f" />
            </View>
            <Text className="text-xl font-bold text-[#171b24]">Upgrade to Pro</Text>
            <Text className="mt-2 text-center text-sm leading-5 text-[#667085]" style={{ maxWidth: 280 }}>
              Advanced analytics is available on Pro and Agency plans. Get spending trends, category breakdowns, compliance tracking, and more.
            </Text>
            <View className="mt-6 w-full">
              <AppButton
                label="View plans"
                icon="sparkles-outline"
                onPress={() => router.push('/pricing')}
              />
            </View>
          </View>
        </Surface>
      </Screen>
    );
  }

  if (!analytics) {
    return (
      <Screen>
        <HeroPanel
          eyebrow="Insights"
          title="Analytics"
          description="Deep insights into your group spending patterns."
        />
        <EmptyState
          icon="bar-chart-outline"
          title="No analytics data yet"
          description="Once your group starts tracking expenses, insights will appear here."
        />
      </Screen>
    );
  }

  const { spendingTrend, categoryBreakdown, topSpenders, complianceRate, monthComparison } = analytics;
  const compliancePct = complianceRate.total > 0
    ? Math.round((complianceRate.onTime / complianceRate.total) * 100)
    : 100;
  const deltaPositive = monthComparison.delta >= 0;
  const hasData = spendingTrend.some((item) => item.amount > 0);

  if (!hasData) {
    return (
      <Screen>
        <HeroPanel
          eyebrow="Insights"
          title="Analytics"
          description="Deep insights into your group spending patterns."
        />
        <EmptyState
          icon="bar-chart-outline"
          title="No analytics data yet"
          description="Once your group starts tracking expenses, spending trends and insights will appear here."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <HeroPanel
        eyebrow="Insights"
        title="Analytics"
        description="Deep insights into your group spending patterns."
        badgeLabel="Pro"
        contextLabel={group ? `${group.name} · ${group.currency}` : undefined}
      />

      {/* Month comparison */}
      <Surface className="mb-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-sm text-[#667085]">This month</Text>
            <Text className="mt-1 text-2xl font-bold text-[#171b24]">
              {formatCurrency(monthComparison.thisMonth, group?.currency)}
            </Text>
            <Text className="mt-1 text-sm text-[#667085]">
              vs {formatCurrency(monthComparison.lastMonth, group?.currency)} last month
            </Text>
          </View>
          <View className="items-end">
            <View
              className="h-10 w-10 items-center justify-center rounded-2xl"
              style={{ backgroundColor: deltaPositive ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)' }}
            >
              <Ionicons
                name={deltaPositive ? 'arrow-up' : 'arrow-down'}
                size={18}
                color={deltaPositive ? '#ef4444' : '#10b981'}
              />
            </View>
            <Text
              className="mt-1 text-sm font-semibold"
              style={{ color: deltaPositive ? '#ef4444' : '#10b981' }}
            >
              {deltaPositive ? '+' : ''}{monthComparison.deltaPercent.toFixed(1)}%
            </Text>
          </View>
        </View>
      </Surface>

      {/* Compliance */}
      <Surface className="mb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-sm text-[#667085]">Payment compliance</Text>
            <Text className="mt-1 text-2xl font-bold text-[#171b24]">{compliancePct}% on time</Text>
            <Text className="mt-1 text-sm text-[#667085]">
              {complianceRate.onTime} on time, {complianceRate.overdue} overdue of {complianceRate.total}
            </Text>
          </View>
          <View className="h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF6F3]">
            <Ionicons name="checkmark-circle-outline" size={18} color="#2d6a4f" />
          </View>
        </View>
        <View className="mt-4 h-3 rounded-full bg-[#d7e6dd]">
          <View
            className="h-3 rounded-full bg-[#2d6a4f]"
            style={{ width: `${Math.min(Math.max(compliancePct, 0), 100)}%` }}
          />
        </View>
      </Surface>

      {/* Spending trend (last 6 months as stat bars) */}
      <Surface className="mb-4">
        <Text className="text-lg font-semibold text-[#171b24]">Spending trend</Text>
        <Text className="mt-1 text-sm text-[#667085]">Monthly totals over the last 6 months.</Text>
        <View className="mt-4">
          {(() => {
            const maxAmount = Math.max(...spendingTrend.map((m) => m.amount), 1);
            return spendingTrend.map((item) => {
              const pct = Math.round((item.amount / maxAmount) * 100);
              const monthLabel = new Date(`${item.month}-01`).toLocaleDateString('en-GB', { month: 'short' });
              return (
                <View key={item.month} className="mb-3 flex-row items-center">
                  <Text className="w-10 text-xs font-medium text-[#667085]">{monthLabel}</Text>
                  <View className="mx-2 h-6 flex-1 rounded-full bg-[#e8e1ef]">
                    <View
                      className="h-6 items-end justify-center rounded-full bg-[#2d6a4f] px-2"
                      style={{ width: `${Math.max(pct, 5)}%` }}
                    >
                      {pct > 20 && (
                        <Text className="text-[10px] font-semibold text-white">
                          {formatCurrency(item.amount, group?.currency)}
                        </Text>
                      )}
                    </View>
                  </View>
                  {pct <= 20 && (
                    <Text className="ml-1 text-[10px] text-[#667085]">
                      {formatCurrency(item.amount, group?.currency)}
                    </Text>
                  )}
                </View>
              );
            });
          })()}
        </View>
      </Surface>

      {/* Category breakdown */}
      <Surface className="mb-4">
        <Text className="text-lg font-semibold text-[#171b24]">Category breakdown</Text>
        <Text className="mt-1 text-sm text-[#667085]">Where the money is going this month.</Text>
        {categoryBreakdown.length === 0 ? (
          <Text className="mt-4 text-sm text-[#667085]">No expenses this month yet.</Text>
        ) : (
          <View className="mt-4">
            {categoryBreakdown.map((cat, i) => {
              const colors = ['#2d6a4f', '#1b4332', '#62C38A', '#B8DA7D', '#74D43B', '#96E85F'];
              const color = colors[i % colors.length]!;
              const totalCat = categoryBreakdown.reduce((s, c) => s + c.amount, 0);
              const pct = totalCat > 0 ? Math.round((cat.amount / totalCat) * 100) : 0;
              const label = cat.category
                .split('_')
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                .join(' ');

              return (
                <View key={cat.category} className="mb-3 flex-row items-center">
                  <View className="mr-3 h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-medium text-[#171b24]">{label}</Text>
                      <Text className="text-sm font-semibold text-[#171b24]">
                        {formatCurrency(cat.amount, group?.currency)}
                      </Text>
                    </View>
                    <View className="mt-1 h-2 rounded-full bg-[#F1ECE4]">
                      <View
                        className="h-2 rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Surface>

      {/* Top spenders */}
      <Surface className="mb-4">
        <Text className="text-lg font-semibold text-[#171b24]">Top spenders</Text>
        <Text className="mt-1 text-sm text-[#667085]">Members with the highest expense volume.</Text>
        {topSpenders.length === 0 ? (
          <Text className="mt-4 text-sm text-[#667085]">No spender data yet.</Text>
        ) : (
          <View className="mt-4">
            {topSpenders.map((spender, i) => {
              const maxSpend = Math.max(...topSpenders.map((s) => s.amount), 1);
              const pct = Math.round((spender.amount / maxSpend) * 100);
              return (
                <View key={spender.name} className="mb-3">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <Text className="mr-2 text-sm font-bold text-[#667085]">{i + 1}</Text>
                      <Text className="text-sm font-medium text-[#171b24]">{spender.name}</Text>
                    </View>
                    <Text className="text-sm font-semibold text-[#171b24]">
                      {formatCurrency(spender.amount, group?.currency)}
                    </Text>
                  </View>
                  <View className="mt-1 h-2 rounded-full bg-[#e8e1ef]">
                    <View
                      className="h-2 rounded-full bg-[#1b4332]"
                      style={{ width: `${pct}%` }}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Surface>

      {/* KPI stat cards */}
      <View className="mb-1 flex-row flex-wrap justify-between">
        <View style={{ width: '48.5%' }}>
          <StatCard
            icon="trending-up-outline"
            label="This month"
            value={formatCurrency(monthComparison.thisMonth, group?.currency)}
            note="Total spend"
            tone="emerald"
          />
        </View>
        <View style={{ width: '48.5%' }}>
          <StatCard
            icon="trending-down-outline"
            label="Last month"
            value={formatCurrency(monthComparison.lastMonth, group?.currency)}
            note="Previous period"
            tone="forest"
          />
        </View>
        <View style={{ width: '48.5%' }}>
          <StatCard
            icon="checkmark-done-outline"
            label="On time"
            value={String(complianceRate.onTime)}
            note="Payments on schedule"
            tone="sky"
          />
        </View>
        <View style={{ width: '48.5%' }}>
          <StatCard
            icon="alert-circle-outline"
            label="Overdue"
            value={String(complianceRate.overdue)}
            note="Late payments"
            tone="sand"
          />
        </View>
      </View>
    </Screen>
  );
}
