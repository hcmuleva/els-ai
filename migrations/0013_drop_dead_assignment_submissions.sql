-- Migration 0013 — Drop the dead `assignment_submissions` table.
--
-- Why: it has 0 rows, no foreign keys reference it, and no service route
-- reads or writes it. The active table for class-assigned homework is
-- `classroom_assignment_submissions` (note the prefix). The legacy
-- `assignment_submissions` is leftover from an older design and only
-- survived because the auth-service seed kept recreating it.
--
-- Verified before this migration:
--   SELECT count(*) FROM assignment_submissions;            -- 0
--   SELECT count(*)
--     FROM pg_constraint c JOIN pg_class t ON t.oid=c.confrelid
--    WHERE c.contype='f' AND t.relname='assignment_submissions';   -- 0
--
-- The corresponding CREATE / DROP statements are also being removed from
-- `auth-service/src/seed/seed.ts` and `migrations/0012_auth_seed_schema.sql`
-- so the table never reappears.

BEGIN;

DROP TABLE IF EXISTS assignment_submissions CASCADE;

COMMIT;
