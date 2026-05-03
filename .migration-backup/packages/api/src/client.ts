import {
  createClient,
  type User as SupabaseAuthUser,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js';
import type { Database } from '@commune/types';

/**
 * Strongly-typed Supabase client bound to the generated `Database` schema.
 * Using this type (rather than the untyped `SupabaseClient`) means every
 * `.from('…')`, `.insert(…)`, `.update(…)`, and `.select()` call is checked
 * against the live schema.
 */
export type TypedSupabaseClient = SupabaseClient<Database>;

let _supabase: SupabaseClient | null = null;
let _supabaseUrl: string | null = null;
let _supabaseAnonKey: string | null = null;
let _sessionUser: SupabaseAuthUser | null | undefined;
let _sessionTrackingAttached = false;

/**
 * Initialize the Supabase client. Must be called once before using any API functions.
 * - Web: call from main.tsx with import.meta.env.VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 * - Mobile: call from root layout with process.env.EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
 */
export function initSupabase(
  url: string,
  anonKey: string,
  options?: SupabaseClientOptions<'public'>,
): SupabaseClient {
  if (_supabase) {
    return _supabase;
  }

  _supabaseUrl = url;
  _supabaseAnonKey = anonKey;
  // The runtime client is instantiated with the Database generic so the
  // underlying PostgREST client is schema-aware. The exported types remain
  // deliberately loose for backwards compatibility — callers that want strict
  // table typing should use `getTypedSupabase()` from this module.
  _supabase = createClient<Database>(url, anonKey, options) as unknown as SupabaseClient;
  if (!_sessionTrackingAttached) {
    _sessionTrackingAttached = true;
    _supabase.auth.onAuthStateChange((_event, session) => {
      _sessionUser = session?.user ?? null;
    });
  }
  return _supabase;
}

/**
 * Get the initialized Supabase client. Throws if initSupabase() has not been called.
 */
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    throw new Error(
      'Supabase not initialized. Call initSupabase(url, anonKey) before using any API functions.'
    );
  }
  return _supabase;
}

/**
 * Strongly-typed accessor for the Supabase client. Use this in call sites that
 * benefit from row/insert/update checking against the generated `Database`
 * schema. Prefer this over the legacy untyped `supabase` proxy for new code.
 */
export function getTypedSupabase(): TypedSupabaseClient {
  return getSupabase() as unknown as TypedSupabaseClient;
}

/**
 * Get the Supabase project URL. Throws if initSupabase() has not been called.
 */
export function getSupabaseUrl(): string {
  if (!_supabaseUrl) {
    throw new Error(
      'Supabase not initialized. Call initSupabase(url, anonKey) before using any API functions.'
    );
  }
  return _supabaseUrl;
}

/**
 * Get the initialized Supabase anon key. Throws if initSupabase() has not been called.
 */
export function getSupabaseAnonKey(): string {
  if (!_supabaseAnonKey) {
    throw new Error(
      'Supabase not initialized. Call initSupabase(url, anonKey) before using any API functions.'
    );
  }
  return _supabaseAnonKey;
}

export async function getSessionUser(): Promise<SupabaseAuthUser | null> {
  if (_sessionUser !== undefined) {
    return _sessionUser;
  }

  const client = getSupabase();
  const {
    data: { session },
    error,
  } = await client.auth.getSession();

  if (error) throw error;

  _sessionUser = session?.user ?? null;
  return _sessionUser;
}

export async function requireSessionUser(): Promise<SupabaseAuthUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error('Not authenticated');
  }
  return user;
}

/**
 * @deprecated Use getSupabase() instead. Kept for backwards compatibility —
 * existing code that imports `supabase` from this module continues to work
 * as long as initSupabase() has been called before first access.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as any)[prop];
  },
});
