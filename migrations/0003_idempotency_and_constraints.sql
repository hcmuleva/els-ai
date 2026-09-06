-- Migration 0003 — Idempotency & data-integrity constraints
--
-- 1. student_attempts: add optional idempotency_key + partial UNIQUE so a
--    retried POST /quizzes/attempts collapses onto the same row instead of
--    creating duplicate attempts (we already see one such row in prod data).
-- 2. classroom_contents / classroom_quizzes mutual-exclusion isn't needed
--    because the schema correctly split them into two tables. Skip.
-- 3. Add CHECK on classrooms.class_level so 'ANY' or '' are explicit, and
--    sane bounds on score/total_points.

BEGIN;

-- ── Student attempts idempotency ─────────────────────────────────────────
ALTER TABLE student_attempts
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64);

-- Clean up the existing duplicate from the audit (keep oldest row).
DELETE FROM student_attempts sa
 USING (
   SELECT MIN(completed_at) AS keep_at, student_id, quiz_id
     FROM student_attempts
    GROUP BY student_id, quiz_id
   HAVING COUNT(*) > 1
      AND EXTRACT(EPOCH FROM (MAX(completed_at) - MIN(completed_at))) < 60
 ) dup
 WHERE sa.student_id    = dup.student_id
   AND sa.quiz_id       = dup.quiz_id
   AND sa.completed_at != dup.keep_at;

-- Partial unique: only enforced when an idempotency key is supplied. Without
-- a key, the existing "multi-attempt allowed" behaviour is preserved.
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_attempts_idem
  ON student_attempts (student_id, quiz_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── Score / total_points sanity ─────────────────────────────────────────
ALTER TABLE student_attempts
  ADD CONSTRAINT student_attempts_score_nonneg     CHECK (score        >= 0)        NOT VALID,
  ADD CONSTRAINT student_attempts_total_nonneg     CHECK (total_points >= 0)        NOT VALID,
  ADD CONSTRAINT student_attempts_score_lte_total  CHECK (score <= total_points)    NOT VALID;
ALTER TABLE student_attempts VALIDATE CONSTRAINT student_attempts_score_nonneg;
ALTER TABLE student_attempts VALIDATE CONSTRAINT student_attempts_total_nonneg;
ALTER TABLE student_attempts VALIDATE CONSTRAINT student_attempts_score_lte_total;

-- ── Classroom class_level guardrail ─────────────────────────────────────
-- Forbid empty / blank class_level. 'ANY' is explicitly allowed.
ALTER TABLE classrooms
  ADD CONSTRAINT classrooms_class_level_nonblank
  CHECK (class_level <> '' AND char_length(trim(class_level)) > 0)
  NOT VALID;
ALTER TABLE classrooms VALIDATE CONSTRAINT classrooms_class_level_nonblank;

-- ── Subjects sanity ─────────────────────────────────────────────────────
ALTER TABLE subjects
  ADD CONSTRAINT subjects_title_nonblank CHECK (char_length(trim(title)) > 0) NOT VALID;
ALTER TABLE subjects VALIDATE CONSTRAINT subjects_title_nonblank;

COMMIT;
