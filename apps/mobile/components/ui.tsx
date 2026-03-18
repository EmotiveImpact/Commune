import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
    icon: '#17463F',
    accent: '#CFE8E1',
    panel: '#EEF6F3',
    value: '#17141F',
  },
  forest: {
    icon: '#17141F',
    accent: '#E7E0F0',
    panel: '#F4F1F8',
    value: '#17141F',
  },
  sand: {
    icon: '#8A593B',
    accent: '#F2DDCF',
    panel: '#FCF4ED',
    value: '#2E241D',
  },
  sky: {
    icon: '#205C54',
    accent: '#DCE7D5',
    panel: '#F2F6EC',
    value: '#17141F',
  },
};

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-[#17141F]',
  secondary: 'bg-white border border-[#D9D2C8]',
  ghost: 'bg-transparent',
  danger: 'bg-[#B9382F]',
};

const buttonTextStyles: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-[#17141F]',
  ghost: 'text-[#17141F]',
  danger: 'text-white',
};

const chipStyles: Record<ChipTone, { panel: string; text: string }> = {
  neutral: {
    panel: '#F1ECE4',
    text: '#6A645D',
  },
  emerald: {
    panel: '#EEF6F3',
    text: '#205C54',
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
    return <View className="flex-1 bg-[#F4EFE8]">{children}</View>;
  }

  return (
    <ScrollView
      className="flex-1 bg-[#F4EFE8]"
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
        'rounded-[28px] border border-[#DED6CA] bg-white p-5',
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
    <View className="mb-4 rounded-[32px] bg-[#17141F] px-5 py-5">
      <View className="flex-row items-start justify-between">
        <View className="mr-4 flex-1">
          <Text className="text-sm font-medium text-[#BBB4C1]">{eyebrow}</Text>
          <Text className="mt-2 text-[30px] font-bold leading-[36px] text-white">
            {title}
          </Text>
          {contextLabel ? (
            <View className="mt-3 self-start rounded-full bg-white/8 px-3 py-2">
              <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#E8E2EF]">
                {contextLabel}
              </Text>
            </View>
          ) : null}
          <Text className="mt-3 text-sm leading-6 text-[#C7C2CD]">
            {description}
          </Text>
        </View>
        {badgeLabel ? (
          <View className="rounded-full bg-white/10 px-4 py-2">
            <Text className="text-xs font-semibold uppercase tracking-[2px] text-[#E8E2EF]">
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
        <Text className="mb-2 text-xs font-semibold uppercase tracking-[2px] text-[#7B746D]">
          {eyebrow}
        </Text>
      ) : null}
      <Text className="text-[30px] font-bold leading-[36px] text-[#17141F]">{title}</Text>
      {description ? (
        <Text className="mt-2 text-sm leading-6 text-[#6A645D]">
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
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? '#17141F' : '#FFFFFF'} />
      ) : (
        <>
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={variant === 'secondary' || variant === 'ghost' ? '#17141F' : '#FFFFFF'}
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
          ? 'border-[#17141F] bg-[#17141F]'
          : 'border-[#DDD5CA] bg-white'
      )}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text
        className={joinClasses(
          'text-sm font-medium',
          selected ? 'text-white' : 'text-[#17141F]'
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
  amountColor = '#17141F',
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
          <Text className="text-base font-semibold text-[#17141F]">{title}</Text>
          <Text className="mt-1 text-sm leading-5 text-[#6A645D]">{subtitle}</Text>
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
        className="mt-4 rounded-[24px] border border-[#DDD5CA] bg-[#FAF7F2] p-4"
        activeOpacity={0.86}
        onPress={onPress}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View className="mt-4 rounded-[24px] border border-[#DDD5CA] bg-[#FAF7F2] p-4">
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
      className="mb-3 rounded-[26px] border border-[#DED6CA] p-4"
      style={{ backgroundColor: palette.panel }}
    >
      <View className="mb-4 flex-row items-start justify-between">
        <View className="mr-3 flex-1">
          <Text className="text-sm font-medium text-[#6A645D]">{label}</Text>
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
      <Text className="text-sm leading-5 text-[#6A645D]">{note}</Text>
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
        <Ionicons name={icon} size={26} color="#205C54" />
      </View>
      <Text className="text-center text-xl font-semibold text-[#17141F]">
        {title}
      </Text>
      <Text className="mt-3 text-center text-sm leading-6 text-[#6A645D]">
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
      <Text className="mb-2 text-sm font-medium text-[#17141F]">{label}</Text>
      <TextInput
        className={joinClasses(
          'rounded-2xl border border-[#DDD5CA] bg-[#FAF7F2] px-4 text-base text-[#17141F]',
          multiline ? 'min-h-[112px] py-4' : 'min-h-[52px]'
        )}
        placeholderTextColor="#958D84"
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...props}
      />
      {hint ? (
        <Text className="mt-2 text-xs leading-5 text-[#827A72]">{hint}</Text>
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
    <View className="mb-3 flex-row items-center justify-between rounded-2xl border border-[#DDD5CA] bg-[#FAF7F2] px-4 py-4">
      <View className="mr-4 flex-1">
        <Text className="text-base font-medium text-[#17141F]">{label}</Text>
        <Text className="mt-1 text-sm leading-5 text-[#827A72]">
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#D7D0C6', true: '#CFE8E1' }}
        thumbColor={value ? '#17141F' : '#FFFFFF'}
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

  return (
    <View
      className="items-center justify-center rounded-full bg-[#17141F]"
      style={{ height: size, width: size }}
    >
      <Text className="text-lg font-semibold text-white">{label || 'C'}</Text>
    </View>
  );
}

export function LoadingScreen({ message }: { message: string }) {
  return (
    <Screen scroll={false}>
      <View className="flex-1 items-center justify-center px-6">
        <ActivityIndicator size="large" color="#205C54" />
        <Text className="mt-4 text-sm text-[#6A645D]">{message}</Text>
      </View>
    </Screen>
  );
}
