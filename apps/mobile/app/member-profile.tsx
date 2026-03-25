import { useMemo } from 'react';
import { ScrollView, Text, TouchableOpacity, View, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency, formatDate } from '@commune/utils';
import { useThemeStore } from '@/stores/theme';
import { useAuthStore } from '@/stores/auth';
import { useMemberProfile } from '@/hooks/use-group-hub';

const PROVIDER_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  revolut: 'card-outline',
  monzo: 'card-outline',
  paypal: 'logo-paypal',
  bank_transfer: 'business-outline',
  other: 'wallet-outline',
};

const GROUP_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  couple: 'heart-outline',
  workspace: 'briefcase-outline',
  project: 'people-outline',
  trip: 'airplane-outline',
  other: 'grid-outline',
};

export default function MemberProfileScreen() {
  const { userId, groupId } = useLocalSearchParams<{ userId: string; groupId: string }>();
  const router = useRouter();
  const isDark = useThemeStore((s) => s.mode) === 'dark';
  const currentUser = useAuthStore((s) => s.user);
  const { data: profile, isLoading } = useMemberProfile(userId ?? '', groupId ?? '');

  const bg = isDark ? '#0A0A0A' : '#FAFAFA';
  const surface = isDark ? '#18181B' : '#FFFFFF';
  const text = isDark ? '#FAFAFA' : '#171b24';
  const textSoft = isDark ? '#A1A1AA' : '#667085';
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(23,27,36,0.10)';
  const accent = '#2d6a4f';

  const isMe = currentUser?.id === userId;

  if (isLoading || !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: textSoft }}>Loading...</Text>
      </View>
    );
  }

  const member = profile.member;
  const user = profile.user;
  const initials = (user?.name ?? 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ padding: 20, paddingTop: 60 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 20 }}>
          <Ionicons name="arrow-back" size={24} color={text} />
        </TouchableOpacity>

        {/* Profile header */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{
            width: 72, height: 72, borderRadius: 36,
            backgroundColor: accent, justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#fff' }}>{initials}</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: text, marginTop: 12 }}>
            {user?.name ?? 'Unknown'}{isMe ? ' (You)' : ''}
          </Text>
          <Text style={{ fontSize: 14, color: textSoft, marginTop: 2 }}>{user?.email ?? ''}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <View style={{
              backgroundColor: member?.role === 'admin' ? 'rgba(45,106,79,0.15)' : border,
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
            }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: member?.role === 'admin' ? accent : textSoft }}>
                {member?.role === 'admin' ? 'Admin' : 'Member'}
              </Text>
            </View>
            {member?.joined_at && (
              <View style={{ backgroundColor: border, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                <Text style={{ fontSize: 12, color: textSoft }}>
                  Joined {formatDate(member.joined_at)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Payment Methods */}
        {profile.paymentMethods?.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: text, marginBottom: 12 }}>Payment Methods</Text>
            {profile.paymentMethods.map((pm: any) => {
              const icon = PROVIDER_ICONS[pm.provider] ?? 'wallet-outline';
              const canPay = pm.payment_link && ['revolut', 'monzo', 'paypal'].includes(pm.provider);
              return (
                <View key={pm.id} style={{
                  backgroundColor: surface, borderRadius: 12, padding: 14, marginBottom: 8,
                  borderWidth: 1, borderColor: border, flexDirection: 'row', alignItems: 'center',
                }}>
                  <Ionicons name={icon} size={20} color={accent} style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: text }}>
                      {pm.label ?? pm.provider}
                    </Text>
                    {pm.payment_link && (
                      <Text style={{ fontSize: 12, color: textSoft }}>{pm.payment_link}</Text>
                    )}
                  </View>
                  {canPay && !isMe && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(pm.payment_link)}
                      style={{ backgroundColor: accent, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>Pay</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Shared Groups */}
        {profile.sharedGroups?.length > 0 && !isMe && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: text, marginBottom: 12 }}>Shared Groups</Text>
            {profile.sharedGroups.map((sg: any) => {
              const icon = GROUP_TYPE_ICONS[sg.type] ?? 'grid-outline';
              return (
                <TouchableOpacity
                  key={sg.id}
                  onPress={() => router.push({ pathname: '/group-hub', params: { groupId: sg.id } })}
                  style={{
                    backgroundColor: surface, borderRadius: 12, padding: 14, marginBottom: 8,
                    borderWidth: 1, borderColor: border, flexDirection: 'row', alignItems: 'center',
                  }}
                >
                  <Ionicons name={icon} size={18} color={accent} style={{ marginRight: 12 }} />
                  <Text style={{ fontSize: 14, fontWeight: '600', color: text, flex: 1 }}>{sg.name}</Text>
                  <Ionicons name="chevron-forward" size={16} color={textSoft} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Recent Activity */}
        {profile.recentActivity?.length > 0 && (
          <View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: text, marginBottom: 12 }}>Recent Activity</Text>
            {profile.recentActivity.slice(0, 10).map((activity: any, i: number) => (
              <View key={i} style={{
                backgroundColor: surface, borderRadius: 12, padding: 12, marginBottom: 6,
                borderWidth: 1, borderColor: border,
              }}>
                <Text style={{ fontSize: 13, color: text }}>{activity.title ?? 'Expense'}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ fontSize: 12, color: textSoft }}>{formatDate(activity.date ?? activity.created_at)}</Text>
                  {activity.amount != null && (
                    <Text style={{ fontSize: 13, fontWeight: '600', color: text }}>
                      {formatCurrency(activity.amount, profile.group?.currency ?? 'GBP')}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
