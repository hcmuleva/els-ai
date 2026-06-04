-- Migration 0019 — Teacher bookmarks.
--
-- Teacher-private collections of reusable learning content and quizzes.
-- A bookmark groups items the teacher wants to reuse when building
-- classrooms / learning plans. Items reference the canonical resource
-- tables (learning_contents, quizzes) and keep denormalized subject_id /
-- topic_id / class_level so the picker UI can group selections subject-wise
-- without extra joins. Org-scoped (no RLS, mirrors 0018); ownership is
-- enforced in the service layer via teacher_user_id + organization_id.

BEGIN;

CREATE TABLE IF NOT EXISTS teacher_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  teacher_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  class_level VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teacher_bookmark_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bookmark_id UUID REFERENCES teacher_bookmarks(id) ON DELETE CASCADE NOT NULL,
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('content', 'quiz')),
  content_id UUID REFERENCES learning_contents(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  topic_id UUID REFERENCES content_topics(id) ON DELETE SET NULL,
  class_level VARCHAR(50),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK (
    (item_type = 'content' AND content_id IS NOT NULL AND quiz_id IS NULL)
    OR
    (item_type = 'quiz' AND quiz_id IS NOT NULL AND content_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bookmark_item_content
  ON teacher_bookmark_items(bookmark_id, content_id) WHERE content_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bookmark_item_quiz
  ON teacher_bookmark_items(bookmark_id, quiz_id) WHERE quiz_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookmarks_org_teacher
  ON teacher_bookmarks(organization_id, teacher_user_id);
CREATE INDEX IF NOT EXISTS idx_bookmark_items_bookmark
  ON teacher_bookmark_items(bookmark_id);

-- Grant CRUD to the RLS-bound app role and the background-job admin role.
-- (ALTER DEFAULT PRIVILEGES only auto-grants for tables created by the role
--  that set them, so newer-migration tables must grant explicitly.)
GRANT SELECT, INSERT, UPDATE, DELETE ON teacher_bookmarks, teacher_bookmark_items TO els_app;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON teacher_bookmarks, teacher_bookmark_items TO els_admin;

COMMIT;
