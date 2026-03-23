-- Drop legacy payment columns from users table
-- Payment data now lives in user_payment_methods table
ALTER TABLE users DROP COLUMN IF EXISTS payment_provider;
ALTER TABLE users DROP COLUMN IF EXISTS payment_link;
ALTER TABLE users DROP COLUMN IF EXISTS payment_info;
