-- 0020_topic_question_assignments.sql
--
-- Adds an explicit topic ↔ question relation, similar to topic_content_assignments.
-- This enables direct topic-level question mapping even when questions are stored
-- under quizzes.

BEGIN;

CREATE TABLE IF NOT EXISTS topic_question_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES content_topics(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (topic_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_question_assignments_topic
  ON topic_question_assignments(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_question_assignments_quiz
  ON topic_question_assignments(quiz_id);
CREATE INDEX IF NOT EXISTS idx_topic_question_assignments_question
  ON topic_question_assignments(question_id);

ALTER TABLE topic_question_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_question_assignments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS topic_question_assignments_tenant_select ON topic_question_assignments;
DROP POLICY IF EXISTS topic_question_assignments_tenant_modify ON topic_question_assignments;

CREATE POLICY topic_question_assignments_tenant_select ON topic_question_assignments
  FOR SELECT
  USING (
    app_current_org() IS NULL OR EXISTS (
      SELECT 1
      FROM content_topics ct
      WHERE ct.id = topic_question_assignments.topic_id
        AND (ct.organization_id = app_current_org() OR ct.is_global = true)
    )
  );

CREATE POLICY topic_question_assignments_tenant_modify ON topic_question_assignments
  FOR ALL
  USING (
    app_current_org() IS NULL OR EXISTS (
      SELECT 1
      FROM content_topics ct
      WHERE ct.id = topic_question_assignments.topic_id
        AND ct.organization_id = app_current_org()
    )
  )
  WITH CHECK (
    app_current_org() IS NULL OR EXISTS (
      SELECT 1
      FROM content_topics ct
      WHERE ct.id = topic_question_assignments.topic_id
        AND ct.organization_id = app_current_org()
    )
  );

COMMIT;
