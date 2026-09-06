-- Migration 0009 — Extend RLS to all remaining tenant-scoped tables.
--
-- Migration 0004 enabled RLS on 8 core tables. This migration adds policies
-- for the rest of the tenant-scoped surface:
--
--   Group A — tables with their own `organization_id` column:
--     achievements, assets, invoices, notification_preferences,
--     notification_schedules, organization_subscriptions, parent_assessments,
--     parent_feedback, parent_student_links, student_analytics,
--     teacher_standard_subjects, user_global_publish_permissions,
--     user_org_mapping, user_roles
--
--   Group B — child tables with no `organization_id`; tenancy enforced by
--     a join to a parent that does have one:
--     classroom_contents, classroom_quizzes, classroom_assignments,
--     classroom_assignment_submissions, classroom_student_remarks,
--     learning_content_sections, topic_content_assignments,
--     topic_content_sections, quiz_questions, student_attempts,
--     question_attempts, subject_aliases, story_progress, story_sections,
--     student_achievements
--
-- Same activation pattern as 0004: `app_current_org() IS NULL` short-circuits
-- the policy so that any session that hasn't called `SET LOCAL app.org_id`
-- still sees everything (which keeps current behaviour while els_app is not
-- yet wired up).
--
-- Skipped on purpose:
--   * `users`           — users can belong to multiple orgs via user_roles, so
--                         simple per-row org filtering doesn't apply. Reads
--                         scope by JWT user_id.
--   * `organizations`   — org table itself; tenancy is on `id`.
--   * `roles`,`subscription_plans`,`class_levels`,`schema_migrations` — global.
--   * `assignment_submissions` — dead table, will be dropped.
--   * `refresh_tokens`  — keyed by user_id, no org column.

BEGIN;

-- ── Helper macro is implicit via app_current_org() / app_current_user() ──
-- (defined in migration 0004; reused here.)

-- =========================================================================
-- GROUP A — tables with organization_id
-- =========================================================================

-- achievements
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS achievements_tenant_select ON achievements;
CREATE POLICY achievements_tenant_select ON achievements FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS achievements_tenant_modify ON achievements;
CREATE POLICY achievements_tenant_modify ON achievements FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

-- assets
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assets_tenant_select ON assets;
CREATE POLICY assets_tenant_select ON assets FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS assets_tenant_modify ON assets;
CREATE POLICY assets_tenant_modify ON assets FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

-- invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoices_tenant_select ON invoices;
CREATE POLICY invoices_tenant_select ON invoices FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS invoices_tenant_modify ON invoices;
CREATE POLICY invoices_tenant_modify ON invoices FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

-- notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_preferences_tenant_select ON notification_preferences;
CREATE POLICY notification_preferences_tenant_select ON notification_preferences FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS notification_preferences_tenant_modify ON notification_preferences;
CREATE POLICY notification_preferences_tenant_modify ON notification_preferences FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

-- notification_schedules
ALTER TABLE notification_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_schedules_tenant_select ON notification_schedules;
CREATE POLICY notification_schedules_tenant_select ON notification_schedules FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS notification_schedules_tenant_modify ON notification_schedules;
CREATE POLICY notification_schedules_tenant_modify ON notification_schedules FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

-- organization_subscriptions
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_subscriptions_tenant_select ON organization_subscriptions;
CREATE POLICY organization_subscriptions_tenant_select ON organization_subscriptions FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS organization_subscriptions_tenant_modify ON organization_subscriptions;
CREATE POLICY organization_subscriptions_tenant_modify ON organization_subscriptions FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

-- parent_assessments
ALTER TABLE parent_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS parent_assessments_tenant_select ON parent_assessments;
CREATE POLICY parent_assessments_tenant_select ON parent_assessments FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS parent_assessments_tenant_modify ON parent_assessments;
CREATE POLICY parent_assessments_tenant_modify ON parent_assessments FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

-- parent_feedback
ALTER TABLE parent_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS parent_feedback_tenant_select ON parent_feedback;
CREATE POLICY parent_feedback_tenant_select ON parent_feedback FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS parent_feedback_tenant_modify ON parent_feedback;
CREATE POLICY parent_feedback_tenant_modify ON parent_feedback FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

-- parent_student_links
ALTER TABLE parent_student_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS parent_student_links_tenant_select ON parent_student_links;
CREATE POLICY parent_student_links_tenant_select ON parent_student_links FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS parent_student_links_tenant_modify ON parent_student_links;
CREATE POLICY parent_student_links_tenant_modify ON parent_student_links FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

-- student_analytics
ALTER TABLE student_analytics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS student_analytics_tenant_select ON student_analytics;
CREATE POLICY student_analytics_tenant_select ON student_analytics FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS student_analytics_tenant_modify ON student_analytics;
CREATE POLICY student_analytics_tenant_modify ON student_analytics FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

-- teacher_standard_subjects
ALTER TABLE teacher_standard_subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS teacher_standard_subjects_tenant_select ON teacher_standard_subjects;
CREATE POLICY teacher_standard_subjects_tenant_select ON teacher_standard_subjects FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS teacher_standard_subjects_tenant_modify ON teacher_standard_subjects;
CREATE POLICY teacher_standard_subjects_tenant_modify ON teacher_standard_subjects FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

-- user_global_publish_permissions
ALTER TABLE user_global_publish_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_global_publish_permissions_tenant_select ON user_global_publish_permissions;
CREATE POLICY user_global_publish_permissions_tenant_select ON user_global_publish_permissions FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS user_global_publish_permissions_tenant_modify ON user_global_publish_permissions;
CREATE POLICY user_global_publish_permissions_tenant_modify ON user_global_publish_permissions FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

-- user_org_mapping
ALTER TABLE user_org_mapping ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_org_mapping_tenant_select ON user_org_mapping;
CREATE POLICY user_org_mapping_tenant_select ON user_org_mapping FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS user_org_mapping_tenant_modify ON user_org_mapping;
CREATE POLICY user_org_mapping_tenant_modify ON user_org_mapping FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

-- user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_roles_tenant_select ON user_roles;
CREATE POLICY user_roles_tenant_select ON user_roles FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS user_roles_tenant_modify ON user_roles;
CREATE POLICY user_roles_tenant_modify ON user_roles FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());


-- =========================================================================
-- GROUP B — child tables (tenancy via parent)
-- =========================================================================

-- classroom_contents (parent: classrooms)
ALTER TABLE classroom_contents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS classroom_contents_tenant_select ON classroom_contents;
CREATE POLICY classroom_contents_tenant_select ON classroom_contents FOR SELECT
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM classrooms c
       WHERE c.id = classroom_contents.classroom_id
         AND (c.organization_id = app_current_org() OR c.is_global = true)
    )
  );
DROP POLICY IF EXISTS classroom_contents_tenant_modify ON classroom_contents;
CREATE POLICY classroom_contents_tenant_modify ON classroom_contents FOR ALL
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM classrooms c
       WHERE c.id = classroom_contents.classroom_id
         AND c.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM classrooms c
       WHERE c.id = classroom_contents.classroom_id
         AND c.organization_id = app_current_org()
    )
  );

-- classroom_quizzes (parent: classrooms)
ALTER TABLE classroom_quizzes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS classroom_quizzes_tenant_select ON classroom_quizzes;
CREATE POLICY classroom_quizzes_tenant_select ON classroom_quizzes FOR SELECT
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM classrooms c
       WHERE c.id = classroom_quizzes.classroom_id
         AND (c.organization_id = app_current_org() OR c.is_global = true)
    )
  );
DROP POLICY IF EXISTS classroom_quizzes_tenant_modify ON classroom_quizzes;
CREATE POLICY classroom_quizzes_tenant_modify ON classroom_quizzes FOR ALL
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM classrooms c
       WHERE c.id = classroom_quizzes.classroom_id
         AND c.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM classrooms c
       WHERE c.id = classroom_quizzes.classroom_id
         AND c.organization_id = app_current_org()
    )
  );

-- classroom_assignments (parent: classrooms)
ALTER TABLE classroom_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS classroom_assignments_tenant_select ON classroom_assignments;
CREATE POLICY classroom_assignments_tenant_select ON classroom_assignments FOR SELECT
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM classrooms c
       WHERE c.id = classroom_assignments.classroom_id
         AND (c.organization_id = app_current_org() OR c.is_global = true)
    )
  );
DROP POLICY IF EXISTS classroom_assignments_tenant_modify ON classroom_assignments;
CREATE POLICY classroom_assignments_tenant_modify ON classroom_assignments FOR ALL
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM classrooms c
       WHERE c.id = classroom_assignments.classroom_id
         AND c.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM classrooms c
       WHERE c.id = classroom_assignments.classroom_id
         AND c.organization_id = app_current_org()
    )
  );

-- classroom_assignment_submissions (parent: classroom_assignments → classrooms)
ALTER TABLE classroom_assignment_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS classroom_assignment_submissions_tenant_select ON classroom_assignment_submissions;
CREATE POLICY classroom_assignment_submissions_tenant_select ON classroom_assignment_submissions FOR SELECT
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM classroom_assignments ca
        JOIN classrooms c ON c.id = ca.classroom_id
       WHERE ca.id = classroom_assignment_submissions.classroom_assignment_id
         AND (c.organization_id = app_current_org() OR c.is_global = true)
    )
  );
DROP POLICY IF EXISTS classroom_assignment_submissions_tenant_modify ON classroom_assignment_submissions;
CREATE POLICY classroom_assignment_submissions_tenant_modify ON classroom_assignment_submissions FOR ALL
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM classroom_assignments ca
        JOIN classrooms c ON c.id = ca.classroom_id
       WHERE ca.id = classroom_assignment_submissions.classroom_assignment_id
         AND c.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM classroom_assignments ca
        JOIN classrooms c ON c.id = ca.classroom_id
       WHERE ca.id = classroom_assignment_submissions.classroom_assignment_id
         AND c.organization_id = app_current_org()
    )
  );

-- classroom_student_remarks (parent: classrooms)
ALTER TABLE classroom_student_remarks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS classroom_student_remarks_tenant_select ON classroom_student_remarks;
CREATE POLICY classroom_student_remarks_tenant_select ON classroom_student_remarks FOR SELECT
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM classrooms c
       WHERE c.id = classroom_student_remarks.classroom_id
         AND (c.organization_id = app_current_org() OR c.is_global = true)
    )
  );
DROP POLICY IF EXISTS classroom_student_remarks_tenant_modify ON classroom_student_remarks;
CREATE POLICY classroom_student_remarks_tenant_modify ON classroom_student_remarks FOR ALL
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM classrooms c
       WHERE c.id = classroom_student_remarks.classroom_id
         AND c.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM classrooms c
       WHERE c.id = classroom_student_remarks.classroom_id
         AND c.organization_id = app_current_org()
    )
  );

-- learning_content_sections (parent: learning_contents)
ALTER TABLE learning_content_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS learning_content_sections_tenant_select ON learning_content_sections;
CREATE POLICY learning_content_sections_tenant_select ON learning_content_sections FOR SELECT
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM learning_contents lc
       WHERE lc.id = learning_content_sections.content_id
         AND (lc.organization_id = app_current_org() OR lc.is_global = true)
    )
  );
DROP POLICY IF EXISTS learning_content_sections_tenant_modify ON learning_content_sections;
CREATE POLICY learning_content_sections_tenant_modify ON learning_content_sections FOR ALL
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM learning_contents lc
       WHERE lc.id = learning_content_sections.content_id
         AND lc.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM learning_contents lc
       WHERE lc.id = learning_content_sections.content_id
         AND lc.organization_id = app_current_org()
    )
  );

-- topic_content_assignments (parent: content_topics)
ALTER TABLE topic_content_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS topic_content_assignments_tenant_select ON topic_content_assignments;
CREATE POLICY topic_content_assignments_tenant_select ON topic_content_assignments FOR SELECT
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM content_topics t
       WHERE t.id = topic_content_assignments.topic_id
         AND (t.organization_id = app_current_org() OR t.is_global = true)
    )
  );
DROP POLICY IF EXISTS topic_content_assignments_tenant_modify ON topic_content_assignments;
CREATE POLICY topic_content_assignments_tenant_modify ON topic_content_assignments FOR ALL
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM content_topics t
       WHERE t.id = topic_content_assignments.topic_id
         AND t.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM content_topics t
       WHERE t.id = topic_content_assignments.topic_id
         AND t.organization_id = app_current_org()
    )
  );

-- topic_content_sections (parent: content_topics)
ALTER TABLE topic_content_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS topic_content_sections_tenant_select ON topic_content_sections;
CREATE POLICY topic_content_sections_tenant_select ON topic_content_sections FOR SELECT
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM content_topics t
       WHERE t.id = topic_content_sections.topic_id
         AND (t.organization_id = app_current_org() OR t.is_global = true)
    )
  );
DROP POLICY IF EXISTS topic_content_sections_tenant_modify ON topic_content_sections;
CREATE POLICY topic_content_sections_tenant_modify ON topic_content_sections FOR ALL
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM content_topics t
       WHERE t.id = topic_content_sections.topic_id
         AND t.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM content_topics t
       WHERE t.id = topic_content_sections.topic_id
         AND t.organization_id = app_current_org()
    )
  );

-- quiz_questions (parent: quizzes)
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quiz_questions_tenant_select ON quiz_questions;
CREATE POLICY quiz_questions_tenant_select ON quiz_questions FOR SELECT
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM quizzes q
       WHERE q.id = quiz_questions.quiz_id
         AND (q.organization_id = app_current_org() OR q.is_global = true)
    )
  );
DROP POLICY IF EXISTS quiz_questions_tenant_modify ON quiz_questions;
CREATE POLICY quiz_questions_tenant_modify ON quiz_questions FOR ALL
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM quizzes q
       WHERE q.id = quiz_questions.quiz_id
         AND q.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM quizzes q
       WHERE q.id = quiz_questions.quiz_id
         AND q.organization_id = app_current_org()
    )
  );

-- student_attempts (parent: quizzes)
ALTER TABLE student_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS student_attempts_tenant_select ON student_attempts;
CREATE POLICY student_attempts_tenant_select ON student_attempts FOR SELECT
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM quizzes q
       WHERE q.id = student_attempts.quiz_id
         AND (q.organization_id = app_current_org() OR q.is_global = true)
    )
  );
DROP POLICY IF EXISTS student_attempts_tenant_modify ON student_attempts;
CREATE POLICY student_attempts_tenant_modify ON student_attempts FOR ALL
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM quizzes q
       WHERE q.id = student_attempts.quiz_id
         AND (q.organization_id = app_current_org() OR q.is_global = true)
    )
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM quizzes q
       WHERE q.id = student_attempts.quiz_id
         AND (q.organization_id = app_current_org() OR q.is_global = true)
    )
  );

-- question_attempts (parent: student_attempts → quizzes)
ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS question_attempts_tenant_select ON question_attempts;
CREATE POLICY question_attempts_tenant_select ON question_attempts FOR SELECT
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM student_attempts sa
        JOIN quizzes q ON q.id = sa.quiz_id
       WHERE sa.id = question_attempts.attempt_id
         AND (q.organization_id = app_current_org() OR q.is_global = true)
    )
  );
DROP POLICY IF EXISTS question_attempts_tenant_modify ON question_attempts;
CREATE POLICY question_attempts_tenant_modify ON question_attempts FOR ALL
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM student_attempts sa
        JOIN quizzes q ON q.id = sa.quiz_id
       WHERE sa.id = question_attempts.attempt_id
         AND (q.organization_id = app_current_org() OR q.is_global = true)
    )
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM student_attempts sa
        JOIN quizzes q ON q.id = sa.quiz_id
       WHERE sa.id = question_attempts.attempt_id
         AND (q.organization_id = app_current_org() OR q.is_global = true)
    )
  );

-- subject_aliases (parent: subjects)
ALTER TABLE subject_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subject_aliases_tenant_select ON subject_aliases;
CREATE POLICY subject_aliases_tenant_select ON subject_aliases FOR SELECT
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM subjects s
       WHERE s.id = subject_aliases.subject_id
         AND s.organization_id = app_current_org()
    )
  );
DROP POLICY IF EXISTS subject_aliases_tenant_modify ON subject_aliases;
CREATE POLICY subject_aliases_tenant_modify ON subject_aliases FOR ALL
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM subjects s
       WHERE s.id = subject_aliases.subject_id
         AND s.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM subjects s
       WHERE s.id = subject_aliases.subject_id
         AND s.organization_id = app_current_org()
    )
  );

-- story_progress (parent: stories)
ALTER TABLE story_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS story_progress_tenant_select ON story_progress;
CREATE POLICY story_progress_tenant_select ON story_progress FOR SELECT
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM stories s
       WHERE s.id = story_progress.story_id
         AND s.organization_id = app_current_org()
    )
  );
DROP POLICY IF EXISTS story_progress_tenant_modify ON story_progress;
CREATE POLICY story_progress_tenant_modify ON story_progress FOR ALL
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM stories s
       WHERE s.id = story_progress.story_id
         AND s.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM stories s
       WHERE s.id = story_progress.story_id
         AND s.organization_id = app_current_org()
    )
  );

-- story_sections (parent: stories)
ALTER TABLE story_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS story_sections_tenant_select ON story_sections;
CREATE POLICY story_sections_tenant_select ON story_sections FOR SELECT
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM stories s
       WHERE s.id = story_sections.story_id
         AND s.organization_id = app_current_org()
    )
  );
DROP POLICY IF EXISTS story_sections_tenant_modify ON story_sections;
CREATE POLICY story_sections_tenant_modify ON story_sections FOR ALL
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM stories s
       WHERE s.id = story_sections.story_id
         AND s.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM stories s
       WHERE s.id = story_sections.story_id
         AND s.organization_id = app_current_org()
    )
  );

-- student_achievements (parent: achievements)
ALTER TABLE student_achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS student_achievements_tenant_select ON student_achievements;
CREATE POLICY student_achievements_tenant_select ON student_achievements FOR SELECT
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM achievements a
       WHERE a.id = student_achievements.achievement_id
         AND a.organization_id = app_current_org()
    )
  );
DROP POLICY IF EXISTS student_achievements_tenant_modify ON student_achievements;
CREATE POLICY student_achievements_tenant_modify ON student_achievements FOR ALL
  USING (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM achievements a
       WHERE a.id = student_achievements.achievement_id
         AND a.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_current_org() IS NULL
    OR EXISTS (
      SELECT 1 FROM achievements a
       WHERE a.id = student_achievements.achievement_id
         AND a.organization_id = app_current_org()
    )
  );

COMMIT;
