import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { getSignedMediaUrlIfNeeded } from '../services/s3.js';

export const questionsRouter = Router();
export const questionBankRouter = Router();

const questionManagementQuerySchema = z.object({
  search: z.string().trim().optional(),
  class_level: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  category: z.string().trim().optional(),
  quiz_type: z.string().trim().optional(),
  quiz_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

const questionBankQuerySchema = z.object({
  search: z.string().trim().optional(),
  class_level: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  question_type: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(300).default(120),
});

const updateQuestionSchema = z
  .object({
    classLevel: z.string().trim().optional(),
    subject: z.string().trim().optional(),
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


questionsRouter.get('/_meta', requireAuth, async (_req: AuthenticatedRequest, res) => {
  const totals = await db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM quiz_questions`);
  res.json({
    service: 'question-bank-service',
    version: '2.0.0',
    phase: 2,
    description: 'Owns the reusable question bank: CRUD over quiz_questions plus the browse view used to clone into quizzes.',
    questionsInBank: Number(totals.rows[0]?.count || 0),
  });
});

questionsRouter.get('/', requireAuth, async (req: any, res) => {
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
    whereClauses.push(`COALESCE(NULLIF(qq.question_data->'_meta'->>'classLevel', ''), q.class_level, '') = $${params.length}`);
  }
  if (subject) {
    params.push(subject);
    whereClauses.push(`COALESCE(NULLIF(qq.question_data->'_meta'->>'subject', ''), q.subject, '') = $${params.length}`);
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
         COALESCE(NULLIF(qq.question_data->'_meta'->>'classLevel', ''), q.class_level) AS class_level,
         COALESCE(NULLIF(qq.question_data->'_meta'->>'subject', ''), q.subject) AS subject,
         COALESCE(q.quiz_type, qq.question_type) AS quiz_type,
         qq.question_type,
         qq.question_title,
         qq.question_instruction,
         qq.question_audio,
         qq.time_limit_seconds,
         qq.points,
         qq.sort_order,
         qq.created_at
       FROM quiz_questions qq
       LEFT JOIN quizzes q ON q.id = qq.quiz_id
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

questionsRouter.get('/:questionId', requireAuth, async (req: any, res) => {
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  const { questionId } = req.params;
  try {
    const result = await db.query(
      `SELECT
         qq.id,
         qq.quiz_id,
         COALESCE(q.title, 'Question Bank') AS quiz_title,
         COALESCE(NULLIF(qq.question_data->'_meta'->>'classLevel', ''), q.class_level) AS class_level,
         COALESCE(NULLIF(qq.question_data->'_meta'->>'subject', ''), q.subject) AS subject,
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
       WHERE qq.id = $1
         AND (q.organization_id = $2::uuid OR COALESCE(qq.question_data->'_meta'->>'organizationId', '') = $2::text)`,
      [questionId, orgId],
    );
    if ((result.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Question not found' });
    const cache = new Map<string, Promise<string>>();
    const signed = await signQuestionRowMedia(result.rows[0] as Record<string, unknown>, cache);
    return res.json({ question: signed });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch question' });
  }
});


questionsRouter.post('/', requireAuth, async (req: any, res) => {
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
        `SELECT 1 FROM quizzes WHERE id = $1 AND (organization_id = $2::uuid OR is_global = true)`,
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
         COALESCE(NULLIF(qq.question_data->'_meta'->>'classLevel', ''), q.class_level) AS class_level,
         COALESCE(NULLIF(qq.question_data->'_meta'->>'subject', ''), q.subject) AS subject,
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


questionsRouter.patch('/:questionId', requireAuth, async (req: any, res) => {
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

    let preparedQuestionData = questionData;
    if (classLevel !== undefined || subject !== undefined) {
      const existingQuestion = await db.query(
        `SELECT question_data FROM quiz_questions WHERE id = $1`,
        [questionId],
      );
      const existingQuestionData = existingQuestion.rows[0]?.question_data;
      const baseQuestionData =
        questionData !== undefined && typeof questionData === 'object' && !Array.isArray(questionData)
          ? { ...(questionData as Record<string, unknown>) }
          : existingQuestionData && typeof existingQuestionData === 'object' && !Array.isArray(existingQuestionData)
            ? { ...(existingQuestionData as Record<string, unknown>) }
            : {};
      const rawMeta = (baseQuestionData as Record<string, unknown>)._meta;
      const existingMeta =
        rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)
          ? (rawMeta as Record<string, unknown>)
          : {};
      preparedQuestionData = {
        ...baseQuestionData,
        _meta: {
          ...existingMeta,
          ...(classLevel !== undefined ? { classLevel: classLevel || null } : {}),
          ...(subject !== undefined ? { subject: subject || null } : {}),
        },
      };
    }

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
    if (preparedQuestionData !== undefined) {
      params.push(preparedQuestionData);
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
         COALESCE(NULLIF(qq.question_data->'_meta'->>'classLevel', ''), q.class_level) AS class_level,
         COALESCE(NULLIF(qq.question_data->'_meta'->>'subject', ''), q.subject) AS subject,
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


questionsRouter.delete('/:questionId', requireAuth, async (req: any, res) => {
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


questionBankRouter.get('/', requireAuth, async (req: any, res) => {
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
    whereClauses.push(`COALESCE(NULLIF(qq.question_data->'_meta'->>'classLevel', ''), q.class_level, '') = $${params.length}`);
  }
  if (subject) {
    params.push(subject);
    whereClauses.push(`COALESCE(NULLIF(qq.question_data->'_meta'->>'subject', ''), q.subject, '') = $${params.length}`);
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
         COALESCE(NULLIF(qq.question_data->'_meta'->>'classLevel', ''), q.class_level) AS class_level,
         COALESCE(NULLIF(qq.question_data->'_meta'->>'subject', ''), q.subject) AS subject,
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


