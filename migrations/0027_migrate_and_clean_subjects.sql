-- Migration 0027 — Normalize subject titles and consolidate extra activity subjects to ANY class_level.
-- 1. Updates raw/snake_case subject titles (e.g. tips_tricks, how_things_works) in `subjects.title`.
-- 2. Consolidates extra activity subjects into class_level = 'ANY' in `subjects`.
-- 3. Safely deduplicates and updates content_topics, learning_contents, quizzes, teacher_standard_subjects to point to the consolidated ANY subject row.
-- 4. Updates class_level = 'ANY' on content_topics and learning_contents for extra activity subjects.
-- 5. Deletes redundant per-class subject rows from `subjects`.

BEGIN;

CREATE OR REPLACE FUNCTION _migrate_and_clean_subjects() RETURNS void AS $$
DECLARE
  mappings TEXT[][] := ARRAY[
    ARRAY['creativity', 'Creativity'],
    ARRAY['dharm', 'Dharm'],
    ARRAY['diy', 'DIY & Crafts'],
    ARRAY['do_you_know', 'Do You Know?'],
    ARRAY['how_things_works', 'How Things Work'],
    ARRAY['how_to_think', 'How to Think'],
    ARRAY['jr_scientist', 'Jr. Scientist'],
    ARRAY['memory_development', 'Memory Development'],
    ARRAY['puzzle', 'Puzzles & Logic'],
    ARRAY['story', 'Stories & Tales'],
    ARRAY['tips_tricks', 'Tips and Tricks']
  ];

  extra_titles TEXT[] := ARRAY[
    'Activity / Play-based Learning',
    'Brain Training',
    'Creativity',
    'Dharm',
    'DIY & Crafts',
    'Do You Know?',
    'Drawing & Coloring',
    'Experimental Learning',
    'Extracurricular Activities',
    'General Awareness',
    'General Knowledge',
    'How Things Work',
    'How to Think',
    'IQ Test',
    'Jr. Scientist',
    'Logical Reasoning',
    'Memory Development',
    'Puzzles & Logic',
    'Rhymes & Stories',
    'Stories & Tales',
    'Tips and Tricks'
  ];

  m TEXT[];
  t TEXT;
  old_val TEXT;
  new_val TEXT;
  org_rec RECORD;
  dup_topic_rec RECORD;
  any_subject_id UUID;
  old_subject_ids UUID[];
  keep_topic_id UUID;
  merge_topic_ids UUID[];
BEGIN
  -- ── Step 1: Normalize raw/snake_case titles in `subjects` ──
  FOREACH m SLICE 1 IN ARRAY mappings LOOP
    old_val := m[1];
    new_val := m[2];
    UPDATE subjects SET title = new_val, updated_at = NOW() WHERE LOWER(title) = LOWER(old_val);
  END LOOP;

  -- ── Step 2: Consolidate Extra Activity subjects into ANY class_level ──
  FOR org_rec IN SELECT DISTINCT organization_id FROM subjects WHERE organization_id IS NOT NULL LOOP
    FOREACH t IN ARRAY extra_titles LOOP
      any_subject_id := NULL;

      -- Check if an ANY row already exists for this org and clean title
      SELECT id INTO any_subject_id
        FROM subjects
       WHERE organization_id = org_rec.organization_id
         AND class_level = 'ANY'
         AND LOWER(title) = LOWER(t)
       LIMIT 1;

      -- If no ANY row exists, pick the most recent row for this subject title and convert its class_level to 'ANY'
      IF any_subject_id IS NULL THEN
        SELECT id INTO any_subject_id
          FROM subjects
         WHERE organization_id = org_rec.organization_id
           AND LOWER(title) = LOWER(t)
         ORDER BY updated_at DESC NULLS LAST
         LIMIT 1;

        IF any_subject_id IS NOT NULL THEN
          UPDATE subjects
             SET class_level = 'ANY',
                 title = t,
                 updated_at = NOW()
           WHERE id = any_subject_id;
        END IF;
      END IF;

      -- Re-link all child rows pointing to old subject IDs of this title to point to the new ANY subject row
      IF any_subject_id IS NOT NULL THEN
        SELECT ARRAY_AGG(id) INTO old_subject_ids
          FROM subjects
         WHERE organization_id = org_rec.organization_id
           AND LOWER(title) = LOWER(t)
           AND id <> any_subject_id;

        IF old_subject_ids IS NOT NULL AND ARRAY_LENGTH(old_subject_ids, 1) > 0 THEN

          -- Deduplicate content_topics that share the same organization_id and LOWER(title)
          FOR dup_topic_rec IN (
            SELECT organization_id, LOWER(title) AS norm_title, ARRAY_AGG(id ORDER BY (class_level = 'ANY') DESC, created_at ASC) AS topic_ids
              FROM content_topics
             WHERE organization_id = org_rec.organization_id
               AND (subject_id = any_subject_id OR subject_id = ANY(old_subject_ids))
             GROUP BY organization_id, LOWER(title)
            HAVING COUNT(*) > 1
          ) LOOP
            keep_topic_id := dup_topic_rec.topic_ids[1];
            merge_topic_ids := dup_topic_rec.topic_ids[2:ARRAY_LENGTH(dup_topic_rec.topic_ids, 1)];

            -- Re-link topic_content_sections
            UPDATE topic_content_sections SET topic_id = keep_topic_id WHERE topic_id = ANY(merge_topic_ids);

            -- Re-link topic_content_assignments (avoid unique constraint topic_id, content_id violations)
            DELETE FROM topic_content_assignments
             WHERE topic_id = ANY(merge_topic_ids)
               AND content_id IN (SELECT content_id FROM topic_content_assignments WHERE topic_id = keep_topic_id);

            UPDATE topic_content_assignments SET topic_id = keep_topic_id WHERE topic_id = ANY(merge_topic_ids);

            -- Re-link quizzes
            UPDATE quizzes SET topic_id = keep_topic_id WHERE topic_id = ANY(merge_topic_ids);

            -- Re-link teacher_bookmarks
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teacher_bookmarks' AND column_name = 'topic_id') THEN
              EXECUTE 'DELETE FROM teacher_bookmarks WHERE topic_id = ANY($1) AND (teacher_user_id, content_id) IN (SELECT teacher_user_id, content_id FROM teacher_bookmarks WHERE topic_id = $2)'
              USING merge_topic_ids, keep_topic_id;

              EXECUTE 'UPDATE teacher_bookmarks SET topic_id = $1 WHERE topic_id = ANY($2)'
              USING keep_topic_id, merge_topic_ids;
            END IF;

            -- Re-link topic_question_assignments
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'topic_question_assignments') THEN
              EXECUTE 'DELETE FROM topic_question_assignments WHERE topic_id = ANY($1) AND question_id IN (SELECT question_id FROM topic_question_assignments WHERE topic_id = $2)'
              USING merge_topic_ids, keep_topic_id;

              EXECUTE 'UPDATE topic_question_assignments SET topic_id = $1 WHERE topic_id = ANY($2)'
              USING keep_topic_id, merge_topic_ids;
            END IF;

            -- Delete merged duplicate topics
            DELETE FROM content_topics WHERE id = ANY(merge_topic_ids);
          END LOOP;

          -- Re-link remaining content_topics
          UPDATE content_topics
             SET subject_id = any_subject_id,
                 class_level = 'ANY',
                 updated_at = NOW()
           WHERE subject_id = ANY(old_subject_ids);

          -- Re-link learning_contents
          UPDATE learning_contents
             SET subject_id = any_subject_id,
                 class_level = 'ANY',
                 updated_at = NOW()
           WHERE subject_id = ANY(old_subject_ids);

          -- Re-link quizzes
          UPDATE quizzes
             SET subject_id = any_subject_id,
                 updated_at = NOW()
           WHERE subject_id = ANY(old_subject_ids);

          -- Re-link & deduplicate teacher_standard_subjects if table exists
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teacher_standard_subjects') THEN
            EXECUTE 'DELETE FROM teacher_standard_subjects t1
                      WHERE t1.subject_id = ANY($1)
                        AND EXISTS (
                          SELECT 1 FROM teacher_standard_subjects t2
                           WHERE t2.teacher_user_id = t1.teacher_user_id
                             AND t2.organization_id = t1.organization_id
                             AND (t2.subject_id = $2 OR t2.subject_id = ANY($1))
                             AND t2.id <> t1.id
                             AND (t2.subject_id = $2 OR t2.id < t1.id)
                        )'
            USING old_subject_ids, any_subject_id;

            EXECUTE 'UPDATE teacher_standard_subjects SET subject_id = $1, class_level = ''ANY'' WHERE subject_id = ANY($2)'
            USING any_subject_id, old_subject_ids;
          END IF;

          -- Re-link teacher_bookmarks if column subject_id exists
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teacher_bookmarks' AND column_name = 'subject_id') THEN
            EXECUTE 'UPDATE teacher_bookmarks SET subject_id = $1 WHERE subject_id = ANY($2)'
            USING any_subject_id, old_subject_ids;
          END IF;

          -- Delete redundant per-class subject rows
          DELETE FROM subjects WHERE id = ANY(old_subject_ids);
        END IF;

        -- Ensure any existing content_topics & learning_contents already linked to `any_subject_id` have class_level = 'ANY'
        -- First deduplicate content_topics for any_subject_id if multiple rows exist with class_level = 'ANY'
        FOR dup_topic_rec IN (
          SELECT organization_id, LOWER(title) AS norm_title, ARRAY_AGG(id ORDER BY (class_level = 'ANY') DESC, created_at ASC) AS topic_ids
            FROM content_topics
           WHERE organization_id = org_rec.organization_id
             AND subject_id = any_subject_id
           GROUP BY organization_id, LOWER(title)
          HAVING COUNT(*) > 1
        ) LOOP
          keep_topic_id := dup_topic_rec.topic_ids[1];
          merge_topic_ids := dup_topic_rec.topic_ids[2:ARRAY_LENGTH(dup_topic_rec.topic_ids, 1)];

          UPDATE topic_content_sections SET topic_id = keep_topic_id WHERE topic_id = ANY(merge_topic_ids);
          DELETE FROM topic_content_assignments WHERE topic_id = ANY(merge_topic_ids) AND content_id IN (SELECT content_id FROM topic_content_assignments WHERE topic_id = keep_topic_id);
          UPDATE topic_content_assignments SET topic_id = keep_topic_id WHERE topic_id = ANY(merge_topic_ids);
          UPDATE quizzes SET topic_id = keep_topic_id WHERE topic_id = ANY(merge_topic_ids);
          DELETE FROM content_topics WHERE id = ANY(merge_topic_ids);
        END LOOP;

        UPDATE content_topics SET class_level = 'ANY', updated_at = NOW() WHERE subject_id = any_subject_id AND class_level <> 'ANY';
        UPDATE learning_contents SET class_level = 'ANY', updated_at = NOW() WHERE subject_id = any_subject_id AND class_level <> 'ANY';
      END IF;

    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT _migrate_and_clean_subjects();

DROP FUNCTION _migrate_and_clean_subjects();

COMMIT;

