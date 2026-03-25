import { useMemo } from 'react';
import { ScrollView, Text, TouchableOpacity, View, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '@commune/utils';
import { useThemeStore } from '@/stores/theme';
import { useAuthStore } from '@/stores/auth';
import { useGroupHub } from '@/hooks/use-group-hub';
import { useGroupSettlement } from '@/hooks/use-settlement';

const GROUP_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  couple: 'heart-outline',
  workspace: 'briefcase-outline',
  project: 'people-outline',
  trip: 'airplane-outline',
  other: 'grid-outline',
};

const GROUP_TYPE_LABELS: Record<string, string> = {
  home: 'Household',
  couple: 'Couple',
  workspace: 'Workspace',
  project: 'Project',
  trip: 'Trip',
  other: 'Other',
};

export default function GroupHubScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const isDark = useThemeStore((s) => s.mode) === 'dark';
  const user = useAuthStore((s) => s.user);
  const { data: hub, isLoading } = useGroupHub(groupId ?? '');
  const { data: settlement } = useGroupSettlement(groupId ?? '');

  const bg = isDark ? '#0A0A0A' : '#FAFAFA';
  const surface = isDark ? '#18181B' : '#FFFFFF';
  const text = isDark ? '#FAFAFA' : '#171b24';
  const textSoft = isDark ? '#A1A1AA' : '#667085';
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(23,27,36,0.10)';
  const accent = '#2d6a4f';

  const activeMembers = useMemo(
    () => (hub?.members ?? []).filter((m: any) => m.status === 'active'),
    [hub],
  );

  const mySettlement = useMemo(() => {
    if (!settlement?.transactions || !user?.id) return null;
    const iOwe = settlement.transactions
      .filter((t: any) => t.fromUserId === user.id)
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    const owedToMe = settlement.transactions
      .filter((t: any) => t.toUserId === user.id)
      .reduce((sum: number, t: any) => sum + t.amount, 0);
    if (iOwe === 0 && owedToMe === 0) return { status: 'settled' as const, amount: 0 };
    if (iOwe > owedToMe) return { status: 'owe' as const, amount: iOwe - owedToMe };
    return { status: 'owed' as const, amount: owedToMe - iOwe };
  }, [settlement, user?.id]);

  if (isLoading || !hub) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: textSoft }}>Loading...</Text>
      </View>
    );
  }

  const group = hub.group;
  const typeIcon = GROUP_TYPE_ICONS[group.type] ?? 'grid-outline';
  const typeLabel = GROUP_TYPE_LABELS[group.type] ?? 'Group';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }}>
      {/* Hero */}
      <View style={{
        backgroundColor: isDark ? '#1f2330' : '#e8f0eb',
        paddingTop: 60,
        paddingBottom: 24,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
      }}>
        {group.cover_url && (
          <Image
            source={{ uri: group.cover_url }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, opacity: 0.3 }}
          />
        )}
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 16 }}>
          <Ionicons name="arrow-back" size={24} color={text} />
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {group.avatar_url ? (
            <Image source={{ uri: group.avatar_url }} style={{ width: 48, height: 48, borderRadius: 24 }} />
          ) : (
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: accent, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name={typeIcon} size={24} color="#fff" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: text }}>{group.name}</Text>
            {group.tagline && <Text style={{ fontSize: 13, color: textSoft, marginTop: 2 }}>{group.tagline}</Text>}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <View style={{ backgroundColor: 'rgba(45,106,79,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: accent }}>{typeLabel}</Text>
          </View>
          <View style={{ backgroundColor: border, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ fontSize: 12, color: textSoft }}>{activeMembers.length} members</Text>
          </View>
          {mySettlement && (
            <View style={{
              backgroundColor: mySettlement.status === 'settled' ? 'rgba(16,185,129,0.15)' : mySettlement.status === 'owe' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
            }}>
              <Text style={{
                fontSize: 12,
                fontWeight: '600',
                color: mySettlement.status === 'settled' ? '#10B981' : mySettlement.status === 'owe' ? '#EF4444' : '#3B82F6',
              }}>
                {mySettlement.status === 'settled' ? 'Settled' : mySettlement.status === 'owe' ? `You owe ${formatCurrency(mySettlement.amount, group.currency)}` : `Owed ${formatCurrency(mySettlement.amount, group.currency)}`}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={{ padding: 20, gap: 16 }}>
        {/* Pinned message */}
        {group.pinned_message && (
          <View style={{ backgroundColor: surface, borderRadius: 16, padding: 16, borderLeftWidth: 3, borderLeftColor: accent }}>
            <Text style={{ fontSize: 13, color: textSoft, fontWeight: '600', marginBottom: 4 }}>Pinned</Text>
            <Text style={{ fontSize: 14, color: text }}>{group.pinned_message}</Text>
          </View>
        )}

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, backgroundColor: surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: border }}>
            <Text style={{ fontSize: 12, color: textSoft }}>This month</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: text, marginTop: 4 }}>
              {formatCurrency(hub.monthlyTotal ?? 0, group.currency)}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: border }}>
            <Text style={{ fontSize: 12, color: textSoft }}>Expenses</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: text, marginTop: 4 }}>
              {hub.expenseCount ?? 0}
            </Text>
          </View>
        </View>

        {/* Members */}
        <View>
          <Text style={{ fontSize: 16, fontWeight: '700', color: text, marginBottom: 12 }}>Members</Text>
          {activeMembers.map((m: any) => (
            <View key={m.user_id} style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: surface,
              borderRadius: 12,
              padding: 12,
              marginBottom: 8,
              borderWidth: 1,
              borderColor: border,
            }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e8f0eb', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: accent }}>
                  {(m.user?.name ?? 'U')[0].toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: text }}>
                  {m.user?.name ?? 'Unknown'}
                  {m.user_id === user?.id ? ' (You)' : ''}
                </Text>
                <Text style={{ fontSize: 12, color: textSoft }}>{m.role === 'admin' ? 'Admin' : 'Member'}</Text>
              </View>
              {hub.memberTotals?.[m.user_id] != null && (
                <Text style={{ fontSize: 13, fontWeight: '600', color: textSoft }}>
                  {formatCurrency(hub.memberTotals[m.user_id], group.currency)}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            onPress={() => router.push('/expenses/new')}
            style={{ flex: 1, backgroundColor: accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Add expense</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flex: 1, backgroundColor: surface, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: border }}
          >
            <Text style={{ color: text, fontWeight: '600', fontSize: 14 }}>Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
