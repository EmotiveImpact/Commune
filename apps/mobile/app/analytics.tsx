import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { IconChevronDown, IconChevronLeft } from '@tabler/icons-react-native';
import { formatCurrency } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useGroup } from '@/hooks/use-groups';
import { useSubscription } from '@/hooks/use-subscriptions';
import { useAnalytics } from '@/hooks/use-analytics';
import { useGroupExpenses } from '@/hooks/use-expenses';
import { hapticMedium } from '@/lib/haptics';
import { formatCategoryLabel } from '@/lib/ui';
import { CategoryBreakdownCard, type CategoryItem } from '@/components/category-breakdown';
import { EmptyState, IconTile, Screen } from '@/components/primitives';
import { colors, getCategoryMeta, radius, space } from '@/constants/design';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthKeyToAbbr(key: string): string {
  // key format: YYYY-MM
  const [, mm] = key.split('-');
  const idx = Number(mm) - 1;
  return MONTH_ABBR[idx] ?? key;
}

function currentMonthLabel(): string {
  return MONTH_ABBR[new Date().getMonth()] ?? 'This month';
}

function formatDayMonth(isoDate: string): string {
  // isoDate: YYYY-MM-DD
  const [, mm, dd] = isoDate.split('-');
  const idx = Number(mm) - 1;
  const abbr = MONTH_ABBR[idx] ?? '';
  const day = Number(dd);
  return Number.isFinite(day) && abbr ? `${day} ${abbr}` : isoDate;
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();

  const { data: group } = useGroup(activeGroupId ?? '');
  const { data: subscription, isLoading: subLoading } = useSubscription(user?.id ?? '');
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics(activeGroupId ?? '');
  const { data: expensesList } = useGroupExpenses(activeGroupId ?? '');

  const currency = group?.currency ?? 'GBP';
  const monthLabel = currentMonthLabel();

  // --- Derivations (hooks must run every render; compute upfront) ---
  const categoryBreakdown = analytics?.categoryBreakdown ?? [];
  const spendingTrend = analytics?.spendingTrend ?? [];
  const monthComparison = analytics?.monthComparison;

  const totalThisMonth = useMemo(
    () => categoryBreakdown.reduce((sum, c) => sum + c.amount, 0),
    [categoryBreakdown],
  );

  const prevMonthAbbr = useMemo(() => {
    const idx = new Date().getMonth();
    return MONTH_ABBR[(idx + 11) % 12] ?? '';
  }, []);

  // Biggest expense: prefer actual expense from list (current month), fallback to largest category
  const biggestExpense = useMemo(() => {
    const ym = new Date().toISOString().slice(0, 7);
    const monthExpenses = (expensesList ?? []).filter((e) => (e.due_date ?? '').startsWith(ym));
    const candidates = monthExpenses.length > 0 ? monthExpenses : (expensesList ?? []);
    let best: { title: string; amount: number; due_date?: string; category?: string } | null = null;
    for (const e of candidates) {
      const amt = Number(e.amount ?? 0);
      if (!best || amt > best.amount) {
        best = {
          title: String(e.title ?? 'Expense'),
          amount: amt,
          due_date: e.due_date ?? undefined,
          category: e.category ?? undefined,
        };
      }
    }
    if (best && best.amount > 0) return best;
    const topCat = categoryBreakdown[0];
    if (topCat && topCat.amount > 0) {
      return {
        title: formatCategoryLabel(topCat.category),
        amount: topCat.amount,
        due_date: undefined,
        category: topCat.category,
      };
    }
    return null;
  }, [expensesList, categoryBreakdown]);

  // --- No group selected ---
  if (!activeGroupId) {
    return (
      <Screen>
        <Header monthLabel={monthLabel} onBack={() => router.back()} />
        <EmptyState
          icon="bar-chart-outline"
          title="Select a group first"
          description="Choose a group to view analytics."
        />
      </Screen>
    );
  }

  // --- Loading ---
  if (subLoading || analyticsLoading) {
    return (
      <Screen>
        <Header monthLabel={monthLabel} onBack={() => router.back()} />
        <View style={{ padding: space.gutter, gap: space.base }}>
          <View style={[s.skeleton, { height: 220 }]} />
          <View style={{ flexDirection: 'row', gap: space.base }}>
            <View style={[s.skeleton, { flex: 1, height: 96 }]} />
            <View style={[s.skeleton, { flex: 1, height: 96 }]} />
          </View>
          <View style={[s.skeleton, { height: 180 }]} />
        </View>
      </Screen>
    );
  }

  const plan = subscription?.plan;
  const isProOrAgency = plan === 'pro' || plan === 'agency';

  // --- Paywall (Pro / Agency gate preserved) ---
  if (!isProOrAgency) {
    return (
      <Screen>
        <Header monthLabel={monthLabel} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.scrollContent}>
          <View style={s.card}>
            <View style={s.paywallIconWrap}>
              <IconTile icon="sparkles-outline" color={colors.sage} bg={colors.sageSoft} size={56} />
            </View>
            <Text style={s.paywallTitle}>Upgrade to Pro</Text>
            <Text style={s.paywallBody}>
              Advanced analytics is available on Pro and Agency plans. Get spending trends,
              category breakdowns, compliance tracking, and more.
            </Text>
            <TouchableOpacity
              onPress={() => {
                hapticMedium();
                router.push('/pricing');
              }}
              activeOpacity={0.85}
              style={s.paywallCta}
            >
              <Text style={s.paywallCtaLabel}>View plans</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  const donutItems: CategoryItem[] = categoryBreakdown.map((c) => ({
    category: c.category,
    amount: c.amount,
    pct: totalThisMonth > 0 ? Math.round((c.amount / totalThisMonth) * 100) : 0,
  }));
  const hasData = totalThisMonth > 0;

  // MoM delta (fallback 0)
  const deltaPercent = monthComparison?.deltaPercent ?? 0;
  const deltaPositive = deltaPercent >= 0;

  // 6-month bar chart
  const last6 = spendingTrend.slice(-6);
  const bars6 = last6.length > 0 ? last6 : Array.from({ length: 6 }, (_, i) => ({
    month: `0000-0${i + 1}`.slice(-7),
    amount: 0,
  }));
  const maxBar = Math.max(...bars6.map((b) => b.amount), 1);
  const trendTotal = bars6.reduce((sum, b) => sum + b.amount, 0);

  // Top 3 categories
  const topCategories = donutItems.slice(0, 3);

  return (
    <Screen>
      <Header monthLabel={monthLabel} onBack={() => router.back()} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Donut first */}
        <CategoryBreakdownCard
          items={hasData ? donutItems : []}
          currency={currency}
          scopeLabel={monthLabel}
        />

        {hasData && (
          <>
            {/* 2-column stats grid */}
            <View style={s.statsRow}>
              <View style={s.statCard}>
                <Text style={s.statLabel}>{`Total \u00B7 ${monthLabel}`}</Text>
                <Text style={s.statValue} numberOfLines={1}>
                  {formatCurrency(totalThisMonth, currency)}
                </Text>
                <Text
                  style={[
                    s.statSub,
                    { color: deltaPositive ? colors.warnText : colors.sageInk },
                  ]}
                >
                  {`${deltaPositive ? '\u2191' : '\u2193'} ${Math.abs(deltaPercent).toFixed(1)}% vs ${prevMonthAbbr}`}
                </Text>
              </View>

              <View style={s.statCard}>
                <Text style={s.statLabel}>Biggest expense</Text>
                <Text style={s.statValue} numberOfLines={1}>
                  {biggestExpense ? formatCurrency(biggestExpense.amount, currency) : '—'}
                </Text>
                <Text style={[s.statSub, { color: colors.textTertiary }]} numberOfLines={1}>
                  {biggestExpense
                    ? `${biggestExpense.title}${biggestExpense.due_date ? ` \u00B7 ${formatDayMonth(biggestExpense.due_date)}` : ''}`
                    : 'No expenses yet'}
                </Text>
              </View>
            </View>

            {/* 6-month bar chart */}
            <View style={s.chartCard}>
              <View style={s.chartHeader}>
                <Text style={s.sectionLabel}>Last 6 months</Text>
                <Text style={s.chartTotal}>{formatCurrency(trendTotal, currency)}</Text>
              </View>
              <View style={s.barsRow}>
                {bars6.map((b, i) => {
                  const isLatest = i === bars6.length - 1;
                  const h = Math.max((b.amount / maxBar) * 90, 4);
                  return (
                    <View key={`${b.month}-${i}`} style={s.barCol}>
                      <View style={s.barTrack}>
                        <View
                          style={[
                            s.barFill,
                            {
                              height: h,
                              backgroundColor: isLatest ? colors.bgInk : '#E8E6E1',
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
              <View style={s.labelsRow}>
                {bars6.map((b, i) => (
                  <Text key={`lbl-${b.month}-${i}`} style={s.barLabel}>
                    {monthKeyToAbbr(b.month)}
                  </Text>
                ))}
              </View>
            </View>

            {/* Top categories */}
            {topCategories.length > 0 && (
              <View>
                <Text style={[s.sectionLabel, { marginBottom: space.sm }]}>Top categories</Text>
                <View style={{ gap: space.sm }}>
                  {topCategories.map((cat) => {
                    const meta = getCategoryMeta(cat.category);
                    return (
                      <View key={cat.category} style={s.catRow}>
                        <IconTile
                          icon={meta.icon as never}
                          color={meta.color}
                          bg={meta.bg}
                          size={40}
                        />
                        <View style={{ flex: 1, marginLeft: space.md }}>
                          <Text style={s.catTitle} numberOfLines={1}>
                            {formatCategoryLabel(cat.category)}
                          </Text>
                          <Text style={s.catCaption} numberOfLines={1}>
                            {`${formatCurrency(cat.amount, currency)} \u00B7 ${cat.pct}%`}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/* ============================================================================
 * Header — back + centered title + month picker action
 * ========================================================================== */

function Header({ monthLabel, onBack }: { monthLabel: string; onBack: () => void }) {
  return (
    <View style={s.header}>
      <TouchableOpacity onPress={onBack} hitSlop={12} style={s.headerIconBtn}>
        <IconChevronLeft size={24} color={colors.textPrimary} />
      </TouchableOpacity>
      <Text style={s.headerTitle}>Analytics</Text>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={hapticMedium}
        hitSlop={12}
        style={s.monthPicker}
      >
        <Text style={s.monthPickerLabel}>{monthLabel}</Text>
        <IconChevronDown size={14} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

/* ============================================================================
 * Styles
 * ========================================================================== */

const panel = {
  backgroundColor: colors.bgSurface,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: colors.border,
} as const;

const sectionLabelText = {
  fontSize: 10,
  fontWeight: '700' as const,
  color: colors.textMuted,
  letterSpacing: 0.6,
  textTransform: 'uppercase' as const,
};

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: space.gutter, paddingTop: space.md, paddingBottom: space.sm,
  },
  headerIconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.1 },
  monthPicker: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: space.sm, paddingVertical: 6,
  },
  monthPickerLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  scrollContent: {
    paddingTop: space.md, paddingBottom: 120, paddingHorizontal: space.gutter, gap: space.base,
  },

  statsRow: { flexDirection: 'row', gap: space.base },
  statCard: { ...panel, flex: 1, padding: 14, gap: 4 },
  statLabel: sectionLabelText,
  statValue: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  statSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  chartCard: { ...panel, padding: 14 },
  chartHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: space.md,
  },
  sectionLabel: sectionLabelText,
  chartTotal: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 90 },
  barCol: { flex: 1, height: 90, justifyContent: 'flex-end' },
  barTrack: { width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  barFill: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  labelsRow: { flexDirection: 'row', gap: 8, marginTop: space.sm },
  barLabel: {
    flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '600', color: colors.textMuted,
  },

  catRow: { ...panel, flexDirection: 'row', alignItems: 'center', padding: 12 },
  catTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  catCaption: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },

  card: {
    backgroundColor: colors.bgSurface, borderRadius: radius.sheet, padding: space.xl,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  paywallIconWrap: { marginBottom: space.base },
  paywallTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  paywallBody: {
    marginTop: space.sm, textAlign: 'center', fontSize: 14, lineHeight: 20,
    color: colors.textSecondary, maxWidth: 280,
  },
  paywallCta: {
    marginTop: space.lg, backgroundColor: colors.bgInk, borderRadius: radius.button,
    paddingVertical: 14, paddingHorizontal: 24,
  },
  paywallCtaLabel: { fontSize: 14, fontWeight: '600', color: colors.textInverse },

  skeleton: { backgroundColor: colors.bgSubtle, borderRadius: 14 },
});
