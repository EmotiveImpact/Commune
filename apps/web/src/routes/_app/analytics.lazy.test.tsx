import { MantineProvider } from '@mantine/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { AnalyticsPage } from './analytics.lazy';

const downloadWorkspaceBillingPackMock = vi.hoisted(() => vi.fn());
const notificationShowMock = vi.hoisted(() => vi.fn());
const getWorkspaceBillingExportRowsMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  createLazyFileRoute: () => (config: Record<string, unknown>) => config,
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@commune/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@commune/api')>();
  return {
    ...actual,
    getWorkspaceBillingExportRows: getWorkspaceBillingExportRowsMock,
  };
});

vi.mock('recharts', () => {
  const Container = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const SvgWrapper = ({ children }: { children?: React.ReactNode }) => <svg>{children}</svg>;
  const GroupWrapper = ({ children }: { children?: React.ReactNode }) => <g>{children}</g>;

  return {
    ResponsiveContainer: Container,
    LineChart: SvgWrapper,
    Line: () => null,
    PieChart: SvgWrapper,
    Pie: GroupWrapper,
    Cell: () => null,
    BarChart: SvgWrapper,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    CartesianGrid: () => null,
  };
});

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: notificationShowMock,
  },
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

vi.mock('../../hooks/use-subscriptions', () => ({
  useSubscription: () => ({
    data: { plan: 'pro' },
    isLoading: false,
    isError: false,
    fetchStatus: 'idle',
  }),
}));

vi.mock('../../hooks/use-plan-limits', () => ({
  usePlanLimits: () => ({
    canAccessAnalytics: true,
    isLoading: false,
  }),
}));

vi.mock('../../hooks/use-groups', () => ({
  useGroupSummary: () => ({
    data: {
      id: 'group-1',
      type: 'workspace',
      subtype: 'coworking',
      currency: 'GBP',
    },
  }),
}));

vi.mock('../../hooks/use-analytics', () => ({
  useAnalytics: () => ({
    data: {
      spendingTrend: [
        { month: '2026-02', amount: 820 },
        { month: '2026-03', amount: 960 },
      ],
      categoryBreakdown: [
        { category: 'work_tools', amount: 640 },
        { category: 'utilities', amount: 320 },
      ],
      topSpenders: [{ name: 'Alex', amount: 960 }],
      complianceRate: { onTime: 3, overdue: 1, total: 4 },
      monthComparison: {
        thisMonth: 960,
        lastMonth: 820,
        delta: 140,
        deltaPercent: 17.0731707,
      },
    },
    isLoading: false,
    isError: false,
    fetchStatus: 'idle',
  }),
}));

vi.mock('../../hooks/use-workspace-billing', () => ({
  useWorkspaceBilling: () => ({
    data: {
      snapshot: {
        total_invoiced: 960,
        invoice_count: 2,
        vendor_count: 2,
        overdue_count: 1,
        due_soon_count: 1,
        shared_subscription_count: 1,
        tool_cost_count: 1,
        tool_cost_spend: 960,
        vendor_bill_count: 0,
        vendors: [
          {
            vendor_name: 'OfficeCo',
            total_spend: 560,
            invoice_count: 1,
            overdue_count: 1,
            next_due_date: '2026-03-26',
            latest_invoice_reference: 'INV-1042',
            latest_invoice_date: '2026-03-20',
            latest_payment_due_date: '2026-03-26',
          },
          {
            vendor_name: 'Slack',
            total_spend: 400,
            invoice_count: 1,
            overdue_count: 0,
            next_due_date: '2026-04-01',
            latest_invoice_reference: 'INV-1058',
            latest_invoice_date: '2026-03-22',
            latest_payment_due_date: '2026-04-01',
          },
        ],
        upcoming_due: [
          {
            id: 'expense-2',
            title: 'Slack seats',
            amount: 400,
            currency: 'GBP',
            due_date: '2026-04-01',
            effective_due_date: '2026-04-01',
            is_overdue: false,
            vendor_name: 'Slack',
            invoice_reference: 'INV-1058',
            invoice_date: '2026-03-22',
            payment_due_date: '2026-04-01',
            category: 'work_tools',
            recurrence_type: 'monthly',
          },
        ],
        latest_bill: {
          id: 'expense-1',
          title: 'Desk chairs',
          amount: 560,
          currency: 'GBP',
          due_date: '2026-03-26',
          effective_due_date: '2026-03-26',
          is_overdue: true,
          vendor_name: 'OfficeCo',
          invoice_reference: 'INV-1042',
          invoice_date: '2026-03-20',
          payment_due_date: '2026-03-26',
          category: 'work_tools',
          recurrence_type: 'none',
        },
      },
      trend: [
        {
          month: '2026-02',
          amount: 400,
          invoice_count: 1,
          overdue_count: 0,
          shared_subscription_count: 1,
          tool_cost_count: 0,
          vendor_bill_count: 0,
        },
        {
          month: '2026-03',
          amount: 560,
          invoice_count: 1,
          overdue_count: 1,
          shared_subscription_count: 0,
          tool_cost_count: 1,
          vendor_bill_count: 0,
        },
      ],
    },
  }),
}));

vi.mock('../../utils/export-csv', async () => {
  const actual = await vi.importActual<typeof import('../../utils/export-csv')>('../../utils/export-csv');
  return {
    ...actual,
    downloadWorkspaceBillingPack: downloadWorkspaceBillingPackMock,
  };
});

describe('AnalyticsPage', () => {
  beforeEach(() => {
    downloadWorkspaceBillingPackMock.mockReset();
    notificationShowMock.mockReset();
    getWorkspaceBillingExportRowsMock.mockReset();
    getWorkspaceBillingExportRowsMock.mockResolvedValue([
      {
        id: 'expense-1',
        title: 'Desk chairs',
        amount: 560,
        currency: 'GBP',
        due_date: '2026-03-26',
        effective_due_date: '2026-03-26',
        is_overdue: true,
        vendor_name: 'OfficeCo',
        invoice_reference: 'INV-1042',
        invoice_date: '2026-03-20',
        payment_due_date: '2026-03-26',
        category: 'work_tools',
        recurrence_type: 'none',
        cost_kind: 'tool_cost',
      },
      {
        id: 'expense-2',
        title: 'Slack seats',
        amount: 400,
        currency: 'GBP',
        due_date: '2026-04-01',
        effective_due_date: '2026-04-01',
        is_overdue: false,
        vendor_name: 'Slack',
        invoice_reference: 'INV-1058',
        invoice_date: '2026-03-22',
        payment_due_date: '2026-04-01',
        category: 'work_tools',
        recurrence_type: 'monthly',
        cost_kind: 'shared_subscription',
      },
    ]);
  });

  it('exports a workspace billing pack from the analytics workspace panel', async () => {
    const user = userEvent.setup();

    render(
      <MantineProvider>
        <AnalyticsPage />
      </MantineProvider>,
    );

    await user.click(screen.getByRole('button', { name: /export billing pack/i }));

    await waitFor(() => {
      expect(downloadWorkspaceBillingPackMock).toHaveBeenCalledTimes(1);
    }, { timeout: 5000 });
    expect(getWorkspaceBillingExportRowsMock).toHaveBeenCalledWith('group-1');
    expect(downloadWorkspaceBillingPackMock).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot: expect.objectContaining({
          total_invoiced: 960,
          vendor_count: 2,
        }),
        export_rows: expect.arrayContaining([
          expect.objectContaining({
            title: 'Desk chairs',
            vendor_name: 'OfficeCo',
          }),
        ]),
      }),
      'GBP',
    );
  }, 10000);
});
