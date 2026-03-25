import { describe, expect, it } from 'vitest';
import { getActivityWorkspaceBillingContext } from './use-activity';

describe('getActivityWorkspaceBillingContext', () => {
  it('normalises invoice metadata from activity log payloads', () => {
    expect(
      getActivityWorkspaceBillingContext({
        metadata: {
          vendor: 'OfficeCo',
          invoice_ref: 'INV-1042',
          bill_date: '2026-03-01',
          invoice_due_date: '2026-03-10',
        },
      } as never),
    ).toEqual({
      vendor_name: 'OfficeCo',
      invoice_reference: 'INV-1042',
      invoice_date: '2026-03-01',
      payment_due_date: '2026-03-10',
    });
  });

  it('prefers top-level workspace billing context when present', () => {
    expect(
      getActivityWorkspaceBillingContext({
        workspace_billing_context: {
          vendor_name: 'NetFast',
          invoice_reference: 'INV-2001',
          invoice_date: '2026-03-15',
          payment_due_date: '2026-03-27',
        },
        metadata: {
          vendor_name: 'Old Vendor',
          invoice_reference: 'OLD-1',
        },
      } as never),
    ).toEqual({
      vendor_name: 'NetFast',
      invoice_reference: 'INV-2001',
      invoice_date: '2026-03-15',
      payment_due_date: '2026-03-27',
    });
  });

  it('falls back to nested metadata workspace billing context', () => {
    expect(
      getActivityWorkspaceBillingContext({
        metadata: {
          workspace_billing_context: {
            vendor: 'Miro',
            invoice_no: 'INV-3003',
            document_date: '2026-03-11',
            invoice_due_date: '2026-03-18',
          },
        },
      } as never),
    ).toEqual({
      vendor_name: 'Miro',
      invoice_reference: 'INV-3003',
      invoice_date: '2026-03-11',
      payment_due_date: '2026-03-18',
    });
  });
});
