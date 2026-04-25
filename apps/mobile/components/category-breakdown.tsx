import { StyleSheet, Text, View } from 'react-native';
import { IconChartPie } from '@tabler/icons-react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors, font, space } from '@/constants/design';
import { formatCategoryLabel } from '@/lib/ui';
import { formatCurrency } from '@commune/utils';
import { Card } from './primitives';

export type CategoryItem = {
  category: string;
  amount: number;
  pct: number;
};

export function CategoryBreakdownCard({
  items,
  currency,
}: {
  items: CategoryItem[];
  currency: string;
  /** @deprecated retained for back-compat — scope is shown by the page header's month picker. */
  scopeLabel?: string;
}) {
  return (
    <Card variant="surface" padding={space.lg}>
      <View style={s.categoryHeader}>
        <Text style={[font.h3, { color: colors.textPrimary }]}>Spending by category</Text>
      </View>
      {items.length === 0 ? (
        <View style={s.categoryEmpty}>
          <IconChartPie size={28} color={colors.textSecondary} strokeWidth={1.7} />
          <Text style={[font.bodyStrong, { color: colors.textSecondary }]}>No categories yet</Text>
          <Text style={[font.caption, { color: colors.textTertiary, textAlign: 'center' }]}>
            Add an expense to see where money goes.
          </Text>
        </View>
      ) : (
        <DonutChart items={items} currency={currency} />
      )}
    </Card>
  );
}

// Unified analytics palette — sage primary, sage-mid secondary, cream tertiary,
// extra slices fall back to a muted neutral so the chart never reintroduces
// out-of-system hues.
const SLICE_PALETTE = [colors.sage, colors.sageMid, colors.cream, colors.bgSubtle];

function sliceColor(index: number): string {
  return SLICE_PALETTE[Math.min(index, SLICE_PALETTE.length - 1)] ?? colors.bgSubtle;
}

function DonutChart({ items, currency }: { items: CategoryItem[]; currency: string }) {
  const size = 104;
  const strokeWidth = 16;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const total = items.reduce((sum, i) => sum + i.amount, 0);
  const top = items.slice(0, 4);
  const restPct = items.slice(4).reduce((sum, i) => sum + i.pct, 0);

  const segments = items.reduce<Array<{ key: string; color: string; length: number; offset: number }>>((acc, item, idx) => {
    const length = (Math.max(0, item.pct) / 100) * c;
    const offset = acc.reduce((sum, segment) => sum + segment.length, 0);
    acc.push({ key: item.category, color: sliceColor(idx), length, offset });
    return acc;
  }, []);

  return (
    <View style={s.donutRow}>
      <View style={s.donutWrap}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={colors.bgSubtle}
              strokeWidth={strokeWidth}
              fill="none"
            />
            {segments.map((seg) => (
              <Circle
                key={seg.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={seg.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${seg.length} ${c}`}
                strokeDashoffset={-seg.offset}
                strokeLinecap="butt"
              />
            ))}
          </G>
        </Svg>
        <View style={s.donutCenter}>
          <Text style={s.donutCenterLabel}>Total</Text>
          <Text style={s.donutCenterValue} numberOfLines={1}>
            {formatCurrency(total, currency)}
          </Text>
        </View>
      </View>
      <View style={s.legend}>
        {top.map((item, idx) => (
          <View key={item.category} style={s.legendRow}>
            <View style={[s.legendDot, { backgroundColor: sliceColor(idx) }]} />
            <Text style={s.legendName} numberOfLines={1}>{formatCategoryLabel(item.category)}</Text>
            <Text style={s.legendPct}>{item.pct}%</Text>
          </View>
        ))}
        {items.length > 4 && (
          <View style={s.legendRow}>
            <View style={[s.legendDot, { backgroundColor: colors.bgSubtle }]} />
            <Text style={s.legendName} numberOfLines={1}>+{items.length - 4} more</Text>
            <Text style={s.legendPct}>{restPct}%</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  categoryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.base },
  categoryEmpty: { alignItems: 'center', paddingVertical: space.lg, gap: 6 },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.xs },
  donutWrap: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  donutCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  donutCenterLabel: { fontSize: 10, fontWeight: '600', color: colors.textTertiary, letterSpacing: 0.4, textTransform: 'uppercase' },
  donutCenterValue: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  legend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  legendPct: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
});
