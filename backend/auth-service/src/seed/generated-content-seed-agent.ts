import type { PoolClient } from 'pg';

export interface VideoItemPayload {
  videoId?: string;
  title?: string;
  url?: string;
  embedUrl?: string;
  validated?: boolean;
}

export interface VideoDumpPayload {
  subject?: string;
  topic?: string;
  class_level?: string;
  videos?: VideoItemPayload[];
}

export interface QuestionItemPayload {
  questionType: string;
  questionTitle?: string;
  questionInstruction?: string;
  points?: number;
  sortOrder?: number;
  questionData?: Record<string, unknown> | unknown[];
}

export interface QuestionDumpPayload {
  subject?: string;
  topic?: string;
  class_level?: string;
  difficulty_level?: string;
  questions_api_payload?: QuestionItemPayload[];
}

export interface TopicSeedBundle {
  classLevel: string;
  subject: string;
  topic: string;
  videoDump: VideoDumpPayload;
  questionDump: QuestionDumpPayload;
}

export interface SeedRunOptions {
  organizationId: string;
  createdBy?: string | null;
  dryRun?: boolean;
}

export interface SeedRunSummary {
  subjectsCreated: number;
  topicsCreated: number;
  contentsCreated: number;
  contentsReused: number;
  quizzesCreated: number;
  questionsCreated: number;
  questionTopicLinksCreated: number;
  bundlesProcessed: number;
}

type SupportedQuizType =
  | 'drag_drop'
  | 'image_select'
  | 'sound_match'
  | 'memory_game'
  | 'drag_drop_match'
  | 'guess_image'
  | 'guess_audio'
  | 'true_false'
  | 'single_choice'
  | 'multi_choice'
  | 'memory_match'
  | 'fill_blank'
  | 'logico'
  | 'jigsaw';

const SUPPORTED_QUIZ_TYPES = new Set<SupportedQuizType>([
  'drag_drop',
  'image_select',
  'sound_match',
  'memory_game',
  'drag_drop_match',
  'guess_image',
  'guess_audio',
  'true_false',
  'single_choice',
  'multi_choice',
  'memory_match',
  'fill_blank',
  'logico',
  'jigsaw',
]);

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeLower(value: unknown): string {
  return normalize(value).toLowerCase();
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function toQuizType(value: unknown): SupportedQuizType {
  const raw = normalizeLower(value);
  if (raw === 'jigsaw_puzzle') return 'jigsaw';
  if (SUPPORTED_QUIZ_TYPES.has(raw as SupportedQuizType)) {
    return raw as SupportedQuizType;
  }
  return 'single_choice';
}

export class GeneratedContentSeedAgent {
  private readonly summary: SeedRunSummary = {
    subjectsCreated: 0,
    topicsCreated: 0,
    contentsCreated: 0,
    contentsReused: 0,
    quizzesCreated: 0,
    questionsCreated: 0,
    questionTopicLinksCreated: 0,
    bundlesProcessed: 0,
  };

  private readonly tableColumns = new Map<string, Set<string>>();

  constructor(
    private readonly client: PoolClient,
    private readonly options: SeedRunOptions,
  ) {}

  async seedBundles(bundles: TopicSeedBundle[]): Promise<SeedRunSummary> {
    await this.loadColumns('subjects');
    await this.loadColumns('content_topics');
    await this.loadColumns('learning_contents');
    await this.loadColumns('learning_content_sections');
    await this.loadColumns('quizzes');
    await this.loadColumns('quiz_questions');
    await this.ensureTopicQuestionAssignmentsTable();

    for (const bundle of bundles) {
      await this.client.query('BEGIN');
      try {
        await this.seedBundle(bundle);
        if (this.options.dryRun) {
          await this.client.query('ROLLBACK');
        } else {
          await this.client.query('COMMIT');
        }
      } catch (error) {
        await this.client.query('ROLLBACK');
        throw error;
      }
    }

    return { ...this.summary };
  }

  private async seedBundle(bundle: TopicSeedBundle): Promise<void> {
    const subjectId = await this.ensureSubject(bundle.classLevel, bundle.subject);
    const topicId = await this.ensureTopic(bundle.classLevel, subjectId, bundle.topic);
    const quizId = await this.ensureQuiz(
      bundle.classLevel,
      subjectId,
      topicId,
      bundle.topic,
      bundle.questionDump.difficulty_level,
      bundle.questionDump.questions_api_payload || [],
    );

    await this.replaceQuizQuestions(
      topicId,
      quizId,
      bundle.questionDump.questions_api_payload || [],
    );
    await this.upsertVideoContents(
      topicId,
      bundle.classLevel,
      subjectId,
      bundle.videoDump.videos || [],
    );
    this.summary.bundlesProcessed += 1;
  }

  private async ensureTopicQuestionAssignmentsTable(): Promise<void> {
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS topic_question_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        topic_id UUID NOT NULL REFERENCES content_topics(id) ON DELETE CASCADE,
        quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (topic_id, question_id)
      );
    `);
    await this.client.query(
      `CREATE INDEX IF NOT EXISTS idx_topic_question_assignments_topic ON topic_question_assignments(topic_id)`,
    );
    await this.client.query(
      `CREATE INDEX IF NOT EXISTS idx_topic_question_assignments_quiz ON topic_question_assignments(quiz_id)`,
    );
    await this.client.query(
      `CREATE INDEX IF NOT EXISTS idx_topic_question_assignments_question ON topic_question_assignments(question_id)`,
    );
    await this.client.query(`ALTER TABLE topic_question_assignments ENABLE ROW LEVEL SECURITY`);
    await this.client.query(`
      DROP POLICY IF EXISTS topic_question_assignments_tenant_select ON topic_question_assignments;
    `);
    await this.client.query(`
      DROP POLICY IF EXISTS topic_question_assignments_tenant_modify ON topic_question_assignments;
    `);
    await this.client.query(`
      CREATE POLICY topic_question_assignments_tenant_select ON topic_question_assignments
        FOR SELECT
        USING (
          app_current_org() IS NULL OR EXISTS (
            SELECT 1
            FROM content_topics ct
            WHERE ct.id = topic_question_assignments.topic_id
              AND (ct.organization_id = app_current_org() OR ct.is_global = true)
          )
        );
    `);
    await this.client.query(`
      CREATE POLICY topic_question_assignments_tenant_modify ON topic_question_assignments
        FOR ALL
        USING (
          app_current_org() IS NULL OR EXISTS (
            SELECT 1
            FROM content_topics ct
            WHERE ct.id = topic_question_assignments.topic_id
              AND ct.organization_id = app_current_org()
          )
        )
        WITH CHECK (
          app_current_org() IS NULL OR EXISTS (
            SELECT 1
            FROM content_topics ct
            WHERE ct.id = topic_question_assignments.topic_id
              AND ct.organization_id = app_current_org()
          )
        );
    `);
  }

  private async loadColumns(table: string): Promise<void> {
    const result = await this.client.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    this.tableColumns.set(
      table,
      new Set(result.rows.map((row) => row.column_name)),
    );
  }

  private hasColumn(table: string, column: string): boolean {
    return this.tableColumns.get(table)?.has(column) ?? false;
  }

  private async ensureSubject(classLevel: string, subject: string): Promise<string> {
    const existing = await this.client.query<{ id: string }>(
      `SELECT id
       FROM subjects
       WHERE organization_id = $1::uuid
         AND class_level = $2
         AND LOWER(title) = LOWER($3)
       LIMIT 1`,
      [this.options.organizationId, classLevel, subject],
    );
    if ((existing.rowCount ?? 0) > 0) return existing.rows[0].id;

    const insert = await this.client.query<{ id: string }>(
      `INSERT INTO subjects (
         organization_id, title, description, author, is_external_author, class_level
       )
       VALUES ($1::uuid, $2, $3, 'ELS AI Seeder', true, $4)
       RETURNING id`,
      [
        this.options.organizationId,
        subject,
        `Auto-seeded subject for ${classLevel}`,
        classLevel,
      ],
    );
    this.summary.subjectsCreated += 1;
    return insert.rows[0].id;
  }

  private async ensureTopic(
    classLevel: string,
    subjectId: string,
    topic: string,
  ): Promise<string> {
    const existing = await this.client.query<{ id: string }>(
      `SELECT id
       FROM content_topics
       WHERE organization_id = $1::uuid
         AND class_level = $2
         AND subject_id = $3::uuid
         AND LOWER(title) = LOWER($4)
       LIMIT 1`,
      [this.options.organizationId, classLevel, subjectId, topic],
    );
    if ((existing.rowCount ?? 0) > 0) return existing.rows[0].id;

    const columns = ['organization_id', 'class_level', 'subject_id', 'title'];
    const values: unknown[] = [
      this.options.organizationId,
      classLevel,
      subjectId,
      topic,
    ];
    if (this.hasColumn('content_topics', 'created_by')) {
      columns.push('created_by');
      values.push(this.options.createdBy ?? null);
    }
    if (this.hasColumn('content_topics', 'is_global')) {
      columns.push('is_global');
      values.push(false);
    }

    const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
    const inserted = await this.client.query<{ id: string }>(
      `INSERT INTO content_topics (${columns.join(', ')})
       VALUES (${placeholders})
       RETURNING id`,
      values,
    );
    this.summary.topicsCreated += 1;
    return inserted.rows[0].id;
  }

  private async ensureQuiz(
    classLevel: string,
    subjectId: string,
    topicId: string,
    topic: string,
    difficultyLevel: string | undefined,
    questions: QuestionItemPayload[],
  ): Promise<string> {
    const quizTitle = `${topic} - Auto Seed Quiz`;
    const existing = await this.client.query<{ id: string }>(
      `SELECT id
       FROM quizzes
       WHERE organization_id = $1::uuid
         AND class_level = $2
         AND subject_id = $3::uuid
         AND topic_id = $4::uuid
         AND LOWER(title) = LOWER($5)
       LIMIT 1`,
      [this.options.organizationId, classLevel, subjectId, topicId, quizTitle],
    );

    const quizType = toQuizType(questions[0]?.questionType || 'single_choice');
    const resolvedDifficulty = normalize(difficultyLevel) || 'medium';

    if ((existing.rowCount ?? 0) > 0) {
      const quizId = existing.rows[0].id;
      await this.client.query(
        `UPDATE quizzes
         SET quiz_type = $1,
             difficulty_level = $2,
             total_questions = $3,
             is_published = true,
             is_ai_generated = true,
             updated_at = NOW()
         WHERE id = $4`,
        [quizType, resolvedDifficulty, questions.length, quizId],
      );
      return quizId;
    }

    const columns = [
      'organization_id',
      'topic_id',
      'title',
      'description',
      'class_level',
      'subject_id',
      'quiz_type',
      'difficulty_level',
      'theme',
      'total_questions',
      'is_published',
      'is_ai_generated',
    ];
    const values: unknown[] = [
      this.options.organizationId,
      topicId,
      quizTitle,
      `Auto-seeded quiz for topic ${topic}`,
      classLevel,
      subjectId,
      quizType,
      resolvedDifficulty,
      JSON.stringify({ source: 'content_generator_seed' }),
      questions.length,
      true,
      true,
    ];
    if (this.hasColumn('quizzes', 'created_by')) {
      columns.push('created_by');
      values.push(this.options.createdBy ?? null);
    }
    if (this.hasColumn('quizzes', 'is_global')) {
      columns.push('is_global');
      values.push(false);
    }

    const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
    const inserted = await this.client.query<{ id: string }>(
      `INSERT INTO quizzes (${columns.join(', ')})
       VALUES (${placeholders})
       RETURNING id`,
      values,
    );
    this.summary.quizzesCreated += 1;
    return inserted.rows[0].id;
  }

  private async replaceQuizQuestions(
    topicId: string,
    quizId: string,
    questions: QuestionItemPayload[],
  ): Promise<void> {
    await this.client.query(
      `DELETE FROM topic_question_assignments WHERE quiz_id = $1::uuid`,
      [quizId],
    );
    await this.client.query(
      `DELETE FROM quiz_questions WHERE quiz_id = $1::uuid`,
      [quizId],
    );

    for (let index = 0; index < questions.length; index += 1) {
      const item = questions[index];
      const sortOrder = Number(item.sortOrder || index + 1);
      const questionDataBase = asObject(item.questionData);
      const existingMeta = asObject(questionDataBase._meta);
      const questionData = {
        ...questionDataBase,
        _meta: {
          ...existingMeta,
          organizationId: this.options.organizationId,
          seedSource: 'content_generator',
        },
      };

      const inserted = await this.client.query<{ id: string }>(
        `INSERT INTO quiz_questions (
           quiz_id, question_type, question_title, question_instruction,
           points, sort_order, question_data
         )
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb)
         RETURNING id`,
        [
          quizId,
          normalize(item.questionType) || 'single_choice',
          normalize(item.questionTitle) || null,
          normalize(item.questionInstruction) || null,
          Number(item.points ?? 10),
          sortOrder,
          JSON.stringify(questionData),
        ],
      );

      await this.client.query(
        `INSERT INTO topic_question_assignments (topic_id, quiz_id, question_id, sort_order)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4)
         ON CONFLICT (topic_id, question_id)
         DO UPDATE SET
           quiz_id = EXCLUDED.quiz_id,
           sort_order = EXCLUDED.sort_order`,
        [topicId, quizId, inserted.rows[0].id, sortOrder],
      );

      this.summary.questionsCreated += 1;
      this.summary.questionTopicLinksCreated += 1;
    }

    await this.client.query(
      `UPDATE quizzes SET total_questions = $1, updated_at = NOW() WHERE id = $2::uuid`,
      [questions.length, quizId],
    );
  }

  private async upsertVideoContents(
    topicId: string,
    classLevel: string,
    subjectId: string,
    videos: VideoItemPayload[],
  ): Promise<void> {
    for (let index = 0; index < videos.length; index += 1) {
      const video = videos[index];
      const url = normalize(video.url || video.embedUrl);
      if (!url) continue;

      const existing = await this.client.query<{ content_id: string }>(
        `SELECT lc.id AS content_id
         FROM topic_content_assignments tca
         INNER JOIN learning_contents lc ON lc.id = tca.content_id
         WHERE tca.topic_id = $1::uuid
           AND LOWER(COALESCE(lc.external_url, '')) = LOWER($2)
         LIMIT 1`,
        [topicId, url],
      );

      let contentId: string;
      if ((existing.rowCount ?? 0) > 0) {
        contentId = existing.rows[0].content_id;
        this.summary.contentsReused += 1;
      } else {
        const contentTitle = normalize(video.title) || `Video ${index + 1}`;
        const contentColumns = [
          'organization_id',
          'class_level',
          'subject_id',
          'title',
          'content_type',
          'external_url',
          'text_content',
        ];
        const contentValues: unknown[] = [
          this.options.organizationId,
          classLevel,
          subjectId,
          contentTitle,
          'youtube_url',
          url,
          contentTitle,
        ];
        if (this.hasColumn('learning_contents', 'created_by')) {
          contentColumns.push('created_by');
          contentValues.push(this.options.createdBy ?? null);
        }
        if (this.hasColumn('learning_contents', 'is_global')) {
          contentColumns.push('is_global');
          contentValues.push(false);
        }
        const placeholders = contentValues.map((_, idx) => `$${idx + 1}`).join(', ');
        const insertedContent = await this.client.query<{ id: string }>(
          `INSERT INTO learning_contents (${contentColumns.join(', ')})
           VALUES (${placeholders})
           RETURNING id`,
          contentValues,
        );
        contentId = insertedContent.rows[0].id;
        this.summary.contentsCreated += 1;

        const sectionColumns = ['content_id', 'section_order', 'content_type', 'external_url', 'text_content'];
        const sectionValues: unknown[] = [contentId, 1, 'youtube_url', url, contentTitle];
        if (this.hasColumn('learning_content_sections', 'title')) {
          sectionColumns.push('title');
          sectionValues.push('Video');
        }
        if (this.hasColumn('learning_content_sections', 'quiz_id')) {
          sectionColumns.push('quiz_id');
          sectionValues.push(null);
        }
        const sectionPlaceholders = sectionValues.map((_, idx) => `$${idx + 1}`).join(', ');
        await this.client.query(
          `INSERT INTO learning_content_sections (${sectionColumns.join(', ')})
           VALUES (${sectionPlaceholders})`,
          sectionValues,
        );
      }

      await this.client.query(
        `INSERT INTO topic_content_assignments (topic_id, content_id, sort_order)
         VALUES ($1::uuid, $2::uuid, $3)
         ON CONFLICT (topic_id, content_id)
         DO UPDATE SET sort_order = EXCLUDED.sort_order`,
        [topicId, contentId, index + 1],
      );
    }
  }
}
