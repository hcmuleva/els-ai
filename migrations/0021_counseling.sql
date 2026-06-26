-- Migration 0021 — Parent-driven counseling sessions, responses, and AI reports.
--
-- This builds on the existing parent flows (parent_student_links,
-- parent_assessments, parent_feedback from migration 0012). A counseling
-- session is the richer superset of a one-off parent_assessment: a guided
-- multi-section survey whose answers are stored as flexible JSONB and then
-- scored by the counseling scoring engine into a holistic report card.
--
-- Conventions (matching the rest of /migrations):
--   • UUID PKs via gen_random_uuid()
--   • organization_id FK on every tenant-scoped table
--   • RLS enabled with the standard app_current_org() policy
--   • IF NOT EXISTS everywhere so this is safe to re-apply

BEGIN;

-- ── Sessions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS counseling_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  student_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'submitted', 'reported')),
  -- Frozen copy of the basic-info step (name/class/age/board) so the report
  -- stays accurate even if the student profile changes later.
  student_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP DEFAULT NOW(),
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ── Responses (flexible JSONB store) ────────────────────────────────────
-- One row per answered question. question_key is the dotted path used by the
-- scoring engine (e.g. 'math.concept', 'cognitive.attentionSpan', 'open.weakness').
CREATE TABLE IF NOT EXISTS counseling_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES counseling_sessions(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  section VARCHAR(40) NOT NULL,
  question_key VARCHAR(80) NOT NULL,
  value_json JSONB NOT NULL DEFAULT 'null'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (session_id, question_key)
);

-- ── Reports (scoring-engine output) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS counseling_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES counseling_sessions(id) ON DELETE CASCADE NOT NULL,
  student_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  overall_score INTEGER NOT NULL DEFAULT 0 CHECK (overall_score BETWEEN 0 AND 100),
  level VARCHAR(20) NOT NULL DEFAULT 'Beginner'
    CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
  growth_potential VARCHAR(20),
  study_pattern_type VARCHAR(20),
  report_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── Indexes (hot paths) ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_counseling_sessions_student
  ON counseling_sessions(student_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_counseling_sessions_parent
  ON counseling_sessions(parent_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_counseling_sessions_org
  ON counseling_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_counseling_responses_session
  ON counseling_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_counseling_reports_session
  ON counseling_reports(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_counseling_reports_student
  ON counseling_reports(student_user_id, created_at DESC);

-- ── RLS (standard org policy, matching migration 0004/0009) ──────────────
ALTER TABLE counseling_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS counseling_sessions_tenant_select ON counseling_sessions;
CREATE POLICY counseling_sessions_tenant_select ON counseling_sessions FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS counseling_sessions_tenant_modify ON counseling_sessions;
CREATE POLICY counseling_sessions_tenant_modify ON counseling_sessions FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

ALTER TABLE counseling_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS counseling_responses_tenant_select ON counseling_responses;
CREATE POLICY counseling_responses_tenant_select ON counseling_responses FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS counseling_responses_tenant_modify ON counseling_responses;
CREATE POLICY counseling_responses_tenant_modify ON counseling_responses FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

ALTER TABLE counseling_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS counseling_reports_tenant_select ON counseling_reports;
CREATE POLICY counseling_reports_tenant_select ON counseling_reports FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS counseling_reports_tenant_modify ON counseling_reports;
CREATE POLICY counseling_reports_tenant_modify ON counseling_reports FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

COMMIT;
