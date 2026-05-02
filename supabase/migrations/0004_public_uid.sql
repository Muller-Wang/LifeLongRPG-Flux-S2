BEGIN;

CREATE SEQUENCE IF NOT EXISTS users_public_uid_seq START WITH 100001;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS public_uid BIGINT;

ALTER TABLE users
ALTER COLUMN public_uid SET DEFAULT nextval('users_public_uid_seq');

WITH ranked_users AS (
  SELECT id
  FROM users
  WHERE public_uid IS NULL
  ORDER BY created_at ASC, id ASC
)
UPDATE users
SET public_uid = nextval('users_public_uid_seq')
WHERE id IN (SELECT id FROM ranked_users);

SELECT setval(
  'users_public_uid_seq',
  GREATEST(
    COALESCE((SELECT MAX(public_uid) FROM users), 100000),
    100000
  ),
  true
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_uid_unique
  ON users(public_uid);

COMMIT;
