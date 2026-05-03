import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile } from '@commune/api';
import type { NotificationPreferences } from '@commune/api';
import { groupKeys } from './use-groups';
import { groupHubKeys } from './use-group-hub';
import { activityKeys } from './use-activity';
import { profileKeys } from './profile-keys';

export function useProfile(userId: string) {
  return useQuery({
    queryKey: profileKeys.detail(userId),
    queryFn: () => getProfile(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
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
        default_currency?: string;
        timezone?: string;
        show_shared_groups?: boolean;
        notification_preferences?: NotificationPreferences;
      };
    }) => updateProfile(userId, data),
    onSuccess: (result) => {
      queryClient.setQueryData(profileKeys.detail(result.id), result);
      queryClient.invalidateQueries({ queryKey: groupKeys.all });
      queryClient.invalidateQueries({ queryKey: groupHubKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
    },
  });
}
