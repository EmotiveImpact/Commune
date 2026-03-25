import { describe, expect, it } from 'vitest';
import {
  buildWorkspaceBillingPackFiles,
  generateWorkspaceBillingLedgerCSV,
} from './export-csv';

const workspaceBillingData = {
  snapshot: {
    total_invoiced: 1320,
    invoice_count: 3,
    vendor_count: 2,
    overdue_count: 1,
    due_soon_count: 1,
    shared_subscription_count: 1,
    tool_cost_count: 1,
    vendor_bill_count: 1,
    vendors: [
      {
        vendor_name: 'OfficeCo',
        total_spend: 920,
        invoice_count: 2,
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
    upcoming_due: [],
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
      amount: 920,
      invoice_count: 2,
      overdue_count: 1,
      shared_subscription_count: 0,
      tool_cost_count: 1,
      vendor_bill_count: 1,
    },
  ],
  export_rows: [
    {
      id: 'expense-1',
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
      cost_kind: 'shared_subscription' as const,
    },
    {
      id: 'expense-2',
      title: 'Desk chairs',
      amount: 920,
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
      cost_kind: 'tool_cost' as const,
    },
  ],
};

describe('workspace billing exports', () => {
  it('builds a workspace billing pack with the expected files and contents', () => {
    const files = buildWorkspaceBillingPackFiles(workspaceBillingData, 'GBP', '2026-03-25');

    expect(files.map((file) => file.filename)).toEqual([
      'workspace-billing-summary-2026-03-25.csv',
      'workspace-billing-ledger-2026-03-25.csv',
      'workspace-billing-vendors-2026-03-25.csv',
      'workspace-billing-trend-2026-03-25.csv',
      'workspace-billing-readme-2026-03-25.txt',
    ]);

    expect(files[0]?.contents).toContain('"Tracked spend","1320.00","GBP"');
    expect(files[2]?.contents).toContain('"OfficeCo",920.00,"GBP",2,1,"2026-03-26","INV-1042","2026-03-20","2026-03-26"');
    expect(files[3]?.contents).toContain('"2026-03","Mar 2026",920.00,"GBP",2,1,0,1,1');
    expect(files[4]?.contents).toContain('Commune workspace billing pack');
  });

  it('formats the ledger export with billing-state and recurrence labels', () => {
    const csv = generateWorkspaceBillingLedgerCSV(workspaceBillingData.export_rows);

    expect(csv).toContain('Bill,Vendor,Cost kind,Invoice reference,Invoice date,Due date,Effective due date,Payment due date,Category,Recurrence,Billing state,Amount,Currency');
    expect(csv).toContain('"Slack seats","Slack","Shared Subscription","INV-1058","2026-03-22","2026-04-01","2026-04-01","2026-04-01","Work Tools","Monthly","Open",400.00,"GBP"');
    expect(csv).toContain('"Desk chairs","OfficeCo","Tool Cost","INV-1042","2026-03-20","2026-03-26","2026-03-26","2026-03-26","Work Tools","None","Overdue",920.00,"GBP"');
  });
});
