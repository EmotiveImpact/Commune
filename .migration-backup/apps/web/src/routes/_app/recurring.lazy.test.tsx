import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecurringPage } from './recurring.lazy';

const refetchGroupMock = vi.fn();
const refetchActiveRecurringMock = vi.fn();
const refetchPausedRecurringMock = vi.fn();

let useGroupResultMock: any = {
  data: { currency: 'GBP' },
  error: null,
  isError: false,
  refetch: refetchGroupMock,
};

let useRecurringExpensesResultMock: any = {
  data: [],
  isLoading: false,
  isError: false,
  error: null,
  refetch: refetchActiveRecurringMock,
};

let usePausedRecurringExpensesResultMock: any = {
  data: [],
  isLoading: false,
  isError: false,
  error: null,
  refetch: refetchPausedRecurringMock,
};

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => config,
}));

vi.mock('../../utils/seo', () => ({
  setPageTitle: vi.fn(),
}));

vi.mock('../../stores/group', () => ({
  useGroupStore: () => ({
    activeGroupId: 'group-1',
  }),
}));

vi.mock('../../hooks/use-groups', () => ({
  useGroup: () => useGroupResultMock,
}));

vi.mock('../../hooks/use-recurring', () => ({
  useRecurringExpenses: () => useRecurringExpensesResultMock,
  usePausedRecurringExpenses: () => usePausedRecurringExpensesResultMock,
  usePauseRecurring: () => ({ mutate: vi.fn(), isPending: false }),
  useResumeRecurring: () => ({ mutate: vi.fn(), isPending: false }),
  useArchiveRecurring: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('RecurringPage', () => {
  beforeEach(() => {
    refetchGroupMock.mockReset();
    refetchActiveRecurringMock.mockReset();
    refetchPausedRecurringMock.mockReset();
    useGroupResultMock = {
      data: { currency: 'GBP' },
      error: null,
      isError: false,
      refetch: refetchGroupMock,
    };
    useRecurringExpensesResultMock = {
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchActiveRecurringMock,
    };
    usePausedRecurringExpensesResultMock = {
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchPausedRecurringMock,
    };
  });

  it('shows a retry state when recurring expenses fail to load', () => {
    useRecurringExpensesResultMock = {
      data: [],
      isLoading: false,
      isError: true,
      error: new Error('Recurring failed'),
      refetch: refetchActiveRecurringMock,
    };

    render(
      <MantineProvider>
        <RecurringPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/failed to load recurring expenses/i)).toBeInTheDocument();
    expect(screen.getByText(/recurring failed/i)).toBeInTheDocument();
  });
});
