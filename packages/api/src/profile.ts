import { supabase } from './client';
import type { User as AuthUser } from '@supabase/supabase-js';

export interface NotificationPreferences {
  email_on_new_expense: boolean;
  email_on_payment_received: boolean;
  email_on_payment_reminder: boolean;
  email_on_overdue: boolean;
}

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  country: string | null;
  payment_info: string | null;
  default_currency: string;
  timezone: string;
  notification_preferences: NotificationPreferences;
  created_at: string;
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  email_on_new_expense: true,
  email_on_payment_received: true,
  email_on_payment_reminder: true,
  email_on_overdue: true,
};

function splitName(fullName: string): { first_name: string; last_name: string } {
  const spaceIndex = fullName.indexOf(' ');
  if (spaceIndex > 0) {
    return {
      first_name: fullName.substring(0, spaceIndex),
      last_name: fullName.substring(spaceIndex + 1),
    };
  }
  return { first_name: fullName, last_name: '' };
}

function buildProfileFromAuthUser(authUser: AuthUser): UserProfile {
  const metadata = authUser.user_metadata ?? {};

  const fullName =
    metadata.name
    ?? metadata.full_name
    ?? metadata.user_name
    ?? authUser.email?.split('@')[0]
    ?? 'Commune member';
  const { first_name, last_name } = splitName(fullName);

  return {
    id: authUser.id,
    first_name,
    last_name,
    name: last_name ? `${first_name} ${last_name}` : first_name,
    email: authUser.email ?? '',
    avatar_url: metadata.avatar_url ?? null,
    phone: null,
    country: null,
    payment_info: null,
    default_currency: 'GBP',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    notification_preferences: DEFAULT_NOTIFICATION_PREFS,
    created_at: authUser.created_at ?? new Date().toISOString(),
  };
}

function normalizeProfile(data: Record<string, any>): UserProfile {
  const first_name = data.first_name ?? (data.name ? splitName(data.name).first_name : '');
  const last_name = data.last_name ?? (data.name ? splitName(data.name).last_name : '');

  return {
    ...data,
    first_name,
    last_name,
    default_currency: data.default_currency ?? 'GBP',
    timezone: data.timezone ?? 'Europe/London',
    notification_preferences: data.notification_preferences ?? DEFAULT_NOTIFICATION_PREFS,
  } as UserProfile;
}

async function getAuthenticatedUser(userId: string) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user || user.id !== userId) {
    throw new Error('Not authenticated');
  }

  return user;
}

export async function ensureProfile(userId: string): Promise<UserProfile> {
  const authUser = await getAuthenticatedUser(userId);
  const fallbackProfile = buildProfileFromAuthUser(authUser);

  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        id: fallbackProfile.id,
        first_name: fallbackProfile.first_name,
        last_name: fallbackProfile.last_name,
        email: fallbackProfile.email,
        avatar_url: fallbackProfile.avatar_url,
      },
      { onConflict: 'id' },
    )
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return normalizeProfile(data);
}

export async function getProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return ensureProfile(userId);

  return normalizeProfile(data);
}

export async function uploadAvatar(
  userId: string,
  file: File,
): Promise<string> {
  const maxSize = 1 * 1024 * 1024; // 1 MB
  if (file.size > maxSize) {
    throw new Error('File must be under 1 MB.');
  }

  const ext = file.name.split('.').pop() ?? 'jpg';
  const filePath = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true, contentType: file.type });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

  // Append a cache-buster so the browser picks up new uploads immediately
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function updateProfile(
  userId: string,
  updates: {
    first_name?: string;
    last_name?: string;
    avatar_url?: string | null;
    phone?: string | null;
    country?: string | null;
    payment_info?: string | null;
    default_currency?: string;
    timezone?: string;
    notification_preferences?: NotificationPreferences;
  },
): Promise<UserProfile> {
  let { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .maybeSingle();

  if (!error && !data) {
    await ensureProfile(userId);
    const retry = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select('*')
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;

  return normalizeProfile(data);
}

export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_account');
  if (error) throw error;
}
