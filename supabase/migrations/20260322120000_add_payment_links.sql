-- ============================================================================
-- Add structured payment link fields to users table
-- Replaces the plain-text payment_info with structured provider + link data
-- ============================================================================

ALTER TABLE users
  ADD COLUMN payment_provider text,
  ADD COLUMN payment_link     text;

-- Migrate existing payment_info into payment_link for users who had it set
UPDATE users
SET payment_link = payment_info
WHERE payment_info IS NOT NULL AND payment_info != '';
