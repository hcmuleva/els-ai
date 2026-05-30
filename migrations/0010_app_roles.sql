-- Migration 0010 — Create the two non-superuser roles that user-facing
-- services and background jobs will eventually connect as.
--
-- Roles:
--   els_app    — used by API request handlers. RLS-bound. Per-request,
--                services must run `SET LOCAL app.org_id = '<uuid>'` to see
--                tenant data; otherwise policies return zero rows.
--   els_admin  — used by migrations, the seed, the notification scheduler,
--                and other background jobs that legitimately operate across
--                tenants. Has BYPASSRLS so it sees everything.
--
-- Passwords come from environment variables when this migration is applied;
-- the runner reads ELS_APP_PASSWORD and ELS_ADMIN_PASSWORD. When unset,
-- fallback to deterministic dev placeholders so local setup works out of
-- the box. The team must rotate these in staging/prod.
--
-- This migration ONLY creates roles + grants. It does NOT switch any service
-- DSN. That cutover is a follow-up step (a `.env` flip) so we can pause
-- here, smoke-test under the new roles manually, and revert easily if a
-- permission gap is discovered.

BEGIN;

-- ── Roles ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  app_pwd    text := COALESCE(NULLIF(current_setting('els.app_password', true), ''),    'els_app_dev_password');
  admin_pwd  text := COALESCE(NULLIF(current_setting('els.admin_password', true), ''),  'els_admin_dev_password');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'els_app') THEN
    EXECUTE format('CREATE ROLE els_app LOGIN PASSWORD %L', app_pwd);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'els_admin') THEN
    EXECUTE format('CREATE ROLE els_admin LOGIN BYPASSRLS PASSWORD %L', admin_pwd);
  END IF;
END $$;

-- Always (re)apply BYPASSRLS in case the role pre-existed without it.
ALTER ROLE els_admin BYPASSRLS;

-- ── Schema usage ────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO els_app, els_admin;

-- ── Table privileges ────────────────────────────────────────────────────
-- els_app gets standard CRUD on every existing table…
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO els_app;
GRANT USAGE, SELECT, UPDATE          ON ALL SEQUENCES IN SCHEMA public TO els_app;

-- els_admin gets the same plus DDL coverage for the migration runner.
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON ALL TABLES    IN SCHEMA public TO els_admin;
GRANT USAGE, SELECT, UPDATE                              ON ALL SEQUENCES IN SCHEMA public TO els_admin;

-- Future tables created by migrations should auto-grant to both roles so we
-- don't have to remember to grant after every CREATE TABLE.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO els_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO els_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLES TO els_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO els_admin;

-- ── Helper functions ────────────────────────────────────────────────────
-- The two app_current_* functions defined in 0004 are used by every policy.
-- Both roles need EXECUTE so policies can call them.
GRANT EXECUTE ON FUNCTION app_current_org()  TO els_app, els_admin;
GRANT EXECUTE ON FUNCTION app_current_user() TO els_app, els_admin;

-- ── Lock down access to the schema_migrations bookkeeping ───────────────
-- els_app should never read or write the migration tracker.
REVOKE ALL ON TABLE schema_migrations FROM els_app;

COMMIT;

-- ── Verification (informational only) ───────────────────────────────────
-- After applying:
--
--   SELECT rolname, rolbypassrls, rolcanlogin
--     FROM pg_roles WHERE rolname IN ('els_app','els_admin');
--
-- Expected:
--   els_app   | f | t
--   els_admin | t | t
