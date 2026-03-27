import { useQuery } from '@tanstack/react-query';
import {
  getWorkspaceBillingData,
  type WorkspaceBillingData,
} from '@commune/api';

export const workspaceBillingKeys = {
  all: ['workspace-billing'] as const,
  report: (groupId: string) => [...workspaceBillingKeys.all, groupId] as const,
};

export function useWorkspaceBilling(groupId: string) {
  return useQuery<WorkspaceBillingData>({
    queryKey: workspaceBillingKeys.report(groupId),
    queryFn: () => getWorkspaceBillingData(groupId),
    enabled: !!groupId,
    staleTime: 60_000,
  });
}
