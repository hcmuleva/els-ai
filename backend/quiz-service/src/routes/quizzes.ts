import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getSignedMediaUrlIfNeeded, toPersistentMediaUrl, uploadMediaToS3 } from '../services/s3.js';

export const quizzesRouter = Router();

// Zod schemas for validation
const createQuizSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  classLevel: z.string().optional(),
  subject: z.string().optional(),
  quizType: z.enum([
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
  ]),
  difficultyLevel: z.string().optional(),
  backgroundMusicUrl: z.string().optional(),
  theme: z.any().default({}),
  isPublished: z.boolean().default(false),
  isAiGenerated: z.boolean().default(false),
});

const createQuestionSchema = z.object({
  questionType: z.string(),
  questionTitle: z.string().optional(),
  questionInstruction: z.string().optional(),
  questionAudio: z.string().optional(),
  timeLimitSeconds: z.number().default(30),
  points: z.number().default(10),
  sortOrder: z.number().optional(),
  questionData: z.any(),
});

const recordAttemptSchema = z.object({
  quizId: z.string().uuid(),
  score: z.number(),
  totalPoints: z.number(),
  questionAttempts: z.array(z.object({
    questionId: z.string().uuid(),
    isCorrect: z.boolean(),
    responseData: z.any().optional(),
    timeSpentSeconds: z.number().optional(),
  })),
});

const teacherLibraryQuerySchema = z.object({
  search: z.string().trim().optional(),
  class_level: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  quiz_type: z
    .enum([
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
    ])
    .optional(),
  difficulty_level: z.string().trim().optional(),
  status: z.enum(['all', 'published', 'draft']).default('all'),
  source: z.enum(['all', 'ai', 'manual']).default('all'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const publishSchema = z.object({
  isPublished: z.boolean(),
});

const questionManagementQuerySchema = z.object({
  search: z.string().trim().optional(),
  class_level: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  category: z.string().trim().optional(),
  quiz_type: z.string().trim().optional(),
  quiz_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const questionBankQuerySchema = z.object({
  search: z.string().trim().optional(),
  class_level: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  question_type: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(300).default(120),
});

const reuseQuestionSchema = z.object({
  sourceQuestionId: z.string().uuid(),
});

const uploadMediaSchema = z.object({
  dataUrl: z.string().trim().min(1),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().optional(),
  mediaType: z.enum(['image', 'audio', 'video']),
});

const contentTypeSchema = z.enum(['reel', 'image', 'text', 'audio', 'youtube_url', 'reel_url']);

const listContentTopicsQuerySchema = z.object({
  class_level: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(300).default(100),
});
const listSubjectCatalogQuerySchema = z.object({
  class_level: z.string().trim().optional(),
});

const createContentTopicSchema = z.object({
  classLevel: z.string().trim().min(1).max(50),
  subject: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(255),
  coverImage: z.string().trim().optional(),
});

const updateContentTopicSchema = z
  .object({
    classLevel: z.string().trim().min(1).max(50).optional(),
    subject: z.string().trim().min(1).max(255).optional(),
    title: z.string().trim().min(1).max(255).optional(),
    coverImage: z.string().trim().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one field must be provided',
  });

const contentSectionSchema = z
  .object({
    contentType: contentTypeSchema,
    mediaUrl: z.string().trim().optional(),
    externalUrl: z.string().trim().optional(),
    textContent: z.string().trim().optional(),
  })
  .refine(
    (value) => {
      if (value.contentType === 'text') return !!value.textContent?.trim();
      if (value.contentType === 'youtube_url' || value.contentType === 'reel_url') return !!value.externalUrl?.trim();
      return !!value.mediaUrl?.trim();
    },
    { message: 'Missing required field for selected content type' },
  );

const replaceTopicSectionsSchema = z.object({
  sections: z.array(contentSectionSchema).min(1).max(300),
});
const createLearningContentSchema = z.object({
  classLevel: z.string().trim().min(1).max(50),
  subject: z.string().trim().min(1).max(255),
  topicId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(255),
  contentType: contentTypeSchema.optional(),
  mediaUrl: z.string().trim().optional(),
  externalUrl: z.string().trim().optional(),
  textContent: z.string().trim().optional(),
  sections: z.array(contentSectionSchema).min(1).max(300).optional(),
});
const updateLearningContentSchema = z.object({
  classLevel: z.string().trim().min(1).max(50),
  subject: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(255),
  contentType: contentTypeSchema.optional(),
  mediaUrl: z.string().trim().optional(),
  externalUrl: z.string().trim().optional(),
  textContent: z.string().trim().optional(),
  sections: z.array(contentSectionSchema).min(1).max(300).optional(),
});
const listLearningContentQuerySchema = z.object({
  class_level: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  topic_id: z.string().uuid().optional(),
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
const updateTopicAssignmentsSchema = z.object({
  contentIds: z.array(z.string().uuid()).default([]),
});

const updateQuestionSchema = z
  .object({
    questionType: z.string().trim().optional(),
    questionTitle: z.string().trim().optional(),
    questionInstruction: z.string().trim().optional(),
    questionAudio: z.string().trim().optional(),
    timeLimitSeconds: z.number().int().min(1).max(600).optional(),
    points: z.number().int().min(0).max(1000).optional(),
    sortOrder: z.number().int().min(0).max(10000).optional(),
    questionData: z.any().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one field must be provided',
  });

const createManagedQuestionSchema = z.object({
  quizId: z.string().uuid().optional(),
  classLevel: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  questionType: z.string().trim().min(1),
  questionTitle: z.string().trim().min(1),
  questionInstruction: z.string().trim().optional(),
  questionAudio: z.string().trim().optional(),
  timeLimitSeconds: z.number().int().min(1).max(600).default(30),
  points: z.number().int().min(0).max(1000).default(10),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  questionData: z.any().default({}),
});

function getOrganizationId(req: any): string | null {
  return req?.user?.organizationId || null;
}

function canBypassOwnership(req: any): boolean {
  const role = req?.user?.role;
  return role === 'admin' || role === 'superadmin';
}

function canManageTeacherContent(req: any): boolean {
  const role = req?.user?.role;
  return role === 'teacher' || role === 'admin' || role === 'superadmin';
}

function normalizeLearningContentSections(payload: {
  sections?: Array<{ contentType: string; mediaUrl?: string; externalUrl?: string; textContent?: string }>;
  contentType?: string;
  mediaUrl?: string;
  externalUrl?: string;
  textContent?: string;
}) {
  if (Array.isArray(payload.sections) && payload.sections.length > 0) {
    return payload.sections.map((section) => ({
      contentType: section.contentType as z.infer<typeof contentTypeSchema>,
      mediaUrl: section.mediaUrl?.trim() ? toPersistentMediaUrl(section.mediaUrl.trim()) : null,
      externalUrl: section.externalUrl?.trim() || null,
      textContent: section.textContent?.trim() || null,
    }));
  }
  if (!payload.contentType) return [];
  return [
    {
      contentType: payload.contentType as z.infer<typeof contentTypeSchema>,
      mediaUrl: payload.mediaUrl?.trim() ? toPersistentMediaUrl(payload.mediaUrl.trim()) : null,
      externalUrl: payload.externalUrl?.trim() || null,
      textContent: payload.textContent?.trim() || null,
    },
  ];
}

async function ensureTopicEditPermission(
  topicId: string,
  orgId: string,
  userId: string,
  req: any,
): Promise<{ allowed: boolean; exists: boolean }> {
  const result = await db.query(
    `SELECT id, created_by
     FROM content_topics
     WHERE id = $1
       AND organization_id = $2::uuid`,
    [topicId, orgId],
  );
  if ((result.rowCount ?? 0) === 0) {
    return { allowed: false, exists: false };
  }

  const createdBy = result.rows[0].created_by as string | null;
  if (canBypassOwnership(req) || !createdBy || createdBy === userId) {
    return { allowed: true, exists: true };
  }
  return { allowed: false, exists: true };
}

async function ensureQuizEditPermission(
  quizId: string,
  orgId: string,
  userId: string,
  req: any,
): Promise<{ allowed: boolean; exists: boolean }> {
  const quizResult = await db.query(
    `SELECT id, created_by FROM quizzes WHERE id = $1 AND organization_id = $2::uuid`,
    [quizId, orgId],
  );
  if ((quizResult.rowCount ?? 0) === 0) {
    return { allowed: false, exists: false };
  }
  const createdBy = quizResult.rows[0].created_by as string | null;
  if (canBypassOwnership(req) || !createdBy || createdBy === userId) {
    return { allowed: true, exists: true };
  }
  return { allowed: false, exists: true };
}

async function ensureQuestionEditPermission(
  questionId: string,
  orgId: string,
  userId: string,
  req: any,
): Promise<{ allowed: boolean; exists: boolean }> {
  const questionResult = await db.query(
    `SELECT qq.id, q.created_by, qq.question_data
     FROM quiz_questions qq
     LEFT JOIN quizzes q ON q.id = qq.quiz_id
     WHERE qq.id = $1
       AND (
         q.organization_id = $2::uuid
         OR COALESCE(qq.question_data->'_meta'->>'organizationId', '') = $2::text
       )`,
    [questionId, orgId],
  );
  if ((questionResult.rowCount ?? 0) === 0) {
    return { allowed: false, exists: false };
  }

  const quizCreator = questionResult.rows[0].created_by as string | null;
  const questionData = questionResult.rows[0].question_data as Record<string, any> | null;
  const questionCreator = questionData?._meta?.creatorId as string | undefined;

  if (canBypassOwnership(req) || quizCreator === userId || questionCreator === userId) {
    return { allowed: true, exists: true };
  }
  return { allowed: false, exists: true };
}

async function signMediaValue(value: unknown, cache: Map<string, Promise<string>>): Promise<unknown> {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || (!trimmed.includes('://') && !trimmed.startsWith('s3://'))) {
      return value;
    }
    let pending = cache.get(trimmed);
    if (!pending) {
      pending = getSignedMediaUrlIfNeeded(trimmed).catch(() => trimmed);
      cache.set(trimmed, pending);
    }
    return pending;
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => signMediaValue(item, cache)));
  }

  if (value && typeof value === 'object') {
    const entries = await Promise.all(
      Object.entries(value as Record<string, unknown>).map(async ([key, nestedValue]) => {
        const signedNestedValue = await signMediaValue(nestedValue, cache);
        return [key, signedNestedValue] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  return value;
}

async function signQuestionRowMedia(row: Record<string, unknown>, cache: Map<string, Promise<string>>) {
  const signedQuestionAudio = await signMediaValue(row.question_audio, cache);
  const signedQuestionData = await signMediaValue(row.question_data, cache);
  return {
    ...row,
    question_audio: signedQuestionAudio,
    question_data: signedQuestionData,
  };
}

async function signQuestionRowsMedia(rows: Record<string, unknown>[]) {
  const cache = new Map<string, Promise<string>>();
  return Promise.all(rows.map((row) => signQuestionRowMedia(row, cache)));
}

// Teacher-accessible catalog: fetch all class levels & subjects from admin-created subjects table
quizzesRouter.get('/catalog/subjects', requireAuth, async (req: any, res) => {
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  try {
    const result = await db.query(
      `SELECT class_level, title AS subject
       FROM subjects
       WHERE organization_id = $1::uuid
       ORDER BY class_level ASC, title ASC`,
      [orgId],
    );
    const classLevels = [...new Set(result.rows.map((r: any) => r.class_level as string))];
    const subjects = [...new Set(result.rows.map((r: any) => r.subject as string))];
    return res.json({ classLevels, subjects, items: result.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch subject catalog' });
  }
});

quizzesRouter.post('/uploads/media', requireAuth, async (req: any, res) => {
  const parsedBody = uploadMediaSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid media upload payload', errors: parsedBody.error.issues });
  }

  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const { dataUrl, fileName, mimeType, mediaType } = parsedBody.data;
  try {
    const uploaded = await uploadMediaToS3({
      organizationId: orgId,
      dataUrl,
      fileName,
      mimeType,
      mediaType,
    });
    return res.status(201).json(uploaded);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload media to S3';
    const isClientError =
      message.includes('Invalid upload format') ||
      message.includes('Invalid upload payload') ||
      message.includes('not an image') ||
      message.includes('not an audio');
    return res.status(isClientError ? 400 : 500).json({ message });
  }
});

quizzesRouter.get('/', requireAuth, async (req: any, res) => {
  const { class_level, subject } = req.query;
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  try {
    let queryStr = `
      SELECT id, title, description, thumbnail_image, class_level, subject, quiz_type, difficulty_level, background_music_url, theme, total_questions, is_published, is_ai_generated, created_at
      FROM quizzes
      WHERE organization_id = $1::uuid AND is_published = true
    `;
    const params: unknown[] = [orgId];

    if (class_level) {
      params.push(class_level);
      queryStr += ` AND class_level = $${params.length}`;
    }

    if (subject) {
      params.push(subject);
      queryStr += ` AND subject = $${params.length}`;
    }

    queryStr += ` ORDER BY created_at DESC`;

    const result = await db.query(queryStr, params);
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch quizzes' });
  }
});

quizzesRouter.get('/teacher/library', requireAuth, async (req: any, res) => {
  const parsedQuery = teacherLibraryQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid query filters', errors: parsedQuery.error.issues });
  }

  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const { search, class_level, subject, quiz_type, difficulty_level, status, source, limit } = parsedQuery.data;
  const params: unknown[] = [orgId];
  const whereClauses: string[] = ['organization_id = $1::uuid'];

  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(`(title ILIKE $${params.length} OR COALESCE(description, '') ILIKE $${params.length})`);
  }
  if (class_level) {
    params.push(class_level);
    whereClauses.push(`class_level = $${params.length}`);
  }
  if (subject) {
    params.push(subject);
    whereClauses.push(`subject = $${params.length}`);
  }
  if (quiz_type) {
    params.push(quiz_type);
    whereClauses.push(`quiz_type = $${params.length}`);
  }
  if (difficulty_level) {
    params.push(difficulty_level);
    whereClauses.push(`difficulty_level = $${params.length}`);
  }
  if (status === 'published') {
    whereClauses.push('is_published = true');
  } else if (status === 'draft') {
    whereClauses.push('is_published = false');
  }
  if (source === 'ai') {
    whereClauses.push('is_ai_generated = true');
  } else if (source === 'manual') {
    whereClauses.push('is_ai_generated = false');
  }

  params.push(limit);

  try {
    const result = await db.query(
      `SELECT id, title, description, class_level, subject, quiz_type, difficulty_level, total_questions, is_published, is_ai_generated, created_at
       FROM quizzes
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    return res.json({ quizzes: result.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to load teacher quiz library' });
  }
});

quizzesRouter.get('/teacher/overview', requireAuth, async (req: any, res) => {
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  try {
    const summaryResult = await db.query(
      `SELECT
         COUNT(q.id) AS total_quizzes,
         COUNT(*) FILTER (WHERE q.is_published = true) AS published_quizzes,
         COUNT(*) FILTER (WHERE q.is_ai_generated = true) AS ai_generated_quizzes,
         COUNT(sa.id) AS total_attempts,
         COALESCE(ROUND(AVG((sa.score::numeric / NULLIF(sa.total_points, 0)) * 100), 2), 0) AS average_score_pct
       FROM quizzes q
       LEFT JOIN student_attempts sa ON sa.quiz_id = q.id
       WHERE q.organization_id = $1::uuid`,
      [orgId],
    );

    const classPerformanceResult = await db.query(
      `SELECT
         COALESCE(q.class_level, 'Unassigned') AS class_level,
         COUNT(sa.id) AS attempts,
         COALESCE(ROUND(AVG((sa.score::numeric / NULLIF(sa.total_points, 0)) * 100), 2), 0) AS average_score_pct
       FROM quizzes q
       LEFT JOIN student_attempts sa ON sa.quiz_id = q.id
       WHERE q.organization_id = $1::uuid
       GROUP BY q.class_level
       ORDER BY attempts DESC, class_level ASC
       LIMIT 8`,
      [orgId],
    );

    const difficultyMixResult = await db.query(
      `SELECT
         COALESCE(difficulty_level, 'unspecified') AS difficulty_level,
         COUNT(*) AS quiz_count
       FROM quizzes
       WHERE organization_id = $1::uuid
       GROUP BY difficulty_level
       ORDER BY quiz_count DESC`,
      [orgId],
    );

    const topGapResult = await db.query(
      `SELECT
         qq.id AS question_id,
         COALESCE(NULLIF(qq.question_title, ''), qq.question_instruction, 'Untitled question') AS question_title,
         q.title AS quiz_title,
         COUNT(qa.id) AS attempts,
         ROUND(AVG(CASE WHEN qa.is_correct THEN 0 ELSE 1 END) * 100, 2) AS incorrect_pct
       FROM question_attempts qa
       INNER JOIN quiz_questions qq ON qq.id = qa.question_id
       INNER JOIN quizzes q ON q.id = qq.quiz_id
       WHERE q.organization_id = $1::uuid
       GROUP BY qq.id, qq.question_title, qq.question_instruction, q.title
       HAVING COUNT(qa.id) > 0
       ORDER BY incorrect_pct DESC, attempts DESC
       LIMIT 6`,
      [orgId],
    );

    const recentQuizzesResult = await db.query(
      `SELECT id, title, class_level, subject, quiz_type, difficulty_level, total_questions, is_published, is_ai_generated, created_at
       FROM quizzes
       WHERE organization_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 8`,
      [orgId],
    );

    return res.json({
      summary: summaryResult.rows[0],
      classPerformance: classPerformanceResult.rows,
      difficultyMix: difficultyMixResult.rows,
      topGaps: topGapResult.rows,
      recentQuizzes: recentQuizzesResult.rows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to load teacher overview data' });
  }
});

quizzesRouter.get('/questions', requireAuth, async (req: any, res) => {
  const parsedQuery = questionManagementQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid question filter payload', errors: parsedQuery.error.issues });
  }

  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const { search, class_level, subject, category, quiz_type, quiz_id, limit } = parsedQuery.data;
  const params: unknown[] = [orgId];
  const whereClauses: string[] = [
    `(q.organization_id = $1::uuid OR COALESCE(qq.question_data->'_meta'->>'organizationId', '') = $1::text)`,
  ];

  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(
      `(COALESCE(qq.question_title, '') ILIKE $${params.length}
        OR COALESCE(qq.question_instruction, '') ILIKE $${params.length}
        OR COALESCE(q.title, '') ILIKE $${params.length})`,
    );
  }
  if (class_level) {
    params.push(class_level);
    whereClauses.push(`COALESCE(q.class_level, qq.question_data->'_meta'->>'classLevel', '') = $${params.length}`);
  }
  if (subject) {
    params.push(subject);
    whereClauses.push(`COALESCE(q.subject, qq.question_data->'_meta'->>'subject', '') = $${params.length}`);
  }
  if (quiz_type) {
    params.push(quiz_type);
    whereClauses.push(`COALESCE(q.quiz_type, '') = $${params.length}`);
  }
  if (category) {
    params.push(category);
    whereClauses.push(`qq.question_type = $${params.length}`);
  }
  if (quiz_id) {
    params.push(quiz_id);
    whereClauses.push(`qq.quiz_id = $${params.length}`);
  }

  params.push(limit);

  try {
    const result = await db.query(
      `SELECT
         qq.id,
         qq.quiz_id,
         COALESCE(q.title, 'Question Bank') AS quiz_title,
         COALESCE(q.class_level, qq.question_data->'_meta'->>'classLevel') AS class_level,
         COALESCE(q.subject, qq.question_data->'_meta'->>'subject') AS subject,
         COALESCE(q.quiz_type, qq.question_type) AS quiz_type,
         qq.question_type,
         qq.question_title,
         qq.question_instruction,
         qq.question_audio,
         qq.time_limit_seconds,
         qq.points,
         qq.sort_order,
         qq.question_data,
         qq.created_at
       FROM quiz_questions qq
       LEFT JOIN quizzes q ON q.id = qq.quiz_id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY qq.created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    const signedRows = await signQuestionRowsMedia(result.rows as Record<string, unknown>[]);
    return res.json({ questions: signedRows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch questions' });
  }
});

quizzesRouter.get('/question-bank', requireAuth, async (req: any, res) => {
  const parsedQuery = questionBankQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid question bank filters', errors: parsedQuery.error.issues });
  }

  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const { search, class_level, subject, question_type, limit } = parsedQuery.data;
  const params: unknown[] = [orgId];
  const whereClauses: string[] = [
    `(q.organization_id = $1::uuid OR COALESCE(qq.question_data->'_meta'->>'organizationId', '') = $1::text)`,
  ];

  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(
      `(COALESCE(qq.question_title, '') ILIKE $${params.length}
        OR COALESCE(qq.question_instruction, '') ILIKE $${params.length}
        OR COALESCE(q.title, '') ILIKE $${params.length})`,
    );
  }
  if (class_level) {
    params.push(class_level);
    whereClauses.push(`COALESCE(q.class_level, qq.question_data->'_meta'->>'classLevel', '') = $${params.length}`);
  }
  if (subject) {
    params.push(subject);
    whereClauses.push(`COALESCE(q.subject, qq.question_data->'_meta'->>'subject', '') = $${params.length}`);
  }
  if (question_type) {
    params.push(question_type);
    whereClauses.push(`qq.question_type = $${params.length}`);
  }

  params.push(limit);

  try {
    const result = await db.query(
      `SELECT
         qq.id,
         qq.quiz_id,
         COALESCE(q.title, 'Question Bank') AS quiz_title,
         COALESCE(q.class_level, qq.question_data->'_meta'->>'classLevel') AS class_level,
         COALESCE(q.subject, qq.question_data->'_meta'->>'subject') AS subject,
         qq.question_type,
         qq.question_title,
         qq.question_instruction,
         qq.question_audio,
         qq.time_limit_seconds,
         qq.points,
         qq.sort_order,
         qq.question_data,
         q.created_by AS quiz_created_by,
         qq.created_at
       FROM quiz_questions qq
       LEFT JOIN quizzes q ON q.id = qq.quiz_id
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY qq.created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    const signedRows = await signQuestionRowsMedia(result.rows as Record<string, unknown>[]);
    return res.json({ questions: signedRows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to load question bank' });
  }
});

quizzesRouter.post('/:quizId/questions/reuse', requireAuth, async (req: any, res) => {
  const { quizId } = req.params;
  const parsedBody = reuseQuestionSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid reuse payload', errors: parsedBody.error.issues });
  }

  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }
  const userId = req.user.userId as string;

  const permission = await ensureQuizEditPermission(quizId, orgId, userId, req);
  if (!permission.exists) {
    return res.status(404).json({ message: 'Quiz not found' });
  }
  if (!permission.allowed) {
    return res.status(403).json({ message: 'Only quiz creator can edit this quiz' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const sourceResult = await client.query(
      `SELECT qq.*
       FROM quiz_questions qq
       LEFT JOIN quizzes q ON q.id = qq.quiz_id
       WHERE qq.id = $1
         AND (
           q.organization_id = $2::uuid
           OR COALESCE(qq.question_data->'_meta'->>'organizationId', '') = $2::text
         )`,
      [parsedBody.data.sourceQuestionId, orgId],
    );
    if ((sourceResult.rowCount ?? 0) === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Source question not found' });
    }

    const source = sourceResult.rows[0];
    const sourceData = source.question_data && typeof source.question_data === 'object' ? source.question_data : {};
    const creatorId = (sourceData as Record<string, any>)._meta?.creatorId || userId;
    const clonedQuestionData = {
      ...sourceData,
      _meta: {
        ...((sourceData as Record<string, any>)._meta || {}),
        creatorId,
      },
    };

    const insertResult = await client.query(
      `INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_audio, time_limit_seconds, points, sort_order, question_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8)
       RETURNING id`,
      [
        quizId,
        source.question_type,
        source.question_title,
        source.question_instruction,
        source.question_audio,
        source.time_limit_seconds,
        source.points,
        clonedQuestionData,
      ],
    );

    await client.query(
      `UPDATE quizzes
       SET total_questions = total_questions + 1, updated_at = NOW()
       WHERE id = $1`,
      [quizId],
    );

    const createdId = insertResult.rows[0].id as string;
    const createdResult = await client.query(
      `SELECT
         qq.id,
         qq.quiz_id,
         q.title AS quiz_title,
         q.class_level,
         q.subject,
         q.quiz_type,
         qq.question_type,
         qq.question_title,
         qq.question_instruction,
         qq.question_audio,
         qq.time_limit_seconds,
         qq.points,
         qq.sort_order,
         qq.question_data,
         qq.created_at
       FROM quiz_questions qq
       INNER JOIN quizzes q ON q.id = qq.quiz_id
       WHERE qq.id = $1`,
      [createdId],
    );

    await client.query('COMMIT');
    const signedCreatedRow = await signQuestionRowMedia(
      createdResult.rows[0] as Record<string, unknown>,
      new Map<string, Promise<string>>(),
    );
    return res.status(201).json(signedCreatedRow);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ message: 'Failed to reuse question' });
  } finally {
    client.release();
  }
});

quizzesRouter.post('/questions', requireAuth, async (req: any, res) => {
  const parsedBody = createManagedQuestionSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid question create payload', errors: parsedBody.error.issues });
  }

  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }
  const userId = req.user.userId as string;

  const {
    quizId,
    classLevel,
    subject,
    questionType,
    questionTitle,
    questionInstruction,
    questionAudio,
    timeLimitSeconds,
    points,
    sortOrder,
    questionData,
  } = parsedBody.data;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    if (quizId) {
      const permission = await ensureQuizEditPermission(quizId, orgId, userId, req);
      if (!permission.exists) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Quiz not found' });
      }
      if (!permission.allowed) {
        await client.query('ROLLBACK');
        return res.status(403).json({ message: 'Only quiz creator can edit this quiz' });
      }

      const quizExists = await client.query(
        `SELECT 1 FROM quizzes WHERE id = $1 AND organization_id = $2::uuid`,
        [quizId, orgId],
      );
      if ((quizExists.rowCount ?? 0) === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Quiz not found' });
      }
    }

    const preparedQuestionData =
      questionData && typeof questionData === 'object' && !Array.isArray(questionData)
        ? {
            ...questionData,
            _meta: {
              ...((questionData as Record<string, any>)._meta || {}),
              creatorId: userId,
              organizationId: orgId,
              classLevel: classLevel || null,
              subject: subject || null,
            },
          }
        : { payload: questionData, _meta: { creatorId: userId, organizationId: orgId, classLevel: classLevel || null, subject: subject || null } };

    const insertResult = await client.query(
      `INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_audio, time_limit_seconds, points, sort_order, question_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        quizId || null,
        questionType,
        questionTitle,
        questionInstruction || null,
        questionAudio || null,
        timeLimitSeconds,
        points,
        sortOrder ?? null,
        preparedQuestionData,
      ],
    );
    const questionId = insertResult.rows[0].id as string;

    if (quizId) {
      await client.query(
        `UPDATE quizzes
         SET total_questions = total_questions + 1, updated_at = NOW()
         WHERE id = $1`,
        [quizId],
      );
    }

    const result = await client.query(
      `SELECT
         qq.id,
         qq.quiz_id,
         COALESCE(q.title, 'Question Bank') AS quiz_title,
         q.class_level,
         q.subject,
         COALESCE(q.quiz_type, qq.question_type) AS quiz_type,
         qq.question_type,
         qq.question_title,
         qq.question_instruction,
         qq.question_audio,
         qq.time_limit_seconds,
         qq.points,
         qq.sort_order,
         qq.question_data,
         qq.created_at
       FROM quiz_questions qq
       LEFT JOIN quizzes q ON q.id = qq.quiz_id
       WHERE qq.id = $1`,
      [questionId],
    );

    await client.query('COMMIT');
    const signedCreatedRow = await signQuestionRowMedia(
      result.rows[0] as Record<string, unknown>,
      new Map<string, Promise<string>>(),
    );
    return res.status(201).json(signedCreatedRow);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ message: 'Failed to create question' });
  } finally {
    client.release();
  }
});

quizzesRouter.patch('/questions/:questionId', requireAuth, async (req: any, res) => {
  const { questionId } = req.params;
  const parsedBody = updateQuestionSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid question update payload', errors: parsedBody.error.issues });
  }

  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  try {
    const userId = req.user.userId as string;
    const permission = await ensureQuestionEditPermission(questionId, orgId, userId, req);
    if (!permission.exists) {
      return res.status(404).json({ message: 'Question not found' });
    }
    if (!permission.allowed) {
      return res.status(403).json({ message: 'Only original creator or quiz creator can edit this question' });
    }

    const {
      questionType,
      questionTitle,
      questionInstruction,
      questionAudio,
      timeLimitSeconds,
      points,
      sortOrder,
      questionData,
    } = parsedBody.data;

    const updates: string[] = [];
    const params: unknown[] = [];

    if (questionType !== undefined) {
      params.push(questionType);
      updates.push(`question_type = $${params.length}`);
    }
    if (questionTitle !== undefined) {
      params.push(questionTitle || null);
      updates.push(`question_title = $${params.length}`);
    }
    if (questionInstruction !== undefined) {
      params.push(questionInstruction || null);
      updates.push(`question_instruction = $${params.length}`);
    }
    if (questionAudio !== undefined) {
      params.push(questionAudio || null);
      updates.push(`question_audio = $${params.length}`);
    }
    if (timeLimitSeconds !== undefined) {
      params.push(timeLimitSeconds);
      updates.push(`time_limit_seconds = $${params.length}`);
    }
    if (points !== undefined) {
      params.push(points);
      updates.push(`points = $${params.length}`);
    }
    if (sortOrder !== undefined) {
      params.push(sortOrder);
      updates.push(`sort_order = $${params.length}`);
    }
    if (questionData !== undefined) {
      params.push(questionData);
      updates.push(`question_data = $${params.length}`);
    }

    params.push(questionId);

    await db.query(
      `UPDATE quiz_questions
       SET ${updates.join(', ')}
       WHERE id = $${params.length}`,
      params,
    );

    const result = await db.query(
      `SELECT
         qq.id,
         qq.quiz_id,
         COALESCE(q.title, 'Question Bank') AS quiz_title,
         q.class_level,
         q.subject,
         COALESCE(q.quiz_type, qq.question_type) AS quiz_type,
         qq.question_type,
         qq.question_title,
         qq.question_instruction,
         qq.question_audio,
         qq.time_limit_seconds,
         qq.points,
         qq.sort_order,
         qq.question_data,
         qq.created_at
       FROM quiz_questions qq
       LEFT JOIN quizzes q ON q.id = qq.quiz_id
       WHERE qq.id = $1`,
      [questionId],
    );

    const signedRow = await signQuestionRowMedia(
      result.rows[0] as Record<string, unknown>,
      new Map<string, Promise<string>>(),
    );
    return res.json(signedRow);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to update question' });
  }
});

quizzesRouter.delete('/questions/:questionId', requireAuth, async (req: any, res) => {
  const { questionId } = req.params;
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const userId = req.user.userId as string;
    const permission = await ensureQuestionEditPermission(questionId, orgId, userId, req);
    if (!permission.exists) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Question not found' });
    }
    if (!permission.allowed) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Only original creator or quiz creator can delete this question' });
    }

    const targetResult = await client.query(
      `SELECT qq.id, qq.quiz_id
       FROM quiz_questions qq
       LEFT JOIN quizzes q ON q.id = qq.quiz_id
       WHERE qq.id = $1
         AND (
           q.organization_id = $2::uuid
           OR COALESCE(qq.question_data->'_meta'->>'organizationId', '') = $2::text
         )`,
      [questionId, orgId],
    );
    if ((targetResult.rowCount ?? 0) === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Question not found' });
    }

    const quizId = targetResult.rows[0].quiz_id as string | null;

    await client.query(`DELETE FROM quiz_questions WHERE id = $1`, [questionId]);
    if (quizId) {
      await client.query(
        `UPDATE quizzes
         SET total_questions = GREATEST(total_questions - 1, 0), updated_at = NOW()
         WHERE id = $1`,
        [quizId],
      );
    }

    await client.query('COMMIT');
    return res.json({ success: true, message: 'Question deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ message: 'Failed to delete question' });
  } finally {
    client.release();
  }
});

quizzesRouter.get('/bgm', async (_req, res) => {
  const bgmList = [
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  ];
  const randomBgm = bgmList[Math.floor(Math.random() * bgmList.length)];
  return res.json({ url: randomBgm });
});

quizzesRouter.get('/:id', requireAuth, async (req: any, res) => {
  const { id } = req.params;
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  try {
    const quizResult = await db.query(
      `SELECT * FROM quizzes WHERE id = $1 AND organization_id = $2::uuid`,
      [id, orgId],
    );

    if ((quizResult.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const quiz = quizResult.rows[0];
    const questionsResult = await db.query(
      `SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [id],
    );
    const signedQuestions = await signQuestionRowsMedia(questionsResult.rows as Record<string, unknown>[]);

    return res.json({
      ...quiz,
      questions: signedQuestions,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch quiz details' });
  }
});

quizzesRouter.post('/', requireAuth, async (req: any, res) => {
  const parsed = createQuizSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
  }

  const { title, description, classLevel, subject, quizType, difficultyLevel, backgroundMusicUrl, theme, isPublished, isAiGenerated } = parsed.data;
  const orgId = getOrganizationId(req);
  const userId = req.user.userId;
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  try {
    const result = await db.query(
      `INSERT INTO quizzes (organization_id, title, description, class_level, subject, quiz_type, difficulty_level, background_music_url, theme, is_published, is_ai_generated, created_by)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [orgId, title, description || null, classLevel || null, subject || null, quizType, difficultyLevel || null, backgroundMusicUrl || null, theme, isPublished, isAiGenerated, userId],
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to create quiz' });
  }
});

quizzesRouter.patch('/:id/publish', requireAuth, async (req: any, res) => {
  const { id } = req.params;
  const parsed = publishSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
  }

  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }
  const userId = req.user.userId as string;

  try {
    const permission = await ensureQuizEditPermission(id, orgId, userId, req);
    if (!permission.exists) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    if (!permission.allowed) {
      return res.status(403).json({ message: 'Only quiz creator can update this quiz' });
    }

    const result = await db.query(
      `UPDATE quizzes
       SET is_published = $1, updated_at = NOW()
       WHERE id = $2 AND organization_id = $3::uuid
       RETURNING id, title, class_level, subject, quiz_type, difficulty_level, total_questions, is_published, is_ai_generated, created_at, updated_at`,
      [parsed.data.isPublished, id, orgId],
    );

    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to update quiz publish status' });
  }
});

quizzesRouter.post('/:id/questions', requireAuth, async (req: any, res) => {
  const { id } = req.params;
  const parsed = createQuestionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
  }

  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }
  const userId = req.user.userId as string;

  const { questionType, questionTitle, questionInstruction, questionAudio, timeLimitSeconds, points, sortOrder, questionData } = parsed.data;

  try {
    const permission = await ensureQuizEditPermission(id, orgId, userId, req);
    if (!permission.exists) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    if (!permission.allowed) {
      return res.status(403).json({ message: 'Only quiz creator can edit this quiz' });
    }

    const quizExists = await db.query(
      'SELECT 1 FROM quizzes WHERE id = $1 AND organization_id = $2::uuid',
      [id, orgId],
    );
    if ((quizExists.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const preparedQuestionData =
      questionData && typeof questionData === 'object' && !Array.isArray(questionData)
        ? {
            ...questionData,
            _meta: {
              ...((questionData as Record<string, any>)._meta || {}),
              creatorId: userId,
            },
          }
        : { payload: questionData, _meta: { creatorId: userId } };

    const result = await db.query(
      `INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_audio, time_limit_seconds, points, sort_order, question_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, questionType, questionTitle || null, questionInstruction || null, questionAudio || null, timeLimitSeconds, points, sortOrder || null, preparedQuestionData],
    );

    await db.query(
      `UPDATE quizzes SET total_questions = total_questions + 1, updated_at = NOW() WHERE id = $1`,
      [id],
    );

    const signedCreatedRow = await signQuestionRowMedia(
      result.rows[0] as Record<string, unknown>,
      new Map<string, Promise<string>>(),
    );
    return res.status(201).json(signedCreatedRow);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to create question' });
  }
});

quizzesRouter.get('/content/subjects', requireAuth, async (req: any, res) => {
  const parsedQuery = listSubjectCatalogQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid subject filters', errors: parsedQuery.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const { class_level } = parsedQuery.data;
  const params: unknown[] = [orgId];
  const whereClauses: string[] = ['organization_id = $1::uuid'];
  if (class_level) {
    params.push(class_level);
    whereClauses.push(`class_level = $${params.length}`);
  }

  try {
    const result = await db.query(
      `SELECT id, title, class_level, cover_image
       FROM subjects
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY class_level ASC, title ASC`,
      params,
    );
    const rows = await Promise.all(
      result.rows.map(async (row) => ({
        id: row.id as string,
        title: row.title as string,
        classLevel: row.class_level as string,
        coverImage: row.cover_image ? await getSignedMediaUrlIfNeeded(row.cover_image as string) : undefined,
      })),
    );
    return res.json({ subjects: rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch subject catalog' });
  }
});

quizzesRouter.get('/content/topics', requireAuth, async (req: any, res) => {
  const parsedQuery = listContentTopicsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid content topic filters', errors: parsedQuery.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }

  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const { class_level, subject, search, limit } = parsedQuery.data;
  const params: unknown[] = [orgId];
  const whereClauses: string[] = ['ct.organization_id = $1::uuid'];

  if (class_level) {
    params.push(class_level);
    whereClauses.push(`ct.class_level = $${params.length}`);
  }
  if (subject) {
    params.push(subject);
    whereClauses.push(`ct.subject = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    whereClauses.push(`(ct.title ILIKE $${idx} OR COALESCE(ct.subject, '') ILIKE $${idx})`);
  }
  params.push(limit);

  try {
    const result = await db.query(
      `SELECT
         ct.id,
         ct.class_level,
         ct.subject,
         ct.title,
         ct.cover_image,
         ct.created_by,
         ct.created_at,
         ct.updated_at,
         COALESCE(COUNT(lcs.id), 0)::int AS section_count
       FROM content_topics ct
       LEFT JOIN topic_content_assignments tca ON tca.topic_id = ct.id
       LEFT JOIN learning_content_sections lcs ON lcs.content_id = tca.content_id
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY ct.id
       ORDER BY ct.class_level ASC, ct.subject ASC, ct.title ASC
       LIMIT $${params.length}`,
      params,
    );

    const topicRows = await Promise.all(
      result.rows.map(async (row) => {
        const signedCover = row.cover_image ? await getSignedMediaUrlIfNeeded(row.cover_image as string) : null;
        return {
          id: row.id as string,
          classLevel: row.class_level as string,
          subject: row.subject as string,
          title: row.title as string,
          coverImage: (signedCover as string | null) || undefined,
          sectionCount: Number(row.section_count || 0),
          createdBy: (row.created_by as string | null) || undefined,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        };
      }),
    );

    return res.json({ topics: topicRows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch content topics' });
  }
});

quizzesRouter.post('/content/topics', requireAuth, async (req: any, res) => {
  const parsedBody = createContentTopicSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid content topic payload', errors: parsedBody.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId;
  if (!orgId || !userId) {
    return res.status(400).json({ message: 'Organization/user not found in auth context' });
  }

  const { classLevel, subject, title, coverImage } = parsedBody.data;

  try {
    const duplicate = await db.query(
      `SELECT 1
       FROM content_topics
       WHERE organization_id = $1::uuid
         AND class_level = $2
         AND subject = $3
         AND LOWER(title) = LOWER($4)
       LIMIT 1`,
      [orgId, classLevel, subject, title],
    );
    if ((duplicate.rowCount ?? 0) > 0) {
      return res.status(400).json({ message: 'Topic already exists for this standard and subject' });
    }

    const result = await db.query(
      `INSERT INTO content_topics (organization_id, class_level, subject, title, cover_image, created_by)
       VALUES ($1::uuid, $2, $3, $4, $5, $6)
       RETURNING id, class_level, subject, title, cover_image, created_by, created_at, updated_at`,
      [orgId, classLevel, subject, title, coverImage ? toPersistentMediaUrl(coverImage) : null, userId],
    );
    const row = result.rows[0];
    const signedCover = row.cover_image ? await getSignedMediaUrlIfNeeded(row.cover_image as string) : null;
    return res.status(201).json({
      id: row.id as string,
      classLevel: row.class_level as string,
      subject: row.subject as string,
      title: row.title as string,
      coverImage: (signedCover as string | null) || undefined,
      sectionCount: 0,
      createdBy: (row.created_by as string | null) || undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to create content topic' });
  }
});

quizzesRouter.patch('/content/topics/:topicId', requireAuth, async (req: any, res) => {
  const topicId = req.params.topicId as string;
  const parsedBody = updateContentTopicSchema.safeParse(req.body);
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid update payload', errors: parsedBody.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }

  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId;
  if (!orgId || !userId) {
    return res.status(400).json({ message: 'Organization/user not found in auth context' });
  }

  try {
    const permission = await ensureTopicEditPermission(topicId, orgId, userId, req);
    if (!permission.exists) {
      return res.status(404).json({ message: 'Topic not found' });
    }
    if (!permission.allowed) {
      return res.status(403).json({ message: 'Forbidden: not allowed to edit this topic' });
    }

    const existing = await db.query(
      `SELECT class_level, subject, title
       FROM content_topics
       WHERE id = $1
         AND organization_id = $2::uuid
       LIMIT 1`,
      [topicId, orgId],
    );
    const existingRow = existing.rows[0];
    const nextClassLevel = parsedBody.data.classLevel ?? (existingRow?.class_level as string);
    const nextSubject = parsedBody.data.subject ?? (existingRow?.subject as string);
    const nextTitle = parsedBody.data.title ?? (existingRow?.title as string);

    const duplicate = await db.query(
      `SELECT 1
       FROM content_topics
       WHERE organization_id = $1::uuid
         AND class_level = $2
         AND subject = $3
         AND LOWER(title) = LOWER($4)
         AND id <> $5
       LIMIT 1`,
      [orgId, nextClassLevel, nextSubject, nextTitle, topicId],
    );
    if ((duplicate.rowCount ?? 0) > 0) {
      return res.status(400).json({ message: 'Topic already exists for this standard and subject' });
    }

    const updates: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    if (parsedBody.data.classLevel !== undefined) {
      params.push(parsedBody.data.classLevel);
      updates.push(`class_level = $${params.length}`);
    }
    if (parsedBody.data.subject !== undefined) {
      params.push(parsedBody.data.subject);
      updates.push(`subject = $${params.length}`);
    }
    if (parsedBody.data.title !== undefined) {
      params.push(parsedBody.data.title);
      updates.push(`title = $${params.length}`);
    }
    if (parsedBody.data.coverImage !== undefined) {
      params.push(parsedBody.data.coverImage ? toPersistentMediaUrl(parsedBody.data.coverImage) : null);
      updates.push(`cover_image = $${params.length}`);
    }
    params.push(topicId, orgId);

    const result = await db.query(
      `UPDATE content_topics
       SET ${updates.join(', ')}
       WHERE id = $${params.length - 1}
         AND organization_id = $${params.length}::uuid
       RETURNING id, class_level, subject, title, cover_image, created_by, created_at, updated_at`,
      params,
    );
    const row = result.rows[0];
    const countResult = await db.query(
      `SELECT COUNT(lcs.id)::int AS count
       FROM topic_content_assignments tca
       LEFT JOIN learning_content_sections lcs ON lcs.content_id = tca.content_id
       WHERE tca.topic_id = $1`,
      [topicId],
    );
    const signedCover = row.cover_image ? await getSignedMediaUrlIfNeeded(row.cover_image as string) : null;
    return res.json({
      id: row.id as string,
      classLevel: row.class_level as string,
      subject: row.subject as string,
      title: row.title as string,
      coverImage: (signedCover as string | null) || undefined,
      sectionCount: Number(countResult.rows[0]?.count || 0),
      createdBy: (row.created_by as string | null) || undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to update content topic' });
  }
});

quizzesRouter.delete('/content/topics/:topicId', requireAuth, async (req: any, res) => {
  const topicId = req.params.topicId as string;
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }

  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId;
  if (!orgId || !userId) {
    return res.status(400).json({ message: 'Organization/user not found in auth context' });
  }

  try {
    const permission = await ensureTopicEditPermission(topicId, orgId, userId, req);
    if (!permission.exists) {
      return res.status(404).json({ message: 'Topic not found' });
    }
    if (!permission.allowed) {
      return res.status(403).json({ message: 'Forbidden: not allowed to delete this topic' });
    }

    await db.query(
      `DELETE FROM content_topics
       WHERE id = $1
         AND organization_id = $2::uuid`,
      [topicId, orgId],
    );
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to delete content topic' });
  }
});

quizzesRouter.get('/content/topics/:topicId/details', requireAuth, async (req: any, res) => {
  const topicId = req.params.topicId as string;
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  try {
    const topicResult = await db.query(
      `SELECT id, class_level, subject, title, cover_image, created_by, created_at, updated_at
       FROM content_topics
       WHERE id = $1
         AND organization_id = $2::uuid
       LIMIT 1`,
      [topicId, orgId],
    );
    if ((topicResult.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    const contentItemsResult = await db.query(
      `SELECT
         lc.id,
         lc.class_level,
         lc.subject,
         lc.title,
         lc.content_type,
         lc.media_url,
         lc.external_url,
         lc.text_content,
         lc.created_by,
         lc.created_at,
         lc.updated_at,
         tca.sort_order
       FROM topic_content_assignments tca
       INNER JOIN learning_contents lc ON lc.id = tca.content_id
       WHERE tca.topic_id = $1
       ORDER BY tca.sort_order ASC, tca.created_at ASC`,
      [topicId],
    );

    const topic = topicResult.rows[0];
    const signedCover = topic.cover_image ? await getSignedMediaUrlIfNeeded(topic.cover_image as string) : null;

    const contentIds = contentItemsResult.rows.map((row) => row.id);
    let sectionsRows: any[] = [];
    if (contentIds.length > 0) {
      const sectionsResult = await db.query(
        `SELECT id, content_id, section_order, content_type, media_url, external_url, text_content, created_at, updated_at
         FROM learning_content_sections
         WHERE content_id = ANY($1::uuid[])
         ORDER BY content_id, section_order ASC, created_at ASC`,
        [contentIds],
      );
      sectionsRows = sectionsResult.rows;
    }

    const sectionsGroupedByContentId: Record<string, any[]> = {};
    for (const row of sectionsRows) {
      const cId = row.content_id;
      if (!sectionsGroupedByContentId[cId]) {
        sectionsGroupedByContentId[cId] = [];
      }
      sectionsGroupedByContentId[cId].push({
        id: row.id as string,
        sectionOrder: Number(row.section_order || 0),
        contentType: row.content_type as string,
        mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
        externalUrl: (row.external_url as string | null) || undefined,
        textContent: (row.text_content as string | null) || undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      });
    }

    const contentItems = await Promise.all(
      contentItemsResult.rows.map(async (row) => {
        const cId = row.id as string;
        let sections = sectionsGroupedByContentId[cId] || [];
        if (sections.length === 0) {
          sections = [
            {
              id: row.id as string,
              sectionOrder: 1,
              contentType: row.content_type as string,
              mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
              externalUrl: (row.external_url as string | null) || undefined,
              textContent: (row.text_content as string | null) || undefined,
              createdAt: row.created_at as string,
              updatedAt: row.updated_at as string,
            },
          ];
        }
        return {
          id: cId,
          classLevel: row.class_level as string,
          subject: row.subject as string,
          title: row.title as string,
          contentType: row.content_type as string,
          sectionCount: sections.length,
          mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
          externalUrl: (row.external_url as string | null) || undefined,
          textContent: (row.text_content as string | null) || undefined,
          sections,
          createdBy: (row.created_by as string | null) || undefined,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        };
      }),
    );

    const flatSections: any[] = [];
    for (const item of contentItems) {
      flatSections.push(...item.sections);
    }

    return res.json({
      topic: {
        id: topic.id as string,
        classLevel: topic.class_level as string,
        subject: topic.subject as string,
        title: topic.title as string,
        coverImage: (signedCover as string | null) || undefined,
        createdBy: (topic.created_by as string | null) || undefined,
        createdAt: topic.created_at as string,
        updatedAt: topic.updated_at as string,
      },
      contentItems,
      sections: flatSections,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch topic details' });
  }
});

quizzesRouter.put('/content/topics/:topicId/sections', requireAuth, async (req: any, res) => {
  const topicId = req.params.topicId as string;
  const parsedBody = replaceTopicSectionsSchema.safeParse(req.body);
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid sections payload', errors: parsedBody.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }

  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId;
  if (!orgId || !userId) {
    return res.status(400).json({ message: 'Organization/user not found in auth context' });
  }

  const permission = await ensureTopicEditPermission(topicId, orgId, userId, req);
  if (!permission.exists) {
    return res.status(404).json({ message: 'Topic not found' });
  }
  if (!permission.allowed) {
    return res.status(403).json({ message: 'Forbidden: not allowed to update this topic' });
  }

  const sections = parsedBody.data.sections;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM topic_content_sections WHERE topic_id = $1`, [topicId]);

    for (let i = 0; i < sections.length; i += 1) {
      const section = sections[i];
      await client.query(
        `INSERT INTO topic_content_sections (topic_id, section_order, content_type, media_url, external_url, text_content)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          topicId,
          i + 1,
          section.contentType,
          section.mediaUrl ? toPersistentMediaUrl(section.mediaUrl) : null,
          section.externalUrl || null,
          section.textContent || null,
        ],
      );
    }
    await client.query('COMMIT');

    const detailsResult = await db.query(
      `SELECT id, section_order, content_type, media_url, external_url, text_content, created_at, updated_at
       FROM topic_content_sections
       WHERE topic_id = $1
       ORDER BY section_order ASC`,
      [topicId],
    );
    const resolvedSections = await Promise.all(
      detailsResult.rows.map(async (row) => ({
        id: row.id as string,
        sectionOrder: Number(row.section_order || 0),
        contentType: row.content_type as string,
        mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
        externalUrl: (row.external_url as string | null) || undefined,
        textContent: (row.text_content as string | null) || undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      })),
    );
    return res.json({ sections: resolvedSections });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ message: 'Failed to save content sections' });
  } finally {
    client.release();
  }
});

quizzesRouter.post('/content/items', requireAuth, async (req: any, res) => {
  const parsedBody = createLearningContentSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid content payload', errors: parsedBody.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId;
  if (!orgId || !userId) {
    return res.status(400).json({ message: 'Organization/user not found in auth context' });
  }

  const { classLevel, subject, topicId, title } = parsedBody.data;
  const sections = normalizeLearningContentSections(parsedBody.data);
  if (sections.length === 0) {
    return res.status(400).json({ message: 'At least one valid section is required' });
  }

  try {
    if (topicId) {
      const topicCheck = await db.query(
        `SELECT 1 FROM content_topics WHERE id = $1 AND organization_id = $2::uuid LIMIT 1`,
        [topicId, orgId],
      );
      if ((topicCheck.rowCount ?? 0) === 0) {
        return res.status(404).json({ message: 'Topic not found for assignment' });
      }
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const contentResult = await client.query(
        `INSERT INTO learning_contents (organization_id, class_level, subject, title, content_type, media_url, external_url, text_content, created_by)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, class_level, subject, title, content_type, media_url, external_url, text_content, created_by, created_at, updated_at`,
        [
          orgId,
          classLevel,
          subject,
          title,
          sections.length > 1 ? 'multi_section' : sections[0].contentType,
          sections[0].mediaUrl,
          sections[0].externalUrl,
          sections[0].textContent,
          userId,
        ],
      );
      const created = contentResult.rows[0];

      for (let i = 0; i < sections.length; i += 1) {
        const section = sections[i];
        await client.query(
          `INSERT INTO learning_content_sections (content_id, section_order, content_type, media_url, external_url, text_content)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [created.id, i + 1, section.contentType, section.mediaUrl, section.externalUrl, section.textContent],
        );
      }

      if (topicId) {
        await client.query(
          `INSERT INTO topic_content_assignments (topic_id, content_id, sort_order)
           VALUES ($1, $2, 0)
           ON CONFLICT (topic_id, content_id) DO NOTHING`,
          [topicId, created.id],
        );
      }

      await client.query('COMMIT');
      return res.status(201).json({
        id: created.id as string,
        classLevel: created.class_level as string,
        subject: created.subject as string,
        title: created.title as string,
        contentType: created.content_type as string,
        sectionCount: sections.length,
        mediaUrl: created.media_url ? await getSignedMediaUrlIfNeeded(created.media_url as string) : undefined,
        externalUrl: (created.external_url as string | null) || undefined,
        textContent: (created.text_content as string | null) || undefined,
        createdBy: (created.created_by as string | null) || undefined,
        createdAt: created.created_at as string,
        updatedAt: created.updated_at as string,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to create content item' });
  }
});

quizzesRouter.get('/content/items', requireAuth, async (req: any, res) => {
  const parsedQuery = listLearningContentQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid content filters', errors: parsedQuery.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const { class_level, subject, topic_id, search, limit } = parsedQuery.data;
  const params: unknown[] = [orgId];
  const whereClauses: string[] = ['lc.organization_id = $1::uuid'];

  if (class_level) {
    params.push(class_level);
    whereClauses.push(`lc.class_level = $${params.length}`);
  }
  if (subject) {
    params.push(subject);
    whereClauses.push(`lc.subject = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    whereClauses.push(`(lc.title ILIKE $${idx} OR COALESCE(lc.text_content, '') ILIKE $${idx})`);
  }
  if (topic_id) {
    params.push(topic_id);
    whereClauses.push(
      `EXISTS (SELECT 1 FROM topic_content_assignments tca WHERE tca.topic_id = $${params.length} AND tca.content_id = lc.id)`,
    );
  }
  params.push(limit);

  try {
    const result = await db.query(
      `SELECT
         lc.id,
         lc.class_level,
         lc.subject,
         lc.title,
         lc.content_type,
         lc.media_url,
         lc.external_url,
         lc.text_content,
         lc.created_by,
         lc.created_at,
         lc.updated_at,
         COALESCE(sec.count, 0)::int AS section_count,
         COALESCE(
           jsonb_agg(
             DISTINCT jsonb_build_object(
               'topicId', ct.id,
               'title', ct.title,
               'classLevel', ct.class_level,
               'subject', ct.subject
             )
           ) FILTER (WHERE ct.id IS NOT NULL),
           '[]'::jsonb
         ) AS assigned_topics
       FROM learning_contents lc
       LEFT JOIN (
         SELECT content_id, COUNT(*)::int AS count
         FROM learning_content_sections
         GROUP BY content_id
       ) sec ON sec.content_id = lc.id
       LEFT JOIN topic_content_assignments tca ON tca.content_id = lc.id
       LEFT JOIN content_topics ct ON ct.id = tca.topic_id AND ct.organization_id = lc.organization_id
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY lc.id, sec.count
       ORDER BY lc.created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    const items = await Promise.all(
      result.rows.map(async (row) => ({
        id: row.id as string,
        classLevel: row.class_level as string,
        subject: row.subject as string,
        title: row.title as string,
        contentType: row.content_type as string,
        sectionCount: Number(row.section_count || 0),
        mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
        externalUrl: (row.external_url as string | null) || undefined,
        textContent: (row.text_content as string | null) || undefined,
        assignedTopics: (row.assigned_topics as Array<{ topicId: string; title: string; classLevel: string; subject: string }>) || [],
        createdBy: (row.created_by as string | null) || undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      })),
    );
    return res.json({ items });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to list content items' });
  }
});

quizzesRouter.get('/content/items/:contentId', requireAuth, async (req: any, res) => {
  const contentId = req.params.contentId as string;
  if (!contentId) return res.status(400).json({ message: 'Invalid content id' });
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  try {
    const contentResult = await db.query(
      `SELECT id, class_level, subject, title, content_type, media_url, external_url, text_content, created_by, created_at, updated_at
       FROM learning_contents
       WHERE id = $1
         AND organization_id = $2::uuid
       LIMIT 1`,
      [contentId, orgId],
    );
    if ((contentResult.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Content item not found' });
    }
    const sectionsResult = await db.query(
      `SELECT id, section_order, content_type, media_url, external_url, text_content, created_at, updated_at
       FROM learning_content_sections
       WHERE content_id = $1
       ORDER BY section_order ASC`,
      [contentId],
    );
    let sections = await Promise.all(
      sectionsResult.rows.map(async (row) => ({
        id: row.id as string,
        sectionOrder: Number(row.section_order || 0),
        contentType: row.content_type as string,
        mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
        externalUrl: (row.external_url as string | null) || undefined,
        textContent: (row.text_content as string | null) || undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      })),
    );
    const row = contentResult.rows[0];
    if (sections.length === 0) {
      sections = [
        {
          id: row.id as string,
          sectionOrder: 1,
          contentType: row.content_type as string,
          mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
          externalUrl: (row.external_url as string | null) || undefined,
          textContent: (row.text_content as string | null) || undefined,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        },
      ];
    }
    return res.json({
      id: row.id as string,
      classLevel: row.class_level as string,
      subject: row.subject as string,
      title: row.title as string,
      contentType: row.content_type as string,
      sectionCount: sections.length,
      mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
      externalUrl: (row.external_url as string | null) || undefined,
      textContent: (row.text_content as string | null) || undefined,
      sections,
      createdBy: (row.created_by as string | null) || undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch content item' });
  }
});

quizzesRouter.put('/content/items/:contentId', requireAuth, async (req: any, res) => {
  const contentId = req.params.contentId as string;
  const parsedBody = updateLearningContentSchema.safeParse(req.body);
  if (!contentId) {
    return res.status(400).json({ message: 'Invalid content id' });
  }
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid content payload', errors: parsedBody.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const { classLevel, subject, title } = parsedBody.data;
  const sections = normalizeLearningContentSections(parsedBody.data);
  if (sections.length === 0) {
    return res.status(400).json({ message: 'At least one valid section is required' });
  }

  try {
    const existing = await db.query(
      `SELECT id
       FROM learning_contents
       WHERE id = $1
         AND organization_id = $2::uuid
       LIMIT 1`,
      [contentId, orgId],
    );
    if ((existing.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Content item not found' });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `UPDATE learning_contents
         SET class_level = $1,
             subject = $2,
             title = $3,
             content_type = $4,
             media_url = $5,
             external_url = $6,
             text_content = $7,
             updated_at = NOW()
         WHERE id = $8
           AND organization_id = $9::uuid
         RETURNING id, class_level, subject, title, content_type, media_url, external_url, text_content, created_by, created_at, updated_at`,
        [
          classLevel,
          subject,
          title,
          sections.length > 1 ? 'multi_section' : sections[0].contentType,
          sections[0].mediaUrl,
          sections[0].externalUrl,
          sections[0].textContent,
          contentId,
          orgId,
        ],
      );
      await client.query(`DELETE FROM learning_content_sections WHERE content_id = $1`, [contentId]);
      for (let i = 0; i < sections.length; i += 1) {
        const section = sections[i];
        await client.query(
          `INSERT INTO learning_content_sections (content_id, section_order, content_type, media_url, external_url, text_content)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [contentId, i + 1, section.contentType, section.mediaUrl, section.externalUrl, section.textContent],
        );
      }
      await client.query('COMMIT');
      const row = updated.rows[0];
      return res.json({
        id: row.id as string,
        classLevel: row.class_level as string,
        subject: row.subject as string,
        title: row.title as string,
        contentType: row.content_type as string,
        sectionCount: sections.length,
        mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
        externalUrl: (row.external_url as string | null) || undefined,
        textContent: (row.text_content as string | null) || undefined,
        createdBy: (row.created_by as string | null) || undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to update content item' });
  }
});

quizzesRouter.delete('/content/items/:contentId', requireAuth, async (req: any, res) => {
  const contentId = req.params.contentId as string;
  if (!contentId) {
    return res.status(400).json({ message: 'Invalid content id' });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  try {
    const result = await db.query(
      `DELETE FROM learning_contents
       WHERE id = $1
         AND organization_id = $2::uuid`,
      [contentId, orgId],
    );
    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Content item not found' });
    }
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to delete content item' });
  }
});

quizzesRouter.get('/content/topics/:topicId/assignments', requireAuth, async (req: any, res) => {
  const topicId = req.params.topicId as string;
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  try {
    const topicCheck = await db.query(
      `SELECT 1 FROM content_topics WHERE id = $1 AND organization_id = $2::uuid LIMIT 1`,
      [topicId, orgId],
    );
    if ((topicCheck.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    const result = await db.query(
      `SELECT content_id
       FROM topic_content_assignments
       WHERE topic_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [topicId],
    );
    return res.json({ contentIds: result.rows.map((row) => row.content_id as string) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch topic assignments' });
  }
});

quizzesRouter.put('/content/topics/:topicId/assignments', requireAuth, async (req: any, res) => {
  const topicId = req.params.topicId as string;
  const parsedBody = updateTopicAssignmentsSchema.safeParse(req.body);
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid assignment payload', errors: parsedBody.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId;
  if (!orgId || !userId) {
    return res.status(400).json({ message: 'Organization/user not found in auth context' });
  }

  try {
    const permission = await ensureTopicEditPermission(topicId, orgId, userId, req);
    if (!permission.exists) return res.status(404).json({ message: 'Topic not found' });
    if (!permission.allowed) return res.status(403).json({ message: 'Forbidden: not allowed to update this topic' });

    const uniqueIds = [...new Set(parsedBody.data.contentIds)];
    if (uniqueIds.length > 0) {
      const validateResult = await db.query(
        `SELECT COUNT(*)::int AS count
         FROM learning_contents
         WHERE organization_id = $1::uuid
           AND id = ANY($2::uuid[])`,
        [orgId, uniqueIds],
      );
      if (Number(validateResult.rows[0]?.count || 0) !== uniqueIds.length) {
        return res.status(400).json({ message: 'One or more selected content items are invalid' });
      }
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM topic_content_assignments WHERE topic_id = $1`, [topicId]);
      for (let i = 0; i < uniqueIds.length; i += 1) {
        await client.query(
          `INSERT INTO topic_content_assignments (topic_id, content_id, sort_order)
           VALUES ($1, $2, $3)`,
          [topicId, uniqueIds[i], i + 1],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return res.json({ topicId, contentIds: uniqueIds });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to update topic assignments' });
  }
});

quizzesRouter.post('/attempts', requireAuth, async (req: any, res) => {
  const parsed = recordAttemptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
  }

  const { quizId, score, totalPoints, questionAttempts } = parsed.data;
  const studentId = req.user.userId;
  const orgId = getOrganizationId(req);
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  try {
    const quizExists = await db.query(
      `SELECT 1 FROM quizzes WHERE id = $1 AND organization_id = $2::uuid`,
      [quizId, orgId],
    );
    if ((quizExists.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    await db.query('BEGIN');

    const attemptResult = await db.query(
      `INSERT INTO student_attempts (student_id, quiz_id, score, total_points)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [studentId, quizId, score, totalPoints],
    );
    const attemptId = attemptResult.rows[0].id;

    for (const qAttempt of questionAttempts) {
      await db.query(
        `INSERT INTO question_attempts (attempt_id, question_id, is_correct, response_data, time_spent_seconds)
         VALUES ($1, $2, $3, $4, $5)`,
        [attemptId, qAttempt.questionId, qAttempt.isCorrect, qAttempt.responseData || {}, qAttempt.timeSpentSeconds || null],
      );
    }

    await db.query('COMMIT');
    return res.status(201).json({ message: 'Quiz attempt saved successfully', attemptId });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ message: 'Failed to save quiz attempt' });
  }
});

// --- Quiz-Topic Assignment Endpoints ---

// GET quizzes assigned to a topic
quizzesRouter.get('/content/topics/:topicId/quizzes', requireAuth, async (req: any, res) => {
  const topicId = req.params.topicId as string;
  if (!topicId) return res.status(400).json({ message: 'Invalid topic id' });
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  try {
    const result = await db.query(
      `SELECT id, title, quiz_type, class_level, subject, is_published, total_questions, created_at
       FROM quizzes
       WHERE organization_id = $1::uuid AND topic_id = $2
       ORDER BY created_at DESC`,
      [orgId, topicId],
    );
    return res.json({ quizzes: result.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch topic quizzes' });
  }
});

// PUT assign a quiz to a topic (pass quizId to assign, null to unassign)
quizzesRouter.put('/content/topics/:topicId/quizzes/:quizId', requireAuth, async (req: any, res) => {
  const { topicId, quizId } = req.params;
  if (!topicId || !quizId) return res.status(400).json({ message: 'Invalid topic or quiz id' });
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  try {
    // Verify topic belongs to org
    const topicCheck = await db.query(
      `SELECT 1 FROM content_topics WHERE id = $1 AND organization_id = $2::uuid LIMIT 1`,
      [topicId, orgId],
    );
    if ((topicCheck.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Topic not found' });

    // Verify quiz belongs to org
    const quizCheck = await db.query(
      `SELECT 1 FROM quizzes WHERE id = $1 AND organization_id = $2::uuid LIMIT 1`,
      [quizId, orgId],
    );
    if ((quizCheck.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Quiz not found' });

    await db.query(`UPDATE quizzes SET topic_id = $1, updated_at = NOW() WHERE id = $2`, [topicId, quizId]);
    return res.json({ message: 'Quiz assigned to topic successfully', topicId, quizId });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to assign quiz to topic' });
  }
});

// DELETE unassign a quiz from a topic
quizzesRouter.delete('/content/topics/:topicId/quizzes/:quizId', requireAuth, async (req: any, res) => {
  const { quizId } = req.params;
  if (!quizId) return res.status(400).json({ message: 'Invalid quiz id' });
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  try {
    await db.query(
      `UPDATE quizzes SET topic_id = NULL, updated_at = NOW() WHERE id = $1 AND organization_id = $2::uuid`,
      [quizId, orgId],
    );
    return res.json({ message: 'Quiz unassigned from topic successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to unassign quiz from topic' });
  }
});
