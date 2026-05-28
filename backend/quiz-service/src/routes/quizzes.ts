import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getSignedMediaUrlIfNeeded, toPersistentMediaUrl, uploadMediaToS3 } from '../services/s3.js';
import { eventBus } from '../events/bus.js';

export const quizzesRouter = Router();

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
    'memory_match',
    'fill_blank',
    'logico',
  ]),
  difficultyLevel: z.string().optional(),
  backgroundMusicUrl: z.string().optional(),
  theme: z.any().default({}),
  isPublished: z.boolean().default(false),
  isAiGenerated: z.boolean().default(false),
  isGlobal: z.boolean().default(false),
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
      'memory_match',
      'fill_blank',
      'logico',
    ])
    .optional(),
  difficulty_level: z.string().trim().optional(),
  status: z.enum(['all', 'published', 'draft']).default('all'),
  source: z.enum(['all', 'ai', 'manual']).default('all'),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

const publishSchema = z.object({
  isPublished: z.boolean(),
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

function canPublishGlobalResources(req: any): boolean {
  const role = req?.user?.role;
  return role === 'superadmin' || Boolean(req?.user?.canPublishGlobal);
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
  return { allowed: true, exists: true };
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
  return { allowed: true, exists: true };
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
      SELECT id, title, description, thumbnail_image, class_level, subject, quiz_type, difficulty_level, background_music_url, theme, total_questions, is_published, is_ai_generated, is_global, created_at
      FROM quizzes
      WHERE (organization_id = $1::uuid OR is_global = true) AND is_published = true
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
  const whereClauses: string[] = ['(organization_id = $1::uuid OR is_global = true)'];

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
      `SELECT id, title, description, class_level, subject, quiz_type, difficulty_level, total_questions, is_published, is_ai_generated, is_global, created_at
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

// ── GET /quizzes/teacher/class-activity ──────────────────────────────────────
// Per-student quiz attempt metrics for the teacher's organization
quizzesRouter.get('/teacher/class-activity', requireAuth, async (req: any, res) => {
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  const limit = Math.min(parseInt((req.query.limit as string) || '200', 10), 500);

  try {
    const result = await db.query(
      `SELECT
         u.id              AS student_id,
         u.first_name,
         u.last_name,
         u.class_level,
         u.profile_image,
         sa.id             AS attempt_id,
         sa.completed_at,
         q.id              AS quiz_id,
         q.title           AS quiz_title,
         COUNT(qa.id)                                     AS total_questions,
         COUNT(qa.id) FILTER (WHERE qa.is_correct)        AS correct_count,
         CASE WHEN COUNT(qa.id) > 0
           THEN ROUND(COUNT(qa.id) FILTER (WHERE qa.is_correct)::numeric / COUNT(qa.id) * 100)
           ELSE 0 END                                     AS score_pct,
         BOOL_OR(qq.question_type IN ('memory_match','fill_blank')) AS has_game,
         MAX(CASE WHEN qq.question_type = 'memory_match'
           THEN (qa.response_data->>'clicksUsed')::int    END) AS mm_clicks_used,
         MAX(CASE WHEN qq.question_type = 'memory_match'
           THEN (qa.response_data->>'clickLimit')::int    END) AS mm_click_limit,
         MAX(CASE WHEN qq.question_type = 'memory_match'
           THEN (qa.response_data->>'pairsMatched')::int  END) AS mm_pairs_matched,
         MAX(CASE WHEN qq.question_type = 'memory_match'
           THEN (qa.response_data->>'totalPairs')::int    END) AS mm_total_pairs,
         MAX(CASE WHEN qq.question_type = 'memory_match'
           THEN (qa.response_data->>'accuracy')::int      END) AS mm_accuracy
       FROM users u
       INNER JOIN student_attempts sa ON sa.student_id = u.id
       INNER JOIN quizzes q ON q.id = sa.quiz_id AND q.organization_id = $1::uuid
       LEFT JOIN question_attempts qa ON qa.attempt_id = sa.id
       LEFT JOIN quiz_questions qq ON qq.id = qa.question_id
       WHERE u.organization_id = $1::uuid AND u.role = 'student'
       GROUP BY u.id, u.first_name, u.last_name, u.class_level, u.profile_image,
                sa.id, sa.completed_at, q.id, q.title
       ORDER BY sa.completed_at DESC
       LIMIT $2`,
      [orgId, limit],
    );

    // Group rows by student
    const map = new Map<string, {
      studentId: string; firstName: string; lastName: string;
      classLevel: string | null; profileImage: string | null;
      attempts: object[];
    }>();
    for (const row of result.rows) {
      if (!map.has(row.student_id)) {
        map.set(row.student_id, {
          studentId: row.student_id,
          firstName: row.first_name as string,
          lastName: row.last_name as string,
          classLevel: row.class_level as string | null,
          profileImage: row.profile_image as string | null,
          attempts: [],
        });
      }
      const mmHasData = row.mm_clicks_used != null;
      map.get(row.student_id)!.attempts.push({
        attemptId:      row.attempt_id as string,
        quizId:         row.quiz_id as string,
        quizTitle:      row.quiz_title as string,
        completedAt:    row.completed_at as string,
        totalQuestions: Number(row.total_questions || 0),
        correctCount:   Number(row.correct_count  || 0),
        scorePct:       Number(row.score_pct       || 0),
        hasGame:        Boolean(row.has_game),
        gameMetrics:    mmHasData ? {
          clicksUsed:  Number(row.mm_clicks_used  || 0),
          clickLimit:  Number(row.mm_click_limit  || 0),
          pairsMatched:Number(row.mm_pairs_matched|| 0),
          totalPairs:  Number(row.mm_total_pairs  || 0),
          accuracy:    Number(row.mm_accuracy     || 0),
        } : null,
      });
    }

    return res.json({ students: Array.from(map.values()) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to load class activity' });
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
      `SELECT * FROM quizzes WHERE id = $1 AND (organization_id = $2::uuid OR is_global = true)`,
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

  const { title, description, classLevel, subject, quizType, difficultyLevel, backgroundMusicUrl, theme, isPublished, isAiGenerated, isGlobal } = parsed.data;
  const orgId = getOrganizationId(req);
  const userId = req.user.userId;
  if (!orgId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  if (isGlobal && !canPublishGlobalResources(req)) {
    return res.status(403).json({ message: 'Forbidden: global publish permission required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO quizzes (organization_id, title, description, class_level, subject, quiz_type, difficulty_level, background_music_url, theme, is_published, is_ai_generated, created_by, is_global)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [orgId, title, description || null, classLevel || null, subject || null, quizType, difficultyLevel || null, backgroundMusicUrl || null, theme, isPublished, isAiGenerated, userId, isGlobal],
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
       WHERE id = $2 AND (organization_id = $3::uuid OR is_global = true)
       RETURNING id, title, class_level, subject, quiz_type, difficulty_level, total_questions, is_published, is_ai_generated, is_global, created_at, updated_at`,
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
      'SELECT 1 FROM quizzes WHERE id = $1 AND (organization_id = $2::uuid OR is_global = true)',
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
      `SELECT 1 FROM quizzes WHERE id = $1 AND (organization_id = $2::uuid OR is_global = true)`,
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

    try {
      const meta = await db.query(
        `SELECT q.title AS quiz_title,
                cq.classroom_id AS classroom_id,
                c.title AS classroom_title,
                c.created_by AS teacher_id
           FROM quizzes q
           LEFT JOIN classroom_quizzes cq ON cq.quiz_id = q.id
           LEFT JOIN classrooms c ON c.id = cq.classroom_id
          WHERE q.id = $1
          LIMIT 1`,
        [quizId],
      );
      const row = meta.rows[0] as any;
      const pct = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
      await eventBus.publish({
        type: 'quiz.submitted',
        source: 'quiz-service',
        organizationId: orgId,
        userId: studentId,
        payload: {
          quizId,
          quizTitle: row?.quiz_title || 'Quiz',
          score,
          totalPoints,
          scorePercent: pct,
          studentUserId: studentId,
          classroomId: row?.classroom_id || null,
          classroomTitle: row?.classroom_title || null,
          teacherId: row?.teacher_id || null,
        },
      });

    } catch (err) {
      console.error('[quiz-service] failed to publish quiz.submitted', err);
    }

    return res.status(201).json({ message: 'Quiz attempt saved successfully', attemptId });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ message: 'Failed to save quiz attempt' });
  }
});

// /content/topics/:topicId/quizzes assignments moved to topic-service (Phase 2)

