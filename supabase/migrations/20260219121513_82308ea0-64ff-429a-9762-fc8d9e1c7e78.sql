
-- Add status column to wines
ALTER TABLE public.wines ADD COLUMN status text NOT NULL DEFAULT 'curadoria';

-- Migrate existing data
UPDATE public.wines SET status = CASE WHEN is_published = true THEN 'curadoria' ELSE 'rascunho' END;

-- Drop old RLS policy for members reading published wines
DROP POLICY IF EXISTS "Active members can read published wines" ON public.wines;

-- Create new RLS policy allowing members to read curadoria + acervo
CREATE POLICY "Active members can read visible wines"
ON public.wines
FOR SELECT
USING (
  (status IN ('curadoria', 'acervo')) AND has_active_access(auth.uid())
);
