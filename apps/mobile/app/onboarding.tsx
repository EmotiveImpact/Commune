import { useEffect, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { createGroupSchema, inviteMemberSchema } from '@commune/core';
import { GroupType } from '@commune/types';
import { useGroupStore } from '@/stores/group';
import {
  useAcceptInvite,
  useCreateGroup,
  useInviteMember,
  usePendingInvites,
  useUserGroups,
} from '@/hooks/use-groups';
import {
  AppButton,
  EmptyState,
  LoadingScreen,
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

export default function OnboardingScreen() {
  const router = useRouter();
  const { activeGroupId, setActiveGroupId } = useGroupStore();
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
    return <LoadingScreen message="Preparing your workspace..." />;
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
        <View className="mb-4 rounded-[32px] bg-[#17141F] px-5 py-5">
          <Text className="text-sm font-medium text-[#BBB4C1]">Step one</Text>
          <Text className="mt-2 text-[30px] font-bold leading-[36px] text-white">
            You already have an invite waiting
          </Text>
          <Text className="mt-2 text-sm leading-6 text-[#C7C2CD]">
            Join the right shared workspace instead of starting from an empty dashboard.
          </Text>
        </View>

        {pendingInvites?.map((invite) => (
          <Surface key={invite.id} className="mb-4">
            <Text className="text-xl font-semibold text-[#17141F]">
              {invite.group.name}
            </Text>
            <Text className="mt-2 text-sm leading-6 text-[#6A645D]">
              {invite.group.type} group
              {invite.group.description ? ` · ${invite.group.description}` : ''}
            </Text>
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
      <View className="mb-4 rounded-[32px] bg-[#17141F] px-5 py-5">
        <Text className="text-sm font-medium text-[#BBB4C1]">Set up</Text>
        <Text className="mt-2 text-[30px] font-bold leading-[36px] text-white">
          {createdGroupId ? 'Invite your people' : 'Create your first group'}
        </Text>
        <Text className="mt-2 text-sm leading-6 text-[#C7C2CD]">
          {createdGroupId
            ? 'Invite housemates, teammates, or collaborators now. You can skip this and come back later.'
            : 'Start with one shared space for the bills, subscriptions, or trip costs you manage together.'}
        </Text>
      </View>

      {!createdGroupId ? (
        <Surface className="mb-4">
          <TextField
            label="Group name"
            placeholder="42 Oak Street"
            value={name}
            onChangeText={setName}
          />

          <Text className="mb-2 text-sm font-medium text-[#17141F]">
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

          <AppButton
            label="Create group"
            icon="sparkles-outline"
            loading={createGroup.isPending}
            onPress={handleCreateGroup}
          />
        </Surface>
      ) : (
        <>
          <Surface className="mb-4">
            <Text className="text-xl font-semibold text-[#17141F]">
              Add members by email
            </Text>
            <Text className="mt-2 text-sm leading-6 text-[#6A645D]">
              People can accept their invite from the web app and then use the same space on mobile.
            </Text>

            <View className="mt-4">
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
              <View className="mt-5 rounded-2xl bg-[#F2F6EC] p-4">
                <Text className="text-sm font-semibold text-[#17141F]">
                  Sent recently
                </Text>
                {invitedEmails.map((email) => (
                  <Text key={email} className="mt-2 text-sm text-[#6A645D]">
                    {email}
                  </Text>
                ))}
              </View>
            ) : null}
          </Surface>

          <Surface className="mb-4">
            <Text className="text-base font-semibold text-[#17141F]">
              Group ready
            </Text>
            <Text className="mt-2 text-sm leading-6 text-[#6A645D]">
              You can start adding expenses now and invite the rest of the group later.
            </Text>
            <View className="mt-5">
              <AppButton
                label="Go to dashboard"
                icon="arrow-forward"
                onPress={() => router.replace('/(tabs)')}
              />
            </View>
          </Surface>
        </>
      )}

      {!createdGroupId && groups?.length === 0 ? null : (
        <TouchableOpacity
          className="mt-2"
          onPress={() => router.replace('/(tabs)')}
        >
          <Text className="text-center text-sm font-medium text-[#205C54]">
            Skip for now
          </Text>
        </TouchableOpacity>
      )}
    </Screen>
  );
}
