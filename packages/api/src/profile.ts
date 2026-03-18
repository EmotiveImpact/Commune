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
  name: string;
  email: string;
  avatar_url: string | null;
  notification_preferences: NotificationPreferences;
  created_at: string;
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  email_on_new_expense: true,
  email_on_payment_received: true,
  email_on_payment_reminder: true,
  email_on_overdue: true,
};

function buildProfileFromAuthUser(authUser: AuthUser): UserProfile {
  const metadata = authUser.user_metadata ?? {};

  return {
    id: authUser.id,
    name:
      metadata.name
      ?? metadata.full_name
      ?? metadata.user_name
      ?? authUser.email?.split('@')[0]
      ?? 'Commune member',
    email: authUser.email ?? '',
    avatar_url: metadata.avatar_url ?? null,
    notification_preferences: DEFAULT_NOTIFICATION_PREFS,
    created_at: authUser.created_at ?? new Date().toISOString(),
  };
}

function normalizeProfile(data: Record<string, any>): UserProfile {
  return {
    ...data,
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
        name: fallbackProfile.name,
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

export async function updateProfile(
  userId: string,
  updates: {
    name?: string;
    avatar_url?: string | null;
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
