-- Migration 0028 — Update quizzes, content_topics, learning_contents, teacher assignments, and quiz_questions class_level to ANY for all Extra Activity subjects.
-- 1. Merges 'Hindi Stories' into 'Rhymes & Stories' (class_level = 'ANY').
-- 2. Consolidates 'Moral Values' into class_level = 'ANY'.
-- 3. Updates quizzes.class_level = 'ANY' for all quizzes linked to ANY subjects.
-- 4. Updates content_topics.class_level = 'ANY' for all topics linked to ANY subjects.
-- 5. Updates learning_contents.class_level = 'ANY' for all content items linked to ANY subjects.
-- 6. Updates teacher_standard_subjects.class_level = 'ANY' for all teacher assignments linked to ANY subjects.
-- 7. Updates question_data->_meta->classLevel = 'ANY' for all questions belonging to ANY quizzes.

BEGIN;

CREATE OR REPLACE FUNCTION _migrate_quizzes_and_questions_to_any() RETURNS void AS $$
DECLARE
  rhymes_any_id UUID;
  mv_any_id UUID;
  old_ids UUID[];
BEGIN
  -- 1. Consolidate 'Hindi Stories' -> 'Rhymes & Stories' (ANY)
  SELECT id INTO rhymes_any_id FROM subjects WHERE class_level = 'ANY' AND title = 'Rhymes & Stories' LIMIT 1;
  IF rhymes_any_id IS NOT NULL THEN
    SELECT ARRAY_AGG(id) INTO old_ids FROM subjects WHERE title = 'Hindi Stories';
    IF old_ids IS NOT NULL AND ARRAY_LENGTH(old_ids, 1) > 0 THEN
      UPDATE content_topics SET subject_id = rhymes_any_id, class_level = 'ANY' WHERE subject_id = ANY(old_ids);
      UPDATE learning_contents SET subject_id = rhymes_any_id, class_level = 'ANY' WHERE subject_id = ANY(old_ids);
      UPDATE quizzes SET subject_id = rhymes_any_id, class_level = 'ANY' WHERE subject_id = ANY(old_ids);
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teacher_standard_subjects') THEN
        EXECUTE 'UPDATE teacher_standard_subjects SET subject_id = $1, class_level = ''ANY'' WHERE subject_id = ANY($2)' USING rhymes_any_id, old_ids;
      END IF;
      DELETE FROM subjects WHERE id = ANY(old_ids);
    END IF;
  END IF;

  -- 2. Consolidate 'Moral Values' -> ANY
  SELECT id INTO mv_any_id FROM subjects WHERE class_level = 'ANY' AND title = 'Moral Values' LIMIT 1;
  IF mv_any_id IS NULL THEN
    SELECT id INTO mv_any_id FROM subjects WHERE title = 'Moral Values' LIMIT 1;
    IF mv_any_id IS NOT NULL THEN
      UPDATE subjects SET class_level = 'ANY' WHERE id = mv_any_id;
    END IF;
  END IF;
  IF mv_any_id IS NOT NULL THEN
    SELECT ARRAY_AGG(id) INTO old_ids FROM subjects WHERE title = 'Moral Values' AND id <> mv_any_id;
    IF old_ids IS NOT NULL AND ARRAY_LENGTH(old_ids, 1) > 0 THEN
      UPDATE content_topics SET subject_id = mv_any_id, class_level = 'ANY' WHERE subject_id = ANY(old_ids);
      UPDATE learning_contents SET subject_id = mv_any_id, class_level = 'ANY' WHERE subject_id = ANY(old_ids);
      UPDATE quizzes SET subject_id = mv_any_id, class_level = 'ANY' WHERE subject_id = ANY(old_ids);
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teacher_standard_subjects') THEN
        EXECUTE 'UPDATE teacher_standard_subjects SET subject_id = $1, class_level = ''ANY'' WHERE subject_id = ANY($2)' USING mv_any_id, old_ids;
      END IF;
      DELETE FROM subjects WHERE id = ANY(old_ids);
    END IF;
  END IF;

  -- 3. Update quizzes.class_level = 'ANY' for ALL quizzes linked to ANY subjects
  UPDATE quizzes q
     SET class_level = 'ANY', updated_at = NOW()
    FROM subjects s
   WHERE s.id = q.subject_id
     AND s.class_level = 'ANY'
     AND q.class_level <> 'ANY';

  -- 4. Update content_topics.class_level = 'ANY' for ALL topics linked to ANY subjects
  UPDATE content_topics ct
     SET class_level = 'ANY', updated_at = NOW()
    FROM subjects s
   WHERE s.id = ct.subject_id
     AND s.class_level = 'ANY'
     AND ct.class_level <> 'ANY';

  -- 5. Update learning_contents.class_level = 'ANY' for ALL content items linked to ANY subjects
  UPDATE learning_contents lc
     SET class_level = 'ANY', updated_at = NOW()
    FROM subjects s
   WHERE s.id = lc.subject_id
     AND s.class_level = 'ANY'
     AND lc.class_level <> 'ANY';

  -- 6. Update question_data -> _meta -> classLevel to 'ANY' for quiz_questions of ANY quizzes
  UPDATE quiz_questions qq
     SET question_data = jsonb_set(COALESCE(question_data, '{}'::jsonb), ARRAY['_meta', 'classLevel'], '"ANY"'::jsonb)
    FROM quizzes q
    JOIN subjects s ON s.id = q.subject_id
   WHERE q.id = qq.quiz_id
     AND s.class_level = 'ANY';

END;
$$ LANGUAGE plpgsql;

SELECT _migrate_quizzes_and_questions_to_any();

DROP FUNCTION _migrate_quizzes_and_questions_to_any();

COMMIT;
