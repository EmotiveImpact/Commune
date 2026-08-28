import { describe, expect, it } from 'vitest';
import { createExpenseSchema } from './schemas';
import {
  normalizeExpenseVendorInvoiceContext,
  pickExpenseVendorInvoiceContextUpdates,
} from './expense-vendor-invoice';

describe('expense vendor/invoice context', () => {
  it('normalizes blank optional values to null', () => {
    expect(
      normalizeExpenseVendorInvoiceContext({
        vendor_name: '  ',
        invoice_reference: ' INV-42 ',
        invoice_date: undefined,
        payment_due_date: null,
      }),
    ).toEqual({
      vendor_name: null,
      invoice_reference: 'INV-42',
      invoice_date: null,
      payment_due_date: null,
    });
  });

  it('only returns updates for explicitly provided fields', () => {
    expect(
      pickExpenseVendorInvoiceContextUpdates({
        vendor_name: ' Acme Workspace Ltd ',
        invoice_reference: '',
      }),
    ).toEqual({
      vendor_name: 'Acme Workspace Ltd',
      invoice_reference: null,
    });
  });

  it('rejects payment due dates before invoice dates', () => {
    const result = createExpenseSchema.safeParse({
      title: 'Desk subscription',
      category: 'work_tools',
      amount: 120,
      currency: 'GBP',
      due_date: '2026-03-25',
      recurrence_type: 'none',
      split_method: 'equal',
      participant_ids: ['550e8400-e29b-41d4-a716-446655440000'],
      vendor_name: 'Acme Workspace Ltd',
      invoice_reference: 'INV-42',
      invoice_date: '2026-03-20',
      payment_due_date: '2026-03-10',
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(['payment_due_date']);
  });
});
