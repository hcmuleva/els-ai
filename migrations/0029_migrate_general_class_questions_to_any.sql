-- Migration 0029 — Migrate standalone General class_level questions and extra subjects to ANY class_level.
-- 1. Updates question_data->_meta->classLevel = 'ANY' for questions where classLevel is 'General' or belongs to Extra Activity subjects.
-- 2. Normalizes question_data->_meta->subject = 'Rhymes & Stories' for 'Hindi Stories'.

BEGIN;

CREATE OR REPLACE FUNCTION _migrate_general_class_questions_to_any() RETURNS void AS $$
DECLARE
  extra_subjects TEXT[] := ARRAY[
    'activity / play-based learning',
    'brain training',
    'creativity',
    'dharm',
    'diy & crafts',
    'diy',
    'do you know?',
    'do_you_know',
    'drawing & coloring',
    'experimental learning',
    'extracurricular activities',
    'general awareness',
    'general knowledge',
    'how things work',
    'how_things_works',
    'how to think',
    'how_to_think',
    'iq test',
    'jr. scientist',
    'jr_scientist',
    'logical reasoning',
    'memory development',
    'memory_development',
    'moral values',
    'puzzles & logic',
    'puzzle',
    'rhymes & stories',
    'hindi stories',
    'stories & tales',
    'story',
    'tips and tricks',
    'tips_tricks'
  ];
BEGIN
  -- Update _meta->classLevel to 'ANY' for questions with 'General' classLevel or Extra Activity subjects
  UPDATE quiz_questions
     SET question_data = jsonb_set(
           jsonb_set(
             COALESCE(question_data, '{}'::jsonb),
             ARRAY['_meta', 'classLevel'],
             '"ANY"'::jsonb
           ),
           ARRAY['_meta', 'subject'],
           CASE
             WHEN LOWER(COALESCE(question_data->'_meta'->>'subject', '')) = 'hindi stories' THEN '"Rhymes & Stories"'::jsonb
             WHEN LOWER(COALESCE(question_data->'_meta'->>'subject', '')) = 'dharm' THEN '"Dharm"'::jsonb
             WHEN question_data->'_meta'->>'subject' IS NOT NULL THEN to_jsonb(question_data->'_meta'->>'subject')
             ELSE '"ANY"'::jsonb
           END
         )
   WHERE question_data->'_meta'->>'classLevel' = 'General'
      OR question_data->'_meta'->>'classLevel' = 'ANY'
      OR LOWER(question_data->'_meta'->>'subject') = ANY(extra_subjects);

  -- Merge 'Hindi Stories' in question_data _meta->subject to 'Rhymes & Stories'
  UPDATE quiz_questions
     SET question_data = jsonb_set(COALESCE(question_data, '{}'::jsonb), ARRAY['_meta', 'subject'], '"Rhymes & Stories"'::jsonb)
   WHERE LOWER(COALESCE(question_data->'_meta'->>'subject', '')) = 'hindi stories';
END;
$$ LANGUAGE plpgsql;

SELECT _migrate_general_class_questions_to_any();

DROP FUNCTION _migrate_general_class_questions_to_any();

COMMIT;
