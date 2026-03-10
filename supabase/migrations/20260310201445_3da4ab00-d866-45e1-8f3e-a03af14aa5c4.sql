
CREATE OR REPLACE FUNCTION public.sync_curso_unpublish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF OLD.is_published = true AND NEW.is_published = false THEN
    UPDATE public.aulas SET is_published = false WHERE curso_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cursos_is_published
  AFTER UPDATE OF is_published ON public.cursos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_curso_unpublish();
