-- Add structured house info to groups (Wi-Fi, bins, landlord, emergency, etc.)
ALTER TABLE groups ADD COLUMN IF NOT EXISTS house_info jsonb DEFAULT NULL;
