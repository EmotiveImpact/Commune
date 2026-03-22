import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile } from '@commune/api';
import type { NotificationPreferences } from '@commune/api';
import type { PaymentProvider } from '@commune/types';

export const profileKeys = {
  all: ['profile'] as const,
  detail: (userId: string) => [...profileKeys.all, userId] as const,
};

export function useProfile(userId: string) {
  return useQuery({
    queryKey: profileKeys.detail(userId),
    queryFn: () => getProfile(userId),
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      data,
    }: {
      userId: string;
      data: {
        first_name?: string;
        last_name?: string;
        avatar_url?: string | null;
        phone?: string | null;
        country?: string | null;
        payment_info?: string | null;
        payment_provider?: PaymentProvider | null;
        payment_link?: string | null;
        default_currency?: string;
        timezone?: string;
        notification_preferences?: NotificationPreferences;
      };
    }) => updateProfile(userId, data),
    onSuccess: (result) => {
      queryClient.setQueryData(profileKeys.detail(result.id), result);
    },
  });
}
