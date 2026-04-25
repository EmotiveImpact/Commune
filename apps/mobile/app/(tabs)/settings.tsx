import { Alert, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  IconBell,
  IconChevronRight,
  IconDiamond,
  IconHelp,
  IconLogout,
  IconRefresh,
  IconUser,
  IconWallet,
} from '@tabler/icons-react-native';
import { signOut } from '@commune/api';
import { useQueryClient } from '@tanstack/react-query';

import { colors, font, space } from '@/constants/design';
import {
  Avatar,
  Badge,
  Card,
  IconTile,
  Pressable,
  Screen,
  SectionHeader,
  type TablerIcon,
} from '@/components/primitives';
import { hapticHeavy, hapticLight } from '@/lib/haptics';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useProfile } from '@/hooks/use-profile';
import { useSubscription } from '@/hooks/use-subscriptions';

type Row = {
  icon: TablerIcon;
  label: string;
  color: string;
  bg: string;
  onPress: () => void;
};

/* ---------------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------------- */

const PLAN_LABELS: Record<string, string> = {
  standard: 'Standard',
  pro: 'Pro',
  agency: 'Agency',
};

function formatMemberSince(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

/* ---------------------------------------------------------------------------
 * Section container — grouped rows inside one surface card
 * --------------------------------------------------------------------------- */

function GroupedRows({ rows }: { rows: Row[] }) {
  return (
    <Card padding={0}>
      {rows.map((row, idx) => (
        <View key={row.label}>
          <Pressable
            onPress={() => { hapticLight(); row.onPress(); }}
            style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: space.md + 2,
              paddingHorizontal: space.base,
              gap: space.md,
            }}>
              <IconTile icon={row.icon} color={row.color} bg={row.bg} size={36} />
              <Text style={[font.bodyStrong, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
                {row.label}
              </Text>
              <IconChevronRight size={18} color={colors.textTertiary} strokeWidth={1.7} />
            </View>
          </Pressable>
          {idx < rows.length - 1 ? (
            <View style={{
              height: 1,
              backgroundColor: colors.borderSubtle,
              marginLeft: space.base + 36 + space.md,
            }} />
          ) : null}
        </View>
      ))}
    </Card>
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

  const displayName = profile?.name ?? user?.name ?? 'User';
  const email = profile?.email ?? user?.email ?? '';
  const planKey = subscription?.plan;
  const planLabel = planKey ? PLAN_LABELS[planKey] ?? planKey : 'Standard';
  const memberSince = formatMemberSince(profile?.created_at);

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

  /* --- Account rows ------------------------------------------------------ */
  const accountRows: Row[] = [
    {
      icon: IconUser,
      label: 'Edit profile',
      color: colors.sage,
      bg: colors.sageSoft,
      onPress: () => router.push('/edit-profile'),
    },
    {
      icon: IconWallet,
      label: 'Payment methods',
      color: colors.sage,
      bg: colors.sageSoft,
      onPress: () => router.push('/payment-methods'),
    },
    {
      icon: IconBell,
      label: 'Notifications',
      color: colors.warnText,
      bg: colors.warnBg,
      onPress: () => router.push('/notifications'),
    },
    {
      icon: IconDiamond,
      label: 'Subscription & billing',
      color: colors.sage,
      bg: colors.sageSoft,
      onPress: () => router.push('/pricing'),
    },
    {
      icon: IconHelp,
      label: 'Help & support',
      color: colors.infoText,
      bg: colors.infoBg,
      onPress: () => {
        Linking.openURL('mailto:support@ourcommune.io').catch(() => {
          Alert.alert('Unavailable', 'No email app is configured on this device.');
        });
      },
    },
    {
      icon: IconRefresh,
      label: 'Replay onboarding',
      color: colors.sage,
      bg: colors.sageSoft,
      onPress: () => {
        hapticLight();
        router.push('/onboarding?preview=true');
      },
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
          gap: space.xl,
        }}
      >
        {/* ── Profile hero (P-B style) ─────────────────────────── */}
        <View
          style={{
            backgroundColor: colors.bgInk,
            borderRadius: 24,
            paddingTop: space.xl,
            paddingBottom: space.lg,
            paddingHorizontal: space.lg,
            alignItems: 'center',
          }}
        >
          <View style={{ alignItems: 'center' }}>
            <Avatar
              name={displayName}
              size={72}
              bg="#EADFD4"
              fg="#1A1E2B"
              uri={profile?.avatar_url ?? user?.avatar_url ?? null}
            />
          </View>
          <Text
            style={{
              marginTop: space.md,
              fontSize: 22,
              fontWeight: '700',
              color: '#FFFFFF',
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
                marginTop: 4,
                fontSize: 13,
                fontWeight: '500',
                color: 'rgba(255,255,255,0.55)',
                textAlign: 'center',
              }}
              numberOfLines={1}
            >
              {email}
            </Text>
          ) : null}

          <Pressable
            onPress={() => {
              hapticLight();
              router.push('/group-hub');
            }}
            style={({ pressed }) => [
              {
                marginTop: space.md,
                paddingVertical: 6,
                paddingHorizontal: space.md,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.12)',
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.4 }}>
              Edit profile
            </Text>
          </Pressable>

          <View
            style={{
              height: 1,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignSelf: 'stretch',
              marginVertical: space.lg,
            }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', alignSelf: 'stretch' }}>
            <DarkStatCell label="Member since" value={memberSince} />
            <DarkVerticalRule />
            <DarkStatCell label="Plan" value={planLabel} badge />
            <DarkVerticalRule />
            <DarkStatCell
              label="Status"
              value={subscription?.status === 'active' ? 'Active' : 'Free'}
            />
          </View>
        </View>

        {/* ── Account ──────────────────────────────────────────── */}
        <View>
          <SectionHeader title="Account" />
          <GroupedRows rows={accountRows} />
        </View>

        {/* ── Sign out ─────────────────────────────────────────── */}
        <TouchableOpacity
          onPress={handleSignOut}
          accessibilityLabel="Sign out"
          accessibilityRole="button"
          activeOpacity={0.85}
          style={{
            alignSelf: 'stretch',
            minHeight: 56,
            borderRadius: 16,
            backgroundColor: '#C74A3A',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
            elevation: 3,
          }}
        >
          <IconLogout size={20} color="#FFFFFF" strokeWidth={1.7} />
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Sign out</Text>
        </TouchableOpacity>

        {/* ── Footer ───────────────────────────────────────────── */}
        <Text
          style={[
            font.caption,
            {
              color: colors.textTertiary,
              textAlign: 'center',
              marginTop: -space.sm,
            },
          ]}
        >
          Commune · v1.0.0
        </Text>
      </ScrollView>
    </Screen>
  );
}

/* ---------------------------------------------------------------------------
 * Inline helpers for the profile card bottom row
 * --------------------------------------------------------------------------- */

function StatCell({ label, value, badge }: { label: string; value: string; badge?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'flex-start' }}>
      <Text style={{
        fontSize: 11,
        fontWeight: '700',
        color: colors.textTertiary,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
      }}>
        {label}
      </Text>
      {badge ? (
        <Badge label={value} tone="sage" style={{ marginTop: 6 }} />
      ) : (
        <Text style={[font.bodyStrong, { color: colors.textPrimary, marginTop: 4 }]} numberOfLines={1}>
          {value}
        </Text>
      )}
    </View>
  );
}

function VerticalRule() {
  return (
    <View style={{
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: colors.borderSubtle,
      marginHorizontal: space.md,
    }} />
  );
}

function DarkStatCell({ label, value, badge }: { label: string; value: string; badge?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{
        fontSize: 10,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.45)',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        textAlign: 'center',
      }}>
        {label}
      </Text>
      {badge ? (
        <View style={{
          marginTop: 6,
          paddingVertical: 3,
          paddingHorizontal: 9,
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.12)',
        }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }} numberOfLines={1}>
            {value}
          </Text>
        </View>
      ) : (
        <Text
          style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginTop: 4, textAlign: 'center' }}
          numberOfLines={1}
        >
          {value}
        </Text>
      )}
    </View>
  );
}

function DarkVerticalRule() {
  return (
    <View style={{
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: 'rgba(255,255,255,0.08)',
      marginHorizontal: space.sm,
    }} />
  );
}
