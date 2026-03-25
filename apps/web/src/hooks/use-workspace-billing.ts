import { useQuery } from '@tanstack/react-query';
import { getAnalyticsData } from '@commune/api';
import type {
  WorkspaceBillingSnapshot,
  WorkspaceBillingTrendPoint,
  WorkspaceBillingExportRow,
} from '@commune/api';
import { analyticsKeys } from './use-analytics';

export interface WorkspaceBillingData {
  snapshot: WorkspaceBillingSnapshot;
  trend: WorkspaceBillingTrendPoint[];
  export_rows: WorkspaceBillingExportRow[];
}

export const workspaceBillingKeys = {
  all: ['workspace-billing'] as const,
  report: (groupId: string) => [...workspaceBillingKeys.all, groupId] as const,
};

export function useWorkspaceBilling(groupId: string) {
  return useQuery({
    queryKey: analyticsKeys.data(groupId),
    queryFn: () => getAnalyticsData(groupId),
    enabled: !!groupId,
    select: (data): WorkspaceBillingData => data.workspace_billing,
  });
}
