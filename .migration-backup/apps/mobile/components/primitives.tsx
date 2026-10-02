/**
 * Commune Primitives — Light theme, editorial
 *
 * Atomic components that every screen uses.
 * All consume tokens from constants/design.ts — never hardcode.
 */

import { type ComponentType, type ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  type GestureResponderEvent,
  Image,
  Modal,
  Platform,
  Pressable as RNPressable,
  type PressableProps,
  StyleProp,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { IconCalendar, IconChevronDown, IconPlus, IconSearch, IconSparkles } from '@tabler/icons-react-native';
import { formatDate } from '@commune/utils';
import { colors, elevation, font, height, radius, space } from '@/constants/design';
import { WheelPicker } from '@/components/wheel-picker';

export type TablerIcon = ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

/**
 * NativeWind's Metro interop has been dropping Pressable callback styles in
 * this app, which leaves children visible but strips button backgrounds/layout.
 * Resolve the pressed state here and pass React Native a plain style instead.
 */
export function Pressable({
  children,
  onPressIn,
  onPressOut,
  style,
  ...props
}: PressableProps) {
  const [pressed, setPressed] = useState(false);
  const state = { pressed };
  const resolvedStyle = typeof style === 'function' ? style(state) : style;
  const resolvedChildren =
    typeof children === 'function' ? children(state) : children;

  function handlePressIn(event: GestureResponderEvent) {
    setPressed(true);
    onPressIn?.(event);
  }

  function handlePressOut(event: GestureResponderEvent) {
    setPressed(false);
    onPressOut?.(event);
  }

  return (
    <RNPressable
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={resolvedStyle}
    >
      {resolvedChildren}
    </RNPressable>
  );
}

/* ============================================================================
 * Screen — base container
 * ============================================================================ */

export function Screen({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flex: 1, backgroundColor: colors.bgBase }, style]}>
      {children}
    </View>
  );
}

/* ============================================================================
 * Card
 * ============================================================================ */

export function Card({
  children,
  onPress,
  padding = space.lg,
  variant = 'surface',
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  padding?: number;
  variant?: 'surface' | 'subtle' | 'ink';
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    variant === 'ink'
      ? colors.bgInk
      : variant === 'subtle'
      ? colors.bgSubtle
      : colors.bgSurface;

  const cardStyle: StyleProp<ViewStyle> = [
    {
      backgroundColor: bg,
      borderRadius: radius.card,
      padding,
    },
    variant === 'surface' ? elevation.card : undefined,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed && { transform: [{ scale: 0.99 }], opacity: 0.96 }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

/* ============================================================================
 * Button
 * ============================================================================ */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'ink';
type ButtonSize = 'sm' | 'md' | 'lg';

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  trailingIcon,
  loading,
  disabled,
  fullWidth,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: TablerIcon;
  trailingIcon?: TablerIcon;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const h = size === 'sm' ? height.buttonSm : size === 'lg' ? height.buttonLg : height.buttonMd;
  const fs = size === 'sm' ? 14 : size === 'lg' ? 16 : 15;

  const { bg, fg, border } = (() => {
    switch (variant) {
      case 'primary':
        return { bg: colors.sage, fg: colors.textInverse, border: colors.sage };
      case 'secondary':
        return { bg: colors.bgSurface, fg: colors.sage, border: colors.border };
      case 'ghost':
        return { bg: 'transparent', fg: colors.sage, border: 'transparent' };
      case 'destructive':
        return { bg: colors.dangerBg, fg: colors.dangerText, border: colors.dangerBg };
      case 'ink':
        return { bg: colors.bgInk, fg: colors.textInverse, border: colors.bgInk };
    }
  })();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          height: h,
          paddingHorizontal: space.lg,
          borderRadius: radius.button,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          width: fullWidth ? '100%' : undefined,
          opacity: disabled ? 0.5 : 1,
        },
        pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon ? (() => { const Icon = icon; return <Icon size={fs + 3} color={fg} strokeWidth={1.7} />; })() : null}
          <Text style={{ fontSize: fs, fontWeight: '600', color: fg }}>{label}</Text>
          {trailingIcon ? (() => { const Icon = trailingIcon; return <Icon size={fs + 3} color={fg} strokeWidth={1.7} />; })() : null}
        </>
      )}
    </Pressable>
  );
}

/* ============================================================================
 * ListItem
 * ============================================================================ */

export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  style,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const inner = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: space.md,
          paddingHorizontal: space.base,
          gap: space.md,
        },
        style,
      ]}
    >
      {leading}
      <View style={{ flex: 1 }}>
        <Text style={[font.bodyStrong, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[font.caption, { color: colors.textTertiary, marginTop: 2 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

/* ============================================================================
 * Avatar — initials with colored ink bg
 * ============================================================================ */

export function Avatar({
  name,
  size = 44,
  bg,
  fg,
  uri,
}: {
  name?: string | null;
  size?: number;
  bg?: string;
  fg?: string;
  uri?: string | null;
}) {
  const initials = name
    ? name
        .trim()
        .split(/\s+/)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '?';

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg ?? colors.bgSubtle,
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg ?? colors.sageSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: Math.round(size * 0.38),
          fontWeight: '700',
          color: fg ?? colors.sageInk,
          letterSpacing: 0.3,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

/* ============================================================================
 * IconTile — colored square tile wrapping an icon
 * ============================================================================ */

export function IconTile({
  icon: Icon,
  color = colors.sage,
  bg = colors.sageSoft,
  size = 40,
  iconSize,
}: {
  icon: TablerIcon;
  color?: string;
  bg?: string;
  size?: number;
  iconSize?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={iconSize ?? Math.round(size * 0.5)} color={color} strokeWidth={1.7} />
    </View>
  );
}

/* ============================================================================
 * Badge / StatusPill
 * ============================================================================ */

type BadgeTone = 'owe' | 'owed' | 'settled' | 'warn' | 'info' | 'sage' | 'neutral';

const toneMap: Record<BadgeTone, { bg: string; fg: string }> = {
  owe: { bg: colors.oweBg, fg: colors.oweText },
  owed: { bg: colors.owedBg, fg: colors.owedText },
  settled: { bg: colors.settledBg, fg: colors.settledText },
  warn: { bg: colors.warnBg, fg: colors.warnText },
  info: { bg: colors.infoBg, fg: colors.infoText },
  sage: { bg: colors.sageSoft, fg: colors.sage },
  neutral: { bg: colors.bgSubtle, fg: colors.textTertiary },
};

export function Badge({
  label,
  tone = 'neutral',
  style,
}: {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
}) {
  const { bg, fg } = toneMap[tone];
  return (
    <View
      style={[
        {
          paddingHorizontal: space.sm + 2,
          paddingVertical: 4,
          borderRadius: radius.chip,
          backgroundColor: bg,
        },
        style,
      ]}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', color: fg, letterSpacing: 0.3 }}>
        {label}
      </Text>
    </View>
  );
}

/* ============================================================================
 * StatusPill — for owe/owed amounts (always signed)
 * ============================================================================ */

export function StatusPill({
  amount,
  tone,
  style,
}: {
  amount: string;
  tone: 'owe' | 'owed' | 'settled';
  style?: StyleProp<ViewStyle>;
}) {
  const { bg, fg } = toneMap[tone];
  return (
    <View
      style={[
        {
          paddingHorizontal: space.md,
          paddingVertical: 6,
          borderRadius: radius.pill,
          backgroundColor: bg,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: fg,
          fontVariant: ['tabular-nums'],
        }}
      >
        {amount}
      </Text>
    </View>
  );
}

/* ============================================================================
 * SectionHeader — title + "See all →" link
 * ============================================================================ */

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: space.md,
        },
        style,
      ]}
    >
      <Text style={[font.h2, { color: colors.textPrimary }]}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.sage }}>
            {actionLabel} →
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ============================================================================
 * SearchField
 * ============================================================================ */

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  onSubmitEditing?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgSubtle,
        borderRadius: radius.button,
        paddingHorizontal: space.base,
        height: height.input,
      }}
    >
      <IconSearch size={18} color={colors.textTertiary} strokeWidth={1.7} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        onSubmitEditing={onSubmitEditing}
        style={{
          flex: 1,
          marginLeft: space.sm,
          fontSize: 15,
          color: colors.textPrimary,
        }}
      />
    </View>
  );
}

/* ============================================================================
 * EmptyState
 * ============================================================================ */

export function EmptyState({
  icon: Icon = IconSparkles,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: TablerIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        paddingVertical: space.xxxl,
        paddingHorizontal: space.xl,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.sageSoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: space.lg,
        }}
      >
        <Icon size={32} color={colors.sage} strokeWidth={1.7} />
      </View>
      <Text style={[font.h3, { color: colors.textPrimary, textAlign: 'center' }]}>
        {title}
      </Text>
      {description ? (
        <Text
          style={[
            font.body,
            { color: colors.textTertiary, textAlign: 'center', marginTop: space.sm, maxWidth: 280 },
          ]}
        >
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={{ marginTop: space.lg }} />
      ) : null}
    </View>
  );
}

/* ============================================================================
 * SkeletonBlock
 * ============================================================================ */

export function SkeletonBlock({
  width = '100%',
  height: h = 16,
  radius: r = radius.chip,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          width,
          height: h,
          borderRadius: r,
          backgroundColor: colors.bgSubtle,
        },
        style,
      ]}
    />
  );
}

/* ============================================================================
 * FAB — floating + raised primary action
 * ============================================================================ */

export function FAB({
  onPress,
  icon: Icon = IconPlus,
  size = height.fab,
  style,
}: {
  onPress?: () => void;
  icon?: TablerIcon;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.sage,
          alignItems: 'center',
          justifyContent: 'center',
        },
        elevation.fab,
        pressed && { opacity: 0.9, transform: [{ scale: 0.95 }] },
        style,
      ]}
    >
      <Icon size={26} color={colors.textInverse} strokeWidth={1.7} />
    </Pressable>
  );
}

/* ============================================================================
 * Stat — metric block (label + value + optional caption)
 * ============================================================================ */

export function Stat({
  label,
  value,
  caption,
  valueStyle,
}: {
  label: string;
  value: string;
  caption?: string;
  valueStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View>
      <Text style={[font.caption, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[font.h1, { color: colors.textPrimary, marginTop: 2 }, valueStyle]}>
        {value}
      </Text>
      {caption ? (
        <Text style={[font.caption, { color: colors.textTertiary, marginTop: 4 }]}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

/* ============================================================================
 * Divider
 * ============================================================================ */

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        { height: 1, backgroundColor: colors.borderSubtle, marginVertical: space.md },
        style,
      ]}
    />
  );
}

/* ============================================================================
 * DateField — labeled date input that opens a native DateTimePicker
 * ============================================================================ */

export function DateField({
  label,
  value,
  onChange,
  hint,
  minimumDate,
  maximumDate,
  placeholder = 'Select date',
}: {
  label?: string;
  value: Date | null;
  onChange: (date: Date) => void;
  hint?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (event.type === 'set' && selected) onChange(selected);
      return;
    }
    // iOS inline picker fires onChange continuously as the user picks.
    if (selected) onChange(selected);
  }

  const displayText = value
    ? formatDate(toLocalDateKey(value))
    : placeholder;

  return (
    <View style={{ marginBottom: space.base }}>
      {label ? (
        <Text
          style={[
            font.caption,
            { marginBottom: space.sm, color: colors.textPrimary, fontWeight: '600' },
          ]}
        >
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={() => setOpen((prev) => !prev)}
        accessibilityLabel={label ? `${label}: ${displayText}` : displayText}
        accessibilityRole="button"
        style={({ pressed }) => ({
          minHeight: height.input + 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: radius.button,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bgSubtle,
          paddingHorizontal: space.base,
          opacity: pressed ? 0.86 : 1,
        })}
      >
        <Text
          style={{
            fontSize: 16,
            color: value ? colors.textPrimary : colors.textTertiary,
          }}
        >
          {displayText}
        </Text>
        <IconCalendar size={20} color={colors.textTertiary} strokeWidth={1.7} />
      </Pressable>
      {open ? (
        Platform.OS === 'ios' ? (
          <View
            style={{
              marginTop: space.sm,
              backgroundColor: colors.bgSurface,
              borderRadius: radius.card,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              overflow: 'hidden',
            }}
          >
            <DateTimePicker
              value={value ?? new Date()}
              mode="date"
              display="inline"
              onChange={handleChange}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              accentColor={colors.sage}
              themeVariant="light"
            />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                paddingHorizontal: space.sm,
                paddingVertical: space.xs,
                borderTopWidth: 1,
                borderTopColor: colors.borderSubtle,
              }}
            >
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Done selecting date"
                style={({ pressed }) => ({
                  opacity: pressed ? 0.6 : 1,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                })}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.sage }}>
                  Done
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <DateTimePicker
            value={value ?? new Date()}
            mode="date"
            display="default"
            onChange={handleChange}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
          />
        )
      ) : null}
      {hint ? (
        <Text style={[font.caption, { marginTop: space.sm, color: colors.textTertiary }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Convert a Date to its local-time YYYY-MM-DD key. Avoids the timezone shift
 * caused by `.toISOString().split('T')[0]` for negative-offset locales (e.g.
 * picking "Apr 24" in PST returned "Apr 23" because UTC midnight had
 * already rolled).
 */
function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ============================================================================
 * Picker — iOS-native wheel picker that opens in a floating bottom sheet.
 *
 * Renders a compact field row (label + current value + chevron). Tap →
 * a bottom sheet slides up with the WheelPicker filling its width and a
 * sage Done button to confirm. Drag-to-dismiss the sheet by tapping the
 * backdrop. The wheel commits selections live as the user spins; Done
 * just dismisses.
 *
 * iOS convention: wheels never live inline in a form. They always
 * present modally from the bottom (Calendar, Reminders, Settings).
 * ============================================================================ */

export function Picker<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
}: {
  label?: string;
  value: T | null;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder;
  return (
    <View>
      {label ? (
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            color: colors.textMuted,
            marginBottom: 6,
          }}
        >
          {label}
        </Text>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${selectedLabel}` : selectedLabel}
        style={({ pressed }) => ({
          backgroundColor: colors.bgSurface,
          borderRadius: radius.button,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          paddingHorizontal: space.base,
          height: height.input,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: value ? '600' : '400',
            color: value ? colors.textPrimary : colors.textMuted,
          }}
        >
          {selectedLabel}
        </Text>
        <IconChevronDown size={16} color={colors.textTertiary} strokeWidth={2} />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} />
          <View
            style={{
              backgroundColor: colors.bgSurface,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              paddingBottom: 24,
            }}
          >
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderSubtle, alignSelf: 'center', marginTop: 10, marginBottom: 6 }} />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: space.base,
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: colors.borderSubtle,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>
                {label ?? 'Select'}
              </Text>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Done"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 6 })}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.sage }}>Done</Text>
              </Pressable>
            </View>
            <WheelPicker<T>
              options={options}
              value={value}
              onChange={onChange}
              backgroundColor={colors.bgSurface}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ============================================================================
 * SegmentedControl — iOS-native segmented control (UISegmentedControl analog)
 *
 * Use for 2-3 short, mutually-exclusive options where all choices fit on one
 * row (filter toggles, view modes).
 * ============================================================================ */

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.bgSubtle,
        borderRadius: 11,
        padding: 3,
      }}
    >
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={opt.label}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 7,
              borderRadius: 9,
              backgroundColor: on ? colors.bgSurface : 'transparent',
              ...(on
                ? {
                    shadowColor: '#000',
                    shadowOpacity: 0.06,
                    shadowRadius: 2,
                    shadowOffset: { width: 0, height: 1 },
                  }
                : {}),
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: on ? colors.textPrimary : colors.textMuted,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type { PressableProps };
