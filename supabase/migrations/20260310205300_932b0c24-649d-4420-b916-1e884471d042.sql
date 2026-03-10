
CREATE OR REPLACE FUNCTION public.trg_aula_cascata_publicacao()
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
  WHERE curso_id = NEW.curso_id
    AND is_published = true;

  -- SENTIDO 1: Aula publicada (false → true)
  IF NEW.is_published = true AND OLD.is_published = false THEN
    UPDATE public.cursos
    SET is_published = true
    WHERE id = NEW.curso_id
      AND is_published = false;

    IF FOUND THEN
      INSERT INTO public.webhook_logs (event_id, action, status, details)
      VALUES (
        gen_random_uuid()::text,
        'curso.auto_republished',
        'processed',
        jsonb_build_object(
          'curso_id', NEW.curso_id,
          'aula_id', NEW.id,
          'motivo', 'Primeira aula publicada',
          'timestamp', NOW()
        )
      );
    END IF;
  END IF;

  -- SENTIDO 2: Aula despublicada (true → false)
  IF NEW.is_published = false AND OLD.is_published = true THEN
    IF aulas_publicadas = 0 THEN
      UPDATE public.cursos
      SET is_published = false
      WHERE id = NEW.curso_id
        AND is_published = true;

      IF FOUND THEN
        INSERT INTO public.webhook_logs (event_id, action, status, details)
        VALUES (
          gen_random_uuid()::text,
          'curso.auto_unpublished',
          'processed',
          jsonb_build_object(
            'curso_id', NEW.curso_id,
            'aula_id', NEW.id,
            'motivo', 'Última aula despublicada',
            'timestamp', NOW()
          )
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_aulas_cascata_bidirecional
  AFTER UPDATE OF is_published ON public.aulas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_aula_cascata_publicacao();
