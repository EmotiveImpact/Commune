import { useMemo } from 'react';
import {
  getWorkspaceGovernancePreview,
  type WorkspaceGovernancePreview,
} from '@commune/core';
import type { GroupApprovalPolicy } from '@commune/types';

type WorkspaceGroupShape = {
  type?: string | null;
  subtype?: string | null;
  approval_threshold?: number | null;
  approval_policy?: GroupApprovalPolicy | null;
  currency?: string | null;
};

export function useWorkspaceGovernance(
  group?: WorkspaceGroupShape | null,
): WorkspaceGovernancePreview {
  return useMemo(
    () => getWorkspaceGovernancePreview(group),
    [group],
  );
}
