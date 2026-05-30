-- Migration 0014 — Make the legacy `subject` text column on
-- content_topics, learning_contents, quizzes, teacher_standard_subjects a
-- pure function of `subject_id`.
--
-- Why: SCHEMA_REVIEW.md §3.1 / §10.4 / §A documented an entire class of
-- tenant-data-drift bugs that came from these two columns being kept
-- "loosely in sync" by application code (e.g. GK vs General Knowledge,
-- EVS vs Environmental Studies, Stories vs Rhymes & Stories). Now that
-- `subject_id` is 100 % populated and zero drift exists, we make the
-- text column impossible to drift from `subjects.title`.
--
-- Implementation:
--   * `subject_id` remains the source of truth.
--   * A BEFORE INSERT / BEFORE UPDATE trigger on each of the 4 tables
--     overwrites NEW.subject with `subjects.title` whenever
--     NEW.subject_id is set. If a caller passes the column at all (legacy
--     INSERTs) it is silently corrected. If a caller leaves it null we
--     fill it for them.
--   * If `subject_id` is NULL (only legitimate for legacy data we haven't
--     touched), the trigger is a no-op so nothing breaks.
--
-- After this migration:
--   * No service code change required — every existing read/write keeps
--     working.
--   * Drifting `subject` from `subjects.title` is now a hard impossibility
--     at the database level.
--   * A future PR can drop the column entirely once every reader has been
--     migrated to JOIN `subject_id → subjects.title`.

BEGIN;

-- ── 1. Backfill (no-op today, defensive for any future-applied DB) ─────
UPDATE content_topics ct
   SET subject = s.title
  FROM subjects s
 WHERE s.id = ct.subject_id
   AND ct.subject IS DISTINCT FROM s.title;

UPDATE learning_contents lc
   SET subject = s.title
  FROM subjects s
 WHERE s.id = lc.subject_id
   AND lc.subject IS DISTINCT FROM s.title;

UPDATE quizzes q
   SET subject = s.title
  FROM subjects s
 WHERE s.id = q.subject_id
   AND q.subject IS DISTINCT FROM s.title;

UPDATE teacher_standard_subjects t
   SET subject = s.title
  FROM subjects s
 WHERE s.id = t.subject_id
   AND t.subject IS DISTINCT FROM s.title;

-- ── 2. Trigger function ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION subject_text_from_subject_id()
RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
BEGIN
  IF NEW.subject_id IS NULL THEN
    RETURN NEW;  -- legacy/incomplete row; leave caller's value alone
  END IF;
  SELECT title INTO v_title FROM subjects WHERE id = NEW.subject_id;
  IF v_title IS NOT NULL THEN
    NEW.subject := v_title;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 3. Attach trigger to each table ────────────────────────────────────
DROP TRIGGER IF EXISTS trg_content_topics_subject_sync           ON content_topics;
DROP TRIGGER IF EXISTS trg_learning_contents_subject_sync        ON learning_contents;
DROP TRIGGER IF EXISTS trg_quizzes_subject_sync                  ON quizzes;
DROP TRIGGER IF EXISTS trg_teacher_standard_subjects_subject_sync ON teacher_standard_subjects;

CREATE TRIGGER trg_content_topics_subject_sync
  BEFORE INSERT OR UPDATE OF subject, subject_id ON content_topics
  FOR EACH ROW EXECUTE FUNCTION subject_text_from_subject_id();

CREATE TRIGGER trg_learning_contents_subject_sync
  BEFORE INSERT OR UPDATE OF subject, subject_id ON learning_contents
  FOR EACH ROW EXECUTE FUNCTION subject_text_from_subject_id();

CREATE TRIGGER trg_quizzes_subject_sync
  BEFORE INSERT OR UPDATE OF subject, subject_id ON quizzes
  FOR EACH ROW EXECUTE FUNCTION subject_text_from_subject_id();

CREATE TRIGGER trg_teacher_standard_subjects_subject_sync
  BEFORE INSERT OR UPDATE OF subject, subject_id ON teacher_standard_subjects
  FOR EACH ROW EXECUTE FUNCTION subject_text_from_subject_id();

COMMIT;

-- ── 4. Verification (informational only) ───────────────────────────────
-- After migration, drift should remain zero forever. Re-run the queries:
--   SELECT count(*) FROM content_topics    ct LEFT JOIN subjects s ON s.id=ct.subject_id WHERE ct.subject IS DISTINCT FROM s.title;
--   SELECT count(*) FROM learning_contents lc LEFT JOIN subjects s ON s.id=lc.subject_id WHERE lc.subject IS DISTINCT FROM s.title;
--   SELECT count(*) FROM quizzes           q  LEFT JOIN subjects s ON s.id=q.subject_id  WHERE q.subject IS DISTINCT FROM s.title;
--   SELECT count(*) FROM teacher_standard_subjects t LEFT JOIN subjects s ON s.id=t.subject_id WHERE t.subject IS DISTINCT FROM s.title;
-- All four should return 0.
