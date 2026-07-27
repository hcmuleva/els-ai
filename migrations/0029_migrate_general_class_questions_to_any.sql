-- Migration 0029 — Migrate standalone General class_level questions and extra subjects to ANY class_level.
-- 1. Updates question_data->_meta->classLevel = 'ANY' for questions where classLevel is 'General' or belongs to Extra Activity subjects.
-- 2. Normalizes question_data->_meta->subject to canonical subject titles and backfills missing/ANY subjects from `subjects.title`.

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
  -- 1. Update _meta->classLevel to 'ANY' for questions with 'General' classLevel or Extra Activity subjects
  UPDATE quiz_questions
     SET question_data = jsonb_set(
           COALESCE(question_data, '{}'::jsonb),
           ARRAY['_meta', 'classLevel'],
           '"ANY"'::jsonb
         )
   WHERE question_data->'_meta'->>'classLevel' = 'General'
      OR question_data->'_meta'->>'classLevel' = 'ANY'
      OR LOWER(question_data->'_meta'->>'subject') = ANY(extra_subjects);

  -- 2. Normalize raw/legacy subject titles in question_data _meta->subject
  UPDATE quiz_questions
     SET question_data = jsonb_set(
           COALESCE(question_data, '{}'::jsonb),
           ARRAY['_meta', 'subject'],
           CASE
             WHEN LOWER(COALESCE(question_data->'_meta'->>'subject', '')) IN ('hindi stories', 'hindi_stories') THEN '"Rhymes & Stories"'::jsonb
             WHEN LOWER(COALESCE(question_data->'_meta'->>'subject', '')) IN ('do_you_know', 'do you know?') THEN '"Do You Know?"'::jsonb
             WHEN LOWER(COALESCE(question_data->'_meta'->>'subject', '')) IN ('jr_scientist', 'jr. scientist') THEN '"Jr. Scientist"'::jsonb
             WHEN LOWER(COALESCE(question_data->'_meta'->>'subject', '')) IN ('tips_tricks', 'tips and tricks') THEN '"Tips and Tricks"'::jsonb
             WHEN LOWER(COALESCE(question_data->'_meta'->>'subject', '')) IN ('how_things_works', 'how things work') THEN '"How Things Work"'::jsonb
             WHEN LOWER(COALESCE(question_data->'_meta'->>'subject', '')) IN ('how_to_think', 'how to think') THEN '"How to Think"'::jsonb
             WHEN LOWER(COALESCE(question_data->'_meta'->>'subject', '')) IN ('memory_development', 'memory development') THEN '"Memory Development"'::jsonb
             WHEN LOWER(COALESCE(question_data->'_meta'->>'subject', '')) IN ('puzzle', 'puzzles & logic') THEN '"Puzzles & Logic"'::jsonb
             WHEN LOWER(COALESCE(question_data->'_meta'->>'subject', '')) IN ('story', 'stories & tales') THEN '"Stories & Tales"'::jsonb
             WHEN LOWER(COALESCE(question_data->'_meta'->>'subject', '')) = 'diy' THEN '"DIY & Crafts"'::jsonb
             WHEN LOWER(COALESCE(question_data->'_meta'->>'subject', '')) = 'dharm' THEN '"Dharm"'::jsonb
             WHEN LOWER(COALESCE(question_data->'_meta'->>'subject', '')) = 'creativity' THEN '"Creativity"'::jsonb
             ELSE to_jsonb(question_data->'_meta'->>'subject')
           END
         )
   WHERE question_data->'_meta'->>'subject' IS NOT NULL
     AND question_data->'_meta'->>'subject' <> 'ANY';

  -- 3. Backfill missing/ANY meta subjects using the quiz's actual subject title
  UPDATE quiz_questions qq
     SET question_data = jsonb_set(
           COALESCE(qq.question_data, '{}'::jsonb),
           ARRAY['_meta', 'subject'],
           to_jsonb(s.title)
         )
    FROM quizzes q
    JOIN subjects s ON s.id = q.subject_id
   WHERE q.id = qq.quiz_id
     AND s.title IS NOT NULL
     AND s.title <> 'ANY'
     AND (qq.question_data->'_meta'->>'subject' IS NULL OR qq.question_data->'_meta'->>'subject' = 'ANY');

END;
$$ LANGUAGE plpgsql;

SELECT _migrate_general_class_questions_to_any();

DROP FUNCTION _migrate_general_class_questions_to_any();

COMMIT;

