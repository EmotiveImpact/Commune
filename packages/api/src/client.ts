import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;
let _supabaseUrl: string | null = null;
let _supabaseAnonKey: string | null = null;

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
  _supabase = createClient(url, anonKey, options);
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
