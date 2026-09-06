-- Migration 0022 — Video Section Builder with Dynamic Quiz Mapping.
--
-- Adds time-bounded learning sections carved out of a single video
-- (learning_contents row of content_type youtube_url / reel_url / uploaded).
-- Each section owns at most one quiz and drives a student watch -> quiz ->
-- progress loop. No media is cut; playback is bounded by start_time/end_time.
--
-- Conventions (matching the rest of /migrations):
--   • UUID PKs via gen_random_uuid()
--   • organization_id FK on every tenant-scoped table
--   • RLS enabled with the standard app_current_org() policy
--   • IF NOT EXISTS everywhere so this is safe to re-apply

BEGIN;

-- Needed for the GiST overlap-exclusion constraint on scalar + range columns.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Optional known duration (seconds) of the parent video, used to validate that
-- a section's end_time never exceeds the video length. NULL = duration unknown.
ALTER TABLE learning_contents
  ADD COLUMN IF NOT EXISTS video_duration INTEGER;

-- ── Video sections ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES learning_contents(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  start_time INTEGER NOT NULL CHECK (start_time >= 0),
  end_time INTEGER NOT NULL,
  learning_objective TEXT,
  age_group VARCHAR(10) CHECK (age_group IN ('5-10', '11-14', '15-18')),
  category VARCHAR(120),
  difficulty VARCHAR(10) CHECK (difficulty IN ('easy', 'medium', 'hard')),
  -- Rule 6: a quiz maps to only ONE section (enforced by the UNIQUE below).
  quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'published')),
  section_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  -- DB rule 4: end must be greater than start.
  CONSTRAINT video_sections_time_order CHECK (end_time > start_time),
  -- DB rule: one quiz -> one section.
  CONSTRAINT video_sections_quiz_unique UNIQUE (quiz_id),
  -- DB rule: no overlapping ranges within the same content.
  CONSTRAINT video_sections_no_overlap EXCLUDE USING gist (
    content_id WITH =,
    int4range(start_time, end_time) WITH &&
  )
);

-- ── Student progress ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_video_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  content_id UUID REFERENCES learning_contents(id) ON DELETE CASCADE NOT NULL,
  section_id UUID REFERENCES video_sections(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  video_watch_status VARCHAR(12) NOT NULL DEFAULT 'not_started'
    CHECK (video_watch_status IN ('not_started', 'in_progress', 'completed')),
  quiz_status VARCHAR(12) NOT NULL DEFAULT 'not_started'
    CHECK (quiz_status IN ('not_started', 'in_progress', 'completed')),
  watched_seconds INTEGER NOT NULL DEFAULT 0,
  quiz_score INTEGER,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (student_id, section_id)
);

-- ── Indexes (hot paths) ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_video_sections_content
  ON video_sections(content_id, section_order);
CREATE INDEX IF NOT EXISTS idx_video_sections_org
  ON video_sections(organization_id);
CREATE INDEX IF NOT EXISTS idx_svp_student
  ON student_video_progress(student_id, content_id);
CREATE INDEX IF NOT EXISTS idx_svp_section
  ON student_video_progress(section_id);

-- ── RLS (standard org policy, matching migration 0004/0009/0021) ──────────
ALTER TABLE video_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS video_sections_tenant_select ON video_sections;
CREATE POLICY video_sections_tenant_select ON video_sections FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS video_sections_tenant_modify ON video_sections;
CREATE POLICY video_sections_tenant_modify ON video_sections FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

ALTER TABLE student_video_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS svp_tenant_select ON student_video_progress;
CREATE POLICY svp_tenant_select ON student_video_progress FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS svp_tenant_modify ON student_video_progress;
CREATE POLICY svp_tenant_modify ON student_video_progress FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

COMMIT;
