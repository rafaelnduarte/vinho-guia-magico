-- Create storage bucket for knowledge base files
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-files', 'knowledge-files', false)
ON CONFLICT (id) DO NOTHING;

-- Only admins can upload/read knowledge files
CREATE POLICY "Admin can upload knowledge files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'knowledge-files'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admin can read knowledge files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'knowledge-files'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admin can delete knowledge files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'knowledge-files'
  AND public.has_role(auth.uid(), 'admin')
);

-- Add file_url column to track original file
ALTER TABLE public.ai_knowledge_base
ADD COLUMN IF NOT EXISTS file_url text;