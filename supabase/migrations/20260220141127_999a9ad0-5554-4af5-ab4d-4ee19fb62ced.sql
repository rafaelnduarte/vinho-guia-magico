
DROP FUNCTION IF EXISTS public.get_rankings(text);

CREATE OR REPLACE FUNCTION public.get_rankings(period text DEFAULT 'all')
RETURNS TABLE(
  user_id uuid,
  full_name text,
  avatar_url text,
  vote_count bigint,
  comment_count bigint,
  total_points bigint,
  role text,
  membership_type text
)
LANGUAGE plpgsql
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
  combined AS (
    SELECT COALESCE(v.uid, c.uid) AS uid,
           COALESCE(v.cnt, 0) AS v_cnt,
           COALESCE(c.cnt, 0) AS c_cnt
    FROM votes v
    FULL OUTER JOIN comments c ON v.uid = c.uid
  )
  SELECT
    cb.uid AS user_id,
    p.full_name,
    p.avatar_url,
    cb.v_cnt AS vote_count,
    cb.c_cnt AS comment_count,
    (cb.v_cnt + cb.c_cnt) AS total_points,
    COALESCE(ur.role::text, 'member') AS role,
    COALESCE(m.membership_type, 'comunidade') AS membership_type
  FROM combined cb
  LEFT JOIN profiles p ON p.user_id = cb.uid
  LEFT JOIN user_roles ur ON ur.user_id = cb.uid
  LEFT JOIN memberships m ON m.user_id = cb.uid
  WHERE cb.v_cnt + cb.c_cnt > 0
  ORDER BY total_points DESC, cb.v_cnt DESC
  LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_wine_rankings(period text DEFAULT 'all')
RETURNS TABLE(
  wine_id uuid,
  wine_name text,
  wine_type text,
  wine_country text,
  wine_image_url text,
  vote_count bigint,
  comment_count bigint,
  total_points bigint
)
LANGUAGE plpgsql
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
    SELECT wv.wine_id AS wid, count(*) AS cnt
    FROM wine_votes wv
    WHERE wv.created_at >= since
    GROUP BY wv.wine_id
  ),
  comments AS (
    SELECT wc.wine_id AS wid, count(*) AS cnt
    FROM wine_comments wc
    WHERE wc.created_at >= since
    GROUP BY wc.wine_id
  ),
  combined AS (
    SELECT COALESCE(v.wid, c.wid) AS wid,
           COALESCE(v.cnt, 0) AS v_cnt,
           COALESCE(c.cnt, 0) AS c_cnt
    FROM votes v
    FULL OUTER JOIN comments c ON v.wid = c.wid
  )
  SELECT
    cb.wid AS wine_id,
    w.name AS wine_name,
    w.type AS wine_type,
    w.country AS wine_country,
    w.image_url AS wine_image_url,
    cb.v_cnt AS vote_count,
    cb.c_cnt AS comment_count,
    (cb.v_cnt + cb.c_cnt) AS total_points
  FROM combined cb
  LEFT JOIN wines w ON w.id = cb.wid
  WHERE cb.v_cnt + cb.c_cnt > 0
  ORDER BY total_points DESC, cb.v_cnt DESC
  LIMIT 100;
END;
$$;
