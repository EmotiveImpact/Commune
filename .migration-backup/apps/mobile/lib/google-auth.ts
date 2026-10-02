/**
 * Mobile Google sign-in via Supabase OAuth + expo-web-browser.
 *
 * The web flow (signInWithGoogle in @commune/api) opens a redirect that
 * works fine in a browser tab but never returns to the app on iOS. On
 * mobile we ask Supabase for the OAuth URL with `skipBrowserRedirect`,
 * open it inside an in-app browser session via WebBrowser, wait for the
 * redirect back to our deep-link scheme, parse the tokens out of the
 * URL hash, and call setSession() to finalise the login.
 *
 * Supabase Dashboard → Authentication → URL configuration must list the
 * deep-link redirect as an allowed redirect URL. Use whatever
 * `Linking.createURL('auth/callback')` returns at runtime — typically
 * `commune://auth/callback` for a published build, or
 * `exp://192.168.x.x:8081/--/auth/callback` for Expo Go.
 */

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { getSupabase } from '@commune/api';

WebBrowser.maybeCompleteAuthSession();

export type GoogleSignInResult =
  | { type: 'success' }
  | { type: 'cancel' }
  | { type: 'error'; message: string };

export async function signInWithGoogleMobile(): Promise<GoogleSignInResult> {
  const supabase = getSupabase();
  const redirectTo = Linking.createURL('auth/callback');

  // Ask Supabase for the OAuth URL but don't auto-redirect — we open it ourselves.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) return { type: 'error', message: error.message };
  if (!data?.url) return { type: 'error', message: 'Could not start Google sign-in.' };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { type: 'cancel' };
  }
  if (result.type !== 'success' || !result.url) {
    return { type: 'error', message: 'Google sign-in did not complete.' };
  }

  // Parse the redirect URL for tokens. Supabase puts them in the hash on
  // the implicit flow (#access_token=...&refresh_token=...) or as code in
  // the query string on the PKCE flow.
  const parsed = parseAuthCallback(result.url);

  if (parsed.code) {
    const exchanged = await supabase.auth.exchangeCodeForSession(parsed.code);
    if (exchanged.error) {
      return { type: 'error', message: exchanged.error.message };
    }
    return { type: 'success' };
  }

  if (parsed.access_token && parsed.refresh_token) {
    const setRes = await supabase.auth.setSession({
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
    });
    if (setRes.error) {
      return { type: 'error', message: setRes.error.message };
    }
    return { type: 'success' };
  }

  return { type: 'error', message: 'No session in callback.' };
}

function parseAuthCallback(url: string): {
  access_token?: string;
  refresh_token?: string;
  code?: string;
} {
  const out: { access_token?: string; refresh_token?: string; code?: string } = {};
  const hashIdx = url.indexOf('#');
  const queryIdx = url.indexOf('?');
  const hash = hashIdx >= 0 ? url.slice(hashIdx + 1) : '';
  const query =
    queryIdx >= 0 && (hashIdx < 0 || queryIdx < hashIdx)
      ? url.slice(queryIdx + 1, hashIdx >= 0 ? hashIdx : undefined)
      : '';
  for (const pair of [...hash.split('&'), ...query.split('&')]) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    const k = decodeURIComponent(pair.slice(0, eq));
    const v = decodeURIComponent(pair.slice(eq + 1));
    if (k === 'access_token') out.access_token = v;
    else if (k === 'refresh_token') out.refresh_token = v;
    else if (k === 'code') out.code = v;
  }
  return out;
}
