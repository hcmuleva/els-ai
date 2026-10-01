-- Migration 0031 — Add feedback_threads, feedback_messages, and feedback_topics tables
--
-- Enables structured parent-teacher communication threads, topic classification,
-- and messaging.

BEGIN;

-- ── 1. Feedback Topics ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  category VARCHAR(30) NOT NULL DEFAULT 'non_academic',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  class_level VARCHAR(50) DEFAULT 'any',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, category, title, class_level)
);

-- ── 2. Feedback Threads ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  classroom_id UUID,
  subject TEXT,
  category VARCHAR(30),
  topic_id UUID,
  topic_title VARCHAR(255),
  description TEXT,
  created_by UUID REFERENCES users(id),
  created_by_role VARCHAR(20) NOT NULL DEFAULT 'parent',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 3. Feedback Messages ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES feedback_threads(id) ON DELETE CASCADE NOT NULL,
  sender_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  sender_role VARCHAR(20) NOT NULL,
  message_text TEXT NOT NULL,
  response_type VARCHAR(30),
  attachment_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 4. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_feedback_threads_student ON feedback_threads(student_user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_feedback_threads_status ON feedback_threads(status, organization_id);
CREATE INDEX IF NOT EXISTS idx_feedback_threads_org_updated ON feedback_threads(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_threads_student_org ON feedback_threads(student_user_id, organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_threads_created_by ON feedback_threads(created_by, organization_id);
CREATE INDEX IF NOT EXISTS idx_feedback_threads_category ON feedback_threads(organization_id, category);

CREATE INDEX IF NOT EXISTS idx_feedback_messages_thread ON feedback_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_feedback_messages_unread ON feedback_messages(thread_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_feedback_messages_thread_created ON feedback_messages(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_feedback_messages_sender ON feedback_messages(sender_user_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_feedback_messages_unread_sender ON feedback_messages(thread_id, sender_user_id, is_read) WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_feedback_topics_org_class ON feedback_topics(organization_id, class_level, is_active);

-- ── 5. Seed Default Non-Academic Topics ─────────────────────────────────────────
INSERT INTO feedback_topics (organization_id, category, title, description, class_level) VALUES
  (NULL, 'non_academic', 'Discipline', 'Student discipline and rule adherence', 'any'),
  (NULL, 'non_academic', 'Consistency', 'Consistency in work and behavior', 'any'),
  (NULL, 'non_academic', 'Responsibility', 'Taking responsibility for actions and tasks', 'any'),
  (NULL, 'non_academic', 'Self-motivation', 'Intrinsic motivation and drive', 'any'),
  (NULL, 'non_academic', 'Logical Thinking', 'Logical reasoning and problem approach', 'any'),
  (NULL, 'non_academic', 'Analytical Ability', 'Breaking down complex problems', 'any'),
  (NULL, 'non_academic', 'Memory & Retention', 'Ability to remember and recall information', 'any'),
  (NULL, 'non_academic', 'Attention Span', 'Focus and concentration during tasks', 'any'),
  (NULL, 'non_academic', 'Confidence', 'Self-confidence and assertiveness', 'any'),
  (NULL, 'non_academic', 'Communication', 'Verbal and written communication skills', 'any'),
  (NULL, 'non_academic', 'Teamwork', 'Collaboration and group participation', 'any'),
  (NULL, 'non_academic', 'Stress Management', 'Handling pressure and emotional regulation', 'any'),
  (NULL, 'non_academic', 'Homework', 'Homework completion and quality', 'any'),
  (NULL, 'non_academic', 'Independent Learning', 'Self-directed study habits', 'any'),
  (NULL, 'non_academic', 'Needs Guidance', 'Requires extra support or direction', 'any'),
  (NULL, 'non_academic', 'Classroom Participation', 'Active engagement in class activities', 'any'),
  (NULL, 'non_academic', 'Sports & Physical Activity', 'Physical fitness and sports engagement', 'any'),
  (NULL, 'non_academic', 'Arts & Creativity', 'Creative expression and artistic skills', 'any'),
  (NULL, 'non_academic', 'Technology & Coding', 'Interest in tech and programming', 'any'),
  (NULL, 'non_academic', 'Reading & Writing', 'Interest in literature and writing', 'any'),
  (NULL, 'non_academic', 'Leadership', 'Taking initiative and leading peers', 'any'),
  (NULL, 'non_academic', 'Attendance', 'Regularity and punctuality', 'any'),
  (NULL, 'non_academic', 'Health & Wellbeing', 'Physical and mental health concerns', 'any'),
  (NULL, 'non_academic', 'Parent Concern', 'General parental concerns', 'any'),
  (NULL, 'non_academic', 'Other', 'Any other topic not listed above', 'any')
ON CONFLICT DO NOTHING;

-- ── 6. Permissions & Role Grants ──────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'els_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON feedback_threads, feedback_messages, feedback_topics TO els_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'els_admin') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON feedback_threads, feedback_messages, feedback_topics TO els_admin;
  END IF;
END $$;

COMMIT;
