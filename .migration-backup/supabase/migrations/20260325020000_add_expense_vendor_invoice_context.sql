-- Optional vendor/invoice context for workspace-style expense tracking
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS vendor_name text,
  ADD COLUMN IF NOT EXISTS invoice_reference text,
  ADD COLUMN IF NOT EXISTS invoice_date date,
  ADD COLUMN IF NOT EXISTS payment_due_date date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'expenses_vendor_invoice_dates_check'
  ) THEN
    ALTER TABLE expenses
      ADD CONSTRAINT expenses_vendor_invoice_dates_check
      CHECK (
        invoice_date IS NULL
        OR payment_due_date IS NULL
        OR payment_due_date >= invoice_date
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_expenses_payment_due_date
  ON expenses (payment_due_date)
  WHERE payment_due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_invoice_reference
  ON expenses (invoice_reference)
  WHERE invoice_reference IS NOT NULL;
