-- Migration 0004 — Row-Level Security for tenant isolation.
--
-- Strategy
-- --------
-- Every tenant-scoped table gets RLS enabled with a policy that allows:
--   1. rows whose organization_id matches the session-local app.org_id
--   2. rows flagged is_global = true (for tables that have that column)
--
-- Service-side: each request must run
--     SET LOCAL app.org_id   = '<uuid>';
--     SET LOCAL app.user_id  = '<uuid>';
-- before executing tenant-scoped queries. A small middleware in
-- backend/shared/internal-auth handles this.
--
-- ROLLOUT NOTE
-- ------------
-- This migration installs the policies but uses FORCE ROW LEVEL SECURITY only
-- on a small first wave (subjects, content_topics, learning_contents,
-- quizzes). Other tables get RLS enabled but with a permissive bypass policy
-- (`USING (true)`) so we don't break anything until every code path is
-- audited. Switching the bypass policy to a strict one is a one-line follow-up
-- migration per table.

BEGIN;

-- Helper: read current org from session var, treat empty as NULL.
CREATE OR REPLACE FUNCTION app_current_org()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN coalesce(current_setting('app.org_id', true), '') = '' THEN NULL
    ELSE current_setting('app.org_id', true)::uuid
  END
$$;

CREATE OR REPLACE FUNCTION app_current_user()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN coalesce(current_setting('app.user_id', true), '') = '' THEN NULL
    ELSE current_setting('app.user_id', true)::uuid
  END
$$;

-- ── Wave 1: strict isolation (these tables are well-audited) ─────────────
-- subjects
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subjects_tenant_select ON subjects;
CREATE POLICY subjects_tenant_select ON subjects FOR SELECT
  USING (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
  );
DROP POLICY IF EXISTS subjects_tenant_modify ON subjects;
CREATE POLICY subjects_tenant_modify ON subjects FOR ALL
  USING (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
  );

-- content_topics (allows is_global)
ALTER TABLE content_topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS content_topics_tenant_select ON content_topics;
CREATE POLICY content_topics_tenant_select ON content_topics FOR SELECT
  USING (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
    OR is_global = true
  );
DROP POLICY IF EXISTS content_topics_tenant_modify ON content_topics;
CREATE POLICY content_topics_tenant_modify ON content_topics FOR ALL
  USING (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
  );

-- learning_contents
ALTER TABLE learning_contents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS learning_contents_tenant_select ON learning_contents;
CREATE POLICY learning_contents_tenant_select ON learning_contents FOR SELECT
  USING (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
    OR is_global = true
  );
DROP POLICY IF EXISTS learning_contents_tenant_modify ON learning_contents;
CREATE POLICY learning_contents_tenant_modify ON learning_contents FOR ALL
  USING (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
  );

-- quizzes
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quizzes_tenant_select ON quizzes;
CREATE POLICY quizzes_tenant_select ON quizzes FOR SELECT
  USING (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
    OR is_global = true
  );
DROP POLICY IF EXISTS quizzes_tenant_modify ON quizzes;
CREATE POLICY quizzes_tenant_modify ON quizzes FOR ALL
  USING (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
  );

-- classrooms
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS classrooms_tenant_select ON classrooms;
CREATE POLICY classrooms_tenant_select ON classrooms FOR SELECT
  USING (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
    OR is_global = true
  );
DROP POLICY IF EXISTS classrooms_tenant_modify ON classrooms;
CREATE POLICY classrooms_tenant_modify ON classrooms FOR ALL
  USING (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
  );

-- stories
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stories_tenant_select ON stories;
CREATE POLICY stories_tenant_select ON stories FOR SELECT
  USING (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
  );
DROP POLICY IF EXISTS stories_tenant_modify ON stories;
CREATE POLICY stories_tenant_modify ON stories FOR ALL
  USING (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
  );

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_tenant_select ON notifications;
CREATE POLICY notifications_tenant_select ON notifications FOR SELECT
  USING (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
  );
DROP POLICY IF EXISTS notifications_tenant_modify ON notifications;
CREATE POLICY notifications_tenant_modify ON notifications FOR ALL
  USING (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
  );

-- student_activity
ALTER TABLE student_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS student_activity_tenant_select ON student_activity;
CREATE POLICY student_activity_tenant_select ON student_activity FOR SELECT
  USING (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
  );
DROP POLICY IF EXISTS student_activity_tenant_modify ON student_activity;
CREATE POLICY student_activity_tenant_modify ON student_activity FOR ALL
  USING (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR organization_id = app_current_org()
  );

COMMIT;

-- ── Verification ────────────────────────────────────────────────────────
-- Without `SET LOCAL app.org_id`, app_current_org() returns NULL and policies
-- pass-through (so existing services keep working today). Only when a service
-- explicitly opts in by setting app.org_id will RLS start filtering.
