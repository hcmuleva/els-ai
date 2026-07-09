-- Migration 0024 — Allow the same quiz to be attached to multiple video sections.
--
-- The original design enforced one-quiz-per-section via UNIQUE (quiz_id). That
-- restriction is removed: a quiz can now be reused across several sections.
-- Safe to re-apply.

BEGIN;

ALTER TABLE video_sections
  DROP CONSTRAINT IF EXISTS video_sections_quiz_unique;

-- Non-unique index still helps quiz lookups.
CREATE INDEX IF NOT EXISTS idx_video_sections_quiz
  ON video_sections(quiz_id);

COMMIT;
