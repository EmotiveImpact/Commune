-- Multiple payment methods per user
CREATE TABLE user_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('revolut', 'monzo', 'paypal', 'bank_transfer', 'other')),
  label text, -- optional friendly name like "Personal Revolut"
  payment_link text, -- for revolut/monzo/paypal: username or full URL
  payment_info text, -- for bank_transfer/other: freeform details
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_user_payment_methods_user ON user_payment_methods(user_id);

-- Only one default per user
CREATE UNIQUE INDEX idx_user_payment_methods_default
  ON user_payment_methods(user_id)
  WHERE is_default = true;

-- RLS
ALTER TABLE user_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment methods"
  ON user_payment_methods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment methods"
  ON user_payment_methods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment methods"
  ON user_payment_methods FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own payment methods"
  ON user_payment_methods FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER set_updated_at_user_payment_methods
  BEFORE UPDATE ON user_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_timestamp();

-- Migrate existing payment data from users table into the new table
INSERT INTO user_payment_methods (user_id, provider, payment_link, payment_info, is_default)
SELECT
  id,
  payment_provider,
  payment_link,
  payment_info,
  true
FROM users
WHERE payment_provider IS NOT NULL;
