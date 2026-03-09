
-- ============================================================
-- 1. CURSOS
-- ============================================================
CREATE TABLE public.cursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  nivel text NOT NULL DEFAULT 'iniciante',
  tipo text NOT NULL DEFAULT 'trilha',
  panda_folder_id text,
  is_published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_cursos_updated_at
  BEFORE UPDATE ON public.cursos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY "Active members can read published cursos"
  ON public.cursos FOR SELECT TO authenticated
  USING (is_published = true AND has_active_access(auth.uid()));

CREATE POLICY "Admins can manage cursos"
  ON public.cursos FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 2. MODULOS
-- ============================================================
CREATE TABLE public.modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.modulos ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_modulos_curso_id ON public.modulos(curso_id);

CREATE TRIGGER update_modulos_updated_at
  BEFORE UPDATE ON public.modulos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY "Active members can read modulos"
  ON public.modulos FOR SELECT TO authenticated
  USING (has_active_access(auth.uid()));

CREATE POLICY "Admins can manage modulos"
  ON public.modulos FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 3. AULAS
-- ============================================================
CREATE TABLE public.aulas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id uuid NOT NULL REFERENCES public.modulos(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  panda_video_id text,
  panda_quiz_id text,
  duracao_segundos integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.aulas ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_aulas_modulo_id ON public.aulas(modulo_id);
CREATE INDEX idx_aulas_curso_id ON public.aulas(curso_id);

CREATE TRIGGER update_aulas_updated_at
  BEFORE UPDATE ON public.aulas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY "Active members can read published aulas"
  ON public.aulas FOR SELECT TO authenticated
  USING (is_published = true AND has_active_access(auth.uid()));

CREATE POLICY "Admins can manage aulas"
  ON public.aulas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 4. MATRICULAS
-- ============================================================
CREATE TABLE public.matriculas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  progresso_pct numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'em_andamento',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, curso_id)
);

ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_matriculas_user_id ON public.matriculas(user_id);
CREATE INDEX idx_matriculas_curso_id ON public.matriculas(curso_id);

CREATE TRIGGER update_matriculas_updated_at
  BEFORE UPDATE ON public.matriculas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY "Users can read own matriculas"
  ON public.matriculas FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own matriculas"
  ON public.matriculas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND has_active_access(auth.uid()));

CREATE POLICY "Users can update own matriculas"
  ON public.matriculas FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage matriculas"
  ON public.matriculas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 5. PROGRESSO
-- ============================================================
CREATE TABLE public.progresso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  aula_id uuid NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  modulo_id uuid NOT NULL REFERENCES public.modulos(id) ON DELETE CASCADE,
  posicao_segundos integer NOT NULL DEFAULT 0,
  concluido boolean NOT NULL DEFAULT false,
  concluido_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, aula_id)
);

ALTER TABLE public.progresso ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_progresso_user_id ON public.progresso(user_id);
CREATE INDEX idx_progresso_aula_id ON public.progresso(aula_id);
CREATE INDEX idx_progresso_curso_id ON public.progresso(curso_id);

CREATE TRIGGER update_progresso_updated_at
  BEFORE UPDATE ON public.progresso
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY "Users can read own progresso"
  ON public.progresso FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progresso"
  ON public.progresso FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND has_active_access(auth.uid()));

CREATE POLICY "Users can update own progresso"
  ON public.progresso FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage progresso"
  ON public.progresso FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 6. DOWNLOADS
-- ============================================================
CREATE TABLE public.downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  aula_id uuid NOT NULL REFERENCES public.aulas(id) ON DELETE CASCADE,
  curso_id uuid NOT NULL REFERENCES public.cursos(id) ON DELETE CASCADE,
  panda_download_url text,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.downloads ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_downloads_user_id ON public.downloads(user_id);
CREATE INDEX idx_downloads_aula_id ON public.downloads(aula_id);

CREATE TRIGGER update_downloads_updated_at
  BEFORE UPDATE ON public.downloads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE POLICY "Users can read own downloads"
  ON public.downloads FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own downloads"
  ON public.downloads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND has_active_access(auth.uid()));

CREATE POLICY "Users can update own downloads"
  ON public.downloads FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own downloads"
  ON public.downloads FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage downloads"
  ON public.downloads FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
