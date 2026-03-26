CREATE OR REPLACE FUNCTION public.get_rankings(period text DEFAULT 'month')
RETURNS TABLE(
  user_id uuid,
  full_name text,
  avatar_url text,
  vote_count bigint,
  comment_count bigint,
  course_count bigint,
  total_points bigint,
  role text,
  membership_type text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  WITH votes AS (
    SELECT wv.user_id AS uid, count(*) AS cnt
    FROM wine_votes wv
    WHERE wv.created_at >= since
    GROUP BY wv.user_id
  ),
  comments AS (
    SELECT wc.user_id AS uid, count(*) AS cnt
    FROM wine_comments wc
    WHERE wc.created_at >= since
    GROUP BY wc.user_id
  ),
  courses AS (
    SELECT mt.user_id AS uid, count(*) AS cnt
    FROM matriculas mt
    WHERE mt.completed_at IS NOT NULL
      AND mt.completed_at >= since
    GROUP BY mt.user_id
  ),
  combined AS (
    SELECT COALESCE(v.uid, c.uid, cr.uid) AS uid,
           COALESCE(v.cnt, 0) AS v_cnt,
           COALESCE(c.cnt, 0) AS c_cnt,
           COALESCE(cr.cnt, 0) AS cr_cnt
    FROM votes v
    FULL OUTER JOIN comments c ON v.uid = c.uid
    FULL OUTER JOIN courses cr ON COALESCE(v.uid, c.uid) = cr.uid
  )
  SELECT
    cb.uid AS user_id,
    p.full_name,
    p.avatar_url,
    cb.v_cnt AS vote_count,
    cb.c_cnt AS comment_count,
    cb.cr_cnt AS course_count,
    (cb.v_cnt + cb.c_cnt + cb.cr_cnt) AS total_points,
    COALESCE(ur.role::text, 'member') AS role,
    COALESCE(m.membership_type, 'comunidade') AS membership_type
  FROM combined cb
  LEFT JOIN profiles p ON p.user_id = cb.uid
  LEFT JOIN user_roles ur ON ur.user_id = cb.uid
  LEFT JOIN memberships m ON m.user_id = cb.uid AND m.status = 'active'
  WHERE cb.v_cnt + cb.c_cnt + cb.cr_cnt > 0
    AND NOT EXISTS (
      SELECT 1 FROM user_roles ar WHERE ar.user_id = cb.uid AND ar.role = 'admin'
    )
  ORDER BY total_points DESC, cb.v_cnt DESC
  LIMIT 100;
END;
$$;