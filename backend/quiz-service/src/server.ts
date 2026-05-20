import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { db } from './db.js';
import { quizzesRouter } from './routes/quizzes.js';

config();

const PORT = process.env.PORT || 4002;
const app = express();

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'quiz-service' });
});

app.use('/quizzes', quizzesRouter);

async function bootstrap() {
  let retries = 5;
  while (retries > 0) {
    try {
      await db.query(`
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
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS classrooms (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('instant', 'scheduled')),
          start_time TIMESTAMP,
          duration_minutes INTEGER NOT NULL DEFAULT 0,
          class_level VARCHAR(50) NOT NULL,
          created_by UUID NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      await db.query(`ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS organization_id UUID;`);
      await db.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_name = 'users'
          )
          AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'users'
              AND column_name = 'id'
          )
          AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'users'
              AND column_name = 'organization_id'
          )
          AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'classrooms'
              AND column_name = 'created_by'
          ) THEN
            EXECUTE '
              UPDATE classrooms c
              SET organization_id = u.organization_id
              FROM users u
              WHERE c.organization_id IS NULL
                AND u.id = c.created_by
                AND u.organization_id IS NOT NULL
            ';
          END IF;
        END $$;
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS classroom_contents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
          content_id UUID REFERENCES learning_contents(id) ON DELETE CASCADE,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(classroom_id, content_id)
        );
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS classroom_quizzes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
          quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(classroom_id, quiz_id)
        );
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS classroom_assignments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          attachment_url TEXT,
          instructions TEXT,
          due_date TIMESTAMP,
          is_time_bound BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      await db.query(`
        CREATE TABLE IF NOT EXISTS classroom_assignment_submissions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          classroom_assignment_id UUID REFERENCES classroom_assignments(id) ON DELETE CASCADE,
          student_id UUID NOT NULL,
          submission_text TEXT,
          attachment_url TEXT,
          submitted_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(classroom_assignment_id, student_id)
        );
      `);
      break;
    } catch (error) {
      retries--;
      if (retries === 0) throw error;
      console.log('Database tables not ready yet, retrying in 2 seconds...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  app.listen(PORT, () => {
    console.log(`Quiz Service listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch(async (error) => {
  console.error('Quiz Service bootstrap failed:', error);
  await db.end();
  process.exit(1);
});
