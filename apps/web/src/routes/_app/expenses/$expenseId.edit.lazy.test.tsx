import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { EditExpensePage } from './$expenseId.edit.lazy';

const navigateMock = vi.fn();
const updateExpenseMutateAsyncMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => ({
    ...config,
    useParams: () => ({ expenseId: 'expense-1' }),
  }),
  useNavigate: () => navigateMock,
}));

vi.mock('../../../hooks/use-groups', () => ({
  useGroup: () => ({
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
    isLoading: false,
  }),
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
});
