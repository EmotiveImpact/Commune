/**
 * Commune Primitives — Light theme, editorial
 *
 * Atomic components that every screen uses.
 * All consume tokens from constants/design.ts — never hardcode.
 */

import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  PressableProps,
  StyleProp,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, elevation, font, height, radius, space } from '@/constants/design';

type IconName = ComponentProps<typeof Ionicons>['name'];

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
  icon?: IconName;
  trailingIcon?: IconName;
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
          {icon && <Ionicons name={icon} size={fs + 3} color={fg} />}
          <Text style={{ fontSize: fs, fontWeight: '600', color: fg }}>{label}</Text>
          {trailingIcon && <Ionicons name={trailingIcon} size={fs + 3} color={fg} />}
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
  icon,
  color = colors.sage,
  bg = colors.sageSoft,
  size = 40,
  iconSize,
}: {
  icon: IconName;
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
      <Ionicons name={icon} size={iconSize ?? Math.round(size * 0.5)} color={color} />
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
  // Lightweight searchfield using TextInput; kept here to avoid TextInput sprawl.
  const { TextInput } = require('react-native');
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
      <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
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
  icon = 'sparkles-outline',
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
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
        <Ionicons name={icon} size={32} color={colors.sage} />
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
  icon = 'add',
  size = height.fab,
  style,
}: {
  onPress?: () => void;
  icon?: IconName;
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
      <Ionicons name={icon} size={26} color={colors.textInverse} />
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

/* Re-export so screens can `import { Pressable } from '@/components/primitives'` */
export { Pressable };
export type { PressableProps };
