-- Add hub/profile fields to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS tagline text;

-- Create storage bucket for group images (avatar + cover)
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-images', 'group-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for group images
CREATE POLICY "Group members can upload group images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'group-images');

CREATE POLICY "Anyone can view group images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'group-images');

CREATE POLICY "Group members can delete group images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'group-images');
