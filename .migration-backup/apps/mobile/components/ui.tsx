/**
 * Retained UI primitives — components still imported by screens during migration.
 * These wrap HeroUI Native components or provide functionality HeroUI doesn't cover.
 */
import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated,
  type DimensionValue,
  Platform,
  ScrollView,
  Switch as RNSwitch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Card, Button, Chip } from 'heroui-native';
import { formatDate } from '@commune/utils';
import { useThemeStore } from '@/stores/theme';

/* ---------------------------------------------------------------------------
 * Theme helpers
 * --------------------------------------------------------------------------- */

function useThemeColors() {
  const isDark = useThemeStore((s) => s.mode) === 'dark';
  return {
    isDark,
    bg: isDark ? '#0A0A0A' : '#FAFAFA',
    surface: isDark ? '#18181B' : '#FFFFFF',
    text: isDark ? '#FAFAFA' : '#171b24',
    textSecondary: isDark ? '#A1A1AA' : '#667085',
    border: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(23,27,36,0.10)',
    inputBg: isDark ? '#27272A' : '#F5F1EA',
  };
}

/* ---------------------------------------------------------------------------
 * Screen — ScrollView wrapper with theme-aware background
 * --------------------------------------------------------------------------- */

export function Screen({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  const { bg } = useThemeColors();

  if (!scroll) {
    return <View style={{ flex: 1, backgroundColor: bg }}>{children}</View>;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

/* ---------------------------------------------------------------------------
 * Surface — now wraps HeroUI Card
 * --------------------------------------------------------------------------- */

export function Surface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`p-4 mb-4 ${className ?? ''}`}>
      {children}
    </Card>
  );
}

/* ---------------------------------------------------------------------------
 * Pill — now wraps HeroUI Chip
 * --------------------------------------------------------------------------- */

export function Pill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Chip
      color={selected ? 'accent' : 'default'}
      variant={selected ? 'primary' : 'soft'}
      onPress={onPress}
      className="mr-2"
    >
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
}

/* ---------------------------------------------------------------------------
 * StatusChip — now wraps HeroUI Chip with tone mapping
 * --------------------------------------------------------------------------- */

type ChipTone = 'neutral' | 'emerald' | 'forest' | 'sand' | 'sky' | 'danger';

const toneToColor: Record<ChipTone, 'default' | 'success' | 'accent' | 'warning' | 'danger'> = {
  neutral: 'default',
  emerald: 'success',
  forest: 'accent',
  sand: 'warning',
  sky: 'default',
  danger: 'danger',
};

export function StatusChip({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: ChipTone;
}) {
  return (
    <Chip
      color={toneToColor[tone]}
      variant="soft"
      size="sm"
      className="mr-1 mb-1"
    >
      {label}
    </Chip>
  );
}

/* ---------------------------------------------------------------------------
 * EmptyState — restyled with HeroUI components
 * --------------------------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { text, textSecondary } = useThemeColors();

  return (
    <Card style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 16 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: '#EEF6F3',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Ionicons name={icon} size={26} color="#2d6a4f" />
      </View>
      <Text style={{ textAlign: 'center', fontSize: 20, fontWeight: '600', color: text }}>
        {title}
      </Text>
      <Text style={{ marginTop: 12, textAlign: 'center', fontSize: 14, lineHeight: 22, color: textSecondary }}>
        {description}
      </Text>
      {actionLabel && onAction ? (
        <View style={{ marginTop: 24, width: '100%' }}>
          <Button variant="primary" className="w-full" onPress={onAction}>
            <Button.Label>{actionLabel}</Button.Label>
          </Button>
        </View>
      ) : null}
    </Card>
  );
}

/* ---------------------------------------------------------------------------
 * DateField — custom (HeroUI has no date picker)
 * --------------------------------------------------------------------------- */

export function DateField({
  label,
  value,
  onChange,
  hint,
  minimumDate,
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  hint?: string;
  minimumDate?: Date;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const { text, textSecondary, inputBg, border } = useThemeColors();

  function handleChange(_event: unknown, selected?: Date) {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) onChange(selected);
  }

  const displayText = value
    ? formatDate(value.toISOString().split('T')[0]!)
    : 'Select date';

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ marginBottom: 8, fontSize: 14, fontWeight: '500', color: text }}>
        {label}
      </Text>
      <TouchableOpacity
        style={{
          minHeight: 52,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: border,
          backgroundColor: inputBg,
          paddingHorizontal: 16,
        }}
        activeOpacity={0.86}
        onPress={() => setShowPicker((prev) => !prev)}
        accessibilityLabel={`${label}: ${displayText}`}
        accessibilityRole="button"
      >
        <Text style={{ fontSize: 16, color: value ? text : textSecondary }}>
          {displayText}
        </Text>
        <Ionicons name="calendar-outline" size={20} color={textSecondary} />
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleChange}
          minimumDate={minimumDate}
          accentColor="#2d6a4f"
        />
      )}
      {hint ? (
        <Text style={{ marginTop: 8, fontSize: 12, lineHeight: 20, color: textSecondary }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/* ---------------------------------------------------------------------------
 * Skeleton loading primitives — restyled, simpler
 * --------------------------------------------------------------------------- */

function Shimmer({ children }: { children: ReactNode }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

function SkeletonBox({ width, height, radius = 12 }: { width: DimensionValue; height: number; radius?: number }) {
  const { isDark } = useThemeColors();
  return (
    <View
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(23,27,36,0.08)',
      }}
    />
  );
}

export function DashboardSkeleton() {
  const { bg } = useThemeColors();
  return (
    <Screen>
      <Shimmer>
        <SkeletonBox width="100%" height={180} radius={16} />
        <View style={{ height: 20 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 }}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={{ alignItems: 'center' }}>
              <SkeletonBox width={56} height={56} radius={28} />
              <View style={{ height: 8 }} />
              <SkeletonBox width={32} height={10} radius={5} />
            </View>
          ))}
        </View>
        <View style={{ height: 20 }} />
        <SkeletonBox width="100%" height={300} radius={16} />
      </Shimmer>
    </Screen>
  );
}

export function ExpenseListSkeleton() {
  const { bg } = useThemeColors();
  return (
    <Screen>
      <Shimmer>
        <SkeletonBox width={160} height={28} radius={8} />
        <View style={{ height: 8 }} />
        <SkeletonBox width={200} height={14} radius={7} />
        <View style={{ height: 16 }} />
        <SkeletonBox width="100%" height={48} radius={12} />
        <View style={{ height: 16 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <SkeletonBox width="48%" height={80} radius={16} />
          <SkeletonBox width="48%" height={80} radius={16} />
        </View>
        <View style={{ height: 16 }} />
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ marginBottom: 12 }}>
            <SkeletonBox width="100%" height={72} radius={16} />
          </View>
        ))}
      </Shimmer>
    </Screen>
  );
}

export function BreakdownSkeleton() {
  return (
    <Screen>
      <Shimmer>
        <SkeletonBox width={160} height={28} radius={8} />
        <View style={{ height: 16 }} />
        <SkeletonBox width="100%" height={120} radius={16} />
        <View style={{ height: 16 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[50, 50, 50, 50, 50, 50].map((w, i) => (
            <SkeletonBox key={i} width={w} height={36} radius={18} />
          ))}
        </View>
        <View style={{ height: 16 }} />
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ marginBottom: 12 }}>
            <SkeletonBox width="100%" height={64} radius={16} />
          </View>
        ))}
      </Shimmer>
    </Screen>
  );
}

export function SettingsSkeleton() {
  return (
    <Screen>
      <Shimmer>
        <SkeletonBox width="100%" height={100} radius={16} />
        <View style={{ height: 16 }} />
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ marginBottom: 16 }}>
            <SkeletonBox width={80} height={14} radius={7} />
            <View style={{ height: 8 }} />
            <SkeletonBox width="100%" height={52} radius={12} />
          </View>
        ))}
      </Shimmer>
    </Screen>
  );
}

export function MembersSkeleton() {
  return (
    <Screen>
      <Shimmer>
        <SkeletonBox width={160} height={28} radius={8} />
        <View style={{ height: 16 }} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <SkeletonBox width="48%" height={80} radius={16} />
          <SkeletonBox width="48%" height={80} radius={16} />
        </View>
        <View style={{ height: 16 }} />
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ marginBottom: 12 }}>
            <SkeletonBox width="100%" height={64} radius={16} />
          </View>
        ))}
      </Shimmer>
    </Screen>
  );
}

export function ContentSkeleton() {
  return (
    <Screen>
      <Shimmer>
        <SkeletonBox width="100%" height={160} radius={16} />
        <View style={{ height: 16 }} />
        <SkeletonBox width="100%" height={240} radius={16} />
      </Shimmer>
    </Screen>
  );
}
