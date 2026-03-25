import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
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
  createGroupSchema,
  getAdminOnboardingChecklist,
  getGroupSubtypeOptions,
  getOnboardingTips,
  getOperationTemplates,
  getSpaceEssentialDefinitions,
  getSpacePreset,
  inviteMemberSchema,
  type SpaceEssentialDefinition,
} from '@commune/core';
import { GroupType, type SpaceEssentials } from '@commune/types';
import { useGroupStore } from '@/stores/group';
import { useAuthStore } from '@/stores/auth';
import {
  useAcceptInvite,
  useCreateGroup,
  useInviteMember,
  usePendingInvites,
  useUserGroups,
} from '@/hooks/use-groups';
import { useApplyGroupStarterPack } from '@/hooks/use-onboarding';
import { usePlanLimits } from '@/hooks/use-plan-limits';
import { getErrorMessage } from '@/lib/errors';
import {
  hapticLight,
  hapticMedium,
  hapticSuccess,
  hapticWarning,
} from '@/lib/haptics';

const GROUP_TYPE_OPTIONS = [
  { value: GroupType.HOME, label: 'Home' },
  { value: GroupType.COUPLE, label: 'Couple' },
  { value: GroupType.WORKSPACE, label: 'Workspace' },
  { value: GroupType.PROJECT, label: 'Project' },
  { value: GroupType.TRIP, label: 'Trip' },
  { value: GroupType.OTHER, label: 'Other' },
] as const;

type OnboardingStep = 1 | 2 | 3;

type CreatedGroupState = {
  id: string;
  name: string;
  type: (typeof GroupType)[keyof typeof GroupType];
  subtype: string | null;
};

const STEP_LABELS: Record<OnboardingStep, { title: string; subtitle: string }> = {
  1: {
    title: 'Create your shared space',
    subtitle: 'Start with one recurring group, then layer on the setup that keeps it legible.',
  },
  2: {
    title: 'Starter setup',
    subtitle: 'Load the essentials, operations, and admin guidance that fit this type of space.',
  },
  3: {
    title: 'Invite your people',
    subtitle: 'Bring in housemates, teammates, or collaborators. You can stop here and invite later too.',
  },
};

function formatLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getRecommendedEssentialValues(
  definitions: SpaceEssentialDefinition[],
  currentValues: Record<string, string>,
  presetSeeds: Record<string, string>,
) {
  return definitions.reduce<Record<string, string>>((acc, definition) => {
    const currentValue = currentValues[definition.key]?.trim();
    if (currentValue) {
      acc[definition.key] = currentValue;
      return acc;
    }

    const seededValue = presetSeeds[definition.key]?.trim();
    acc[definition.key] = seededValue ?? '';
    return acc;
  }, {});
}

function buildStarterEssentials(
  definitions: SpaceEssentialDefinition[],
  currentValues: Record<string, string>,
  presetSeeds: Record<string, string>,
): SpaceEssentials {
  const entriesByKey = new Map(definitions.map((definition) => [definition.key, definition]));
  const essentials = definitions.reduce<SpaceEssentials>((acc, definition) => {
    const value = currentValues[definition.key]?.trim() || presetSeeds[definition.key]?.trim();

    if (!value) {
      return acc;
    }

    acc[definition.key] = {
      label: definition.label,
      value,
      visible: definition.defaultVisible !== false,
    };
    return acc;
  }, {});

  for (const [key, rawValue] of Object.entries(presetSeeds)) {
    if (essentials[key]) {
      continue;
    }

    const value = rawValue.trim();
    if (!value) {
      continue;
    }

    const definition = entriesByKey.get(key);
    essentials[key] = {
      label: definition?.label ?? formatLabel(key),
      value,
      visible: definition?.defaultVisible ?? false,
    };
  }

  return essentials;
}

function countHiddenPresetSeeds(
  definitions: SpaceEssentialDefinition[],
  presetSeeds: Record<string, string>,
) {
  const definitionKeys = new Set(definitions.map((definition) => definition.key));
  return Object.entries(presetSeeds).filter(([key, value]) => !definitionKeys.has(key) && value.trim()).length;
}

function ShimmerBlock({
  width,
  height,
  style,
}: {
  width: number | string;
  height: number;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width: width as number, height, borderRadius: 8, backgroundColor: '#E5E7EB', opacity },
        style,
      ]}
    />
  );
}

function OnboardingSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAFA', paddingHorizontal: 20, paddingTop: 60 }}>
      <ShimmerBlock width="60%" height={28} style={{ marginBottom: 8 }} />
      <ShimmerBlock width="90%" height={14} style={{ marginBottom: 32 }} />
      <ShimmerBlock width="100%" height={200} style={{ borderRadius: 16 }} />
    </View>
  );
}

function StepIndicator({ current, total }: { current: OnboardingStep; total: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {Array.from({ length: total }, (_, i) => {
        const step = (i + 1) as OnboardingStep;
        const isActive = step === current;
        const isComplete = step < current;
        return (
          <View key={step} style={{ alignItems: 'center' }}>
            <View
              style={{
                width: isActive ? 32 : isComplete ? 10 : 8,
                height: isActive ? 10 : isComplete ? 10 : 8,
                borderRadius: 5,
                backgroundColor: isActive || isComplete ? '#2d6a4f' : '#E5E7EB',
              }}
            />
          </View>
        );
      })}
    </View>
  );
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

export default function OnboardingScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
  const { canCreateGroup, groupLimit, currentGroups } = usePlanLimits(user?.id ?? '');
  const {
    data: groups,
    isLoading: groupsLoading,
    error: groupsError,
    refetch: refetchGroups,
  } = useUserGroups();
  const {
    data: pendingInvites,
    isLoading: invitesLoading,
    error: invitesError,
    refetch: refetchInvites,
  } = usePendingInvites();
  const createGroup = useCreateGroup();
  const acceptInvite = useAcceptInvite();

  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [createdGroup, setCreatedGroup] = useState<CreatedGroupState | null>(null);
  const [starterApplied, setStarterApplied] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof GroupType)[keyof typeof GroupType]>(GroupType.HOME);
  const [subtype, setSubtype] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('GBP');

  const [includeStarterOperations, setIncludeStarterOperations] = useState(true);
  const [essentialValues, setEssentialValues] = useState<Record<string, string>>({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);

  const inviteMember = useInviteMember(createdGroup?.id ?? '');
  const applyStarterPack = useApplyGroupStarterPack(createdGroup?.id ?? '');

  const currentType = createdGroup?.type ?? type;
  const currentSubtype = createdGroup?.subtype ?? subtype;
  const currentStep: OnboardingStep = !createdGroup ? 1 : !starterApplied ? 2 : 3;
  const resolvedGroupId = useMemo(() => {
    if (activeGroupId && groups?.some((group) => group.id === activeGroupId)) {
      return activeGroupId;
    }

    return groups?.[0]?.id ?? null;
  }, [activeGroupId, groups]);

  const subtypeOptions = useMemo(() => getGroupSubtypeOptions(type), [type]);
  const essentialDefinitions = useMemo(
    () => getSpaceEssentialDefinitions(currentType),
    [currentType],
  );
  const visibleEssentialDefinitions = useMemo(
    () => essentialDefinitions.slice(0, 3),
    [essentialDefinitions],
  );
  const preset = useMemo(
    () => getSpacePreset(currentType, currentSubtype),
    [currentSubtype, currentType],
  );
  const onboardingTips = useMemo(
    () => getOnboardingTips(currentType),
    [currentType],
  );
  const operationTemplates = useMemo(
    () => getOperationTemplates(currentType, currentSubtype),
    [currentSubtype, currentType],
  );
  const adminChecklist = useMemo(
    () => getAdminOnboardingChecklist(currentType, currentSubtype),
    [currentSubtype, currentType],
  );
  const hiddenPresetSeedCount = useMemo(
    () => countHiddenPresetSeeds(essentialDefinitions, preset.essentialSeeds),
    [essentialDefinitions, preset.essentialSeeds],
  );

  useEffect(() => {
    setEssentialValues((current) =>
      Object.fromEntries(
        essentialDefinitions.map((definition) => [definition.key, current[definition.key] ?? '']),
      ),
    );
  }, [essentialDefinitions]);

  useEffect(() => {
    if (groupsLoading || invitesLoading || groupsError || invitesError) {
      return;
    }

    if (createdGroup) {
      return;
    }

    if (resolvedGroupId) {
      if (resolvedGroupId !== activeGroupId) {
        setActiveGroupId(resolvedGroupId);
      }
      router.replace('/(tabs)');
      return;
    }

    if ((pendingInvites?.length ?? 0) === 0) {
      setShowCreateFlow(true);
    }
  }, [
    activeGroupId,
    createdGroup,
    groupsError,
    groupsLoading,
    invitesError,
    invitesLoading,
    pendingInvites?.length,
    resolvedGroupId,
    router,
    setActiveGroupId,
  ]);

  async function handleCreateGroup() {
    hapticMedium();

    if (!canCreateGroup) {
      hapticWarning();
      Alert.alert(
        'Group limit reached',
        `You've reached the group limit for your plan (${currentGroups}/${groupLimit === Infinity ? 'unlimited' : groupLimit}). Upgrade your plan to create more groups.`,
      );
      return;
    }

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const result = createGroupSchema.safeParse({
      name: trimmedName,
      type,
      subtype,
      description: trimmedDescription || undefined,
      currency,
      cycle_date: 1,
    });

    if (!result.success) {
      hapticWarning();
      Alert.alert(
        'Check your details',
        result.error.issues[0]?.message ?? 'Group details are invalid.',
      );
      return;
    }

    try {
      const group = await createGroup.mutateAsync(result.data);
      hapticSuccess();
      setCreatedGroup({
        id: group.id,
        name: group.name,
        type: result.data.type as CreatedGroupState['type'],
        subtype: result.data.subtype ?? null,
      });
      setStarterApplied(false);
      setActiveGroupId(group.id);
    } catch (error) {
      hapticWarning();
      Alert.alert('Could not create group', getErrorMessage(error));
    }
  }

  async function handleApplyStarterPack() {
    if (!createdGroup) {
      return;
    }

    const spaceEssentials = buildStarterEssentials(
      essentialDefinitions,
      essentialValues,
      preset.essentialSeeds,
    );

    try {
      const result = await applyStarterPack.mutateAsync({
        groupType: createdGroup.type,
        subtype: createdGroup.subtype,
        includeStarterOperations,
        spaceEssentials,
      });

      hapticSuccess();
      setStarterApplied(true);
      Alert.alert(
        'Starter setup applied',
        result.operationsCreated > 0 || result.essentialsApplied > 0
          ? `${result.essentialsApplied} essentials saved, ${result.operationsCreated} starter operations created.`
          : 'Starter setup was already in place for this group.',
      );
    } catch (error) {
      hapticWarning();
      Alert.alert(
        'Failed to apply starter setup',
        getErrorMessage(error, 'Something went wrong.'),
      );
    }
  }

  function handleLoadRecommendedNotes() {
    setEssentialValues((current) => {
      return getRecommendedEssentialValues(essentialDefinitions, current, preset.essentialSeeds);
    });
  }

  function handleContinueToDashboard() {
    hapticMedium();

    if (!createdGroup && !resolvedGroupId) {
      Alert.alert('Setup incomplete', 'Create or join a group before continuing.');
      return;
    }

    router.replace('/(tabs)');
  }

  async function handleInvite() {
    hapticMedium();

    const result = inviteMemberSchema.safeParse({ email: inviteEmail.trim() });
    if (!result.success || !createdGroup) {
      hapticWarning();
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }

    try {
      await inviteMember.mutateAsync(result.data.email);
      hapticSuccess();
      setInvitedEmails((current) => [...current, result.data.email]);
      setInviteEmail('');
    } catch (error) {
      hapticWarning();
      Alert.alert('Invite failed', getErrorMessage(error, 'Could not send invite.'));
    }
  }

  async function handleAcceptInvite(groupId: string) {
    hapticMedium();

    try {
      await acceptInvite.mutateAsync(groupId);
      hapticSuccess();
      setActiveGroupId(groupId);
      router.replace('/(tabs)');
    } catch (error) {
      hapticWarning();
      Alert.alert('Could not join group', getErrorMessage(error));
    }
  }

  if (groupsLoading || invitesLoading) {
    return <OnboardingSkeleton />;
  }

  const loadError = groupsError ?? invitesError;
  if (loadError) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#FAFAFA' }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 60 }}
      >
        <Card>
          <Text style={{ fontSize: 17, fontWeight: '600', color: '#111827', marginBottom: 6 }}>
            Setup unavailable
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: '#6B7280' }}>
            {getErrorMessage(loadError, 'Could not load your group setup right now.')}
          </Text>
          <TouchableOpacity
            style={{ marginTop: 16 }}
            onPress={() => {
              hapticLight();
              void refetchGroups();
              void refetchInvites();
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#2d6a4f' }}>
              Try again
            </Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    );
  }

  if ((pendingInvites?.length ?? 0) > 0 && !showCreateFlow && !createdGroup) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#FAFAFA' }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginBottom: 24 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              backgroundColor: '#F3F4F6',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Ionicons name="mail-outline" size={22} color="#6B7280" />
          </View>
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 6 }}>
            You have an invite waiting
          </Text>
          <Text style={{ fontSize: 15, lineHeight: 22, color: '#6B7280' }}>
            Join the right shared space instead of starting from an empty dashboard.
          </Text>
        </View>

        {(pendingInvites ?? []).map((invite) => (
          <Card key={invite.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  marginRight: 12,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: '#EEF6F3',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="people-outline" size={20} color="#2d6a4f" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '600', color: '#111827' }}>
                  {invite.group.name}
                </Text>
                <Text style={{ marginTop: 2, fontSize: 14, color: '#6B7280' }}>
                  {invite.group.type} group
                  {invite.group.description ? ` · ${invite.group.description}` : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={{
                marginTop: 16,
                backgroundColor: '#1f2330',
                height: 52,
                borderRadius: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
              onPress={() => handleAcceptInvite(invite.group_id)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
                Accept invite
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </Card>
        ))}

        <TouchableOpacity
          style={{
            marginTop: 4,
            backgroundColor: '#FFFFFF',
            height: 52,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#E5E7EB',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPress={() => {
            hapticLight();
            setShowCreateFlow(true);
          }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151' }}>
            Create a different group
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#FAFAFA' }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <View
            style={{
              marginRight: 12,
              width: 40,
              height: 40,
              borderRadius: 14,
              backgroundColor: '#F3F4F6',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={
                currentStep === 1
                  ? 'add-circle-outline'
                  : currentStep === 2
                    ? 'sparkles-outline'
                    : 'people-outline'
              }
              size={20}
              color="#6B7280"
            />
          </View>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              color: '#9CA3AF',
            }}
          >
            Step {currentStep} of 3
          </Text>
        </View>
        <Text style={{ fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 6 }}>
          {STEP_LABELS[currentStep].title}
        </Text>
        <Text style={{ fontSize: 15, lineHeight: 22, color: '#6B7280' }}>
          {STEP_LABELS[currentStep].subtitle}
        </Text>
        <View style={{ marginTop: 20 }}>
          <StepIndicator current={currentStep} total={3} />
        </View>
      </View>

      {!createdGroup ? (
        <Card>
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
            placeholder="42 Oak Street"
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
              marginTop: 20,
            }}
          >
            Space type
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {GROUP_TYPE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  backgroundColor: option.value === type ? '#1f2330' : '#F3F4F6',
                }}
                onPress={() => {
                  hapticLight();
                  setType(option.value);
                  if (!getGroupSubtypeOptions(option.value).some((item) => item.value === subtype)) {
                    setSubtype(null);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: option.value === type ? '#FFFFFF' : '#6B7280',
                  }}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {subtypeOptions.length > 0 ? (
            <>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: 8,
                  marginTop: 20,
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
                      paddingVertical: 10,
                      borderRadius: 18,
                      backgroundColor: subtype === option.value ? '#EEF6F3' : '#F3F4F6',
                    }}
                    onPress={() => {
                      hapticLight();
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
              marginTop: 20,
            }}
          >
            Currency
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
            placeholder="GBP"
            placeholderTextColor="#9CA3AF"
            value={currency}
            onChangeText={(value: string) => setCurrency(value.toUpperCase())}
            autoCapitalize="characters"
            maxLength={3}
          />

          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: '#374151',
              marginBottom: 8,
              marginTop: 20,
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
            placeholder="Optional details about the group"
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <Card style={{ backgroundColor: '#F9FAFB', marginBottom: 0, marginTop: 18 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#171b24' }}>
              {getSpacePreset(type, subtype).title}
            </Text>
            <Text style={{ marginTop: 6, fontSize: 14, lineHeight: 22, color: '#667085' }}>
              {getSpacePreset(type, subtype).summary}
            </Text>
          </Card>

          {!canCreateGroup && (
            <View
              style={{
                marginTop: 16,
                borderRadius: 16,
                backgroundColor: '#FFF1DB',
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Text style={{ fontSize: 14, color: '#8A593B' }}>
                You've reached the group limit for your plan ({currentGroups}/
                {groupLimit === Infinity ? 'unlimited' : groupLimit}). Upgrade to create more
                groups.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={{
              marginTop: 20,
              backgroundColor: canCreateGroup && !createGroup.isPending ? '#1f2330' : '#D1D5DB',
              height: 52,
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            onPress={handleCreateGroup}
            disabled={!canCreateGroup || createGroup.isPending}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
              {createGroup.isPending ? 'Creating group' : 'Create group'}
            </Text>
          </TouchableOpacity>
        </Card>
      ) : !starterApplied ? (
        <>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#171b24' }}>
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
                  borderRadius: 18,
                  backgroundColor: '#EEF6F3',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#2d6a4f' }}>
                  {operationTemplates.length} ops
                </Text>
              </View>
            </View>

            <Text style={{ marginTop: 12, fontSize: 13, lineHeight: 20, color: '#667085' }}>
              This preset fills {essentialDefinitions.length} visible note
              {essentialDefinitions.length === 1 ? '' : 's'}
              {hiddenPresetSeedCount > 0
                ? ` and ${hiddenPresetSeedCount} hidden default${hiddenPresetSeedCount === 1 ? '' : 's'}`
                : ''}
              . You can still edit every shown field before applying it.
            </Text>

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

            {onboardingTips.slice(0, 2).map((tip) => (
              <Text key={tip} style={{ marginTop: 10, fontSize: 13, color: '#667085' }}>
                • {tip}
              </Text>
            ))}
            {preset.firstExpenseIdeas.slice(0, 2).map((idea) => (
              <Text key={idea} style={{ marginTop: 10, fontSize: 13, color: '#667085' }}>
                • {idea}
              </Text>
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
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#171b24' }}>
                Admin checklist
              </Text>
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 18,
                  backgroundColor: '#F3F4F6',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280' }}>
                  {adminChecklist.length} steps
                </Text>
              </View>
            </View>
            {adminChecklist.map((item) => (
              <Text key={item} style={{ marginTop: 8, fontSize: 13, lineHeight: 20, color: '#667085' }}>
                • {item}
              </Text>
            ))}
          </Card>

          <Card>
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
                  First essentials
                </Text>
                <Text style={{ marginTop: 4, fontSize: 14, color: '#667085' }}>
                  Capture the notes people need immediately. Hidden starter values stay out of the form but still get applied.
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleLoadRecommendedNotes}
                activeOpacity={0.7}
                disabled={applyStarterPack.isPending}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#2d6a4f' }}>
                  Fill from starter pack
                </Text>
              </TouchableOpacity>
            </View>

            {visibleEssentialDefinitions.map((definition) => (
              <View key={definition.key} style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                  {definition.label}
                </Text>
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
                  value={essentialValues[definition.key] ?? ''}
                  onChangeText={(value) =>
                    setEssentialValues((current) => ({
                      ...current,
                      [definition.key]: value,
                    }))
                  }
                  multiline={definition.kind === 'textarea'}
                />
              </View>
            ))}

            <View
              style={{
                marginTop: 18,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
                  Seed starter operations
                </Text>
                <Text style={{ marginTop: 4, fontSize: 13, color: '#667085' }}>
                  Add the first recurring shared operations board for this space, or turn this off if you only want the setup notes.
                </Text>
              </View>
              <Switch
                value={includeStarterOperations}
                onValueChange={setIncludeStarterOperations}
                trackColor={{ false: '#D1D5DB', true: '#84CC16' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </Card>

          <TouchableOpacity
            style={{
              backgroundColor: '#1f2330',
              height: 52,
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: applyStarterPack.isPending ? 0.75 : 1,
            }}
            onPress={handleApplyStarterPack}
            disabled={applyStarterPack.isPending}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
              {applyStarterPack.isPending ? 'Applying starter setup' : 'Apply starter setup'}
            </Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
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
              opacity: applyStarterPack.isPending ? 0.75 : 1,
            }}
            onPress={() => {
              hapticLight();
              setStarterApplied(true);
            }}
            disabled={applyStarterPack.isPending}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>
              Skip starter setup
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View
                style={{
                  marginRight: 12,
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#EEF6F3',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="mail-outline" size={18} color="#2d6a4f" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '600', color: '#111827' }}>
                  Add members by email
                </Text>
                <Text style={{ marginTop: 2, fontSize: 14, color: '#6B7280' }}>
                  {createdGroup.name} is ready. Invite people now or come back later.
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
              Email
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
              placeholder="member@example.com"
              placeholderTextColor="#9CA3AF"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TouchableOpacity
              style={{
                marginTop: 12,
                backgroundColor: '#FFFFFF',
                height: 52,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
              onPress={handleInvite}
              disabled={inviteMember.isPending}
              activeOpacity={0.7}
            >
              <Ionicons name="mail-outline" size={16} color="#374151" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151' }}>
                {inviteMember.isPending ? 'Sending invite' : 'Send invite'}
              </Text>
            </TouchableOpacity>

            {invitedEmails.length > 0 && (
              <View
                style={{
                  marginTop: 20,
                  borderRadius: 16,
                  backgroundColor: '#EEF6F3',
                  padding: 16,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#2d6a4f' }}>
                  Invites sent
                </Text>
                {invitedEmails.map((email) => (
                  <View key={email} style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="checkmark-circle" size={14} color="#2d6a4f" />
                    <Text style={{ marginLeft: 8, fontSize: 14, color: '#6B7280' }}>
                      {email}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <TouchableOpacity
            style={{
              backgroundColor: '#1f2330',
              height: 52,
              borderRadius: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            onPress={handleContinueToDashboard}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
              Continue to dashboard
            </Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}
