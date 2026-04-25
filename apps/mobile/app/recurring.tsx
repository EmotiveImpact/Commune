import { useMemo } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconChevronLeft, IconPlus, IconRepeat, IconUsers } from '@tabler/icons-react-native';
import type { ExpenseWithParticipants } from '@commune/types';
import { formatCurrency } from '@commune/utils';
import { EmptyState, IconTile, Screen } from '@/components/primitives';
import { colors, font, radius, space, elevation, getCategoryMeta } from '@/constants/design';
import { useGroupStore } from '@/stores/group';
import { useGroup } from '@/hooks/use-groups';
import { useActiveRecurring } from '@/hooks/use-recurring-management';
import { formatCategoryLabel } from '@/lib/ui';
import { hapticLight, hapticMedium } from '@/lib/haptics';

/* -- Helpers ------------------------------------------------------------ */

const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Parse a YYYY-MM-DD key into a UTC Date (timezone-safe calendar day). */
function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

function toDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayKey(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function daysBetween(fromKey: string, toKey: string): number {
  const a = parseDateKey(fromKey).getTime();
  const b = parseDateKey(toKey).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/**
 * Compute the next upcoming due date (YYYY-MM-DD) for a recurring expense,
 * based on its source `due_date` + `recurrence_type`. Advances past today.
 */
function computeNextDueKey(expense: ExpenseWithParticipants): string {
  const today = todayKey();
  const src = expense.due_date;
  if (!src) return today;

  // If the source due_date is still in the future, that IS the next due.
  if (src >= today) return src;

  const srcDate = parseDateKey(src);
  const type = expense.recurrence_type;

  if (type === 'weekly') {
    const todayDate = parseDateKey(today);
    const srcDow = srcDate.getUTCDay();
    const todayDow = todayDate.getUTCDay();
    let delta = srcDow - todayDow;
    if (delta <= 0) delta += 7;
    const next = new Date(todayDate);
    next.setUTCDate(todayDate.getUTCDate() + delta);
    return toDateKey(next);
  }

  // Default: treat as monthly (the other supported recurrence in the schema).
  const todayDate = parseDateKey(today);
  const year = todayDate.getUTCFullYear();
  const month = todayDate.getUTCMonth();
  const day = srcDate.getUTCDate();

  const thisMonthLast = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const thisMonthDay = Math.min(day, thisMonthLast);
  const thisMonth = new Date(Date.UTC(year, month, thisMonthDay));
  if (toDateKey(thisMonth) >= today) return toDateKey(thisMonth);

  const nextMonthLast = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  const nextMonthDay = Math.min(day, nextMonthLast);
  return toDateKey(new Date(Date.UTC(year, month + 1, nextMonthDay)));
}

function frequencyLabel(type: string | null | undefined): string {
  switch (type) {
    case 'weekly': return 'Weekly';
    case 'monthly': return 'Monthly';
    default: return 'Recurring';
  }
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0] ?? 'th');
}

/** "Monthly · 1st · Next May 1" style caption. */
function buildRowCaption(type: string | null | undefined, nextKey: string): string {
  const d = parseDateKey(nextKey);
  const day = d.getUTCDate();
  const monthAbbr = MONTH_ABBR[d.getUTCMonth()] ?? '';
  const monthTitle = monthAbbr.charAt(0) + monthAbbr.slice(1).toLowerCase();
  const freq = frequencyLabel(type);

  if (type === 'monthly') {
    return `${freq} · ${ordinal(day)} · Next ${monthTitle} ${day}`;
  }
  if (type === 'weekly') {
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
    return `${freq} · ${dow} · Next ${monthTitle} ${day}`;
  }
  return `${freq} · Next ${monthTitle} ${day}`;
}

function formatNextBillingLabel(nextKey: string): string {
  const d = parseDateKey(nextKey);
  const monthAbbr = MONTH_ABBR[d.getUTCMonth()] ?? '';
  const monthTitle = monthAbbr.charAt(0) + monthAbbr.slice(1).toLowerCase();
  return `Next billing · ${monthTitle} ${d.getUTCDate()}`;
}

function daysUntilText(nextKey: string): string {
  const delta = daysBetween(todayKey(), nextKey);
  if (delta <= 0) return 'auto-generates today';
  if (delta === 1) return 'auto-generates tomorrow';
  return `auto-generates in ${delta} days`;
}

/* -- Screen ------------------------------------------------------------- */

export default function RecurringScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeGroupId } = useGroupStore();
  const { data: group } = useGroup(activeGroupId ?? '');
  const { data: activeExpenses, isLoading } = useActiveRecurring(activeGroupId ?? '');

  const currency = group?.currency ?? 'GBP';

  const handleAdd = () => {
    hapticMedium();
    router.push('/expenses/new');
  };

  const handleBack = () => {
    hapticLight();
    if (router.canGoBack()) router.back();
  };

  const handleOpen = (expenseId: string) => {
    hapticMedium();
    router.push(`/expenses/${expenseId}`);
  };

  /* Sort ascending by next_due; derive hero, strip, and list. */
  const { sorted, nextBilling, stripTiles, monthTotal, monthLabel } = useMemo(() => {
    const raw = (activeExpenses ?? []) as ExpenseWithParticipants[];
    const withNext = raw
      .map((e) => ({ expense: e, nextKey: computeNextDueKey(e) }))
      .sort((a, b) => a.nextKey.localeCompare(b.nextKey));

    const next = withNext[0] ?? null;

    // Group into distinct dates within next ~45 days, up to 6 tiles.
    const byDate = new Map<string, number>();
    const horizonDays = 45;
    const today = todayKey();
    for (const { expense, nextKey } of withNext) {
      const delta = daysBetween(today, nextKey);
      if (delta < 0 || delta > horizonDays) continue;
      byDate.set(nextKey, (byDate.get(nextKey) ?? 0) + expense.amount);
    }
    const tiles = Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([dateKey, sum]) => ({ dateKey, sum }));

    // Month total = sum of amounts whose next_due falls within the current calendar month.
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    let total = 0;
    for (const { expense, nextKey } of withNext) {
      const d = parseDateKey(nextKey);
      if (d.getUTCFullYear() === curYear && d.getUTCMonth() === curMonth) {
        total += expense.amount;
      }
    }
    const mLabel = MONTH_FULL[curMonth] ?? '';

    return {
      sorted: withNext,
      nextBilling: next,
      stripTiles: tiles,
      monthTotal: total,
      monthLabel: mLabel,
    };
  }, [activeExpenses]);

  /* ---------------------------------------------------------------- Header */

  const header = (
    <View
      style={{
        paddingTop: insets.top + 12,
        paddingBottom: space.md,
        paddingHorizontal: space.gutter,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.bgBase,
        position: 'relative',
      }}
    >
      <TouchableOpacity
        onPress={handleBack}
        hitSlop={10}
        activeOpacity={0.6}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6, paddingRight: 10, marginLeft: -4, zIndex: 2 }}
      >
        <IconChevronLeft size={22} color={colors.textPrimary} strokeWidth={2} />
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>Back</Text>
      </TouchableOpacity>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={[font.h3, { color: colors.textPrimary }]}>Recurring</Text>
      </View>
      <TouchableOpacity
        onPress={handleAdd}
        hitSlop={12}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 32, justifyContent: 'flex-end', zIndex: 2 }}
      >
        <IconPlus size={14} color={colors.sageInk} strokeWidth={2.5} />
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.sageInk, letterSpacing: 0.2 }}>
          Add
        </Text>
      </TouchableOpacity>
    </View>
  );

  /* ---------------------------------------------------------------- Empty */

  if (!activeGroupId) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <EmptyState
          icon={IconUsers}
          title="Select a group first"
          description="Choose a group to manage recurring bills."
        />
      </Screen>
    );
  }

  const empty = !isLoading && sorted.length === 0;

  /* ---------------------------------------------------------------- Render */

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      {header}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: space.md,
          paddingBottom: 120,
          paddingHorizontal: space.gutter,
        }}
        showsVerticalScrollIndicator={false}
      >
        {empty ? (
          <EmptyState
            icon={IconRepeat}
            title="No recurring bills"
            description="Turn any expense into a recurring bill and we'll auto-generate it each cycle."
            actionLabel="Add recurring bill"
            onAction={handleAdd}
          />
        ) : (
          <>
            {/* Dark-ink hero: next billing anchor */}
            {nextBilling ? (
              <View
                style={{
                  backgroundColor: colors.bgInk,
                  borderRadius: radius.hero,
                  padding: space.xl,
                  marginBottom: space.xl,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 0.8,
                    color: 'rgba(255,255,255,0.55)',
                    textTransform: 'uppercase',
                  }}
                >
                  {formatNextBillingLabel(nextBilling.nextKey)}
                </Text>
                <Text
                  style={{
                    marginTop: space.sm,
                    fontSize: 34,
                    fontWeight: '700',
                    lineHeight: 40,
                    letterSpacing: -0.5,
                    color: colors.textInverse,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatCurrency(nextBilling.expense.amount, currency)}
                </Text>
                <Text
                  style={{
                    marginTop: space.sm,
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.75)',
                  }}
                  numberOfLines={1}
                >
                  <Text style={{ fontWeight: '700', color: colors.textInverse }}>
                    {nextBilling.expense.title}
                  </Text>
                  {' · '}
                  {daysUntilText(nextBilling.nextKey)}
                </Text>
              </View>
            ) : null}

            {/* Upcoming section label */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: space.md,
              }}
            >
              <Text style={[font.h3, { color: colors.textPrimary }]}>
                Upcoming in {monthLabel}
              </Text>
              <Text style={[font.caption, { color: colors.textTertiary }]}>
                {formatCurrency(monthTotal, currency)} total
              </Text>
            </View>

            {/* Horizontal date strip */}
            {stripTiles.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: space.gutter, gap: space.sm }}
                style={{ marginHorizontal: -space.gutter, marginBottom: space.xl }}
              >
                <View style={{ width: space.gutter }} />
                {stripTiles.map((tile, idx) => {
                  const isNext = idx === 0;
                  const d = parseDateKey(tile.dateKey);
                  const monthAbbr = MONTH_ABBR[d.getUTCMonth()] ?? '';
                  const day = d.getUTCDate();
                  return (
                    <View
                      key={tile.dateKey}
                      style={{
                        minWidth: 68,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 14,
                        alignItems: 'center',
                        backgroundColor: isNext ? colors.bgInk : colors.bgSurface,
                        borderWidth: isNext ? 0 : 1,
                        borderColor: colors.borderSubtle,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '700',
                          letterSpacing: 0.6,
                          color: isNext ? 'rgba(255,255,255,0.7)' : colors.textMuted,
                        }}
                      >
                        {monthAbbr}
                      </Text>
                      <Text
                        style={{
                          marginTop: 2,
                          fontSize: 22,
                          fontWeight: '700',
                          lineHeight: 26,
                          color: isNext ? colors.textInverse : colors.textPrimary,
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {day}
                      </Text>
                      <Text
                        style={{
                          marginTop: 2,
                          fontSize: 10,
                          fontWeight: '500',
                          color: isNext ? 'rgba(255,255,255,0.7)' : colors.textMuted,
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {formatCurrency(tile.sum, currency)}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            ) : null}

            {/* All recurring */}
            <Text
              style={[
                font.h3,
                { color: colors.textPrimary, marginBottom: space.md },
              ]}
            >
              All recurring
            </Text>

            <View style={{ gap: space.sm }}>
              {sorted.map(({ expense, nextKey }) => {
                const meta = getCategoryMeta(expense.category ?? 'miscellaneous');
                return (
                  <TouchableOpacity
                    key={expense.id}
                    activeOpacity={0.8}
                    onPress={() => handleOpen(expense.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.md,
                      backgroundColor: colors.bgSurface,
                      borderRadius: 14,
                      padding: space.md,
                      ...elevation.card,
                    }}
                  >
                    <IconTile
                      icon={meta.icon as never}
                      color={meta.color}
                      bg={meta.bg}
                      size={40}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}
                        numberOfLines={1}
                      >
                        {expense.title}
                      </Text>
                      <Text
                        style={{ marginTop: 2, fontSize: 12, color: colors.textTertiary }}
                        numberOfLines={1}
                      >
                        {buildRowCaption(expense.recurrence_type, nextKey)}
                        {expense.category ? ` · ${formatCategoryLabel(expense.category)}` : ''}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: colors.textPrimary,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {formatCurrency(expense.amount, currency)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
