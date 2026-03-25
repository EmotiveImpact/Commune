import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDate } from '@commune/utils';
import { signOut } from '@commune/api';
import { useQueryClient } from '@tanstack/react-query';
import { hapticHeavy, hapticLight, hapticMedium } from '@/lib/haptics';
import { useAuthStore } from '@/stores/auth';
import { useGroupStore } from '@/stores/group';
import { useThemeStore } from '@/stores/theme';
import { useProfile, useUpdateProfile } from '@/hooks/use-profile';
import { usePortal, useSubscription } from '@/hooks/use-subscriptions';
import { EmptyState, SettingsSkeleton } from '@/components/ui';
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

type QuickLink = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  route: string;
};

const quickLinks: QuickLink[] = [
  { icon: 'checkmark-circle-outline', label: 'Operations', route: '/operations' },
  { icon: 'calendar-outline', label: 'Cycle close', route: '/group-close' },
  { icon: 'repeat-outline', label: 'Recurring expenses', route: '/recurring' },
  { icon: 'bar-chart-outline', label: 'Analytics', route: '/analytics' },
  { icon: 'time-outline', label: 'Activity log', route: '/activity' },
  { icon: 'people-outline', label: 'Members', route: '/members' },
  { icon: 'create-outline', label: 'Edit group', route: '/group-edit' },
];

function shadow(elevation: number = 1) {
  if (Platform.OS === 'android') {
    return { elevation: elevation * 2 };
  }
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: elevation },
    shadowOpacity: 0.06 * elevation,
    shadowRadius: 4 * elevation,
  };
}

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, setUser } = useAuthStore();
  const setActiveGroupId = useGroupStore((state) => state.setActiveGroupId);
  const themeMode = useThemeStore((state) => state.mode);
  const toggleTheme = useThemeStore((state) => state.toggle);
  const { data: profile, isLoading } = useProfile(user?.id ?? '');
  const updateProfile = useUpdateProfile();
  const { data: subscription, isLoading: subscriptionLoading } = useSubscription(
    user?.id ?? ''
  );
  const portal = usePortal();

  const isDark = themeMode === 'dark';

  // -- Theme tokens --
  const bg = isDark ? '#0A0A0A' : '#F2F4F7';
  const cardBg = isDark ? '#1A1A1A' : '#FFFFFF';
  const textPrimary = isDark ? '#F5F5F5' : '#171b24';
  const textSecondary = isDark ? '#A1A1AA' : '#6B7280';
  const textMuted = isDark ? '#71717A' : '#9CA3AF';
  const borderColor = isDark ? '#2A2A2A' : '#F0F0F0';
  const inputBg = isDark ? '#111111' : '#F9FAFB';
  const inputBorder = isDark ? '#333' : '#E5E7EB';
  const chevronColor = isDark ? '#555' : '#D1D5DB';

  const resolvedProfile = useMemo(
    () =>
      profile ??
      (user
        ? {
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            name: user.name,
            email: user.email,
            avatar_url: user.avatar_url,
            phone: user.phone ?? null,
            country: user.country ?? null,
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
  const [notifications, setNotifications] = useState(defaultNotifications);
  const [editingProfile, setEditingProfile] = useState(false);

  useEffect(() => {
    if (!resolvedProfile) return;
    setFirstName(resolvedProfile.first_name ?? '');
    setLastName(resolvedProfile.last_name ?? '');
    setAvatarUrl(resolvedProfile.avatar_url ?? '');
    setPhone(resolvedProfile.phone ?? '');
    setCountry(resolvedProfile.country ?? '');
    setNotifications(
      resolvedProfile.notification_preferences ?? defaultNotifications
    );
  }, [resolvedProfile]);

  const displayName =
    `${resolvedProfile?.first_name ?? ''} ${resolvedProfile?.last_name ?? ''}`.trim() ||
    resolvedProfile?.name ||
    '';

  async function handleSave() {
    hapticMedium();
    if (!user) return;
    try {
      const result = await updateProfile.mutateAsync({
        userId: user.id,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          avatar_url: avatarUrl.trim() || null,
          phone: phone.trim() || null,
          country: country.trim() || null,
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
      });
      setEditingProfile(false);
      Alert.alert('Saved', 'Your settings have been updated.');
    } catch (error) {
      Alert.alert('Save failed', getErrorMessage(error));
    }
  }

  async function handleManageBilling() {
    hapticMedium();
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
    hapticHeavy();
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
            Alert.alert('Could not sign out', getErrorMessage(error));
          }
        },
      },
    ]);
  }

  // ── Guards ──
  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: bg }}>
        <EmptyState
          icon="settings-outline"
          title="Session not ready"
          description="Sign in again if settings do not load."
        />
      </View>
    );
  }

  if (isLoading || subscriptionLoading || !resolvedProfile) {
    return <SettingsSkeleton />;
  }

  // ── Helpers ──
  const cardStyle = {
    backgroundColor: cardBg,
    borderRadius: 16,
    ...shadow(2),
    marginBottom: 24,
  };

  function renderRow(
    label: string,
    value: string,
    onPress?: () => void,
    isLast?: boolean
  ) {
    return (
      <TouchableOpacity
        key={label}
        onPress={onPress ? () => { hapticLight(); onPress(); } : undefined}
        activeOpacity={onPress ? 0.6 : 1}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 16,
          paddingHorizontal: 16,
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: borderColor,
        }}
      >
        <Text style={{ flex: 1, fontSize: 14, color: textSecondary }}>{label}</Text>
        <Text
          style={{
            fontSize: 14,
            color: textPrimary,
            marginRight: 8,
            maxWidth: 180,
          }}
          numberOfLines={1}
        >
          {value || '--'}
        </Text>
        <Ionicons name="chevron-forward" size={16} color={chevronColor} />
      </TouchableOpacity>
    );
  }

  function renderNotificationRow(
    label: string,
    subtitle: string,
    key: keyof typeof defaultNotifications,
    isLast?: boolean
  ) {
    return (
      <View
        key={key}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: borderColor,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, color: textPrimary }}>{label}</Text>
          <Text style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>
            {subtitle}
          </Text>
        </View>
        <Switch
          value={notifications[key]}
          onValueChange={(val) => {
            hapticLight();
            setNotifications((prev) => ({ ...prev, [key]: val }));
          }}
          trackColor={{ false: '#E5E7EB', true: '#d7e6dd' }}
          thumbColor={notifications[key] ? '#2d6a4f' : '#FFFFFF'}
          ios_backgroundColor="#E5E7EB"
        />
      </View>
    );
  }

  // ── Render ──
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: bg }}
      contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Profile Card ── */}
      <View
        style={{
          backgroundColor: cardBg,
          borderRadius: 20,
          ...shadow(3),
          padding: 24,
          marginBottom: 28,
          alignItems: 'center',
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: '#1f2330',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#FFFFFF' }}>
            {getInitials(displayName)}
          </Text>
        </View>

        <Text
          style={{
            fontSize: 20,
            fontWeight: '600',
            color: textPrimary,
            marginTop: 14,
          }}
        >
          {displayName}
        </Text>
        <Text style={{ fontSize: 14, color: textMuted, marginTop: 4 }}>
          {resolvedProfile.email}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: textMuted,
            marginTop: 6,
          }}
        >
          Member since {formatDate(resolvedProfile.created_at)}
        </Text>

        <TouchableOpacity
          onPress={() => { hapticLight(); setEditingProfile(!editingProfile); }}
          activeOpacity={0.7}
          style={{
            marginTop: 16,
            borderWidth: 1,
            borderColor: isDark ? '#333' : '#D1D5DB',
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 24,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: '500',
              color: textPrimary,
            }}
          >
            {editingProfile ? 'Cancel editing' : 'Edit Profile'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Edit Profile Form (conditional) ── */}
      {editingProfile && (
        <View style={{ ...cardStyle, padding: 20 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: textMuted,
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 16,
            }}
          >
            Edit Profile
          </Text>

          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: textSecondary,
                    marginBottom: 6,
                    fontWeight: '500',
                  }}
                >
                  First name
                </Text>
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor={textMuted}
                  style={{
                    fontSize: 14,
                    color: textPrimary,
                    backgroundColor: inputBg,
                    borderWidth: 1,
                    borderColor: inputBorder,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: textSecondary,
                    marginBottom: 6,
                    fontWeight: '500',
                  }}
                >
                  Last name
                </Text>
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor={textMuted}
                  style={{
                    fontSize: 14,
                    color: textPrimary,
                    backgroundColor: inputBg,
                    borderWidth: 1,
                    borderColor: inputBorder,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                  }}
                />
              </View>
            </View>

            <View>
              <Text
                style={{
                  fontSize: 12,
                  color: textSecondary,
                  marginBottom: 6,
                  fontWeight: '500',
                }}
              >
                Phone
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+44 7700 900000"
                placeholderTextColor={textMuted}
                keyboardType="phone-pad"
                style={{
                  fontSize: 14,
                  color: textPrimary,
                  backgroundColor: inputBg,
                  borderWidth: 1,
                  borderColor: inputBorder,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                }}
              />
            </View>

            <View>
              <Text
                style={{
                  fontSize: 12,
                  color: textSecondary,
                  marginBottom: 6,
                  fontWeight: '500',
                }}
              >
                Country
              </Text>
              <TextInput
                value={country}
                onChangeText={setCountry}
                placeholder="e.g. United Kingdom"
                placeholderTextColor={textMuted}
                style={{
                  fontSize: 14,
                  color: textPrimary,
                  backgroundColor: inputBg,
                  borderWidth: 1,
                  borderColor: inputBorder,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                }}
              />
            </View>

            <View>
              <Text
                style={{
                  fontSize: 12,
                  color: textSecondary,
                  marginBottom: 6,
                  fontWeight: '500',
                }}
              >
                Avatar URL
              </Text>
              <TextInput
                value={avatarUrl}
                onChangeText={setAvatarUrl}
                placeholder="Optional"
                placeholderTextColor={textMuted}
                autoCapitalize="none"
                keyboardType="url"
                style={{
                  fontSize: 14,
                  color: textPrimary,
                  backgroundColor: inputBg,
                  borderWidth: 1,
                  borderColor: inputBorder,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                }}
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={updateProfile.isPending}
            activeOpacity={0.8}
            style={{
              marginTop: 20,
              backgroundColor: '#2d6a4f',
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              opacity: updateProfile.isPending ? 0.6 : 1,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>
              {updateProfile.isPending ? 'Saving...' : 'Save profile'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Profile Section (read-only rows) ── */}
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: textMuted,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 8,
        }}
      >
        Profile
      </Text>
      <View style={cardStyle}>
        {renderRow('First name', firstName, () => setEditingProfile(true))}
        {renderRow('Last name', lastName, () => setEditingProfile(true))}
        {renderRow('Phone', phone, () => setEditingProfile(true))}
        {renderRow('Country', country, () => setEditingProfile(true), true)}
      </View>

      {/* ── Notifications ── */}
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: textMuted,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 8,
        }}
      >
        Notifications
      </Text>
      <View style={cardStyle}>
        {renderNotificationRow(
          'New expenses',
          'Email when a new expense is added',
          'email_on_new_expense'
        )}
        {renderNotificationRow(
          'Payments received',
          'Notified when someone marks a payment',
          'email_on_payment_received'
        )}
        {renderNotificationRow(
          'Payment reminders',
          'Reminders for upcoming or missed payments',
          'email_on_payment_reminder'
        )}
        {renderNotificationRow(
          'Overdue alerts',
          'When shared expenses slip overdue',
          'email_on_overdue',
          true
        )}
      </View>

      {/* ── Appearance ── */}
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: textMuted,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 8,
        }}
      >
        Appearance
      </Text>
      <View style={cardStyle}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 14,
            paddingHorizontal: 16,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, color: textPrimary }}>Dark mode</Text>
            <Text style={{ fontSize: 12, color: textMuted, marginTop: 2 }}>
              Switch between light and dark themes
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={() => { hapticLight(); toggleTheme(); }}
            trackColor={{ false: '#E5E7EB', true: '#d7e6dd' }}
            thumbColor={isDark ? '#2d6a4f' : '#FFFFFF'}
            ios_backgroundColor="#E5E7EB"
          />
        </View>
      </View>

      {/* ── Billing ── */}
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: textMuted,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 8,
        }}
      >
        Billing
      </Text>
      <View style={{ ...cardStyle, padding: 16 }}>
        <Text
          style={{
            fontSize: 14,
            color: textSecondary,
            marginBottom: 4,
          }}
        >
          {subscription
            ? `${planLabels[subscription.plan] ?? subscription.plan} plan \u00B7 ${subscription.status.replace(/_/g, ' ')}`
            : 'No active subscription found for this account.'}
        </Text>
        {subscription && (
          <Text style={{ fontSize: 13, color: textMuted, marginBottom: 16 }}>
            Current period ends {formatDate(subscription.current_period_end)}
          </Text>
        )}
        <View style={{ gap: 10 }}>
          {subscription && (
            <TouchableOpacity
              onPress={handleManageBilling}
              disabled={portal.isPending}
              activeOpacity={0.7}
              style={{
                borderWidth: 1,
                borderColor: isDark ? '#333' : '#D1D5DB',
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                opacity: portal.isPending ? 0.6 : 1,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '500', color: textPrimary }}>
                {portal.isPending ? 'Opening...' : 'Manage billing'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => { hapticMedium(); router.push('/pricing'); }}
            activeOpacity={0.7}
            style={{
              borderWidth: 1,
              borderColor: isDark ? '#333' : '#D1D5DB',
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '500', color: textPrimary }}>
              View Plans
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Quick Links ── */}
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: textMuted,
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginBottom: 8,
        }}
      >
        Quick links
      </Text>
      <View style={cardStyle}>
        {quickLinks.map((link, index) => (
          <TouchableOpacity
            key={link.route}
            onPress={() => { hapticMedium(); router.push(link.route as never); }}
            activeOpacity={0.6}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderBottomWidth: index < quickLinks.length - 1 ? 1 : 0,
              borderBottomColor: borderColor,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: isDark ? '#1f2330' : '#F3F4F6',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Ionicons name={link.icon} size={18} color={textSecondary} />
            </View>
            <Text style={{ flex: 1, fontSize: 14, color: textPrimary }}>
              {link.label}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={chevronColor} />
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Save Notifications (auto-save trigger) ── */}
      <TouchableOpacity
        onPress={handleSave}
        disabled={updateProfile.isPending}
        activeOpacity={0.8}
        style={{
          backgroundColor: '#2d6a4f',
          borderRadius: 14,
          paddingVertical: 16,
          alignItems: 'center',
          marginBottom: 16,
          opacity: updateProfile.isPending ? 0.6 : 1,
          ...shadow(2),
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#FFFFFF' }}>
          {updateProfile.isPending ? 'Saving...' : 'Save all changes'}
        </Text>
      </TouchableOpacity>

      {/* ── Sign Out ── */}
      <TouchableOpacity
        onPress={handleSignOut}
        activeOpacity={0.7}
        style={{
          paddingVertical: 16,
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '500', color: '#EF4444' }}>
          Sign out
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function getInitials(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'C'
  );
}
