import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
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
  Screen,
  SettingsSkeleton,
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
  const router = useRouter();
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
            first_name: user.first_name,
            last_name: user.last_name,
            name: user.name,
            email: user.email,
            avatar_url: user.avatar_url,
            phone: user.phone ?? null,
            country: user.country ?? null,
            payment_info: user.payment_info ?? null,
            notification_preferences: defaultNotifications,
            created_at: user.created_at,
          }
        : null),
    [profile, user]
  );

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [paymentInfo, setPaymentInfo] = useState('');
  const [notifications, setNotifications] = useState(defaultNotifications);

  useEffect(() => {
    if (!resolvedProfile) {
      return;
    }

    setFirstName(resolvedProfile.first_name ?? '');
    setLastName(resolvedProfile.last_name ?? '');
    setAvatarUrl(resolvedProfile.avatar_url ?? '');
    setPhone(resolvedProfile.phone ?? '');
    setCountry(resolvedProfile.country ?? '');
    setPaymentInfo(resolvedProfile.payment_info ?? '');
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
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          avatar_url: avatarUrl.trim() || null,
          phone: phone.trim() || null,
          country: country.trim() || null,
          payment_info: paymentInfo.trim() || null,
          notification_preferences: notifications,
        },
      });

      setUser({
        ...user,
        first_name: result.first_name,
        last_name: result.last_name,
        name: result.name,
        avatar_url: result.avatar_url,
        phone: result.phone,
        country: result.country,
        payment_info: result.payment_info,
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
    return <SettingsSkeleton />;
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
          <InitialAvatar name={`${resolvedProfile.first_name ?? ''} ${resolvedProfile.last_name ?? ''}`.trim() || resolvedProfile.name} size={64} />
          <View className="ml-4 flex-1">
            <Text className="text-xl font-semibold text-[#171b24]">
              {`${resolvedProfile.first_name ?? ''} ${resolvedProfile.last_name ?? ''}`.trim() || resolvedProfile.name}
            </Text>
            <Text className="mt-1 text-sm text-[#667085]">
              {resolvedProfile.email}
            </Text>
            <Text className="mt-2 text-xs uppercase tracking-[2px] text-[#667085]">
              Member since {formatDate(resolvedProfile.created_at)}
            </Text>
          </View>
        </View>
      </Surface>

      <Surface className="mb-4">
        <Text className="text-lg font-semibold text-[#171b24]">
          Profile
        </Text>
        <View className="flex-row" style={{ gap: 12 }}>
          <View className="flex-1">
            <TextField label="First name" value={firstName} onChangeText={setFirstName} />
          </View>
          <View className="flex-1">
            <TextField label="Last name" value={lastName} onChangeText={setLastName} />
          </View>
        </View>
        <TextField
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="+44 7700 900000"
        />
        <TextField
          label="Country"
          value={country}
          onChangeText={setCountry}
          placeholder="e.g. United Kingdom"
        />
        <TextField
          label="Avatar URL"
          value={avatarUrl}
          onChangeText={setAvatarUrl}
          placeholder="Optional"
        />
      </Surface>

      <Surface className="mb-4">
        <Text className="text-lg font-semibold text-[#171b24]">
          Payment info
        </Text>
        <Text className="mt-2 text-sm leading-6 text-[#667085]">
          Let group members know how to pay you. Visible to everyone in your groups.
        </Text>
        <TextField
          label="How to pay me"
          value={paymentInfo}
          onChangeText={setPaymentInfo}
          placeholder="e.g. Monzo: @yourname, Revolut: 07xxx"
        />
        <AppButton
          label="Save profile"
          icon="save-outline"
          loading={updateProfile.isPending}
          onPress={handleSave}
        />
      </Surface>

      <Surface className="mb-4">
        <Text className="text-lg font-semibold text-[#171b24]">
          Notifications
        </Text>
        <Text className="mt-2 text-sm leading-6 text-[#667085]">
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
        <Text className="text-lg font-semibold text-[#171b24]">
          Billing
        </Text>
        <Text className="mt-2 text-sm leading-6 text-[#667085]">
          {subscription
            ? `${planLabels[subscription.plan] ?? subscription.plan} plan · ${subscription.status.replace(/_/g, ' ')}`
            : 'No active subscription found for this account.'}
        </Text>
        {subscription ? (
          <>
            <Text className="mt-3 text-sm text-[#667085]">
              Current period ends {formatDate(subscription.current_period_end)}.
            </Text>
            <View className="mt-4" style={{ gap: 10 }}>
              <AppButton
                label="Manage billing"
                variant="secondary"
                icon="open-outline"
                loading={portal.isPending}
                onPress={handleManageBilling}
              />
              <AppButton
                label="View Plans"
                variant="secondary"
                icon="pricetag-outline"
                onPress={() => router.push('/pricing')}
              />
            </View>
          </>
        ) : (
          <View className="mt-4">
            <AppButton
              label="View Plans"
              icon="pricetag-outline"
              onPress={() => router.push('/pricing')}
            />
          </View>
        )}
      </Surface>

      <Surface className="mb-4">
        <Text className="text-lg font-semibold text-[#171b24]">Quick links</Text>
        <View className="mt-4" style={{ gap: 10 }}>
          <AppButton
            label="Recurring expenses"
            variant="secondary"
            icon="repeat-outline"
            onPress={() => router.push('/recurring')}
          />
          <AppButton
            label="Analytics"
            variant="secondary"
            icon="bar-chart-outline"
            onPress={() => router.push('/analytics')}
          />
          <AppButton
            label="Activity log"
            variant="secondary"
            icon="time-outline"
            onPress={() => router.push('/activity')}
          />
          <AppButton
            label="Members"
            variant="secondary"
            icon="people-outline"
            onPress={() => router.push('/members')}
          />
          <AppButton
            label="Edit group"
            variant="secondary"
            icon="create-outline"
            onPress={() => router.push('/group-edit')}
          />
        </View>
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
