-- Clean up duplicate memberships: keep best one per user, prioritize comunidade
WITH ranked AS (
  SELECT id, user_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id 
      ORDER BY 
        CASE WHEN membership_type = 'comunidade' THEN 0 ELSE 1 END,
        created_at DESC
    ) AS rn
  FROM public.memberships
  WHERE status = 'active'
),
dupes AS (
  SELECT user_id FROM public.memberships WHERE status = 'active'
  GROUP BY user_id HAVING count(*) > 1
)
DELETE FROM public.memberships WHERE id IN (
  SELECT r.id FROM ranked r
  JOIN dupes d ON d.user_id = r.user_id
  WHERE r.rn > 1
);