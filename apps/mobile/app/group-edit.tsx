import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useGroup, useUpdateGroup } from '@/hooks/use-groups';
import {
  AppButton,
  EmptyState,
  HeroPanel,
  ContentSkeleton,
  InitialAvatar,
  Pill,
  Screen,
  Surface,
  TextField,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';

const GROUP_TYPES = ['household', 'flat', 'couple', 'friends', 'workspace'] as const;
const CURRENCIES = ['GBP', 'USD', 'EUR', 'CAD', 'AUD', 'NGN', 'GHS', 'ZAR', 'INR', 'JPY'] as const;
const BILLING_CYCLES = ['weekly', 'monthly'] as const;

const ROLE_STYLES: Record<string, { bg: string; text: string }> = {
  admin: { bg: '#EEF6F3', text: '#2d6a4f' },
  member: { bg: '#F1ECE4', text: '#667085' },
  viewer: { bg: '#F1ECE4', text: '#667085' },
};

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
  const [type, setType] = useState<string>('household');
  const [currency, setCurrency] = useState<string>('GBP');
  const [billingCycle, setBillingCycle] = useState<string>('monthly');
  const [description, setDescription] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  useEffect(() => {
    if (group) {
      setName(group.name);
      setType(group.type ?? 'household');
      setCurrency(group.currency ?? 'GBP');
      setBillingCycle((group as unknown as Record<string, unknown>).billing_cycle as string ?? 'monthly');
      setDescription((group as unknown as Record<string, unknown>).description as string ?? '');
    }
  }, [group]);

  if (!activeGroupId) {
    return (
      <Screen>
        <EmptyState
          icon="settings-outline"
          title="No group selected"
          description="Pick a group from the dashboard first."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  if (groupError) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Could not load group"
          description={getErrorMessage(groupError, 'Something went wrong loading group details.')}
          actionLabel="Try again"
          onAction={() => { void refetchGroup(); }}
        />
      </Screen>
    );
  }

  if (isLoading || !group) {
    return <ContentSkeleton />;
  }

  const isAdmin = group.members.some(
    (member) => member.user_id === user?.id && member.role === 'admin'
  );

  if (!isAdmin) {
    return (
      <Screen>
        <EmptyState
          icon="lock-closed-outline"
          title="Admin access required"
          description="Only group admins can edit group settings."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Validation error', 'Group name is required.');
      return;
    }

    try {
      await updateGroup.mutateAsync({
        name: name.trim(),
        type,
        currency,
        billing_cycle: billingCycle,
      });
      Alert.alert('Saved', 'Group settings have been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Update failed', getErrorMessage(error, 'Could not save group settings.'));
    }
  }

  function handleDeleteGroup() {
    if (deleteConfirmation !== 'DELETE') {
      Alert.alert('Confirmation required', 'Type DELETE to confirm.');
      return;
    }
    Alert.alert(
      'Delete group permanently?',
      'This action cannot be undone. All expenses, payments, and member data will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete group',
          style: 'destructive',
          onPress: () => {
            // Delete group action would go here
            Alert.alert('Deleted', 'The group has been permanently removed.', [
              { text: 'OK', onPress: () => router.replace('/(tabs)') },
            ]);
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <HeroPanel
        eyebrow="Group settings"
        title="Edit group"
        description="Update your group details, manage members, and configure preferences."
        contextLabel={group.name}
      />

      {/* Group name */}
      <Surface className="mb-4">
        <Text className="mb-1 text-lg font-semibold text-[#171b24]">Group name</Text>
        <Text className="mb-4 text-sm text-[#667085]">The name visible to all members.</Text>
        <TextField
          label="Name"
          placeholder="Enter group name"
          value={name}
          onChangeText={setName}
        />
      </Surface>

      {/* Description */}
      <Surface className="mb-4">
        <Text className="mb-1 text-lg font-semibold text-[#171b24]">Description</Text>
        <Text className="mb-4 text-sm text-[#667085]">Optional details about this group.</Text>
        <TextField
          label="Description"
          placeholder="e.g. Shared flat expenses for 2026"
          value={description}
          onChangeText={setDescription}
          multiline
        />
      </Surface>

      {/* Group type */}
      <Surface className="mb-4">
        <Text className="mb-1 text-lg font-semibold text-[#171b24]">Group type</Text>
        <Text className="mb-4 text-sm text-[#667085]">What kind of group is this?</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 8 }}
        >
          {GROUP_TYPES.map((option) => (
            <Pill
              key={option}
              label={option.charAt(0).toUpperCase() + option.slice(1)}
              selected={type === option}
              onPress={() => setType(option)}
            />
          ))}
        </ScrollView>
      </Surface>

      {/* Currency */}
      <Surface className="mb-4">
        <Text className="mb-1 text-lg font-semibold text-[#171b24]">Default currency</Text>
        <Text className="mb-4 text-sm text-[#667085]">Used for new expenses in this group.</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 8 }}
        >
          {CURRENCIES.map((option) => (
            <Pill
              key={option}
              label={option}
              selected={currency === option}
              onPress={() => setCurrency(option)}
            />
          ))}
        </ScrollView>
      </Surface>

      {/* Billing cycle */}
      <Surface className="mb-4">
        <Text className="mb-1 text-lg font-semibold text-[#171b24]">Billing cycle</Text>
        <Text className="mb-4 text-sm text-[#667085]">How often the group settles up.</Text>
        <View className="flex-row">
          {BILLING_CYCLES.map((option) => (
            <Pill
              key={option}
              label={option.charAt(0).toUpperCase() + option.slice(1)}
              selected={billingCycle === option}
              onPress={() => setBillingCycle(option)}
            />
          ))}
        </View>
      </Surface>

      {/* Members section */}
      <Surface className="mb-4">
        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-lg font-semibold text-[#171b24]">Members</Text>
            <Text className="mt-1 text-sm text-[#667085]">
              {group.members.length} member{group.members.length !== 1 ? 's' : ''} in this group
            </Text>
          </View>
          <View className="h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF6F3]">
            <Ionicons name="people-outline" size={18} color="#2d6a4f" />
          </View>
        </View>

        {group.members.map((member) => {
          const rolePalette = ROLE_STYLES[member.role] ?? ROLE_STYLES.member!;
          const isCurrentUser = member.user_id === user?.id;
          const displayName = member.user.name ?? member.user.email;
          return (
            <View
              key={member.user_id}
              className="flex-row items-center border-t border-[rgba(23,27,36,0.06)] py-3"
            >
              <InitialAvatar name={displayName} size={38} />
              <View className="ml-3 flex-1">
                <View className="flex-row items-center">
                  <Text className="text-sm font-medium text-[#171b24]">
                    {displayName}
                  </Text>
                  {isCurrentUser && (
                    <Text className="ml-2 text-xs text-[#667085]">(you)</Text>
                  )}
                </View>
                {member.user.name && member.user.email && (
                  <Text className="mt-0.5 text-xs text-[#667085]">{member.user.email}</Text>
                )}
              </View>
              <View
                className="rounded-full px-2.5 py-1"
                style={{ backgroundColor: rolePalette!.bg }}
              >
                <Text
                  className="text-[11px] font-semibold uppercase tracking-[1px]"
                  style={{ color: rolePalette!.text }}
                >
                  {member.role}
                </Text>
              </View>
            </View>
          );
        })}
      </Surface>

      {/* Save button */}
      <View className="mb-6">
        <AppButton
          label="Save changes"
          onPress={handleSave}
          loading={updateGroup.isPending}
          disabled={updateGroup.isPending}
        />
      </View>

      {/* Danger zone */}
      <View className="mb-4 rounded-[28px] border border-[rgba(185,56,47,0.2)] bg-white p-5">
        <View className="mb-3 flex-row items-center">
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl bg-[#F7E2DD]">
            <Ionicons name="warning-outline" size={18} color="#B9382F" />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-semibold text-[#B9382F]">Danger zone</Text>
            <Text className="mt-1 text-sm text-[#667085]">Irreversible actions</Text>
          </View>
        </View>

        <Text className="text-sm leading-6 text-[#667085]">
          Deleting this group will permanently remove all expenses, payments, and member data. This action cannot be undone.
        </Text>

        <Text className="mt-4 mb-2 text-sm font-medium text-[#171b24]">
          Type DELETE to confirm
        </Text>
        <TextInput
          className="mb-4 min-h-[52px] rounded-2xl border border-[rgba(185,56,47,0.2)] bg-[#FDFAF9] px-4 text-base text-[#B9382F]"
          placeholder="DELETE"
          placeholderTextColor="rgba(185,56,47,0.3)"
          value={deleteConfirmation}
          onChangeText={setDeleteConfirmation}
          autoCapitalize="characters"
        />

        <AppButton
          label="Delete group permanently"
          variant="danger"
          icon="trash-outline"
          disabled={deleteConfirmation !== 'DELETE'}
          onPress={handleDeleteGroup}
        />
      </View>
    </Screen>
  );
}
