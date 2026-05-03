-- Harden RLS policies for tables managed exclusively by RPCs/service_role
-- These explicit deny policies prevent direct PostgREST manipulation

-- 1. Subscriptions — managed only by Stripe webhooks and system functions
CREATE POLICY "subscriptions_deny_user_insert"
  ON subscriptions FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "subscriptions_deny_user_update"
  ON subscriptions FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "subscriptions_deny_user_delete"
  ON subscriptions FOR DELETE TO authenticated
  USING (false);

-- 2. Group invites — managed only by invite_group_member() and accept_invite_by_token() RPCs
CREATE POLICY "group_invites_deny_user_insert"
  ON group_invites FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "group_invites_deny_user_update"
  ON group_invites FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "group_invites_deny_user_delete"
  ON group_invites FOR DELETE TO authenticated
  USING (false);

-- 3. Fix receipts bucket — restrict reads to own uploads or group members' expenses
DROP POLICY IF EXISTS "group_members_can_read_receipts" ON storage.objects;

CREATE POLICY "group_members_can_read_receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (
      -- Users can always read their own receipts
      (storage.foldername(name))[1] = auth.uid()::text
      OR
      -- Or receipts attached to expenses in their groups
      EXISTS (
        SELECT 1 FROM expenses e
        JOIN group_members gm ON gm.group_id = e.group_id
        WHERE e.receipt_url LIKE '%' || storage.filename(name)
          AND gm.user_id = auth.uid()
          AND gm.status = 'active'
      )
    )
  );
