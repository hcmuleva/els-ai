import bcrypt from 'bcryptjs';
import { db } from './db.js';

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

    // Also seed subjects if they are missing
    const subjectsCheck = await db.query("SELECT 1 FROM subjects LIMIT 1");
    if ((subjectsCheck.rowCount ?? 0) === 0) {
      // Find ELS Academy organization ID
      const orgRes = await db.query("SELECT id FROM organizations WHERE subdomain = 'els-academy' LIMIT 1");
      if ((orgRes.rowCount ?? 0) > 0) {
        const orgId = orgRes.rows[0].id;
        await db.query(
          `INSERT INTO subjects (organization_id, cover_image, title, description, author, author_user_id, is_external_author, class_level)
           VALUES
           ($1, $2, $3, $4, $5, NULL, true, $6),
           ($1, $7, $8, $9, $10, NULL, true, $11),
           ($1, $12, $13, $14, $15, NULL, true, $16)
           ON CONFLICT (organization_id, class_level, title) DO NOTHING`,
          [
            orgId,
            null, 'English', 'Basic language and reading skills', 'ELS Team', '1',
            null, 'Mathematics', 'Numbers, counting, and arithmetic foundations', 'ELS Team', '2',
            null, 'Environmental Studies', 'Early exposure to nature and surroundings', 'ELS Team', 'LKG'
          ]
        );
      }
    }

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
  const roles = ['student', 'teacher', 'parent', 'admin', 'superadmin'] as const;
  const roleIdMap: Record<string, string> = {};
  for (const role of roles) {
    const roleInsert = await db.query(
      'INSERT INTO roles(role_name) VALUES($1) RETURNING id',
      [role]
    );
    roleIdMap[role] = roleInsert.rows[0].id;
  }

  // 3. Seed Users
  const passwordHash = await bcrypt.hash('welcome', 10);
  const userSeeds = [
    {
      firstName: 'ELS',
      lastName: 'Super User',
      email: 'super@els.ai',
      activeRole: 'student',
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
  ] as const;

  for (const seedUser of userSeeds) {
    const userInsert = await db.query(
      `INSERT INTO users(first_name, last_name, email, password_hash, active_role, class_level)
       VALUES($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [seedUser.firstName, seedUser.lastName, seedUser.email, passwordHash, seedUser.activeRole, seedUser.classLevel || null]
    );
    const userId = userInsert.rows[0].id;

    for (const roleName of seedUser.assignedRoles) {
      const roleId = roleIdMap[roleName];
      await db.query(
        `INSERT INTO user_roles(user_id, role_id, organization_id)
         VALUES($1, $2, $3)`,
        [userId, roleId, orgId]
      );
    }
  }

  await db.query(
    `INSERT INTO subjects (organization_id, cover_image, title, description, author, author_user_id, is_external_author, class_level)
     VALUES
     ($1, $2, $3, $4, $5, NULL, true, $6),
     ($1, $7, $8, $9, $10, NULL, true, $11),
     ($1, $12, $13, $14, $15, NULL, true, $16)`,
    [
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
    ],
  );

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
      'KG',
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
      'Class 1',
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

  console.log('Database successfully migrated and seeded with organizations, roles, users, and quizzes.');
}
