import { useMemo } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '@commune/utils';
import { useThemeStore } from '@/stores/theme';
import { useAuthStore } from '@/stores/auth';
import { useUserGroups } from '@/hooks/use-groups';
import { useCrossGroupSettlements } from '@/hooks/use-cross-group';

const GROUP_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: 'home-outline',
  couple: 'heart-outline',
  workspace: 'briefcase-outline',
  project: 'people-outline',
  trip: 'airplane-outline',
  other: 'grid-outline',
};

function formatGroupSummary(groups: string[]) {
  if (groups.length === 0) return 'Group';
  if (groups.length === 1) return groups[0]!;
  return `${groups.length} groups`;
}

function formatCurrencyBreakdown(totals: Map<string, number>) {
  if (totals.size === 0) return formatCurrency(0, 'GBP');
  return Array.from(totals.entries())
    .map(([currency, amount]) => formatCurrency(amount, currency))
    .join(' + ');
}

export default function CommandCentreScreen() {
  const router = useRouter();
  const isDark = useThemeStore((s) => s.mode) === 'dark';
  const user = useAuthStore((s) => s.user);
  const { data: groups } = useUserGroups();
  const { data: crossGroup, isLoading } = useCrossGroupSettlements(user?.id ?? '');

  const bg = isDark ? '#0A0A0A' : '#FAFAFA';
  const surface = isDark ? '#18181B' : '#FFFFFF';
  const text = isDark ? '#FAFAFA' : '#171b24';
  const textSoft = isDark ? '#A1A1AA' : '#667085';
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(23,27,36,0.10)';
  const accent = '#2d6a4f';

  const youOwe = useMemo(() => {
    if (!crossGroup?.transactions || !user?.id) return [];
    return crossGroup.transactions.filter((t) => t.fromUserId === user.id);
  }, [crossGroup, user?.id]);

  const owedToYou = useMemo(() => {
    if (!crossGroup?.transactions || !user?.id) return [];
    return crossGroup.transactions.filter((t) => t.toUserId === user.id);
  }, [crossGroup, user?.id]);

  const totalOweByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    for (const transaction of youOwe) {
      totals.set(
        transaction.currency,
        (totals.get(transaction.currency) ?? 0) + transaction.netAmount,
      );
    }
    return totals;
  }, [youOwe]);

  const totalOwedByCurrency = useMemo(() => {
    const totals = new Map<string, number>();
    for (const transaction of owedToYou) {
      totals.set(
        transaction.currency,
        (totals.get(transaction.currency) ?? 0) + transaction.netAmount,
      );
    }
    return totals;
  }, [owedToYou]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: textSoft }}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ padding: 20, paddingTop: 60 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 16 }}>
          <Ionicons name="arrow-back" size={24} color={text} />
        </TouchableOpacity>

        <Text style={{ fontSize: 24, fontWeight: '800', color: text, marginBottom: 4 }}>Command Centre</Text>
        <Text style={{ fontSize: 14, color: textSoft, marginBottom: 24 }}>Your priorities across all groups</Text>

        {/* Summary cards */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
          <View style={{
            flex: 1,
            backgroundColor: youOwe.length > 0 ? 'rgba(239,68,68,0.08)' : surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: youOwe.length > 0 ? 'rgba(239,68,68,0.2)' : border,
          }}>
            <Text style={{ fontSize: 12, color: textSoft }}>You owe</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: youOwe.length > 0 ? '#EF4444' : text, marginTop: 4 }}>
              {formatCurrencyBreakdown(totalOweByCurrency)}
            </Text>
          </View>
          <View style={{
            flex: 1,
            backgroundColor: owedToYou.length > 0 ? 'rgba(16,185,129,0.08)' : surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: owedToYou.length > 0 ? 'rgba(16,185,129,0.2)' : border,
          }}>
            <Text style={{ fontSize: 12, color: textSoft }}>Owed to you</Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: owedToYou.length > 0 ? '#10B981' : text, marginTop: 4 }}>
              {formatCurrencyBreakdown(totalOwedByCurrency)}
            </Text>
          </View>
        </View>

        {/* Priority actions */}
        {youOwe.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: text, marginBottom: 12 }}>Priority payments</Text>
            {youOwe.slice(0, 3).map((t) => (
              <View key={`${t.fromUserId}-${t.toUserId}-${t.currency}`} style={{
                backgroundColor: surface,
                borderRadius: 12,
                padding: 14,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: border,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: text }}>
                    Pay {t.toName ?? 'someone'}
                  </Text>
                  <Text style={{ fontSize: 12, color: textSoft }}>{formatGroupSummary(t.groups)}</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#EF4444' }}>
                  {formatCurrency(t.netAmount, t.currency)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Waiting on others */}
        {owedToYou.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: text, marginBottom: 12 }}>Waiting on others</Text>
            {owedToYou.slice(0, 3).map((t) => (
              <View key={`${t.fromUserId}-${t.toUserId}-${t.currency}`} style={{
                backgroundColor: surface,
                borderRadius: 12,
                padding: 14,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: border,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: text }}>
                    {t.fromName ?? 'Someone'} owes you
                  </Text>
                  <Text style={{ fontSize: 12, color: textSoft }}>{formatGroupSummary(t.groups)}</Text>
                </View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#10B981' }}>
                  {formatCurrency(t.netAmount, t.currency)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* My Groups */}
        <Text style={{ fontSize: 16, fontWeight: '700', color: text, marginBottom: 12 }}>My groups</Text>
        {(groups ?? []).map((g) => {
          const icon = GROUP_TYPE_ICONS[g.type] ?? 'grid-outline';
          const perGroupData = crossGroup?.perGroupData?.find((p) => p.groupId === g.id);
          const hasDebts = (perGroupData?.settlement?.transactions?.length ?? 0) > 0;
          const memberCount = g.members?.filter((member) => member.status === 'active').length ?? 0;

          return (
            <TouchableOpacity
              key={g.id}
              onPress={() => router.push({ pathname: '/group-hub', params: { groupId: g.id } })}
              style={{
                backgroundColor: surface,
                borderRadius: 14,
                padding: 16,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: border,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: isDark ? '#1f2330' : '#e8f0eb',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 14,
              }}>
                <Ionicons name={icon} size={20} color={accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: text }}>{g.name}</Text>
                <Text style={{ fontSize: 12, color: textSoft }}>{memberCount} members</Text>
              </View>
              <View style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 10,
                backgroundColor: hasDebts ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
              }}>
                <Text style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: hasDebts ? '#F59E0B' : '#10B981',
                }}>
                  {hasDebts ? 'Active' : 'Settled'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={textSoft} style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          );
        })}

        {youOwe.length === 0 && owedToYou.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            <Text style={{ fontSize: 16, fontWeight: '600', color: text, marginTop: 12 }}>All settled!</Text>
            <Text style={{ fontSize: 13, color: textSoft, marginTop: 4 }}>No outstanding balances across your groups.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
