import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import type { Subscription, SubscriptionPlan } from '@commune/types';
import { supabase } from './client';

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function invokeCheckout(
  plan: SubscriptionPlan,
  interval: 'monthly' | 'annual' = 'monthly',
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { plan, interval },
  });

  if (error) throw error;
  return data.url;
}

export async function invokePortal(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('create-portal-session');

  if (error) throw error;
  return data.url;
}

export async function downloadStatement(groupId: string, month: string): Promise<Blob> {
  const { data, error, response } = await supabase.functions.invoke<Blob>('generate-statement', {
    body: { groupId, month },
  });

  if (error) {
    if (error instanceof FunctionsHttpError && response) {
      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('application/json')) {
        const err = await response.clone().json().catch(() => null) as { error?: string } | null;
        throw new Error(err?.error || `Statement request failed (${response.status})`);
      }

      const text = (await response.clone().text().catch(() => '')).trim();
      throw new Error(text || `Statement request failed (${response.status})`);
    }

    if (error instanceof FunctionsFetchError) {
      throw new Error('Could not reach statement service');
    }

    if (error instanceof FunctionsRelayError) {
      throw new Error('Statement service unavailable');
    }

    throw new Error(error.message || 'Failed to generate statement');
  }

  if (!(data instanceof Blob)) {
    throw new Error('Statement service returned an unexpected response');
  }

  return data;
}
