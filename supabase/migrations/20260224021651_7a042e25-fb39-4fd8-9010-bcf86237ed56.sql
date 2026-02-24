
-- Create storage bucket for partner logos
INSERT INTO storage.buckets (id, name, public) VALUES ('partner-logos', 'partner-logos', true);

-- Public read access
CREATE POLICY "Partner logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'partner-logos');

-- Admins can upload
CREATE POLICY "Admins can upload partner logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'partner-logos' AND public.has_role(auth.uid(), 'admin'));

-- Admins can update
CREATE POLICY "Admins can update partner logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'partner-logos' AND public.has_role(auth.uid(), 'admin'));

-- Admins can delete
CREATE POLICY "Admins can delete partner logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'partner-logos' AND public.has_role(auth.uid(), 'admin'));
