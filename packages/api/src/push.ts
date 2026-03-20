import { supabase } from './client';

/**
 * Shape of a browser PushSubscription's JSON representation,
 * containing the fields we persist server-side.
 */
export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

/**
 * Save a Web Push subscription for the given user.
 * Uses upsert so re-subscribing with the same endpoint is idempotent.
 */
export async function subscribeToPush(
  userId: string,
  subscription: PushSubscriptionJSON,
): Promise<PushSubscriptionRecord> {
  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys?.p256dh;
  const auth = subscription.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Invalid push subscription: missing endpoint, p256dh, or auth key');
  }

  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
      },
      { onConflict: 'user_id,endpoint' },
    )
    .select()
    .single();

  if (error) throw error;
  return data as PushSubscriptionRecord;
}

/**
 * Remove a Web Push subscription by user and endpoint.
 */
export async function unsubscribeFromPush(
  userId: string,
  endpoint: string,
): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint);

  if (error) throw error;
}

/**
 * Check whether the user has any active push subscriptions.
 */
export async function getPushSubscriptions(
  userId: string,
): Promise<PushSubscriptionRecord[]> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;
  return (data ?? []) as PushSubscriptionRecord[];
}
