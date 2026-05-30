-- Migration 0007 — Use the word "content" (not "lesson") and "class"
-- (not "classroom") for the canonical view names. This supersedes the
-- name choices made in migration 0006.
--
-- Rationale: the codebase, the UI, and the seed data all consistently use
-- "content" for the reusable learning item type. Introducing "lesson" as a
-- new word would have caused fresh confusion. The cleaner choice is to
-- standardise on `content`. Likewise `class` instead of `classroom` matches
-- the UI labels and shortens long view names.

BEGIN;

-- ── Drop the lesson-named views from migration 0006 ──────────────────────
DROP VIEW IF EXISTS v_lessons             CASCADE;
DROP VIEW IF EXISTS v_lesson_sections     CASCADE;
DROP VIEW IF EXISTS v_topic_lessons       CASCADE;
DROP VIEW IF EXISTS v_topic_inline_sections CASCADE;
DROP VIEW IF EXISTS v_classroom_lessons   CASCADE;
DROP VIEW IF EXISTS v_classroom_quizzes   CASCADE;
DROP VIEW IF EXISTS v_classroom_homeworks CASCADE;
DROP VIEW IF EXISTS v_homework_submissions CASCADE;

-- ── v_contents ───────────────────────────────────────────────────────────
-- The reusable learning item (text, video, audio, jigsaw, multi-section
-- container, etc). One content can be referenced by many topics and many
-- classrooms.
CREATE OR REPLACE VIEW v_contents AS
SELECT
  lc.id              AS content_id,
  lc.organization_id,
  lc.class_level,
  lc.subject_id,
  s.title            AS subject_title,
  lc.subject         AS subject_text_legacy,
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

-- ── v_content_sections ───────────────────────────────────────────────────
-- Ordered sections of a reusable content item.
CREATE OR REPLACE VIEW v_content_sections AS
SELECT
  lcs.id            AS section_id,
  lcs.content_id,
  lcs.section_order,
  lcs.title,
  lcs.content_type,
  lcs.media_url,
  lcs.external_url,
  lcs.text_content,
  lcs.quiz_id,
  lcs.created_at,
  lcs.updated_at
FROM learning_content_sections lcs;

-- ── v_topic_contents ─────────────────────────────────────────────────────
-- The topic ↔ content bridge (m:n). Confusingly stored in a table named
-- `topic_content_assignments` — that name implied homework. The bridge has
-- nothing to do with homework: it's a sort-ordered link between topics and
-- their constituent content items.
CREATE OR REPLACE VIEW v_topic_contents AS
SELECT
  tca.id          AS link_id,
  tca.topic_id,
  tca.content_id,
  tca.sort_order,
  tca.created_at
FROM topic_content_assignments tca;

-- ── v_topic_sections ─────────────────────────────────────────────────────
-- Sections that live INLINE on a topic (i.e. the topic itself acts as a
-- single content). Underlying table is `topic_content_sections`. Distinct
-- from `v_content_sections` because these sections are not part of any
-- reusable content item.
CREATE OR REPLACE VIEW v_topic_sections AS
SELECT
  tcs.id            AS section_id,
  tcs.topic_id,
  tcs.section_order,
  tcs.title,
  tcs.content_type,
  tcs.media_url,
  tcs.external_url,
  tcs.text_content,
  tcs.created_at,
  tcs.updated_at
FROM topic_content_sections tcs;

-- ── v_content_quiz ───────────────────────────────────────────────────────
-- A quiz that is embedded inside a content section. The link is via
-- `learning_content_sections.quiz_id` — when present, this section
-- functions as a quiz section instead of media/text.
CREATE OR REPLACE VIEW v_content_quiz AS
SELECT
  lcs.content_id,
  lc.title         AS content_title,
  lcs.id           AS section_id,
  lcs.section_order,
  lcs.title        AS section_title,
  lcs.quiz_id,
  q.title          AS quiz_title,
  q.total_questions
FROM learning_content_sections lcs
JOIN learning_contents lc ON lc.id = lcs.content_id
JOIN quizzes q            ON q.id = lcs.quiz_id
WHERE lcs.quiz_id IS NOT NULL;

-- ── v_class_contents ─────────────────────────────────────────────────────
-- Contents assigned to a classroom (table: `classroom_contents`).
CREATE OR REPLACE VIEW v_class_contents AS
SELECT
  cc.id           AS link_id,
  cc.classroom_id AS class_id,
  cc.content_id,
  cc.sort_order,
  cc.created_at
FROM classroom_contents cc;

-- ── v_class_quizzes ──────────────────────────────────────────────────────
-- Quizzes assigned to a classroom (table: `classroom_quizzes`).
CREATE OR REPLACE VIEW v_class_quizzes AS
SELECT
  cq.id           AS link_id,
  cq.classroom_id AS class_id,
  cq.quiz_id,
  cq.sort_order,
  cq.created_at
FROM classroom_quizzes cq;

-- ── v_class_assignments ──────────────────────────────────────────────────
-- Homework / assignments given to a classroom (table:
-- `classroom_assignments`). Keep the original word "assignment" because
-- that's what the UI calls it.
CREATE OR REPLACE VIEW v_class_assignments AS
SELECT
  ca.id              AS assignment_id,
  ca.classroom_id    AS class_id,
  ca.title,
  ca.description,
  ca.attachment_url,
  ca.instructions,
  ca.due_date,
  ca.is_time_bound,
  ca.created_at,
  ca.updated_at
FROM classroom_assignments ca;

-- ── v_student_class_assignment_submissions ───────────────────────────────
-- Student submissions for a class assignment (table:
-- `classroom_assignment_submissions`).
CREATE OR REPLACE VIEW v_student_class_assignment_submissions AS
SELECT
  cas.id                          AS submission_id,
  cas.classroom_assignment_id     AS assignment_id,
  cas.student_id,
  cas.submission_text,
  cas.attachment_url,
  cas.submitted_at,
  cas.updated_at
FROM classroom_assignment_submissions cas;

COMMIT;
