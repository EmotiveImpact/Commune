import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  type DimensionValue,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDate } from '@commune/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Tone = 'emerald' | 'forest' | 'sand' | 'sky';
type ChipTone = 'neutral' | 'emerald' | 'forest' | 'sand' | 'sky' | 'danger';

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

const toneStyles: Record<
  Tone,
  { icon: string; accent: string; panel: string; value: string }
> = {
  emerald: {
    icon: '#1b4332',
    accent: '#d7e6dd',
    panel: '#EEF6F3',
    value: '#171b24',
  },
  forest: {
    icon: '#1f2330',
    accent: '#e8e1ef',
    panel: '#F4F1F8',
    value: '#171b24',
  },
  sand: {
    icon: '#8A593B',
    accent: '#efdccf',
    panel: '#FCF4ED',
    value: '#2E241D',
  },
  sky: {
    icon: '#2d6a4f',
    accent: '#d7e6dd',
    panel: '#F2F6EC',
    value: '#171b24',
  },
};

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-[#1f2330]',
  secondary: 'bg-white border border-[rgba(23,27,36,0.14)]',
  ghost: 'bg-transparent',
  danger: 'bg-[#B9382F]',
};

const buttonTextStyles: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-[#171b24]',
  ghost: 'text-[#171b24]',
  danger: 'text-white',
};

const chipStyles: Record<ChipTone, { panel: string; text: string }> = {
  neutral: {
    panel: '#F1ECE4',
    text: '#667085',
  },
  emerald: {
    panel: '#EEF6F3',
    text: '#2d6a4f',
  },
  forest: {
    panel: '#F4F1F8',
    text: '#4F4660',
  },
  sand: {
    panel: '#FCF4ED',
    text: '#8A593B',
  },
  sky: {
    panel: '#F2F6EC',
    text: '#55704B',
  },
  danger: {
    panel: '#F7E2DD',
    text: '#B9382F',
  },
};

export function Screen({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  if (!scroll) {
    return <View className="flex-1 bg-[#f5f1ea]">{children}</View>;
  }

  return (
    <ScrollView
      className="flex-1 bg-[#f5f1ea]"
      contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function Surface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <View
      className={joinClasses(
        'rounded-[28px] border border-[rgba(23,27,36,0.14)] bg-white p-5',
        className
      )}
    >
      {children}
    </View>
  );
}

export function HeroPanel({
  eyebrow,
  title,
  description,
  badgeLabel,
  contextLabel,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  badgeLabel?: string;
  contextLabel?: string;
  children?: ReactNode;
}) {
  return (
    <View className="mb-4 rounded-[32px] bg-[#1f2330] px-5 py-5">
      <View className="flex-row items-start justify-between">
        <View className="mr-4 flex-1">
          <Text className="text-sm font-medium text-[rgba(255,255,255,0.72)]">{eyebrow}</Text>
          <Text className="mt-2 text-[30px] font-bold leading-[36px] text-white">
            {title}
          </Text>
          {contextLabel ? (
            <View className="mt-3 self-start rounded-full bg-[rgba(255,255,255,0.08)] px-3 py-2">
              <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#d9ebe5]">
                {contextLabel}
              </Text>
            </View>
          ) : null}
          <Text className="mt-3 text-sm leading-6 text-[rgba(255,250,246,0.72)]">
            {description}
          </Text>
        </View>
        {badgeLabel ? (
          <View className="rounded-full bg-[rgba(255,255,255,0.08)] px-4 py-2">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#d9ebe5]">
              {badgeLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {children ? <View className="mt-5">{children}</View> : null}
    </View>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <View className="mb-4">
      {eyebrow ? (
        <Text className="mb-2 text-xs font-semibold uppercase tracking-[2px] text-[#667085]">
          {eyebrow}
        </Text>
      ) : null}
      <Text className="text-[30px] font-bold leading-[36px] text-[#171b24]">{title}</Text>
      {description ? (
        <Text className="mt-2 text-sm leading-6 text-[#667085]">
          {description}
        </Text>
      ) : null}
    </View>
  );
}

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  fullWidth = true,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <TouchableOpacity
      className={joinClasses(
        'min-h-[52px] flex-row items-center justify-center rounded-2xl px-4',
        buttonStyles[variant],
        (disabled || loading) && 'opacity-60',
        fullWidth && 'w-full'
      )}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.86}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? '#171b24' : '#FFFFFF'} />
      ) : (
        <>
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={variant === 'secondary' || variant === 'ghost' ? '#171b24' : '#FFFFFF'}
              style={{ marginRight: 8 }}
            />
          ) : null}
          <Text className={joinClasses('text-base font-semibold', buttonTextStyles[variant])}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

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
    <TouchableOpacity
      className={joinClasses(
        'mr-2 rounded-full border px-4 py-2',
        selected
          ? 'border-[#1f2330] bg-[#1f2330]'
          : 'border-[rgba(23,27,36,0.14)] bg-white'
      )}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text
        className={joinClasses(
          'text-sm font-medium',
          selected ? 'text-white' : 'text-[#171b24]'
        )}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function StatusChip({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: ChipTone;
}) {
  const palette = chipStyles[tone];

  return (
    <View
      className="mr-2 mb-2 self-start rounded-full px-3 py-2"
      style={{ backgroundColor: palette.panel }}
    >
      <Text
        className="text-xs font-semibold uppercase tracking-[1px]"
        style={{ color: palette.text }}
      >
        {label}
      </Text>
    </View>
  );
}

export function ListRowCard({
  title,
  subtitle,
  amount,
  amountColor = '#171b24',
  onPress,
  children,
}: {
  title: string;
  subtitle: string;
  amount: string;
  amountColor?: string;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const content = (
    <>
      <View className="flex-row items-start justify-between">
        <View className="mr-3 flex-1">
          <Text className="text-base font-semibold text-[#171b24]">{title}</Text>
          <Text className="mt-1 text-sm leading-5 text-[#667085]">{subtitle}</Text>
        </View>
        <Text className="text-sm font-semibold" style={{ color: amountColor }}>
          {amount}
        </Text>
      </View>
      {children ? <View className="mt-4">{children}</View> : null}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        className="mt-4 rounded-[24px] border border-[rgba(23,27,36,0.14)] bg-[#fbf7f1] p-4"
        activeOpacity={0.86}
        onPress={onPress}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View className="mt-4 rounded-[24px] border border-[rgba(23,27,36,0.14)] bg-[#fbf7f1] p-4">
      {content}
    </View>
  );
}

export function StatCard({
  icon,
  label,
  value,
  note,
  tone = 'emerald',
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  note: string;
  tone?: Tone;
}) {
  const palette = toneStyles[tone];

  return (
    <View
      className="mb-3 rounded-[26px] border border-[rgba(23,27,36,0.14)] p-4"
      style={{ backgroundColor: palette.panel }}
    >
      <View className="mb-4 flex-row items-start justify-between">
        <View className="mr-3 flex-1">
          <Text className="text-sm font-medium text-[#667085]">{label}</Text>
          <Text
            className="mt-2 text-[26px] font-bold"
            style={{ color: palette.value }}
          >
            {value}
          </Text>
        </View>
        <View
          className="h-11 w-11 items-center justify-center rounded-2xl"
          style={{ backgroundColor: palette.accent }}
        >
          <Ionicons name={icon} size={20} color={palette.icon} />
        </View>
      </View>
      <Text className="text-sm leading-5 text-[#667085]">{note}</Text>
    </View>
  );
}

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
  return (
    <Surface className="items-center py-10">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-[#EEF6F3]">
        <Ionicons name={icon} size={26} color="#2d6a4f" />
      </View>
      <Text className="text-center text-xl font-semibold text-[#171b24]">
        {title}
      </Text>
      <Text className="mt-3 text-center text-sm leading-6 text-[#667085]">
        {description}
      </Text>
      {actionLabel && onAction ? (
        <View className="mt-6 w-full">
          <AppButton label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </Surface>
  );
}

export function TextField({
  label,
  hint,
  multiline,
  ...props
}: {
  label: string;
  hint?: string;
  multiline?: boolean;
} & ComponentProps<typeof TextInput>) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-[#171b24]">{label}</Text>
      <TextInput
        className={joinClasses(
          'rounded-2xl border border-[rgba(23,27,36,0.14)] bg-[#fbf7f1] px-4 text-base text-[#171b24]',
          multiline ? 'min-h-[112px] py-4' : 'min-h-[52px]'
        )}
        placeholderTextColor="#667085"
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...props}
      />
      {hint ? (
        <Text className="mt-2 text-xs leading-5 text-[#667085]">{hint}</Text>
      ) : null}
    </View>
  );
}

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

  function handleChange(_event: unknown, selected?: Date) {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (selected) {
      onChange(selected);
    }
  }

  const displayText = value
    ? formatDate(value.toISOString().split('T')[0]!)
    : 'Select date';

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-[#171b24]">{label}</Text>
      <TouchableOpacity
        className="min-h-[52px] flex-row items-center justify-between rounded-2xl border border-[rgba(23,27,36,0.14)] bg-[#fbf7f1] px-4"
        activeOpacity={0.86}
        onPress={() => setShowPicker((prev) => !prev)}
      >
        <Text
          className={joinClasses(
            'text-base',
            value ? 'text-[#171b24]' : 'text-[#667085]'
          )}
        >
          {displayText}
        </Text>
        <Ionicons name="calendar-outline" size={20} color="#667085" />
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
        <Text className="mt-2 text-xs leading-5 text-[#667085]">{hint}</Text>
      ) : null}
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View className="mb-3 flex-row items-center justify-between rounded-2xl border border-[rgba(23,27,36,0.14)] bg-[#fbf7f1] px-4 py-4">
      <View className="mr-4 flex-1">
        <Text className="text-base font-medium text-[#171b24]">{label}</Text>
        <Text className="mt-1 text-sm leading-5 text-[#667085]">
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: 'rgba(23,27,36,0.14)', true: '#d7e6dd' }}
        thumbColor={value ? '#1f2330' : '#FFFFFF'}
      />
    </View>
  );
}

export function InitialAvatar({
  name,
  size = 52,
}: {
  name?: string | null;
  size?: number;
}) {
  const label = (name ?? 'C')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  const fontSize = size <= 28 ? 10 : size <= 36 ? 13 : 18;

  return (
    <View
      className="items-center justify-center rounded-full bg-[#1f2330]"
      style={{ height: size, width: size }}
    >
      <Text style={{ fontSize, fontWeight: '600', color: '#FFFFFF' }}>{label || 'C'}</Text>
    </View>
  );
}

/**
 * @deprecated Use screen-specific skeleton components instead (e.g. DashboardSkeleton, ExpenseListSkeleton).
 */
export function LoadingScreen({ message }: { message: string }) {
  return (
    <Screen scroll={false}>
      <View className="flex-1 items-center justify-center px-6">
        <ActivityIndicator size="large" color="#2d6a4f" />
        <Text className="mt-4 text-sm text-[#667085]">{message}</Text>
      </View>
    </Screen>
  );
}

/* ---------------------------------------------------------------------------
 * Shimmer / Skeleton loading primitives
 * --------------------------------------------------------------------------- */

const SKELETON_BG = 'rgba(23,27,36,0.08)';

/** Pulsing opacity wrapper for skeleton layouts. */
export function Shimmer({ children }: { children: ReactNode }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1000,
          easing: (t: number) => t * t * (3 - 2 * t), // ease-in-out
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 1000,
          easing: (t: number) => t * t * (3 - 2 * t),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

/** Rounded rectangle placeholder block. */
export function SkeletonBox({
  width,
  height,
  radius = 12,
}: {
  width: DimensionValue;
  height: number;
  radius?: number;
  className?: string;
}) {
  return (
    <View
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: SKELETON_BG,
      }}
    />
  );
}

/** Single text-line placeholder. */
export function SkeletonLine({ width = '100%' }: { width?: DimensionValue }) {
  return (
    <View
      style={{
        width,
        height: 14,
        borderRadius: 7,
        backgroundColor: SKELETON_BG,
      }}
    />
  );
}

/* ---------------------------------------------------------------------------
 * Screen-specific skeleton layouts
 * --------------------------------------------------------------------------- */

/** Dashboard skeleton -- greeting + balance card + quick actions + list rows. */
export function DashboardSkeleton() {
  return (
    <Screen>
      <Shimmer>
        {/* Greeting */}
        <SkeletonLine width={200} />
        <View style={{ height: 8 }} />
        <SkeletonLine width={140} />
        <View style={{ height: 20 }} />

        {/* Balance card */}
        <SkeletonBox width="100%" height={180} radius={28} />
        <View style={{ height: 16 }} />

        {/* Quick action circles */}
        <View className="flex-row justify-between" style={{ paddingHorizontal: 8 }}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} className="items-center">
              <SkeletonBox width={56} height={56} radius={28} />
              <View style={{ height: 8 }} />
              <SkeletonLine width={32} />
            </View>
          ))}
        </View>
        <View style={{ height: 20 }} />

        {/* Recent expenses header */}
        <SkeletonLine width={80} />
        <View style={{ height: 12 }} />

        {/* Expense rows */}
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} className="flex-row items-center" style={{ marginBottom: 12 }}>
            <SkeletonBox width={40} height={40} radius={20} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <SkeletonLine width="70%" />
              <View style={{ height: 6 }} />
              <SkeletonLine width="40%" />
            </View>
            <SkeletonLine width={60} />
          </View>
        ))}
        <View style={{ height: 16 }} />

        {/* Trend chart */}
        <SkeletonBox width="100%" height={160} radius={28} />
      </Shimmer>
    </Screen>
  );
}

/** Expenses list skeleton -- hero + filter pills + expense rows. */
export function ExpenseListSkeleton() {
  return (
    <Screen>
      <Shimmer>
        <SkeletonBox width="100%" height={200} radius={32} />
        <View style={{ height: 16 }} />
        <View className="flex-row" style={{ gap: 8 }}>
          {[60, 80, 70, 90].map((w, i) => (
            <SkeletonBox key={i} width={w} height={36} radius={18} />
          ))}
        </View>
        <View style={{ height: 16 }} />
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ marginBottom: 12 }}>
            <SkeletonBox width="100%" height={80} radius={24} />
          </View>
        ))}
      </Shimmer>
    </Screen>
  );
}

/** Breakdown skeleton -- hero + month pills + stats + breakdown items. */
export function BreakdownSkeleton() {
  return (
    <Screen>
      <Shimmer>
        <SkeletonBox width="100%" height={200} radius={32} />
        <View style={{ height: 16 }} />
        <View className="flex-row" style={{ gap: 8 }}>
          {[50, 50, 50, 50, 50, 50].map((w, i) => (
            <SkeletonBox key={i} width={w} height={36} radius={18} />
          ))}
        </View>
        <View style={{ height: 16 }} />
        <View className="flex-row" style={{ gap: 12 }}>
          <SkeletonBox width="48%" height={130} radius={26} />
          <SkeletonBox width="48%" height={130} radius={26} />
        </View>
        <View style={{ height: 12 }} />
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ marginBottom: 12 }}>
            <SkeletonBox width="100%" height={90} radius={24} />
          </View>
        ))}
      </Shimmer>
    </Screen>
  );
}

/** Members skeleton -- hero + stat cards + member rows. */
export function MembersSkeleton() {
  return (
    <Screen>
      <Shimmer>
        <SkeletonBox width="100%" height={180} radius={32} />
        <View style={{ height: 16 }} />
        <View className="flex-row" style={{ gap: 12 }}>
          <SkeletonBox width="48%" height={100} radius={26} />
          <SkeletonBox width="48%" height={100} radius={26} />
        </View>
        <View style={{ height: 16 }} />
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ marginBottom: 12 }}>
            <SkeletonBox width="100%" height={72} radius={20} />
          </View>
        ))}
      </Shimmer>
    </Screen>
  );
}

/** Settings skeleton -- hero + profile field placeholders. */
export function SettingsSkeleton() {
  return (
    <Screen>
      <Shimmer>
        <SkeletonBox width="100%" height={200} radius={32} />
        <View style={{ height: 16 }} />
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ marginBottom: 16 }}>
            <SkeletonLine width={80} />
            <View style={{ height: 8 }} />
            <SkeletonBox width="100%" height={52} radius={16} />
          </View>
        ))}
      </Shimmer>
    </Screen>
  );
}

/** Generic content skeleton for smaller/simpler screens. */
export function ContentSkeleton() {
  return (
    <Screen>
      <Shimmer>
        <SkeletonBox width="100%" height={200} radius={32} />
        <View style={{ height: 16 }} />
        <SkeletonBox width="100%" height={300} radius={28} />
      </Shimmer>
    </Screen>
  );
}
