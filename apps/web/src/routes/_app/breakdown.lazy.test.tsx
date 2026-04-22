import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BreakdownPage } from './breakdown.lazy';

const refetchGroupMock = vi.fn();
const refetchPlanLimitsMock = vi.fn();
const refetchBreakdownMock = vi.fn();
const refetchSettlementMock = vi.fn();
const refetchNudgeHistoryMock = vi.fn();

let useGroupResultMock: any = {
  data: {
    id: 'group-1',
    currency: 'GBP',
    nudges_enabled: true,
    members: [
      {
        id: 'member-1',
        user_id: 'user-1',
        role: 'member',
        status: 'active',
        user: { id: 'user-1', name: 'August', avatar_url: null },
      },
    ],
  },
  isError: false,
  error: null,
  refetch: refetchGroupMock,
};

let usePlanLimitsResultMock: any = {
  canDownloadStatements: true,
  isError: false,
  error: null,
  refetch: refetchPlanLimitsMock,
};

let useBreakdownResultMock: any = {
  data: {
    total_owed: 120,
    total_paid: 40,
    remaining: 80,
    items: [],
  },
  isLoading: false,
  isError: false,
  error: null,
  refetch: refetchBreakdownMock,
};

let useSettlementResultMock: any = {
  data: {
    transactions: [],
    transactionCount: 0,
    isSettled: true,
  },
  isLoading: false,
  isError: false,
  error: null,
  refetch: refetchSettlementMock,
};

let useNudgeHistoryResultMock: any = {
  data: [],
  isLoading: false,
  isError: false,
  error: null,
  refetch: refetchNudgeHistoryMock,
};

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => config,
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../../stores/group', () => ({
  useGroupStore: () => ({
    activeGroupId: 'group-1',
  }),
}));

vi.mock('../../stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
  }),
}));

vi.mock('../../hooks/use-groups', () => ({
  useGroup: () => useGroupResultMock,
}));

vi.mock('../../hooks/use-plan-limits', () => ({
  usePlanLimits: () => usePlanLimitsResultMock,
}));

vi.mock('../../hooks/use-dashboard', () => ({
  useUserBreakdown: () => useBreakdownResultMock,
}));

vi.mock('../../hooks/use-expenses', () => ({
  useMarkPayment: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('../../hooks/use-settlement', () => ({
  useGroupSettlement: () => useSettlementResultMock,
}));

vi.mock('../../hooks/use-nudges', () => ({
  useCanNudge: () => ({ data: { allowed: true } }),
  useNudgeHistory: () => useNudgeHistoryResultMock,
  useSendNudge: () => ({ mutate: vi.fn() }),
}));

vi.mock('../../utils/seo', () => ({
  setPageTitle: vi.fn(),
}));

describe('BreakdownPage', () => {
  beforeEach(() => {
    refetchGroupMock.mockReset();
    refetchPlanLimitsMock.mockReset();
    refetchBreakdownMock.mockReset();
    refetchSettlementMock.mockReset();
    refetchNudgeHistoryMock.mockReset();
    useGroupResultMock = {
      data: {
        id: 'group-1',
        currency: 'GBP',
        nudges_enabled: true,
        members: [
          {
            id: 'member-1',
            user_id: 'user-1',
            role: 'member',
            status: 'active',
            user: { id: 'user-1', name: 'August', avatar_url: null },
          },
        ],
      },
      isError: false,
      error: null,
      refetch: refetchGroupMock,
    };
    usePlanLimitsResultMock = {
      canDownloadStatements: true,
      isError: false,
      error: null,
      refetch: refetchPlanLimitsMock,
    };
    useBreakdownResultMock = {
      data: {
        total_owed: 120,
        total_paid: 40,
        remaining: 80,
        items: [],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchBreakdownMock,
    };
    useSettlementResultMock = {
      data: {
        transactions: [],
        transactionCount: 0,
        isSettled: true,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchSettlementMock,
    };
    useNudgeHistoryResultMock = {
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchNudgeHistoryMock,
    };
  });

  it('shows a retry state when the breakdown query fails', () => {
    useBreakdownResultMock = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Breakdown fetch failed'),
      refetch: refetchBreakdownMock,
    };

    render(
      <MantineProvider>
        <BreakdownPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/failed to load your breakdown/i)).toBeInTheDocument();
    expect(screen.getByText(/breakdown fetch failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows a retry state when export access fails to load', () => {
    usePlanLimitsResultMock = {
      canDownloadStatements: false,
      isError: true,
      error: new Error('Plan limits failed'),
      refetch: refetchPlanLimitsMock,
    };

    render(
      <MantineProvider>
        <BreakdownPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/failed to load export access/i)).toBeInTheDocument();
    expect(screen.getByText(/plan limits failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry export access/i })).toBeInTheDocument();
  });
});
