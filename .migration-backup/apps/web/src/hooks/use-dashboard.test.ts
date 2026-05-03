import { describe, expect, it } from 'vitest';
import { getWorkspaceBillingSummary } from './use-dashboard';

describe('getWorkspaceBillingSummary', () => {
  it('summarises workspace invoice pressure, vendor concentration, and tool spend', () => {
    const summary = getWorkspaceBillingSummary(
      [
        {
          id: 'expense-1',
          title: 'Desk chairs',
          amount: 240,
          currency: 'GBP',
          due_date: '2026-03-10',
          vendor_name: 'OfficeCo',
          invoice_reference: 'INV-1042',
          invoice_date: '2026-03-01',
          payment_due_date: '2026-03-10',
          category: 'work_tools',
        },
        {
          id: 'expense-2',
          title: 'Slack workspace',
          amount: 60,
          currency: 'GBP',
          due_date: '2026-03-06',
          vendor_name: 'Slack',
          invoice_reference: 'INV-1010',
          invoice_date: '2026-03-02',
          payment_due_date: '2026-03-06',
          category: 'work_tools',
        },
        {
          id: 'expense-3',
          title: 'Internet',
          amount: 80,
          currency: 'GBP',
          due_date: '2026-03-27',
          vendor_name: 'NetFast',
          invoice_reference: 'INV-2001',
          invoice_date: '2026-03-15',
          payment_due_date: '2026-03-27',
          category: 'utilities',
        },
        {
          id: 'expense-4',
          amount: 35,
          currency: 'GBP',
          due_date: '2026-03-28',
          vendor_name: 'Notion',
          invoice_reference: 'INV-3010',
          invoice_date: '2026-03-04',
          recurrence_type: 'monthly',
          category: 'miscellaneous',
        },
      ],
      new Date('2026-03-08T00:00:00.000Z'),
    );

    expect(summary.expenseCount).toBe(4);
    expect(summary.vendorCount).toBe(4);
    expect(summary.overdueCount).toBe(1);
    expect(summary.dueSoonCount).toBe(1);
    expect(summary.toolCostCount).toBe(2);
    expect(summary.sharedSubscriptionCount).toBe(1);
    expect(summary.toolCostSpend).toBe(300);
    expect(summary.totalSpend).toBe(415);
    expect(summary.topVendor).toEqual({
      vendor_name: 'OfficeCo',
      amount: 240,
      count: 1,
    });
    expect(summary.upcomingBills[2]?.title).toBe('Notion');
    expect(summary.nextDueBill?.title).toBe('Desk chairs');
    expect(summary.latestBill?.title).toBe('Internet');
  });

  it('maps a precomputed workspace billing snapshot onto the dashboard summary shape', () => {
    const summary = getWorkspaceBillingSummary({
      total_invoiced: 415,
      invoice_count: 4,
      vendor_count: 4,
      overdue_count: 1,
      due_soon_count: 1,
      shared_subscription_count: 1,
      tool_cost_count: 2,
      tool_cost_spend: 300,
      vendor_bill_count: 1,
      vendors: [
        {
          vendor_name: 'OfficeCo',
          total_spend: 240,
          invoice_count: 1,
          overdue_count: 1,
          next_due_date: '2026-03-10',
          latest_invoice_reference: 'INV-1042',
          latest_invoice_date: '2026-03-01',
          latest_payment_due_date: '2026-03-10',
        },
      ],
      upcoming_due: [
        {
          id: 'expense-1',
          title: 'Desk chairs',
          amount: 240,
          currency: 'GBP',
          due_date: '2026-03-10',
          effective_due_date: '2026-03-10',
          is_overdue: false,
          vendor_name: 'OfficeCo',
          invoice_reference: 'INV-1042',
          invoice_date: '2026-03-01',
          payment_due_date: '2026-03-10',
          category: 'work_tools',
          recurrence_type: 'none',
        },
      ],
      latest_bill: {
        id: 'expense-3',
        title: 'Internet',
        amount: 80,
        currency: 'GBP',
        due_date: '2026-03-27',
        effective_due_date: '2026-03-27',
        is_overdue: false,
        vendor_name: 'NetFast',
        invoice_reference: 'INV-2001',
        invoice_date: '2026-03-15',
        payment_due_date: '2026-03-27',
        category: 'utilities',
        recurrence_type: 'none',
      },
    });

    expect(summary.expenseCount).toBe(4);
    expect(summary.vendorCount).toBe(4);
    expect(summary.toolCostSpend).toBe(300);
    expect(summary.topVendor).toEqual({
      vendor_name: 'OfficeCo',
      amount: 240,
      count: 1,
    });
    expect(summary.nextDueBill?.title).toBe('Desk chairs');
    expect(summary.latestBill?.title).toBe('Internet');
  });
});
