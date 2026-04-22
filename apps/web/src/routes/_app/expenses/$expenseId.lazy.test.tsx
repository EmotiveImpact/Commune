import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpenseDetailPage } from './$expenseId.lazy';

const useExpenseDetailMock = vi.hoisted(() => vi.fn());
const usePaymentMethodsMock = vi.hoisted(() => vi.fn());
const refetchGroupMock = vi.hoisted(() => vi.fn());
let useGroupResultMock: any = {
  data: {
    id: 'group-1',
    name: 'North Dock Workspace',
    type: 'workspace',
    subtype: 'coworking',
    currency: 'GBP',
    approval_threshold: 100,
    members: [
      {
        id: 'member-1',
        user_id: 'user-1',
        role: 'admin',
        status: 'active',
        user: { id: 'user-1', name: 'August Usedem', avatar_url: null },
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
  Link: ({ children }: { children: React.ReactNode }) => children,
  useNavigate: () => vi.fn(),
}));

vi.mock('../../../hooks/use-groups', () => ({
  useGroup: () => useGroupResultMock,
}));

vi.mock('../../../hooks/use-expenses', async () => {
  const actual = await vi.importActual<typeof import('../../../hooks/use-expenses')>(
    '../../../hooks/use-expenses',
  );

  return {
    ...actual,
    useExpenseDetail: () => ({
      data: useExpenseDetailMock(),
      isLoading: false,
    }),
    useApproveExpense: () => ({ mutate: vi.fn(), isPending: false }),
    useRejectExpense: () => ({ mutate: vi.fn(), isPending: false }),
    useMarkPayment: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useConfirmPayment: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useArchiveExpense: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
});

vi.mock('../../../hooks/use-receipts', () => ({
  useUploadReceipt: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteReceipt: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../../../hooks/use-payment-methods', () => ({
  usePaymentMethods: (...args: unknown[]) => usePaymentMethodsMock(...args),
}));

vi.mock('../../../hooks/use-approvals', () => ({
  useApproveExpense: () => ({ mutate: vi.fn(), isPending: false }),
  useRejectExpense: () => ({ mutate: vi.fn(), isPending: false }),
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

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <ExpenseDetailPage />
      </MantineProvider>
    </QueryClientProvider>,
  );
}

describe('ExpenseDetailPage', () => {
  beforeEach(() => {
    refetchGroupMock.mockReset();
    useGroupResultMock = {
      data: {
        id: 'group-1',
        name: 'North Dock Workspace',
        type: 'workspace',
        subtype: 'coworking',
        currency: 'GBP',
        approval_threshold: 100,
        members: [
          {
            id: 'member-1',
            user_id: 'user-1',
            role: 'admin',
            status: 'active',
            user: { id: 'user-1', name: 'August Usedem', avatar_url: null },
          },
        ],
      },
      isError: false,
      error: null,
      refetch: refetchGroupMock,
    };
    useExpenseDetailMock.mockReturnValue({
      id: 'expense-1',
      title: 'Desk chairs',
      description: 'Shared chairs for the office',
      category: 'work_tools',
      amount: 248,
      currency: 'GBP',
      due_date: '2026-03-25',
      recurrence_type: 'none',
      paid_by_user_id: null,
      payment_records: [],
      participants: [],
      approval_status: 'approved',
      receipt_url: null,
      vendor_name: 'OfficeCo',
      invoice_reference: 'INV-1042',
      invoice_date: '2026-03-10',
      payment_due_date: '2026-03-25',
    });
    usePaymentMethodsMock.mockReturnValue({ data: [] });
  });

  it('shows the workspace context card when invoice metadata is present', () => {
    renderPage();

    expect(
      screen.getByText(
        /vendor and invoice details stay attached to the expense so workspace bills are easier to trace\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/workspace approval chain/i)).toBeInTheDocument();
    expect(screen.getByText(/spends at or below £100\.00 are auto-approved/i)).toBeInTheDocument();
    expect(screen.getByText('Vendor')).toBeInTheDocument();
    expect(screen.getByText('OfficeCo')).toBeInTheDocument();
    expect(screen.getByText('INV-1042')).toBeInTheDocument();
    expect(screen.getByText('Invoice date')).toBeInTheDocument();
    expect(screen.getByText('Payment due date')).toBeInTheDocument();
  });

  it('blocks settlement actions until a pending expense is approved', () => {
    useExpenseDetailMock.mockReturnValue({
      id: 'expense-1',
      title: 'Desk chairs',
      description: 'Shared chairs for the office',
      category: 'work_tools',
      amount: 248,
      currency: 'GBP',
      due_date: '2026-03-25',
      recurrence_type: 'none',
      paid_by_user_id: 'payer-1',
      paid_by_user: {
        id: 'payer-1',
        name: 'OfficeCo',
      },
      payment_records: [],
      participants: [
        {
          id: 'participant-1',
          user_id: 'user-2',
          share_amount: 248,
          user: { id: 'user-2', name: 'Alice', avatar_url: null },
        },
      ],
      approval_status: 'pending',
      receipt_url: null,
      vendor_name: 'OfficeCo',
      invoice_reference: 'INV-1042',
      invoice_date: '2026-03-10',
      payment_due_date: '2026-03-25',
    });
    usePaymentMethodsMock.mockReturnValue({
      data: [
        {
          id: 'method-1',
          provider: 'revolut',
          payment_link: 'https://revolut.example/pay',
          is_default: true,
        },
      ],
    });

    renderPage();

    expect(screen.getByText(/waiting for workspace approval/i)).toBeInTheDocument();
    expect(
      screen.getByText(/settlement and payment actions stay disabled until it is approved/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve expense/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject expense/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/mark alice as paid/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/pay officeco via/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pay officeco's share directly/i)).not.toBeInTheDocument();
  });

  it('shows a retry state when the group query fails', () => {
    useGroupResultMock = {
      data: undefined,
      isError: true,
      error: new Error('Group fetch failed'),
      refetch: refetchGroupMock,
    };

    renderPage();

    expect(screen.getByText(/failed to load expense details/i)).toBeInTheDocument();
    expect(screen.getByText(/group fetch failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows a retry state when payment methods fail to load', () => {
    useExpenseDetailMock.mockReturnValue({
      id: 'expense-1',
      title: 'Desk chairs',
      description: 'Shared chairs for the office',
      category: 'work_tools',
      amount: 248,
      currency: 'GBP',
      due_date: '2026-03-25',
      recurrence_type: 'none',
      paid_by_user_id: 'payer-1',
      paid_by_user: {
        id: 'payer-1',
        name: 'OfficeCo',
      },
      payment_records: [],
      participants: [
        {
          id: 'participant-1',
          user_id: 'user-1',
          share_amount: 248,
          user: { id: 'user-1', name: 'August Usedem', avatar_url: null },
        },
      ],
      approval_status: 'approved',
      receipt_url: null,
      vendor_name: 'OfficeCo',
      invoice_reference: 'INV-1042',
      invoice_date: '2026-03-10',
      payment_due_date: '2026-03-25',
    });
    usePaymentMethodsMock.mockReturnValue({
      data: undefined,
      isError: true,
      error: new Error('Payment methods failed'),
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByText(/failed to load payment options/i)).toBeInTheDocument();
    expect(screen.getByText(/payment methods failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('keeps rendering when a participant row is missing nested user details', () => {
    useExpenseDetailMock.mockReturnValue({
      id: 'expense-1',
      title: 'Desk chairs',
      description: 'Shared chairs for the office',
      category: 'work_tools',
      amount: 248,
      currency: 'GBP',
      due_date: '2026-03-25',
      recurrence_type: 'none',
      paid_by_user_id: null,
      payment_records: [],
      participants: [
        {
          id: 'participant-1',
          user_id: 'user-1',
          share_amount: 124,
          user: { id: 'user-1', name: 'August Usedem', avatar_url: null },
        },
        {
          id: 'participant-2',
          user_id: 'user-2',
          share_amount: 124,
          user: null,
        },
      ],
      approval_status: 'approved',
      receipt_url: null,
      vendor_name: 'OfficeCo',
      invoice_reference: 'INV-1042',
      invoice_date: '2026-03-10',
      payment_due_date: '2026-03-25',
    });

    renderPage();

    expect(screen.getByText(/some participant profiles are temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/were shown with fallback labels/i)).toBeInTheDocument();
    expect(screen.getByText('August Usedem')).toBeInTheDocument();
    expect(screen.getByText('Unknown member')).toBeInTheDocument();
  });
});
