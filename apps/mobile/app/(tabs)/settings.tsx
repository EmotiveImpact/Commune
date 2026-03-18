import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { formatDate } from '@commune/utils';
import { signOut } from '@commune/api';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useProfile, useUpdateProfile } from '@/hooks/use-profile';
import { usePortal, useSubscription } from '@/hooks/use-subscriptions';
import {
  AppButton,
  EmptyState,
  HeroPanel,
  InitialAvatar,
  LoadingScreen,
  Screen,
  Surface,
  TextField,
  ToggleRow,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errors';

const planLabels: Record<string, string> = {
  standard: 'Standard',
  pro: 'Pro',
  agency: 'Agency',
};

const defaultNotifications = {
  email_on_new_expense: true,
  email_on_payment_received: true,
  email_on_payment_reminder: true,
  email_on_overdue: true,
};

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const { user, setUser } = useAuthStore();
  const setActiveGroupId = useGroupStore((state) => state.setActiveGroupId);
  const { data: profile, isLoading } = useProfile(user?.id ?? '');
  const updateProfile = useUpdateProfile();
  const { data: subscription, isLoading: subscriptionLoading } = useSubscription(
    user?.id ?? ''
  );
  const portal = usePortal();

  const resolvedProfile = useMemo(
    () =>
      profile ?? (user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar_url: user.avatar_url,
            notification_preferences: defaultNotifications,
            created_at: user.created_at,
          }
        : null),
    [profile, user]
  );

  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [notifications, setNotifications] = useState(defaultNotifications);

  useEffect(() => {
    if (!resolvedProfile) {
      return;
    }

    setName(resolvedProfile.name);
    setAvatarUrl(resolvedProfile.avatar_url ?? '');
    setNotifications(
      resolvedProfile.notification_preferences ?? defaultNotifications
    );
  }, [resolvedProfile]);

  async function handleSave() {
    if (!user) {
      return;
    }

    try {
      const result = await updateProfile.mutateAsync({
        userId: user.id,
        data: {
          name: name.trim(),
          avatar_url: avatarUrl.trim() || null,
          notification_preferences: notifications,
        },
      });

      setUser({
        ...user,
        name: result.name,
        avatar_url: result.avatar_url,
      });
      Alert.alert('Saved', 'Your settings have been updated.');
    } catch (error) {
      Alert.alert(
        'Save failed',
        getErrorMessage(error)
      );
    }
  }

  async function handleManageBilling() {
    try {
      const url = await portal.mutateAsync();
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(
        'Billing unavailable',
        getErrorMessage(error, 'Could not open the billing portal.')
      );
    }
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'You will need to log in again to access Commune.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            setUser(null);
            setActiveGroupId(null);
            queryClient.clear();
          } catch (error) {
            Alert.alert(
              'Could not sign out',
              getErrorMessage(error)
            );
          }
        },
      },
    ]);
  }

  if (!user) {
    return (
      <Screen>
        <EmptyState
          icon="settings-outline"
          title="Session not ready"
          description="Sign in again if settings do not load."
        />
      </Screen>
    );
  }

  if (isLoading || subscriptionLoading || !resolvedProfile) {
    return <LoadingScreen message="Loading settings..." />;
  }

  return (
    <Screen>
      <HeroPanel
        eyebrow="Profile and billing"
        title="Settings"
        description="Update your details, keep notification preferences under control, and manage billing."
      />

      <Surface className="mb-4">
        <View className="flex-row items-center">
          <InitialAvatar name={resolvedProfile.name} size={64} />
          <View className="ml-4 flex-1">
            <Text className="text-xl font-semibold text-[#17141F]">
              {resolvedProfile.name}
            </Text>
            <Text className="mt-1 text-sm text-[#6A645D]">
              {resolvedProfile.email}
            </Text>
            <Text className="mt-2 text-xs uppercase tracking-[2px] text-[#827A72]">
              Member since {formatDate(resolvedProfile.created_at)}
            </Text>
          </View>
        </View>
      </Surface>

      <Surface className="mb-4">
        <Text className="text-lg font-semibold text-[#17141F]">
          Profile
        </Text>
        <TextField label="Name" value={name} onChangeText={setName} />
        <TextField
          label="Avatar URL"
          value={avatarUrl}
          onChangeText={setAvatarUrl}
          placeholder="Optional"
        />
        <AppButton
          label="Save profile"
          icon="save-outline"
          loading={updateProfile.isPending}
          onPress={handleSave}
        />
      </Surface>

      <Surface className="mb-4">
        <Text className="text-lg font-semibold text-[#17141F]">
          Notifications
        </Text>
        <Text className="mt-2 text-sm leading-6 text-[#6A645D]">
          Email preferences follow the same profile record as the web app.
        </Text>
        <View className="mt-4">
          <ToggleRow
            label="New expenses"
            description="Receive an email when a new expense is added."
            value={notifications.email_on_new_expense}
            onValueChange={(value) =>
              setNotifications((current) => ({
                ...current,
                email_on_new_expense: value,
              }))
            }
          />
          <ToggleRow
            label="Payments received"
            description="Be notified when someone marks a payment."
            value={notifications.email_on_payment_received}
            onValueChange={(value) =>
              setNotifications((current) => ({
                ...current,
                email_on_payment_received: value,
              }))
            }
          />
          <ToggleRow
            label="Payment reminders"
            description="Send reminders for upcoming or missed payments."
            value={notifications.email_on_payment_reminder}
            onValueChange={(value) =>
              setNotifications((current) => ({
                ...current,
                email_on_payment_reminder: value,
              }))
            }
          />
          <ToggleRow
            label="Overdue alerts"
            description="Get notified when shared expenses slip overdue."
            value={notifications.email_on_overdue}
            onValueChange={(value) =>
              setNotifications((current) => ({
                ...current,
                email_on_overdue: value,
              }))
            }
          />
        </View>
      </Surface>

      <Surface className="mb-4">
        <Text className="text-lg font-semibold text-[#17141F]">
          Billing
        </Text>
        <Text className="mt-2 text-sm leading-6 text-[#6A645D]">
          {subscription
            ? `${planLabels[subscription.plan] ?? subscription.plan} plan · ${subscription.status.replace(/_/g, ' ')}`
            : 'No active subscription found for this account.'}
        </Text>
        {subscription ? (
          <>
            <Text className="mt-3 text-sm text-[#6A645D]">
              Current period ends {formatDate(subscription.current_period_end)}.
            </Text>
            <View className="mt-4">
              <AppButton
                label="Manage billing"
                variant="secondary"
                icon="open-outline"
                loading={portal.isPending}
                onPress={handleManageBilling}
              />
            </View>
          </>
        ) : null}
      </Surface>

      <AppButton
        label="Sign out"
        variant="danger"
        icon="log-out-outline"
        onPress={handleSignOut}
      />
    </Screen>
  );
}
