-- Migration: Add feedback_threads and feedback_messages tables
-- Run this on existing databases that already have the schema

CREATE TABLE IF NOT EXISTS feedback_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  classroom_id UUID,
  subject TEXT,
  created_by UUID REFERENCES users(id),
  created_by_role VARCHAR(20) NOT NULL DEFAULT 'parent',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES feedback_threads(id) ON DELETE CASCADE NOT NULL,
  sender_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  sender_role VARCHAR(20) NOT NULL,
  message_text TEXT NOT NULL,
  attachment_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_feedback_threads_student ON feedback_threads(student_user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_feedback_threads_status ON feedback_threads(status, organization_id);
CREATE INDEX IF NOT EXISTS idx_feedback_messages_thread ON feedback_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_feedback_messages_unread ON feedback_messages(thread_id, is_read) WHERE is_read = false;

-- Performance indexes for scale (100s of students/conversations)
CREATE INDEX IF NOT EXISTS idx_feedback_threads_org_updated ON feedback_threads(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_threads_student_org ON feedback_threads(student_user_id, organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_threads_created_by ON feedback_threads(created_by, organization_id);
CREATE INDEX IF NOT EXISTS idx_feedback_messages_thread_created ON feedback_messages(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_feedback_messages_sender ON feedback_messages(sender_user_id, thread_id);
CREATE INDEX IF NOT EXISTS idx_feedback_messages_unread_sender ON feedback_messages(thread_id, sender_user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_parent_feedback_student_org ON parent_feedback(student_user_id, organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parent_student_links_student ON parent_student_links(student_user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_links_parent ON parent_student_links(parent_user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_users_class_level ON users(class_level) WHERE deleted_at IS NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_name_search ON users(first_name, last_name) WHERE deleted_at IS NULL AND is_active = true;
