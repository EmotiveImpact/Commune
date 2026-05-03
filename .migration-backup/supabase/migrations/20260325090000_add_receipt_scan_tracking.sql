-- Track receipt scan usage per subscription for plan-based limits
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS receipt_scan_count integer NOT NULL DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS receipt_scan_reset_at timestamptz DEFAULT now();
