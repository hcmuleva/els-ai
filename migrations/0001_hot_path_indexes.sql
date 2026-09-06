-- Migration 0001 — Hot-path indexes
-- Adds the indexes that every page-load query already needs but that the
-- schema is missing. All CREATE INDEX statements use IF NOT EXISTS and are
-- additive, so this migration is safe to re-run and has no downtime impact.

BEGIN;

-- subjects: every join from content_topics / learning_contents / quizzes uses
-- (class_level + LOWER(title)). The UNIQUE(org, class_level, title) covers the
-- exact-match case but not LOWER().
CREATE INDEX IF NOT EXISTS idx_subjects_class_lower_title
  ON subjects (class_level, LOWER(title));
CREATE INDEX IF NOT EXISTS idx_subjects_org_class
  ON subjects (organization_id, class_level);

-- content_topics: tenant-scoped feeds + class-scoped catalogs
CREATE INDEX IF NOT EXISTS idx_content_topics_org_class
  ON content_topics (organization_id, class_level);
CREATE INDEX IF NOT EXISTS idx_content_topics_global_class
  ON content_topics (class_level) WHERE is_global = true;

-- learning_contents
CREATE INDEX IF NOT EXISTS idx_learning_contents_org_class_subject
  ON learning_contents (organization_id, class_level, subject);

-- quizzes — extremely hot in classroom-service & quiz-service
CREATE INDEX IF NOT EXISTS idx_quizzes_org_class_subject
  ON quizzes (organization_id, class_level, subject);
CREATE INDEX IF NOT EXISTS idx_quizzes_topic
  ON quizzes (topic_id) WHERE topic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quizzes_global_class
  ON quizzes (class_level) WHERE is_global = true;

-- quiz_questions(quiz_id) — fundamental missing index. Every quiz load
-- previously did a sequential scan of every question in the DB.
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz
  ON quiz_questions (quiz_id);

-- student_attempts — joined heavily for "did this student do this quiz".
CREATE INDEX IF NOT EXISTS idx_student_attempts_student_quiz
  ON student_attempts (student_id, quiz_id);
CREATE INDEX IF NOT EXISTS idx_student_attempts_quiz
  ON student_attempts (quiz_id);
CREATE INDEX IF NOT EXISTS idx_student_attempts_student_completed
  ON student_attempts (student_id, completed_at DESC);

-- question_attempts: per-attempt rollups + per-question stats
CREATE INDEX IF NOT EXISTS idx_question_attempts_attempt
  ON question_attempts (attempt_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_question
  ON question_attempts (question_id);

-- classrooms — every student feed + every teacher dashboard
CREATE INDEX IF NOT EXISTS idx_classrooms_org_class
  ON classrooms (organization_id, class_level);
CREATE INDEX IF NOT EXISTS idx_classrooms_global_class
  ON classrooms (class_level) WHERE is_global = true;
CREATE INDEX IF NOT EXISTS idx_classrooms_created_by
  ON classrooms (created_by);
CREATE INDEX IF NOT EXISTS idx_classrooms_status_start
  ON classrooms (status, start_time);

-- classroom_assignments: assignment lookups per classroom
CREATE INDEX IF NOT EXISTS idx_classroom_assignments_classroom
  ON classroom_assignments (classroom_id);

-- classroom_assignment_submissions: student-side and teacher-side reads
CREATE INDEX IF NOT EXISTS idx_caa_submissions_student
  ON classroom_assignment_submissions (student_id);
CREATE INDEX IF NOT EXISTS idx_caa_submissions_assignment
  ON classroom_assignment_submissions (classroom_assignment_id);

-- student_activity (singular) — hottest table for analytics
CREATE INDEX IF NOT EXISTS idx_student_activity_student_date
  ON student_activity (student_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_student_activity_org_date
  ON student_activity (organization_id, activity_date DESC);

-- users: org-scoped member lists
-- NOTE: `users` does not carry organization_id directly. Tenant scoping for
-- users goes via user_roles (handled below) or users.primary_organization_id.
CREATE INDEX IF NOT EXISTS idx_users_primary_org_role
  ON users (primary_organization_id, active_role)
  WHERE primary_organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_active_role
  ON users (active_role) WHERE is_active = true;

-- user_roles: reverse lookups (members of an org/role)
CREATE INDEX IF NOT EXISTS idx_user_roles_user
  ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_org_role
  ON user_roles (organization_id, role_id);

-- topic_content_assignments: when loading topic detail pages
CREATE INDEX IF NOT EXISTS idx_topic_content_assignments_topic
  ON topic_content_assignments (topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_content_assignments_content
  ON topic_content_assignments (content_id);

-- stories
CREATE INDEX IF NOT EXISTS idx_stories_org_status
  ON stories (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_stories_scheduled
  ON stories (scheduled_at) WHERE status IN ('scheduled', 'live');

COMMIT;

-- Quick verification:
-- SELECT tablename, indexname FROM pg_indexes
--   WHERE schemaname='public' AND indexname LIKE 'idx_%'
--   ORDER BY tablename, indexname;
