-- Add grace period for account deletion (14 days)
-- Instead of immediate anonymisation, mark for deletion and allow reactivation

-- Add deletion tracking columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_scheduled_for timestamptz DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deactivated boolean NOT NULL DEFAULT false;

-- Rewrite soft_delete_account to use grace period instead of immediate anonymisation
CREATE OR REPLACE FUNCTION soft_delete_account()
RETURNS void AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Mark account as deactivated with 14-day grace period
  UPDATE users
  SET
    is_deactivated = true,
    deletion_requested_at = now(),
    deletion_scheduled_for = now() + interval '14 days'
  WHERE id = _uid;

  -- Mark all group memberships as removed
  UPDATE group_members
  SET status = 'removed',
      effective_until = CURRENT_DATE
  WHERE user_id = _uid AND status != 'removed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reactivate account (called on login during grace period)
CREATE OR REPLACE FUNCTION reactivate_account()
RETURNS void AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only reactivate if in grace period (not yet hard-deleted)
  UPDATE users
  SET
    is_deactivated = false,
    deletion_requested_at = NULL,
    deletion_scheduled_for = NULL
  WHERE id = _uid
    AND is_deactivated = true
    AND deletion_scheduled_for > now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for cron job to hard-delete expired accounts
-- This should be called by a scheduled edge function
CREATE OR REPLACE FUNCTION hard_delete_expired_accounts()
RETURNS integer AS $$
DECLARE
  _count integer := 0;
  _user record;
  _group record;
  _new_owner uuid;
BEGIN
  FOR _user IN
    SELECT id FROM users
    WHERE is_deactivated = true
      AND deletion_scheduled_for IS NOT NULL
      AND deletion_scheduled_for <= now()
  LOOP
    -- Transfer ownership of owned groups
    FOR _group IN
      SELECT id FROM groups WHERE owner_id = _user.id
    LOOP
      SELECT gm.user_id INTO _new_owner
      FROM group_members gm
      WHERE gm.group_id = _group.id
        AND gm.user_id != _user.id
        AND gm.role = 'admin'
        AND gm.status = 'active'
      LIMIT 1;

      IF _new_owner IS NOT NULL THEN
        UPDATE groups SET owner_id = _new_owner WHERE id = _group.id;
      ELSE
        SELECT gm.user_id INTO _new_owner
        FROM group_members gm
        WHERE gm.group_id = _group.id
          AND gm.user_id != _user.id
          AND gm.status = 'active'
        LIMIT 1;

        IF _new_owner IS NOT NULL THEN
          UPDATE group_members SET role = 'admin'
          WHERE group_id = _group.id AND user_id = _new_owner;
          UPDATE groups SET owner_id = _new_owner WHERE id = _group.id;
        END IF;
      END IF;
    END LOOP;

    -- Anonymise the user data (GDPR compliant)
    UPDATE users
    SET
      first_name = 'Deleted',
      last_name = 'User',
      email = _user.id::text || '@deleted.commune.app',
      avatar_url = NULL,
      phone = NULL,
      country = NULL
    WHERE id = _user.id;

    -- Delete payment methods
    DELETE FROM user_payment_methods WHERE user_id = _user.id;

    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
