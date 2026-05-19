import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const quizzesRouter = Router();

// Zod schemas for validation
const createQuizSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  classLevel: z.string().optional(),
  subject: z.string().optional(),
  quizType: z.enum(['drag_drop', 'image_select', 'sound_match', 'memory_game']),
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
  quiz_type: z.enum(['drag_drop', 'image_select', 'sound_match', 'memory_game']).optional(),
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
  quizId: z.string().uuid(),
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
  const whereClauses: string[] = ['q.organization_id = $1::uuid'];

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
    whereClauses.push(`q.class_level = $${params.length}`);
  }
  if (subject) {
    params.push(subject);
    whereClauses.push(`q.subject = $${params.length}`);
  }
  if (quiz_type) {
    params.push(quiz_type);
    whereClauses.push(`q.quiz_type = $${params.length}`);
  }
  if (category) {
    params.push(category);
    whereClauses.push(`qq.question_type = $${params.length}`);
  }
  if (quiz_id) {
    params.push(quiz_id);
    whereClauses.push(`q.id = $${params.length}`);
  }

  params.push(limit);

  try {
    const result = await db.query(
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
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY qq.created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    return res.json({ questions: result.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch questions' });
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

  const {
    quizId,
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

    const quizExists = await client.query(
      `SELECT 1 FROM quizzes WHERE id = $1 AND organization_id = $2::uuid`,
      [quizId, orgId],
    );
    if ((quizExists.rowCount ?? 0) === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const insertResult = await client.query(
      `INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_audio, time_limit_seconds, points, sort_order, question_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        quizId,
        questionType,
        questionTitle,
        questionInstruction || null,
        questionAudio || null,
        timeLimitSeconds,
        points,
        sortOrder ?? null,
        questionData,
      ],
    );
    const questionId = insertResult.rows[0].id as string;

    await client.query(
      `UPDATE quizzes
       SET total_questions = total_questions + 1, updated_at = NOW()
       WHERE id = $1`,
      [quizId],
    );

    const result = await client.query(
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
      [questionId],
    );

    await client.query('COMMIT');
    return res.status(201).json(result.rows[0]);
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
    const exists = await db.query(
      `SELECT 1
       FROM quiz_questions qq
       INNER JOIN quizzes q ON q.id = qq.quiz_id
       WHERE qq.id = $1 AND q.organization_id = $2::uuid`,
      [questionId, orgId],
    );
    if ((exists.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Question not found' });
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
      [questionId],
    );

    return res.json(result.rows[0]);
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

    const targetResult = await client.query(
      `SELECT qq.id, qq.quiz_id
       FROM quiz_questions qq
       INNER JOIN quizzes q ON q.id = qq.quiz_id
       WHERE qq.id = $1 AND q.organization_id = $2::uuid`,
      [questionId, orgId],
    );
    if ((targetResult.rowCount ?? 0) === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Question not found' });
    }

    const quizId = targetResult.rows[0].quiz_id as string;

    await client.query(`DELETE FROM quiz_questions WHERE id = $1`, [questionId]);
    await client.query(
      `UPDATE quizzes
       SET total_questions = GREATEST(total_questions - 1, 0), updated_at = NOW()
       WHERE id = $1`,
      [quizId],
    );

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

    return res.json({
      ...quiz,
      questions: questionsResult.rows,
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

  try {
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

  const { questionType, questionTitle, questionInstruction, questionAudio, timeLimitSeconds, points, sortOrder, questionData } = parsed.data;

  try {
    const quizExists = await db.query(
      'SELECT 1 FROM quizzes WHERE id = $1 AND organization_id = $2::uuid',
      [id, orgId],
    );
    if ((quizExists.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const result = await db.query(
      `INSERT INTO quiz_questions (quiz_id, question_type, question_title, question_instruction, question_audio, time_limit_seconds, points, sort_order, question_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, questionType, questionTitle || null, questionInstruction || null, questionAudio || null, timeLimitSeconds, points, sortOrder || null, questionData],
    );

    await db.query(
      `UPDATE quizzes SET total_questions = total_questions + 1, updated_at = NOW() WHERE id = $1`,
      [id],
    );

    return res.status(201).json(result.rows[0]);
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
