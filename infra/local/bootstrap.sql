-- Local, self-hosted auth adapter. Never run this over an existing Neon Auth
-- installation: neon_auth."user" is a compatibility view for the shared SQL.
-- Use a fresh database and apply this before infra/neon/migrations/0001-0003.
BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  EXECUTE format('GRANT authenticated TO %I', current_user);
END $$;

CREATE SCHEMA app_auth;
CREATE SCHEMA auth;
CREATE SCHEMA neon_auth;

CREATE TABLE app_auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  email text NOT NULL UNIQUE CHECK (length(email) BETWEEN 3 AND 254),
  email_verified boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (email = lower(btrim(email)))
);

CREATE TABLE app_auth.credentials (
  user_id uuid PRIMARY KEY REFERENCES app_auth.users(id) ON DELETE CASCADE,
  salt bytea NOT NULL CHECK (octet_length(salt) = 32),
  password_hash bytea NOT NULL CHECK (octet_length(password_hash) = 64),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_auth.sessions (
  token_hash bytea PRIMARY KEY CHECK (octet_length(token_hash) = 32),
  user_id uuid NOT NULL REFERENCES app_auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX app_auth_sessions_user_idx ON app_auth.sessions(user_id);
CREATE INDEX app_auth_sessions_expiry_idx ON app_auth.sessions(expires_at);

-- Existing invitation and reminder SQL uses the Managed Auth shape. This
-- adapter deliberately contains no password or session data.
CREATE VIEW neon_auth."user" AS
  SELECT id::text AS id, name, email,
    email_verified AS "emailVerified"
  FROM app_auth.users;

CREATE FUNCTION auth.user_id() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.sub', true), '')
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_id() TO authenticated;
-- app_auth/neon_auth schemas and their tables have no authenticated grants.

COMMIT;
