
CREATE OR REPLACE FUNCTION public.list_members_paginated(
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 50,
  _search text DEFAULT '',
  _status text DEFAULT '',
  _membership_type text DEFAULT '',
  _role text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _offset integer;
  _total bigint;
  _rows json;
BEGIN
  _offset := (_page - 1) * _page_size;

  SELECT count(*) INTO _total
  FROM memberships m
  LEFT JOIN profiles p ON p.user_id = m.user_id
  LEFT JOIN user_roles ur ON ur.user_id = m.user_id
  WHERE
    (_status = '' OR m.status = _status)
    AND (_membership_type = '' OR m.membership_type = _membership_type)
    AND (_role = '' OR ur.role::text = _role)
    AND (_search = '' OR p.full_name ILIKE '%' || _search || '%');

  SELECT json_agg(row_to_json(t)) INTO _rows
  FROM (
    SELECT
      m.id,
      m.user_id,
      m.status,
      m.source,
      m.membership_type,
      m.started_at,
      m.created_at,
      p.full_name,
      p.avatar_url,
      p.last_seen_at,
      COALESCE(ur.role::text, 'member') AS role
    FROM memberships m
    LEFT JOIN profiles p ON p.user_id = m.user_id
    LEFT JOIN user_roles ur ON ur.user_id = m.user_id
    WHERE
      (_status = '' OR m.status = _status)
      AND (_membership_type = '' OR m.membership_type = _membership_type)
      AND (_role = '' OR ur.role::text = _role)
      AND (_search = '' OR p.full_name ILIKE '%' || _search || '%')
    ORDER BY m.created_at DESC
    LIMIT _page_size OFFSET _offset
  ) t;

  RETURN json_build_object(
    'data', COALESCE(_rows, '[]'::json),
    'total', _total,
    'page', _page,
    'page_size', _page_size
  );
END;
$$;
