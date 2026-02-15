-- Create storage bucket for wine images
INSERT INTO storage.buckets (id, name, public) VALUES ('wine-images', 'wine-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view wine images (public bucket)
CREATE POLICY "Wine images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'wine-images');

-- Allow authenticated admins to upload wine images
CREATE POLICY "Admins can upload wine images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'wine-images'
  AND auth.role() = 'authenticated'
);

-- Allow authenticated admins to update wine images
CREATE POLICY "Admins can update wine images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'wine-images'
  AND auth.role() = 'authenticated'
);

-- Allow authenticated admins to delete wine images
CREATE POLICY "Admins can delete wine images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'wine-images'
  AND auth.role() = 'authenticated'
);