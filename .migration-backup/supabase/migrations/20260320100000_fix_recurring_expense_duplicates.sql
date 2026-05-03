-- Fix: Recurring expense generation was copying recurrence_type to generated
-- expenses, causing them to be treated as recurring sources themselves and
-- creating cascading duplicates on every app load.
--
-- This migration:
-- 1. Sets recurrence_type = 'none' on all generated (non-source) expenses
-- 2. Soft-deletes duplicate generated expenses (keeps the first per source per month)

-- Step 1: Fix generated expenses so they are no longer treated as recurring sources
UPDATE expenses
SET recurrence_type = 'none',
    recurrence_interval = 0
WHERE id IN (
  SELECT generated_expense_id FROM recurring_expense_log
)
AND recurrence_type != 'none';

-- Step 2: For each (source_expense_id, generated_for_month) pair, keep only the
-- earliest generated expense and soft-delete the rest.
WITH ranked AS (
  SELECT
    rel.generated_expense_id,
    ROW_NUMBER() OVER (
      PARTITION BY rel.source_expense_id, rel.generated_for_month
      ORDER BY e.created_at ASC
    ) AS rn
  FROM recurring_expense_log rel
  JOIN expenses e ON e.id = rel.generated_expense_id
)
UPDATE expenses
SET is_active = false
WHERE id IN (
  SELECT generated_expense_id FROM ranked WHERE rn > 1
);

-- Step 3: Clean up the log entries for the soft-deleted duplicates
DELETE FROM recurring_expense_log
WHERE generated_expense_id IN (
  SELECT id FROM expenses WHERE is_active = false
  INTERSECT
  SELECT generated_expense_id FROM recurring_expense_log
);
