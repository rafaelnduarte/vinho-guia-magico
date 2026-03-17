
-- Tabela de trilhas
CREATE TABLE public.trilhas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  capa_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trilhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active members can read published trilhas"
  ON public.trilhas FOR SELECT TO authenticated
  USING (is_published = true AND has_active_access(auth.uid()));

CREATE POLICY "Admins can manage trilhas"
  ON public.trilhas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_trilhas_updated_at
  BEFORE UPDATE ON public.trilhas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de junção trilha_cursos (N:N com ordenação)
CREATE TABLE public.trilha_cursos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trilha_id UUID NOT NULL REFERENCES public.trilhas(id) ON DELETE CASCADE,
  curso_id UUID NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (trilha_id, curso_id)
);

ALTER TABLE public.trilha_cursos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active members can read trilha_cursos"
  ON public.trilha_cursos FOR SELECT TO authenticated
  USING (has_active_access(auth.uid()));

CREATE POLICY "Admins can manage trilha_cursos"
  ON public.trilha_cursos FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_trilha_cursos_trilha ON public.trilha_cursos(trilha_id, sort_order);
CREATE INDEX idx_trilha_cursos_curso ON public.trilha_cursos(curso_id);
