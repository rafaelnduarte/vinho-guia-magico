INSERT INTO memberships (user_id, status, source, membership_type)
SELECT u.id, 'active', 'csv', 'radar'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id)
  AND u.id NOT IN (SELECT user_id FROM user_roles WHERE role = 'admin');