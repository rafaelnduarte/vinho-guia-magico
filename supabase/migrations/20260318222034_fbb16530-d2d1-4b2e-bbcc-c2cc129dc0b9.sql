
CREATE OR REPLACE FUNCTION public.get_course_rankings(period text DEFAULT 'all'::text)
 RETURNS TABLE(curso_id uuid, titulo text, nivel text, tipo text, capa_url text, completion_count bigint, total_points bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  since timestamp with time zone;
BEGIN
  CASE period
    WHEN 'week' THEN since := date_trunc('week', now());
    WHEN 'month' THEN since := date_trunc('month', now());
    WHEN 'year' THEN since := date_trunc('year', now());
    ELSE since := '1970-01-01'::timestamp with time zone;
  END CASE;

  RETURN QUERY
  WITH curso_aula_counts AS (
    SELECT a.curso_id AS cid, count(*) AS total_aulas
    FROM aulas a
    WHERE a.is_published = true
    GROUP BY a.curso_id
    HAVING count(*) > 0
  ),
  user_completed AS (
    SELECT p.user_id AS uid, p.curso_id AS cid, count(*) AS completed_aulas, max(p.concluido_at) AS last_completed
    FROM progresso p
    WHERE p.concluido = true
      AND p.concluido_at >= since
    GROUP BY p.user_id, p.curso_id
  ),
  full_completions AS (
    SELECT uc.cid, count(*) AS cnt
    FROM user_completed uc
    JOIN curso_aula_counts ca ON ca.cid = uc.cid
    WHERE uc.completed_aulas >= ca.total_aulas
    GROUP BY uc.cid
  )
  SELECT
    c.id AS curso_id,
    c.titulo,
    c.nivel,
    c.tipo,
    c.capa_url,
    fc.cnt AS completion_count,
    fc.cnt AS total_points
  FROM full_completions fc
  JOIN cursos c ON c.id = fc.cid
  ORDER BY completion_count DESC
  LIMIT 100;
END;
$function$;
