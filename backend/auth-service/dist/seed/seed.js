import bcrypt from 'bcryptjs';
import { db } from '../db.js';
export async function initSchemaAndSeed() {
    const forceReset = process.env.RESET_DB_ON_START === 'true';
    const existingSchema = await db.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'organizations'
    ) AS exists
  `);
    const schemaExists = Boolean(existingSchema.rows[0]?.exists);
    if (schemaExists && !forceReset) {
        // Ensure all newer tables are created if they are missing
        await db.query(`
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

      CREATE TABLE IF NOT EXISTS assignment_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
        assignment_ref_id UUID,
        assignment_title VARCHAR(255),
        file_url TEXT,
        submission_status VARCHAR(50) DEFAULT 'pending',
        submitted_at TIMESTAMP,
        graded_at TIMESTAMP,
        grade INTEGER,
        feedback TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS parent_student_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        parent_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        student_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(parent_user_id, student_user_id, organization_id)
      );

      CREATE TABLE IF NOT EXISTS teacher_standard_subjects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        teacher_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        class_level VARCHAR(50) NOT NULL,
        subject VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(teacher_user_id, organization_id, class_level, subject)
      );

      CREATE TABLE IF NOT EXISTS subjects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        cover_image TEXT,
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
    `);
        // Add topic_id column to quizzes if not present (migration for existing installs)
        await db.query(`
      ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES content_topics(id) ON DELETE SET NULL;
    `);
        // Add class_level column to users if not present (migration for existing installs)
        await db.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS class_level VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS branch VARCHAR(100);

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

    `);
        await db.query(`
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
    `);
        await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_identity
        ON subscription_plans (name, membership_tier, billing_cycle);
    `);
        await db.query(`
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

      CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
      CREATE INDEX IF NOT EXISTS idx_invoices_issued ON invoices(issued_at DESC);
    `);
        // Also seed subjects if they are missing
        const subjectsCheck = await db.query("SELECT 1 FROM subjects LIMIT 1");
        if ((subjectsCheck.rowCount ?? 0) === 0) {
            // Find ELS Academy organization ID
            const orgRes = await db.query("SELECT id FROM organizations WHERE subdomain = 'els-academy' LIMIT 1");
            if ((orgRes.rowCount ?? 0) > 0) {
                const orgId = orgRes.rows[0].id;
                await db.query(`INSERT INTO subjects (organization_id, cover_image, title, description, author, author_user_id, is_external_author, class_level)
           VALUES
           ($1, $2, $3, $4, $5, NULL, true, $6),
           ($1, $7, $8, $9, $10, NULL, true, $11),
           ($1, $12, $13, $14, $15, NULL, true, $16)
           ON CONFLICT (organization_id, class_level, title) DO NOTHING`, [
                    orgId,
                    null, 'English', 'Basic language and reading skills', 'ELS Team', '1',
                    null, 'Mathematics', 'Numbers, counting, and arithmetic foundations', 'ELS Team', '2',
                    null, 'Environmental Studies', 'Early exposure to nature and surroundings', 'ELS Team', 'LKG'
                ]);
            }
        }
        // Seed English topics & content if missing
        const orgRes = await db.query("SELECT id FROM organizations WHERE subdomain = 'els-academy' LIMIT 1");
        if ((orgRes.rowCount ?? 0) > 0) {
            const orgId = orgRes.rows[0].id;
            await seedTopicsAndContent(orgId);
            // Seed Ramesh / Rahul / Mohan if missing
            const rameshCheck = await db.query("SELECT id FROM users WHERE email = 'ramesh@els.ai' LIMIT 1");
            if ((rameshCheck.rowCount ?? 0) === 0) {
                const passwordHash = await bcrypt.hash('welcome', 10);
                const parentRoleRes = await db.query("SELECT id FROM roles WHERE role_name = 'parent' LIMIT 1");
                const studentRoleRes = await db.query("SELECT id FROM roles WHERE role_name = 'student' LIMIT 1");
                const parentRoleId = parentRoleRes.rows[0]?.id;
                const studentRoleId = studentRoleRes.rows[0]?.id;
                const ramesh = await db.query(`INSERT INTO users(first_name, last_name, email, mobile_number, password_hash, active_role)
           VALUES('Ramesh', 'Kumar', 'ramesh@els.ai', '9876543210', $1, 'parent') RETURNING id`, [passwordHash]);
                const rameshId = ramesh.rows[0].id;
                await db.query(`INSERT INTO user_roles(user_id, role_id, organization_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, [rameshId, parentRoleId, orgId]);
                const rahul = await db.query(`INSERT INTO users(first_name, last_name, email, mobile_number, password_hash, active_role, class_level)
           VALUES('Rahul', 'Kumar', 'rahul@els.ai', '9876543211', $1, 'student', '1') RETURNING id`, [passwordHash]);
                const rahulId = rahul.rows[0].id;
                await db.query(`INSERT INTO user_roles(user_id, role_id, organization_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, [rahulId, studentRoleId, orgId]);
                const mohan = await db.query(`INSERT INTO users(first_name, last_name, email, mobile_number, password_hash, active_role, class_level)
           VALUES('Mohan', 'Kumar', 'mohan@els.ai', '9876543212', $1, 'student', '2') RETURNING id`, [passwordHash]);
                const mohanId = mohan.rows[0].id;
                await db.query(`INSERT INTO user_roles(user_id, role_id, organization_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, [mohanId, studentRoleId, orgId]);
                await db.query(`INSERT INTO parent_student_links(parent_user_id, student_user_id, organization_id)
           VALUES($1,$2,$3),($1,$4,$3) ON CONFLICT DO NOTHING`, [rameshId, rahulId, orgId, mohanId]);
                // Sample activity for Rahul
                const rahulActivities = [
                    { type: 'content', title: 'Alphabets A-E', status: 'completed', score: null, time: 480, days: 6 },
                    { type: 'quiz', title: 'Vowels & Consonants Quiz', status: 'completed', score: 90, time: 300, days: 5 },
                    { type: 'content', title: 'Numbers 1-20', status: 'completed', score: null, time: 360, days: 4 },
                    { type: 'assignment', title: 'Write your name', status: 'completed', score: 85, time: 600, days: 3 },
                    { type: 'content', title: 'Colours & Shapes', status: 'completed', score: null, time: 420, days: 2 },
                    { type: 'quiz', title: 'Shapes Quiz', status: 'attempted', score: 70, time: 240, days: 1 },
                    { type: 'content', title: 'Fruits & Vegetables', status: 'completed', score: null, time: 300, days: 0 },
                ];
                for (const act of rahulActivities) {
                    await db.query(`INSERT INTO student_activity(student_id, organization_id, activity_type, reference_title, status, score, time_spent_seconds, activity_date)
             VALUES($1,$2,$3,$4,$5,$6,$7, CURRENT_DATE - $8::int)`, [rahulId, orgId, act.type, act.title, act.status, act.score, act.time, act.days]);
                }
                // Sample activity for Mohan
                const mohanActivities = [
                    { type: 'content', title: 'Addition & Subtraction', status: 'completed', score: null, time: 540, days: 6 },
                    { type: 'quiz', title: 'Maths Quiz 1', status: 'completed', score: 80, time: 360, days: 5 },
                    { type: 'content', title: 'Plants and Animals', status: 'completed', score: null, time: 420, days: 4 },
                    { type: 'assignment', title: 'Draw a plant', status: 'pending', score: null, time: 0, days: 3 },
                    { type: 'content', title: 'Sentence Formation', status: 'completed', score: null, time: 300, days: 2 },
                    { type: 'quiz', title: 'English Grammar Quiz', status: 'completed', score: 95, time: 270, days: 1 },
                    { type: 'content', title: 'Multiplication Basics', status: 'attempted', score: null, time: 180, days: 0 },
                ];
                for (const act of mohanActivities) {
                    await db.query(`INSERT INTO student_activity(student_id, organization_id, activity_type, reference_title, status, score, time_spent_seconds, activity_date)
             VALUES($1,$2,$3,$4,$5,$6,$7, CURRENT_DATE - $8::int)`, [mohanId, orgId, act.type, act.title, act.status, act.score, act.time, act.days]);
                }
                await db.query(`INSERT INTO student_analytics(student_id, organization_id, analytics_date, streak_days, consistency_score, attempted_count, completed_count, completion_rate, total_time_seconds)
           VALUES($1,$2,CURRENT_DATE,7,92.5,7,6,85.71,2700),
                 ($3,$2,CURRENT_DATE,5,78.3,6,5,83.33,2070)
           ON CONFLICT (student_id, analytics_date) DO NOTHING`, [rahulId, orgId, mohanId]);
                console.log('Seeded Ramesh, Rahul, Mohan successfully.');
            }
        }
        await ensureDefaultOrgAndPlanSeeds();
        console.log('Schema already exists. Skipping destructive seed.');
        return;
    }
    if (forceReset) {
        // Explicit opt-in reset only
        await db.query(`
      DROP TABLE IF EXISTS question_attempts CASCADE;
      DROP TABLE IF EXISTS student_attempts CASCADE;
      DROP TABLE IF EXISTS topic_content_sections CASCADE;
      DROP TABLE IF EXISTS content_topics CASCADE;
      DROP TABLE IF EXISTS topic_content_assignments CASCADE;
      DROP TABLE IF EXISTS learning_content_sections CASCADE;
      DROP TABLE IF EXISTS learning_contents CASCADE;
      DROP TABLE IF EXISTS quiz_questions CASCADE;
      DROP TABLE IF EXISTS quizzes CASCADE;
      DROP TABLE IF EXISTS refresh_tokens CASCADE;
      DROP TABLE IF EXISTS subjects CASCADE;
      DROP TABLE IF EXISTS teacher_standard_subjects CASCADE;
      DROP TABLE IF EXISTS assignment_submissions CASCADE;
      DROP TABLE IF EXISTS student_analytics CASCADE;
      DROP TABLE IF EXISTS student_activity CASCADE;
      DROP TABLE IF EXISTS parent_student_links CASCADE;
      DROP TABLE IF EXISTS user_roles CASCADE;
      DROP TABLE IF EXISTS roles CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS organizations CASCADE;
    `);
    }
    // 1. Organizations
    await db.query(`
    CREATE TABLE organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      subdomain VARCHAR(100) UNIQUE,
      logo_url TEXT,
      settings JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
    // 2. Users
    await db.query(`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      mobile_number VARCHAR(20) UNIQUE,
      password_hash TEXT NOT NULL,
      gender VARCHAR(20),
      date_of_birth DATE,
      education TEXT,
      class_level VARCHAR(50),
      branch VARCHAR(100),
      profile_image TEXT,
      is_active BOOLEAN DEFAULT true,
      is_verified BOOLEAN DEFAULT false,
      last_login_at TIMESTAMP,
      active_role VARCHAR(50) DEFAULT 'student',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      deleted_at TIMESTAMP
    );
  `);
    // 3. Roles
    await db.query(`
    CREATE TABLE roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      role_name VARCHAR(50) UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
    // 4. User Roles (Many-to-Many with Organization scope)
    await db.query(`
    CREATE TABLE user_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, role_id, organization_id)
    );
  `);
    // 5. Refresh Tokens
    await db.query(`
    CREATE TABLE refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      device_info TEXT,
      ip_address TEXT,
      expires_at TIMESTAMP NOT NULL,
      revoked BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
    await db.query(`
    CREATE TABLE user_global_publish_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
      enabled BOOLEAN DEFAULT false,
      granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
      granted_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, organization_id)
    );
  `);
    await db.query(`
    CREATE TABLE subscription_plans (
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
  `);
    await db.query(`
    CREATE TABLE organization_subscriptions (
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
  `);
    // 5.0 Student activity tracking
    await db.query(`
    CREATE TABLE student_activity (
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
  `);
    await db.query(`
    CREATE TABLE student_analytics (
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
  `);
    await db.query(`
    CREATE TABLE assignment_submissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
      assignment_ref_id UUID,
      assignment_title VARCHAR(255),
      file_url TEXT,
      submission_status VARCHAR(50) DEFAULT 'pending',
      submitted_at TIMESTAMP,
      graded_at TIMESTAMP,
      grade INTEGER,
      feedback TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
    // 5.1 Parent-Student links
    await db.query(`
    CREATE TABLE parent_student_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      parent_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      student_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(parent_user_id, student_user_id, organization_id)
    );
  `);
    // 5.2 Teacher standard-subject assignments
    await db.query(`
    CREATE TABLE teacher_standard_subjects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      teacher_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      class_level VARCHAR(50) NOT NULL,
      subject VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(teacher_user_id, organization_id, class_level, subject)
    );
  `);
    // 5.3 Subject catalog by standard
    await db.query(`
    CREATE TABLE subjects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      cover_image TEXT,
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
  `);
    // 5.4 Content topics
    await db.query(`
    CREATE TABLE content_topics (
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
  `);
    // 5.5 Topic content sections
    await db.query(`
    CREATE TABLE topic_content_sections (
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
  `);
    // 5.6 Reusable learning content library
    await db.query(`
    CREATE TABLE learning_contents (
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
  `);
    await db.query(`
    CREATE TABLE learning_content_sections (
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
  `);
    // 5.7 Topic to content assignments
    await db.query(`
    CREATE TABLE topic_content_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      topic_id UUID REFERENCES content_topics(id) ON DELETE CASCADE,
      content_id UUID REFERENCES learning_contents(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(topic_id, content_id)
    );
  `);
    // 6. Quizzes
    await db.query(`
    CREATE TABLE quizzes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      topic_id UUID REFERENCES content_topics(id) ON DELETE SET NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      thumbnail_image TEXT,
      created_by UUID, -- Can refer to a user ID or be null if system/AI
      class_level VARCHAR(50),
      subject VARCHAR(100),
      quiz_type VARCHAR(100) NOT NULL, -- drag_drop, image_select, sound_match, memory_game
      difficulty_level VARCHAR(50),
      background_music_url TEXT,
      theme JSONB DEFAULT '{}',
      total_questions INTEGER DEFAULT 0,
      is_published BOOLEAN DEFAULT false,
      is_ai_generated BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);
    // 7. Quiz Questions
    await db.query(`
    CREATE TABLE quiz_questions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
      question_type VARCHAR(100) NOT NULL,
      question_title TEXT,
      question_instruction TEXT,
      question_audio TEXT,
      time_limit_seconds INTEGER DEFAULT 30,
      points INTEGER DEFAULT 10,
      sort_order INTEGER,
      question_data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
    // 8. Student Attempts
    await db.query(`
    CREATE TABLE student_attempts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id UUID REFERENCES users(id) ON DELETE CASCADE,
      quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
      score INTEGER NOT NULL,
      total_points INTEGER NOT NULL,
      completed_at TIMESTAMP DEFAULT NOW()
    );
  `);
    // 9. Question Attempts
    await db.query(`
    CREATE TABLE question_attempts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      attempt_id UUID REFERENCES student_attempts(id) ON DELETE CASCADE,
      question_id UUID REFERENCES quiz_questions(id) ON DELETE CASCADE,
      is_correct BOOLEAN NOT NULL,
      response_data JSONB DEFAULT '{}',
      time_spent_seconds INTEGER
    );
  `);
    // --- SEED DATA ---
    // 1. Seed Organization
    const orgResult = await db.query(`
    INSERT INTO organizations (name, subdomain, settings)
    VALUES ('ELS Academy', 'els-academy', '{"theme": "default"}')
    RETURNING id;
  `);
    const orgId = orgResult.rows[0].id;
    // 2. Seed Roles
    const roles = ['student', 'teacher', 'parent', 'admin', 'superadmin'];
    const roleIdMap = {};
    for (const role of roles) {
        const roleInsert = await db.query('INSERT INTO roles(role_name) VALUES($1) RETURNING id', [role]);
        roleIdMap[role] = roleInsert.rows[0].id;
    }
    // 3. Seed Users
    const passwordHash = await bcrypt.hash('welcome', 10);
    const userSeeds = [
        {
            firstName: 'ELS',
            lastName: 'Super User',
            email: 'super@els.ai',
            activeRole: 'superadmin',
            assignedRoles: [...roles],
            classLevel: null,
        },
        {
            firstName: 'ELS',
            lastName: 'Student',
            email: 'student@els.ai',
            activeRole: 'student',
            assignedRoles: ['student'],
            classLevel: '1',
        },
        {
            firstName: 'ELS',
            lastName: 'Teacher',
            email: 'teacher@els.ai',
            activeRole: 'teacher',
            assignedRoles: ['teacher'],
            classLevel: null,
        },
        {
            firstName: 'ELS',
            lastName: 'Parent',
            email: 'parent@els.ai',
            activeRole: 'parent',
            assignedRoles: ['parent'],
            classLevel: null,
        },
    ];
    for (const seedUser of userSeeds) {
        const userInsert = await db.query(`INSERT INTO users(first_name, last_name, email, password_hash, active_role, class_level)
       VALUES($1, $2, $3, $4, $5, $6)
       RETURNING id`, [seedUser.firstName, seedUser.lastName, seedUser.email, passwordHash, seedUser.activeRole, seedUser.classLevel || null]);
        const userId = userInsert.rows[0].id;
        for (const roleName of seedUser.assignedRoles) {
            const roleId = roleIdMap[roleName];
            await db.query(`INSERT INTO user_roles(user_id, role_id, organization_id)
         VALUES($1, $2, $3)`, [userId, roleId, orgId]);
        }
    }
    // ── MULTI-CHILD DEMO: Ramesh (parent) → Rahul (Class 1) + Mohan (Class 2) ──
    const rameshInsert = await db.query(`INSERT INTO users(first_name, last_name, email, mobile_number, password_hash, active_role)
     VALUES('Ramesh', 'Kumar', 'ramesh@els.ai', '9876543210', $1, 'parent')
     RETURNING id`, [passwordHash]);
    const rameshId = rameshInsert.rows[0].id;
    await db.query(`INSERT INTO user_roles(user_id, role_id, organization_id) VALUES($1, $2, $3)`, [rameshId, roleIdMap['parent'], orgId]);
    const rahulInsert = await db.query(`INSERT INTO users(first_name, last_name, email, mobile_number, password_hash, active_role, class_level)
     VALUES('Rahul', 'Kumar', 'rahul@els.ai', '9876543211', $1, 'student', '1')
     RETURNING id`, [passwordHash]);
    const rahulId = rahulInsert.rows[0].id;
    await db.query(`INSERT INTO user_roles(user_id, role_id, organization_id) VALUES($1, $2, $3)`, [rahulId, roleIdMap['student'], orgId]);
    const mohanInsert = await db.query(`INSERT INTO users(first_name, last_name, email, mobile_number, password_hash, active_role, class_level)
     VALUES('Mohan', 'Kumar', 'mohan@els.ai', '9876543212', $1, 'student', '2')
     RETURNING id`, [passwordHash]);
    const mohanId = mohanInsert.rows[0].id;
    await db.query(`INSERT INTO user_roles(user_id, role_id, organization_id) VALUES($1, $2, $3)`, [mohanId, roleIdMap['student'], orgId]);
    // Link Ramesh → Rahul + Mohan
    await db.query(`INSERT INTO parent_student_links(parent_user_id, student_user_id, organization_id)
     VALUES($1, $2, $3), ($1, $4, $3)`, [rameshId, rahulId, orgId, mohanId]);
    // Sample activity: Rahul (Class 1) — last 7 days
    const activityDaysRahul = [6, 5, 4, 3, 2, 1, 0];
    const rahulActivities = [
        { type: 'content', title: 'Alphabets A-E', status: 'completed', score: null, time: 480 },
        { type: 'quiz', title: 'Vowels & Consonants Quiz', status: 'completed', score: 90, time: 300 },
        { type: 'content', title: 'Numbers 1-20', status: 'completed', score: null, time: 360 },
        { type: 'assignment', title: 'Write your name', status: 'completed', score: 85, time: 600 },
        { type: 'content', title: 'Colours & Shapes', status: 'completed', score: null, time: 420 },
        { type: 'quiz', title: 'Shapes Quiz', status: 'attempted', score: 70, time: 240 },
        { type: 'content', title: 'Fruits & Vegetables', status: 'completed', score: null, time: 300 },
    ];
    for (let i = 0; i < rahulActivities.length; i++) {
        const act = rahulActivities[i];
        const daysAgo = activityDaysRahul[i];
        await db.query(`INSERT INTO student_activity(student_id, organization_id, activity_type, reference_title, status, score, time_spent_seconds, activity_date)
       VALUES($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE - $8::int)`, [rahulId, orgId, act.type, act.title, act.status, act.score, act.time, daysAgo]);
    }
    // Sample activity: Mohan (Class 2) — last 7 days
    const mohanActivities = [
        { type: 'content', title: 'Addition & Subtraction', status: 'completed', score: null, time: 540 },
        { type: 'quiz', title: 'Maths Quiz 1', status: 'completed', score: 80, time: 360 },
        { type: 'content', title: 'Plants and Animals', status: 'completed', score: null, time: 420 },
        { type: 'assignment', title: 'Draw a plant', status: 'pending', score: null, time: 0 },
        { type: 'content', title: 'Sentence Formation', status: 'completed', score: null, time: 300 },
        { type: 'quiz', title: 'English Grammar Quiz', status: 'completed', score: 95, time: 270 },
        { type: 'content', title: 'Multiplication Basics', status: 'attempted', score: null, time: 180 },
    ];
    for (let i = 0; i < mohanActivities.length; i++) {
        const act = mohanActivities[i];
        const daysAgo = activityDaysRahul[i];
        await db.query(`INSERT INTO student_activity(student_id, organization_id, activity_type, reference_title, status, score, time_spent_seconds, activity_date)
       VALUES($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE - $8::int)`, [mohanId, orgId, act.type, act.title, act.status, act.score, act.time, daysAgo]);
    }
    // Seed analytics for both students (last 7 days each)
    const analyticsSeeds = [
        { studentId: rahulId, streak: 7, consistency: 92.5, attempted: 7, completed: 6, notAttempted: 0, totalTime: 2700 },
        { studentId: mohanId, streak: 5, consistency: 78.3, attempted: 6, completed: 5, notAttempted: 1, totalTime: 2070 },
    ];
    for (const a of analyticsSeeds) {
        const completionRate = a.attempted > 0 ? Math.round((a.completed / a.attempted) * 100 * 100) / 100 : 0;
        await db.query(`INSERT INTO student_analytics(student_id, organization_id, analytics_date, streak_days, consistency_score, attempted_count, not_attempted_count, completed_count, completion_rate, total_time_seconds)
       VALUES($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (student_id, analytics_date) DO NOTHING`, [a.studentId, orgId, a.streak, a.consistency, a.attempted, a.notAttempted, a.completed, completionRate, a.totalTime]);
    }
    await db.query(`INSERT INTO subjects (organization_id, cover_image, title, description, author, author_user_id, is_external_author, class_level)
     VALUES
     ($1, $2, $3, $4, $5, NULL, true, $6),
     ($1, $7, $8, $9, $10, NULL, true, $11),
     ($1, $12, $13, $14, $15, NULL, true, $16)`, [
        orgId,
        null,
        'English',
        'Basic language and reading skills',
        'ELS Team',
        '1',
        null,
        'Mathematics',
        'Numbers, counting, and arithmetic foundations',
        'ELS Team',
        '2',
        null,
        'Environmental Studies',
        'Early exposure to nature and surroundings',
        'ELS Team',
        'LKG',
    ]);
    // 4. Seed Sample Quizzes
    // BGM audio URLs pointing to local static media
    const playfulBgm = '/media/bg-audio/eliveta-kids-happy-music-474162.mp3';
    // Quiz 1: Drag & Drop Match
    const quiz1Result = await db.query(`
    INSERT INTO quizzes (organization_id, title, description, class_level, subject, quiz_type, difficulty_level, background_music_url, theme, total_questions, is_published)
    VALUES (
      '${orgId}',
      'Where Do Animals Live?',
      'Help the animals find their homes in this fun matching game!',
      'LKG',
      'Nature',
      'drag_drop',
      'Easy',
      '${playfulBgm}',
      '{"colors": {"primary": "#3b82f6", "background": "#eff6ff"}}',
      1,
      true
    )
    RETURNING id;
  `);
    const quiz1Id = quiz1Result.rows[0].id;
    const dragDropQuestionData = {
        drag_items: [
            { id: 'lion', image: '/media/pictures/lion.png', sound: '/media/sounds/lion.mp3' },
            { id: 'duck', image: '/media/pictures/duck.png', sound: '/media/sounds/duck.mp3' },
            { id: 'owl', image: '/media/pictures/owl.png', sound: '/media/sounds/owl.mp3' },
        ],
        drop_targets: [
            { id: 'lion', label: 'Den (Forest)' },
            { id: 'duck', label: 'Pond (Water)' },
            { id: 'owl', label: 'Nest (Tree)' },
        ],
        match_rules: [
            { drag_item_id: 'lion', drop_target_id: 'lion' },
            { drag_item_id: 'duck', drop_target_id: 'duck' },
            { drag_item_id: 'owl', drop_target_id: 'owl' },
        ],
    };
    await db.query(`
    INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_data, sort_order)
    VALUES (
      '${quiz1Id}',
      'drag_drop',
      'Match Animals to Homes',
      'Drag each animal to where it lives!',
      '${JSON.stringify(dragDropQuestionData)}',
      1
    );
  `);
    // Quiz 2: Image Select (Sound Match)
    const quiz2Result = await db.query(`
    INSERT INTO quizzes (organization_id, title, description, class_level, subject, quiz_type, difficulty_level, background_music_url, theme, total_questions, is_published)
    VALUES (
      '${orgId}',
      'What Animal Sound is That?',
      'Listen to the sound and choose the correct animal!',
      '1',
      'Animals',
      'image_select',
      'Medium',
      '${playfulBgm}',
      '{"colors": {"primary": "#10b981", "background": "#ecfdf5"}}',
      3,
      true
    )
    RETURNING id;
  `);
    const quiz2Id = quiz2Result.rows[0].id;
    const imageSelectData1 = {
        prompt_audio: '/media/sounds/lion.mp3',
        options: [
            { id: 'lion', image: '/media/pictures/lion.png', is_correct: true, label: 'Lion' },
            { id: 'dog', image: '/media/pictures/dog.png', is_correct: false, label: 'Dog' },
            { id: 'cat', image: '/media/pictures/cat.png', is_correct: false, label: 'Cat' },
        ],
    };
    await db.query(`
    INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_audio, question_data, sort_order)
    VALUES (
      '${quiz2Id}',
      'image_select',
      'Roar sound!',
      'Listen and tap the animal that makes this sound.',
      '/media/sounds/lion.mp3',
      '${JSON.stringify(imageSelectData1)}',
      1
    );
  `);
    const imageSelectData2 = {
        prompt_audio: '/media/sounds/dog.mp3',
        options: [
            { id: 'cow', image: '/media/pictures/cow.png', is_correct: false, label: 'Cow' },
            { id: 'dog', image: '/media/pictures/dog.png', is_correct: true, label: 'Dog' },
            { id: 'sheep', image: '/media/pictures/sheep.png', is_correct: false, label: 'Sheep' },
        ],
    };
    await db.query(`
    INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_audio, question_data, sort_order)
    VALUES (
      '${quiz2Id}',
      'image_select',
      'Bark sound!',
      'Listen and tap the animal that makes this sound.',
      '/media/sounds/dog.mp3',
      '${JSON.stringify(imageSelectData2)}',
      2
    );
  `);
    const imageSelectData3 = {
        prompt_audio: '/media/sounds/rooster.mp3',
        options: [
            { id: 'rooster', image: '/media/pictures/rooster.png', is_correct: true, label: 'Rooster' },
            { id: 'duck', image: '/media/pictures/duck.png', is_correct: false, label: 'Duck' },
            { id: 'pig', image: '/media/pictures/pig.png', is_correct: false, label: 'Pig' },
        ],
    };
    await db.query(`
    INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_audio, question_data, sort_order)
    VALUES (
      '${quiz2Id}',
      'image_select',
      'Crow sound!',
      'Listen and tap the animal that makes this sound.',
      '/media/sounds/rooster.mp3',
      '${JSON.stringify(imageSelectData3)}',
      3
    );
  `);
    // Class 1 English: Word Pictures (guess_image)
    const englishQuiz1Result = await db.query(`
    INSERT INTO quizzes (organization_id, title, description, class_level, subject, quiz_type, difficulty_level, background_music_url, theme, total_questions, is_published)
    VALUES (
      '${orgId}',
      'Class 1 English: Word Pictures',
      'Look at the pictures and guess the correct English words!',
      '1',
      'English',
      'guess_image',
      'Easy',
      '${playfulBgm}',
      '{"colors": {"primary": "#3b82f6", "background": "#eff6ff"}}',
      3,
      true
    )
    RETURNING id;
  `);
    const englishQuiz1Id = englishQuiz1Result.rows[0].id;
    const eq1Data = {
        variant: 'guess_image',
        prompt_image: '/media/pictures/elephant.png',
        options: [
            { id: 'elephant', label: 'Elephant', image: '/media/pictures/elephant.png', is_correct: true },
            { id: 'lion', label: 'Lion', image: '/media/pictures/lion.png', is_correct: false },
            { id: 'dog', label: 'Dog', image: '/media/pictures/dog.png', is_correct: false }
        ]
    };
    await db.query(`
    INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_data, sort_order, points)
    VALUES ('${englishQuiz1Id}', 'guess_image', 'Look at the picture', 'Choose the correct animal name.', '${JSON.stringify(eq1Data)}', 1, 10)
  `);
    const eq2Data = {
        variant: 'guess_image',
        prompt_image: '/media/pictures/owl.png',
        options: [
            { id: 'owl', label: 'Owl', image: '/media/pictures/owl.png', is_correct: true },
            { id: 'crow', label: 'Crow', image: '/media/pictures/crow.png', is_correct: false },
            { id: 'rooster', label: 'Rooster', image: '/media/pictures/rooster.png', is_correct: false }
        ]
    };
    await db.query(`
    INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_data, sort_order, points)
    VALUES ('${englishQuiz1Id}', 'guess_image', 'Identify the bird', 'Which bird is shown in the image?', '${JSON.stringify(eq2Data)}', 2, 10)
  `);
    const eq3Data = {
        variant: 'guess_image',
        prompt_image: '/media/pictures/tiger.png',
        options: [
            { id: 'tiger', label: 'Tiger', image: '/media/pictures/tiger.png', is_correct: true },
            { id: 'cat', label: 'Cat', image: '/media/pictures/cat.png', is_correct: false },
            { id: 'horse', label: 'Horse', image: '/media/pictures/horse.png', is_correct: false }
        ]
    };
    await db.query(`
    INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_data, sort_order, points)
    VALUES ('${englishQuiz1Id}', 'guess_image', 'Look at the animal', 'What animal is shown here?', '${JSON.stringify(eq3Data)}', 3, 10)
  `);
    // Class 1 English: Listen & Learn (guess_audio)
    const englishQuiz2Result = await db.query(`
    INSERT INTO quizzes (organization_id, title, description, class_level, subject, quiz_type, difficulty_level, background_music_url, theme, total_questions, is_published)
    VALUES (
      '${orgId}',
      'Class 1 English: Listen & Learn',
      'Listen to the audio clips and choose the correct English words!',
      '1',
      'English',
      'guess_audio',
      'Easy',
      '${playfulBgm}',
      '{"colors": {"primary": "#10b981", "background": "#ecfdf5"}}',
      3,
      true
    )
    RETURNING id;
  `);
    const englishQuiz2Id = englishQuiz2Result.rows[0].id;
    const eq4Data = {
        variant: 'guess_audio',
        prompt_audio: '/media/sounds/lion.mp3',
        options: [
            { id: 'lion', label: 'Lion', is_correct: true },
            { id: 'tiger', label: 'Tiger', is_correct: false },
            { id: 'wolf', label: 'Wolf', is_correct: false }
        ]
    };
    await db.query(`
    INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_audio, question_data, sort_order, points)
    VALUES ('${englishQuiz2Id}', 'guess_audio', 'Listen carefully', 'Which animal name matches the sound?', '/media/sounds/lion.mp3', '${JSON.stringify(eq4Data)}', 1, 10)
  `);
    const eq5Data = {
        variant: 'guess_audio',
        prompt_audio: '/media/sounds/dog.mp3',
        options: [
            { id: 'dog', label: 'Dog', is_correct: true },
            { id: 'cat', label: 'Cat', is_correct: false },
            { id: 'sheep', label: 'Sheep', is_correct: false }
        ]
    };
    await db.query(`
    INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_audio, question_data, sort_order, points)
    VALUES ('${englishQuiz2Id}', 'guess_audio', 'Listen to the animal', 'What animal makes this sound?', '/media/sounds/dog.mp3', '${JSON.stringify(eq5Data)}', 2, 10)
  `);
    const eq6Data = {
        variant: 'guess_audio',
        prompt_audio: '/media/sounds/duck.mp3',
        options: [
            { id: 'duck', label: 'Duck', is_correct: true },
            { id: 'rooster', label: 'Rooster', is_correct: false },
            { id: 'pig', label: 'Pig', is_correct: false }
        ]
    };
    await db.query(`
    INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_audio, question_data, sort_order, points)
    VALUES ('${englishQuiz2Id}', 'guess_audio', 'Listen to the audio', 'Choose the correct word you hear.', '/media/sounds/duck.mp3', '${JSON.stringify(eq6Data)}', 3, 10)
  `);
    await seedTopicsAndContent(orgId);
    await ensureDefaultOrgAndPlanSeeds();
    console.log('Database successfully migrated and seeded with organizations, roles, users, and quizzes.');
}
async function ensureDefaultOrgAndPlanSeeds() {
    await db.query(`INSERT INTO organizations (name, subdomain, settings)
     VALUES ('ELS Default Org', 'default-org', '{"theme":"default"}')
     ON CONFLICT (subdomain) DO NOTHING`);
    await db.query(`INSERT INTO subscription_plans
       (name, description, membership_tier, billing_cycle, base_price, offer_discount_percent, special_discount_percent, group_discount_percent, max_users_for_group_discount, is_active)
     VALUES
       ('Bronze Starter', 'Starter access for schools', 'bronze', 'monthly', 999, 0, 0, 0, 20, true),
       ('Silver Growth', 'Growth plan for active organizations', 'silver', 'monthly', 1999, 10, 5, 5, 25, true),
       ('Gold Pro', 'Advanced features and premium support', 'gold', 'monthly', 3999, 12, 8, 8, 30, true),
       ('Platinum Enterprise', 'Enterprise-grade feature set', 'platinum', 'yearly', 39999, 15, 10, 12, 50, true)
     ON CONFLICT DO NOTHING`);
    await db.query(`INSERT INTO organization_subscriptions (organization_id, status, trial_start_at, trial_end_at, starts_at)
     SELECT o.id, 'trialing', NOW(), NOW() + INTERVAL '14 days', NOW()
     FROM organizations o
     WHERE NOT EXISTS (
       SELECT 1
       FROM organization_subscriptions os
       WHERE os.organization_id = o.id
     )`);
    await ensureSuperAdminDemoUser();
    await ensureAdminDemoUser();
}
async function ensureAdminDemoUser() {
    const passwordHash = await bcrypt.hash('welcome', 10);
    const defaultOrgResult = await db.query(`SELECT id FROM organizations WHERE subdomain = 'default-org' LIMIT 1`);
    const fallbackOrgResult = (defaultOrgResult.rowCount ?? 0) > 0
        ? defaultOrgResult
        : await db.query(`SELECT id FROM organizations WHERE subdomain = 'els-academy' LIMIT 1`);
    const organizationId = fallbackOrgResult.rows[0]?.id;
    if (!organizationId)
        return;
    let userId;
    const existingUser = await db.query(`SELECT id FROM users WHERE email = 'admin@els.ai' LIMIT 1`);
    if ((existingUser.rowCount ?? 0) > 0) {
        userId = existingUser.rows[0].id;
        await db.query(`UPDATE users
       SET first_name = 'ELS',
           last_name = 'Org Admin',
           password_hash = $1,
           active_role = 'admin',
           is_active = true,
           updated_at = NOW()
       WHERE id = $2`, [passwordHash, userId]);
    }
    else {
        const createdUser = await db.query(`INSERT INTO users(first_name, last_name, email, password_hash, active_role)
       VALUES('ELS', 'Org Admin', 'admin@els.ai', $1, 'admin')
       RETURNING id`, [passwordHash]);
        userId = createdUser.rows[0].id;
    }
    const adminRoleResult = await db.query(`SELECT id FROM roles WHERE role_name = 'admin' LIMIT 1`);
    if ((adminRoleResult.rowCount ?? 0) === 0)
        return;
    const adminRoleId = adminRoleResult.rows[0].id;
    await db.query(`INSERT INTO user_roles(user_id, role_id, organization_id)
     VALUES($1, $2, $3)
     ON CONFLICT (user_id, role_id, organization_id) DO NOTHING`, [userId, adminRoleId, organizationId]);
}
async function ensureSuperAdminDemoUser() {
    const passwordHash = await bcrypt.hash('welcome', 10);
    const defaultOrgResult = await db.query(`SELECT id FROM organizations WHERE subdomain = 'default-org' LIMIT 1`);
    const fallbackOrgResult = (defaultOrgResult.rowCount ?? 0) > 0
        ? defaultOrgResult
        : await db.query(`SELECT id FROM organizations WHERE subdomain = 'els-academy' LIMIT 1`);
    const organizationId = fallbackOrgResult.rows[0]?.id;
    if (!organizationId)
        return;
    let userId;
    const existingUser = await db.query(`SELECT id FROM users WHERE email = 'super@els.ai' LIMIT 1`);
    if ((existingUser.rowCount ?? 0) > 0) {
        userId = existingUser.rows[0].id;
        await db.query(`UPDATE users
       SET first_name = 'ELS',
           last_name = 'Super User',
           password_hash = $1,
           active_role = 'superadmin',
           is_active = true,
           updated_at = NOW()
       WHERE id = $2`, [passwordHash, userId]);
    }
    else {
        const createdUser = await db.query(`INSERT INTO users(first_name, last_name, email, password_hash, active_role)
       VALUES('ELS', 'Super User', 'super@els.ai', $1, 'superadmin')
       RETURNING id`, [passwordHash]);
        userId = createdUser.rows[0].id;
    }
    const superRoleResult = await db.query(`SELECT id FROM roles WHERE role_name = 'superadmin' LIMIT 1`);
    if ((superRoleResult.rowCount ?? 0) === 0)
        return;
    const superRoleId = superRoleResult.rows[0].id;
    await db.query(`INSERT INTO user_roles(user_id, role_id, organization_id)
     VALUES($1, $2, $3)
     ON CONFLICT (user_id, role_id, organization_id) DO NOTHING`, [userId, superRoleId, organizationId]);
}
async function seedTopicsAndContent(orgId) {
    // Check if topic exists
    const topicCheck = await db.query("SELECT id FROM content_topics WHERE organization_id = $1 AND class_level = '1' AND subject = 'English' AND title = 'Alphabet Sounds & Phonics' LIMIT 1", [orgId]);
    if ((topicCheck.rowCount ?? 0) > 0) {
        console.log('Class 1 English topics and content already seeded.');
        return;
    }
    console.log('Seeding Class 1 English topics and content...');
    // Topic 1: Alphabet Sounds & Phonics
    const t1 = await db.query(`INSERT INTO content_topics (organization_id, class_level, subject, title, cover_image)
     VALUES ($1, '1', 'English', 'Alphabet Sounds & Phonics', '/media/pictures/alphabet.png')
     RETURNING id`, [orgId]);
    const t1Id = t1.rows[0].id;
    // Content 1.1: Interactive Phonics Guide
    const c11 = await db.query(`INSERT INTO learning_contents (organization_id, class_level, subject, title, content_type, text_content)
     VALUES ($1, '1', 'English', 'Interactive Phonics Guide', 'text', $2)
     RETURNING id`, [orgId, "Welcome to Phonics! Let's learn the sounds of English letters. 'A' says /æ/ as in Apple. 'B' says /b/ as in Ball. 'C' says /k/ as in Cat."]);
    const c11Id = c11.rows[0].id;
    await db.query(`INSERT INTO learning_content_sections (content_id, section_order, content_type, text_content)
     VALUES ($1, 1, 'text', $2)`, [c11Id, "Welcome to Phonics! Let's learn the sounds of English letters. 'A' says /æ/ as in Apple. 'B' says /b/ as in Ball. 'C' says /k/ as in Cat."]);
    await db.query(`INSERT INTO topic_content_assignments (topic_id, content_id, sort_order)
     VALUES ($1, $2, 1)`, [t1Id, c11Id]);
    // Content 1.2: Phonics Audio Practice
    const c12 = await db.query(`INSERT INTO learning_contents (organization_id, class_level, subject, title, content_type, media_url, text_content)
     VALUES ($1, '1', 'English', 'Phonics Audio Practice', 'audio', $2, $3)
     RETURNING id`, [orgId, '/media/bg-audio/eliveta-kids-happy-music-474162.mp3', 'Listen to the sounds of the letters and repeat them aloud.']);
    const c12Id = c12.rows[0].id;
    await db.query(`INSERT INTO learning_content_sections (content_id, section_order, content_type, media_url, text_content)
     VALUES ($1, $2, $3, $4, $5)`, [c12Id, 1, 'audio', '/media/bg-audio/eliveta-kids-happy-music-474162.mp3', 'Listen to the sounds of the letters and repeat them aloud.']);
    await db.query(`INSERT INTO topic_content_assignments (topic_id, content_id, sort_order)
     VALUES ($1, $2, 2)`, [t1Id, c12Id]);
    // Topic 2: Nouns: Naming Words
    const t2 = await db.query(`INSERT INTO content_topics (organization_id, class_level, subject, title, cover_image)
     VALUES ($1, '1', 'English', 'Nouns: Naming Words', '/media/pictures/noun.png')
     RETURNING id`, [orgId]);
    const t2Id = t2.rows[0].id;
    // Content 2.1: Introduction to Naming Words
    const c21 = await db.query(`INSERT INTO learning_contents (organization_id, class_level, subject, title, content_type, text_content)
     VALUES ($1, '1', 'English', 'Introduction to Naming Words', 'text', $2)
     RETURNING id`, [orgId, 'A noun is a naming word. It names a person, place, animal, or thing. Examples: Boy (person), School (place), Dog (animal), Toy (thing).']);
    const c21Id = c21.rows[0].id;
    await db.query(`INSERT INTO learning_content_sections (content_id, section_order, content_type, text_content)
     VALUES ($1, 1, 'text', $2)`, [c21Id, 'A noun is a naming word. It names a person, place, animal, or thing. Examples: Boy (person), School (place), Dog (animal), Toy (thing).']);
    await db.query(`INSERT INTO topic_content_assignments (topic_id, content_id, sort_order)
     VALUES ($1, $2, 1)`, [t2Id, c21Id]);
    // Topic 3: Simple Action Words
    const t3 = await db.query(`INSERT INTO content_topics (organization_id, class_level, subject, title, cover_image)
     VALUES ($1, '1', 'English', 'Simple Action Words', '/media/pictures/verbs.png')
     RETURNING id`, [orgId]);
    const t3Id = t3.rows[0].id;
    // Content 3.1: Action Words (Verbs)
    const c31 = await db.query(`INSERT INTO learning_contents (organization_id, class_level, subject, title, content_type, text_content)
     VALUES ($1, '1', 'English', 'Action Words (Verbs)', 'text', $2)
     RETURNING id`, [orgId, 'Action words tell us what someone or something is doing. Examples: run, jump, read, write, play, sleep.']);
    const c31Id = c31.rows[0].id;
    await db.query(`INSERT INTO learning_content_sections (content_id, section_order, content_type, text_content)
     VALUES ($1, 1, 'text', $2)`, [c31Id, 'Action words tell us what someone or something is doing. Examples: run, jump, read, write, play, sleep.']);
    await db.query(`INSERT INTO topic_content_assignments (topic_id, content_id, sort_order)
     VALUES ($1, $2, 1)`, [t3Id, c31Id]);
    // 1. Alphabet Sounds Quiz (Topic 1)
    const q1Result = await db.query(`INSERT INTO quizzes (organization_id, topic_id, title, description, class_level, subject, quiz_type, difficulty_level, background_music_url, theme, total_questions, is_published)
     VALUES ($1, $2, 'Alphabet Sounds Quiz', 'Listen to phonetic sounds and choose the correct English letter.', '1', 'English', 'guess_audio', 'Easy', '/media/bg-audio/eliveta-kids-happy-music-474162.mp3', '{"colors": {"primary": "#10b981", "background": "#ecfdf5"}}', 2, true)
     RETURNING id`, [orgId, t1Id]);
    const q1Id = q1Result.rows[0].id;
    const q1q1Data = {
        variant: 'guess_audio',
        prompt_audio: '/media/sounds/lion.mp3',
        options: [
            { id: 'lion', label: 'Lion', is_correct: true },
            { id: 'tiger', label: 'Tiger', is_correct: false },
            { id: 'wolf', label: 'Wolf', is_correct: false }
        ]
    };
    await db.query(`INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_audio, question_data, sort_order, points)
     VALUES ($1, 'guess_audio', 'Listen to the sound', 'Which word matches the sound you hear?', '/media/sounds/lion.mp3', $2, 1, 10)`, [q1Id, JSON.stringify(q1q1Data)]);
    const q1q2Data = {
        variant: 'guess_audio',
        prompt_audio: '/media/sounds/dog.mp3',
        options: [
            { id: 'dog', label: 'Dog', is_correct: true },
            { id: 'cat', label: 'Cat', is_correct: false },
            { id: 'sheep', label: 'Sheep', is_correct: false }
        ]
    };
    await db.query(`INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_audio, question_data, sort_order, points)
     VALUES ($1, 'guess_audio', 'Listen carefully', 'Select the correct name of the animal.', '/media/sounds/dog.mp3', $2, 2, 10)`, [q1Id, JSON.stringify(q1q2Data)]);
    // 2. Nouns & Naming Words Quiz (Topic 2)
    const q2Result = await db.query(`INSERT INTO quizzes (organization_id, topic_id, title, description, class_level, subject, quiz_type, difficulty_level, background_music_url, theme, total_questions, is_published)
     VALUES ($1, $2, 'Nouns & Naming Words Quiz', 'Look at the pictures and identify the naming words.', '1', 'English', 'guess_image', 'Easy', '/media/bg-audio/eliveta-kids-happy-music-474162.mp3', '{"colors": {"primary": "#3b82f6", "background": "#eff6ff"}}', 2, true)
     RETURNING id`, [orgId, t2Id]);
    const q2Id = q2Result.rows[0].id;
    const q2q1Data = {
        variant: 'guess_image',
        prompt_image: '/media/pictures/elephant.png',
        options: [
            { id: 'elephant', label: 'Elephant', image: '/media/pictures/elephant.png', is_correct: true },
            { id: 'lion', label: 'Lion', image: '/media/pictures/lion.png', is_correct: false },
            { id: 'dog', label: 'Dog', image: '/media/pictures/dog.png', is_correct: false }
        ]
    };
    await db.query(`INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_data, sort_order, points)
     VALUES ($1, 'guess_image', 'Identify the animal', 'What is the name of this animal?', $2, 1, 10)`, [q2Id, JSON.stringify(q2q1Data)]);
    const q2q2Data = {
        variant: 'guess_image',
        prompt_image: '/media/pictures/owl.png',
        options: [
            { id: 'owl', label: 'Owl', image: '/media/pictures/owl.png', is_correct: true },
            { id: 'crow', label: 'Crow', image: '/media/pictures/crow.png', is_correct: false },
            { id: 'rooster', label: 'Rooster', image: '/media/pictures/rooster.png', is_correct: false }
        ]
    };
    await db.query(`INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_data, sort_order, points)
     VALUES ($1, 'guess_image', 'Name this bird', 'Choose the correct name for this bird.', $2, 2, 10)`, [q2Id, JSON.stringify(q2q2Data)]);
    // 3. Simple Action Words Quiz (Topic 3)
    const q3Result = await db.query(`INSERT INTO quizzes (organization_id, topic_id, title, description, class_level, subject, quiz_type, difficulty_level, background_music_url, theme, total_questions, is_published)
     VALUES ($1, $2, 'Simple Action Words Quiz', 'Look at the animals and identify their actions.', '1', 'English', 'guess_image', 'Easy', '/media/bg-audio/eliveta-kids-happy-music-474162.mp3', '{"colors": {"primary": "#3b82f6", "background": "#eff6ff"}}', 1, true)
     RETURNING id`, [orgId, t3Id]);
    const q3Id = q3Result.rows[0].id;
    const q3q1Data = {
        variant: 'guess_image',
        prompt_image: '/media/pictures/rooster.png',
        options: [
            { id: 'sing', label: 'Crow/Sing', image: '/media/pictures/rooster.png', is_correct: true },
            { id: 'swim', label: 'Swim', image: '/media/pictures/duck.png', is_correct: false },
            { id: 'fly', label: 'Fly', image: '/media/pictures/owl.png', is_correct: false }
        ]
    };
    await db.query(`INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_data, sort_order, points)
     VALUES ($1, 'guess_image', 'Identify the Action', 'What action does the rooster do in the morning?', $2, 1, 10)`, [q3Id, JSON.stringify(q3q1Data)]);
    // 4. Class 1 English: Comprehensive Master Quiz
    const q4Result = await db.query(`INSERT INTO quizzes (organization_id, topic_id, title, description, class_level, subject, quiz_type, difficulty_level, background_music_url, theme, total_questions, is_published)
     VALUES ($1, $2, 'Class 1 English: Comprehensive Master Quiz', 'Challenge yourself with different question types about letters, naming words, and actions!', '1', 'English', 'single_choice', 'Medium', '/media/bg-audio/eliveta-kids-happy-music-474162.mp3', '{"colors": {"primary": "#3b82f6", "background": "#eff6ff"}}', 6, true)
     RETURNING id`, [orgId, t1Id]);
    const q4Id = q4Result.rows[0].id;
    // Q1: guess_image
    const masterQ1Data = {
        variant: 'guess_image',
        prompt_image: '/media/pictures/elephant.png',
        options: [
            { id: 'elephant', label: 'Elephant', image: '/media/pictures/elephant.png', is_correct: true },
            { id: 'lion', label: 'Lion', image: '/media/pictures/lion.png', is_correct: false },
            { id: 'dog', label: 'Dog', image: '/media/pictures/dog.png', is_correct: false }
        ]
    };
    await db.query(`INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_data, sort_order, points)
     VALUES ($1, 'guess_image', 'Look at the picture', 'Choose the correct animal name.', $2, 1, 10)`, [q4Id, JSON.stringify(masterQ1Data)]);
    // Q2: guess_audio
    const masterQ2Data = {
        variant: 'guess_audio',
        prompt_audio: '/media/sounds/lion.mp3',
        options: [
            { id: 'lion', label: 'Lion', is_correct: true },
            { id: 'tiger', label: 'Tiger', is_correct: false },
            { id: 'wolf', label: 'Wolf', is_correct: false }
        ]
    };
    await db.query(`INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_audio, question_data, sort_order, points)
     VALUES ($1, 'guess_audio', 'Listen carefully', 'Which animal name matches the sound?', '/media/sounds/lion.mp3', $2, 2, 10)`, [q4Id, JSON.stringify(masterQ2Data)]);
    // Q3: true_false
    const masterQ3Data = {
        options: [
            { id: 'true', label: 'True', is_correct: true },
            { id: 'false', label: 'False', is_correct: false }
        ]
    };
    await db.query(`INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_data, sort_order, points)
     VALUES ($1, 'true_false', 'Is a dog a pet animal?', 'Choose True or False.', $2, 3, 10)`, [q4Id, JSON.stringify(masterQ3Data)]);
    // Q4: single_choice
    const masterQ4Data = {
        options: [
            { id: 'apple', label: 'Apple', is_correct: true },
            { id: 'ball', label: 'Ball', is_correct: false },
            { id: 'cat', label: 'Cat', is_correct: false },
            { id: 'dog', label: 'Dog', is_correct: false }
        ]
    };
    await db.query(`INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_data, sort_order, points)
     VALUES ($1, 'single_choice', 'Which word starts with the letter A?', 'Choose the correct option.', $2, 4, 10)`, [q4Id, JSON.stringify(masterQ4Data)]);
    // Q5: multi_choice
    const masterQ5Data = {
        options: [
            { id: 'a', label: 'A', is_correct: true },
            { id: 'e', label: 'E', is_correct: true },
            { id: 'b', label: 'B', is_correct: false },
            { id: 't', label: 'T', is_correct: false }
        ]
    };
    await db.query(`INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_data, sort_order, points)
     VALUES ($1, 'multi_choice', 'Identify the Vowels', 'Select all the vowels from the list below.', $2, 5, 10)`, [q4Id, JSON.stringify(masterQ5Data)]);
    // Q6: drag_drop_match
    const masterQ6Data = {
        drag_items: [
            { id: 'lion', image: '/media/pictures/lion.png', sound: '/media/sounds/lion.mp3' },
            { id: 'duck', image: '/media/pictures/duck.png', sound: '/media/sounds/duck.mp3' },
            { id: 'owl', image: '/media/pictures/owl.png', sound: '/media/sounds/owl.mp3' },
        ],
        drop_targets: [
            { id: 'lion', label: 'Den (Forest)' },
            { id: 'duck', label: 'Pond (Water)' },
            { id: 'owl', label: 'Nest (Tree)' },
        ],
        match_rules: [
            { drag_item_id: 'lion', drop_target_id: 'lion' },
            { drag_item_id: 'duck', drop_target_id: 'duck' },
            { drag_item_id: 'owl', drop_target_id: 'owl' },
        ],
    };
    await db.query(`INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_data, sort_order, points)
     VALUES ($1, 'drag_drop_match', 'Match Animals to Homes', 'Drag each animal to where it lives!', $2, 6, 10)`, [q4Id, JSON.stringify(masterQ6Data)]);
    console.log('Seeded Class 1 English topics, content, and quizzes successfully!');
}
