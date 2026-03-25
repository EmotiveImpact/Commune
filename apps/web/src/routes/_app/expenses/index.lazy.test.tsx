import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ExpensesPage } from './index.lazy';

const navigateMock = vi.fn();
const clearQueryMock = vi.hoisted(() => vi.fn());
const downloadCSVMock = vi.hoisted(() => vi.fn());
let groupMock: any = {
  id: 'group-1',
  name: 'North Dock Workspace',
  type: 'workspace',
  subtype: 'coworking',
  currency: 'GBP',
  approval_threshold: 100,
  approval_policy: null,
  members: [],
};
let pendingApprovalsMock: any[] = [];

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => config,
  Link: ({ children }: { children: React.ReactNode }) => children,
  useNavigate: () => navigateMock,
}));

vi.mock('../../../hooks/use-groups', () => ({
  useGroup: () => ({
    data: groupMock,
    isLoading: false,
  }),
}));

vi.mock('../../../hooks/use-expenses', () => ({
  useGroupExpenses: () => ({
    data: [
      {
        id: 'expense-1',
        title: 'Desk chairs',
        category: 'work_tools',
        due_date: '2026-03-27',
        amount: 248,
        currency: 'GBP',
        approval_status: 'approved',
        recurrence_type: 'none',
        payment_records: [],
        participants: [{}, {}],
        vendor_name: 'OfficeCo',
        invoice_reference: 'INV-1042',
        invoice_date: '2026-03-20',
        payment_due_date: '2026-03-26',
      },
      {
        id: 'expense-2',
        title: 'Kitchen tea',
        category: 'office_supplies',
        due_date: '2026-04-05',
        amount: 18,
        currency: 'GBP',
        approval_status: 'approved',
        recurrence_type: 'none',
        payment_records: [],
        participants: [{}],
      },
    ],
    isLoading: false,
  }),
  getWorkspaceExpenseContext: (expense: Record<string, unknown>) => ({
    vendor_name: typeof expense.vendor_name === 'string' ? expense.vendor_name : '',
    invoice_reference: typeof expense.invoice_reference === 'string' ? expense.invoice_reference : '',
    invoice_date: typeof expense.invoice_date === 'string' ? expense.invoice_date : '',
    payment_due_date: typeof expense.payment_due_date === 'string' ? expense.payment_due_date : '',
  }),
  hasWorkspaceExpenseContext: (expense: Record<string, unknown>) =>
    Boolean(
      expense.vendor_name ||
        expense.invoice_reference ||
        expense.invoice_date ||
        expense.payment_due_date,
    ),
  useBatchArchive: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBatchMarkPaid: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('../../../hooks/use-approvals', () => ({
  usePendingApprovals: () => ({ data: pendingApprovalsMock }),
  useApproveExpense: () => ({ mutate: vi.fn(), isPending: false }),
  useRejectExpense: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../../hooks/use-subscriptions', () => ({
  useSubscription: () => ({ data: null }),
}));

vi.mock('../../../hooks/use-plan-limits', () => ({
  usePlanLimits: () => ({ canExport: true, canDownloadStatements: false }),
}));

vi.mock('../../../stores/group', () => ({
  useGroupStore: () => ({
    activeGroupId: 'group-1',
  }),
}));

vi.mock('../../../stores/search', () => ({
  useSearchStore: Object.assign(
    () => ({ query: 'officeco' }),
    {
      getState: () => ({ clearQuery: clearQueryMock }),
    },
  ),
}));

vi.mock('../../../utils/export-csv', async () => {
  const actual = await vi.importActual<typeof import('../../../utils/export-csv')>('../../../utils/export-csv');
  return {
    ...actual,
    downloadCSV: downloadCSVMock,
  };
});

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
  }),
}));

describe('ExpensesPage', () => {
  beforeEach(() => {
    downloadCSVMock.mockClear();
    groupMock = {
      id: 'group-1',
      name: 'North Dock Workspace',
      type: 'workspace',
      subtype: 'coworking',
      currency: 'GBP',
      approval_threshold: 100,
      approval_policy: null,
      members: [],
    };
    pendingApprovalsMock = [];
  });

  it('surfaces workspace billing signals and searches vendor metadata', () => {
    render(
      <MantineProvider>
        <ExpensesPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/workspace billing/i)).toBeInTheDocument();
    expect(screen.getByText(/1 linked/i)).toBeInTheDocument();
    expect(screen.getByText(/1 missing details/i)).toBeInTheDocument();
    expect(screen.getByText(/1 due soon/i)).toBeInTheDocument();
    expect(screen.getByText(/workspace roles and approvals/i)).toBeInTheDocument();
    expect(screen.getByText(/spends at or below £100\.00 are auto-approved/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/workspace view/i)).toBeInTheDocument();
    expect(screen.getByText('Desk chairs')).toBeInTheDocument();
    expect(screen.queryByText('Kitchen tea')).not.toBeInTheDocument();
    expect(screen.getByText(/officeco · ref inv-1042/i)).toBeInTheDocument();
  });

  it('exports workspace vendor and invoice fields from the current filtered view', async () => {
    const user = userEvent.setup();

    render(
      <MantineProvider>
        <ExpensesPage />
      </MantineProvider>,
    );

    await user.click(screen.getByRole('button', { name: /export filtered csv/i }));

    expect(downloadCSVMock).toHaveBeenCalledTimes(1);
    const [csv, filename] = downloadCSVMock.mock.calls[0] as [string, string];

    expect(filename).toMatch(/^expenses-filtered-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv).toContain('Expense,Vendor,Invoice reference,Invoice date,Due date,Category,Participants,Paid participants,Approval status,Payment status,Amount');
    expect(csv).toContain('"Desk chairs","OfficeCo","INV-1042","2026-03-20","2026-03-26","Work Tools",2,0,"Approved","Open",248.00');
  });

  it('shows the pending approvals queue to configured workspace approvers', () => {
    groupMock = {
      ...groupMock,
      approval_policy: {
        threshold: 100,
        allowed_roles: [],
        allowed_labels: ['space_lead'],
        role_presets: [
          {
            key: 'space_lead',
            label: 'Space lead',
            description: 'Owns shared-area coordination and escalation.',
            responsibility_label: 'space_lead',
            can_approve: true,
            is_default: true,
          },
        ],
      },
      members: [
        {
          id: 'member-1',
          user_id: 'user-1',
          role: 'member',
          status: 'active',
          responsibility_label: 'space_lead',
        },
      ],
    };
    pendingApprovalsMock = [
      {
        id: 'expense-pending-1',
        title: 'Printer lease',
        amount: 180,
        currency: 'GBP',
        created_by_user: { name: 'Alice' },
      },
    ];

    render(
      <MantineProvider>
        <ExpensesPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/awaiting approval/i)).toBeInTheDocument();
    expect(screen.getByText(/printer lease/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
  });
});
