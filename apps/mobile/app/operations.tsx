import { type ReactNode, useMemo, useState } from 'react';
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
import { IconChevronLeft, IconCircleCheck, IconCloudOff } from '@tabler/icons-react-native';
import { Pressable } from '@/components/primitives';
import { colors, font, space, radius } from '@/constants/design';
import {
  createChoreSchema,
  getOperationTemplates,
} from '@commune/core';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { DateField, EmptyState, Screen } from '@/components/ui';
import { useChores, useCompleteChore, useCreateChore, useDeleteChore } from '@/hooks/use-chores';
import { useGroup } from '@/hooks/use-groups';
import { useApplyGroupStarterPack } from '@/hooks/use-onboarding';
import { getErrorMessage } from '@/lib/errors';
import {
  hapticLight,
  hapticMedium,
  hapticSuccess,
  hapticWarning,
} from '@/lib/haptics';

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'once', label: 'One-time' },
] as const;

const CATEGORY_OPTIONS = [
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'admin', label: 'Admin' },
  { value: 'setup', label: 'Setup' },
  { value: 'shutdown', label: 'Shutdown' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
] as const;

const TASK_TYPE_OPTIONS = [
  { value: 'recurring', label: 'Recurring' },
  { value: 'one_off', label: 'One-off' },
  { value: 'checklist', label: 'Checklist' },
] as const;

type FrequencyValue = (typeof FREQUENCY_OPTIONS)[number]['value'];
type CategoryValue = (typeof CATEGORY_OPTIONS)[number]['value'];
type TaskTypeValue = (typeof TASK_TYPE_OPTIONS)[number]['value'];

function OperationsCard({
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

function formatCategoryLabel(value: string) {
  return CATEGORY_OPTIONS.find((item) => item.value === value)?.label ?? 'Other';
}

function getFrequencyLabel(frequency: string, nextDue: string) {
  if (!nextDue) {
    return frequency;
  }

  const date = new Date(`${nextDue}T00:00:00`);
  if (frequency === 'weekly') {
    return `Weekly · ${date.toLocaleDateString('en-GB', { weekday: 'short' })}`;
  }
  if (frequency === 'biweekly') {
    return `Every 2 weeks · ${date.toLocaleDateString('en-GB', { weekday: 'short' })}`;
  }
  if (frequency === 'monthly') {
    return `Monthly · ${date.getDate()}`;
  }
  if (frequency === 'once') {
    return 'One-time';
  }
  return 'Daily';
}

function dueLabel(nextDue: string) {
  return new Date(`${nextDue}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
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

export default function OperationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();
  const {
    data: group,
    isLoading: groupLoading,
    error: groupError,
    refetch: refetchGroup,
  } = useGroup(activeGroupId ?? '');
  const {
    data: chores = [],
    isLoading: choresLoading,
    error: choresError,
    refetch: refetchChores,
  } = useChores(activeGroupId ?? '');
  const createChore = useCreateChore(activeGroupId ?? '');
  const completeChore = useCompleteChore(activeGroupId ?? '');
  const deleteChore = useDeleteChore(activeGroupId ?? '');
  const applyStarterPack = useApplyGroupStarterPack(activeGroupId ?? '');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CategoryValue>('other');
  const [taskType, setTaskType] = useState<TaskTypeValue>('recurring');
  const [frequency, setFrequency] = useState<FrequencyValue>('weekly');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [checklistText, setChecklistText] = useState('');
  const [escalationDays, setEscalationDays] = useState('');
  const [nextDueDate, setNextDueDate] = useState<Date>(() => new Date());

  const loadError = groupError ?? choresError;
  const isAdmin =
    group?.members.some((member) => member.user_id === user?.id && member.role === 'admin') ?? false;

  const members = useMemo(
    () =>
      (group?.members ?? [])
        .filter((member) => member.status === 'active')
        .map((member) => ({
          value: member.user_id,
          label: member.user?.name ?? member.user?.email ?? 'Unknown',
        })),
    [group?.members],
  );

  const today = new Date().toISOString().slice(0, 10);
  const overdueChores = chores.filter((chore: any) => chore.next_due < today);
  const upcomingChores = chores.filter((chore: any) => chore.next_due >= today);
  const checklistCount = chores.filter((chore: any) => chore.task_type === 'checklist').length;
  const recurringCount = chores.filter((chore: any) => chore.frequency !== 'once').length;
  const starterTemplates = getOperationTemplates(group?.type, group?.subtype);

  async function handleLoadStarterBoard() {
    if (!activeGroupId || !group) {
      return;
    }

    if (chores.length > 0) {
      Alert.alert(
        'Starter board already covered',
        'This group already has operations. Add a specific operation manually instead of loading another starter board.',
      );
      return;
    }

    hapticMedium();

    try {
      const result = await applyStarterPack.mutateAsync({
        groupType: group.type,
        subtype: group.subtype,
        includeStarterOperations: true,
      });
      hapticSuccess();
      Alert.alert(
        'Starter board loaded',
        result.operationsCreated > 0
          ? `Added ${result.operationsCreated} starter operations.`
          : 'Starter operations were already in place.',
      );
    } catch (error) {
      hapticWarning();
      Alert.alert('Starter board failed', getErrorMessage(error));
    }
  }

  async function handleCreateOperation() {
    if (!activeGroupId) {
      return;
    }

    const result = createChoreSchema.safeParse({
      group_id: activeGroupId,
      title,
      description: description.trim() || null,
      category,
      task_type: taskType,
      frequency,
      assigned_to: assignedTo,
      checklist_items:
        taskType === 'checklist'
          ? checklistText
              .split('\n')
              .map((item) => item.trim())
              .filter(Boolean)
          : null,
      escalation_days:
        escalationDays.trim() === '' ? null : Number(escalationDays),
      next_due: nextDueDate.toISOString().slice(0, 10),
    });

    if (!result.success) {
      hapticWarning();
      Alert.alert(
        'Invalid operation',
        result.error.issues[0]?.message ?? 'Please check the form and try again.',
      );
      return;
    }

    hapticMedium();

    try {
      await createChore.mutateAsync(result.data);
      hapticSuccess();
      setTitle('');
      setDescription('');
      setCategory('other');
      setTaskType('recurring');
      setFrequency('weekly');
      setAssignedTo(null);
      setChecklistText('');
      setEscalationDays('');
      setNextDueDate(new Date());
      setShowCreateForm(false);
    } catch (error) {
      hapticWarning();
      Alert.alert('Create failed', getErrorMessage(error));
    }
  }

  async function handleCompleteOperation(choreId: string, choreTitle: string) {
    hapticMedium();

    try {
      await completeChore.mutateAsync(choreId);
      hapticSuccess();
      Alert.alert('Done', `${choreTitle} marked as complete.`);
    } catch (error) {
      hapticWarning();
      Alert.alert('Complete failed', getErrorMessage(error));
    }
  }

  function handleDeleteOperation(choreId: string, choreTitle: string) {
    Alert.alert(
      'Remove operation',
      `Remove ${choreTitle} from this board?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            hapticMedium();
            try {
              await deleteChore.mutateAsync(choreId);
              hapticSuccess();
            } catch (error) {
              hapticWarning();
              Alert.alert('Remove failed', getErrorMessage(error));
            }
          },
        },
      ],
    );
  }

  if (!activeGroupId) {
    return (
      <Screen>
        <EmptyState
          icon={IconCircleCheck}
          title="No group selected"
          description="Pick a group before managing its operations board."
        />
      </Screen>
    );
  }

  if (groupLoading || choresLoading) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bgBase }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}
      >
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              height: 140,
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

  if (loadError || !group) {
    return (
      <Screen>
        <EmptyState
          icon={IconCloudOff}
          title="Operations unavailable"
          description={getErrorMessage(loadError, 'Could not load the operations board right now.')}
          actionLabel="Try again"
          onAction={() => {
            void refetchGroup();
            void refetchChores();
          }}
        />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <ScreenHeader title="Operations" topInset={insets.top} onBack={() => router.back()} />
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bgBase }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ marginBottom: space.lg }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: colors.textPrimary }}>
          Operations
        </Text>
        <Text style={{ marginTop: 4, fontSize: 14, color: colors.textTertiary }}>
          Keep recurring shared work visible so the space does not drift.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: space.base }}>
        <OperationsCard style={{ flex: 1, marginBottom: 0 }}>
          <Text style={{ fontSize: 13, color: colors.textTertiary }}>Overdue</Text>
          <Text style={{ marginTop: 6, fontSize: 24, fontWeight: '800', color: colors.textPrimary }}>
            {overdueChores.length}
          </Text>
        </OperationsCard>
        <OperationsCard style={{ flex: 1, marginBottom: 0 }}>
          <Text style={{ fontSize: 13, color: colors.textTertiary }}>Recurring</Text>
          <Text style={{ marginTop: 6, fontSize: 24, fontWeight: '800', color: colors.textPrimary }}>
            {recurringCount}
          </Text>
        </OperationsCard>
        <OperationsCard style={{ flex: 1, marginBottom: 0 }}>
          <Text style={{ fontSize: 13, color: colors.textTertiary }}>Checklists</Text>
          <Text style={{ marginTop: 6, fontSize: 24, fontWeight: '800', color: colors.textPrimary }}>
            {checklistCount}
          </Text>
        </OperationsCard>
      </View>

      <OperationsCard>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>
              Starter board
            </Text>
            <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 22, color: colors.textTertiary }}>
              {starterTemplates.length} recommended starter operations for this space type.
            </Text>
          </View>
          {isAdmin ? (
            <TouchableOpacity
              style={{
                backgroundColor: colors.sageSoft,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
              onPress={handleLoadStarterBoard}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.sage }}>
                Load starter board
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ marginTop: 14, gap: 8 }}>
          {starterTemplates.slice(0, 3).map((template) => (
            <Text key={template.title} style={{ fontSize: 13, color: colors.textTertiary }}>
              • {template.title}
            </Text>
          ))}
        </View>
      </OperationsCard>

      {isAdmin ? (
        <OperationsCard>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: showCreateForm ? 16 : 0,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>
                Add operation
              </Text>
              <Text style={{ marginTop: 4, fontSize: 14, color: colors.textTertiary }}>
                Create recurring work, one-off tasks, or checklist-based operations.
              </Text>
            </View>
            <TouchableOpacity
              style={{
                backgroundColor: showCreateForm ? colors.bgSubtle : colors.bgInk,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
              onPress={() => {
                hapticLight();
                setShowCreateForm((current) => !current);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: showCreateForm ? colors.textSecondary : colors.textInverse,
                }}
              >
                {showCreateForm ? 'Close' : 'New operation'}
              </Text>
            </TouchableOpacity>
          </View>

          {showCreateForm ? (
            <>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                Title
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.bgSubtle,
                  borderRadius: 12,
                  height: 50,
                  paddingHorizontal: 16,
                  fontSize: 16,
                  color: colors.textPrimary,
                }}
                placeholder="Kitchen reset"
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={setTitle}
              />

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.textSecondary,
                  marginBottom: 8,
                  marginTop: 16,
                }}
              >
                Description
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.bgSubtle,
                  borderRadius: 12,
                  minHeight: 80,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 16,
                  color: colors.textPrimary,
                  textAlignVertical: 'top',
                }}
                placeholder="Optional details"
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
              />

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.textSecondary,
                  marginBottom: 8,
                  marginTop: 16,
                }}
              >
                Category
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {CATEGORY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 18,
                      backgroundColor: category === option.value ? colors.bgInk : colors.bgSubtle,
                    }}
                    onPress={() => {
                      hapticLight();
                      setCategory(option.value);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '500',
                        color: category === option.value ? colors.textInverse : colors.textTertiary,
                      }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.textSecondary,
                  marginBottom: 8,
                  marginTop: 16,
                }}
              >
                Task type
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {TASK_TYPE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 14,
                      backgroundColor: taskType === option.value ? colors.sageSoft : colors.bgSubtle,
                      alignItems: 'center',
                    }}
                    onPress={() => {
                      hapticLight();
                      setTaskType(option.value);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: taskType === option.value ? colors.sage : colors.textTertiary,
                      }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.textSecondary,
                  marginBottom: 8,
                  marginTop: 16,
                }}
              >
                Frequency
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {FREQUENCY_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 18,
                      backgroundColor: frequency === option.value ? colors.sageSoft : colors.bgSubtle,
                    }}
                    onPress={() => {
                      hapticLight();
                      setFrequency(option.value);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '500',
                        color: frequency === option.value ? colors.sage : colors.textTertiary,
                      }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <DateField
                label="First due date"
                value={nextDueDate}
                onChange={setNextDueDate}
                hint={getFrequencyLabel(frequency, nextDueDate.toISOString().slice(0, 10))}
              />

              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                Assign to
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 18,
                    backgroundColor: assignedTo === null ? colors.bgInk : colors.bgSubtle,
                  }}
                  onPress={() => {
                    hapticLight();
                    setAssignedTo(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '500',
                      color: assignedTo === null ? colors.textInverse : colors.textTertiary,
                    }}
                  >
                    Unassigned
                  </Text>
                </TouchableOpacity>
                {members.map((member) => (
                  <TouchableOpacity
                    key={member.value}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 18,
                      backgroundColor: assignedTo === member.value ? colors.bgInk : colors.bgSubtle,
                    }}
                    onPress={() => {
                      hapticLight();
                      setAssignedTo(member.value);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '500',
                        color: assignedTo === member.value ? colors.textInverse : colors.textTertiary,
                      }}
                    >
                      {member.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {taskType === 'checklist' ? (
                <>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: colors.textSecondary,
                      marginBottom: 8,
                      marginTop: 16,
                    }}
                  >
                    Checklist items
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: colors.bgSubtle,
                      borderRadius: 12,
                      minHeight: 88,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      fontSize: 16,
                      color: colors.textPrimary,
                      textAlignVertical: 'top',
                    }}
                    placeholder={'Open space\nRestock supplies\nLock up'}
                    placeholderTextColor={colors.textMuted}
                    value={checklistText}
                    onChangeText={setChecklistText}
                    multiline
                  />
                </>
              ) : null}

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: colors.textSecondary,
                  marginBottom: 8,
                  marginTop: 16,
                }}
              >
                Escalation days
              </Text>
              <TextInput
                style={{
                  backgroundColor: colors.bgSubtle,
                  borderRadius: 12,
                  height: 50,
                  paddingHorizontal: 16,
                  fontSize: 16,
                  color: colors.textPrimary,
                }}
                placeholder="Optional, e.g. 2"
                placeholderTextColor={colors.textMuted}
                value={escalationDays}
                onChangeText={setEscalationDays}
                keyboardType="number-pad"
              />

              <TouchableOpacity
                style={{
                  marginTop: 20,
                  backgroundColor: colors.bgInk,
                  height: 52,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => {
                  void handleCreateOperation();
                }}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textInverse }}>
                  Create operation
                </Text>
              </TouchableOpacity>
            </>
          ) : null}
        </OperationsCard>
      ) : null}

      {!chores.length ? (
        <OperationsCard>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
            No operations yet
          </Text>
          <Text style={{ marginTop: 6, fontSize: 14, lineHeight: 22, color: colors.textTertiary }}>
            Add recurring and one-off operations to keep this space running smoothly.
          </Text>
        </OperationsCard>
      ) : (
        <>
          {overdueChores.length > 0 ? (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ marginBottom: 10, fontSize: 13, fontWeight: '700', color: colors.dangerText }}>
                Overdue ({overdueChores.length})
              </Text>
              {overdueChores.map((chore: any) => (
                <OperationItem
                  key={chore.id}
                  chore={chore}
                  isAdmin={isAdmin}
                  isOverdue
                  onComplete={() => handleCompleteOperation(chore.id, chore.title)}
                  onDelete={() => handleDeleteOperation(chore.id, chore.title)}
                />
              ))}
            </View>
          ) : null}

          {upcomingChores.length > 0 ? (
            <View>
              <Text style={{ marginBottom: 10, fontSize: 13, fontWeight: '700', color: colors.textTertiary }}>
                Upcoming ({upcomingChores.length})
              </Text>
              {upcomingChores.map((chore: any) => (
                <OperationItem
                  key={chore.id}
                  chore={chore}
                  isAdmin={isAdmin}
                  isOverdue={false}
                  onComplete={() => handleCompleteOperation(chore.id, chore.title)}
                  onDelete={() => handleDeleteOperation(chore.id, chore.title)}
                />
              ))}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
    </View>
  );
}

function OperationItem({
  chore,
  isOverdue,
  isAdmin,
  onComplete,
  onDelete,
}: {
  chore: any;
  isOverdue: boolean;
  isAdmin: boolean;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const checklistCount = Array.isArray(chore.checklist_items) ? chore.checklist_items.length : 0;
  const overdueDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(`${chore.next_due}T00:00:00`).getTime()) / 86_400_000),
  );
  const isEscalated =
    isOverdue &&
    chore.escalation_days != null &&
    overdueDays >= chore.escalation_days;

  return (
    <OperationsCard style={isOverdue ? { borderWidth: 1, borderColor: colors.dangerText } : undefined}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 16,
                backgroundColor: isOverdue ? colors.dangerBg : colors.bgSubtle,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: isOverdue ? colors.dangerText : colors.textTertiary,
                }}
              >
                {isOverdue ? 'Overdue' : `Due ${dueLabel(chore.next_due)}`}
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 16,
                backgroundColor: colors.sageSoft,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.sage }}>
                {formatCategoryLabel(chore.category)}
              </Text>
            </View>
            {isEscalated ? (
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 16,
                  backgroundColor: colors.dangerBg,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.dangerText }}>
                  Escalated
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>
            {chore.title}
          </Text>
          {chore.description ? (
            <Text style={{ marginTop: 6, fontSize: 14, lineHeight: 22, color: colors.textTertiary }}>
              {chore.description}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              {getFrequencyLabel(chore.frequency, chore.next_due)}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textMuted }}>
              {chore.task_type === 'checklist'
                ? 'Checklist'
                : chore.task_type === 'one_off'
                  ? 'One-off'
                  : 'Recurring'}
            </Text>
            {checklistCount > 0 ? (
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                {checklistCount} item{checklistCount === 1 ? '' : 's'}
              </Text>
            ) : null}
            {chore.assigned_user?.name ? (
              <Text style={{ fontSize: 12, color: colors.textMuted }}>
                {chore.assigned_user.name}
              </Text>
            ) : null}
          </View>

          {chore.last_completion?.completed_user?.name ? (
            <Text style={{ marginTop: 8, fontSize: 12, color: colors.textMuted }}>
              Last done by {chore.last_completion.completed_user.name}
            </Text>
          ) : null}

          {checklistCount > 0 ? (
            <Text style={{ marginTop: 8, fontSize: 12, lineHeight: 18, color: colors.textMuted }}>
              {chore.checklist_items.join(' • ')}
            </Text>
          ) : null}
        </View>

        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <TouchableOpacity
            style={{
              backgroundColor: colors.owedBg,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
            onPress={onComplete}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.owedText }}>
              Done
            </Text>
          </TouchableOpacity>
          {isAdmin ? (
            <TouchableOpacity
              style={{
                backgroundColor: colors.dangerBg,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
              onPress={onDelete}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.dangerText }}>
                Remove
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </OperationsCard>
  );
}
