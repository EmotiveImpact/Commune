import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUserPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
} from '@commune/api';
import { settlementKeys } from './use-settlement';
import { crossGroupKeys } from './use-cross-group';
import { groupHubKeys } from './use-group-hub';

const KEYS = {
  methods: (userId: string) => ['payment-methods', userId] as const,
};

export function usePaymentMethods(userId: string) {
  return useQuery({
    queryKey: KEYS.methods(userId),
    queryFn: () => getUserPaymentMethods(userId),
    enabled: !!userId,
  });
}

export function useCreatePaymentMethod(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      provider: string;
      label?: string | null;
      payment_link?: string | null;
      payment_info?: string | null;
      is_default?: boolean;
    }) => createPaymentMethod(userId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.methods(userId) });
      void qc.invalidateQueries({ queryKey: settlementKeys.all });
      void qc.invalidateQueries({ queryKey: crossGroupKeys.all });
      void qc.invalidateQueries({ queryKey: groupHubKeys.all });
    },
  });
}

export function useUpdatePaymentMethod(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      methodId: string;
      data: {
        provider?: string;
        label?: string | null;
        payment_link?: string | null;
        payment_info?: string | null;
        is_default?: boolean;
      };
    }) => updatePaymentMethod(input.methodId, userId, input.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.methods(userId) });
      void qc.invalidateQueries({ queryKey: settlementKeys.all });
      void qc.invalidateQueries({ queryKey: crossGroupKeys.all });
      void qc.invalidateQueries({ queryKey: groupHubKeys.all });
    },
  });
}

export function useDeletePaymentMethod(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (methodId: string) => deletePaymentMethod(methodId, userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.methods(userId) });
      void qc.invalidateQueries({ queryKey: settlementKeys.all });
      void qc.invalidateQueries({ queryKey: crossGroupKeys.all });
      void qc.invalidateQueries({ queryKey: groupHubKeys.all });
    },
  });
}
