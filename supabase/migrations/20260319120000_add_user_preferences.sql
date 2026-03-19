-- ============================================================================
-- Add user profile and preference columns
-- ============================================================================

ALTER TABLE users
  ADD COLUMN phone            text,
  ADD COLUMN country          text,
  ADD COLUMN payment_info     text,
  ADD COLUMN default_currency text NOT NULL DEFAULT 'GBP',
  ADD COLUMN timezone         text NOT NULL DEFAULT 'Europe/London';
