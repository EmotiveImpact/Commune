ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{
  "email_on_new_expense": true,
  "email_on_payment_received": true,
  "email_on_payment_reminder": true,
  "email_on_overdue": true
}'::jsonb;
