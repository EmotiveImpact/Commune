import { useMemo } from 'react';
import { Alert, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  IconBell,
  IconChevronRight,
  IconCoin,
  IconDiamond,
  IconHelp,
  IconLanguage,
  IconLogout,
  IconMoon,
  IconRefresh,
  IconUser,
  IconWallet,
  IconWorld,
} from '@tabler/icons-react-native';
import { signOut } from '@commune/api';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@commune/utils';

import { colors, font, radius, space } from '@/constants/design';
import {
  Avatar,
  Card,
  IconTile,
  Pressable,
  Screen,
  type TablerIcon,
} from '@/components/primitives';
import { hapticHeavy, hapticLight } from '@/lib/haptics';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useProfile } from '@/hooks/use-profile';
import { useSubscription } from '@/hooks/use-subscriptions';
import { useUserGroups } from '@/hooks/use-groups';
import { useCrossGroupSettlements } from '@/hooks/use-cross-group';

/* ---------------------------------------------------------------------------
 * Types
 * --------------------------------------------------------------------------- */

type Row = {
  icon: TablerIcon;
  label: string;
  iconColor: string;
  iconBg: string;
  value?: string;
  onPress: () => void;
  destructive?: boolean;
};

/* ---------------------------------------------------------------------------
 * Helpers / static lookups
 * --------------------------------------------------------------------------- */

const PLAN_LABELS: Record<string, string> = {
  standard: 'Standard',
  pro: 'Pro',
  agency: 'Agency',
};

const COUNTRY_NAMES: Record<string, string> = {
  GB: 'United Kingdom',
  US: 'United States',
  CA: 'Canada',
  AU: 'Australia',
  IE: 'Ireland',
  FR: 'France',
  DE: 'Germany',
  ES: 'Spain',
  IT: 'Italy',
  NG: 'Nigeria',
  GH: 'Ghana',
  ZA: 'South Africa',
  IN: 'India',
  JP: 'Japan',
};

function countryLabel(code?: string | null): string {
  if (!code) return '—';
  return COUNTRY_NAMES[code] ?? code;
}

function shortTimezone(tz?: string | null): string {
  if (!tz) return '—';
  // "Europe/London" → "London"
  const parts = tz.split('/');
  return (parts[parts.length - 1] ?? tz).replace(/_/g, ' ');
}

/* ---------------------------------------------------------------------------
 * Section — small uppercase label above each grouped card
 * --------------------------------------------------------------------------- */

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '700',
        color: colors.textTertiary,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        paddingHorizontal: 4,
        paddingBottom: space.sm,
      }}
    >
      {children}
    </Text>
  );
}

/* ---------------------------------------------------------------------------
 * GroupedRows — iOS-style settings card with hairline-separated rows
 * --------------------------------------------------------------------------- */

function GroupedRows({ rows }: { rows: Row[] }) {
  return (
    <Card padding={0}>
      {rows.map((row, idx) => (
        <View key={row.label}>
          <Pressable
            onPress={() => {
              hapticLight();
              row.onPress();
            }}
            style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={row.label}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: space.md + 2,
                paddingHorizontal: space.base,
                gap: space.md,
                minHeight: 56,
              }}
            >
              <IconTile icon={row.icon} color={row.iconColor} bg={row.iconBg} size={28} iconSize={16} />
              <Text
                style={[
                  font.bodyStrong,
                  {
                    color: row.destructive ? colors.dangerText : colors.textPrimary,
                    flex: 1,
                  },
                ]}
                numberOfLines={1}
              >
                {row.label}
              </Text>
              {row.value ? (
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: colors.textMuted,
                    maxWidth: 140,
                  }}
                  numberOfLines={1}
                >
                  {row.value}
                </Text>
              ) : null}
              <IconChevronRight
                size={18}
                color={row.destructive ? colors.dangerText : colors.textTertiary}
                strokeWidth={1.7}
              />
            </View>
          </Pressable>
          {idx < rows.length - 1 ? (
            <View
              style={{
                height: 1,
                backgroundColor: colors.borderSubtle,
                marginLeft: space.base + 28 + space.md,
              }}
            />
          ) : null}
        </View>
      ))}
    </Card>
  );
}

/* ---------------------------------------------------------------------------
 * Stats card — 3-up grid (Owed · Groups · Owe)
 * --------------------------------------------------------------------------- */

function StatsCard({
  owedAmount,
  oweAmount,
  groupCount,
  currency,
}: {
  owedAmount: number;
  oweAmount: number;
  groupCount: number;
  currency: string;
}) {
  return (
    <Card padding={0} style={{ flexDirection: 'row' }}>
      <StatCell
        value={`+${formatCurrency(owedAmount, currency)}`}
        label="Owed to you"
        valueColor={colors.owedText}
        bgTint={colors.sageSoft}
      />
      <StatDivider />
      <StatCell
        value={String(groupCount)}
        label="Groups"
        valueColor={colors.textPrimary}
      />
      <StatDivider />
      <StatCell
        value={`−${formatCurrency(oweAmount, currency)}`}
        label="You owe"
        valueColor={colors.oweText}
        bgTint={colors.oweBg}
      />
    </Card>
  );
}

function StatCell({
  value,
  label,
  valueColor,
  bgTint,
}: {
  value: string;
  label: string;
  valueColor: string;
  bgTint?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        paddingVertical: space.lg,
        paddingHorizontal: space.sm,
        alignItems: 'center',
        backgroundColor: bgTint ?? 'transparent',
      }}
    >
      <Text
        style={{
          fontSize: 17,
          fontWeight: '700',
          color: valueColor,
          fontVariant: ['tabular-nums'],
          letterSpacing: -0.2,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text
        style={{
          marginTop: 6,
          fontSize: 10.5,
          fontWeight: '700',
          color: colors.textTertiary,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          textAlign: 'center',
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function StatDivider() {
  return (
    <View
      style={{
        width: 1,
        alignSelf: 'stretch',
        backgroundColor: colors.borderSubtle,
      }}
    />
  );
}

/* ---------------------------------------------------------------------------
 * Identity hero — centered avatar, name, email
 * --------------------------------------------------------------------------- */

function IdentityHero({
  displayName,
  email,
  avatarUrl,
  onTap,
}: {
  displayName: string;
  email: string;
  avatarUrl?: string | null;
  onTap: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', paddingTop: space.lg, paddingBottom: space.sm }}>
      <Pressable
        onPress={() => {
          hapticLight();
          onTap();
        }}
        accessibilityRole="button"
        accessibilityLabel="Edit profile and change photo"
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
      >
        <View
          style={{
            shadowColor: colors.sage,
            shadowOpacity: 0.22,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
            borderRadius: 999,
          }}
        >
          {avatarUrl ? (
            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 38,
                borderWidth: 3,
                borderColor: '#FFFFFF',
                overflow: 'hidden',
              }}
            >
              <Avatar
                name={displayName}
                size={70}
                bg={colors.sageSoft}
                fg={colors.sageInk}
                uri={avatarUrl}
              />
            </View>
          ) : (
            <LinearGradient
              colors={['#DDEBE5', '#B5D7CC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 76,
                height: 76,
                borderRadius: 38,
                borderWidth: 3,
                borderColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 26,
                  fontWeight: '700',
                  color: colors.sageInk,
                  letterSpacing: 0.3,
                }}
              >
                {(displayName ?? 'U')
                  .trim()
                  .split(/\s+/)
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase() || 'U'}
              </Text>
            </LinearGradient>
          )}
        </View>
      </Pressable>

      <Text
        style={{
          marginTop: space.md,
          fontSize: 19,
          fontWeight: '700',
          color: colors.textPrimary,
          letterSpacing: -0.2,
          textAlign: 'center',
        }}
        numberOfLines={1}
      >
        {displayName}
      </Text>
      {email ? (
        <Text
          style={{
            marginTop: 2,
            fontSize: 13,
            color: colors.textMuted,
            textAlign: 'center',
          }}
          numberOfLines={1}
        >
          {email}
        </Text>
      ) : null}
    </View>
  );
}

/* ---------------------------------------------------------------------------
 * Screen
 * --------------------------------------------------------------------------- */

export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, setUser } = useAuthStore();
  const { setActiveGroupId } = useGroupStore();

  const { data: profile } = useProfile(user?.id ?? '');
  const { data: subscription } = useSubscription(user?.id ?? '');
  const { data: groups } = useUserGroups();
  const { data: crossGroup } = useCrossGroupSettlements(user?.id ?? '');

  const displayName = profile?.name ?? user?.name ?? 'User';
  const email = profile?.email ?? user?.email ?? '';
  const avatarUrl = profile?.avatar_url ?? user?.avatar_url ?? null;
  const planKey = subscription?.plan;
  const planLabel = planKey ? PLAN_LABELS[planKey] ?? planKey : 'Standard';
  const planStatusActive = subscription?.status === 'active';

  const currency = profile?.default_currency ?? user?.default_currency ?? 'GBP';
  const country = countryLabel(profile?.country ?? null);
  const timezone = shortTimezone(profile?.timezone ?? null);
  const themeLabel = 'System'; // theme persistence not yet wired; mirrors edit-profile default

  const notifPrefs = profile?.notification_preferences;
  const notificationsOn = notifPrefs
    ? !!(
        notifPrefs.email_on_new_expense ||
        notifPrefs.email_on_payment_reminder ||
        notifPrefs.email_on_payment_received ||
        notifPrefs.email_on_overdue
      )
    : true;

  /* --- Stats: Owed to you / Groups / You owe -------------------------------
   *
   * Cheap to compute — both hooks are already cached at the app level
   * (useUserGroups runs in the tabs layout, useCrossGroupSettlements is
   * the same query the Settle Up screen uses). We partition the netted
   * cross-group transactions: amounts where the user is the payee = owed,
   * payer = owe. We sum only matching-currency rows so totals stay honest.
   * -------------------------------------------------------------------- */
  const userId = user?.id ?? '';
  const transactions = crossGroup?.transactions ?? [];

  const { owedTotal, oweTotal } = useMemo(() => {
    let owed = 0;
    let owe = 0;
    for (const t of transactions) {
      if (t.currency !== currency) continue;
      if (t.toUserId === userId) owed += t.netAmount;
      else if (t.fromUserId === userId) owe += t.netAmount;
    }
    return { owedTotal: owed, oweTotal: owe };
  }, [transactions, userId, currency]);

  const groupCount = groups?.length ?? 0;

  /* --- Sign out -------------------------------------------------------- */
  const handleSignOut = () => {
    Alert.alert('Sign out', 'You will be returned to the login screen.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          hapticHeavy();
          try {
            await signOut();
            queryClient.clear();
            setUser(null);
            setActiveGroupId(null);
            router.replace('/(auth)/login');
          } catch {
            Alert.alert('Error', 'Could not sign out. Please try again.');
          }
        },
      },
    ]);
  };

  /* --- Row groups ------------------------------------------------------- */
  const profileRows: Row[] = [
    {
      icon: IconUser,
      label: 'Edit profile',
      iconColor: colors.sage,
      iconBg: colors.sageSoft,
      onPress: () => router.push('/edit-profile'),
    },
    {
      icon: IconWallet,
      label: 'Payment methods',
      iconColor: colors.sage,
      iconBg: colors.sageSoft,
      onPress: () => router.push('/payment-methods'),
    },
  ];

  const preferencesRows: Row[] = [
    {
      icon: IconCoin,
      label: 'Default currency',
      iconColor: colors.sage,
      iconBg: colors.sageSoft,
      value: currency,
      onPress: () => router.push('/edit-profile'),
    },
    {
      icon: IconWorld,
      label: 'Country',
      iconColor: colors.sage,
      iconBg: colors.sageSoft,
      value: country,
      onPress: () => router.push('/edit-profile'),
    },
    {
      icon: IconLanguage,
      label: 'Timezone',
      iconColor: colors.sage,
      iconBg: colors.sageSoft,
      value: timezone,
      onPress: () => router.push('/edit-profile'),
    },
    {
      icon: IconMoon,
      label: 'Theme',
      iconColor: colors.sage,
      iconBg: colors.sageSoft,
      value: themeLabel,
      onPress: () => router.push('/edit-profile'),
    },
  ];

  const notificationRows: Row[] = [
    {
      icon: IconBell,
      label: 'Notifications',
      iconColor: colors.warnText,
      iconBg: colors.warnBg,
      value: notificationsOn ? 'On' : 'Off',
      onPress: () => router.push('/notifications'),
    },
  ];

  const planRows: Row[] = [
    {
      icon: IconDiamond,
      label: 'Subscription & billing',
      iconColor: colors.sage,
      iconBg: colors.sageSoft,
      value: `${planLabel} · ${planStatusActive ? 'Active' : 'Free'}`,
      onPress: () => router.push('/pricing'),
    },
  ];

  const supportRows: Row[] = [
    {
      icon: IconHelp,
      label: 'Help & support',
      iconColor: colors.infoText,
      iconBg: colors.infoBg,
      onPress: () => {
        Linking.openURL('mailto:support@ourcommune.io').catch(() => {
          Alert.alert('Unavailable', 'No email app is configured on this device.');
        });
      },
    },
    {
      icon: IconRefresh,
      label: 'Replay onboarding',
      iconColor: colors.sage,
      iconBg: colors.sageSoft,
      onPress: () => {
        hapticLight();
        router.push('/onboarding?preview=true');
      },
    },
  ];

  const accountRows: Row[] = [
    {
      icon: IconLogout,
      label: 'Sign out',
      iconColor: colors.dangerText,
      iconBg: colors.dangerBg,
      onPress: handleSignOut,
      destructive: true,
    },
  ];

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: 120,
          paddingHorizontal: space.gutter,
        }}
      >
        {/* ── Identity hero ─────────────────────────────────────── */}
        <IdentityHero
          displayName={displayName}
          email={email}
          avatarUrl={avatarUrl}
          onTap={() => router.push('/edit-profile')}
        />

        {/* ── Stats (Owed · Groups · Owe) ───────────────────────── */}
        <View style={{ marginTop: space.lg, marginBottom: space.xl, borderRadius: radius.card, overflow: 'hidden' }}>
          <StatsCard
            owedAmount={owedTotal}
            oweAmount={oweTotal}
            groupCount={groupCount}
            currency={currency}
          />
        </View>

        {/* ── Profile ───────────────────────────────────────────── */}
        <SectionLabel>Profile</SectionLabel>
        <GroupedRows rows={profileRows} />
        <View style={{ height: space.lg }} />

        {/* ── Preferences ───────────────────────────────────────── */}
        <SectionLabel>Preferences</SectionLabel>
        <GroupedRows rows={preferencesRows} />
        <View style={{ height: space.lg }} />

        {/* ── Notifications ─────────────────────────────────────── */}
        <SectionLabel>Notifications</SectionLabel>
        <GroupedRows rows={notificationRows} />
        <View style={{ height: space.lg }} />

        {/* ── Plan ──────────────────────────────────────────────── */}
        <SectionLabel>Plan</SectionLabel>
        <GroupedRows rows={planRows} />
        <View style={{ height: space.lg }} />

        {/* ── Support ───────────────────────────────────────────── */}
        <SectionLabel>Support</SectionLabel>
        <GroupedRows rows={supportRows} />
        <View style={{ height: space.lg }} />

        {/* ── Account (Sign out) ────────────────────────────────── */}
        <SectionLabel>Account</SectionLabel>
        <GroupedRows rows={accountRows} />

        {/* ── Footer ────────────────────────────────────────────── */}
        <Text
          style={[
            font.caption,
            {
              color: colors.textTertiary,
              textAlign: 'center',
              marginTop: space.xl,
            },
          ]}
        >
          Commune · v1.0.0
        </Text>
      </ScrollView>
    </Screen>
  );
}

