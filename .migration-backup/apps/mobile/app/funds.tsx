import { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '@commune/utils';
import { useThemeStore } from '@/stores/theme';
import { useGroupStore } from '@/stores/group';
import { useGroup } from '@/hooks/use-groups';
import { useFunds, useCreateFund, useAddContribution } from '@/hooks/use-funds';

export default function FundsScreen() {
  const router = useRouter();
  const isDark = useThemeStore((s) => s.mode) === 'dark';
  const activeGroupId = useGroupStore((s) => s.activeGroupId);
  const { data: group } = useGroup(activeGroupId ?? '');
  const { data: funds, isLoading } = useFunds(activeGroupId ?? '');
  const createFund = useCreateFund(activeGroupId ?? '');
  const addContribution = useAddContribution(activeGroupId ?? '');
  const [expandedFund, setExpandedFund] = useState<string | null>(null);

  const bg = isDark ? '#0A0A0A' : '#FAFAFA';
  const surface = isDark ? '#18181B' : '#FFFFFF';
  const text = isDark ? '#FAFAFA' : '#171b24';
  const textSoft = isDark ? '#A1A1AA' : '#667085';
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(23,27,36,0.10)';
  const accent = '#2d6a4f';
  const currency = group?.currency ?? 'GBP';

  const handleCreateFund = () => {
    Alert.prompt('New Fund', 'Enter a name for this fund', (name) => {
      if (name?.trim()) {
        createFund.mutate({ name: name.trim(), currency });
      }
    });
  };

  if (!activeGroupId) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <Ionicons name="wallet-outline" size={48} color={textSoft} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: text, marginTop: 16 }}>Select a group first</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ padding: 20, gap: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: text }}>Shared Funds</Text>
          <TouchableOpacity
            onPress={handleCreateFund}
            style={{ backgroundColor: accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>New fund</Text>
          </TouchableOpacity>
        </View>

        {isLoading && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ color: textSoft }}>Loading...</Text>
          </View>
        )}

        {!isLoading && (!funds || funds.length === 0) && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Ionicons name="wallet-outline" size={40} color={textSoft} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: text, marginTop: 12 }}>No funds yet</Text>
            <Text style={{ fontSize: 13, color: textSoft, marginTop: 4, textAlign: 'center' }}>
              Create a shared fund for communal purchases, deposits, or savings goals.
            </Text>
          </View>
        )}

        {(funds ?? []).map((fund: any) => {
          const balance = (fund.total_contributions ?? 0) - (fund.total_expenses ?? 0);
          const target = fund.target_amount ?? 0;
          const progress = target > 0 ? Math.min((fund.total_contributions ?? 0) / target, 1) : 0;
          const isExpanded = expandedFund === fund.id;

          return (
            <TouchableOpacity
              key={fund.id}
              onPress={() => setExpandedFund(isExpanded ? null : fund.id)}
              activeOpacity={0.7}
              style={{
                backgroundColor: surface,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: border,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: text }}>{fund.name}</Text>
                  <Text style={{ fontSize: 13, color: textSoft, marginTop: 2 }}>
                    Balance: {formatCurrency(balance, currency)}
                  </Text>
                </View>
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={textSoft} />
              </View>

              {target > 0 && (
                <View style={{ marginTop: 10 }}>
                  <View style={{ height: 6, backgroundColor: border, borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{
                      height: 6,
                      borderRadius: 3,
                      width: `${Math.round(progress * 100)}%` as any,
                      backgroundColor: progress >= 1 ? '#10B981' : accent,
                    }} />
                  </View>
                  <Text style={{ fontSize: 11, color: textSoft, marginTop: 4 }}>
                    {formatCurrency(fund.total_contributions ?? 0, currency)} of {formatCurrency(target, currency)}
                  </Text>
                </View>
              )}

              {isExpanded && (
                <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: border }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: text, marginBottom: 8 }}>
                    In: {formatCurrency(fund.total_contributions ?? 0, currency)} · Out: {formatCurrency(fund.total_expenses ?? 0, currency)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      Alert.prompt('Add Contribution', 'Enter amount', (val) => {
                        const amount = parseFloat(val);
                        if (amount > 0) addContribution.mutate({ fund_id: fund.id, amount });
                      }, 'plain-text', '', 'decimal-pad');
                    }}
                    style={{ backgroundColor: accent, borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Add contribution</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}
