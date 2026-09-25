-- Migration 0030 — AI Chat System (Survey Chat, Performance Chat, Teacher Review Queue)
--
-- Implements the schema foundations for ELS AI Chat System:
--   • chat_sessions: Durable conversation sessions with context slots state machine
--   • chat_messages: Full transcript history with extraction & Jev metadata
--   • chat_survey_entries: Verified cascade structured facts from parent conversations,
--     with auto_accepted vs pending_review workflow for teachers.

BEGIN;

-- ── 1. Chat Sessions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  chat_type VARCHAR(30) NOT NULL CHECK (chat_type IN ('survey', 'performance', 'review')),
  initiator_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('child', 'parent', 'teacher', 'admin', 'superadmin')),
  subject_student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  context_slots JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 2. Chat Messages ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  sender VARCHAR(20) NOT NULL CHECK (sender IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 3. Chat Survey Entries (Verified Cascade Structured Facts) ──────────────
CREATE TABLE IF NOT EXISTS chat_survey_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  student_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  category VARCHAR(50) NOT NULL,
  topic VARCHAR(100),
  specific_enough BOOLEAN NOT NULL DEFAULT true,
  concern_level VARCHAR(50),
  confidence NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
  review_status VARCHAR(30) NOT NULL DEFAULT 'auto_accepted'
    CHECK (review_status IN ('auto_accepted', 'pending_review', 'approved', 'rejected')),
  raw_source_text TEXT NOT NULL,
  extracted_summary TEXT,
  teacher_notes TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 4. Hot-Path Indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chat_sessions_org
  ON chat_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_initiator
  ON chat_sessions(initiator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_student
  ON chat_sessions(subject_student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_type_status
  ON chat_sessions(chat_type, status);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session
  ON chat_messages(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_org
  ON chat_messages(organization_id);

CREATE INDEX IF NOT EXISTS idx_chat_survey_entries_student
  ON chat_survey_entries(student_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_survey_entries_review
  ON chat_survey_entries(organization_id, review_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_survey_entries_session
  ON chat_survey_entries(session_id);

-- ── 5. Row-Level Security ───────────────────────────────────────────────────
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_sessions_tenant_select ON chat_sessions;
CREATE POLICY chat_sessions_tenant_select ON chat_sessions FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS chat_sessions_tenant_modify ON chat_sessions;
CREATE POLICY chat_sessions_tenant_modify ON chat_sessions FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_messages_tenant_select ON chat_messages;
CREATE POLICY chat_messages_tenant_select ON chat_messages FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS chat_messages_tenant_modify ON chat_messages;
CREATE POLICY chat_messages_tenant_modify ON chat_messages FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

ALTER TABLE chat_survey_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_survey_entries_tenant_select ON chat_survey_entries;
CREATE POLICY chat_survey_entries_tenant_select ON chat_survey_entries FOR SELECT
  USING (app_current_org() IS NULL OR organization_id = app_current_org());
DROP POLICY IF EXISTS chat_survey_entries_tenant_modify ON chat_survey_entries;
CREATE POLICY chat_survey_entries_tenant_modify ON chat_survey_entries FOR ALL
  USING (app_current_org() IS NULL OR organization_id = app_current_org())
  WITH CHECK (app_current_org() IS NULL OR organization_id = app_current_org());

COMMIT;
