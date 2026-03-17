import { useQuery, useMutation } from '@tanstack/react-query';
import { getSubscription, invokeCheckout, invokePortal } from '@commune/api';
import type { SubscriptionPlan } from '@commune/types';

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
    mutationFn: (plan: SubscriptionPlan) => invokeCheckout(plan),
    onSuccess: (url) => {
      window.location.href = url;
    },
  });
}

export function usePortal() {
  return useMutation({
    mutationFn: () => invokePortal(),
    onSuccess: (url) => {
      window.location.href = url;
    },
  });
}
