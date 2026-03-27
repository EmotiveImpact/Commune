import { useQuery, useMutation } from '@tanstack/react-query';
import { getSubscription, invokeCheckout, invokePortal } from '@commune/api';
import type { SubscriptionPlan } from '@commune/types';
import { assertTrustedRedirectUrl, redirectToTrustedUrl } from '../utils/trusted-navigation';

export const subscriptionKeys = {
  all: ['subscriptions'] as const,
  detail: (userId: string) => [...subscriptionKeys.all, 'detail', userId] as const,
};

export function useSubscription(userId: string) {
  return useQuery({
    queryKey: subscriptionKeys.detail(userId),
    queryFn: () => getSubscription(userId),
    enabled: !!userId,
  });
}

export function useCheckout() {
  return useMutation({
    mutationFn: async ({
      plan,
      interval,
    }: {
      plan: SubscriptionPlan;
      interval: 'monthly' | 'annual';
    }) => assertTrustedRedirectUrl(await invokeCheckout(plan, interval)),
    onSuccess: (url) => {
      redirectToTrustedUrl(url);
    },
  });
}

export function usePortal() {
  return useMutation({
    mutationFn: async () => assertTrustedRedirectUrl(await invokePortal()),
    onSuccess: (url) => {
      redirectToTrustedUrl(url);
    },
  });
}
