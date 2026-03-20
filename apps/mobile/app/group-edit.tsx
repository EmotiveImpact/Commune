import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useGroup, useUpdateGroup } from '@/hooks/use-groups';
import {
  AppButton,
  EmptyState,
  HeroPanel,
  ContentSkeleton,
  Pill,
  Screen,
  Surface,
  TextField,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';

const GROUP_TYPES = ['household', 'flat', 'couple', 'friends', 'workspace'] as const;
const CURRENCIES = ['GBP', 'USD', 'EUR', 'CAD', 'AUD', 'NGN', 'GHS', 'ZAR', 'INR', 'JPY'] as const;
const BILLING_CYCLES = ['weekly', 'monthly'] as const;

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

  useEffect(() => {
    if (group) {
      setName(group.name);
      setType(group.type ?? 'household');
      setCurrency(group.currency ?? 'GBP');
      setBillingCycle((group as unknown as Record<string, unknown>).billing_cycle as string ?? 'monthly');
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

  return (
    <Screen>
      <HeroPanel
        eyebrow="Group settings"
        title="Edit group"
        description="Update your group's name, type, currency, and billing cycle."
        contextLabel={group.name}
      />

      <Surface className="mb-4">
        <Text className="text-lg font-semibold text-[#171b24]">Group name</Text>
        <View className="mt-4">
          <TextField
            label="Name"
            placeholder="Enter group name"
            value={name}
            onChangeText={setName}
          />
        </View>
      </Surface>

      <Surface className="mb-4">
        <Text className="text-lg font-semibold text-[#171b24]">Group type</Text>
        <Text className="mt-2 text-sm leading-6 text-[#667085]">
          What kind of group is this?
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-4"
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

      <Surface className="mb-4">
        <Text className="text-lg font-semibold text-[#171b24]">Default currency</Text>
        <Text className="mt-2 text-sm leading-6 text-[#667085]">
          Used for new expenses in this group.
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-4"
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

      <Surface className="mb-4">
        <Text className="text-lg font-semibold text-[#171b24]">Billing cycle</Text>
        <Text className="mt-2 text-sm leading-6 text-[#667085]">
          How often the group settles up.
        </Text>
        <View className="mt-4 flex-row">
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

      <AppButton
        label="Save changes"
        onPress={handleSave}
        loading={updateGroup.isPending}
        disabled={updateGroup.isPending}
      />
    </Screen>
  );
}
