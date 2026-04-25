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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconAlertCircle, IconCalendar, IconChevronLeft, IconCloudOff } from '@tabler/icons-react-native';
import { Pressable } from '@/components/primitives';
import { colors, font, space, radius } from '@/constants/design';
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
          backgroundColor: colors.bgSurface,
          borderRadius: radius.card,
          padding: space.lg,
          marginBottom: space.base,
          shadowColor: colors.textPrimary,
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

function ScreenHeader({ title, onBack, topInset }: { title: string; onBack: () => void; topInset: number }) {
  return (
    <View
      style={{
        paddingTop: topInset + 12,
        paddingHorizontal: space.gutter,
        backgroundColor: colors.bgBase,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 48,
          position: 'relative',
        }}
      >
        <Pressable
          onPress={onBack}
          hitSlop={10}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 6, paddingRight: 10, marginLeft: -4, opacity: pressed ? 0.6 : 1, zIndex: 2 })}
        >
          <IconChevronLeft size={22} color={colors.textPrimary} strokeWidth={2} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>Back</Text>
        </Pressable>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={[font.h3, { color: colors.textPrimary }]}>{title}</Text>
        </View>
        <View style={{ width: 36, zIndex: 2 }} />
      </View>
    </View>
  );
}

export default function GroupCloseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
          icon={IconCalendar}
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
        style={{ flex: 1, backgroundColor: colors.bgBase }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}
      >
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              height: 150,
              borderRadius: radius.card,
              backgroundColor: colors.border,
              opacity: 0.5,
              marginBottom: space.base,
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
          icon={IconCloudOff}
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
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <ScreenHeader title="Cycle close" topInset={insets.top} onBack={() => router.back()} />
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bgBase }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ marginBottom: space.lg }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: colors.textPrimary }}>
          Cycle close
        </Text>
        <Text style={{ marginTop: 4, fontSize: 14, color: colors.textTertiary }}>
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
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>
              {group.name}
            </Text>
            <Text style={{ marginTop: 4, fontSize: 14, color: colors.textTertiary }}>
              {formatCycleRange(summary.cycle_start, summary.cycle_end)} · settles on the {getOrdinalLabel(summary.cycle_date)}
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: summary.is_closed ? colors.owedBg : colors.warnBg,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: summary.is_closed ? colors.owedText : colors.warnText,
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
              backgroundColor: colors.bgSubtle,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.textTertiary }}>
              {summary.pending_expense_count} pending approvals
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 16,
              backgroundColor: overdueOperations.length > 0 ? colors.warnBg : colors.owedBg,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: overdueOperations.length > 0 ? colors.warnText : colors.owedText,
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
              backgroundColor: incompleteChecklistItems.length > 0 ? colors.warnBg : colors.owedBg,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: incompleteChecklistItems.length > 0 ? colors.warnText : colors.owedText,
              }}
            >
              {completedChecklistCount}/{totalChecklistCount} setup complete
            </Text>
          </View>
        </View>
      </CycleCard>

      {(incompleteChecklistItems.length > 0 || overdueOperations.length > 0) && (
        <CycleCard style={{ backgroundColor: colors.warnBg }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <IconAlertCircle size={22} color={colors.warnText} strokeWidth={1.7} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.warnText }}>
                Close warnings
              </Text>
              <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 22, color: colors.warnText }}>
                This cycle can still be closed, but setup and operations are not fully squared away.
              </Text>
              {incompleteChecklistItems.slice(0, 3).map((item) => (
                <Text key={item.id} style={{ marginTop: 8, fontSize: 13, color: colors.warnText }}>
                  • {item.label}
                </Text>
              ))}
              {overdueOperations.slice(0, 2).map((operation) => (
                <Text key={operation.id} style={{ marginTop: 8, fontSize: 13, color: colors.warnText }}>
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
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.warnText }}>
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
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.warnText }}>
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
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.warnText }}>
                    Open operations
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </CycleCard>
      )}

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: space.base }}>
        <CycleCard style={{ flex: 1, marginBottom: 0 }}>
          <Text style={{ fontSize: 13, color: colors.textTertiary }}>Approved spend</Text>
          <Text style={{ marginTop: 6, fontSize: 24, fontWeight: '800', color: colors.textPrimary }}>
            {formatCurrency(summary.total_spend, group.currency)}
          </Text>
        </CycleCard>
        <CycleCard style={{ flex: 1, marginBottom: 0 }}>
          <Text style={{ fontSize: 13, color: colors.textTertiary }}>Outstanding</Text>
          <Text style={{ marginTop: 6, fontSize: 24, fontWeight: '800', color: colors.textPrimary }}>
            {formatCurrency(summary.total_outstanding, group.currency)}
          </Text>
        </CycleCard>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: space.base }}>
        <CycleCard style={{ flex: 1, marginBottom: 0 }}>
          <Text style={{ fontSize: 13, color: colors.textTertiary }}>Unpaid expenses</Text>
          <Text style={{ marginTop: 6, fontSize: 24, fontWeight: '800', color: colors.textPrimary }}>
            {summary.unpaid_expense_count}
          </Text>
        </CycleCard>
        <CycleCard style={{ flex: 1, marginBottom: 0 }}>
          <Text style={{ fontSize: 13, color: colors.textTertiary }}>Overdue expenses</Text>
          <Text style={{ marginTop: 6, fontSize: 24, fontWeight: '800', color: colors.textPrimary }}>
            {summary.overdue_expense_count}
          </Text>
        </CycleCard>
      </View>

      <CycleCard>
        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 }}>
          Close notes
        </Text>
        <Text style={{ marginBottom: 12, fontSize: 14, color: colors.textTertiary }}>
          Capture anything the next admin or reviewer should know about this cycle.
        </Text>
        <TextInput
          style={{
            minHeight: 110,
            borderRadius: 12,
            backgroundColor: colors.bgSubtle,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            color: colors.textPrimary,
            textAlignVertical: 'top',
          }}
          multiline
          placeholder="Late approvals, unresolved balances, handover notes..."
          placeholderTextColor={colors.textMuted}
          value={notes}
          onChangeText={setNotes}
        />
      </CycleCard>

      {summary.member_balances.length > 0 && (
        <CycleCard>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 }}>
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
                borderTopColor: colors.borderSubtle,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                  {memberBalance.user_name}
                </Text>
                <Text style={{ marginTop: 2, fontSize: 12, color: colors.textTertiary }}>
                  {memberBalance.overdue_expense_count} overdue items
                </Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.dangerText }}>
                {formatCurrency(memberBalance.remaining_amount, group.currency)}
              </Text>
            </View>
          ))}
        </CycleCard>
      )}

      {summary.expenses.length > 0 && (
        <CycleCard>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 }}>
            Cycle expenses
          </Text>
          {summary.expenses.slice(0, 5).map((expense, index) => (
            <View
              key={expense.id}
              style={{
                paddingTop: index === 0 ? 0 : 12,
                paddingBottom: 12,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.borderSubtle,
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
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                    {expense.title}
                  </Text>
                  <Text style={{ marginTop: 2, fontSize: 12, color: colors.textTertiary }}>
                    {formatDate(expense.due_date)} · {formatLabel(expense.category)}
                  </Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
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
              backgroundColor: summary.is_closed ? colors.lime : colors.bgInk,
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
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textInverse }}>
              {summary.is_closed ? 'Reopen cycle' : incompleteChecklistItems.length > 0 ? 'Close cycle with warnings' : 'Close cycle'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              height: 48,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.bgSurface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            onPress={() => {
              hapticMedium();
              router.push('/group-edit');
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>
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
              backgroundColor: colors.bgSurface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            onPress={() => {
              hapticMedium();
              router.push('/operations');
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textSecondary }}>
              Open operations board
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <CycleCard style={{ backgroundColor: colors.bgSubtle }}>
          <Text style={{ fontSize: 14, color: colors.textTertiary }}>
            You can review the cycle statement here, but only group admins can close or reopen the cycle.
          </Text>
        </CycleCard>
      )}
    </ScrollView>
    </View>
  );
}

function formatLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
