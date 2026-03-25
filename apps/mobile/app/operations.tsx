import { type ReactNode, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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

export default function OperationsScreen() {
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
          icon="checkmark-circle-outline"
          title="No group selected"
          description="Pick a group before managing its operations board."
        />
      </Screen>
    );
  }

  if (groupLoading || choresLoading) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#FAFAFA' }}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      >
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              height: 140,
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

  if (loadError || !group) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
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
    <ScrollView
      style={{ flex: 1, backgroundColor: '#FAFAFA' }}
      contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#171b24' }}>
          Operations
        </Text>
        <Text style={{ marginTop: 4, fontSize: 14, color: '#667085' }}>
          Keep recurring shared work visible so the space does not drift.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <OperationsCard style={{ flex: 1, marginBottom: 0 }}>
          <Text style={{ fontSize: 13, color: '#667085' }}>Overdue</Text>
          <Text style={{ marginTop: 6, fontSize: 24, fontWeight: '800', color: '#171b24' }}>
            {overdueChores.length}
          </Text>
        </OperationsCard>
        <OperationsCard style={{ flex: 1, marginBottom: 0 }}>
          <Text style={{ fontSize: 13, color: '#667085' }}>Recurring</Text>
          <Text style={{ marginTop: 6, fontSize: 24, fontWeight: '800', color: '#171b24' }}>
            {recurringCount}
          </Text>
        </OperationsCard>
        <OperationsCard style={{ flex: 1, marginBottom: 0 }}>
          <Text style={{ fontSize: 13, color: '#667085' }}>Checklists</Text>
          <Text style={{ marginTop: 6, fontSize: 24, fontWeight: '800', color: '#171b24' }}>
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
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24' }}>
              Starter board
            </Text>
            <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 22, color: '#667085' }}>
              {starterTemplates.length} recommended starter operations for this space type.
            </Text>
          </View>
          {isAdmin ? (
            <TouchableOpacity
              style={{
                backgroundColor: '#EEF6F3',
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
              onPress={handleLoadStarterBoard}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#2d6a4f' }}>
                Load starter board
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ marginTop: 14, gap: 8 }}>
          {starterTemplates.slice(0, 3).map((template) => (
            <Text key={template.title} style={{ fontSize: 13, color: '#667085' }}>
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
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24' }}>
                Add operation
              </Text>
              <Text style={{ marginTop: 4, fontSize: 14, color: '#667085' }}>
                Create recurring work, one-off tasks, or checklist-based operations.
              </Text>
            </View>
            <TouchableOpacity
              style={{
                backgroundColor: showCreateForm ? '#F3F4F6' : '#1f2330',
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
                  color: showCreateForm ? '#374151' : '#FFFFFF',
                }}
              >
                {showCreateForm ? 'Close' : 'New operation'}
              </Text>
            </TouchableOpacity>
          </View>

          {showCreateForm ? (
            <>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                Title
              </Text>
              <TextInput
                style={{
                  backgroundColor: '#F3F4F6',
                  borderRadius: 12,
                  height: 50,
                  paddingHorizontal: 16,
                  fontSize: 16,
                  color: '#111827',
                }}
                placeholder="Kitchen reset"
                placeholderTextColor="#9CA3AF"
                value={title}
                onChangeText={setTitle}
              />

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: 8,
                  marginTop: 16,
                }}
              >
                Description
              </Text>
              <TextInput
                style={{
                  backgroundColor: '#F3F4F6',
                  borderRadius: 12,
                  minHeight: 80,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 16,
                  color: '#111827',
                  textAlignVertical: 'top',
                }}
                placeholder="Optional details"
                placeholderTextColor="#9CA3AF"
                value={description}
                onChangeText={setDescription}
                multiline
              />

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#374151',
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
                      backgroundColor: category === option.value ? '#1f2330' : '#F3F4F6',
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
                        color: category === option.value ? '#FFFFFF' : '#6B7280',
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
                  color: '#374151',
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
                      backgroundColor: taskType === option.value ? '#EEF6F3' : '#F3F4F6',
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
                        color: taskType === option.value ? '#2d6a4f' : '#6B7280',
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
                  color: '#374151',
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
                      backgroundColor: frequency === option.value ? '#EEF6F3' : '#F3F4F6',
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
                        color: frequency === option.value ? '#2d6a4f' : '#6B7280',
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

              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                Assign to
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 18,
                    backgroundColor: assignedTo === null ? '#1f2330' : '#F3F4F6',
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
                      color: assignedTo === null ? '#FFFFFF' : '#6B7280',
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
                      backgroundColor: assignedTo === member.value ? '#1f2330' : '#F3F4F6',
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
                        color: assignedTo === member.value ? '#FFFFFF' : '#6B7280',
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
                      color: '#374151',
                      marginBottom: 8,
                      marginTop: 16,
                    }}
                  >
                    Checklist items
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: '#F3F4F6',
                      borderRadius: 12,
                      minHeight: 88,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      fontSize: 16,
                      color: '#111827',
                      textAlignVertical: 'top',
                    }}
                    placeholder={'Open space\nRestock supplies\nLock up'}
                    placeholderTextColor="#9CA3AF"
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
                  color: '#374151',
                  marginBottom: 8,
                  marginTop: 16,
                }}
              >
                Escalation days
              </Text>
              <TextInput
                style={{
                  backgroundColor: '#F3F4F6',
                  borderRadius: 12,
                  height: 50,
                  paddingHorizontal: 16,
                  fontSize: 16,
                  color: '#111827',
                }}
                placeholder="Optional, e.g. 2"
                placeholderTextColor="#9CA3AF"
                value={escalationDays}
                onChangeText={setEscalationDays}
                keyboardType="number-pad"
              />

              <TouchableOpacity
                style={{
                  marginTop: 20,
                  backgroundColor: '#1f2330',
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
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
                  Create operation
                </Text>
              </TouchableOpacity>
            </>
          ) : null}
        </OperationsCard>
      ) : null}

      {!chores.length ? (
        <OperationsCard>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#171b24' }}>
            No operations yet
          </Text>
          <Text style={{ marginTop: 6, fontSize: 14, lineHeight: 22, color: '#667085' }}>
            Add recurring and one-off operations to keep this space running smoothly.
          </Text>
        </OperationsCard>
      ) : (
        <>
          {overdueChores.length > 0 ? (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ marginBottom: 10, fontSize: 13, fontWeight: '700', color: '#DC2626' }}>
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
              <Text style={{ marginBottom: 10, fontSize: 13, fontWeight: '700', color: '#6B7280' }}>
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
    <OperationsCard style={isOverdue ? { borderWidth: 1, borderColor: '#FCA5A5' } : undefined}>
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
                backgroundColor: isOverdue ? '#FEF2F2' : '#F3F4F6',
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: isOverdue ? '#DC2626' : '#6B7280',
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
                backgroundColor: '#EEF6F3',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#2d6a4f' }}>
                {formatCategoryLabel(chore.category)}
              </Text>
            </View>
            {isEscalated ? (
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 16,
                  backgroundColor: '#FEF2F2',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#DC2626' }}>
                  Escalated
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={{ fontSize: 16, fontWeight: '700', color: '#171b24' }}>
            {chore.title}
          </Text>
          {chore.description ? (
            <Text style={{ marginTop: 6, fontSize: 14, lineHeight: 22, color: '#667085' }}>
              {chore.description}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            <Text style={{ fontSize: 12, color: '#98a1b0' }}>
              {getFrequencyLabel(chore.frequency, chore.next_due)}
            </Text>
            <Text style={{ fontSize: 12, color: '#98a1b0' }}>
              {chore.task_type === 'checklist'
                ? 'Checklist'
                : chore.task_type === 'one_off'
                  ? 'One-off'
                  : 'Recurring'}
            </Text>
            {checklistCount > 0 ? (
              <Text style={{ fontSize: 12, color: '#98a1b0' }}>
                {checklistCount} item{checklistCount === 1 ? '' : 's'}
              </Text>
            ) : null}
            {chore.assigned_user?.name ? (
              <Text style={{ fontSize: 12, color: '#98a1b0' }}>
                {chore.assigned_user.name}
              </Text>
            ) : null}
          </View>

          {chore.last_completion?.completed_user?.name ? (
            <Text style={{ marginTop: 8, fontSize: 12, color: '#98a1b0' }}>
              Last done by {chore.last_completion.completed_user.name}
            </Text>
          ) : null}

          {checklistCount > 0 ? (
            <Text style={{ marginTop: 8, fontSize: 12, lineHeight: 18, color: '#98a1b0' }}>
              {chore.checklist_items.join(' • ')}
            </Text>
          ) : null}
        </View>

        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <TouchableOpacity
            style={{
              backgroundColor: '#ECFDF5',
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
            onPress={onComplete}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#059669' }}>
              Done
            </Text>
          </TouchableOpacity>
          {isAdmin ? (
            <TouchableOpacity
              style={{
                backgroundColor: '#FEF2F2',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
              onPress={onDelete}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#DC2626' }}>
                Remove
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </OperationsCard>
  );
}
