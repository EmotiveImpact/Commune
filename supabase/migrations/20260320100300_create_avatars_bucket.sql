-- Create the avatars storage bucket (public so avatar URLs are accessible)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own avatar
CREATE POLICY "users_can_upload_own_avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update (overwrite) their own avatar
CREATE POLICY "users_can_update_own_avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow anyone to read avatars (public bucket)
CREATE POLICY "avatars_are_publicly_readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Allow users to delete their own avatar
CREATE POLICY "users_can_delete_own_avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
