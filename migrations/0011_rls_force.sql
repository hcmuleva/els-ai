-- Migration 0011 — FORCE ROW LEVEL SECURITY on every RLS-enabled table.
--
-- Why: by default, RLS does NOT apply to the table owner. If anyone ever
-- connects as the owning role (e.g. `postgres` for ad-hoc admin work,
-- `els_admin` BYPASSRLS via deliberate intent), policies are ignored. Any
-- service that legitimately needs cross-tenant access already uses
-- `els_admin` (BYPASSRLS), which works regardless. Forcing RLS closes the
-- last loophole: even if a future service connects as the table owner, RLS
-- will still apply.
--
-- See: https://www.postgresql.org/docs/current/sql-altertable.html
--      "FORCE ROW LEVEL SECURITY"

BEGIN;

ALTER TABLE achievements                       FORCE ROW LEVEL SECURITY;
ALTER TABLE assets                             FORCE ROW LEVEL SECURITY;
ALTER TABLE classroom_assignment_submissions   FORCE ROW LEVEL SECURITY;
ALTER TABLE classroom_assignments              FORCE ROW LEVEL SECURITY;
ALTER TABLE classroom_contents                 FORCE ROW LEVEL SECURITY;
ALTER TABLE classroom_quizzes                  FORCE ROW LEVEL SECURITY;
ALTER TABLE classroom_student_remarks          FORCE ROW LEVEL SECURITY;
ALTER TABLE classrooms                         FORCE ROW LEVEL SECURITY;
ALTER TABLE content_topics                     FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices                           FORCE ROW LEVEL SECURITY;
ALTER TABLE learning_content_sections          FORCE ROW LEVEL SECURITY;
ALTER TABLE learning_contents                  FORCE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences           FORCE ROW LEVEL SECURITY;
ALTER TABLE notification_schedules             FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications                      FORCE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions         FORCE ROW LEVEL SECURITY;
ALTER TABLE parent_assessments                 FORCE ROW LEVEL SECURITY;
ALTER TABLE parent_feedback                    FORCE ROW LEVEL SECURITY;
ALTER TABLE parent_student_links               FORCE ROW LEVEL SECURITY;
ALTER TABLE question_attempts                  FORCE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions                     FORCE ROW LEVEL SECURITY;
ALTER TABLE quizzes                            FORCE ROW LEVEL SECURITY;
ALTER TABLE stories                            FORCE ROW LEVEL SECURITY;
ALTER TABLE story_progress                     FORCE ROW LEVEL SECURITY;
ALTER TABLE story_sections                     FORCE ROW LEVEL SECURITY;
ALTER TABLE student_achievements               FORCE ROW LEVEL SECURITY;
ALTER TABLE student_activity                   FORCE ROW LEVEL SECURITY;
ALTER TABLE student_analytics                  FORCE ROW LEVEL SECURITY;
ALTER TABLE student_attempts                   FORCE ROW LEVEL SECURITY;
ALTER TABLE subject_aliases                    FORCE ROW LEVEL SECURITY;
ALTER TABLE subjects                           FORCE ROW LEVEL SECURITY;
ALTER TABLE teacher_standard_subjects          FORCE ROW LEVEL SECURITY;
ALTER TABLE topic_content_assignments          FORCE ROW LEVEL SECURITY;
ALTER TABLE topic_content_sections             FORCE ROW LEVEL SECURITY;
ALTER TABLE user_global_publish_permissions    FORCE ROW LEVEL SECURITY;
ALTER TABLE user_org_mapping                   FORCE ROW LEVEL SECURITY;
ALTER TABLE user_roles                         FORCE ROW LEVEL SECURITY;

COMMIT;

-- Verify:
--   SELECT relname, relforcerowsecurity
--     FROM pg_class
--    WHERE relkind = 'r' AND relrowsecurity = true
--    ORDER BY relname;
-- Every row should have relforcerowsecurity = t.
