import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

// Router for paths nested under an existing content item: /content/:contentId/...
export const videoContentRouter = Router();
// Router for section-scoped paths: /video-sections/:sectionId/...
export const videoSectionsRouter = Router();

function getOrganizationId(req: any): string | null {
  return req?.user?.organizationId || null;
}
function getUserId(req: any): string | null {
  return req?.user?.userId || null;
}
function canManageTeacherContent(req: any): boolean {
  const role = req?.user?.role;
  return role === 'teacher' || role === 'admin' || role === 'superadmin';
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

const ageGroupSchema = z.enum(['5-10', '11-14', '15-18']);
const difficultySchema = z.enum(['easy', 'medium', 'hard']);
const statusSchema = z.enum(['draft', 'ready', 'published']);

const createSectionSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(4000).optional(),
  startTime: z.coerce.number().int().min(0),
  endTime: z.coerce.number().int().min(1),
  learningObjective: z.string().trim().max(4000).optional(),
  ageGroup: ageGroupSchema.optional(),
  category: z.string().trim().max(120).optional(),
  difficulty: difficultySchema.optional(),
  contentSectionOrder: z.coerce.number().int().min(1).optional(),
});

const updateSectionSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    startTime: z.coerce.number().int().min(0).optional(),
    endTime: z.coerce.number().int().min(1).optional(),
    learningObjective: z.string().trim().max(4000).nullable().optional(),
    ageGroup: ageGroupSchema.nullable().optional(),
    category: z.string().trim().max(120).nullable().optional(),
    difficulty: difficultySchema.nullable().optional(),
    status: statusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field must be provided' });

const attachQuizSchema = z.object({ quizId: z.string().uuid() });

const progressSchema = z.object({
  contentId: z.string().uuid().optional(),
  videoWatchStatus: z.enum(['not_started', 'in_progress', 'completed']).optional(),
  watchedSeconds: z.coerce.number().int().min(0).optional(),
});

const submitQuizSchema = z.object({
  score: z.coerce.number().int().min(0),
  totalPoints: z.coerce.number().int().min(0),
});

function mapSection(row: any) {
  const startTime = Number(row.start_time);
  const endTime = Number(row.end_time);
  return {
    id: row.id as string,
    contentId: row.content_id as string,
    title: row.title as string,
    description: (row.description as string | null) || undefined,
    startTime,
    endTime,
    duration: endTime - startTime,
    learningObjective: (row.learning_objective as string | null) || undefined,
    ageGroup: (row.age_group as string | null) || undefined,
    category: (row.category as string | null) || undefined,
    difficulty: (row.difficulty as string | null) || undefined,
    quizId: (row.quiz_id as string | null) || undefined,
    status: row.status as string,
    contentSectionOrder: Number(row.content_section_order || 1),
    sectionOrder: Number(row.section_order || 0),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// Resolves a section row scoped to the caller's org and returns it (or null).
async function loadSection(sectionId: string | string[], orgId: string) {
  const result = await db.query(
    `SELECT * FROM video_sections WHERE id = $1 AND organization_id = $2::uuid`,
    [sectionId, orgId],
  );
  return (result.rowCount ?? 0) > 0 ? result.rows[0] : null;
}

// ── Create section ────────────────────────────────────────────────────────
// POST /content/:contentId/video-sections
videoContentRouter.post('/:contentId/video-sections', async (req: AuthenticatedRequest, res) => {
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  const parsed = createSectionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid section payload', errors: parsed.error.issues });
  }
  const data = parsed.data;
  if (data.endTime <= data.startTime) {
    return res.status(400).json({ message: 'End time must be greater than start time' });
  }

  const { contentId } = req.params;
  const contentResult = await db.query(
    `SELECT id, video_duration FROM learning_contents WHERE id = $1 AND (organization_id = $2::uuid OR is_global = true)`,
    [contentId, orgId],
  );
  if ((contentResult.rowCount ?? 0) === 0) {
    return res.status(404).json({ message: 'Content not found' });
  }
  const videoDuration = contentResult.rows[0].video_duration as number | null;
  if (videoDuration != null && data.endTime > videoDuration) {
    return res.status(400).json({ message: `End time exceeds video duration (${videoDuration}s)` });
  }

  const contentSectionOrder = data.contentSectionOrder ?? 1;

  try {
    const orderResult = await db.query(
      `SELECT COALESCE(MAX(section_order), 0) + 1 AS next_order
         FROM video_sections WHERE content_id = $1 AND content_section_order = $2`,
      [contentId, contentSectionOrder],
    );
    const nextOrder = Number(orderResult.rows[0].next_order || 1);

    const inserted = await db.query(
      `INSERT INTO video_sections
         (content_id, organization_id, title, description, start_time, end_time,
          learning_objective, age_group, category, difficulty, section_order, content_section_order, status)
       VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'published')
       RETURNING *`,
      [
        contentId, orgId, data.title, data.description || null, data.startTime, data.endTime,
        data.learningObjective || null, data.ageGroup || null, data.category || null,
        data.difficulty || null, nextOrder, contentSectionOrder,
      ],
    );
    const section = mapSection(inserted.rows[0]);
    return res.status(201).json({ sectionId: section.id, status: 'created', section });
  } catch (error: any) {
    if (error?.code === '23P01') {
      // exclusion_violation -> overlapping time range
      return res.status(409).json({ isValid: false, reason: 'Selected time overlaps with an existing section' });
    }
    console.error(error);
    return res.status(500).json({ message: 'Failed to create video section' });
  }
});

// ── List sections ─────────────────────────────────────────────────────────
// GET /content/:contentId/video-sections
videoContentRouter.get('/:contentId/video-sections', async (req: AuthenticatedRequest, res) => {
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });
  const { contentId } = req.params;
  // Draft/preview content ids (e.g. "d-25") are not real content yet.
  if (!isUuid(contentId)) return res.json([]);
  const rawSectionOrder = req.query.sectionOrder;
  const sectionOrder =
    rawSectionOrder !== undefined && rawSectionOrder !== '' ? Number(rawSectionOrder) : null;
  const params: unknown[] = [contentId, orgId];
  let whereSectionOrder = '';
  if (sectionOrder != null && Number.isFinite(sectionOrder)) {
    params.push(sectionOrder);
    whereSectionOrder = ` AND content_section_order = $${params.length}`;
  }
  const result = await db.query(
    `SELECT * FROM video_sections
     WHERE content_id = $1 AND (organization_id = $2::uuid)${whereSectionOrder}
     ORDER BY start_time ASC, section_order ASC`,
    params,
  );
  return res.json(result.rows.map(mapSection));
});

// ── Teacher dashboard aggregate ─────────────────────────────────────────────
// GET /content/:contentId/video-progress
videoContentRouter.get('/:contentId/video-progress', async (req: AuthenticatedRequest, res) => {
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });
  const { contentId } = req.params;

  const sectionsResult = await db.query(
    `SELECT id, title, quiz_id, status, start_time, end_time, section_order
     FROM video_sections WHERE content_id = $1 AND organization_id = $2::uuid
     ORDER BY start_time ASC`,
    [contentId, orgId],
  );
  const sections = sectionsResult.rows;
  const totalSections = sections.length;
  const publishedSections = sections.filter((s) => s.status === 'published').length;
  const sectionsWithQuiz = sections.filter((s) => s.quiz_id).length;

  const progressResult = await db.query(
    `SELECT svp.student_id, svp.section_id, svp.video_watch_status, svp.quiz_status,
            svp.quiz_score,
            NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), '') AS student_name
     FROM student_video_progress svp
     LEFT JOIN users u ON u.id = svp.student_id
     WHERE svp.content_id = $1 AND svp.organization_id = $2::uuid`,
    [contentId, orgId],
  );
  const rows = progressResult.rows;
  const completedQuiz = rows.filter((r) => r.quiz_status === 'completed');
  const scores = completedQuiz.map((r) => Number(r.quiz_score)).filter((n) => !Number.isNaN(n));
  const quizAverageScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const studentIds = Array.from(new Set(rows.map((r) => r.student_id)));
  const completedByStudent = new Map<string, number>();
  rows.forEach((r) => {
    if (r.video_watch_status === 'completed' && r.quiz_status === 'completed') {
      completedByStudent.set(r.student_id, (completedByStudent.get(r.student_id) || 0) + 1);
    }
  });
  const fullyCompleted = Array.from(completedByStudent.values()).filter((n) => n >= totalSections && totalSections > 0).length;
  const completionPct = studentIds.length ? Math.round((fullyCompleted / studentIds.length) * 100) : 0;

  const pendingQuiz = rows.filter((r) => r.video_watch_status === 'completed' && r.quiz_status !== 'completed');
  const failedQuiz = completedQuiz.filter((r) => Number(r.quiz_score) < 40);

  return res.json({
    contentId,
    totalSections,
    publishedSections,
    sectionsWithQuiz,
    sectionsWithoutQuiz: totalSections - sectionsWithQuiz,
    studentCompletionPct: completionPct,
    quizAverageScore,
    studentsPendingQuiz: pendingQuiz.map((r) => ({ studentId: r.student_id, name: r.student_name, sectionId: r.section_id })),
    studentsFailedQuiz: failedQuiz.map((r) => ({ studentId: r.student_id, name: r.student_name, sectionId: r.section_id, score: Number(r.quiz_score) })),
    studentsRequiringIntervention: failedQuiz
      .filter((r) => Number(r.quiz_score) < 25)
      .map((r) => ({ studentId: r.student_id, name: r.student_name, score: Number(r.quiz_score) })),
  });
});

// ── Update section ──────────────────────────────────────────────────────────
// PATCH /video-sections/:sectionId
videoSectionsRouter.patch('/:sectionId', async (req: AuthenticatedRequest, res) => {
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  const parsed = updateSectionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid section payload', errors: parsed.error.issues });
  }
  const existing = await loadSection(req.params.sectionId, orgId);
  if (!existing) return res.status(404).json({ message: 'Section not found' });

  const data = parsed.data;
  const nextStart = data.startTime ?? Number(existing.start_time);
  const nextEnd = data.endTime ?? Number(existing.end_time);
  if (nextEnd <= nextStart) {
    return res.status(400).json({ message: 'End time must be greater than start time' });
  }

  const fields: string[] = [];
  const params: unknown[] = [];
  const set = (col: string, val: unknown) => { params.push(val); fields.push(`${col} = $${params.length}`); };
  if (data.title !== undefined) set('title', data.title);
  if (data.description !== undefined) set('description', data.description);
  if (data.startTime !== undefined) set('start_time', data.startTime);
  if (data.endTime !== undefined) set('end_time', data.endTime);
  if (data.learningObjective !== undefined) set('learning_objective', data.learningObjective);
  if (data.ageGroup !== undefined) set('age_group', data.ageGroup);
  if (data.category !== undefined) set('category', data.category);
  if (data.difficulty !== undefined) set('difficulty', data.difficulty);
  if (data.status !== undefined) set('status', data.status);
  fields.push('updated_at = NOW()');
  params.push(req.params.sectionId, orgId);

  try {
    const result = await db.query(
      `UPDATE video_sections SET ${fields.join(', ')}
       WHERE id = $${params.length - 1} AND organization_id = $${params.length}::uuid
       RETURNING *`,
      params,
    );
    return res.json(mapSection(result.rows[0]));
  } catch (error: any) {
    if (error?.code === '23P01') {
      return res.status(409).json({ isValid: false, reason: 'Selected time overlaps with an existing section' });
    }
    console.error(error);
    return res.status(500).json({ message: 'Failed to update video section' });
  }
});

// ── Delete section ──────────────────────────────────────────────────────────
// DELETE /video-sections/:sectionId
videoSectionsRouter.delete('/:sectionId', async (req: AuthenticatedRequest, res) => {
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });
  const result = await db.query(
    `DELETE FROM video_sections WHERE id = $1 AND organization_id = $2::uuid RETURNING id`,
    [req.params.sectionId, orgId],
  );
  if ((result.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Section not found' });
  return res.json({ status: 'deleted' });
});

// ── Attach quiz to section ──────────────────────────────────────────────────
// POST /video-sections/:sectionId/quiz
videoSectionsRouter.post('/:sectionId/quiz', async (req: AuthenticatedRequest, res) => {
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  const parsed = attachQuizSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'quizId is required' });

  const existing = await loadSection(req.params.sectionId, orgId);
  if (!existing) return res.status(404).json({ message: 'Section not found' });

  const quizCheck = await db.query(
    `SELECT id FROM quizzes WHERE id = $1 AND (organization_id = $2::uuid OR is_global = true)`,
    [parsed.data.quizId, orgId],
  );
  if ((quizCheck.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Quiz not found' });

  try {
    const result = await db.query(
      `UPDATE video_sections
       SET quiz_id = $1, updated_at = NOW()
       WHERE id = $2 AND organization_id = $3::uuid
       RETURNING *`,
      [parsed.data.quizId, req.params.sectionId, orgId],
    );
    return res.json(mapSection(result.rows[0]));
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to attach quiz' });
  }
});

// ── Detach quiz from section ────────────────────────────────────────────────
// DELETE /video-sections/:sectionId/quiz
videoSectionsRouter.delete('/:sectionId/quiz', async (req: AuthenticatedRequest, res) => {
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  const existing = await loadSection(req.params.sectionId, orgId);
  if (!existing) return res.status(404).json({ message: 'Section not found' });

  const result = await db.query(
    `UPDATE video_sections
     SET quiz_id = NULL, updated_at = NOW()
     WHERE id = $1 AND organization_id = $2::uuid
     RETURNING *`,
    [req.params.sectionId, orgId],
  );
  return res.json(mapSection(result.rows[0]));
});

// ── Get quiz for active section (dynamic quiz panel) ─────────────────────────
// GET /video-sections/:sectionId/quiz
videoSectionsRouter.get('/:sectionId/quiz', async (req: AuthenticatedRequest, res) => {
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  const section = await loadSection(req.params.sectionId, orgId);
  if (!section) return res.status(404).json({ message: 'Section not found' });
  if (!section.quiz_id) return res.json({ quiz: null });

  const quizResult = await db.query(
    `SELECT id, title, description, difficulty_level FROM quizzes WHERE id = $1`,
    [section.quiz_id],
  );
  if ((quizResult.rowCount ?? 0) === 0) return res.json({ quiz: null });
  const questionsResult = await db.query(
    `SELECT id, question_type, question_title, question_instruction, points, sort_order, question_data
     FROM quiz_questions WHERE quiz_id = $1 ORDER BY sort_order ASC, created_at ASC`,
    [section.quiz_id],
  );
  return res.json({
    quiz: {
      id: quizResult.rows[0].id,
      title: quizResult.rows[0].title,
      description: quizResult.rows[0].description,
      difficulty: quizResult.rows[0].difficulty_level,
      questions: questionsResult.rows,
    },
  });
});

// ── Submit quiz for section (records progress) ───────────────────────────────
// POST /video-sections/:sectionId/quiz/submit
videoSectionsRouter.post('/:sectionId/quiz/submit', async (req: AuthenticatedRequest, res) => {
  const orgId = getOrganizationId(req);
  const studentId = getUserId(req);
  if (!orgId || !studentId) return res.status(400).json({ message: 'Auth context incomplete' });

  const parsed = submitQuizSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'score and totalPoints are required' });

  const section = await loadSection(req.params.sectionId, orgId);
  if (!section) return res.status(404).json({ message: 'Section not found' });

  const pct = parsed.data.totalPoints > 0
    ? Math.round((parsed.data.score / parsed.data.totalPoints) * 100)
    : 0;

  const result = await db.query(
    `INSERT INTO student_video_progress
       (student_id, content_id, section_id, organization_id, quiz_status, quiz_score, completed_at)
     VALUES ($1::uuid, $2, $3, $4::uuid, 'completed', $5, NOW())
     ON CONFLICT (student_id, section_id) DO UPDATE
       SET quiz_status = 'completed', quiz_score = EXCLUDED.quiz_score,
           completed_at = NOW(), updated_at = NOW()
     RETURNING *`,
    [studentId, section.content_id, section.id, orgId, pct],
  );
  const row = result.rows[0];
  return res.json({
    status: 'submitted',
    quizScore: pct,
    quizStatus: row.quiz_status,
    videoWatchStatus: row.video_watch_status,
  });
});

// ── Save student watch progress ──────────────────────────────────────────────
// POST /video-sections/:sectionId/progress
videoSectionsRouter.post('/:sectionId/progress', async (req: AuthenticatedRequest, res) => {
  const orgId = getOrganizationId(req);
  const studentId = getUserId(req);
  if (!orgId || !studentId) return res.status(400).json({ message: 'Auth context incomplete' });

  const parsed = progressSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid progress payload', errors: parsed.error.issues });

  const section = await loadSection(req.params.sectionId, orgId);
  if (!section) return res.status(404).json({ message: 'Section not found' });

  const watchStatus = parsed.data.videoWatchStatus ?? 'in_progress';
  const watchedSeconds = parsed.data.watchedSeconds ?? 0;

  const result = await db.query(
    `INSERT INTO student_video_progress
       (student_id, content_id, section_id, organization_id, video_watch_status, watched_seconds,
        completed_at)
     VALUES ($1::uuid, $2, $3, $4::uuid, $5, $6, CASE WHEN $5 = 'completed' THEN NOW() ELSE NULL END)
     ON CONFLICT (student_id, section_id) DO UPDATE
       SET video_watch_status = EXCLUDED.video_watch_status,
           watched_seconds = GREATEST(student_video_progress.watched_seconds, EXCLUDED.watched_seconds),
           completed_at = CASE WHEN EXCLUDED.video_watch_status = 'completed'
                               THEN COALESCE(student_video_progress.completed_at, NOW())
                               ELSE student_video_progress.completed_at END,
           updated_at = NOW()
     RETURNING *`,
    [studentId, section.content_id, section.id, orgId, watchStatus, watchedSeconds],
  );
  const row = result.rows[0];
  return res.json({
    status: 'saved',
    videoWatchStatus: row.video_watch_status,
    quizStatus: row.quiz_status,
    watchedSeconds: Number(row.watched_seconds),
  });
});

// ── Student's own progress for a content ────────────────────────────────────
// GET /video-sections/content/:contentId/my-progress
videoSectionsRouter.get('/content/:contentId/my-progress', async (req: AuthenticatedRequest, res) => {
  const orgId = getOrganizationId(req);
  const studentId = getUserId(req);
  if (!orgId || !studentId) return res.status(400).json({ message: 'Auth context incomplete' });
  const result = await db.query(
    `SELECT section_id, video_watch_status, quiz_status, watched_seconds, quiz_score, completed_at
     FROM student_video_progress
     WHERE content_id = $1 AND student_id = $2::uuid AND organization_id = $3::uuid`,
    [req.params.contentId, studentId, orgId],
  );
  return res.json(result.rows.map((r) => ({
    sectionId: r.section_id,
    videoWatchStatus: r.video_watch_status,
    quizStatus: r.quiz_status,
    watchedSeconds: Number(r.watched_seconds),
    quizScore: r.quiz_score != null ? Number(r.quiz_score) : undefined,
    completedAt: r.completed_at || undefined,
  })));
});
