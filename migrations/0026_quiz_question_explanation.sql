-- Migration 0026 — Per-question solution explanation.
--
-- Adds a free-text `explanation` column to quiz_questions so a teacher can
-- describe why the correct answer is correct. When present, the student player
-- can surface it (either after each question or at the end of the quiz — the
-- display mode lives in quizzes.theme.settings.explanationMode, no schema
-- change required for that).
--
-- Conventions (matching the rest of /migrations):
--   • IF NOT EXISTS so this is safe to re-apply.

BEGIN;

ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS explanation TEXT;

COMMIT;
