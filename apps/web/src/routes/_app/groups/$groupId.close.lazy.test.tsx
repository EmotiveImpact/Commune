import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { GroupCycleClosePage } from './$groupId.close.lazy';

const closeCycleMutateAsyncMock = vi.fn();
const reopenCycleMutateAsyncMock = vi.fn();
const notificationsShowMock = vi.fn();
const refetchGroupMock = vi.fn();
let useGroupResultMock: any = {
  data: {
    id: 'group-1',
    name: 'Foundry House',
    currency: 'GBP',
    setup_checklist_progress: {
      access: {
        label: 'Document access and Wi-Fi details.',
        completed: false,
        completed_at: null,
      },
      owner: {
        label: 'Assign one person to review unresolved balances each cycle.',
        completed: true,
        completed_at: '2026-03-10T10:00:00.000Z',
      },
    },
    members: [
      {
        id: 'member-1',
        user_id: 'user-1',
        role: 'admin',
        status: 'active',
      },
    ],
  },
  isLoading: false,
  isError: false,
  error: null,
  refetch: refetchGroupMock,
};

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => ({
    ...config,
    useParams: () => ({ groupId: 'group-1' }),
  }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('../../../hooks/use-groups', () => ({
  useGroup: () => useGroupResultMock,
}));

vi.mock('../../../hooks/use-cycles', () => ({
  useGroupCycleSummary: () => ({
    data: {
      cycle_start: '2026-03-01',
      cycle_end: '2026-03-31',
      cycle_date: 1,
      is_closed: false,
      closure: null,
      total_spend: 420,
      total_outstanding: 120,
      unpaid_expense_count: 2,
      overdue_expense_count: 1,
      pending_expense_count: 1,
      member_balances: [],
      expenses: [],
    },
    isLoading: false,
  }),
  useCloseGroupCycle: () => ({
    mutateAsync: closeCycleMutateAsyncMock,
    isPending: false,
  }),
  useReopenGroupCycle: () => ({
    mutateAsync: reopenCycleMutateAsyncMock,
    isPending: false,
  }),
}));

vi.mock('../../../hooks/use-chores', () => ({
  useChores: () => ({
    data: [{ id: 'op-1', title: 'Kitchen reset', next_due: '2026-03-03' }],
  }),
}));

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
  }),
}));

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: (...args: unknown[]) => notificationsShowMock(...args),
  },
}));

describe('GroupCycleClosePage', () => {
  beforeEach(() => {
    closeCycleMutateAsyncMock.mockReset();
    reopenCycleMutateAsyncMock.mockReset();
    notificationsShowMock.mockReset();
    refetchGroupMock.mockReset();
    useGroupResultMock = {
      data: {
        id: 'group-1',
        name: 'Foundry House',
        currency: 'GBP',
        setup_checklist_progress: {
          access: {
            label: 'Document access and Wi-Fi details.',
            completed: false,
            completed_at: null,
          },
          owner: {
            label: 'Assign one person to review unresolved balances each cycle.',
            completed: true,
            completed_at: '2026-03-10T10:00:00.000Z',
          },
        },
        members: [
          {
            id: 'member-1',
            user_id: 'user-1',
            role: 'admin',
            status: 'active',
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchGroupMock,
    };
  });

  it('shows checklist warnings and closes the cycle with notes', async () => {
    closeCycleMutateAsyncMock.mockResolvedValue({});

    render(
      <MantineProvider>
        <GroupCycleClosePage />
      </MantineProvider>,
    );

    expect(screen.getByText(/setup checklist still has open items/i)).toBeInTheDocument();
    expect(screen.getByText('1/2 setup complete')).toBeInTheDocument();
    expect(screen.getByText(/kitchen reset/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/notes for this close/i), {
      target: { value: 'Need landlord reply before next cycle.' },
    });
    await userEvent.click(screen.getByRole('button', { name: /close cycle with warnings/i }));

    await waitFor(() => {
      expect(closeCycleMutateAsyncMock).toHaveBeenCalledWith(
        'Need landlord reply before next cycle.',
      );
    });

    expect(notificationsShowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cycle closed',
        color: 'green',
      }),
    );
  });

  it('shows a retry state when the group query fails', () => {
    useGroupResultMock = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Group fetch failed'),
      refetch: refetchGroupMock,
    };

    render(
      <MantineProvider>
        <GroupCycleClosePage />
      </MantineProvider>,
    );

    expect(screen.getByText(/failed to load cycle close/i)).toBeInTheDocument();
    expect(screen.getByText(/group fetch failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
