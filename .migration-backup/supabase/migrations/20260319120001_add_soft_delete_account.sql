-- ============================================================================
-- Soft-delete account: anonymise profile, remove from groups, keep history
-- ============================================================================

CREATE OR REPLACE FUNCTION soft_delete_account()
RETURNS void AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Anonymise the user profile
  UPDATE users
  SET
    first_name = 'Deleted',
    last_name  = 'User',
    email      = _uid::text || '@deleted.commune.app',
    avatar_url = NULL
  WHERE id = _uid;

  -- Mark all group memberships as removed
  UPDATE group_members
  SET status = 'removed'
  WHERE user_id = _uid AND status != 'removed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
