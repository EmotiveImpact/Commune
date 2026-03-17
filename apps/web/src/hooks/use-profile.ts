import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile } from '@commune/api';
import type { NotificationPreferences } from '@commune/api';

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
        name?: string;
        avatar_url?: string | null;
        notification_preferences?: NotificationPreferences;
      };
    }) => updateProfile(userId, data),
    onSuccess: (result) => {
      queryClient.setQueryData(profileKeys.detail(result.id), result);
    },
  });
}
