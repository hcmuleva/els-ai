-- Migration 0006 — Canonical VIEWs with sensible names
--
-- The underlying tables have confusing legacy names. Instead of risky table
-- renames, this migration creates VIEWs with the canonical names everyone
-- _wishes_ the tables had. New code can read from the views; old code keeps
-- working against the underlying tables. When the team is ready, a future
-- migration can swap the tables to be renamed and the views to point at them
-- (or be dropped) without touching consumers.
--
-- Naming convention: views are prefixed `v_` so newcomers know they're virtual
-- and so they don't collide with future real tables.

BEGIN;

-- ── v_subjects ─────────────────────────────────────────────────────────
-- 1:1 alias of `subjects` plus alias rows from subject_aliases collapsed
-- into a comma-separated string (handy for display/filter dropdowns).
CREATE OR REPLACE VIEW v_subjects AS
SELECT
  s.id,
  s.organization_id,
  s.class_level,
  s.title,
  s.description,
  s.cover_image,
  s.icon_image,
  s.icon_bg_color,
  s.author,
  s.author_user_id,
  s.is_external_author,
  s.created_at,
  s.updated_at,
  COALESCE(
    (SELECT string_agg(sa.alias, ', ' ORDER BY sa.alias)
       FROM subject_aliases sa
      WHERE sa.subject_id = s.id),
    ''
  ) AS aliases
FROM subjects s;

-- ── v_topics ───────────────────────────────────────────────────────────
-- Renames `content_topics` → `topics` (drops the redundant `content_` prefix)
-- and joins through to the subject for friendly display.
CREATE OR REPLACE VIEW v_topics AS
SELECT
  t.id              AS topic_id,
  t.organization_id,
  t.class_level,
  t.subject_id,
  s.title           AS subject_title,
  t.subject         AS subject_text_legacy,
  t.title           AS topic_title,
  t.cover_image,
  t.is_global,
  t.created_by,
  t.created_at,
  t.updated_at
FROM content_topics t
LEFT JOIN subjects s ON s.id = t.subject_id;

-- ── v_lessons ──────────────────────────────────────────────────────────
-- Renames `learning_contents` → `lessons`. A lesson is a reusable learning
-- item (text, video, audio, jigsaw, etc) that can appear in any number of
-- topics or directly inside a classroom.
CREATE OR REPLACE VIEW v_lessons AS
SELECT
  lc.id              AS lesson_id,
  lc.organization_id,
  lc.class_level,
  lc.subject_id,
  s.title            AS subject_title,
  lc.subject         AS subject_text_legacy,
  lc.title           AS lesson_title,
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

-- ── v_lesson_sections ──────────────────────────────────────────────────
-- Renames `learning_content_sections` → `lesson_sections`.
CREATE OR REPLACE VIEW v_lesson_sections AS
SELECT
  lcs.id            AS section_id,
  lcs.content_id    AS lesson_id,
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

-- ── v_topic_inline_sections ────────────────────────────────────────────
-- Renames the unfortunately-named `topic_content_sections` (which is NOT
-- a link table — it's sections that live INSIDE a topic, not as part of any
-- shared lesson). Naming as `topic_inline_sections` makes the difference
-- with `lesson_sections` obvious.
CREATE OR REPLACE VIEW v_topic_inline_sections AS
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

-- ── v_topic_lessons ────────────────────────────────────────────────────
-- Renames `topic_content_assignments` (a link/join table whose name
-- collides with `classroom_assignments`/homework) to `topic_lessons`.
-- This is the topic ↔ lesson many-to-many bridge.
CREATE OR REPLACE VIEW v_topic_lessons AS
SELECT
  tca.id          AS link_id,
  tca.topic_id,
  tca.content_id  AS lesson_id,
  tca.sort_order,
  tca.created_at
FROM topic_content_assignments tca;

-- ── v_quizzes ──────────────────────────────────────────────────────────
-- Joined view: quiz + its topic + its subject. The single most asked
-- question ("which subject does this quiz belong to") is now one SELECT.
CREATE OR REPLACE VIEW v_quizzes AS
SELECT
  q.id              AS quiz_id,
  q.organization_id,
  q.class_level,
  q.subject_id,
  s.title           AS subject_title,
  q.subject         AS subject_text_legacy,
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

-- ── v_questions ────────────────────────────────────────────────────────
-- Renames `quiz_questions` → `questions`. The current name implies it's a
-- join table, but it's actually the question rows themselves.
CREATE OR REPLACE VIEW v_questions AS
SELECT
  qq.id              AS question_id,
  qq.quiz_id,
  qq.question_type,
  qq.question_title,
  qq.question_instruction,
  qq.question_audio,
  qq.time_limit_seconds,
  qq.points,
  qq.sort_order,
  qq.question_data,
  qq.created_at
FROM quiz_questions qq;

-- ── v_quiz_attempts ────────────────────────────────────────────────────
-- Renames `student_attempts` → `quiz_attempts` (clearer scope) and joins
-- through to the quiz/student for friendly reporting.
CREATE OR REPLACE VIEW v_quiz_attempts AS
SELECT
  sa.id                AS attempt_id,
  sa.student_id,
  sa.quiz_id,
  q.title              AS quiz_title,
  q.organization_id    AS quiz_organization_id,
  sa.score,
  sa.total_points,
  CASE WHEN sa.total_points > 0
       THEN ROUND(sa.score::numeric / sa.total_points * 100)
       ELSE 0 END      AS score_pct,
  sa.completed_at,
  sa.idempotency_key
FROM student_attempts sa
LEFT JOIN quizzes q ON q.id = sa.quiz_id;

-- ── v_question_responses ───────────────────────────────────────────────
-- Renames `question_attempts` → `question_responses` (an attempt isn't a
-- thing a student does to a question; a response is).
CREATE OR REPLACE VIEW v_question_responses AS
SELECT
  qa.id                AS response_id,
  qa.attempt_id,
  qa.question_id,
  qa.is_correct,
  qa.response_data,
  qa.time_spent_seconds
FROM question_attempts qa;

-- ── v_classroom_lessons / v_classroom_quizzes / v_classroom_homeworks ──
-- Renames the classroom-side tables to friendlier names.
CREATE OR REPLACE VIEW v_classroom_lessons AS
SELECT
  cc.id           AS link_id,
  cc.classroom_id,
  cc.content_id   AS lesson_id,
  cc.sort_order,
  cc.created_at
FROM classroom_contents cc;

CREATE OR REPLACE VIEW v_classroom_quizzes AS
SELECT
  cq.id           AS link_id,
  cq.classroom_id,
  cq.quiz_id,
  cq.sort_order,
  cq.created_at
FROM classroom_quizzes cq;

CREATE OR REPLACE VIEW v_classroom_homeworks AS
SELECT
  ca.id              AS homework_id,
  ca.classroom_id,
  ca.title,
  ca.description,
  ca.attachment_url,
  ca.instructions,
  ca.due_date,
  ca.is_time_bound,
  ca.created_at,
  ca.updated_at
FROM classroom_assignments ca;

CREATE OR REPLACE VIEW v_homework_submissions AS
SELECT
  cas.id                          AS submission_id,
  cas.classroom_assignment_id     AS homework_id,
  cas.student_id,
  cas.submission_text,
  cas.attachment_url,
  cas.submitted_at,
  cas.updated_at
FROM classroom_assignment_submissions cas;

COMMIT;

-- After this migration, a newcomer wondering "where is the subject ↔ topic
-- relation" can simply run:
--   SELECT * FROM v_topics WHERE class_level = 'LKG';
-- and see subject_title alongside topic_title without learning the legacy
-- table names or the soft-FK quirks.
