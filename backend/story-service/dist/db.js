import { config } from 'dotenv';
import { Pool } from 'pg';
import { z } from 'zod';
import { wrapPoolWithTenancy } from '@els-ai/db-tenant';
config();
const envSchema = z.object({
    DB_HOST: z.string().default('localhost'),
    DB_PORT: z.coerce.number().default(5432),
    DB_USER: z.string().default('postgres'),
    DB_PASSWORD: z.string().default('postgres'),
    DB_NAME: z.string().default('els_ai_db'),
});
const env = envSchema.parse(process.env);
const pool = new Pool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
});
export const db = wrapPoolWithTenancy(pool);
export async function ensureSchema() {
    await db.query(`
    CREATE TABLE IF NOT EXISTS stories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL,
      title text NOT NULL,
      description text,
      cover_image_url text,
      class_level text,
      scheduled_at timestamptz,
      ended_at timestamptz,
      status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','live','ended')),
      created_by uuid NOT NULL,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS stories_org_status_idx ON stories (organization_id, status);
    CREATE INDEX IF NOT EXISTS stories_scheduled_idx ON stories (scheduled_at) WHERE status = 'scheduled';

    CREATE TABLE IF NOT EXISTS story_sections (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      title text NOT NULL,
      body_text text,
      media jsonb NOT NULL DEFAULT '[]'::jsonb,
      quiz_id uuid,
      order_index int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS story_sections_story_order_idx ON story_sections (story_id, order_index);

    CREATE TABLE IF NOT EXISTS story_progress (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      story_id uuid NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      current_section_id uuid,
      completed_section_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
      started_at timestamptz NOT NULL DEFAULT NOW(),
      completed_at timestamptz,
      last_active_at timestamptz NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, story_id)
    );
    CREATE INDEX IF NOT EXISTS story_progress_user_idx ON story_progress (user_id);

    ALTER TABLE IF EXISTS quizzes ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'subject';
    ALTER TABLE IF EXISTS stories ADD COLUMN IF NOT EXISTS published_at timestamptz;
    CREATE INDEX IF NOT EXISTS stories_live_published_idx ON stories (published_at) WHERE status = 'live';
  `);
}
