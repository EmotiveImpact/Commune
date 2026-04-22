import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { EditExpensePage } from './$expenseId.edit.lazy';

const navigateMock = vi.fn();
const updateExpenseMutateAsyncMock = vi.fn();
const refetchGroupMock = vi.fn();
let useGroupResultMock: any = {
  data: {
    id: 'group-1',
    name: 'North Dock Workspace',
    type: 'workspace',
    subtype: 'coworking',
    currency: 'GBP',
    members: [
      {
        id: 'member-1',
        user_id: 'user-1',
        role: 'admin',
        status: 'active',
        user: { id: 'user-1', name: 'August Usedem', email: 'august@example.com' },
      },
    ],
  },
  isError: false,
  error: null,
  refetch: refetchGroupMock,
};

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => ({
    ...config,
    useParams: () => ({ expenseId: 'expense-1' }),
  }),
  useNavigate: () => navigateMock,
}));

vi.mock('../../../hooks/use-groups', () => ({
  useGroup: () => useGroupResultMock,
}));

vi.mock('../../../hooks/use-expenses', () => ({
  useExpenseDetail: () => ({
    data: {
      id: 'expense-1',
      title: 'Desk chairs',
      description: 'Shared chairs for the office',
      category: 'work_tools',
      amount: 248,
      due_date: '2026-03-25',
      recurrence_type: 'none',
      vendor_name: 'OfficeCo',
      invoice_reference: 'INV-1042',
      invoice_date: '2026-03-10',
      payment_due_date: '2026-03-25',
    },
    isLoading: false,
  }),
  useUpdateExpense: () => ({
    mutateAsync: updateExpenseMutateAsyncMock,
    isPending: false,
  }),
  getWorkspaceExpenseContext: () => ({
    vendor_name: 'OfficeCo',
    invoice_reference: 'INV-1042',
    invoice_date: '2026-03-10',
    payment_due_date: '2026-03-25',
  }),
  toWorkspaceExpenseContextPayload: (values: Record<string, string>) => values,
}));

vi.mock('../../../stores/group', () => ({
  useGroupStore: () => ({
    activeGroupId: 'group-1',
  }),
}));

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
  }),
}));

describe('EditExpensePage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    updateExpenseMutateAsyncMock.mockReset();
    refetchGroupMock.mockReset();
    useGroupResultMock = {
      data: {
        id: 'group-1',
        name: 'North Dock Workspace',
        type: 'workspace',
        subtype: 'coworking',
        currency: 'GBP',
        members: [
          {
            id: 'member-1',
            user_id: 'user-1',
            role: 'admin',
            status: 'active',
            user: { id: 'user-1', name: 'August Usedem', email: 'august@example.com' },
          },
        ],
      },
      isError: false,
      error: null,
      refetch: refetchGroupMock,
    };
  });

  it('prefills and saves workspace vendor and invoice context', async () => {
    updateExpenseMutateAsyncMock.mockResolvedValue({});

    render(
      <MantineProvider>
        <EditExpensePage />
      </MantineProvider>,
    );

    expect(screen.getByLabelText(/vendor \/ supplier/i)).toHaveValue('OfficeCo');
    expect(screen.getByLabelText(/invoice reference/i)).toHaveValue('INV-1042');
    expect(screen.getByLabelText(/invoice date/i)).toHaveValue('2026-03-10');
    expect(screen.getByLabelText(/payment due date/i)).toHaveValue('2026-03-25');

    await userEvent.clear(screen.getByLabelText(/vendor \/ supplier/i));
    await userEvent.type(screen.getByLabelText(/vendor \/ supplier/i), 'Stationery House');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(updateExpenseMutateAsyncMock).toHaveBeenCalledWith({
        expenseId: 'expense-1',
        data: expect.objectContaining({
          title: 'Desk chairs',
          vendor_name: 'Stationery House',
          invoice_reference: 'INV-1042',
          invoice_date: '2026-03-10',
          payment_due_date: '2026-03-25',
        }),
      });
    });

    expect(navigateMock).toHaveBeenCalledWith({ to: '/expenses/expense-1' });
  }, 10000);

  it('shows a retry state when the group query fails', () => {
    useGroupResultMock = {
      data: undefined,
      isError: true,
      error: new Error('Group fetch failed'),
      refetch: refetchGroupMock,
    };

    render(
      <MantineProvider>
        <EditExpensePage />
      </MantineProvider>,
    );

    expect(screen.getByText(/failed to load expense editor/i)).toBeInTheDocument();
    expect(screen.getByText(/group fetch failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
