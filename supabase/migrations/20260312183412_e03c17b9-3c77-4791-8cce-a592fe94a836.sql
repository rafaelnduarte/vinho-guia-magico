
-- Add titulo_normalizado to aulas
ALTER TABLE public.aulas ADD COLUMN IF NOT EXISTS titulo_normalizado text;
CREATE INDEX IF NOT EXISTS idx_aulas_titulo_normalizado ON public.aulas(titulo_normalizado);

-- Add titulo_normalizado to cursos
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS titulo_normalizado text;

-- Create panda_title_index table
CREATE TABLE IF NOT EXISTS public.panda_title_index (
  panda_video_id text PRIMARY KEY,
  titulo_original text NOT NULL,
  titulo_normalizado text NOT NULL,
  curso_id uuid,
  last_synced_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.panda_title_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage panda_title_index" ON public.panda_title_index
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_panda_title_index_normalized ON public.panda_title_index(titulo_normalizado);
