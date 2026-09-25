import { getDb } from '@els-ai/db-runtime';

export const db = getDb();

export async function ensureChatSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL,
      chat_type VARCHAR(30) NOT NULL CHECK (chat_type IN ('survey', 'performance', 'review')),
      initiator_id UUID NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('child', 'parent', 'teacher', 'admin', 'superadmin')),
      subject_student_id UUID,
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
      context_slots JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL,
      sender VARCHAR(20) NOT NULL CHECK (sender IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chat_survey_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL,
      student_user_id UUID NOT NULL,
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
      reviewed_by UUID,
      reviewed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

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
  `);
}
