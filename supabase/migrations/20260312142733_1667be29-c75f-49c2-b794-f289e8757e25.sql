DROP POLICY IF EXISTS "Admins can upload wine images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update wine images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete wine images" ON storage.objects;

CREATE POLICY "Admins can upload wine images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'wine-images'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update wine images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'wine-images'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete wine images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'wine-images'
  AND public.has_role(auth.uid(), 'admin')
);