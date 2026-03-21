import type { Subscription, SubscriptionPlan } from '@commune/types';
import { supabase, getSupabaseUrl, getSupabaseAnonKey } from './client';

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
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const response = await fetch(
    `${getSupabaseUrl()}/functions/v1/generate-statement`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': getSupabaseAnonKey(),
      },
      body: JSON.stringify({ groupId, month }),
    },
  );

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const err = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(err?.error || `Statement request failed (${response.status})`);
    }
    const text = (await response.text().catch(() => '')).trim();
    throw new Error(text || `Statement request failed (${response.status})`);
  }

  return response.blob();
}
