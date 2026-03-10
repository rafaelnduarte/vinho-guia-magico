
ALTER TABLE public.aulas ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE public.aulas ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processing';

CREATE INDEX IF NOT EXISTS idx_aulas_curso_sort ON public.aulas(curso_id, sort_order);
