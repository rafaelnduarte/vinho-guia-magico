
-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS trg_cursos_is_published ON public.cursos;
DROP TRIGGER IF EXISTS trg_aulas_cascata_bidirecional ON public.aulas;
DROP FUNCTION IF EXISTS public.sync_curso_unpublish();
DROP FUNCTION IF EXISTS public.trg_aula_cascata_publicacao();

-- TRIGGER 1: Curso → Aulas (both directions)
CREATE OR REPLACE FUNCTION public.trg_curso_cascata_aulas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Curso published (false → true): publish all aulas
  IF NEW.is_published = true AND OLD.is_published = false THEN
    UPDATE public.aulas
    SET is_published = true
    WHERE curso_id = NEW.id AND is_published = false;

    INSERT INTO public.webhook_logs (event_id, action, status, details)
    VALUES (
      gen_random_uuid()::text,
      'aulas.auto_published',
      'processed',
      jsonb_build_object('curso_id', NEW.id, 'motivo', 'Curso publicado')
    );
  END IF;

  -- Curso unpublished (true → false): unpublish all aulas
  IF NEW.is_published = false AND OLD.is_published = true THEN
    UPDATE public.aulas
    SET is_published = false
    WHERE curso_id = NEW.id AND is_published = true;

    INSERT INTO public.webhook_logs (event_id, action, status, details)
    VALUES (
      gen_random_uuid()::text,
      'aulas.auto_unpublished',
      'processed',
      jsonb_build_object('curso_id', NEW.id, 'motivo', 'Curso despublicado')
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cursos_cascata_aulas
  AFTER UPDATE OF is_published ON public.cursos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_curso_cascata_aulas();

-- TRIGGER 2: Aulas → Curso (bidirectional)
CREATE OR REPLACE FUNCTION public.trg_aula_cascata_curso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  aulas_publicadas INT;
BEGIN
  SELECT COUNT(*) INTO aulas_publicadas
  FROM public.aulas
  WHERE curso_id = NEW.curso_id AND is_published = true;

  -- Aula published (false → true): auto-publish curso if it was off
  IF NEW.is_published = true AND OLD.is_published = false THEN
    IF aulas_publicadas = 1 THEN
      UPDATE public.cursos
      SET is_published = true
      WHERE id = NEW.curso_id AND is_published = false;

      IF FOUND THEN
        INSERT INTO public.webhook_logs (event_id, action, status, details)
        VALUES (
          gen_random_uuid()::text,
          'curso.auto_republished',
          'processed',
          jsonb_build_object('curso_id', NEW.curso_id, 'aula_id', NEW.id, 'motivo', 'Primeira aula publicada')
        );
      END IF;
    END IF;
  END IF;

  -- Aula unpublished (true → false): auto-unpublish curso if no aulas left
  IF NEW.is_published = false AND OLD.is_published = true THEN
    IF aulas_publicadas = 0 THEN
      UPDATE public.cursos
      SET is_published = false
      WHERE id = NEW.curso_id AND is_published = true;

      IF FOUND THEN
        INSERT INTO public.webhook_logs (event_id, action, status, details)
        VALUES (
          gen_random_uuid()::text,
          'curso.auto_unpublished',
          'processed',
          jsonb_build_object('curso_id', NEW.curso_id, 'aula_id', NEW.id, 'motivo', 'Última aula despublicada')
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_aulas_cascata_curso
  AFTER UPDATE OF is_published ON public.aulas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_aula_cascata_curso();
