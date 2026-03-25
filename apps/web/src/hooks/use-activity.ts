import { useQuery } from '@tanstack/react-query';
import { getActivityLog } from '@commune/api';
import type { ActivityEntry } from '@commune/api';
import {
  getDashboardWorkspaceExpenseContext,
  hasDashboardWorkspaceExpenseContext,
} from './use-dashboard';

export interface ActivityWorkspaceBillingContext {
  vendor_name: string;
  invoice_reference: string;
  invoice_date: string;
  payment_due_date: string;
}

export const activityKeys = {
  all: ['activity'] as const,
  list: (groupId: string, limit?: number) =>
    [...activityKeys.all, 'list', groupId, limit] as const,
};

export function getActivityWorkspaceBillingContext(
  entry?: ActivityEntry | null,
): ActivityWorkspaceBillingContext {
  const topLevelContext = entry?.workspace_billing_context as Record<string, unknown> | undefined;
  const metadata = entry?.metadata as Record<string, unknown> | undefined;
  const nestedMetadataContext = metadata?.workspace_billing_context as Record<string, unknown> | undefined;
  const source = topLevelContext ?? nestedMetadataContext ?? metadata;
  return getDashboardWorkspaceExpenseContext(source);
}

export function hasActivityWorkspaceBillingContext(entry?: ActivityEntry | null): boolean {
  return hasDashboardWorkspaceExpenseContext(getActivityWorkspaceBillingContext(entry));
}

export function useActivityLog(groupId: string, limit = 50) {
  return useQuery({
    queryKey: activityKeys.list(groupId, limit),
    queryFn: () => getActivityLog(groupId, limit),
    enabled: !!groupId,
  });
}
