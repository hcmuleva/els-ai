-- Migration 0012 — Auth seed DDL (extracted from auth-service/src/seed/seed.ts).
--
-- The auth-service used to run this DDL on every startup inside
-- `initSchemaAndSeed()`. After flipping auth-service to `els_admin` (which
-- isn't the table owner), we wrapped the inlined block in `if (false)` to
-- prevent `42501 must be owner of table` at boot. This migration restores
-- the schema-management contract without touching the running service:
-- DDL lives in `/migrations/*` and is run by the migration runner (which
-- connects as `postgres`, the actual table owner).
--
-- Every statement uses `IF NOT EXISTS` / `IF EXISTS` so this is safe to
-- apply on DBs that already have the schema (existing dev/staging) AND on
-- a fresh DB once earlier migrations create the required parent tables.

BEGIN;

-- ── Registration-id helper + backfill ──────────────────────────────────
CREATE OR REPLACE FUNCTION generate_registration_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'ELS-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 10));
END;
$$ LANGUAGE plpgsql;

ALTER TABLE users ADD COLUMN IF NOT EXISTS unique_registration_id VARCHAR(20);
ALTER TABLE users ALTER COLUMN unique_registration_id SET DEFAULT generate_registration_id();

UPDATE users
SET unique_registration_id = generate_registration_id()
WHERE unique_registration_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_registration_id
  ON users(unique_registration_id);

-- ── Activity / analytics ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  activity_type VARCHAR(50) NOT NULL,
  reference_id UUID,
  reference_title VARCHAR(255),
  status VARCHAR(50) DEFAULT 'attempted',
  score INTEGER,
  time_spent_seconds INTEGER DEFAULT 0,
  activity_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  analytics_date DATE NOT NULL DEFAULT CURRENT_DATE,
  streak_days INTEGER DEFAULT 0,
  consistency_score NUMERIC(5,2) DEFAULT 0,
  attempted_count INTEGER DEFAULT 0,
  not_attempted_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  completion_rate NUMERIC(5,2) DEFAULT 0,
  total_time_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(student_id, analytics_date)
);

-- (legacy `assignment_submissions` removed by migration 0013 —
--  the live table for class homework is `classroom_assignment_submissions`)

-- ── Parent flows ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parent_student_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  student_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(parent_user_id, student_user_id, organization_id)
);

CREATE TABLE IF NOT EXISTS parent_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  student_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  behavior_score SMALLINT NOT NULL CHECK (behavior_score BETWEEN 0 AND 10),
  focus_score SMALLINT NOT NULL CHECK (focus_score BETWEEN 0 AND 10),
  regularity_score SMALLINT NOT NULL CHECK (regularity_score BETWEEN 0 AND 10),
  creativity_score SMALLINT NOT NULL CHECK (creativity_score BETWEEN 0 AND 10),
  academic_score SMALLINT NOT NULL CHECK (academic_score BETWEEN 0 AND 10),
  outdoor_activity_score SMALLINT NOT NULL CHECK (outdoor_activity_score BETWEEN 0 AND 10),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parent_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  student_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  feedback_text TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── Teacher catalogue ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_standard_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  class_level VARCHAR(50) NOT NULL,
  subject VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(teacher_user_id, organization_id, class_level, subject)
);

-- ── Subject catalogue + topics + content ───────────────────────────────
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  cover_image TEXT,
  icon_image TEXT,
  icon_bg_color VARCHAR(20),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  author VARCHAR(255),
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_external_author BOOLEAN DEFAULT false,
  class_level VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, class_level, title)
);

CREATE TABLE IF NOT EXISTS content_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  class_level VARCHAR(50) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  cover_image TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(organization_id, class_level, subject, title)
);

CREATE TABLE IF NOT EXISTS topic_content_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES content_topics(id) ON DELETE CASCADE,
  section_order INTEGER NOT NULL,
  content_type VARCHAR(50) NOT NULL,
  media_url TEXT,
  external_url TEXT,
  text_content TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  class_level VARCHAR(50) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content_type VARCHAR(50) NOT NULL,
  media_url TEXT,
  external_url TEXT,
  text_content TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning_content_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES learning_contents(id) ON DELETE CASCADE,
  section_order INTEGER NOT NULL,
  content_type VARCHAR(50) NOT NULL,
  media_url TEXT,
  external_url TEXT,
  text_content TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS topic_content_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID REFERENCES content_topics(id) ON DELETE CASCADE,
  content_id UUID REFERENCES learning_contents(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(topic_id, content_id)
);

-- ── Older-install patches (idempotent) ──────────────────────────────────
ALTER TABLE quizzes  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES content_topics(id) ON DELETE SET NULL;
ALTER TABLE users    ADD COLUMN IF NOT EXISTS class_level VARCHAR(50);
ALTER TABLE users    ADD COLUMN IF NOT EXISTS branch VARCHAR(100);
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS icon_image TEXT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS icon_bg_color VARCHAR(20);

-- ── Permissions / billing ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_global_publish_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  enabled BOOLEAN DEFAULT false,
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  description TEXT,
  membership_tier VARCHAR(30) NOT NULL CHECK (membership_tier IN ('bronze', 'silver', 'gold', 'platinum')),
  billing_cycle VARCHAR(20) NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
  base_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  offer_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  special_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  group_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  max_users_for_group_discount INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(name, membership_tier, billing_cycle)
);

CREATE TABLE IF NOT EXISTS organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  trial_start_at TIMESTAMP,
  trial_end_at TIMESTAMP,
  starts_at TIMESTAMP,
  ends_at TIMESTAMP,
  final_price NUMERIC(12,2),
  seat_count INTEGER DEFAULT 1,
  offer_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  special_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  group_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DELETE FROM subscription_plans sp
USING (
  SELECT ctid
  FROM (
    SELECT
      ctid,
      ROW_NUMBER() OVER (
        PARTITION BY name, membership_tier, billing_cycle
        ORDER BY created_at ASC, ctid
      ) AS row_num
    FROM subscription_plans
  ) ranked
  WHERE ranked.row_num > 1
) duplicates
WHERE sp.ctid = duplicates.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_identity
  ON subscription_plans (name, membership_tier, billing_cycle);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES organization_subscriptions(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  invoice_number VARCHAR(40) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'paid', 'expired', 'renewed', 'cancelled')) DEFAULT 'pending',
  billing_kind VARCHAR(20) NOT NULL DEFAULT 'subscription',
  plan_name VARCHAR(120),
  membership_tier VARCHAR(30),
  billing_cycle VARCHAR(20),
  seat_count INTEGER DEFAULT 1,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  period_start TIMESTAMP,
  period_end TIMESTAMP,
  due_at TIMESTAMP,
  issued_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP,
  payment_method VARCHAR(40),
  payment_reference VARCHAR(120),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_org    ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issued ON invoices(issued_at DESC);

COMMIT;
