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
  const { data, error } = await supabase.functions.invoke('generate-statement', {
    body: { groupId, month },
  });

  if (error) {
    // Extract a useful message from the error
    const msg =
      error.message ||
      (typeof error === 'object' && 'error' in (error as any) ? (error as any).error : null) ||
      'Failed to generate statement';
    throw new Error(msg);
  }

  // functions.invoke returns Blob for application/pdf content-type
  if (data instanceof Blob) {
    return data;
  }

  // If it came back as something else, try to use it
  if (data instanceof ArrayBuffer) {
    return new Blob([data], { type: 'application/pdf' });
  }

  throw new Error('Unexpected response from statement service');
}
