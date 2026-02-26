-- Create storage bucket for wine audio files
INSERT INTO storage.buckets (id, name, public) VALUES ('wine-audio', 'wine-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for wine-audio
CREATE POLICY "Public read wine audio" ON storage.objects FOR SELECT USING (bucket_id = 'wine-audio');

-- Admin upload/update/delete for wine-audio
CREATE POLICY "Admin manage wine audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'wine-audio' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update wine audio" ON storage.objects FOR UPDATE USING (bucket_id = 'wine-audio' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete wine audio" ON storage.objects FOR DELETE USING (bucket_id = 'wine-audio' AND public.has_role(auth.uid(), 'admin'));
