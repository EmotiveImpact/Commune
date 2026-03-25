// @ts-expect-error - Vitest is supplied by the workspace test runner, not this package
import { describe, expect, it } from 'vitest';
import {
  buildWorkspaceBillingExportRows,
  buildWorkspaceBillingSnapshot,
  getWorkspaceBillingContext,
  isWorkspaceBillingExpense,
} from './workspace-billing';

describe('workspace billing helpers', () => {
  it('normalises vendor invoice metadata from alternate field names', () => {
    expect(
      getWorkspaceBillingContext({
        vendor: '  OfficeCo  ',
        invoice_no: ' INV-1042 ',
        bill_date: '2026-03-01',
        invoice_due_date: '2026-03-10',
      } as never),
    ).toEqual({
      vendor_name: 'OfficeCo',
      invoice_reference: 'INV-1042',
      invoice_date: '2026-03-01',
      payment_due_date: '2026-03-10',
    });
  });

  it('builds a stable billing snapshot and export rows', () => {
    const expenses = [
      {
        id: 'expense-1',
        title: 'Desk chairs',
        amount: 240,
        currency: 'GBP',
        due_date: '2026-03-10',
        vendor_name: ' OfficeCo ',
        invoice_reference: 'INV-1042',
        invoice_date: '2026-03-01',
        payment_due_date: '2026-03-10',
        category: ' work_tools ',
        recurrence_type: 'none',
      },
      {
        id: 'expense-2',
        title: 'OfficeCo renewal',
        amount: 120,
        currency: 'GBP',
        due_date: '2026-03-05',
        vendor_name: 'OfficeCo',
        invoice_reference: 'INV-1050',
        invoice_date: '2026-03-11',
        payment_due_date: '   ',
        category: 'work_tools',
        recurrence_type: 'none',
      },
      {
        id: 'expense-3',
        title: 'Slack workspace',
        amount: 60,
        currency: 'GBP',
        due_date: '2026-03-06',
        vendor_name: 'Slack',
        invoice_reference: 'INV-1010',
        invoice_date: '2026-03-02',
        payment_due_date: '2026-03-06',
        category: 'work_tools',
        recurrence_type: 'none',
      },
      {
        id: 'expense-4',
        title: 'Internet',
        amount: 80,
        currency: 'GBP',
        due_date: '2026-03-27',
        vendor_name: 'NetFast',
        invoice_reference: 'INV-2001',
        invoice_date: '2026-03-15',
        payment_due_date: '2026-03-27',
        category: 'utilities',
        recurrence_type: 'monthly',
      },
      {
        id: 'expense-5',
        title: 'Seed budget',
        amount: 35,
        currency: 'GBP',
        due_date: '2026-03-05',
        category: 'miscellaneous',
        recurrence_type: 'none',
      },
    ];

    const snapshot = buildWorkspaceBillingSnapshot(expenses as never, new Date('2026-03-08T00:00:00.000Z'));
    const exportRows = buildWorkspaceBillingExportRows(expenses as never, new Date('2026-03-08T00:00:00.000Z'));

    expect(snapshot).toMatchObject({
      total_invoiced: 500,
      invoice_count: 4,
      vendor_count: 3,
      overdue_count: 2,
      due_soon_count: 1,
      shared_subscription_count: 1,
      tool_cost_count: 3,
      vendor_bill_count: 0,
    });
    expect(snapshot.vendors).toHaveLength(3);
    expect(snapshot.vendors[0]).toMatchObject({
      vendor_name: 'OfficeCo',
      total_spend: 360,
      invoice_count: 2,
      overdue_count: 1,
      next_due_date: '2026-03-05',
      latest_invoice_reference: 'INV-1050',
    });
    expect(snapshot.upcoming_due).toHaveLength(1);
    expect(snapshot.upcoming_due[0]).toMatchObject({
      id: 'expense-1',
      effective_due_date: '2026-03-10',
      is_overdue: false,
    });

    expect(exportRows.map((row) => row.id)).toEqual([
      'expense-2',
      'expense-3',
      'expense-1',
      'expense-4',
    ]);
    expect(exportRows[0]).toMatchObject({
      vendor_name: 'OfficeCo',
      effective_due_date: '2026-03-05',
      payment_due_date: null,
      category: 'work_tools',
      cost_kind: 'tool_cost',
    });
    expect(exportRows[3]).toMatchObject({
      cost_kind: 'shared_subscription',
      recurrence_type: 'monthly',
    });
  });

  it('treats recurring charges and tool costs as workspace billing even without invoice metadata', () => {
    expect(
      isWorkspaceBillingExpense({
        id: 'expense-subscription',
        title: 'Shared calendar',
        amount: 18,
        currency: 'GBP',
        due_date: '2026-03-14',
        category: 'miscellaneous',
        recurrence_type: 'monthly',
      } as never),
    ).toBe(true);

    expect(
      isWorkspaceBillingExpense({
        id: 'expense-tool',
        title: 'Cable adapters',
        amount: 24,
        currency: 'GBP',
        due_date: '2026-03-14',
        category: ' work_tools ',
        recurrence_type: 'none',
      } as never),
    ).toBe(true);
  });
});
