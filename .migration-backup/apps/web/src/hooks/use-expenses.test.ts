import { describe, expect, it } from 'vitest';
import {
  getWorkspaceExpenseContext,
  hasWorkspaceExpenseContext,
  toWorkspaceExpenseContextPayload,
} from './use-expenses';

describe('workspace expense context helpers', () => {
  it('normalizes multiple backend field names into the workspace context layer', () => {
    const context = getWorkspaceExpenseContext({
      vendor: 'OfficeCo',
      invoice_reference: 'INV-1042',
      invoice_ref: 'INV-1042',
      invoice_date: '2026-03-10',
      payment_due_date: '2026-03-25',
    });

    expect(context).toEqual({
      vendor_name: 'OfficeCo',
      invoice_reference: 'INV-1042',
      invoice_date: '2026-03-10',
      payment_due_date: '2026-03-25',
    });
    expect(hasWorkspaceExpenseContext(context)).toBe(true);
  });

  it('trims blank values when building a payload', () => {
    expect(
      toWorkspaceExpenseContextPayload({
        vendor_name: '  ',
        invoice_reference: ' INV-1 ',
        invoice_date: '',
        payment_due_date: ' 2026-03-25 ',
      }),
    ).toEqual({
      invoice_reference: 'INV-1',
      payment_due_date: '2026-03-25',
    });
  });
});
