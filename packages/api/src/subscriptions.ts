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
