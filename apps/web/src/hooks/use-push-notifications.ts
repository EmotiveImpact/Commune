import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  subscribeToPush,
  unsubscribeFromPush,
  getPushSubscriptions,
} from '@commune/api';

// VAPID public key for Web Push API subscription.
// The corresponding private key must be set as VAPID_PRIVATE_KEY in the server environment.
// Regenerate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = 'BGYsUhHYMOZH5DLvO1jDhViAMUiMTc2fKAY9HV-PaEq88D05CJrtl-d8B08XeOAIyQEn8n8INC1CUcrs88pPy7g';

/** Check whether the browser supports push notifications. */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Convert a URL-safe base64 VAPID key to a Uint8Array
 * required by PushManager.subscribe().
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ── Query keys ──────────────────────────────────────────────────────────────

export const pushKeys = {
  all: ['push-subscriptions'] as const,
  list: (userId: string) => [...pushKeys.all, userId] as const,
};

// ── Queries ─────────────────────────────────────────────────────────────────

/**
 * Query to check whether the user has any active push subscriptions.
 */
export function usePushSubscription(userId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: pushKeys.list(userId),
    queryFn: () => getPushSubscriptions(userId),
    enabled: !!userId && isPushSupported() && (options?.enabled ?? true),
    staleTime: 5 * 60_000,
  });
}

// ── Mutations ───────────────────────────────────────────────────────────────

/**
 * Mutation that:
 * 1. Requests notification permission
 * 2. Registers the service worker
 * 3. Subscribes to push via the PushManager
 * 4. Saves the subscription to the database
 */
export function useSubscribePush() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      if (!isPushSupported()) {
        throw new Error('Push notifications are not supported in this browser');
      }

      // 1. Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission was denied');
      }

      // 2. Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      // Wait for the service worker to be ready
      await navigator.serviceWorker.ready;

      // 3. Subscribe to push
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });

      // 4. Persist to database
      const subscriptionJSON = pushSubscription.toJSON();
      return subscribeToPush(userId, subscriptionJSON);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pushKeys.all });
    },
  });
}

/**
 * Mutation that unsubscribes from push notifications and removes the
 * subscription from the database.
 */
export function useUnsubscribePush() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      if (!isPushSupported()) return;

      const registration = await navigator.serviceWorker.getRegistration('/');
      if (registration) {
        const pushSubscription = await registration.pushManager.getSubscription();
        if (pushSubscription) {
          const endpoint = pushSubscription.endpoint;
          await pushSubscription.unsubscribe();
          await unsubscribeFromPush(userId, endpoint);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pushKeys.all });
    },
  });
}
