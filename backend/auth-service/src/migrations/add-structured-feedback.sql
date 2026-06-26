-- Migration: Add structured feedback (topics table + thread columns)

-- 1. Create feedback_topics table for non-academic topics
CREATE TABLE IF NOT EXISTS feedback_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  category VARCHAR(30) NOT NULL DEFAULT 'non_academic',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  class_level VARCHAR(50) DEFAULT 'any',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, category, title, class_level)
);

-- 2. Add structured columns to feedback_threads
ALTER TABLE feedback_threads ADD COLUMN IF NOT EXISTS category VARCHAR(30);
ALTER TABLE feedback_threads ADD COLUMN IF NOT EXISTS topic_id UUID;
ALTER TABLE feedback_threads ADD COLUMN IF NOT EXISTS topic_title VARCHAR(255);
ALTER TABLE feedback_threads ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. Add response_type to feedback_messages for structured teacher replies
ALTER TABLE feedback_messages ADD COLUMN IF NOT EXISTS response_type VARCHAR(30);

-- 4. Index for topic queries
CREATE INDEX IF NOT EXISTS idx_feedback_topics_org_class ON feedback_topics(organization_id, class_level, is_active);
CREATE INDEX IF NOT EXISTS idx_feedback_threads_category ON feedback_threads(organization_id, category);

-- 5. Seed default non-academic topics (org-agnostic, will be filtered by org at query time)
-- Behavioral
INSERT INTO feedback_topics (organization_id, category, title, description, class_level) VALUES
  (NULL, 'non_academic', 'Discipline', 'Student discipline and rule adherence', 'any'),
  (NULL, 'non_academic', 'Consistency', 'Consistency in work and behavior', 'any'),
  (NULL, 'non_academic', 'Responsibility', 'Taking responsibility for actions and tasks', 'any'),
  (NULL, 'non_academic', 'Self-motivation', 'Intrinsic motivation and drive', 'any')
ON CONFLICT DO NOTHING;

-- Cognitive
INSERT INTO feedback_topics (organization_id, category, title, description, class_level) VALUES
  (NULL, 'non_academic', 'Logical Thinking', 'Logical reasoning and problem approach', 'any'),
  (NULL, 'non_academic', 'Analytical Ability', 'Breaking down complex problems', 'any'),
  (NULL, 'non_academic', 'Memory & Retention', 'Ability to remember and recall information', 'any'),
  (NULL, 'non_academic', 'Attention Span', 'Focus and concentration during tasks', 'any')
ON CONFLICT DO NOTHING;

-- Social & Emotional
INSERT INTO feedback_topics (organization_id, category, title, description, class_level) VALUES
  (NULL, 'non_academic', 'Confidence', 'Self-confidence and assertiveness', 'any'),
  (NULL, 'non_academic', 'Communication', 'Verbal and written communication skills', 'any'),
  (NULL, 'non_academic', 'Teamwork', 'Collaboration and group participation', 'any'),
  (NULL, 'non_academic', 'Stress Management', 'Handling pressure and emotional regulation', 'any')
ON CONFLICT DO NOTHING;

-- Learning Behavior
INSERT INTO feedback_topics (organization_id, category, title, description, class_level) VALUES
  (NULL, 'non_academic', 'Homework', 'Homework completion and quality', 'any'),
  (NULL, 'non_academic', 'Independent Learning', 'Self-directed study habits', 'any'),
  (NULL, 'non_academic', 'Needs Guidance', 'Requires extra support or direction', 'any'),
  (NULL, 'non_academic', 'Classroom Participation', 'Active engagement in class activities', 'any')
ON CONFLICT DO NOTHING;

-- Interests & Extracurricular
INSERT INTO feedback_topics (organization_id, category, title, description, class_level) VALUES
  (NULL, 'non_academic', 'Sports & Physical Activity', 'Physical fitness and sports engagement', 'any'),
  (NULL, 'non_academic', 'Arts & Creativity', 'Creative expression and artistic skills', 'any'),
  (NULL, 'non_academic', 'Technology & Coding', 'Interest in tech and programming', 'any'),
  (NULL, 'non_academic', 'Reading & Writing', 'Interest in literature and writing', 'any'),
  (NULL, 'non_academic', 'Leadership', 'Taking initiative and leading peers', 'any')
ON CONFLICT DO NOTHING;

-- General
INSERT INTO feedback_topics (organization_id, category, title, description, class_level) VALUES
  (NULL, 'non_academic', 'Attendance', 'Regularity and punctuality', 'any'),
  (NULL, 'non_academic', 'Health & Wellbeing', 'Physical and mental health concerns', 'any'),
  (NULL, 'non_academic', 'Parent Concern', 'General parental concerns', 'any'),
  (NULL, 'non_academic', 'Other', 'Any other topic not listed above', 'any')
ON CONFLICT DO NOTHING;
