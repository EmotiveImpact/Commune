import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useThemeStore } from '@/stores/theme';
import { useGroup } from '@/hooks/use-groups';
import { useSubscription } from '@/hooks/use-subscriptions';
import { useAnalytics } from '@/hooks/use-analytics';
import { hapticMedium } from '@/lib/haptics';

const CATEGORY_COLORS = [
  '#84CC16', '#1a56db', '#C4620A', '#6D5DC7', '#0D9488',
  '#B9382F', '#55704B', '#8A593B', '#4F4660', '#667085',
];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ShimmerBlock({ width, height, style }: { width: number | string; height: number; style?: object }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  return (
    <Animated.View
      style={[{ width: width as number, height, borderRadius: 8, backgroundColor: '#E5E7EB', opacity }, style]}
    />
  );
}

function ContentSkeleton({ isDark }: { isDark: boolean }) {
  const bg = isDark ? '#0A0A0A' : '#FAFAFA';
  return (
    <View style={{ flex: 1, backgroundColor: bg, padding: 20 }}>
      <ShimmerBlock width="40%" height={28} style={{ alignSelf: 'center', marginBottom: 24 }} />
      <ShimmerBlock width="100%" height={140} style={{ marginBottom: 16, borderRadius: 24 }} />
      <ShimmerBlock width="100%" height={200} style={{ marginBottom: 16, borderRadius: 24 }} />
      <ShimmerBlock width="100%" height={160} style={{ marginBottom: 16, borderRadius: 24 }} />
    </View>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();
  const { mode } = useThemeStore();
  const isDark = mode === 'dark';
  const bgColor = isDark ? '#0A0A0A' : '#F9FAFB';
  const textPrimary = isDark ? '#FFFFFF' : '#111827';
  const textSecondary = isDark ? '#9CA3AF' : '#6B7280';
  const cardBg = isDark ? '#1A1A1A' : '#FFFFFF';
  const separatorColor = isDark ? '#1F2937' : '#F3F4F6';
  const pillBg = isDark ? '#1F2937' : '#F3F4F6';

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return MONTH_LABELS[now.getMonth()] ?? 'Jan';
  });

  const { data: group } = useGroup(activeGroupId ?? '');
  const { data: subscription, isLoading: subLoading } = useSubscription(user?.id ?? '');
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics(activeGroupId ?? '');

  // No active group
  if (!activeGroupId) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: bgColor }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
      >
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 24,
            padding: 20,
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
          }}
        >
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Ionicons name="bar-chart-outline" size={24} color={textSecondary} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: textPrimary }}>
              Select a group first
            </Text>
            <Text style={{ fontSize: 14, color: textSecondary, marginTop: 8, textAlign: 'center' }}>
              Choose a group to view analytics.
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  // Loading
  if (subLoading || analyticsLoading) {
    return <ContentSkeleton isDark={isDark} />;
  }

  const plan = subscription?.plan;
  const isProOrAgency = plan === 'pro' || plan === 'agency';

  // Upgrade gate
  if (!isProOrAgency) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: bgColor }}
        contentContainerStyle={{ padding: 20 }}
      >
        <Text style={{ fontSize: 28, fontWeight: '700', color: textPrimary, textAlign: 'center', marginBottom: 24 }}>
          Analytics
        </Text>

        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 24,
            padding: 20,
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
          }}
        >
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <View
              style={{
                marginBottom: 16,
                height: 64,
                width: 64,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 24,
                backgroundColor: isDark ? 'rgba(132,204,22,0.12)' : '#F7FEE7',
              }}
            >
              <Ionicons name="bar-chart-outline" size={28} color="#84CC16" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: textPrimary }}>
              Upgrade to Pro
            </Text>
            <Text
              style={{
                marginTop: 8,
                textAlign: 'center',
                fontSize: 14,
                lineHeight: 20,
                color: textSecondary,
                maxWidth: 280,
              }}
            >
              Advanced analytics is available on Pro and Agency plans. Get spending trends, category breakdowns, compliance tracking, and more.
            </Text>
            <TouchableOpacity
              onPress={() => { hapticMedium(); router.push('/pricing'); }}
              activeOpacity={0.8}
              style={{
                marginTop: 24,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#111827',
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 24,
                gap: 8,
              }}
            >
              <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>View plans</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  // No analytics data at all
  if (!analytics) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: bgColor }}
        contentContainerStyle={{ padding: 20 }}
      >
        <Text style={{ fontSize: 28, fontWeight: '700', color: textPrimary, textAlign: 'center', marginBottom: 24 }}>
          Analytics
        </Text>
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 24,
            padding: 20,
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
          }}
        >
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Ionicons name="bar-chart-outline" size={24} color={textSecondary} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: textPrimary }}>
              No analytics data yet
            </Text>
            <Text style={{ fontSize: 14, color: textSecondary, marginTop: 8, textAlign: 'center' }}>
              Once your group starts tracking expenses, insights will appear here.
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  const { spendingTrend, categoryBreakdown, topSpenders, complianceRate, monthComparison } = analytics;
  const hasData = spendingTrend.some((item) => item.amount > 0);

  // Has analytics object but no spending data
  if (!hasData) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: bgColor }}
        contentContainerStyle={{ padding: 20 }}
      >
        <Text style={{ fontSize: 28, fontWeight: '700', color: textPrimary, textAlign: 'center', marginBottom: 24 }}>
          Analytics
        </Text>
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 24,
            padding: 20,
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
          }}
        >
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: isDark ? '#1F2937' : '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Ionicons name="bar-chart-outline" size={24} color={textSecondary} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: textPrimary }}>
              No analytics data yet
            </Text>
            <Text style={{ fontSize: 14, color: textSecondary, marginTop: 8, textAlign: 'center' }}>
              Once your group starts tracking expenses, spending trends and insights will appear here.
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  const deltaPositive = monthComparison.delta >= 0;
  const totalCat = categoryBreakdown.reduce((s, c) => s + c.amount, 0);

  // Build daily spending data for mini bar chart (7 bars)
  const dailySpending = spendingTrend.length > 0
    ? spendingTrend.slice(-7).map((item) => item.amount)
    : [0, 0, 0, 0, 0, 0, 0];
  // Pad to 7 if fewer
  while (dailySpending.length < 7) {
    dailySpending.unshift(0);
  }
  const maxDaily = Math.max(...dailySpending, 1);

  // Spending trend for area chart (last 6 months)
  const last6 = spendingTrend.slice(-6);
  const maxTrendAmount = Math.max(...last6.map((m) => m.amount), 1);

  // Total spending (sum of trend)
  const totalSpending = spendingTrend.reduce((s, item) => s + item.amount, 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bgColor }}
      contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header - centered */}
      <Text
        style={{
          fontSize: 28,
          fontWeight: '700',
          color: textPrimary,
          textAlign: 'center',
          marginBottom: 24,
        }}
      >
        Analytics
      </Text>

      {/* ========== MY SPENDING CARD ========== */}
      <View
        style={{
          backgroundColor: cardBg,
          borderRadius: 24,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {/* Left side: label, amount, trend */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, color: textSecondary }}>My Spending</Text>
            <Text style={{ fontSize: 32, fontWeight: '700', color: textPrimary, marginTop: 4 }}>
              {formatCurrency(monthComparison.thisMonth, group?.currency)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: deltaPositive ? '#EF4444' : '#84CC16',
                }}
              >
                {deltaPositive ? '\u25B2' : '\u25BC'} {Math.abs(monthComparison.deltaPercent).toFixed(1)}%
              </Text>
              <Text style={{ fontSize: 13, color: textSecondary, marginLeft: 4 }}>
                From last week
              </Text>
            </View>
          </View>

          {/* Right side: mini bar chart */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              height: 48,
              gap: 4,
            }}
          >
            {dailySpending.map((amount, i) => {
              const barH = Math.max((amount / maxDaily) * 40, 4);
              const isActive = i === dailySpending.length - 1;
              return (
                <View
                  key={i}
                  style={{
                    width: 8,
                    height: barH,
                    borderRadius: 4,
                    backgroundColor: isActive ? '#84CC16' : '#D1FAE5',
                  }}
                />
              );
            })}
          </View>
        </View>
      </View>

      {/* ========== GROUP EXPENSE CARD ========== */}
      <View
        style={{
          backgroundColor: cardBg,
          borderRadius: 24,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
        }}
      >
        {/* Top row: label + month pill */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: textSecondary }}>Group Expense</Text>
          <TouchableOpacity
            activeOpacity={0.7}
            style={{
              backgroundColor: pillBg,
              borderRadius: 12,
              paddingVertical: 6,
              paddingHorizontal: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '500', color: textPrimary }}>{selectedMonth}</Text>
            <Ionicons name="chevron-down" size={14} color={textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Amount */}
        <Text style={{ fontSize: 32, fontWeight: '700', color: textPrimary, marginTop: 8 }}>
          -{formatCurrency(totalSpending, group?.currency)}
        </Text>

        {/* Simplified area chart representation */}
        <View style={{ marginTop: 20, height: 120, position: 'relative' }}>
          {/* Green gradient background area */}
          <View
            style={{
              position: 'absolute',
              bottom: 20,
              left: 0,
              right: 0,
              height: 80,
              borderRadius: 8,
              backgroundColor: 'rgba(209,250,229,0.3)',
            }}
          />

          {/* Area chart bars (simplified line representation) */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              height: 100,
              paddingHorizontal: 4,
            }}
          >
            {last6.map((item, idx) => {
              const pct = item.amount / maxTrendAmount;
              const barH = Math.max(pct * 80, 4);
              return (
                <View key={item.month} style={{ alignItems: 'center', flex: 1 }}>
                  {/* Gradient bar segment */}
                  <View
                    style={{
                      width: '80%',
                      height: barH,
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                      backgroundColor: 'rgba(209,250,229,0.5)',
                      borderTopWidth: 2,
                      borderTopColor: '#84CC16',
                    }}
                  />
                </View>
              );
            })}
          </View>

          {/* X-axis month labels */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingHorizontal: 4,
              marginTop: 4,
            }}
          >
            {last6.map((item) => {
              const monthLabel = new Date(`${item.month}-01`).toLocaleDateString('en-GB', { month: 'short' });
              return (
                <Text
                  key={item.month}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: 12,
                    color: textSecondary,
                  }}
                >
                  {monthLabel}
                </Text>
              );
            })}
          </View>
        </View>
      </View>

      {/* ========== CATEGORY BREAKDOWN CARD ========== */}
      <View
        style={{
          backgroundColor: cardBg,
          borderRadius: 24,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '600', color: textPrimary, marginBottom: 16 }}>
          Categories
        </Text>

        {categoryBreakdown.length === 0 ? (
          <Text style={{ fontSize: 14, color: textSecondary }}>
            No expenses this month yet.
          </Text>
        ) : (
          categoryBreakdown.map((cat, i) => {
            const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length]!;
            const label = cat.category
              .split('_')
              .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(' ');
            const isLast = i === categoryBreakdown.length - 1;

            return (
              <View
                key={cat.category}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  borderBottomWidth: isLast ? 0 : 1,
                  borderBottomColor: separatorColor,
                }}
              >
                {/* Colored dot */}
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: color,
                    marginRight: 12,
                  }}
                />
                {/* Category name */}
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: textPrimary }}>
                  {label}
                </Text>
                {/* Amount */}
                <Text style={{ fontSize: 16, fontWeight: '600', color: textPrimary }}>
                  {formatCurrency(cat.amount, group?.currency)}
                </Text>
              </View>
            );
          })
        )}
      </View>

      {/* ========== TOP SPENDERS CARD ========== */}
      {topSpenders.length > 0 && (
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 24,
            padding: 20,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: textPrimary, marginBottom: 16 }}>
            Top Spenders
          </Text>

          {topSpenders.map((spender, i) => {
            const initials = getInitials(spender.name);
            const isLast = i === topSpenders.length - 1;

            return (
              <View
                key={spender.name}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderBottomWidth: isLast ? 0 : 1,
                  borderBottomColor: separatorColor,
                }}
              >
                {/* Avatar */}
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: isDark ? '#374151' : '#1F2937',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>
                    {initials}
                  </Text>
                </View>
                {/* Name */}
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: textPrimary }}>
                  {spender.name}
                </Text>
                {/* Amount */}
                <Text style={{ fontSize: 16, fontWeight: '600', color: textPrimary }}>
                  {formatCurrency(spender.amount, group?.currency)}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ========== COMPLIANCE SUMMARY CARD ========== */}
      {complianceRate.total > 0 && (
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 24,
            padding: 20,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: textPrimary, marginBottom: 16 }}>
            Compliance
          </Text>

          {/* On time row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: separatorColor,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#84CC16',
                marginRight: 12,
              }}
            />
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: textPrimary }}>On Time</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: textPrimary }}>
              {complianceRate.onTime}
            </Text>
          </View>

          {/* Overdue row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: separatorColor,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#EF4444',
                marginRight: 12,
              }}
            />
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: textPrimary }}>Overdue</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: textPrimary }}>
              {complianceRate.overdue}
            </Text>
          </View>

          {/* Total row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 14,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: textSecondary,
                marginRight: 12,
              }}
            />
            <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: textPrimary }}>Total</Text>
            <Text style={{ fontSize: 16, fontWeight: '600', color: textPrimary }}>
              {complianceRate.total}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
