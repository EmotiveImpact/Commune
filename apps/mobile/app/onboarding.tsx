import { useEffect, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { createGroupSchema, inviteMemberSchema } from '@commune/core';
import { GroupType } from '@commune/types';
import { useGroupStore } from '@/stores/group';
import { useAuthStore } from '@/stores/auth';
import {
  useAcceptInvite,
  useCreateGroup,
  useInviteMember,
  usePendingInvites,
  useUserGroups,
} from '@/hooks/use-groups';
import { usePlanLimits } from '@/hooks/use-plan-limits';
import {
  AppButton,
  EmptyState,
  ContentSkeleton,
  Pill,
  Screen,
  Surface,
  TextField,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';

const groupTypeOptions = Object.entries(GroupType).map(([key, value]) => ({
  label: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
  value,
}));

type OnboardingStep = 1 | 2 | 3;

const STEP_LABELS: Record<OnboardingStep, { title: string; subtitle: string }> = {
  1: {
    title: 'Create your group',
    subtitle: 'Start with one shared space for the bills, subscriptions, or trip costs you manage together.',
  },
  2: {
    title: 'Invite your people',
    subtitle: 'Invite housemates, teammates, or collaborators. You can skip this and come back later.',
  },
  3: {
    title: 'Add your first expense',
    subtitle: 'Your group is ready. Start tracking shared expenses right away.',
  },
};

function StepIndicator({ current, total }: { current: OnboardingStep; total: number }) {
  return (
    <View className="flex-row items-center justify-center" style={{ gap: 8 }}>
      {Array.from({ length: total }, (_, i) => {
        const step = (i + 1) as OnboardingStep;
        const isActive = step === current;
        const isComplete = step < current;
        return (
          <View key={step} className="items-center">
            <View
              className="items-center justify-center rounded-full"
              style={{
                width: isActive ? 32 : 10,
                height: 10,
                backgroundColor: isActive
                  ? '#2d6a4f'
                  : isComplete
                    ? '#2d6a4f'
                    : 'rgba(23,27,36,0.12)',
                borderRadius: 5,
              }}
            />
          </View>
        );
      })}
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
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof GroupType)[keyof typeof GroupType]>(
    GroupType.HOME
  );
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);

  const inviteMember = useInviteMember(createdGroupId ?? '');

  const loadError = groupsError ?? invitesError;

  const currentStep: OnboardingStep = createdGroupId
    ? invitedEmails.length > 0
      ? 3
      : 2
    : 1;

  useEffect(() => {
    if (groupsLoading || invitesLoading || loadError) {
      return;
    }

    if (activeGroupId) {
      router.replace('/(tabs)');
      return;
    }

    const firstGroupId = groups?.[0]?.id;
    if (firstGroupId) {
      setActiveGroupId(firstGroupId);
      router.replace('/(tabs)');
      return;
    }

    if ((pendingInvites?.length ?? 0) === 0) {
      setShowCreateFlow(true);
    }
  }, [
    activeGroupId,
    groups,
    loadError,
    groupsLoading,
    invitesLoading,
    pendingInvites?.length,
    router,
    setActiveGroupId,
  ]);

  async function handleCreateGroup() {
    if (!canCreateGroup) {
      Alert.alert(
        'Group limit reached',
        `You've reached the group limit for your plan (${currentGroups}/${groupLimit === Infinity ? 'unlimited' : groupLimit}). Upgrade your plan to create more groups.`
      );
      return;
    }

    const result = createGroupSchema.safeParse({
      name,
      type,
      description: description || undefined,
      currency,
      cycle_date: 1,
    });

    if (!result.success) {
      Alert.alert('Check your details', result.error.issues[0]?.message ?? 'Group details are invalid.');
      return;
    }

    try {
      const group = await createGroup.mutateAsync(result.data);
      setCreatedGroupId(group.id);
      setActiveGroupId(group.id);
      setShowCreateFlow(true);
      Alert.alert('Group created', `${group.name} is ready for expenses.`);
    } catch (error) {
      Alert.alert(
        'Could not create group',
        getErrorMessage(error)
      );
    }
  }

  async function handleInvite() {
    const result = inviteMemberSchema.safeParse({ email: inviteEmail });
    if (!result.success || !createdGroupId) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }

    try {
      await inviteMember.mutateAsync(result.data.email);
      setInvitedEmails((current) => [...current, result.data.email]);
      setInviteEmail('');
    } catch (error) {
      Alert.alert(
        'Invite failed',
        getErrorMessage(error, 'Could not send invite.')
      );
    }
  }

  async function handleAcceptInvite(groupId: string) {
    try {
      await acceptInvite.mutateAsync(groupId);
      setActiveGroupId(groupId);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert(
        'Could not join group',
        getErrorMessage(error)
      );
    }
  }

  if (groupsLoading || invitesLoading) {
    return <ContentSkeleton />;
  }

  if (loadError) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Setup unavailable"
          description={getErrorMessage(
            loadError,
            'Could not load your group setup right now.'
          )}
          actionLabel="Try again"
          onAction={() => {
            void refetchGroups();
            void refetchInvites();
          }}
        />
      </Screen>
    );
  }

  if ((pendingInvites?.length ?? 0) > 0 && !showCreateFlow && !createdGroupId) {
    return (
      <Screen>
        <View className="mb-4 rounded-[32px] bg-[#1f2330] px-5 py-6">
          <View className="mb-4 h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(255,255,255,0.08)]">
            <Ionicons name="mail-outline" size={22} color="#d9ebe5" />
          </View>
          <Text className="text-sm font-medium text-[rgba(255,255,255,0.72)]">Welcome</Text>
          <Text className="mt-2 text-[28px] font-bold leading-[34px] text-white">
            You have an invite waiting
          </Text>
          <Text className="mt-2 text-sm leading-6 text-[rgba(255,250,246,0.72)]">
            Join the right shared workspace instead of starting from an empty dashboard.
          </Text>
        </View>

        {pendingInvites?.map((invite) => (
          <Surface key={invite.id} className="mb-4">
            <View className="flex-row items-center">
              <View className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-[#EEF6F3]">
                <Ionicons name="people-outline" size={20} color="#2d6a4f" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-[#171b24]">
                  {invite.group.name}
                </Text>
                <Text className="mt-1 text-sm text-[#667085]">
                  {invite.group.type} group
                  {invite.group.description ? ` · ${invite.group.description}` : ''}
                </Text>
              </View>
            </View>
            <View className="mt-5">
              <AppButton
                label="Accept invite"
                icon="arrow-forward"
                loading={acceptInvite.isPending}
                onPress={() => handleAcceptInvite(invite.group_id)}
              />
            </View>
          </Surface>
        ))}

        <AppButton
          label="Create a different group"
          variant="secondary"
          onPress={() => setShowCreateFlow(true)}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Hero with step info */}
      <View className="mb-4 rounded-[32px] bg-[#1f2330] px-5 py-6">
        <View className="mb-4 flex-row items-center">
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(255,255,255,0.08)]">
            <Ionicons
              name={currentStep === 1 ? 'add-circle-outline' : currentStep === 2 ? 'people-outline' : 'receipt-outline'}
              size={20}
              color="#d9ebe5"
            />
          </View>
          <Text className="text-xs font-semibold uppercase tracking-[2px] text-[rgba(255,255,255,0.5)]">
            Step {currentStep} of 3
          </Text>
        </View>
        <Text className="text-[28px] font-bold leading-[34px] text-white">
          {STEP_LABELS[currentStep].title}
        </Text>
        <Text className="mt-2 text-sm leading-6 text-[rgba(255,250,246,0.72)]">
          {STEP_LABELS[currentStep].subtitle}
        </Text>
        <View className="mt-5">
          <StepIndicator current={currentStep} total={3} />
        </View>
      </View>

      {/* Step 1: Create group */}
      {!createdGroupId ? (
        <Surface className="mb-4">
          <TextField
            label="Group name"
            placeholder="42 Oak Street"
            value={name}
            onChangeText={setName}
          />

          <Text className="mb-2 text-sm font-medium text-[#171b24]">
            Group type
          </Text>
          <View className="mb-4 flex-row flex-wrap">
            {groupTypeOptions.map((option) => (
              <Pill
                key={option.value}
                label={option.label}
                selected={option.value === type}
                onPress={() => setType(option.value)}
              />
            ))}
          </View>

          <TextField
            label="Currency"
            placeholder="GBP"
            value={currency}
            onChangeText={(value) => setCurrency(value.toUpperCase())}
            autoCapitalize="characters"
            maxLength={3}
          />

          <TextField
            label="Description"
            placeholder="Optional details about the group"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          {!canCreateGroup && (
            <View className="mb-4 rounded-2xl bg-[#FFF1DB] px-4 py-3">
              <Text className="text-sm text-[#8A593B]">
                You've reached the group limit for your plan ({currentGroups}/{groupLimit === Infinity ? 'unlimited' : groupLimit}). Upgrade to create more groups.
              </Text>
            </View>
          )}
          <AppButton
            label="Create group"
            icon="sparkles-outline"
            loading={createGroup.isPending}
            disabled={!canCreateGroup}
            onPress={handleCreateGroup}
          />
        </Surface>
      ) : currentStep === 2 ? (
        /* Step 2: Invite members */
        <>
          <Surface className="mb-4">
            <View className="mb-3 flex-row items-center">
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-[#EEF6F3]">
                <Ionicons name="mail-outline" size={18} color="#2d6a4f" />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-[#171b24]">
                  Add members by email
                </Text>
                <Text className="mt-1 text-sm text-[#667085]">
                  They can accept from web or mobile.
                </Text>
              </View>
            </View>

            <View className="mt-2">
              <TextField
                label="Email"
                placeholder="member@example.com"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <AppButton
                label="Send invite"
                variant="secondary"
                icon="mail-outline"
                loading={inviteMember.isPending}
                onPress={handleInvite}
              />
            </View>

            {invitedEmails.length > 0 ? (
              <View className="mt-5 rounded-2xl bg-[#EEF6F3] p-4">
                <Text className="text-sm font-semibold text-[#2d6a4f]">
                  Invites sent
                </Text>
                {invitedEmails.map((email) => (
                  <View key={email} className="mt-2 flex-row items-center">
                    <Ionicons name="checkmark-circle" size={14} color="#2d6a4f" />
                    <Text className="ml-2 text-sm text-[#667085]">{email}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Surface>

          <AppButton
            label="Continue to dashboard"
            icon="arrow-forward"
            onPress={() => router.replace('/(tabs)')}
          />
        </>
      ) : (
        /* Step 3: Ready to go */
        <>
          <Surface className="mb-4">
            <View className="items-center py-4">
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-[#EEF6F3]">
                <Ionicons name="checkmark-circle" size={32} color="#2d6a4f" />
              </View>
              <Text className="text-xl font-bold text-[#171b24]">
                You're all set
              </Text>
              <Text className="mt-2 text-center text-sm leading-6 text-[#667085]" style={{ maxWidth: 260 }}>
                Your group is ready with {invitedEmails.length} invite{invitedEmails.length !== 1 ? 's' : ''} sent. Start adding expenses now.
              </Text>
            </View>
          </Surface>

          <AppButton
            label="Go to dashboard"
            icon="arrow-forward"
            onPress={() => router.replace('/(tabs)')}
          />
        </>
      )}

      {!createdGroupId && groups?.length === 0 ? null : (
        <TouchableOpacity
          className="mt-4"
          onPress={() => router.replace('/(tabs)')}
        >
          <Text className="text-center text-sm font-medium text-[#2d6a4f]">
            Skip for now
          </Text>
        </TouchableOpacity>
      )}
    </Screen>
  );
}
