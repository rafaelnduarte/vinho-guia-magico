
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
  SELECT
    c.id AS curso_id,
    c.titulo,
    c.nivel,
    c.tipo,
    c.capa_url,
    count(m.id) AS completion_count,
    count(m.id) AS total_points
  FROM matriculas m
  JOIN cursos c ON c.id = m.curso_id
  WHERE m.completed_at IS NOT NULL
    AND m.completed_at >= since
  GROUP BY c.id, c.titulo, c.nivel, c.tipo, c.capa_url
  HAVING count(m.id) > 0
  ORDER BY completion_count DESC
  LIMIT 100;
END;
$function$;
