-- ============================================================================
-- Add receipt_url to expenses and create receipts storage bucket
-- ============================================================================

-- Add receipt_url column to expenses
ALTER TABLE expenses ADD COLUMN receipt_url text;

-- Create the receipts storage bucket (public, 10 MB max file size)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('receipts', 'receipts', true, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload receipts to their own folder
CREATE POLICY "users_can_upload_own_receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update (overwrite) their own receipts
CREATE POLICY "users_can_update_own_receipts"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'receipts'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow group members to read receipts for expenses in their groups
CREATE POLICY "group_members_can_read_receipts"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND auth.uid() IS NOT NULL
  );

-- Allow users to delete their own receipts
CREATE POLICY "users_can_delete_own_receipts"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'receipts'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
