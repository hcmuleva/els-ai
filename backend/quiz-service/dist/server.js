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
            await db.query(`ALTER TABLE learning_content_sections ADD COLUMN IF NOT EXISTS title VARCHAR(255);`);
            await db.query(`ALTER TABLE topic_content_sections ADD COLUMN IF NOT EXISTS title VARCHAR(255);`);
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
            // ── Classroom lifecycle: ended_at timestamp ────────────────────────────
            await db.query(`ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP;`);
            // ── Teacher remarks + scores per student per classroom ─────────────────
            await db.query(`
        CREATE TABLE IF NOT EXISTS classroom_student_remarks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
          student_id UUID NOT NULL,
          teacher_id UUID NOT NULL,
          remark_text TEXT,
          parent_note TEXT,
          score_behavior INTEGER CHECK (score_behavior BETWEEN 1 AND 5),
          score_confidence INTEGER CHECK (score_confidence BETWEEN 1 AND 5),
          score_participation INTEGER CHECK (score_participation BETWEEN 1 AND 5),
          score_performance INTEGER CHECK (score_performance BETWEEN 1 AND 5),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(classroom_id, student_id)
        );
      `);
            // ── Remark media (image/doc visible to parents) ────────────────────────
            await db.query(`ALTER TABLE classroom_student_remarks ADD COLUMN IF NOT EXISTS remark_media_url TEXT;`);
            // ── Pre-configured achievement catalogue ───────────────────────────────
            await db.query(`
        CREATE TABLE IF NOT EXISTS achievements (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id UUID,
          name VARCHAR(100) NOT NULL,
          emoji VARCHAR(20) NOT NULL,
          description TEXT,
          color VARCHAR(20) NOT NULL DEFAULT '#4A90E2',
          is_global BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
            // ── Student achievement grants (one per student+classroom+achievement) ──
            await db.query(`
        CREATE TABLE IF NOT EXISTS student_achievements (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          student_id UUID NOT NULL,
          classroom_id UUID REFERENCES classrooms(id) ON DELETE CASCADE,
          achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
          granted_by UUID NOT NULL,
          granted_at TIMESTAMP DEFAULT NOW()
        );
      `);
            // ── Deduplicate global achievements and map grants to canonical rows ───
            await db.query(`
        WITH ranked AS (
          SELECT id,
                 FIRST_VALUE(id) OVER (
                   PARTITION BY COALESCE(organization_id::text, 'global'),
                                LOWER(name),
                                is_global
                   ORDER BY created_at ASC, id ASC
                 ) AS keep_id
          FROM achievements
        ),
        remap AS (
          SELECT id, keep_id
          FROM ranked
          WHERE id <> keep_id
        )
        UPDATE student_achievements sa
        SET achievement_id = remap.keep_id
        FROM remap
        WHERE sa.achievement_id = remap.id;
      `);
            await db.query(`
        WITH ranked AS (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY COALESCE(organization_id::text, 'global'),
                                LOWER(name),
                                is_global
                   ORDER BY created_at ASC, id ASC
                 ) AS rn
          FROM achievements
        )
        DELETE FROM achievements a
        USING ranked r
        WHERE a.id = r.id AND r.rn > 1;
      `);
            await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_achievements_unique_identity
          ON achievements (
            COALESCE(organization_id::text, 'global'),
            LOWER(name),
            is_global
          );
      `);
            // ── Deduplicate grants and enforce uniqueness ──────────────────────────
            await db.query(`
        DELETE FROM student_achievements sa
        USING student_achievements dupe
        WHERE sa.ctid < dupe.ctid
          AND sa.student_id = dupe.student_id
          AND sa.classroom_id = dupe.classroom_id
          AND sa.achievement_id = dupe.achievement_id;
      `);
            await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_student_achievements_unique
          ON student_achievements (student_id, classroom_id, achievement_id);
      `);
            // ── Seed global achievements (once) ───────────────────────────────────
            await db.query(`
        INSERT INTO achievements (name, emoji, description, color, is_global)
        VALUES
          ('Best Performer',     '🏆', 'Outstanding performance in class',              '#E6A817', true),
          ('Top Scorer',         '⭐', 'Highest quiz score in the session',             '#FF7043', true),
          ('Consistent Learner', '📚', 'Regularly completes tasks and quizzes',         '#4A90E2', true),
          ('Creative Thinker',   '💡', 'Shows creative problem-solving',                '#9B8EC4', true),
          ('Quick Solver',       '⚡', 'Completes assignments faster than average',     '#7DC67A', true),
          ('Team Player',        '🤝', 'Collaborates and helps classmates',             '#E91E8C', true),
          ('Star Student',       '🌟', 'All-round excellent student',                   '#FF9800', true),
          ('Most Improved',      '📈', 'Showed the most improvement this session',      '#00BCD4', true)
        ON CONFLICT DO NOTHING;
      `);
            break;
        }
        catch (error) {
            retries--;
            if (retries === 0)
                throw error;
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
