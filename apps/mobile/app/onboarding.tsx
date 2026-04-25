import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PagerView from 'react-native-pager-view';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import {
  IconAlertCircle,
  IconAppWindow,
  IconBrandInstagram,
  IconBrandReddit,
  IconBrandTiktok,
  IconBrandYoutube,
  IconBriefcase,
  IconCheck,
  IconChevronLeft,
  IconHeart,
  IconHome2,
  IconPlane,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconSparkles,
  IconUsers,
} from '@tabler/icons-react-native';
import {
  ACQUISITION_SOURCE_OPTIONS,
  type AcquisitionSource,
  createGroupSchema,
  getContextualSellCopy,
  getSpaceEssentialDefinitions,
  getSpacePreset,
  SUBTYPE_OPTIONS_BY_TYPE,
} from '@commune/core';
import { GroupType, type SpaceEssentials } from '@commune/types';
import { Screen, EmptyState, Pressable } from '@/components/primitives';
import { SelectRow } from '@/components/bottom-sheet';
import { colors, radius, space } from '@/constants/design';
import { useGroupStore } from '@/stores/group';
import { useAuthStore } from '@/stores/auth';
import {
  useAcceptInvite,
  useCreateGroup,
  usePendingInvites,
  useUserGroups,
} from '@/hooks/use-groups';
import { useApplyGroupStarterPack } from '@/hooks/use-onboarding';
import { useUpdateProfile } from '@/hooks/use-profile';
import { usePlanLimits } from '@/hooks/use-plan-limits';
import { getErrorMessage } from '@/lib/errors';
import {
  hapticLight,
  hapticMedium,
  hapticSuccess,
  hapticWarning,
} from '@/lib/haptics';

type GroupTypeValue = (typeof GroupType)[keyof typeof GroupType];

type CurrencyOption = { code: string; symbol: string; label: string };

const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
];

/**
 * Best-effort device-locale currency detection — falls back to GBP.
 */
function detectDefaultCurrency(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? 'en-GB';
    const region = locale.split('-')[1]?.toUpperCase();
    const map: Record<string, string> = {
      GB: 'GBP', UK: 'GBP', US: 'USD', CA: 'CAD', AU: 'AUD', JP: 'JPY',
      IN: 'INR', IE: 'EUR', FR: 'EUR', DE: 'EUR', ES: 'EUR', IT: 'EUR',
      NL: 'EUR', PT: 'EUR', BE: 'EUR', AT: 'EUR', FI: 'EUR',
    };
    const match = region ? map[region] : undefined;
    if (match && CURRENCY_OPTIONS.some((o) => o.code === match)) return match;
  } catch {
    // Intl may be unavailable on older runtimes — fall through.
  }
  return 'GBP';
}

type TablerIconComponent = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

/* ---------- Type-tile catalogue (mockup screen 6) ---------- */

const TYPE_OPTIONS: Array<{
  value: GroupTypeValue;
  label: string;
  caption: string;
  icon: TablerIconComponent;
  accent: string;
  bg: string;
}> = [
  {
    value: GroupType.HOME,
    label: 'Flatmates',
    caption: 'Rent, bills, chores. Roll over month-to-month.',
    icon: IconHome2,
    accent: colors.typeHome.accent,
    bg: colors.typeHome.bg,
  },
  {
    value: GroupType.COUPLE,
    label: 'Partners',
    caption: 'Shared life — recurring bills, savings goals.',
    icon: IconHeart,
    accent: colors.typeCouple.accent,
    bg: colors.typeCouple.bg,
  },
  {
    value: GroupType.TRIP,
    label: 'Travel',
    caption: 'Trips with one-off expenses. Auto-archive on close.',
    icon: IconPlane,
    accent: colors.typeTrip.accent,
    bg: colors.typeTrip.bg,
  },
  {
    value: GroupType.PROJECT,
    label: 'Workspace',
    caption: 'Vendors, invoices, approval thresholds.',
    icon: IconBriefcase,
    accent: colors.typeProject.accent,
    bg: colors.typeProject.bg,
  },
];

/* ---------- Acquisition tiles ---------- */

const ACQ_TILE_META: Record<
  AcquisitionSource,
  { icon: TablerIconComponent; bg: string; iconColor: string }
> = {
  tiktok: { icon: IconBrandTiktok, bg: '#1A1E2B', iconColor: '#FFFFFF' },
  instagram: { icon: IconBrandInstagram, bg: '#FFF1F4', iconColor: '#E1306C' },
  search: { icon: IconSearch, bg: '#E8F0FE', iconColor: '#1A73E8' },
  reddit: { icon: IconBrandReddit, bg: '#FFF0E5', iconColor: '#FF4500' },
  friend: { icon: IconUsers, bg: colors.sageSoft, iconColor: colors.sageInk },
  app_store: { icon: IconAppWindow, bg: '#E0E7FF', iconColor: '#4338CA' },
  youtube: { icon: IconBrandYoutube, bg: '#FFE4E4', iconColor: '#FF0000' },
  other: { icon: IconSparkles, bg: colors.bgSubtle, iconColor: colors.textTertiary },
};

/* ---------- Phase machine ----------
 * Pager pages 0–3 = welcome + 3 sell screens. After page 3 → acquisition step.
 * Then sequential steps until celebration.
 */

type Phase =
  | 'pager'
  | 'acquisition'
  | 'type'
  | 'subtype'
  | 'contextual_sell'
  | 'form'
  | 'celebration';

const TOTAL_DOTS = 10;

/** Map (phase, pagerPage) → 0-indexed dot. */
function dotIndexFor(phase: Phase, pagerPage: number): number {
  if (phase === 'pager') return pagerPage; // 0..3
  if (phase === 'acquisition') return 4;
  if (phase === 'type') return 5;
  if (phase === 'subtype') return 6;
  if (phase === 'contextual_sell') return 7;
  if (phase === 'form') return 8;
  return 9; // celebration
}

/* ============================================================================
 * Top nav (Back · Dots · Skip)
 * ============================================================================ */

/**
 * Worm dot — width and opacity are computed on the UI thread from a
 * single continuous shared `progress` value. During pager swipes,
 * `progress` is driven by `onPageScroll` so the worm tracks the user's
 * finger in real time (no lag, no settle delay). Outside the pager
 * phase, `progress` is sprung to the active dot index so the worm
 * still slides smoothly between non-pager steps.
 */
function WormDot({
  index,
  progress,
  tint = colors.textPrimary,
}: {
  index: number;
  progress: SharedValue<number>;
  tint?: string;
}) {
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(index - progress.value);
    const width = interpolate(distance, [0, 1, 2], [18, 8, 4], 'clamp');
    const opacity = interpolate(distance, [0, 1, 2], [1, 0.55, 0.3], 'clamp');
    return { width, opacity };
  });
  return (
    <Animated.View
      style={[
        {
          height: 4,
          borderRadius: 3,
          backgroundColor: tint,
        },
        style,
      ]}
    />
  );
}

function TopNav({
  topInset,
  showBack,
  showSkip,
  skipLabel,
  progress,
  onBack,
  onSkip,
  tint = colors.textPrimary,
}: {
  topInset: number;
  showBack: boolean;
  showSkip: boolean;
  skipLabel: string;
  /** Continuous 0..N-1 value driving the worm. Updated by PagerView's
   *  onPageScroll during the sell phase, sprung to dotIndex elsewhere. */
  progress: SharedValue<number>;
  onBack: () => void;
  onSkip: () => void;
  /** Override colour when the topnav floats over a dark image. */
  tint?: string;
}) {
  // Fixed-height row with always-rendered Back/Skip slots — when hidden,
  // we use opacity:0 + pointerEvents:none so the layout stays rock-solid
  // (no jump when transitioning between pages).
  return (
    <View
      style={{
        paddingTop: topInset + 8,
        paddingBottom: 8,
        paddingHorizontal: space.gutter,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: topInset + 48,
      }}
    >
      {/* Back slot — always 80 wide, always 32 tall, hidden when not active */}
      <View style={{ width: 80, height: 32, justifyContent: 'center' }}>
        <Pressable
          hitSlop={10}
          onPress={() => {
            if (!showBack) return;
            hapticLight();
            onBack();
          }}
          accessibilityRole="button"
          accessibilityLabel="Back"
          accessibilityElementsHidden={!showBack}
          importantForAccessibility={showBack ? 'yes' : 'no-hide-descendants'}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            height: 32,
            paddingHorizontal: 4,
            marginLeft: -4,
            opacity: !showBack ? 0 : pressed ? 0.6 : 1,
          })}
          pointerEvents={showBack ? 'auto' : 'none'}
        >
          <IconChevronLeft size={22} color={tint} strokeWidth={2} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: tint }}>
            Back
          </Text>
        </Pressable>
      </View>

      {/* Worm-pagination dots — driven by a shared progress value */}
      <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
        {Array.from({ length: TOTAL_DOTS }, (_, i) => (
          <WormDot key={i} index={i} progress={progress} tint={tint} />
        ))}
      </View>

      {/* Skip slot — same fixed dimensions */}
      <View style={{ width: 80, height: 32, alignItems: 'flex-end', justifyContent: 'center' }}>
        <Pressable
          hitSlop={10}
          onPress={() => {
            if (!showSkip) return;
            hapticLight();
            onSkip();
          }}
          accessibilityRole="button"
          accessibilityLabel={skipLabel}
          accessibilityElementsHidden={!showSkip}
          importantForAccessibility={showSkip ? 'yes' : 'no-hide-descendants'}
          style={({ pressed }) => ({
            height: 32,
            paddingHorizontal: 4,
            justifyContent: 'center',
            opacity: !showSkip ? 0 : pressed ? 0.6 : 1,
          })}
          pointerEvents={showSkip ? 'auto' : 'none'}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: tint }}>
            {skipLabel}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ============================================================================
 * Bottom CTA bar (pinned)
 * ============================================================================ */

function CtaBar({
  bottomInset,
  label,
  onPress,
  disabled,
  loading,
  variant = 'ink',
}: {
  bottomInset: number;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'ink' | 'sage';
}) {
  const bg = disabled ? colors.border : variant === 'sage' ? colors.sage : colors.bgInk;
  return (
    <View
      style={{
        paddingHorizontal: space.gutter,
        paddingTop: 12,
        paddingBottom: bottomInset > 0 ? bottomInset : 22,
        backgroundColor: colors.bgBase,
        borderTopWidth: variant === 'sage' ? 0 : 1,
        borderTopColor: colors.borderSubtle,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.85}
        style={{
          backgroundColor: bg,
          height: 52,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
        }}
      >
        {loading ? (
          <ActivityIndicator color={colors.textInverse} style={{ marginRight: 8 }} />
        ) : null}
        <Text
          style={{
            color: disabled ? colors.textMuted : colors.textInverse,
            fontSize: 15,
            fontWeight: '700',
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/* ============================================================================
 * Sell page (1–4) — full-bleed image hero + bigger typography
 *
 * Replaces the previous SVG/floating-card heroes with a real image. Image
 * takes the top half-ish of the screen, headline + sub fill a fixed band
 * underneath, bullets fill the remaining space (no awkward empty gap above
 * the CTA). Image URLs are Unsplash placeholders — see designs/onboarding.md
 * for AI-gen prompts and the bundled-asset migration path.
 * ============================================================================ */

const SELL_IMAGES = {
  welcome: 'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=900&fit=crop&q=80',
  split: 'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=900&fit=crop&q=80',
  settle: 'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=900&fit=crop&q=80',
  see: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=900&fit=crop&q=80',
} as const;

const SELL_TINT: Record<keyof typeof SELL_IMAGES, string> = {
  welcome: '#FFE8D8',
  split: '#D4F1E5',
  settle: '#EAE0FA',
  see: '#E8F3EC',
};

function SellPage({
  imageKey,
  headline,
  sub,
  bullets,
  topInset,
}: {
  imageKey: keyof typeof SELL_IMAGES;
  headline: string;
  sub: string;
  bullets: string[];
  /** Top safe-area inset so the image bleeds under it but the gradient
   *  scrim restores TopNav contrast. */
  topInset: number;
}) {
  return (
    <View style={{ flex: 1 }}>
      {/* Edge-to-edge hero image — bleeds full-width, top edge under the
          TopNav. Bottom edge is FLAT (no radius) and fades into the page
          background via a soft gradient so the seam disappears. Tinted
          backdrop covers the area while the image loads. */}
      <View
        style={{
          width: '100%',
          height: '52%',
          backgroundColor: SELL_TINT[imageKey],
          overflow: 'hidden',
        }}
      >
        <Image
          source={{ uri: SELL_IMAGES[imageKey] }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
        {/* Top scrim — soft fade so TopNav stays legible over photography. */}
        <LinearGradient
          colors={['rgba(0,0,0,0.28)', 'rgba(0,0,0,0)']}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: topInset + 80,
          }}
          pointerEvents="none"
        />
        {/* Bottom fade — image dissolves into the page bg colour so the
            transition to the copy block has no visible seam. */}
        <LinearGradient
          colors={['rgba(250,249,247,0)', 'rgba(250,249,247,1)']}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 110,
          }}
          pointerEvents="none"
        />
      </View>

      {/* Copy block — bigger, more confident type. Sits in the lower
          ~48% of the page, above the pinned CtaBar. */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: space.gutter,
          paddingTop: 26,
          paddingBottom: 8,
          justifyContent: 'flex-start',
        }}
      >
        <Text
          style={{
            fontSize: 36,
            fontWeight: '700',
            letterSpacing: -0.9,
            lineHeight: 40,
            color: colors.textPrimary,
            marginBottom: 12,
          }}
        >
          {headline}
        </Text>
        <Text
          style={{
            fontSize: 18,
            lineHeight: 25,
            color: colors.textSecondary,
            marginBottom: 18,
          }}
        >
          {sub}
        </Text>
        <View style={{ gap: 2 }}>
          {bullets.map((b) => (
            <Bullet key={b} text={b} />
          ))}
        </View>
      </View>
    </View>
  );
}

function WelcomePage({ firstName, topInset }: { firstName: string; topInset: number }) {
  return (
    <SellPage
      imageKey="welcome"
      topInset={topInset}
      headline={`Welcome,\n${firstName} 👋`}
      sub="Let's set up your first group. Takes about a minute — and you can change anything later."
      bullets={[
        'Free for up to 3 groups',
        "You're already signed in — let's go",
      ]}
    />
  );
}

function SellSplitPage({ topInset }: { topInset: number }) {
  return (
    <SellPage
      imageKey="split"
      topInset={topInset}
      headline="Split anything fairly."
      sub="Equal, percentages, fixed amounts, or one person paid. Commune does the maths."
      bullets={[
        'No more "what did I owe again?"',
        'Receipts, vendor + invoice when you need it',
        'Recurring bills auto-split every month',
      ]}
    />
  );
}

function SellSettlePage({ topInset }: { topInset: number }) {
  return (
    <SellPage
      imageKey="settle"
      topInset={topInset}
      headline="Settle in one tap."
      sub="Pay through Revolut, Monzo, PayPal, Venmo — directly from the app. Commune never holds your money."
      bullets={[
        'Smart-suggest minimises payments',
        'Free P2P on most rails',
        'Mark-as-paid for offline transfers too',
      ]}
    />
  );
}

function SellEverythingPage({ topInset }: { topInset: number }) {
  return (
    <SellPage
      imageKey="see"
      topInset={topInset}
      headline="See everything in one place."
      sub="Recurring bills, who owes whom, monthly rhythm, analytics — all in one calm dashboard."
      bullets={[
        'Spending breakdown by category',
        'Cycle close, archive, restore',
        'Workspace mode for vendors + invoices',
      ]}
    />
  );
}

/* ============================================================================
 * Legacy hero helpers — retained for any non-sell-page reuse but no longer
 * referenced by the four sell pages. Safe to remove if nothing else uses them.
 * ============================================================================ */

function SellHero({
  variant,
  children,
}: {
  variant: 'peach' | 'mint' | 'plum' | 'sage';
  children?: React.ReactNode;
}) {
  const palettes = {
    peach: ['#FFE8D8', '#F8C9A8'] as [string, string],
    mint: ['#D4F1E5', '#9ED9BD'] as [string, string],
    plum: ['#EAE0FA', '#C4ACE9'] as [string, string],
    sage: ['#E8F3EC', '#A6CDB1'] as [string, string],
  };
  return (
    <View
      style={{
        aspectRatio: 1.2,
        borderRadius: 24,
        overflow: 'hidden',
        marginBottom: 16,
        marginTop: 8,
      }}
    >
      <LinearGradient
        colors={palettes[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        {children}
      </LinearGradient>
    </View>
  );
}

function FloatingIcon({
  Icon,
  iconColor,
  style,
  size = 48,
}: {
  Icon: TablerIconComponent;
  iconColor: string;
  style: object;
  size?: number;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#1A1E2B',
        shadowOpacity: 0.12,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
        ...style,
      }}
    >
      <Icon size={Math.round(size * 0.46)} color={iconColor} strokeWidth={1.7} />
    </View>
  );
}

function ProductCard({
  style,
  children,
  width,
}: {
  style?: object;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        shadowColor: '#1A1E2B',
        shadowOpacity: 0.18,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
        elevation: 6,
        ...(width ? { width } : {}),
        ...style,
      }}
    >
      {children}
    </View>
  );
}

/* ============================================================================
 * Bullet point (sell pages)
 * ============================================================================ */

function Bullet({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, alignItems: 'flex-start' }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          backgroundColor: colors.sageSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconCheck size={14} color={colors.sageInk} strokeWidth={1.7} />
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          fontWeight: '500',
          lineHeight: 18,
          color: colors.textPrimary,
        }}
      >
        {text}
      </Text>
    </View>
  );
}


/* ============================================================================
 * Acquisition tile
 * ============================================================================ */

function AcqTile({
  option,
  selected,
  onPress,
}: {
  option: { value: AcquisitionSource; label: string };
  selected: boolean;
  onPress: () => void;
}) {
  const meta = ACQ_TILE_META[option.value];
  const Icon = meta.icon;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flex: 1,
        flexBasis: '48%',
        backgroundColor: colors.bgSurface,
        borderRadius: 14,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.sage : colors.borderSubtle,
        paddingHorizontal: selected ? 11 : 12,
        paddingVertical: selected ? 13 : 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: meta.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={16} color={meta.iconColor} strokeWidth={1.7} />
      </View>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>
        {option.label}
      </Text>
    </TouchableOpacity>
  );
}

/* ============================================================================
 * Type / subtype tiles
 * ============================================================================ */

function TypeTile({
  option,
  selected,
  onPress,
}: {
  option: (typeof TYPE_OPTIONS)[number];
  selected: boolean;
  onPress: () => void;
}) {
  const Icon = option.icon;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        marginBottom: 8,
        backgroundColor: colors.bgSurface,
        borderRadius: 16,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.sage : colors.borderSubtle,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 14,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: option.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={22} color={option.accent} strokeWidth={1.7} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
          {option.label}
        </Text>
        <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textTertiary, marginTop: 2 }}>
          {option.caption}
        </Text>
      </View>
      {selected ? (
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: colors.sage,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconCheck size={14} color="#FFFFFF" strokeWidth={2.5} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function SubtypeTile({
  label,
  caption,
  bg,
  accent,
  Icon,
  selected,
  onPress,
}: {
  label: string;
  caption: string;
  bg: string;
  accent: string;
  Icon: TablerIconComponent;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        marginBottom: 8,
        backgroundColor: colors.bgSurface,
        borderRadius: 16,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.sage : colors.borderSubtle,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 11,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={18} color={accent} strokeWidth={1.7} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
          {label}
        </Text>
        <Text style={{ fontSize: 12, lineHeight: 16, color: colors.textTertiary, marginTop: 2 }}>
          {caption}
        </Text>
      </View>
      {selected ? (
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: colors.sage,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconCheck size={11} color="#FFFFFF" strokeWidth={2.5} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/* ============================================================================
 * Celebration confetti + checkmark
 * ============================================================================ */

const CONFETTI_PALETTE = [
  colors.sage,
  '#8C4F2F',
  '#7A5C00',
  colors.sageMid,
  colors.typeCouple.accent,
  colors.typeTrip.accent,
  colors.sage,
  '#6B3FA0',
  '#8C4F2F',
];

function ConfettiPiece({
  index,
  endY,
  color,
  startLeft,
  rotation,
}: {
  index: number;
  endY: number;
  color: string;
  startLeft: string;
  rotation: number;
}) {
  const translateY = useSharedValue(-60);
  const rotate = useSharedValue(rotation);

  useEffect(() => {
    const delay = index * 60;
    translateY.value = withDelay(
      delay,
      withTiming(endY, { duration: 1400, easing: Easing.out(Easing.quad) }),
    );
    rotate.value = withDelay(
      delay,
      withTiming(rotation + 360, { duration: 1400, easing: Easing.linear }),
    );
  }, [endY, index, rotation, rotate, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: startLeft as `${number}%`,
          top: 0,
          width: 8,
          height: 14,
          borderRadius: 2,
          backgroundColor: color,
          opacity: 0.85,
        },
        animStyle,
      ]}
    />
  );
}

function CelebrationContent({
  firstName,
  groupName,
}: {
  firstName: string;
  groupName: string;
}) {
  const scale = useSharedValue(0.4);
  const fade = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 8, stiffness: 120 });
    fade.value = withDelay(200, withTiming(1, { duration: 320 }));
  }, [fade, scale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
  }));

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 }}>
      <Animated.View
        style={[
          {
            width: 120,
            height: 120,
            borderRadius: 60,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            shadowColor: colors.sage,
            shadowOpacity: 0.35,
            shadowRadius: 40,
            shadowOffset: { width: 0, height: 16 },
          },
          iconStyle,
        ]}
      >
        <LinearGradient
          colors={[colors.sage, '#3FA08D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 60,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconCheck size={60} color="#FFFFFF" strokeWidth={2.5} />
        </LinearGradient>
      </Animated.View>

      <Animated.View style={fadeStyle}>
        <Text
          style={{
            fontSize: 32,
            fontWeight: '700',
            letterSpacing: -0.7,
            lineHeight: 36,
            textAlign: 'center',
            color: colors.textPrimary,
            marginBottom: 10,
          }}
        >
          You're all set,{'\n'}
          {firstName}.
        </Text>
        <Text
          style={{
            fontSize: 14.5,
            color: colors.textTertiary,
            textAlign: 'center',
            lineHeight: 22,
            marginBottom: 26,
            maxWidth: 300,
            alignSelf: 'center',
          }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{groupName}</Text>{' '}
          is ready. Let's add your first expense — rent, groceries, anything you've already paid
          for.
        </Text>

        <View
          style={{
            backgroundColor: colors.bgSurface,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            borderRadius: 16,
            padding: 14,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            width: '100%',
            maxWidth: 300,
            alignSelf: 'center',
            shadowColor: '#1A1E2B',
            shadowOpacity: 0.06,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 4 },
            elevation: 2,
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: colors.sageSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconPlus size={20} color={colors.sageInk} strokeWidth={1.7} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
              Add your first expense
            </Text>
            <Text style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 2 }}>
              ~30 seconds · the most important step
            </Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function CelebrationBackdrop({ children, screenHeight }: { children: React.ReactNode; screenHeight: number }) {
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['#FFF8EE', '#F4F0E7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {/* Confetti */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
        {[
          { left: '10%', rotation: 15, color: CONFETTI_PALETTE[0]! },
          { left: '88%', rotation: -22, color: CONFETTI_PALETTE[1]! },
          { left: '24%', rotation: 45, color: CONFETTI_PALETTE[2]! },
          { left: '74%', rotation: -12, color: CONFETTI_PALETTE[3]! },
          { left: '14%', rotation: 28, color: CONFETTI_PALETTE[4]! },
          { left: '80%', rotation: -40, color: CONFETTI_PALETTE[5]! },
          { left: '50%', rotation: 8, color: CONFETTI_PALETTE[6]! },
          { left: '60%', rotation: -30, color: CONFETTI_PALETTE[7]! },
          { left: '38%', rotation: 60, color: CONFETTI_PALETTE[8]! },
        ].map((c, i) => (
          <ConfettiPiece
            key={i}
            index={i}
            endY={screenHeight + 20}
            color={c.color}
            startLeft={c.left}
            rotation={c.rotation}
          />
        ))}
      </View>
      {children}
    </View>
  );
}

/* ============================================================================
 * Main onboarding screen
 * ============================================================================ */

export default function OnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ preview?: string }>();
  const isPreview = params.preview === 'true';
  const insets = useSafeAreaInsets();

  const { user } = useAuthStore();
  const firstName = (user?.first_name?.trim() || 'there').split(' ')[0] ?? 'there';

  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { canCreateGroup, groupLimit, currentGroups } = usePlanLimits(user?.id ?? '');
  const {
    data: groups,
    isLoading: groupsLoading,
    error: groupsError,
    refetch: refetchGroups,
  } = useUserGroups();
  const {
    data: pendingInvites,
    isLoading: invitesLoading,
    error: invitesError,
    refetch: refetchInvites,
  } = usePendingInvites();
  const createGroup = useCreateGroup();
  const acceptInvite = useAcceptInvite();
  const updateProfile = useUpdateProfile();

  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [phase, setPhase] = useState<Phase>('pager');
  const [pagerPage, setPagerPage] = useState(0);
  const pagerRef = useRef<PagerView>(null);
  // Continuous worm-progress shared value. Updated synchronously by
  // PagerView.onPageScroll while in the sell phase, sprung to dotIndex
  // for stacked phases.
  const pagerProgress = useSharedValue(0);

  const [acquisition, setAcquisition] = useState<AcquisitionSource | null>(null);
  const [type, setType] = useState<GroupTypeValue | null>(null);
  const [subtype, setSubtype] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<string>(() => detectDefaultCurrency());
  const [includeStarterPack, setIncludeStarterPack] = useState<boolean>(true);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [createdGroupName, setCreatedGroupName] = useState<string>('');

  const applyStarterPack = useApplyGroupStarterPack(createdGroupId ?? '');

  const subtypeOptions = useMemo(
    () => (type ? SUBTYPE_OPTIONS_BY_TYPE[type] ?? [] : []),
    [type],
  );

  const resolvedGroupId = useMemo(() => {
    if (activeGroupId && groups?.some((g) => g.id === activeGroupId)) return activeGroupId;
    return groups?.[0]?.id ?? null;
  }, [activeGroupId, groups]);

  // Auto-redirect: user already has a group, no preview, no created flow active.
  useEffect(() => {
    if (isPreview) {
      setShowCreateFlow(true);
      return;
    }
    if (groupsLoading || invitesLoading || groupsError || invitesError) return;
    if (createdGroupId) return;
    if (resolvedGroupId) {
      if (resolvedGroupId !== activeGroupId) setActiveGroupId(resolvedGroupId);
      router.replace('/(tabs)');
      return;
    }
    if ((pendingInvites?.length ?? 0) === 0) {
      setShowCreateFlow(true);
    }
  }, [
    isPreview,
    activeGroupId,
    createdGroupId,
    groupsError,
    groupsLoading,
    invitesError,
    invitesLoading,
    pendingInvites?.length,
    resolvedGroupId,
    router,
    setActiveGroupId,
  ]);

  /* ---------- Navigation helpers ---------- */

  function goToPagerPage(p: number) {
    setPhase('pager');
    setPagerPage(p);
    requestAnimationFrame(() => pagerRef.current?.setPage(p));
  }

  function handleBack() {
    if (phase === 'pager') {
      if (pagerPage > 0) {
        const next = pagerPage - 1;
        setPagerPage(next);
        pagerRef.current?.setPage(next);
      }
      return;
    }
    if (phase === 'acquisition') {
      goToPagerPage(3);
      return;
    }
    if (phase === 'type') {
      setPhase('acquisition');
      return;
    }
    if (phase === 'subtype') {
      setPhase('type');
      return;
    }
    if (phase === 'contextual_sell') {
      // Subtype may have been auto-skipped if empty.
      setPhase(subtypeOptions.length > 0 ? 'subtype' : 'type');
      return;
    }
    if (phase === 'form') {
      setPhase('contextual_sell');
      return;
    }
  }

  function handleSkip() {
    // Skip on screens 1–4 (pager): jump to acquisition (step 5).
    if (phase === 'pager') {
      setPhase('acquisition');
      return;
    }
    // Skip on screen 5 (acquisition): jump straight to step 9 (form).
    if (phase === 'acquisition') {
      setPhase('form');
      return;
    }
    // Skip on screen 8 (contextual sell): jump to step 9 (form).
    if (phase === 'contextual_sell') {
      setPhase('form');
      return;
    }
  }

  /* ---------- Mutations ---------- */

  async function handleAcquisitionContinue() {
    hapticLight();
    if (acquisition && user?.id) {
      try {
        await updateProfile.mutateAsync({
          userId: user.id,
          data: { acquisition_source: acquisition },
        });
      } catch {
        // Non-blocking — analytics-only field. Keep onboarding flowing.
      }
    }
    setPhase('type');
  }

  function handleTypeContinue() {
    if (!type) return;
    hapticLight();
    const nextSubtypes = SUBTYPE_OPTIONS_BY_TYPE[type] ?? [];
    if (nextSubtypes.length === 0) {
      setSubtype(null);
      setPhase('contextual_sell');
    } else {
      setPhase('subtype');
    }
  }

  function handleSubtypeContinue() {
    hapticLight();
    setPhase('contextual_sell');
  }

  function handleContextualSellContinue() {
    hapticLight();
    setPhase('form');
  }

  async function handleCreateGroup() {
    hapticMedium();

    if (!canCreateGroup) {
      hapticWarning();
      Alert.alert(
        'Group limit reached',
        `You've reached the group limit for your plan (${currentGroups}/${groupLimit === Infinity ? 'unlimited' : groupLimit}). Upgrade to create more groups.`,
      );
      return;
    }

    const trimmedName = name.trim();
    const result = createGroupSchema.safeParse({
      name: trimmedName,
      type: type ?? GroupType.OTHER,
      subtype: subtype ?? null,
      currency,
      cycle_date: 1,
    });
    if (!result.success) {
      hapticWarning();
      Alert.alert(
        'Check your details',
        result.error.issues[0]?.message ?? 'Group details are invalid.',
      );
      return;
    }

    try {
      const group = await createGroup.mutateAsync(result.data);
      hapticSuccess();
      setCreatedGroupId(group.id);
      setCreatedGroupName(group.name);
      setActiveGroupId(group.id);

      if (includeStarterPack) {
        try {
          const groupType = result.data.type as GroupTypeValue;
          const groupSubtype = result.data.subtype ?? null;
          const defs = getSpaceEssentialDefinitions(groupType);
          const preset = getSpacePreset(groupType, groupSubtype);
          const spaceEssentials = defs.reduce<SpaceEssentials>((acc, def) => {
            const seed = preset.essentialSeeds[def.key]?.trim();
            if (seed) {
              acc[def.key] = {
                label: def.label,
                value: seed,
                visible: def.defaultVisible !== false,
              };
            }
            return acc;
          }, {});

          await applyStarterPack.mutateAsync({
            groupType,
            subtype: groupSubtype,
            includeStarterOperations: true,
            spaceEssentials,
          });
        } catch {
          // Starter-pack failure is non-blocking — group still created.
        }
      }

      setPhase('celebration');
    } catch (error) {
      hapticWarning();
      Alert.alert('Could not create group', getErrorMessage(error));
    }
  }

  function handleOpenCommune() {
    hapticMedium();
    router.replace('/(tabs)');
  }

  async function handleAcceptInvite(groupId: string) {
    hapticMedium();
    try {
      await acceptInvite.mutateAsync(groupId);
      hapticSuccess();
      setActiveGroupId(groupId);
      router.replace('/(tabs)');
    } catch (error) {
      hapticWarning();
      Alert.alert('Could not join group', getErrorMessage(error));
    }
  }

  /* ---------- Loading / error / pending-invite gates ---------- */

  if (groupsLoading || invitesLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen>
          <View
            style={{ paddingTop: insets.top + 8, paddingHorizontal: space.gutter, paddingBottom: 8 }}
          />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.textTertiary, fontSize: 14 }}>Loading…</Text>
          </View>
        </Screen>
      </>
    );
  }

  const loadError = groupsError ?? invitesError;
  if (loadError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen>
          <ScrollView
            contentContainerStyle={{
              paddingTop: insets.top + 12,
              paddingBottom: 120,
              paddingHorizontal: space.gutter,
            }}
          >
            <EmptyState
              icon={IconAlertCircle}
              title="Setup unavailable"
              description={getErrorMessage(loadError, 'Could not load your group setup right now.')}
              actionLabel="Try again"
              onAction={() => {
                hapticLight();
                void refetchGroups();
                void refetchInvites();
              }}
            />
          </ScrollView>
        </Screen>
      </>
    );
  }

  if ((pendingInvites?.length ?? 0) > 0 && !showCreateFlow && !createdGroupId) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <Screen>
          <ScrollView
            contentContainerStyle={{
              paddingTop: insets.top + 12,
              paddingBottom: 120,
              paddingHorizontal: space.gutter,
            }}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={{
                fontSize: 24,
                fontWeight: '700',
                letterSpacing: -0.5,
                color: colors.textPrimary,
                marginBottom: 8,
                marginTop: 16,
              }}
            >
              You have an invite waiting
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 22, color: colors.textTertiary, marginBottom: 18 }}>
              Join the right shared space instead of starting from scratch.
            </Text>

            {(pendingInvites ?? []).map((invite) => (
              <View
                key={invite.id}
                style={{
                  backgroundColor: colors.bgSurface,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: colors.borderSubtle,
                  padding: space.base,
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: colors.sageSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconUsers size={20} color={colors.sage} strokeWidth={1.7} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                      {invite.group.name}
                    </Text>
                    <Text style={{ fontSize: 12, lineHeight: 18, color: colors.textTertiary, marginTop: 2 }}>
                      {invite.group.type} group
                      {invite.group.description ? ` · ${invite.group.description}` : ''}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => handleAcceptInvite(invite.group_id)}
                  activeOpacity={0.85}
                  style={{
                    marginTop: space.md,
                    backgroundColor: colors.bgInk,
                    height: 52,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.textInverse, fontSize: 15, fontWeight: '700' }}>
                    Accept invite
                  </Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setShowCreateFlow(true);
              }}
              activeOpacity={0.85}
              style={{
                marginTop: space.sm,
                backgroundColor: colors.bgSurface,
                height: 52,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700' }}>
                Create a different group
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Screen>
      </>
    );
  }

  /* ---------- Top-nav state per phase ---------- */

  const dotIndex = dotIndexFor(phase, pagerPage);
  // Back hidden on welcome (page 0) and celebration.
  const showBack = !(phase === 'pager' && pagerPage === 0) && phase !== 'celebration';

  // For non-pager phases, animate the worm to the new dot index. The
  // pager phase drives the value continuously via onPageScroll below.
  useEffect(() => {
    if (phase === 'pager') return;
    pagerProgress.value = withSpring(dotIndex, { damping: 18, stiffness: 220 });
  }, [phase, dotIndex, pagerProgress]);

  // Skip rules:
  // - pager (1–4): "Skip tour"
  // - acquisition (5): "Skip"
  // - type (6): hidden
  // - subtype (7): hidden
  // - contextual_sell (8): "Skip"
  // - form (9): hidden
  // - celebration (10): hidden
  let skipLabel = '';
  let showSkip = false;
  if (phase === 'pager') {
    showSkip = true;
    skipLabel = 'Skip tour';
  } else if (phase === 'acquisition' || phase === 'contextual_sell') {
    showSkip = true;
    skipLabel = 'Skip';
  }

  /* ---------- CTA per phase ---------- */

  const typeMeta = useMemo(
    () => TYPE_OPTIONS.find((o) => o.value === type) ?? null,
    [type],
  );
  const ctxCopy = useMemo(
    () => (type ? getContextualSellCopy(type, subtype) : null),
    [type, subtype],
  );

  let ctaLabel = 'Continue';
  let ctaDisabled = false;
  let ctaLoading = false;
  let ctaVariant: 'ink' | 'sage' = 'ink';
  let ctaOnPress: () => void = () => {};

  if (phase === 'pager') {
    ctaLabel = 'Continue';
    ctaOnPress = () => {
      if (pagerPage < 3) {
        const next = pagerPage + 1;
        setPagerPage(next);
        pagerRef.current?.setPage(next);
      } else {
        setPhase('acquisition');
      }
    };
  } else if (phase === 'acquisition') {
    ctaLabel = 'Continue';
    ctaLoading = updateProfile.isPending;
    ctaOnPress = handleAcquisitionContinue;
  } else if (phase === 'type') {
    ctaLabel = 'Continue';
    ctaDisabled = !type;
    ctaOnPress = handleTypeContinue;
  } else if (phase === 'subtype') {
    ctaLabel = 'Continue';
    ctaDisabled = !subtype;
    ctaOnPress = handleSubtypeContinue;
  } else if (phase === 'contextual_sell') {
    ctaLabel = 'Sounds good — set it up';
    ctaVariant = 'sage';
    ctaOnPress = handleContextualSellContinue;
  } else if (phase === 'form') {
    ctaLabel = createGroup.isPending ? 'Creating…' : 'Create group';
    ctaDisabled = !name.trim() || createGroup.isPending || !canCreateGroup;
    ctaLoading = createGroup.isPending;
    ctaOnPress = handleCreateGroup;
  } else {
    // celebration
    ctaLabel = 'Open Commune';
    ctaVariant = 'sage';
    ctaOnPress = handleOpenCommune;
  }

  /* ---------- Render ---------- */

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {phase === 'celebration' ? (
        <Screen>
          <CelebrationBackdrop screenHeight={900}>
            <TopNav
              topInset={insets.top}
              showBack={false}
              showSkip={false}
              skipLabel=""
              progress={pagerProgress}
              onBack={() => {}}
              onSkip={() => {}}
            />
            <CelebrationContent firstName={firstName} groupName={createdGroupName || name.trim() || 'Your group'} />
            <View
              style={{
                paddingHorizontal: space.gutter,
                paddingTop: 12,
                paddingBottom: insets.bottom > 0 ? insets.bottom : 22,
              }}
            >
              <TouchableOpacity
                onPress={handleOpenCommune}
                activeOpacity={0.85}
                style={{
                  backgroundColor: colors.sage,
                  height: 52,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: colors.textInverse, fontSize: 15, fontWeight: '700' }}>
                  Open Commune
                </Text>
              </TouchableOpacity>
            </View>
          </CelebrationBackdrop>
        </Screen>
      ) : (
        <Screen>
          {/* TopNav: floats absolute over the bleeding image during the
              pager phase, sits in normal flow for stacked phases. White
              tint over images keeps Back/Skip readable on photography. */}
          {phase === 'pager' ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 10,
              }}
              pointerEvents="box-none"
            >
              <TopNav
                topInset={insets.top}
                showBack={showBack}
                showSkip={showSkip}
                skipLabel={skipLabel}
                progress={pagerProgress}
                onBack={handleBack}
                onSkip={handleSkip}
                tint="#FFFFFF"
              />
            </View>
          ) : (
            <TopNav
              topInset={insets.top}
              showBack={showBack}
              showSkip={showSkip}
              skipLabel={skipLabel}
              progress={pagerProgress}
              onBack={handleBack}
              onSkip={handleSkip}
            />
          )}

          {/* Sell pager (screens 1–4) — image bleeds under absolute TopNav */}
          {phase === 'pager' ? (
            <PagerView
              ref={pagerRef}
              style={{ flex: 1 }}
              initialPage={0}
              onPageSelected={(e) => setPagerPage(e.nativeEvent.position)}
              onPageScroll={(e) => {
                // Drive the worm in real time. position is the integer
                // current page; offset is 0..1 progress to position+1.
                pagerProgress.value = e.nativeEvent.position + e.nativeEvent.offset;
              }}
            >
              <View key="welcome" style={{ flex: 1 }}>
                <WelcomePage firstName={firstName} topInset={insets.top} />
              </View>
              <View key="split" style={{ flex: 1 }}>
                <SellSplitPage topInset={insets.top} />
              </View>
              <View key="settle" style={{ flex: 1 }}>
                <SellSettlePage topInset={insets.top} />
              </View>
              <View key="see" style={{ flex: 1 }}>
                <SellEverythingPage topInset={insets.top} />
              </View>
            </PagerView>
          ) : null}

          {/* Acquisition */}
          {phase === 'acquisition' ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: space.gutter,
                paddingTop: space.base,
                paddingBottom: space.xl,
              }}
              showsVerticalScrollIndicator={false}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '700',
                  letterSpacing: -0.5,
                  lineHeight: 28,
                  color: colors.textPrimary,
                  marginBottom: 8,
                }}
              >
                Where did you hear about us?
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 22, color: colors.textTertiary, marginBottom: 14 }}>
                Helps us know what's working. Pick one — or skip.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {ACQUISITION_SOURCE_OPTIONS.map((opt) => (
                  <AcqTile
                    key={opt.value}
                    option={opt}
                    selected={acquisition === opt.value}
                    onPress={() => {
                      hapticLight();
                      setAcquisition(opt.value);
                    }}
                  />
                ))}
              </View>
            </ScrollView>
          ) : null}

          {/* Type */}
          {phase === 'type' ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: space.gutter,
                paddingTop: space.base,
                paddingBottom: space.xl,
              }}
              showsVerticalScrollIndicator={false}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '700',
                  letterSpacing: -0.5,
                  lineHeight: 28,
                  color: colors.textPrimary,
                  marginBottom: 8,
                }}
              >
                What kind of group?
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 22, color: colors.textTertiary, marginBottom: 14 }}>
                We'll set up suggested categories so you can hit the ground running.
              </Text>
              {TYPE_OPTIONS.map((opt) => (
                <TypeTile
                  key={opt.value}
                  option={opt}
                  selected={type === opt.value}
                  onPress={() => {
                    hapticLight();
                    setType(opt.value);
                    setSubtype(null);
                  }}
                />
              ))}
              {!canCreateGroup ? (
                <View
                  style={{
                    backgroundColor: colors.warnBg,
                    borderRadius: radius.card,
                    padding: space.base,
                    marginTop: space.sm,
                  }}
                >
                  <Text style={{ fontSize: 13, lineHeight: 20, color: colors.warnText }}>
                    You've reached the group limit for your plan ({currentGroups}/
                    {groupLimit === Infinity ? 'unlimited' : groupLimit}). Upgrade to create more.
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          ) : null}

          {/* Subtype */}
          {phase === 'subtype' && type ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: space.gutter,
                paddingTop: space.base,
                paddingBottom: space.xl,
              }}
              showsVerticalScrollIndicator={false}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '700',
                  letterSpacing: -0.5,
                  lineHeight: 28,
                  color: colors.textPrimary,
                  marginBottom: 8,
                }}
              >
                A bit more about your {(typeMeta?.label ?? 'group').toLowerCase()} group
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 22, color: colors.textTertiary, marginBottom: 14 }}>
                We'll tune categories and starter pack to match.
              </Text>
              {subtypeOptions.map((opt) => (
                <SubtypeTile
                  key={opt.value}
                  label={opt.label}
                  caption={opt.caption}
                  bg={typeMeta?.bg ?? colors.bgSubtle}
                  accent={typeMeta?.accent ?? colors.textTertiary}
                  Icon={typeMeta?.icon ?? IconHome2}
                  selected={subtype === opt.value}
                  onPress={() => {
                    hapticLight();
                    setSubtype(opt.value);
                  }}
                />
              ))}
            </ScrollView>
          ) : null}

          {/* Contextual sell */}
          {phase === 'contextual_sell' && ctxCopy ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: space.gutter,
                paddingTop: space.base,
                paddingBottom: space.xl,
              }}
              showsVerticalScrollIndicator={false}
            >
              <View
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: typeMeta?.bg ?? colors.sageSoft,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  marginBottom: 14,
                }}
              >
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: '700',
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                    color: typeMeta?.accent ?? colors.sageInk,
                  }}
                >
                  {ctxCopy.tag}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '700',
                  letterSpacing: -0.5,
                  lineHeight: 28,
                  color: colors.textPrimary,
                  marginBottom: 14,
                }}
              >
                Here's how Commune works for you
              </Text>
              {ctxCopy.points.map((pt, idx) => (
                <View
                  key={idx}
                  style={{
                    backgroundColor: colors.bgSurface,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.borderSubtle,
                    padding: 14,
                    marginBottom: 10,
                    flexDirection: 'row',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: colors.sage,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>
                      {idx + 1}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, lineHeight: 18 }}>
                      {pt.title}
                    </Text>
                    <Text style={{ fontSize: 12.5, color: colors.textTertiary, marginTop: 3, lineHeight: 18 }}>
                      {pt.caption}
                    </Text>
                  </View>
                </View>
              ))}
              {ctxCopy.reassurance ? (
                <Text
                  style={{
                    fontSize: 11.5,
                    color: colors.textTertiary,
                    textAlign: 'center',
                    marginTop: 14,
                    paddingHorizontal: 8,
                  }}
                >
                  {ctxCopy.reassurance}
                </Text>
              ) : null}
            </ScrollView>
          ) : null}

          {/* Form */}
          {phase === 'form' ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: space.gutter,
                paddingTop: space.base,
                paddingBottom: space.xl,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '700',
                  letterSpacing: -0.5,
                  lineHeight: 28,
                  color: colors.textPrimary,
                  marginBottom: 8,
                }}
              >
                Name your group
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 22, color: colors.textTertiary, marginBottom: 14 }}>
                You can change this any time.
              </Text>

              <View
                style={{
                  backgroundColor: colors.bgSurface,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.borderSubtle,
                  paddingHorizontal: space.base,
                  paddingVertical: 14,
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: colors.textTertiary,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    marginBottom: 6,
                  }}
                >
                  Name
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={typeMeta ? `e.g. ${typeMeta.label} HQ` : 'e.g. Sunset Drive'}
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleCreateGroup}
                  style={{
                    fontSize: 17,
                    fontWeight: '600',
                    color: colors.textPrimary,
                    paddingVertical: 4,
                  }}
                />
              </View>

              <View
                style={{
                  marginBottom: 12,
                  backgroundColor: colors.bgSurface,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.borderSubtle,
                  overflow: 'hidden',
                }}
              >
                <SelectRow
                  label="Currency"
                  value={currency}
                  options={CURRENCY_OPTIONS.map((o) => ({
                    value: o.code,
                    label: `${o.symbol} ${o.code} — ${o.label}`,
                  }))}
                  onChange={(v) => {
                    hapticLight();
                    setCurrency(v);
                  }}
                  isLast
                />
              </View>

              <View
                style={{
                  backgroundColor: colors.bgSurface,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.borderSubtle,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 6,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.textPrimary }}>
                    Skip the empty start
                  </Text>
                  <Text
                    style={{
                      fontSize: 11.5,
                      color: colors.textTertiary,
                      marginTop: 2,
                      lineHeight: 16,
                    }}
                  >
                    Add suggested categories + first-expense ideas. Rename or remove any of them later.
                  </Text>
                </View>
                <Switch
                  value={includeStarterPack}
                  onValueChange={(next) => {
                    hapticLight();
                    setIncludeStarterPack(next);
                  }}
                  trackColor={{ false: colors.border, true: colors.sage }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={colors.border}
                />
              </View>
              <Text
                style={{
                  fontSize: 11.5,
                  color: colors.textTertiary,
                  textAlign: 'center',
                  marginTop: 6,
                  paddingHorizontal: 8,
                }}
              >
                No expenses are created until you log them. Just suggestions.
              </Text>

              {!canCreateGroup ? (
                <View
                  style={{
                    backgroundColor: colors.warnBg,
                    borderRadius: radius.card,
                    padding: space.base,
                    marginTop: space.sm,
                  }}
                >
                  <Text style={{ fontSize: 13, lineHeight: 20, color: colors.warnText }}>
                    Upgrade your plan to create a new group.
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          ) : null}

          <CtaBar
            bottomInset={insets.bottom}
            label={ctaLabel}
            onPress={ctaOnPress}
            disabled={ctaDisabled}
            loading={ctaLoading}
            variant={ctaVariant}
          />
        </Screen>
      )}
    </>
  );
}

