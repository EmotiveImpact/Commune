import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from './client';

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  });

  if (error) throw error;
  return data;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

function getDefaultRedirectUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}/callback`;
  }
  return '';
}

export async function signInWithGoogle(redirectUrl?: string) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl ?? getDefaultRedirectUrl(),
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithApple(redirectUrl?: string) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: redirectUrl ?? getDefaultRedirectUrl(),
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithGitHub(redirectUrl?: string) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: redirectUrl ?? getDefaultRedirectUrl(),
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string, redirectUrl?: string) {
  const defaultUrl = typeof window !== 'undefined' && window.location
    ? `${window.location.origin}/callback?type=recovery`
    : '';
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl ?? defaultUrl,
  });
  if (error) throw error;
  return data;
}

export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
  return data;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  return supabase.auth.onAuthStateChange(callback);
}
