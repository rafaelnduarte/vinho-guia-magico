
-- Add cover image column to cursos
ALTER TABLE public.cursos ADD COLUMN capa_url text;

-- Create storage bucket for course covers
INSERT INTO storage.buckets (id, name, public) VALUES ('course-covers', 'course-covers', true);

-- Public read access
CREATE POLICY "Course covers are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-covers');

-- Admin write access
CREATE POLICY "Admins can upload course covers"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'course-covers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update course covers"
ON storage.objects FOR UPDATE
USING (bucket_id = 'course-covers' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete course covers"
ON storage.objects FOR DELETE
USING (bucket_id = 'course-covers' AND public.has_role(auth.uid(), 'admin'));
