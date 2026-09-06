-- Migration 0002 — Promote soft FK on `subject` (text) to hard FK on
-- `subject_id` (UUID REFERENCES subjects(id)). Adds the column nullable so
-- existing INSERTs continue to work, then backfills using the same cross-org
-- lookup the runtime code uses (prefer same-org subjects row, fall back to
-- any-org for `is_global` rows).
--
-- Once the application is updated to write `subject_id` on insert, a follow-up
-- migration will set NOT NULL and eventually drop the legacy `subject` column.

BEGIN;

-- ── 1. Add subject_id columns ─────────────────────────────────────────────
ALTER TABLE content_topics
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE RESTRICT;
ALTER TABLE learning_contents
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE RESTRICT;
ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE RESTRICT;
ALTER TABLE teacher_standard_subjects
  ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE RESTRICT;

-- Indexes on the new FK columns so JOINs are instant.
CREATE INDEX IF NOT EXISTS idx_content_topics_subject_id            ON content_topics (subject_id);
CREATE INDEX IF NOT EXISTS idx_learning_contents_subject_id         ON learning_contents (subject_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_subject_id                   ON quizzes (subject_id);
CREATE INDEX IF NOT EXISTS idx_teacher_standard_subjects_subject_id ON teacher_standard_subjects (subject_id);

-- ── 2. Backfill content_topics.subject_id ─────────────────────────────────
-- Cross-org-preferred match: same-org subject row first, then any-org for
-- global topics. NULL preserved if absolutely no master row matches.
UPDATE content_topics ct
SET subject_id = (
  SELECT s.id
    FROM subjects s
   WHERE s.class_level = ct.class_level
     AND LOWER(s.title) = LOWER(ct.subject)
     AND (s.organization_id = ct.organization_id OR ct.is_global = true)
   ORDER BY (s.organization_id = ct.organization_id) DESC,
            s.updated_at DESC NULLS LAST
   LIMIT 1
)
WHERE subject_id IS NULL
  AND ct.subject IS NOT NULL;

-- ── 3. Backfill learning_contents.subject_id ──────────────────────────────
UPDATE learning_contents lc
SET subject_id = (
  SELECT s.id
    FROM subjects s
   WHERE s.class_level = lc.class_level
     AND LOWER(s.title) = LOWER(lc.subject)
     AND (s.organization_id = lc.organization_id OR lc.is_global = true)
   ORDER BY (s.organization_id = lc.organization_id) DESC,
            s.updated_at DESC NULLS LAST
   LIMIT 1
)
WHERE subject_id IS NULL
  AND lc.subject IS NOT NULL;

-- ── 4. Backfill quizzes.subject_id ────────────────────────────────────────
UPDATE quizzes q
SET subject_id = (
  SELECT s.id
    FROM subjects s
   WHERE s.class_level = q.class_level
     AND LOWER(s.title) = LOWER(q.subject)
     AND (s.organization_id = q.organization_id OR q.is_global = true)
   ORDER BY (s.organization_id = q.organization_id) DESC,
            s.updated_at DESC NULLS LAST
   LIMIT 1
)
WHERE subject_id IS NULL
  AND q.subject IS NOT NULL;

-- ── 5. Backfill teacher_standard_subjects.subject_id ──────────────────────
UPDATE teacher_standard_subjects tss
SET subject_id = (
  SELECT s.id
    FROM subjects s
   WHERE s.class_level = tss.class_level
     AND LOWER(s.title) = LOWER(tss.subject)
     AND s.organization_id = tss.organization_id
   ORDER BY s.updated_at DESC NULLS LAST
   LIMIT 1
)
WHERE subject_id IS NULL
  AND tss.subject IS NOT NULL;

COMMIT;

-- ── Audit (run separately) ────────────────────────────────────────────────
-- SELECT 'content_topics'           AS source, COUNT(*) AS missing FROM content_topics            WHERE subject_id IS NULL AND subject IS NOT NULL
-- UNION ALL SELECT 'learning_contents',         COUNT(*) FROM learning_contents          WHERE subject_id IS NULL AND subject IS NOT NULL
-- UNION ALL SELECT 'quizzes',                   COUNT(*) FROM quizzes                    WHERE subject_id IS NULL AND subject IS NOT NULL
-- UNION ALL SELECT 'teacher_standard_subjects', COUNT(*) FROM teacher_standard_subjects  WHERE subject_id IS NULL AND subject IS NOT NULL;
