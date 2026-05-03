import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { FundsPage } from './funds.lazy';

const refetchGroupMock = vi.fn();
let groupSummaryResultMock: any = {
  data: { id: 'group-1', currency: 'GBP' },
  isError: false,
  error: null,
  refetch: refetchGroupMock,
};

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => config,
}));

vi.mock('../../stores/group', () => ({
  useGroupStore: () => ({
    activeGroupId: 'group-1',
  }),
}));

vi.mock('../../hooks/use-groups', () => ({
  useGroupSummary: () => groupSummaryResultMock,
}));

vi.mock('../../hooks/use-funds', () => ({
  useFunds: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useCreateFund: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteFund: () => ({ mutate: vi.fn(), isPending: false }),
  useFundDetails: () => ({ data: null, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useAddContribution: () => ({ mutate: vi.fn(), isPending: false }),
  useAddFundExpense: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../utils/seo', () => ({
  setPageTitle: vi.fn(),
}));

describe('FundsPage', () => {
  beforeEach(() => {
    refetchGroupMock.mockReset();
    groupSummaryResultMock = {
      data: { id: 'group-1', currency: 'GBP' },
      isError: false,
      error: null,
      refetch: refetchGroupMock,
    };
  });

  it('shows a retry state when the group summary fails', () => {
    groupSummaryResultMock = {
      data: undefined,
      isError: true,
      error: new Error('Group summary failed'),
      refetch: refetchGroupMock,
    };

    render(
      <MantineProvider>
        <FundsPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/failed to load funds/i)).toBeInTheDocument();
    expect(screen.getByText(/group summary failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
