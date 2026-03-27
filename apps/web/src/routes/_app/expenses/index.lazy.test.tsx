import { MantineProvider } from '@mantine/core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { ExpensesPage } from './index.lazy';

const navigateMock = vi.fn();
const clearQueryMock = vi.hoisted(() => vi.fn());
const downloadCSVMock = vi.hoisted(() => vi.fn());
const getExpenseLedgerExportRowsMock = vi.hoisted(() => vi.fn());
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
  useExpenseLedger: () => ({
    data: {
      summary: {
        total_count: 1,
        total_amount: 248,
        open_count: 1,
        overdue_count: 0,
        settled_count: 0,
        workspace: {
          linked_count: 1,
          missing_count: 0,
          due_soon_count: 1,
        },
      },
      filtered_count: 1,
      items: [
        {
          id: 'expense-1',
          title: 'Desk chairs',
          category: 'work_tools',
          due_date: '2026-03-27',
          amount: 248,
          currency: 'GBP',
          approval_status: 'approved',
          recurrence_type: 'none',
          participant_count: 2,
          paid_count: 0,
          vendor_name: 'OfficeCo',
          invoice_reference: 'INV-1042',
          invoice_date: '2026-03-20',
          payment_due_date: '2026-03-26',
        },
      ],
    },
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

vi.mock('@commune/api', () => ({
  downloadStatement: vi.fn(),
  getExpenseLedgerExportRows: getExpenseLedgerExportRowsMock,
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-24T12:00:00Z'));
    downloadCSVMock.mockClear();
    getExpenseLedgerExportRowsMock.mockReset();
    getExpenseLedgerExportRowsMock.mockResolvedValue([
      {
        id: 'expense-1',
        title: 'Desk chairs',
        category: 'work_tools',
        due_date: '2026-03-27',
        amount: 248,
        currency: 'GBP',
        approval_status: 'approved',
        recurrence_type: 'none',
        participant_count: 2,
        paid_count: 0,
        vendor_name: 'OfficeCo',
        invoice_reference: 'INV-1042',
        invoice_date: '2026-03-20',
        payment_due_date: '2026-03-26',
      },
    ]);
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('surfaces workspace billing signals and searches vendor metadata', () => {
    render(
      <MantineProvider>
        <ExpensesPage />
      </MantineProvider>,
    );

    expect(screen.getByText(/workspace billing/i)).toBeInTheDocument();
    expect(screen.getByText(/1 linked/i)).toBeInTheDocument();
    expect(screen.getByText(/0 missing details/i)).toBeInTheDocument();
    expect(screen.getByText(/1 due soon/i)).toBeInTheDocument();
    expect(screen.getByText(/workspace roles and approvals/i)).toBeInTheDocument();
    expect(screen.getByText(/spends at or below £100\.00 are auto-approved/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/workspace view/i)).toBeInTheDocument();
    expect(screen.getByText('Desk chairs')).toBeInTheDocument();
    expect(screen.queryByText('Kitchen tea')).not.toBeInTheDocument();
    expect(screen.getByText(/officeco · ref inv-1042/i)).toBeInTheDocument();
  });

  it('exports workspace vendor and invoice fields from the current filtered view', async () => {
    render(
      <MantineProvider>
        <ExpensesPage />
      </MantineProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /export filtered csv/i }));
      await vi.dynamicImportSettled();
      await Promise.resolve();
    });

    expect(getExpenseLedgerExportRowsMock).toHaveBeenCalledWith('group-1', {
      isWorkspaceGroup: true,
      search: 'officeco',
      status: 'all',
      workspaceView: 'all',
    });
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
