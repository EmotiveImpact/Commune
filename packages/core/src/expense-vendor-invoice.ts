import type { ExpenseVendorInvoiceContext } from '@commune/types';
import {
  expenseVendorInvoiceContextSchema,
  type ExpenseVendorInvoiceContextInput,
} from './schemas';

export const expenseVendorInvoiceContextKeys = [
  'vendor_name',
  'invoice_reference',
  'invoice_date',
  'payment_due_date',
] as const;

type ExpenseVendorInvoiceContextKey =
  (typeof expenseVendorInvoiceContextKeys)[number];

export function normalizeExpenseVendorInvoiceContext(
  input: Partial<Record<ExpenseVendorInvoiceContextKey, unknown>>,
): ExpenseVendorInvoiceContext {
  return expenseVendorInvoiceContextSchema.parse(input);
}

export function pickExpenseVendorInvoiceContextUpdates(
  input: Partial<ExpenseVendorInvoiceContextInput>,
): Partial<ExpenseVendorInvoiceContext> {
  const normalized = normalizeExpenseVendorInvoiceContext(input);

  return expenseVendorInvoiceContextKeys.reduce<Partial<ExpenseVendorInvoiceContext>>(
    (updates, key) => {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        updates[key] = normalized[key];
      }
      return updates;
    },
    {},
  );
}
