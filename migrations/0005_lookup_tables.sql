-- Migration 0005 — Lookup tables for class_levels and subject_aliases.
--
-- Today these concepts only exist as hard-coded arrays inside seed.ts and
-- frontend constants. Promoting them into queryable tables means:
--   * adding a new class level no longer requires a frontend deploy
--   * subject alias resolution (Maths → Mathematics, EVS → Environmental
--     Studies, GK → General Knowledge) is queryable instead of hidden in code

BEGIN;

-- ── class_levels ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS class_levels (
  code         VARCHAR(8)   PRIMARY KEY,    -- 'LKG', 'UKG', '1', '2', ..., '12', 'ANY'
  label        VARCHAR(64)  NOT NULL,
  display_order INT         NOT NULL,
  is_any       BOOLEAN      NOT NULL DEFAULT false,
  is_active    BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

INSERT INTO class_levels (code, label, display_order, is_any) VALUES
  ('LKG', 'LKG',       0,  false),
  ('UKG', 'UKG',       1,  false),
  ('1',   'Class 1',   10, false),
  ('2',   'Class 2',   20, false),
  ('3',   'Class 3',   30, false),
  ('4',   'Class 4',   40, false),
  ('5',   'Class 5',   50, false),
  ('6',   'Class 6',   60, false),
  ('7',   'Class 7',   70, false),
  ('8',   'Class 8',   80, false),
  ('9',   'Class 9',   90, false),
  ('10',  'Class 10',  100, false),
  ('11',  'Class 11',  110, false),
  ('12',  'Class 12',  120, false),
  ('ANY', 'Any Class', 999, true)
ON CONFLICT (code) DO NOTHING;

-- ── subject_aliases ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subject_aliases (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id   UUID         NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  alias        VARCHAR(255) NOT NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_aliases_lower
  ON subject_aliases (subject_id, LOWER(alias));
CREATE INDEX IF NOT EXISTS idx_subject_aliases_alias_lower
  ON subject_aliases (LOWER(alias));

-- Seed the well-known aliases discovered during this session's cleanup.
-- Insert one alias row per (subjects.id, alias) pair, picking the canonical
-- subject row by class_level + title.
WITH wanted (alias, class_level, canonical_title) AS (VALUES
  ('Maths',                       NULL, 'Mathematics'),
  ('GK',                          NULL, 'General Knowledge'),
  ('EVS',                         NULL, 'Environmental Studies'),
  ('EVS',                         NULL, 'Environmental Studies (EVS)'),
  ('Environmental Studies (EVS)', NULL, 'Environmental Studies'),
  ('Environmental Studies',       NULL, 'Environmental Studies (EVS)'),
  ('Hindi Stories',               'LKG', 'Rhymes & Stories'),
  ('Stories',                     'LKG', 'Rhymes & Stories'),
  ('Computer',                    NULL, 'Computer Science'),
  ('Computer Science',            NULL, 'Computer Applications / IT'),
  ('Social',                      NULL, 'Social Science'),
  ('Activity',                    'LKG', 'Activity / Play-based Learning'),
  ('Play-based Learning',         'LKG', 'Activity / Play-based Learning'),
  ('Science',                     NULL, 'Science (Physics, Chemistry, Biology)')
)
INSERT INTO subject_aliases (subject_id, alias)
SELECT s.id, w.alias
  FROM wanted w
  JOIN subjects s
    ON LOWER(s.title) = LOWER(w.canonical_title)
   AND (w.class_level IS NULL OR s.class_level = w.class_level)
ON CONFLICT (subject_id, LOWER(alias)) WHERE TRUE DO NOTHING;

COMMIT;

-- After this migration, application code resolving a subject string for a
-- given (org, class_level) should:
--   1. exact match against subjects.title (case-insensitive), then
--   2. fall back to subject_aliases.alias and resolve to the canonical
--      subject row.
-- Once this is the everywhere-pattern, we can later add a CHECK constraint
-- requiring content_topics.subject ∈ subjects.title ∪ subject_aliases.alias
-- and finally drop the soft-text column.
