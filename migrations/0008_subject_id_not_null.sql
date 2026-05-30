-- Migration 0008 — Lock subject_id to NOT NULL on the four backfilled tables.
--
-- Migration 0002 added `subject_id` as a nullable FK and backfilled every
-- existing row. Audit run before this migration confirmed 0 NULLs across
-- all four tables. Locking the column NOT NULL closes the door on future
-- writes that forget to set subject_id.

BEGIN;

-- Defensive guard — fail loudly if any NULL slipped in between 0002 and now.
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT COUNT(*) INTO cnt FROM (
    SELECT 1 FROM content_topics             WHERE subject_id IS NULL
    UNION ALL
    SELECT 1 FROM learning_contents          WHERE subject_id IS NULL
    UNION ALL
    SELECT 1 FROM quizzes                    WHERE subject_id IS NULL
    UNION ALL
    SELECT 1 FROM teacher_standard_subjects  WHERE subject_id IS NULL
  ) t;
  IF cnt > 0 THEN
    RAISE EXCEPTION 'Cannot apply NOT NULL: % rows still have NULL subject_id. Re-run backfill from 0002.', cnt;
  END IF;
END $$;

ALTER TABLE content_topics            ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE learning_contents         ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE quizzes                   ALTER COLUMN subject_id SET NOT NULL;
ALTER TABLE teacher_standard_subjects ALTER COLUMN subject_id SET NOT NULL;

COMMIT;
