-- Migration 0015 — Physically drop the legacy `subject` text column
-- from the four tables that historically denormalized subjects.title.
--
-- Prerequisites (already in place):
--   * `subject_id` is 100% populated on content_topics, learning_contents,
--     quizzes, teacher_standard_subjects.
--   * Every backend service has been refactored (this PR) to read the
--     subject name from `subjects.title` via JOIN and to write only
--     `subject_id`, never the legacy text column.
--   * Migration 0014 installed BEFORE INSERT/UPDATE triggers that auto-
--     derived `subject` from `subject_id`. Those triggers are no longer
--     useful once the column itself disappears, so we drop them too.
--
-- This migration is the final step of the subject_id-as-truth rollout.

BEGIN;

-- ── 1. Drop the auto-derive triggers from migration 0014 ──────────────
DROP TRIGGER IF EXISTS trg_content_topics_subject_sync           ON content_topics;
DROP TRIGGER IF EXISTS trg_learning_contents_subject_sync        ON learning_contents;
DROP TRIGGER IF EXISTS trg_quizzes_subject_sync                  ON quizzes;
DROP TRIGGER IF EXISTS trg_teacher_standard_subjects_subject_sync ON teacher_standard_subjects;
DROP FUNCTION IF EXISTS subject_text_from_subject_id();

-- ── 1b. Drop dependent views that reference the legacy column ─────────
-- Defined by migrations 0006 / 0007 with `<table>.subject AS subject_text_legacy`.
-- We recreate them below without the legacy alias since `subjects.title`
-- via subject_id is now the only canonical source.
DROP VIEW IF EXISTS v_topics;
DROP VIEW IF EXISTS v_contents;
DROP VIEW IF EXISTS v_quizzes;

-- ── 2. Migrate the unique constraint on teacher_standard_subjects ─────
-- The legacy constraint used the text column. Replace it with the
-- subject_id-based constraint that the application UPSERT now relies on.
ALTER TABLE teacher_standard_subjects
  DROP CONSTRAINT IF EXISTS teacher_standard_subjects_teacher_user_id_organization_id_c_key;

ALTER TABLE teacher_standard_subjects
  ADD CONSTRAINT teacher_standard_subjects_teacher_org_class_subject_id_key
    UNIQUE (teacher_user_id, organization_id, class_level, subject_id);

-- ── 3. Migrate the unique constraint on content_topics ────────────────
-- Old: (organization_id, class_level, subject_text, title) — stale.
-- New: (organization_id, class_level, subject_id,   title).
ALTER TABLE content_topics
  DROP CONSTRAINT IF EXISTS content_topics_organization_id_class_level_subject_title_key;

ALTER TABLE content_topics
  ADD CONSTRAINT content_topics_org_class_subject_id_title_key
    UNIQUE (organization_id, class_level, subject_id, title);

-- ── 4. Drop the column itself from all four tables ───────────────────
ALTER TABLE content_topics            DROP COLUMN IF EXISTS subject;
ALTER TABLE learning_contents         DROP COLUMN IF EXISTS subject;
ALTER TABLE quizzes                   DROP COLUMN IF EXISTS subject;
ALTER TABLE teacher_standard_subjects DROP COLUMN IF EXISTS subject;

-- ── 5. Recreate views without the legacy column ──────────────────────
CREATE VIEW v_topics AS
SELECT
  t.id              AS topic_id,
  t.organization_id,
  t.class_level,
  t.subject_id,
  s.title           AS subject_title,
  t.title           AS topic_title,
  t.cover_image,
  t.is_global,
  t.created_by,
  t.created_at,
  t.updated_at
FROM content_topics t
LEFT JOIN subjects s ON s.id = t.subject_id;

CREATE VIEW v_contents AS
SELECT
  lc.id              AS content_id,
  lc.organization_id,
  lc.class_level,
  lc.subject_id,
  s.title            AS subject_title,
  lc.title           AS content_title,
  lc.content_type,
  lc.media_url,
  lc.external_url,
  lc.text_content,
  lc.is_global,
  lc.created_by,
  lc.created_at,
  lc.updated_at
FROM learning_contents lc
LEFT JOIN subjects s ON s.id = lc.subject_id;

CREATE VIEW v_quizzes AS
SELECT
  q.id              AS quiz_id,
  q.organization_id,
  q.class_level,
  q.subject_id,
  s.title           AS subject_title,
  q.topic_id,
  t.title           AS topic_title,
  q.title           AS quiz_title,
  q.description,
  q.thumbnail_image,
  q.quiz_type,
  q.kind,
  q.difficulty_level,
  q.background_music_url,
  q.theme,
  q.total_questions,
  q.is_published,
  q.is_ai_generated,
  q.is_global,
  q.created_by,
  q.created_at,
  q.updated_at
FROM quizzes q
LEFT JOIN subjects       s ON s.id = q.subject_id
LEFT JOIN content_topics t ON t.id = q.topic_id;

COMMIT;
