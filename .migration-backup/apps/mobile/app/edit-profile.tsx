import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  IconAlertCircle,
  IconCamera,
  IconChevronLeft,
  IconChevronRight,
} from '@tabler/icons-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getSupabase } from '@commune/api';
import type { NotificationPreferences } from '@commune/api';

import { Avatar, Pressable, Screen } from '@/components/primitives';
import { SelectRow } from '@/components/bottom-sheet';
import { colors, font, radius, space } from '@/constants/design';
import { hapticHeavy, hapticLight, hapticSuccess, hapticWarning } from '@/lib/haptics';
import { getErrorMessage } from '@/lib/errors';
import { useAuthStore } from '@/stores/auth';
import { useProfile, useUpdateProfile } from '@/hooks/use-profile';

/* ─── Picker option lists ────────────────────────────────────────────── */

const CURRENCY_OPTIONS = [
  { value: 'GBP', label: '£ GBP — Pound sterling' },
  { value: 'USD', label: '$ USD — US Dollar' },
  { value: 'EUR', label: '€ EUR — Euro' },
  { value: 'CAD', label: '$ CAD — Canadian Dollar' },
  { value: 'AUD', label: '$ AUD — Australian Dollar' },
  { value: 'NGN', label: '₦ NGN — Nigerian Naira' },
  { value: 'GHS', label: '₵ GHS — Ghanaian Cedi' },
  { value: 'ZAR', label: 'R ZAR — South African Rand' },
  { value: 'INR', label: '₹ INR — Indian Rupee' },
  { value: 'JPY', label: '¥ JPY — Japanese Yen' },
] as const;

const COUNTRY_OPTIONS = [
  { value: 'GB', label: 'United Kingdom' },
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'IE', label: 'Ireland' },
  { value: 'FR', label: 'France' },
  { value: 'DE', label: 'Germany' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'GH', label: 'Ghana' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'IN', label: 'India' },
  { value: 'JP', label: 'Japan' },
] as const;

const TIMEZONE_OPTIONS = [
  { value: 'Europe/London', label: 'Europe/London (GMT+0)' },
  { value: 'Europe/Dublin', label: 'Europe/Dublin (GMT+0)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (GMT+1)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (GMT+1)' },
  { value: 'America/New_York', label: 'America/New_York (GMT-5)' },
  { value: 'America/Chicago', label: 'America/Chicago (GMT-6)' },
  { value: 'America/Denver', label: 'America/Denver (GMT-7)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (GMT-8)' },
  { value: 'America/Toronto', label: 'America/Toronto (GMT-5)' },
  { value: 'Africa/Lagos', label: 'Africa/Lagos (GMT+1)' },
  { value: 'Africa/Accra', label: 'Africa/Accra (GMT+0)' },
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (GMT+2)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (GMT+5:30)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (GMT+9)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (GMT+11)' },
] as const;

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

type ThemeMode = (typeof THEME_OPTIONS)[number]['value'];

/* ─── Local draft shape ──────────────────────────────────────────────── */

interface ProfileDraft {
  name: string;
  phone: string;
  avatar_url: string | null;
  default_currency: string;
  country: string;
  timezone: string;
  theme: ThemeMode;
  push_enabled: boolean;
  email_digest: boolean;
  payment_reminders: boolean;
}

const EMPTY_DRAFT: ProfileDraft = {
  name: '',
  phone: '',
  avatar_url: null,
  default_currency: 'GBP',
  country: '',
  timezone: 'Europe/London',
  theme: 'system',
  push_enabled: true,
  email_digest: true,
  payment_reminders: true,
};

/* ─── Avatar upload helper (RN-compatible, Supabase Storage) ─────────── */

async function uploadAvatarFromUri(userId: string, uri: string): Promise<string> {
  const supabase = getSupabase();
  const response = await fetch(uri);
  const blob = await response.blob();

  // Derive a sensible extension. ImagePicker URIs commonly look like
  // `…/ImagePicker/abc123.jpg` — fall back to jpg if we can't tell.
  const tail = uri.split('?')[0]?.split('/').pop() ?? '';
  const extMatch = tail.match(/\.([a-zA-Z0-9]+)$/);
  const ext = (extMatch?.[1] ?? 'jpg').toLowerCase();
  const filePath = `${userId}/avatar.${ext}`;
  const contentType = blob.type && blob.type !== '' ? blob.type : `image/${ext === 'jpg' ? 'jpeg' : ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, blob, { upsert: true, contentType });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return `${data.publicUrl}?t=${Date.now()}`;
}

/* ─── Header ─────────────────────────────────────────────────────────── */

function ScreenHeader({
  onBack,
  onSave,
  saveDisabled,
  saving,
  topInset,
}: {
  onBack: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  saving: boolean;
  topInset: number;
}) {
  return (
    <View
      style={{
        paddingTop: topInset + 12,
        paddingHorizontal: space.gutter,
        backgroundColor: colors.bgBase,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 48,
          position: 'relative',
        }}
      >
        <Pressable
          onPress={onBack}
          hitSlop={10}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            paddingVertical: 6,
            paddingRight: 10,
            marginLeft: -4,
            opacity: pressed ? 0.6 : 1,
            zIndex: 2,
          })}
        >
          <IconChevronLeft size={22} color={colors.textPrimary} strokeWidth={2} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
            Back
          </Text>
        </Pressable>

        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={[font.h3, { color: colors.textPrimary }]}>Edit profile</Text>
        </View>

        <Pressable
          onPress={onSave}
          disabled={saveDisabled || saving}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityState={{ disabled: saveDisabled || saving }}
          accessibilityLabel="Save profile changes"
          style={({ pressed }) => ({
            paddingVertical: 6,
            paddingLeft: 10,
            zIndex: 2,
            opacity: pressed && !saveDisabled ? 0.6 : 1,
          })}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.sage} />
          ) : (
            <Text
              style={{
                fontSize: 15,
                fontWeight: saveDisabled ? '600' : '700',
                color: saveDisabled ? colors.textMuted : colors.sageInk,
              }}
            >
              Save
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

/* ─── Section label ──────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '700',
        color: colors.textTertiary,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        paddingHorizontal: 4,
        paddingTop: space.lg,
        paddingBottom: space.sm,
      }}
    >
      {children}
    </Text>
  );
}

/* ─── Form group container (white card, hairline-separated rows) ─────── */

function FormGroup({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.bgSurface,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        overflow: 'hidden',
        marginBottom: space.sm,
      }}
    >
      {children}
    </View>
  );
}

/* ─── Form row variants ──────────────────────────────────────────────── */

interface FormRowProps {
  label: string;
  value?: string;
  placeholder?: string;
  showChevron?: boolean;
  onPress?: () => void;
  isLast?: boolean;
  disabled?: boolean;
}

function ReadonlyRow({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: colors.textTertiary,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          width: 100,
        }}
      >
        {label}
      </Text>
      <Text
        style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function PressableRow({
  label,
  value,
  placeholder,
  onPress,
  showChevron = true,
  isLast,
  disabled,
}: FormRowProps) {
  const hasValue = !!value;
  const display = hasValue ? value : placeholder ?? '';
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        hapticLight();
        onPress?.();
      }}
      disabled={disabled}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.borderSubtle,
        opacity: pressed && !disabled ? 0.6 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: colors.textTertiary,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          width: 100,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: hasValue ? '600' : '400',
          color: hasValue ? colors.textPrimary : colors.textMuted,
        }}
        numberOfLines={1}
      >
        {display}
      </Text>
      {showChevron ? (
        <IconChevronRight size={18} color={colors.textMuted} strokeWidth={1.7} />
      ) : null}
    </Pressable>
  );
}

function TextInputRow({
  label,
  value,
  onChangeText,
  placeholder,
  isLast,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  isLast?: boolean;
  keyboardType?: 'default' | 'phone-pad';
  autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: 10,
        paddingHorizontal: 14,
        minHeight: 52,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          color: colors.textTertiary,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          width: 100,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: '600',
          color: colors.textPrimary,
          paddingVertical: 0,
        }}
      />
    </View>
  );
}

function SwitchRow({
  label,
  value,
  onValueChange,
  isLast,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: 12,
        paddingHorizontal: 14,
        minHeight: 52,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      <Text
        style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary }}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={(v) => {
          hapticLight();
          onValueChange(v);
        }}
        trackColor={{ false: colors.border, true: colors.sage }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

/* ─── Main screen ────────────────────────────────────────────────────── */

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const userId = user?.id ?? '';

  const { data: profile, isLoading, error: profileError } = useProfile(userId);
  const updateProfile = useUpdateProfile();

  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_DRAFT);
  const [baseline, setBaseline] = useState<ProfileDraft>(EMPTY_DRAFT);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Hydrate draft + baseline from profile
  useEffect(() => {
    if (!profile) return;
    const next: ProfileDraft = {
      name: profile.name ?? '',
      phone: profile.phone ?? '',
      avatar_url: profile.avatar_url,
      default_currency: profile.default_currency ?? 'GBP',
      country: profile.country ?? '',
      timezone: profile.timezone ?? 'Europe/London',
      theme: 'system',
      push_enabled: profile.notification_preferences?.email_on_payment_reminder ?? true,
      email_digest: profile.notification_preferences?.email_on_new_expense ?? true,
      payment_reminders: profile.notification_preferences?.email_on_payment_reminder ?? true,
    };
    setDraft(next);
    setBaseline(next);
  }, [profile]);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(baseline),
    [draft, baseline],
  );

  /* --- Avatar pick + upload --- */
  async function handlePickAvatar() {
    if (!userId) return;
    hapticLight();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      hapticWarning();
      Alert.alert('Permission needed to access photos');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploadingAvatar(true);
      const publicUrl = await uploadAvatarFromUri(userId, result.assets[0].uri);
      setDraft((d) => ({ ...d, avatar_url: publicUrl }));
      hapticSuccess();
    } catch (e) {
      hapticWarning();
      Alert.alert('Could not upload avatar', getErrorMessage(e, 'Please try again.'));
    } finally {
      setUploadingAvatar(false);
    }
  }

  /* --- Save mutation --- */
  async function handleSave() {
    if (!isDirty || !userId) return;
    hapticLight();

    const trimmedName = draft.name.trim();
    if (!trimmedName) {
      hapticWarning();
      Alert.alert('Name required', 'Please enter a display name.');
      return;
    }

    const [first_name, ...rest] = trimmedName.split(/\s+/);
    const last_name = rest.join(' ');

    const baselinePrefs = profile?.notification_preferences ?? {
      email_on_new_expense: true,
      email_on_payment_received: true,
      email_on_payment_reminder: true,
      email_on_overdue: true,
    };

    const notification_preferences: NotificationPreferences = {
      ...baselinePrefs,
      email_on_new_expense: draft.email_digest,
      email_on_payment_reminder: draft.payment_reminders,
    };

    try {
      await updateProfile.mutateAsync({
        userId,
        data: {
          first_name: first_name ?? '',
          last_name,
          phone: draft.phone.trim() ? draft.phone.trim() : null,
          avatar_url: draft.avatar_url,
          country: draft.country || null,
          default_currency: draft.default_currency,
          timezone: draft.timezone,
          notification_preferences,
        },
      });
      setBaseline(draft);
      hapticSuccess();
      router.back();
    } catch (e) {
      hapticWarning();
      Alert.alert('Could not save', getErrorMessage(e, 'Please try again.'));
    }
  }

  /* --- Danger-zone deactivate --- */
  function handleDeactivate() {
    hapticHeavy();
    Alert.alert(
      'Deactivate account',
      'Your account will be soft-deleted for 30 days. You can sign in within that window to recover it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: () => {
            // TODO: deactivate mutation
            Alert.alert(
              'Deactivation coming soon',
              'Account deactivation is not yet wired to the API.',
            );
          },
        },
      ],
    );
  }

  function handleChangePassword() {
    hapticLight();
    Alert.alert(
      'Change password',
      'We will email you a password-reset link to your sign-in address.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send link',
          onPress: () => {
            // TODO: trigger supabase password reset email
            Alert.alert('Coming soon', 'Password reset is not yet wired up.');
          },
        },
      ],
    );
  }

  /* --- Loading / error states --- */
  if (!userId) {
    return (
      <Screen>
        <ScreenHeader
          onBack={() => router.back()}
          onSave={() => undefined}
          saveDisabled
          saving={false}
          topInset={insets.top}
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={[font.body, { color: colors.textTertiary, textAlign: 'center' }]}>
            You need to be signed in to edit your profile.
          </Text>
        </View>
      </Screen>
    );
  }

  if (isLoading || !profile) {
    return (
      <Screen>
        <ScreenHeader
          onBack={() => router.back()}
          onSave={() => undefined}
          saveDisabled
          saving={false}
          topInset={insets.top}
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {profileError ? (
            <Text style={[font.body, { color: colors.dangerText, textAlign: 'center', padding: space.lg }]}>
              {getErrorMessage(profileError, 'Could not load profile.')}
            </Text>
          ) : (
            <ActivityIndicator color={colors.sage} />
          )}
        </View>
      </Screen>
    );
  }

  /* --- Render --- */
  return (
    <Screen>
      <ScreenHeader
        onBack={() => router.back()}
        onSave={handleSave}
        saveDisabled={!isDirty}
        saving={updateProfile.isPending}
        topInset={insets.top}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: space.base,
            paddingBottom: 24,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Profile hero ─────────────────────────────────── */}
          <View
            style={{
              marginTop: 4,
              marginBottom: 56,
              borderRadius: 18,
              overflow: 'visible',
            }}
          >
            <LinearGradient
              colors={[colors.bgBase, '#F4F0E7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{
                height: 120,
                borderRadius: 18,
                position: 'relative',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  bottom: -36,
                  left: 0,
                  right: 0,
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    borderWidth: 4,
                    borderColor: colors.bgBase,
                    backgroundColor: colors.bgBase,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Avatar
                    name={draft.name || profile.name}
                    size={88}
                    bg={colors.bgInk}
                    fg="#FFFFFF"
                    uri={draft.avatar_url ?? undefined}
                  />
                </View>
              </View>

              <Pressable
                onPress={handlePickAvatar}
                disabled={uploadingAvatar}
                accessibilityRole="button"
                accessibilityLabel="Change profile photo"
                style={({ pressed }) => ({
                  position: 'absolute',
                  bottom: -40,
                  left: '50%',
                  marginLeft: 28,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.bgInk,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 3,
                  borderColor: colors.bgBase,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <IconCamera size={14} color="#FFFFFF" strokeWidth={2} />
                )}
              </Pressable>
            </LinearGradient>
          </View>

          {/* ── Account ──────────────────────────────────────── */}
          <SectionLabel>Account</SectionLabel>
          <FormGroup>
            <TextInputRow
              label="Name"
              value={draft.name}
              onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
              placeholder="Your full name"
              autoCapitalize="words"
            />
            <ReadonlyRow label="Email" value={profile.email} />
            <TextInputRow
              label="Phone"
              value={draft.phone}
              onChangeText={(v) => setDraft((d) => ({ ...d, phone: v }))}
              placeholder="Add phone (optional)"
              keyboardType="phone-pad"
              isLast
            />
          </FormGroup>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingHorizontal: 4, marginTop: 6 }}>
            <IconAlertCircle size={13} color={colors.textTertiary} strokeWidth={1.8} style={{ marginTop: 2 }} />
            <Text
              style={{
                flex: 1,
                fontSize: 11.5,
                lineHeight: 16,
                color: colors.textTertiary,
              }}
            >
              Email change requires verification. We'll send a confirm link to the new address.
            </Text>
          </View>

          {/* ── Preferences ──────────────────────────────────── */}
          <SectionLabel>Preferences</SectionLabel>
          <FormGroup>
            <SelectRow
              label="Currency"
              value={draft.default_currency}
              options={CURRENCY_OPTIONS}
              onChange={(v) => setDraft((d) => ({ ...d, default_currency: v }))}
            />
            <SelectRow
              label="Country"
              value={draft.country || 'GB'}
              options={COUNTRY_OPTIONS}
              onChange={(v) => setDraft((d) => ({ ...d, country: v }))}
            />
            <SelectRow
              label="Timezone"
              value={draft.timezone}
              options={TIMEZONE_OPTIONS}
              onChange={(v) => setDraft((d) => ({ ...d, timezone: v }))}
            />
            <SelectRow
              label="Theme"
              value={draft.theme}
              options={THEME_OPTIONS}
              onChange={(v) => setDraft((d) => ({ ...d, theme: v }))}
              isLast
            />
          </FormGroup>

          {/* ── Notifications ────────────────────────────────── */}
          <SectionLabel>Notifications</SectionLabel>
          <FormGroup>
            <SwitchRow
              label="Push notifications"
              value={draft.push_enabled}
              onValueChange={(v) => setDraft((d) => ({ ...d, push_enabled: v }))}
            />
            <SwitchRow
              label="Email digest (weekly)"
              value={draft.email_digest}
              onValueChange={(v) => setDraft((d) => ({ ...d, email_digest: v }))}
            />
            <SwitchRow
              label="Payment reminders"
              value={draft.payment_reminders}
              onValueChange={(v) => setDraft((d) => ({ ...d, payment_reminders: v }))}
              isLast
            />
          </FormGroup>

          {/* ── Security ─────────────────────────────────────── */}
          <SectionLabel>Security</SectionLabel>
          <FormGroup>
            <PressableRow
              label="Password"
              value="Change password"
              onPress={handleChangePassword}
            />
            <PressableRow
              label="Sessions"
              value="Active sessions · 1"
              onPress={() => {
                hapticLight();
                Alert.alert('Active sessions', 'You are signed in on this device.');
              }}
              isLast
            />
          </FormGroup>

          {/* ── Danger zone ──────────────────────────────────── */}
          <SectionLabel>Danger zone</SectionLabel>
          <Pressable
            onPress={handleDeactivate}
            style={({ pressed }) => ({
              backgroundColor: colors.dangerBg,
              borderWidth: 1,
              borderColor: '#F4C7BF',
              borderRadius: radius.card,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <IconAlertCircle size={20} color={colors.dangerText} strokeWidth={1.7} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.dangerText }}>
                Deactivate account
              </Text>
              <Text style={{ fontSize: 11.5, color: '#A04438', marginTop: 2 }}>
                30-day soft delete · recoverable until expiry
              </Text>
            </View>
          </Pressable>
        </ScrollView>

        {/* ── Pinned save bar ────────────────────────────────── */}
        <View
          style={{
            paddingHorizontal: space.base,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12) + 8,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.bgBase,
          }}
        >
          <TouchableOpacity
            onPress={handleSave}
            disabled={!isDirty || updateProfile.isPending}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Save changes"
            accessibilityState={{ disabled: !isDirty || updateProfile.isPending }}
            style={{
              height: 52,
              borderRadius: 14,
              backgroundColor: !isDirty ? '#D1CFC9' : colors.bgInk,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {updateProfile.isPending ? (
              <ActivityIndicator size="small" color={!isDirty ? '#8C8B86' : '#FFFFFF'} />
            ) : (
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '700',
                  color: !isDirty ? '#8C8B86' : '#FFFFFF',
                }}
              >
                Save changes
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
