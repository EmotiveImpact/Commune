-- ============================================================================
-- Fix: Group creation fails with "row-level security policy" error
-- ============================================================================
-- ROOT CAUSE: When the Supabase JS client does .insert().select().single(),
-- PostgREST uses Prefer: return=representation, which requires both the INSERT
-- and SELECT RLS policies to pass. The SELECT policy on groups only allows
-- reading groups where the user appears in group_members. But the AFTER INSERT
-- trigger (fn_add_owner_as_admin) that creates the membership row has not yet
-- fired when PostgREST evaluates the SELECT policy for the response.
--
-- FIX: Add a SELECT policy that lets the group owner always read their own
-- group. This is semantically correct (owners should always see their groups)
-- and ensures the insert-then-return flow works.
-- ============================================================================

-- Allow group owners to always read their own groups
CREATE POLICY "groups_owner_can_read"
  ON groups FOR SELECT
  USING (owner_id = auth.uid());
