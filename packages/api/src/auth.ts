import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getTypedSupabase } from './client';

export const DEFAULT_AUTH_RATE_LIMIT_COOLDOWN_MS = 30_000;

type AuthRateLimitCandidate = {
  code?: string;
  status?: number;
  message?: string;
};

function toAuthRateLimitCandidate(error: unknown): AuthRateLimitCandidate | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const candidate = error as Record<string, unknown>;
  return {
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
    status: typeof candidate.status === 'number' ? candidate.status : undefined,
    message: typeof candidate.message === 'string' ? candidate.message : undefined,
  };
}

export function getAuthRateLimitCooldownMs(error: unknown): number | null {
  const candidate = toAuthRateLimitCandidate(error);
  if (!candidate) {
    return null;
  }

  const normalizedMessage = candidate.message?.toLowerCase() ?? '';
  const isRateLimit =
    candidate.status === 429 ||
    candidate.code === 'over_request_rate_limit' ||
    normalizedMessage.includes('rate limit');

  if (!isRateLimit) {
    return null;
  }

  return DEFAULT_AUTH_RATE_LIMIT_COOLDOWN_MS;
}

export function isAuthRateLimitError(error: unknown): boolean {
  return getAuthRateLimitCooldownMs(error) != null;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name: string,
) {
  const supabase = getTypedSupabase();
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
  const supabase = getTypedSupabase();
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
  const supabase = getTypedSupabase();
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
  const supabase = getTypedSupabase();
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
  const supabase = getTypedSupabase();
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
  const supabase = getTypedSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email: string, redirectUrl?: string) {
  const defaultUrl = typeof window !== 'undefined' && window.location
    ? `${window.location.origin}/callback?type=recovery`
    : '';
  const supabase = getTypedSupabase();
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl ?? defaultUrl,
  });
  if (error) throw error;
  return data;
}

export async function updatePassword(newPassword: string) {
  const supabase = getTypedSupabase();
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
  return data;
}

export async function getSession() {
  const supabase = getTypedSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  const supabase = getTypedSupabase();
  return supabase.auth.onAuthStateChange(callback);
}
