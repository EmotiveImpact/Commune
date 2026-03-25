import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  countCompletedSetupChecklistItems,
  createSetupChecklistProgress,
  getGroupSubtypeOptions,
  getSpaceEssentialDefinitions,
  getSpacePreset,
  getWorkspaceGovernancePreview,
  normalizeSpaceEssentials,
} from '@commune/core';
import { GroupType, type SetupChecklistProgress, type SpaceEssentials } from '@commune/types';
import { formatCurrency } from '@commune/utils';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useGroup, useUpdateGroup } from '@/hooks/use-groups';
import { getErrorMessage } from '@/lib/errors';
import {
  hapticHeavy,
  hapticMedium,
  hapticSelection,
  hapticSuccess,
  hapticWarning,
} from '@/lib/haptics';

const GROUP_TYPE_OPTIONS = [
  { value: GroupType.HOME, label: 'Household' },
  { value: GroupType.COUPLE, label: 'Couple' },
  { value: GroupType.WORKSPACE, label: 'Workspace' },
  { value: GroupType.PROJECT, label: 'Project' },
  { value: GroupType.TRIP, label: 'Trip' },
  { value: GroupType.OTHER, label: 'Other' },
] as const;

const CURRENCIES = ['GBP', 'USD', 'EUR', 'CAD', 'AUD', 'NGN', 'GHS', 'ZAR', 'INR', 'JPY'] as const;

function formatLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function Card({
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

function EmptyStateCard({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#FAFAFA',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
      }}
    >
      <Card style={{ alignItems: 'center' }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#F3F4F6',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Ionicons name={icon} size={24} color="#9CA3AF" />
        </View>
        <Text style={{ fontSize: 17, fontWeight: '600', color: '#111827', marginBottom: 6 }}>
          {title}
        </Text>
        <Text
          style={{
            fontSize: 14,
            lineHeight: 20,
            color: '#6B7280',
            textAlign: 'center',
            maxWidth: 280,
            marginBottom: actionLabel ? 16 : 0,
          }}
        >
          {description}
        </Text>
        {actionLabel && onAction ? (
          <TouchableOpacity onPress={onAction}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#2d6a4f' }}>
              {actionLabel}
            </Text>
          </TouchableOpacity>
        ) : null}
      </Card>
    </View>
  );
}

export default function GroupEditScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeGroupId } = useGroupStore();
  const {
    data: group,
    isLoading,
    error: groupError,
    refetch: refetchGroup,
  } = useGroup(activeGroupId ?? '');
  const updateGroup = useUpdateGroup(activeGroupId ?? '');

  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof GroupType)[keyof typeof GroupType]>(GroupType.HOME);
  const [subtype, setSubtype] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>('GBP');
  const [cycleDate, setCycleDate] = useState('1');
  const [description, setDescription] = useState('');
  const [approvalThreshold, setApprovalThreshold] = useState('');
  const [spaceEssentials, setSpaceEssentials] = useState<SpaceEssentials>({});
  const [setupChecklistProgress, setSetupChecklistProgress] =
    useState<SetupChecklistProgress>({});
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  useEffect(() => {
    if (!group) {
      return;
    }

    setName(group.name);
    setType(group.type ?? GroupType.HOME);
    setSubtype(group.subtype ?? null);
    setCurrency(group.currency ?? 'GBP');
    setCycleDate(String(group.cycle_date ?? 1));
    setDescription(group.description ?? '');
    setApprovalThreshold(
      group.approval_threshold != null ? String(group.approval_threshold) : '',
    );
    setSpaceEssentials(
      normalizeSpaceEssentials(group.type, group.space_essentials, group.house_info),
    );
    setSetupChecklistProgress(
      createSetupChecklistProgress(
        group.type,
        group.subtype,
        group.setup_checklist_progress,
      ),
    );
  }, [group]);

  const isAdmin = useMemo(
    () =>
      group?.members.some(
        (member) => member.user_id === user?.id && member.role === 'admin',
      ) ?? false,
    [group?.members, user?.id],
  );

  const subtypeOptions = getGroupSubtypeOptions(type);
  const essentialDefinitions = getSpaceEssentialDefinitions(type);
  const preset = getSpacePreset(type, subtype);
  const checklistProgress = createSetupChecklistProgress(type, subtype, setupChecklistProgress);
  const checklistEntries = Object.entries(checklistProgress);
  const completedChecklistCount = countCompletedSetupChecklistItems(checklistProgress);
  const approvalThresholdInput = approvalThreshold.trim();
  const approvalThresholdPreview =
    approvalThresholdInput.length > 0 && Number.isFinite(Number(approvalThresholdInput))
      ? Number(approvalThresholdInput)
      : null;
  const workspaceGovernance = useMemo(
    () =>
      getWorkspaceGovernancePreview({
        type,
        subtype,
        currency,
        approval_threshold:
          type === GroupType.WORKSPACE
            ? approvalThresholdPreview ?? group?.approval_threshold ?? null
            : null,
        approval_policy: type === GroupType.WORKSPACE ? group?.approval_policy ?? null : null,
      }),
    [
      approvalThresholdPreview,
      currency,
      group?.approval_policy,
      group?.approval_threshold,
      subtype,
      type,
    ],
  );
  const workspaceResponsibilityPresets = workspaceGovernance.rolePresets;
  const approvalThresholdLabel =
    approvalThresholdPreview != null
      ? formatCurrency(approvalThresholdPreview, group?.currency ?? 'GBP')
      : group?.approval_threshold != null
        ? formatCurrency(group.approval_threshold, group.currency)
        : null;

  if (!activeGroupId) {
    return (
      <EmptyStateCard
        icon="settings-outline"
        title="No group selected"
        description="Pick a group from the dashboard first."
        actionLabel="Go back"
        onAction={() => router.back()}
      />
    );
  }

  if (groupError) {
    return (
      <EmptyStateCard
        icon="cloud-offline-outline"
        title="Could not load group"
        description={getErrorMessage(groupError, 'Something went wrong loading group details.')}
        actionLabel="Try again"
        onAction={() => {
          void refetchGroup();
        }}
      />
    );
  }

  if (isLoading || !group) {
    return (
      <ScrollView
        style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24, backgroundColor: '#FAFAFA' }}
      >
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              marginBottom: 16,
              borderRadius: 16,
              height: 120,
              backgroundColor: '#E5E7EB',
              opacity: 0.5,
            }}
          />
        ))}
      </ScrollView>
    );
  }

  if (!isAdmin) {
    return (
      <EmptyStateCard
        icon="lock-closed-outline"
        title="Admin access required"
        description="Only group admins can edit group settings."
        actionLabel="Go back"
        onAction={() => router.back()}
      />
    );
  }

  function handleTypeChange(nextType: (typeof GroupType)[keyof typeof GroupType]) {
    hapticSelection();
    setType(nextType);
    if (!getGroupSubtypeOptions(nextType).some((option) => option.value === subtype)) {
      setSubtype(null);
    }
  }

  function handleApplyRecommendedEssentials() {
    let appliedCount = 0;

    setSpaceEssentials((current) => {
      const next = { ...current };

      for (const definition of essentialDefinitions) {
        const currentValue = current[definition.key]?.value?.trim();
        const seededValue = preset.essentialSeeds[definition.key];

        if (currentValue || !seededValue) {
          continue;
        }

        next[definition.key] = {
          label: definition.label,
          value: seededValue,
          visible: current[definition.key]?.visible ?? definition.defaultVisible !== false,
        };
        appliedCount += 1;
      }

      return next;
    });

    if (appliedCount === 0) {
      Alert.alert('Nothing to load', 'Recommended setup notes are already filled in.');
      return;
    }

    hapticSuccess();
    Alert.alert(
      'Recommended setup added',
      `${appliedCount} setup note${appliedCount === 1 ? '' : 's'} added to your essentials.`,
    );
  }

  async function handleSave() {
    hapticMedium();

    const trimmedName = name.trim();
    const parsedCycleDate = Number(cycleDate);
    const trimmedApprovalThreshold = approvalThreshold.trim();
    const parsedApprovalThreshold =
      trimmedApprovalThreshold.length > 0 ? Number(trimmedApprovalThreshold) : null;

    if (!trimmedName) {
      hapticWarning();
      Alert.alert('Validation error', 'Group name is required.');
      return;
    }

    if (!Number.isInteger(parsedCycleDate) || parsedCycleDate < 1 || parsedCycleDate > 28) {
      hapticWarning();
      Alert.alert('Validation error', 'Cycle close day must be a number from 1 to 28.');
      return;
    }

    if (
      type === GroupType.WORKSPACE
      && trimmedApprovalThreshold.length > 0
      && (!Number.isFinite(parsedApprovalThreshold) || (parsedApprovalThreshold ?? 0) < 0)
    ) {
      hapticWarning();
      Alert.alert(
        'Validation error',
        'Approval threshold must be a positive number or left blank to disable it.',
      );
      return;
    }

    const normalizedEssentials = essentialDefinitions.reduce<SpaceEssentials>((acc, definition) => {
      const current = spaceEssentials[definition.key];
      if (!current?.value?.trim()) {
        return acc;
      }

      acc[definition.key] = {
        label: definition.label,
        value: current.value.trim(),
        visible: current.visible,
      };
      return acc;
    }, {});

    try {
      await updateGroup.mutateAsync({
        name: trimmedName,
        type,
        subtype,
        currency,
        cycle_date: parsedCycleDate,
        description: description.trim() || null,
        approval_threshold:
          type === GroupType.WORKSPACE
            ? parsedApprovalThreshold
            : group?.approval_threshold ?? null,
        approval_policy:
          type === GroupType.WORKSPACE
            ? {
                threshold: parsedApprovalThreshold,
                allowed_roles:
                  group?.approval_policy?.allowed_roles?.length
                    ? group.approval_policy.allowed_roles
                    : ['admin'],
                allowed_labels:
                  group?.approval_policy?.allowed_labels?.length
                    ? group.approval_policy.allowed_labels
                    : workspaceResponsibilityPresets
                        .filter((presetItem) => presetItem.can_approve && presetItem.responsibility_label)
                        .map((presetItem) => presetItem.responsibility_label as string),
                role_presets: workspaceResponsibilityPresets,
              }
            : null,
        house_info:
          type === GroupType.HOME
            ? Object.fromEntries(
                Object.entries(normalizedEssentials).map(([key, entry]) => [key, entry.value]),
              )
            : null,
        space_essentials:
          Object.keys(normalizedEssentials).length > 0 ? normalizedEssentials : null,
        setup_checklist_progress: checklistProgress,
      });
      hapticSuccess();
      Alert.alert('Saved', 'Group settings have been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      hapticWarning();
      Alert.alert('Update failed', getErrorMessage(error, 'Could not save group settings.'));
    }
  }

  function handleDeleteGroup() {
    hapticHeavy();
    if (deleteConfirmation !== 'DELETE') {
      hapticWarning();
      Alert.alert('Confirmation required', 'Type DELETE to confirm.');
      return;
    }

    Alert.alert(
      'Delete group permanently?',
      'This action is not wired on mobile yet. Use the web admin flow if you need to delete the group right now.',
      [{ text: 'OK' }],
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
          Edit group
        </Text>
        <Text style={{ marginTop: 4, fontSize: 14, color: '#667085' }}>
          Keep the shared-space setup, essentials, and close rhythm current.
        </Text>
        <View style={{ marginTop: 12, flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: '#F3F4F6',
            }}
            onPress={() => {
              hapticMedium();
              router.push('/group-close');
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>
              Open cycle close
            </Text>
          </TouchableOpacity>
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: '#EEF6F3',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#2d6a4f' }}>
              {completedChecklistCount}/{checklistEntries.length} setup done
            </Text>
          </View>
        </View>
      </View>

      <Card>
        <Text style={{ marginBottom: 4, fontSize: 18, fontWeight: '600', color: '#171b24' }}>
          Group basics
        </Text>
        <Text style={{ marginBottom: 16, fontSize: 14, color: '#667085' }}>
          Name the group clearly and keep the cycle close day accurate.
        </Text>

        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
          Group name
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
          placeholder="Enter group name"
          placeholderTextColor="#9CA3AF"
          value={name}
          onChangeText={setName}
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
            minHeight: 88,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 16,
            color: '#111827',
            textAlignVertical: 'top',
          }}
          placeholder="Optional details about the group"
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
          Cycle close day
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
          placeholder="1"
          placeholderTextColor="#9CA3AF"
          value={cycleDate}
          onChangeText={setCycleDate}
          keyboardType="number-pad"
          maxLength={2}
        />
      </Card>

      <Card>
        <Text style={{ marginBottom: 4, fontSize: 18, fontWeight: '600', color: '#171b24' }}>
          Space type
        </Text>
        <Text style={{ marginBottom: 12, fontSize: 14, color: '#667085' }}>
          Keep the shared model consistent, then use subtype logic for better defaults.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {GROUP_TYPE_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 20,
                backgroundColor: type === option.value ? '#1f2330' : '#F3F4F6',
              }}
              onPress={() => handleTypeChange(option.value)}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: type === option.value ? '#FFFFFF' : '#6B7280',
                }}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {subtypeOptions.length > 0 ? (
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
              Subtype
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {subtypeOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 18,
                    backgroundColor: subtype === option.value ? '#EEF6F3' : '#F3F4F6',
                  }}
                  onPress={() => {
                    hapticSelection();
                    setSubtype(option.value);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '500',
                      color: subtype === option.value ? '#2d6a4f' : '#6B7280',
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
          Currency
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {CURRENCIES.map((option) => (
            <TouchableOpacity
              key={option}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 20,
                backgroundColor: currency === option ? '#1f2330' : '#F3F4F6',
              }}
              onPress={() => {
                hapticSelection();
                setCurrency(option);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '500',
                  color: currency === option ? '#FFFFFF' : '#6B7280',
                }}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24' }}>
              {preset.title}
            </Text>
            <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 22, color: '#667085' }}>
              {preset.summary}
            </Text>
          </View>
          <View
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: '#EEF6F3',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#2d6a4f' }}>
              {preset.suggestedCategories.length} categories
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          {preset.suggestedCategories.slice(0, 4).map((category) => (
            <View
              key={category}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 16,
                backgroundColor: '#F3F4F6',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '500', color: '#6B7280' }}>
                {formatLabel(category)}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          onPress={handleApplyRecommendedEssentials}
          activeOpacity={0.7}
        >
          <Ionicons name="sparkles-outline" size={16} color="#2d6a4f" />
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#2d6a4f' }}>
            Load recommended setup notes
          </Text>
        </TouchableOpacity>
      </Card>

      {type === GroupType.WORKSPACE ? (
        <Card>
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24' }}>
              Workspace responsibilities
            </Text>
            <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 22, color: '#667085' }}>
              Use these role labels to keep approvals, billing, and vendor follow-up visible without inventing a separate workflow.
            </Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {workspaceResponsibilityPresets.map((presetItem) => (
              <View
                key={presetItem.label}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 18,
                  backgroundColor: '#F3F4F6',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>
                  {presetItem.label}
                </Text>
                {presetItem.can_approve ? (
                  <Text style={{ marginTop: 4, fontSize: 11, color: '#2d6a4f' }}>
                    Can approve
                  </Text>
                ) : null}
              </View>
            ))}
          </View>

          <View
            style={{
              marginTop: 14,
              borderRadius: 14,
              backgroundColor: '#F9FAFB',
              padding: 14,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#171b24', marginBottom: 8 }}>
              Suggested chain
            </Text>
            <Text style={{ fontSize: 12, lineHeight: 18, color: '#667085' }}>
              {workspaceGovernance.approvalSummary}
            </Text>
            {workspaceResponsibilityPresets.map((presetItem) => (
              <Text
                key={presetItem.label}
                style={{ fontSize: 12, lineHeight: 18, color: '#667085', marginTop: 6 }}
              >
                {presetItem.label}: {presetItem.description}
              </Text>
            ))}
          </View>

          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
              Approval threshold
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
              placeholder="Leave empty to disable"
              placeholderTextColor="#9CA3AF"
              value={approvalThreshold}
              onChangeText={setApprovalThreshold}
              keyboardType="decimal-pad"
            />
            <Text style={{ marginTop: 8, fontSize: 12, lineHeight: 18, color: '#667085' }}>
              {approvalThresholdInput.length > 0
                ? approvalThresholdLabel != null
                  ? `Expenses above ${approvalThresholdLabel} move into admin approval before they settle.`
                  : 'Enter a positive number to enable approval review.'
                : group?.approval_threshold != null
                  ? `Current threshold is ${formatCurrency(group.approval_threshold, group.currency)}. Leave blank to disable the review step.`
                  : 'Leave this blank to disable the review step.'}
            </Text>
          </View>
        </Card>
      ) : null}

      <Card>
        <Text style={{ marginBottom: 4, fontSize: 18, fontWeight: '600', color: '#171b24' }}>
          Space essentials
        </Text>
        <Text style={{ marginBottom: 16, fontSize: 14, color: '#667085' }}>
          Capture the practical details people should not have to ask for twice.
        </Text>

        {essentialDefinitions.map((definition) => {
          const entry = spaceEssentials[definition.key];

          return (
            <View key={definition.key} style={{ marginBottom: 16 }}>
              <View
                style={{
                  marginBottom: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
                    {definition.label}
                  </Text>
                  {definition.description ? (
                    <Text style={{ marginTop: 2, fontSize: 12, color: '#98a1b0' }}>
                      {definition.description}
                    </Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Switch
                    value={entry?.visible ?? definition.defaultVisible !== false}
                    onValueChange={(nextVisible) => {
                      setSpaceEssentials((current) => ({
                        ...current,
                        [definition.key]: {
                          label: definition.label,
                          value: current[definition.key]?.value ?? '',
                          visible: nextVisible,
                        },
                      }));
                    }}
                    trackColor={{ false: '#D1D5DB', true: '#84CC16' }}
                    thumbColor="#FFFFFF"
                  />
                  <Text style={{ marginTop: 4, fontSize: 11, color: '#98a1b0' }}>
                    Visible
                  </Text>
                </View>
              </View>

              <TextInput
                style={{
                  backgroundColor: '#F3F4F6',
                  borderRadius: 12,
                  minHeight: definition.kind === 'textarea' ? 88 : 50,
                  paddingHorizontal: 16,
                  paddingVertical: definition.kind === 'textarea' ? 14 : 0,
                  fontSize: 16,
                  color: '#111827',
                  textAlignVertical: definition.kind === 'textarea' ? 'top' : 'center',
                }}
                placeholder={definition.placeholder}
                placeholderTextColor="#9CA3AF"
                value={entry?.value ?? ''}
                onChangeText={(value) => {
                  setSpaceEssentials((current) => ({
                    ...current,
                    [definition.key]: {
                      label: definition.label,
                      value,
                      visible: current[definition.key]?.visible ?? definition.defaultVisible !== false,
                    },
                  }));
                }}
                multiline={definition.kind === 'textarea'}
              />
            </View>
          );
        })}
      </Card>

      <Card>
        <View
          style={{
            marginBottom: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24' }}>
              Setup checklist
            </Text>
            <Text style={{ marginTop: 4, fontSize: 14, color: '#667085' }}>
              Track the shared-space basics that should be settled before handovers and cycle close.
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: '#F3F4F6',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280' }}>
              {completedChecklistCount}/{checklistEntries.length}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 14 }}>
          <TouchableOpacity
            onPress={() => {
              hapticSelection();
              setSetupChecklistProgress(
                Object.fromEntries(
                  checklistEntries.map(([id, entry]) => [
                    id,
                    {
                      ...entry,
                      completed: true,
                      completed_at: new Date().toISOString(),
                    },
                  ]),
                ),
              );
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#2d6a4f' }}>
              Mark all
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              hapticSelection();
              setSetupChecklistProgress(
                Object.fromEntries(
                  checklistEntries.map(([id, entry]) => [
                    id,
                    { ...entry, completed: false, completed_at: null },
                  ]),
                ),
              );
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#667085' }}>
              Reset
            </Text>
          </TouchableOpacity>
        </View>

        {checklistEntries.map(([id, entry]) => (
          <TouchableOpacity
            key={id}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 12,
              paddingVertical: 10,
            }}
            onPress={() => {
              hapticSelection();
              setSetupChecklistProgress((current) => {
                const nextChecklist = createSetupChecklistProgress(type, subtype, current);
                const currentEntry = nextChecklist[id];
                if (!currentEntry) {
                  return nextChecklist;
                }
                return {
                  ...nextChecklist,
                  [id]: {
                    ...currentEntry,
                    completed: !currentEntry.completed,
                    completed_at: !currentEntry.completed ? new Date().toISOString() : null,
                  },
                };
              });
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={entry.completed ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={entry.completed ? '#2d6a4f' : '#9CA3AF'}
              style={{ marginTop: 1 }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 20,
                  color: entry.completed ? '#6B7280' : '#171b24',
                  textDecorationLine: entry.completed ? 'line-through' : 'none',
                }}
              >
                {entry.label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </Card>

      <Card>
        <View
          style={{
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24' }}>
              Members
            </Text>
            <Text style={{ marginTop: 4, fontSize: 14, color: '#667085' }}>
              {group.members.length} member{group.members.length !== 1 ? 's' : ''} in this group
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              hapticMedium();
              router.push('/members');
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#2d6a4f' }}>
              Manage members
            </Text>
          </TouchableOpacity>
        </View>

        {group.members.map((member, index) => {
          const displayName = member.user.name ?? member.user.email;
          const initials = displayName
            .split(' ')
            .map((part: string) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          return (
            <View
              key={member.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: '#F0F0F0',
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#1f2330',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF' }}>
                  {initials}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#171b24' }}>
                  {displayName}
                  {member.user_id === user?.id ? ' (you)' : ''}
                </Text>
                <Text style={{ marginTop: 2, fontSize: 12, color: '#667085' }}>
                  {member.user.email}
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 20,
                  backgroundColor: member.role === 'admin' ? '#ECFDF5' : '#F3F4F6',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '500',
                    color: member.role === 'admin' ? '#059669' : '#6B7280',
                  }}
                >
                  {formatLabel(member.role)}
                </Text>
              </View>
            </View>
          );
        })}
      </Card>

      <TouchableOpacity
        style={{
          backgroundColor: updateGroup.isPending ? '#D1D5DB' : '#1f2330',
          height: 52,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
        }}
        onPress={handleSave}
        disabled={updateGroup.isPending}
        activeOpacity={0.8}
      >
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
          Save changes
        </Text>
      </TouchableOpacity>

      <Card style={{ borderLeftWidth: 4, borderLeftColor: '#DC2626' }}>
        <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              marginRight: 12,
              height: 40,
              width: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              backgroundColor: '#FEF2F2',
            }}
          >
            <Ionicons name="warning-outline" size={18} color="#DC2626" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#DC2626' }}>
              Danger zone
            </Text>
            <Text style={{ marginTop: 2, fontSize: 14, color: '#667085' }}>
              Irreversible actions
            </Text>
          </View>
        </View>

        <Text style={{ fontSize: 14, lineHeight: 24, color: '#667085' }}>
          Deleting this group permanently removes expenses, payments, and member data.
        </Text>

        <Text
          style={{
            marginTop: 16,
            marginBottom: 8,
            fontSize: 14,
            fontWeight: '600',
            color: '#374151',
          }}
        >
          Type DELETE to confirm
        </Text>
        <TextInput
          style={{
            marginBottom: 16,
            height: 50,
            borderRadius: 12,
            borderWidth: 1,
            paddingHorizontal: 16,
            fontSize: 16,
            borderColor: 'rgba(220,38,38,0.2)',
            backgroundColor: '#FEF2F2',
            color: '#DC2626',
          }}
          placeholder="DELETE"
          placeholderTextColor="rgba(220,38,38,0.3)"
          value={deleteConfirmation}
          onChangeText={setDeleteConfirmation}
          autoCapitalize="characters"
        />

        <TouchableOpacity
          style={{
            backgroundColor: deleteConfirmation === 'DELETE' ? '#FEF2F2' : '#F9FAFB',
            height: 52,
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: deleteConfirmation === 'DELETE' ? 1 : 0.4,
          }}
          onPress={handleDeleteGroup}
          disabled={deleteConfirmation !== 'DELETE'}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={16} color="#DC2626" />
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#DC2626' }}>
            Delete group permanently
          </Text>
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );
}
