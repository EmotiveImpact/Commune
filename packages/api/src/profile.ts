import { supabase } from './client';

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

export async function getProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;

  return {
    ...data,
    notification_preferences: data.notification_preferences ?? DEFAULT_NOTIFICATION_PREFS,
  } as UserProfile;
}

export async function updateProfile(
  userId: string,
  updates: {
    name?: string;
    avatar_url?: string | null;
    notification_preferences?: NotificationPreferences;
  },
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw error;

  return {
    ...data,
    notification_preferences: data.notification_preferences ?? DEFAULT_NOTIFICATION_PREFS,
  } as UserProfile;
}
