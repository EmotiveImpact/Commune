import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  countCompletedSetupChecklistItems,
  getIncompleteSetupChecklistItems,
} from '@commune/core';
import { formatCurrency, formatDate } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useChores } from '@/hooks/use-chores';
import {
  useCloseGroupCycle,
  useGroupCycleSummary,
  useReopenGroupCycle,
} from '@/hooks/use-cycles';
import { useGroup } from '@/hooks/use-groups';
import { EmptyState, Screen } from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';
import {
  hapticMedium,
  hapticSuccess,
  hapticWarning,
} from '@/lib/haptics';

function CycleCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: object;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function formatCycleRange(start: string, end: string) {
  return `${formatDate(start)} to ${formatDate(end)}`;
}

function getOrdinalLabel(value: number) {
  if (value === 1) return '1st';
  if (value === 2) return '2nd';
  if (value === 3) return '3rd';
  return `${value}th`;
}

export default function GroupCloseScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();
  const referenceDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const {
    data: group,
    isLoading: groupLoading,
    error: groupError,
    refetch: refetchGroup,
  } = useGroup(activeGroupId ?? '');
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useGroupCycleSummary(activeGroupId ?? '', referenceDate);
  const { data: operations = [], refetch: refetchOperations } = useChores(activeGroupId ?? '');
  const closeCycle = useCloseGroupCycle(activeGroupId ?? '', referenceDate);
  const reopenCycle = useReopenGroupCycle(activeGroupId ?? '', referenceDate);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setNotes(summary?.closure?.notes ?? '');
  }, [summary?.closure?.notes]);

  if (!activeGroupId) {
    return (
      <Screen>
        <EmptyState
          icon="calendar-outline"
          title="No group selected"
          description="Pick a group from the dashboard before reviewing cycle close."
          actionLabel="Open dashboard"
          onAction={() => router.replace('/(tabs)')}
        />
      </Screen>
    );
  }

  if (groupLoading || summaryLoading) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#FAFAFA' }}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      >
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              height: 150,
              borderRadius: 16,
              backgroundColor: '#E5E7EB',
              opacity: 0.5,
              marginBottom: 16,
            }}
          />
        ))}
      </ScrollView>
    );
  }

  const loadError = groupError ?? summaryError;
  if (loadError || !group || !summary) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Cycle close unavailable"
          description={getErrorMessage(loadError, 'Could not load this cycle summary right now.')}
          actionLabel="Try again"
          onAction={() => {
            void refetchGroup();
            void refetchSummary();
            void refetchOperations();
          }}
        />
      </Screen>
    );
  }

  const isAdmin = group.members.some(
    (member) => member.user_id === user?.id && member.role === 'admin',
  );
  const overdueOperations = operations.filter((operation) => operation.next_due < referenceDate);
  const incompleteChecklistItems = getIncompleteSetupChecklistItems(
    group.setup_checklist_progress,
  );
  const completedChecklistCount = countCompletedSetupChecklistItems(
    group.setup_checklist_progress,
  );
  const totalChecklistCount = Object.keys(group.setup_checklist_progress ?? {}).length;

  async function handleCloseCycle() {
    hapticMedium();

    try {
      await closeCycle.mutateAsync(notes.trim() || undefined);
      hapticSuccess();
      await Promise.all([
        refetchGroup(),
        refetchSummary(),
        refetchOperations(),
      ]);
    } catch (error) {
      hapticWarning();
      Alert.alert('Close failed', getErrorMessage(error, 'Could not close the cycle.'));
    }
  }

  async function handleReopenCycle() {
    hapticMedium();

    try {
      await reopenCycle.mutateAsync();
      hapticSuccess();
      await Promise.all([
        refetchGroup(),
        refetchSummary(),
        refetchOperations(),
      ]);
    } catch (error) {
      hapticWarning();
      Alert.alert('Reopen failed', getErrorMessage(error, 'Could not reopen the cycle.'));
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#FAFAFA' }}
      contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#171b24' }}>
          Cycle close
        </Text>
        <Text style={{ marginTop: 4, fontSize: 14, color: '#667085' }}>
          Review this cycle before you lock it. Shared-space setup warnings are surfaced here on purpose.
        </Text>
      </View>

      <CycleCard>
        <View
          style={{
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24' }}>
              {group.name}
            </Text>
            <Text style={{ marginTop: 4, fontSize: 14, color: '#667085' }}>
              {formatCycleRange(summary.cycle_start, summary.cycle_end)} · settles on the {getOrdinalLabel(summary.cycle_date)}
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: summary.is_closed ? '#ECFDF5' : '#FFF7ED',
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: summary.is_closed ? '#059669' : '#D97706',
              }}
            >
              {summary.is_closed ? 'Closed' : 'Open'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 16,
              backgroundColor: '#F3F4F6',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '500', color: '#6B7280' }}>
              {summary.pending_expense_count} pending approvals
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 16,
              backgroundColor: overdueOperations.length > 0 ? '#FFF7ED' : '#ECFDF5',
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: overdueOperations.length > 0 ? '#D97706' : '#059669',
              }}
            >
              {overdueOperations.length} overdue operations
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 16,
              backgroundColor: incompleteChecklistItems.length > 0 ? '#FFF7ED' : '#ECFDF5',
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: incompleteChecklistItems.length > 0 ? '#D97706' : '#059669',
              }}
            >
              {completedChecklistCount}/{totalChecklistCount} setup complete
            </Text>
          </View>
        </View>
      </CycleCard>

      {(incompleteChecklistItems.length > 0 || overdueOperations.length > 0) && (
        <CycleCard style={{ backgroundColor: '#FFF7ED' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <Ionicons name="alert-circle-outline" size={22} color="#D97706" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#9A3412' }}>
                Close warnings
              </Text>
              <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 22, color: '#9A3412' }}>
                This cycle can still be closed, but setup and operations are not fully squared away.
              </Text>
              {incompleteChecklistItems.slice(0, 3).map((item) => (
                <Text key={item.id} style={{ marginTop: 8, fontSize: 13, color: '#9A3412' }}>
                  • {item.label}
                </Text>
              ))}
              {overdueOperations.slice(0, 2).map((operation) => (
                <Text key={operation.id} style={{ marginTop: 8, fontSize: 13, color: '#9A3412' }}>
                  • {operation.title} is overdue
                </Text>
              ))}
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 14 }}>
                <TouchableOpacity
                  onPress={() => {
                    hapticMedium();
                    router.push('/group-edit');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#B45309' }}>
                    Open setup checklist
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    hapticMedium();
                    router.push('/members');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#B45309' }}>
                    Open handover
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    hapticMedium();
                    router.push('/operations');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#B45309' }}>
                    Open operations
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </CycleCard>
      )}

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <CycleCard style={{ flex: 1, marginBottom: 0 }}>
          <Text style={{ fontSize: 13, color: '#667085' }}>Approved spend</Text>
          <Text style={{ marginTop: 6, fontSize: 24, fontWeight: '800', color: '#171b24' }}>
            {formatCurrency(summary.total_spend, group.currency)}
          </Text>
        </CycleCard>
        <CycleCard style={{ flex: 1, marginBottom: 0 }}>
          <Text style={{ fontSize: 13, color: '#667085' }}>Outstanding</Text>
          <Text style={{ marginTop: 6, fontSize: 24, fontWeight: '800', color: '#171b24' }}>
            {formatCurrency(summary.total_outstanding, group.currency)}
          </Text>
        </CycleCard>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <CycleCard style={{ flex: 1, marginBottom: 0 }}>
          <Text style={{ fontSize: 13, color: '#667085' }}>Unpaid expenses</Text>
          <Text style={{ marginTop: 6, fontSize: 24, fontWeight: '800', color: '#171b24' }}>
            {summary.unpaid_expense_count}
          </Text>
        </CycleCard>
        <CycleCard style={{ flex: 1, marginBottom: 0 }}>
          <Text style={{ fontSize: 13, color: '#667085' }}>Overdue expenses</Text>
          <Text style={{ marginTop: 6, fontSize: 24, fontWeight: '800', color: '#171b24' }}>
            {summary.overdue_expense_count}
          </Text>
        </CycleCard>
      </View>

      <CycleCard>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24', marginBottom: 8 }}>
          Close notes
        </Text>
        <Text style={{ marginBottom: 12, fontSize: 14, color: '#667085' }}>
          Capture anything the next admin or reviewer should know about this cycle.
        </Text>
        <TextInput
          style={{
            minHeight: 110,
            borderRadius: 12,
            backgroundColor: '#F3F4F6',
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            color: '#111827',
            textAlignVertical: 'top',
          }}
          multiline
          placeholder="Late approvals, unresolved balances, handover notes..."
          placeholderTextColor="#9CA3AF"
          value={notes}
          onChangeText={setNotes}
        />
      </CycleCard>

      {summary.member_balances.length > 0 && (
        <CycleCard>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24', marginBottom: 12 }}>
            Member balances
          </Text>
          {summary.member_balances.slice(0, 5).map((memberBalance, index) => (
            <View
              key={memberBalance.user_id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: index === 0 ? 0 : 12,
                paddingBottom: 12,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: '#F0F0F0',
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#171b24' }}>
                  {memberBalance.user_name}
                </Text>
                <Text style={{ marginTop: 2, fontSize: 12, color: '#667085' }}>
                  {memberBalance.overdue_expense_count} overdue items
                </Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#B9382F' }}>
                {formatCurrency(memberBalance.remaining_amount, group.currency)}
              </Text>
            </View>
          ))}
        </CycleCard>
      )}

      {summary.expenses.length > 0 && (
        <CycleCard>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24', marginBottom: 12 }}>
            Cycle expenses
          </Text>
          {summary.expenses.slice(0, 5).map((expense, index) => (
            <View
              key={expense.id}
              style={{
                paddingTop: index === 0 ? 0 : 12,
                paddingBottom: 12,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: '#F0F0F0',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#171b24' }}>
                    {expense.title}
                  </Text>
                  <Text style={{ marginTop: 2, fontSize: 12, color: '#667085' }}>
                    {formatDate(expense.due_date)} · {formatLabel(expense.category)}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#171b24' }}>
                  {formatCurrency(expense.remaining_amount, group.currency)}
                </Text>
              </View>
            </View>
          ))}
        </CycleCard>
      )}

      {isAdmin ? (
        <>
          <TouchableOpacity
            style={{
              backgroundColor: summary.is_closed ? '#84CC16' : '#1f2330',
              height: 52,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
              opacity: closeCycle.isPending || reopenCycle.isPending ? 0.6 : 1,
            }}
            onPress={summary.is_closed ? handleReopenCycle : handleCloseCycle}
            disabled={closeCycle.isPending || reopenCycle.isPending}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
              {summary.is_closed ? 'Reopen cycle' : incompleteChecklistItems.length > 0 ? 'Close cycle with warnings' : 'Close cycle'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              height: 48,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}
            onPress={() => {
              hapticMedium();
              router.push('/group-edit');
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>
              Open group settings
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              marginTop: 12,
              height: 48,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}
            onPress={() => {
              hapticMedium();
              router.push('/operations');
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>
              Open operations board
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <CycleCard style={{ backgroundColor: '#F3F4F6' }}>
          <Text style={{ fontSize: 14, color: '#667085' }}>
            You can review the cycle statement here, but only group admins can close or reopen the cycle.
          </Text>
        </CycleCard>
      )}
    </ScrollView>
  );
}

function formatLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
