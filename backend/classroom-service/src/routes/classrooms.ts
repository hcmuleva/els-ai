import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { getSignedMediaUrlIfNeeded, toPersistentMediaUrl } from '../services/s3.js';
import { eventBus } from '../events/bus.js';

async function signMediaValue(value: unknown, cache: Map<string, Promise<string>>): Promise<unknown> {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || (!trimmed.includes('://') && !trimmed.startsWith('s3://'))) return value;
    let pending = cache.get(trimmed);
    if (!pending) {
      pending = getSignedMediaUrlIfNeeded(trimmed).catch(() => trimmed);
      cache.set(trimmed, pending);
    }
    return pending;
  }
  if (Array.isArray(value)) return Promise.all(value.map((item) => signMediaValue(item, cache)));
  if (value && typeof value === 'object') {
    const entries = await Promise.all(
      Object.entries(value as Record<string, unknown>).map(async ([k, v]) => [k, await signMediaValue(v, cache)] as const),
    );
    return Object.fromEntries(entries);
  }
  return value;
}

export const classroomsRouter = Router();

const classroomScheduleTypeSchema = z.enum(['instant', 'scheduled']);
const classroomStatusSchema = z.enum(['draft', 'active', 'completed']);

const classroomAssignmentSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().optional(),
  attachmentUrl: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
  dueDate: z.string().datetime().optional().nullable(),
  isTimeBound: z.boolean().default(false),
});

const createClassroomSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().optional(),
  scheduleType: classroomScheduleTypeSchema,
  startTime: z.string().datetime().optional().nullable(),
  endTime: z.string().datetime().optional().nullable(),
  durationMinutes: z.number().int().min(0).max(1440).default(0),
  classLevel: z.string().trim().min(1).max(50),
  status: classroomStatusSchema.optional(),
  contentIds: z.array(z.string().uuid()).default([]),
  quizIds: z.array(z.string().uuid()).default([]),
  assignments: z.array(classroomAssignmentSchema.omit({ id: true })).default([]),
  isGlobal: z.boolean().default(false),
});

const updateClassroomSchema = z
  .object({
    title: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().optional(),
    scheduleType: classroomScheduleTypeSchema.optional(),
    startTime: z.string().datetime().optional().nullable(),
    endTime: z.string().datetime().optional().nullable(),
    durationMinutes: z.number().int().min(0).max(1440).optional(),
    classLevel: z.string().trim().min(1).max(50).optional(),
    status: classroomStatusSchema.optional(),
    contentIds: z.array(z.string().uuid()).optional(),
    quizIds: z.array(z.string().uuid()).optional(),
    assignments: z.array(classroomAssignmentSchema.omit({ id: true })).optional(),
    isGlobal: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one field must be provided',
  });

const listClassroomsQuerySchema = z.object({
  class_level: z.string().trim().optional(),
  status: classroomStatusSchema.optional(),
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

const addClassroomContentSchema = z.object({
  contentId: z.string().uuid(),
});

const addClassroomQuizSchema = z.object({
  quizId: z.string().uuid(),
});

const addClassroomAssignmentSchema = classroomAssignmentSchema.omit({ id: true });

const studentClassroomsQuerySchema = z.object({
  class_level: z.string().trim().optional(),
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


const RESTARTED_CLASSROOM_SUFFIX_REGEX = /\s+\(Restarted\)$/i;

function filterRestartedClassroomDuplicates<T extends { title?: string | null }>(items: T[]): T[] {
  const baseTitlesWithOriginal = new Set<string>();

  items.forEach((item) => {
    const title = (item.title || '').trim();
    if (!title) return;
    if (!RESTARTED_CLASSROOM_SUFFIX_REGEX.test(title)) {
      baseTitlesWithOriginal.add(title.toLowerCase());
    }
  });

  return items.filter((item) => {
    const title = (item.title || '').trim();
    if (!title) return true;
    if (!RESTARTED_CLASSROOM_SUFFIX_REGEX.test(title)) return true;
    const baseTitle = title.replace(RESTARTED_CLASSROOM_SUFFIX_REGEX, '').trim().toLowerCase();
    return !baseTitlesWithOriginal.has(baseTitle);
  });
}


function resolveClassroomStatus(row: { status?: string; schedule_type?: string; start_time?: string | Date | null }) {
  if (row.status === 'completed') return 'completed';
  if (row.status === 'active') return 'active';
  if (row.schedule_type === 'instant') return 'active';
  if (!row.start_time) return 'draft';
  const startTime = new Date(row.start_time);
  if (Number.isNaN(startTime.getTime())) return 'draft';
  return startTime.getTime() <= Date.now() ? 'active' : 'draft';
}


async function fetchClassroomResources(classroomId: string, orgId: string, studentId?: string) {
  const [contentsResult, quizzesResult, assignmentsResult] = await Promise.all([
    db.query(
      `SELECT
         cc.content_id AS id,
         lc.title,
         lc.class_level,
         lc.subject,
         lc.content_type,
         lc.media_url,
         lc.external_url,
         lc.text_content,
         lc.created_at
       FROM classroom_contents cc
       INNER JOIN learning_contents lc ON lc.id = cc.content_id
       WHERE cc.classroom_id = $1
         AND (lc.organization_id = $2::uuid OR lc.is_global = true)
       ORDER BY cc.sort_order ASC, cc.created_at ASC`,
      [classroomId, orgId],
    ),
    db.query(
      `SELECT
         cq.quiz_id AS id,
         q.title,
         q.class_level,
         q.subject,
         q.quiz_type,
         q.difficulty_level,
         q.total_questions,
         q.is_published,
         q.created_at
       FROM classroom_quizzes cq
       INNER JOIN quizzes q ON q.id = cq.quiz_id
       WHERE cq.classroom_id = $1
         AND (q.organization_id = $2::uuid OR q.is_global = true)
       ORDER BY cq.sort_order ASC, cq.created_at ASC`,
      [classroomId, orgId],
    ),
    db.query(
      `SELECT id, title, description, attachment_url, instructions, due_date, is_time_bound, created_at, updated_at
       FROM classroom_assignments
       WHERE classroom_id = $1
       ORDER BY created_at ASC`,
      [classroomId],
    ),
  ]);

  const quizIds = quizzesResult.rows.map((row: any) => row.id as string).filter(Boolean);
  const assignmentIds = assignmentsResult.rows.map((row: any) => row.id as string).filter(Boolean);

  let quizAttemptMap = new Map<string, { status: 'not_attempted' | 'completed'; score?: number; attemptedAt?: string }>();
  if (studentId && quizIds.length > 0) {
    const attemptsResult = await db.query(
      `SELECT sa.quiz_id, sa.score, sa.total_points, sa.completed_at AS attempted_at
       FROM student_attempts sa
       WHERE sa.student_id = $1
         AND sa.quiz_id = ANY($2::uuid[])
       ORDER BY sa.completed_at DESC`,
      [studentId, quizIds],
    );

    attemptsResult.rows.forEach((row: any) => {
      const quizId = row.quiz_id as string;
      if (quizAttemptMap.has(quizId)) return;
      const totalPoints = Number(row.total_points || 0);
      const scoreValue = Number(row.score || 0);
      const scorePct = totalPoints > 0 ? Math.round((scoreValue / totalPoints) * 100) : 0;
      quizAttemptMap.set(quizId, {
        status: 'completed',
        score: scorePct,
        attemptedAt: row.attempted_at as string,
      });
    });
  }

  let assignmentSubmissionMap = new Map<string, { submitted: boolean; submittedAt?: string; submissionText?: string; attachmentUrl?: string }>();
  if (studentId && assignmentIds.length > 0) {
    const submissionsResult = await db.query(
      `SELECT classroom_assignment_id, submission_text, attachment_url, submitted_at
       FROM classroom_assignment_submissions
       WHERE student_id = $1
         AND classroom_assignment_id = ANY($2::uuid[])`,
      [studentId, assignmentIds],
    );

    submissionsResult.rows.forEach((row: any) => {
      assignmentSubmissionMap.set(row.classroom_assignment_id as string, {
        submitted: true,
        submittedAt: row.submitted_at as string,
        submissionText: (row.submission_text as string | null) || '',
        attachmentUrl: (row.attachment_url as string | null) || '',
      });
    });
  }

  const contentIds = contentsResult.rows.map((row: any) => row.id as string).filter(Boolean);
  let sectionsGroupedByContentId: Record<string, any[]> = {};
  if (contentIds.length > 0) {
    const sectionsResult = await db.query(
      `SELECT id, content_id, section_order, title, content_type, media_url, external_url, text_content
       FROM learning_content_sections
       WHERE content_id = ANY($1::uuid[])
       ORDER BY content_id, section_order ASC`,
      [contentIds]
    );
    for (const row of sectionsResult.rows) {
      const cId = row.content_id as string;
      if (!sectionsGroupedByContentId[cId]) sectionsGroupedByContentId[cId] = [];
      sectionsGroupedByContentId[cId].push({
        id: row.id,
        sectionOrder: Number(row.section_order),
        title: row.title || undefined,
        contentType: row.content_type,
        mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url) : undefined,
        externalUrl: row.external_url || undefined,
        textContent: row.text_content || undefined,
      });
    }
  }

  const contentRows = await Promise.all(
    contentsResult.rows.map(async (row: any) => ({
      id: row.id as string,
      title: row.title as string,
      classLevel: (row.class_level as string) || '',
      subject: (row.subject as string) || '',
      contentType: (row.content_type as string) || '',
      mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : '',
      externalUrl: (row.external_url as string | null) || '',
      textContent: (row.text_content as string | null) || '',
      status: 'not_started',
      createdAt: row.created_at as string,
      sections: sectionsGroupedByContentId[row.id as string] || [],
    })),
  );

  const quizRows = quizzesResult.rows.map((row: any) => ({
    id: row.id as string,
    title: row.title as string,
    classLevel: (row.class_level as string) || '',
    subject: (row.subject as string) || '',
    quizType: (row.quiz_type as string) || '',
    difficultyLevel: (row.difficulty_level as string | null) || '',
    totalQuestions: Number(row.total_questions || 0),
    isPublished: Boolean(row.is_published),
    status: quizAttemptMap.get(row.id as string)?.status || 'not_attempted',
    score: quizAttemptMap.get(row.id as string)?.score,
    attemptedAt: quizAttemptMap.get(row.id as string)?.attemptedAt,
    createdAt: row.created_at as string,
  }));

  const assignmentRows = await Promise.all(
    assignmentsResult.rows.map(async (row: any) => {
      const submission = assignmentSubmissionMap.get(row.id as string);
      const dueDate = row.due_date ? new Date(row.due_date as string) : null;
      const overdue = Boolean(dueDate && dueDate.getTime() < Date.now() && !submission?.submitted);
      const status = submission?.submitted ? 'submitted' : overdue ? 'overdue' : 'pending';
      return {
        id: row.id as string,
        title: row.title as string,
        description: (row.description as string | null) || '',
        attachmentUrl: row.attachment_url ? await getSignedMediaUrlIfNeeded(row.attachment_url as string) : '',
        instructions: (row.instructions as string | null) || '',
        dueDate: row.due_date as string | null,
        isTimeBound: Boolean(row.is_time_bound),
        status,
        submission: submission
          ? {
              submittedAt: submission.submittedAt || null,
              submissionText: submission.submissionText || '',
              attachmentUrl: submission.attachmentUrl ? await getSignedMediaUrlIfNeeded(submission.attachmentUrl) : '',
            }
          : null,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      };
    }),
  );

  return {
    contents: contentRows,
    quizzes: quizRows,
    assignments: assignmentRows,
  };
}


async function replaceClassroomResources(
  client: any,
  classroomId: string,
  orgId: string,
  contentIds: string[],
  quizIds: string[],
  assignments: Array<z.infer<typeof classroomAssignmentSchema>>,
) {
  const uniqueContentIds = [...new Set(contentIds)];
  const uniqueQuizIds = [...new Set(quizIds)];

  if (uniqueContentIds.length > 0) {
    const countResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM learning_contents
       WHERE (organization_id = $1::uuid OR is_global = true)
         AND id = ANY($2::uuid[])`,
      [orgId, uniqueContentIds],
    );
    if (Number(countResult.rows[0]?.count || 0) !== uniqueContentIds.length) {
      throw new Error('One or more content items are invalid for this organization');
    }
  }

  if (uniqueQuizIds.length > 0) {
    const countResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM quizzes
       WHERE (organization_id = $1::uuid OR is_global = true)
         AND id = ANY($2::uuid[])`,
      [orgId, uniqueQuizIds],
    );
    if (Number(countResult.rows[0]?.count || 0) !== uniqueQuizIds.length) {
      throw new Error('One or more quizzes are invalid for this organization');
    }
  }

  await client.query(`DELETE FROM classroom_contents WHERE classroom_id = $1`, [classroomId]);
  await client.query(`DELETE FROM classroom_quizzes WHERE classroom_id = $1`, [classroomId]);
  await client.query(`DELETE FROM classroom_assignments WHERE classroom_id = $1`, [classroomId]);

  for (let i = 0; i < uniqueContentIds.length; i += 1) {
    await client.query(
      `INSERT INTO classroom_contents (classroom_id, content_id, sort_order)
       VALUES ($1, $2, $3)`,
      [classroomId, uniqueContentIds[i], i],
    );
  }

  for (let i = 0; i < uniqueQuizIds.length; i += 1) {
    await client.query(
      `INSERT INTO classroom_quizzes (classroom_id, quiz_id, sort_order)
       VALUES ($1, $2, $3)`,
      [classroomId, uniqueQuizIds[i], i],
    );
  }

  for (let i = 0; i < assignments.length; i += 1) {
    const assignment = assignments[i];
    await client.query(
      `INSERT INTO classroom_assignments (classroom_id, title, description, attachment_url, instructions, due_date, is_time_bound)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        classroomId,
        assignment.title,
        assignment.description?.trim() || null,
        assignment.attachmentUrl?.trim() ? toPersistentMediaUrl(assignment.attachmentUrl.trim()) : null,
        assignment.instructions?.trim() || null,
        assignment.dueDate ? new Date(assignment.dueDate) : null,
        assignment.isTimeBound,
      ],
    );
  }
}


classroomsRouter.get('/_meta', requireAuth, async (_req: AuthenticatedRequest, res) => {
  const totals = await db.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM classrooms`);
  res.json({
    service: 'classroom-service',
    version: '2.0.0',
    phase: 2,
    description: 'Owns the classroom lifecycle (create/schedule/end/restart), attached resources (content, quizzes, assignments), per-student remarks, and the student classroom feed.',
    classroomsInDatabase: Number(totals.rows[0]?.count || 0),
  });
});

classroomsRouter.get('/', requireAuth, async (req: any, res) => {
  const parsedQuery = listClassroomsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid classroom filters', errors: parsedQuery.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }

  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId as string | undefined;
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  const { class_level, status, search, limit } = parsedQuery.data;
  const params: unknown[] = [orgId];
  const whereClauses: string[] = ['(c.organization_id = $1::uuid OR c.is_global = true)'];

  // Teachers only see their own classrooms; admins see all
  if (!canBypassOwnership(req) && userId) {
    params.push(userId);
    whereClauses.push(`(c.created_by = $${params.length} OR c.is_global = true)`);
  }

  if (class_level) {
    params.push(class_level);
    whereClauses.push(`c.class_level = $${params.length}`);
  }
  if (status) {
    params.push(status);
    whereClauses.push(`c.status = $${params.length}`);
  } else {
    // By default exclude completed (ended) classrooms — they live in history
    whereClauses.push(`c.status != 'completed'`);
  }
  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(`(c.title ILIKE $${params.length} OR COALESCE(c.description, '') ILIKE $${params.length})`);
  }

  params.push(limit);

  try {
    const result = await db.query(
      `SELECT
         c.id,
         c.title,
         c.description,
         c.schedule_type,
         c.start_time,
         c.end_time,
         c.duration_minutes,
         c.class_level,
         c.status,
         c.is_global,
         c.created_by,
         c.created_at,
         c.updated_at,
         COALESCE(COUNT(DISTINCT cc.content_id), 0)::int AS content_count,
         COALESCE(COUNT(DISTINCT cq.quiz_id), 0)::int AS quiz_count,
         COALESCE(COUNT(DISTINCT ca.id), 0)::int AS assignment_count
       FROM classrooms c
       LEFT JOIN classroom_contents cc ON cc.classroom_id = c.id
       LEFT JOIN classroom_quizzes cq ON cq.classroom_id = c.id
       LEFT JOIN classroom_assignments ca ON ca.classroom_id = c.id
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    const classrooms = result.rows.map((row: any) => ({
      id: row.id as string,
      title: row.title as string,
      description: (row.description as string | null) || '',
      scheduleType: row.schedule_type as 'instant' | 'scheduled',
      startTime: row.start_time as string | null,
      endTime: row.end_time as string | null,
      durationMinutes: Number(row.duration_minutes || 0),
      classLevel: row.class_level as string,
      status: resolveClassroomStatus(row),
      isGlobal: Boolean(row.is_global),
      createdBy: row.created_by as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      contentCount: Number(row.content_count || 0),
      quizCount: Number(row.quiz_count || 0),
      assignmentCount: Number(row.assignment_count || 0),
    }));

    return res.json({ classrooms: filterRestartedClassroomDuplicates(classrooms) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch classrooms' });
  }
});

// GET /classrooms/history — All completed classrooms for this teacher
classroomsRouter.get('/history', requireAuth, async (req: any, res) => {
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId as string | undefined;
  if (!orgId || !userId) return res.status(400).json({ message: 'Auth context missing' });

  try {
    const r = await db.query(
      `SELECT c.id, c.title, c.class_level, c.schedule_type, c.start_time, c.ended_at,
              c.duration_minutes, c.status, c.created_at,
              COALESCE(COUNT(DISTINCT cc.content_id), 0)::int AS content_count,
              COALESCE(COUNT(DISTINCT cq.quiz_id), 0)::int     AS quiz_count,
              COALESCE(COUNT(DISTINCT ca.id), 0)::int          AS assignment_count,
              COALESCE((SELECT COUNT(DISTINCT student_id) FROM classroom_assignment_submissions cas2
                        JOIN classroom_assignments ca2 ON ca2.id = cas2.classroom_assignment_id
                        WHERE ca2.classroom_id = c.id), 0)::int AS student_count
       FROM classrooms c
       LEFT JOIN classroom_contents   cc ON cc.classroom_id = c.id
       LEFT JOIN classroom_quizzes    cq ON cq.classroom_id = c.id
       LEFT JOIN classroom_assignments ca ON ca.classroom_id = c.id
       WHERE c.organization_id = $1::uuid AND c.created_by = $2 AND c.status = 'completed'
       GROUP BY c.id
       ORDER BY c.ended_at DESC NULLS LAST
       LIMIT 100`,
      [orgId, userId],
    );
    return res.json({ classrooms: filterRestartedClassroomDuplicates(r.rows) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to fetch history' });
  }
});


classroomsRouter.get('/student', requireAuth, async (req: any, res) => {
  const parsedQuery = studentClassroomsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid classroom query filters', errors: parsedQuery.error.issues });
  }

  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId as string | undefined;
  if (!orgId || !userId) return res.status(400).json({ message: 'Organization/user not found in auth context' });

  try {
    let studentRow;
    try {
      studentRow = await db.query(
        `SELECT class_level, active_role
         FROM users
         WHERE id = $1
           AND organization_id = $2::uuid
         LIMIT 1`,
        [userId, orgId],
      );
    } catch (error: any) {
      if (error?.code === '42703') {
        studentRow = await db.query(
          `SELECT class_level, active_role
           FROM users
           WHERE id = $1
           LIMIT 1`,
          [userId],
        );
      } else {
        throw error;
      }
    }

    const defaultClassLevel = (studentRow?.rows?.[0]?.class_level as string | null) || '';
    const role = (studentRow?.rows?.[0]?.active_role as string | null) || (req?.user?.role as string | null) || '';
    const requestedClassLevel = parsedQuery.data.class_level?.trim() || '';
    const classLevel = requestedClassLevel || defaultClassLevel;
    let classRows;
    try {
      classRows = await db.query(
        `SELECT DISTINCT class_level
         FROM classrooms
         WHERE organization_id = $1::uuid OR is_global = true
         ORDER BY class_level ASC`,
        [orgId],
      );
    } catch (error: any) {
      if (error?.code === '42703') {
        classRows = await db.query(
          `SELECT DISTINCT class_level
           FROM classrooms
           ORDER BY class_level ASC`,
        );
      } else {
        throw error;
      }
    }
    const classLevels = classRows.rows
      .map((row: any) => (row.class_level as string) || '')
      .filter(Boolean);
    if (defaultClassLevel && !classLevels.includes(defaultClassLevel)) {
      classLevels.unshift(defaultClassLevel);
    }
    if (requestedClassLevel && !classLevels.includes(requestedClassLevel)) {
      classLevels.unshift(requestedClassLevel);
    }

    // 'ANY' is a sentinel class_level that should be visible to every student
    // regardless of their own users.class_level value.
    const ANY_CLASS_VALUE = 'ANY';

    if (role !== 'student') {
      return res.json({ classrooms: [], classLevels, currentClassLevel: classLevel || '' });
    }
    // If the student has no class set, fall through with sentinel so they still
    // receive ANY-class rooms.
    const effectiveClassLevel = classLevel || ANY_CLASS_VALUE;
    let classroomResult;
    try {
      classroomResult = await db.query(
        `SELECT id, title, description, schedule_type, start_time, end_time, duration_minutes, class_level, status, created_at, updated_at
         FROM classrooms
         WHERE (organization_id = $1::uuid OR is_global = true)
           AND (class_level = $2 OR class_level = $3)
         ORDER BY created_at DESC`,
        [orgId, effectiveClassLevel, ANY_CLASS_VALUE],
      );
    } catch (error: any) {
      if (error?.code === '42703') {
        classroomResult = await db.query(
          `SELECT id, title, description, schedule_type, start_time, end_time, duration_minutes, class_level, status, created_at, updated_at
           FROM classrooms
           WHERE class_level = $1 OR class_level = $2
           ORDER BY created_at DESC`,
          [effectiveClassLevel, ANY_CLASS_VALUE],
        );
      } else {
        throw error;
      }
    }

    const classrooms = await Promise.all(
      classroomResult.rows.map(async (row: any) => {
        const resources = await fetchClassroomResources(row.id as string, orgId, userId);
        const completedQuizzes = resources.quizzes.filter((quiz: any) => quiz.status === 'completed').length;
        const submittedAssignments = resources.assignments.filter((assignment: any) => assignment.status === 'submitted').length;
        const completedActivities = completedQuizzes + submittedAssignments;
        const totalActivities = resources.contents.length + resources.quizzes.length + resources.assignments.length;
        const completionPct = totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0;
        return {
          id: row.id as string,
          title: row.title as string,
          description: (row.description as string | null) || '',
          scheduleType: row.schedule_type as 'instant' | 'scheduled',
          startTime: row.start_time as string | null,
          endTime: row.end_time as string | null,
          durationMinutes: Number(row.duration_minutes || 0),
          classLevel: row.class_level as string,
          status: resolveClassroomStatus(row),
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
          completionPct,
          ...resources,
        };
      }),
    );

    return res.json({ classrooms: filterRestartedClassroomDuplicates(classrooms), classLevels, currentClassLevel: classLevel });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch student classrooms' });
  }
});

classroomsRouter.get('/:classroomId', requireAuth, async (req: any, res) => {
  const classroomId = req.params.classroomId as string;
  if (!classroomId) return res.status(400).json({ message: 'Invalid classroom id' });
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });

  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  try {
    const result = await db.query(
      `SELECT id, title, description, schedule_type, start_time, end_time, duration_minutes, class_level, status, created_by, created_at, updated_at
       FROM classrooms
       WHERE id = $1
         AND organization_id = $2::uuid
       LIMIT 1`,
      [classroomId, orgId],
    );
    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    const classroomRow = result.rows[0] as any;
    const resources = await fetchClassroomResources(classroomId, orgId);
    return res.json({
      classroom: {
        id: classroomRow.id as string,
        title: classroomRow.title as string,
        description: (classroomRow.description as string | null) || '',
        scheduleType: classroomRow.schedule_type as 'instant' | 'scheduled',
        startTime: classroomRow.start_time as string | null,
        endTime: classroomRow.end_time as string | null,
        durationMinutes: Number(classroomRow.duration_minutes || 0),
        classLevel: classroomRow.class_level as string,
        status: resolveClassroomStatus(classroomRow),
        createdBy: classroomRow.created_by as string,
        createdAt: classroomRow.created_at as string,
        updatedAt: classroomRow.updated_at as string,
      },
      ...resources,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch classroom details' });
  }
});

classroomsRouter.post('/', requireAuth, async (req: any, res) => {
  const parsedBody = createClassroomSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid classroom payload', errors: parsedBody.error.issues });
  }
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });

  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId as string | undefined;
  if (!orgId || !userId) return res.status(400).json({ message: 'Organization/user not found in auth context' });

  const {
    title,
    description,
    scheduleType,
    startTime,
    endTime,
    durationMinutes,
    classLevel,
    status,
    contentIds,
    quizIds,
    assignments,
    isGlobal,
  } = parsedBody.data;
  if (isGlobal && !canPublishGlobalResources(req)) {
    return res.status(403).json({ message: 'Forbidden: global publish permission required' });
  }
  if (scheduleType === 'scheduled') {
    if (!startTime) {
      return res.status(400).json({ message: 'Start date & time is required for scheduled classroom' });
    }
    const startMs = new Date(startTime).getTime();
    if (Number.isNaN(startMs) || startMs <= Date.now()) {
      return res.status(400).json({ message: 'Start date & time must be in the future' });
    }
    if (endTime) {
      const endMs = new Date(endTime).getTime();
      if (Number.isNaN(endMs) || endMs <= Date.now()) {
        return res.status(400).json({ message: 'End date & time must be in the future' });
      }
      if (endMs <= startMs) {
        return res.status(400).json({ message: 'End time must be after start time' });
      }
    }
  }

  const classroomStatus = status || (scheduleType === 'instant' ? 'active' : 'draft');
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const insertResult = await client.query(
      `INSERT INTO classrooms (organization_id, title, description, schedule_type, start_time, end_time, duration_minutes, class_level, created_by, status, is_global)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        orgId,
        title,
        description?.trim() || null,
        scheduleType,
        scheduleType === 'scheduled' && startTime ? new Date(startTime) : null,
        scheduleType === 'scheduled' && endTime ? new Date(endTime) : null,
        durationMinutes,
        classLevel,
        userId,
        classroomStatus,
        isGlobal,
      ],
    );
    const classroomId = insertResult.rows[0].id as string;

    await replaceClassroomResources(client, classroomId, orgId, contentIds, quizIds, assignments);
    await client.query('COMMIT');

    const detailResult = await db.query(
      `SELECT id, title, description, schedule_type, start_time, end_time, duration_minutes, class_level, status, created_by, created_at, updated_at
       FROM classrooms
       WHERE id = $1
       LIMIT 1`,
      [classroomId],
    );
    const classroomRow = detailResult.rows[0] as any;
    const resources = await fetchClassroomResources(classroomId, orgId);
    try {
      await eventBus.publish({
        type: 'classroom.scheduled',
        source: 'classroom-service',
        organizationId: orgId,
        userId,
        payload: {
          classroomId,
          title: classroomRow.title,
          scheduleType: classroomRow.schedule_type,
          startTime: classroomRow.start_time,
          endTime: classroomRow.end_time,
          classLevel: classroomRow.class_level,
        },
      });
    } catch (err) {
      console.error('[classroom-service] failed to publish classroom.scheduled', err);
    }
    return res.status(201).json({
      classroom: {
        id: classroomRow.id as string,
        title: classroomRow.title as string,
        description: (classroomRow.description as string | null) || '',
        scheduleType: classroomRow.schedule_type as 'instant' | 'scheduled',
        startTime: classroomRow.start_time as string | null,
        endTime: classroomRow.end_time as string | null,
        durationMinutes: Number(classroomRow.duration_minutes || 0),
        classLevel: classroomRow.class_level as string,
        status: resolveClassroomStatus(classroomRow),
        createdBy: classroomRow.created_by as string,
        createdAt: classroomRow.created_at as string,
        updatedAt: classroomRow.updated_at as string,
      },
      ...resources,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    const message = error instanceof Error ? error.message : 'Failed to create classroom';
    return res.status(500).json({ message });
  } finally {
    client.release();
  }
});

classroomsRouter.put('/:classroomId', requireAuth, async (req: any, res) => {
  const classroomId = req.params.classroomId as string;
  const parsedBody = updateClassroomSchema.safeParse(req.body);
  if (!classroomId) return res.status(400).json({ message: 'Invalid classroom id' });
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid classroom update payload', errors: parsedBody.error.issues });
  }
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });

  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId as string | undefined;
  if (!orgId || !userId) return res.status(400).json({ message: 'Organization/user not found in auth context' });

  const updates = parsedBody.data;
  if (updates.startTime) {
    const ms = new Date(updates.startTime).getTime();
    if (Number.isNaN(ms) || ms <= Date.now()) {
      return res.status(400).json({ message: 'Start date & time must be in the future' });
    }
  }
  if (updates.endTime) {
    const endMs = new Date(updates.endTime).getTime();
    if (Number.isNaN(endMs) || endMs <= Date.now()) {
      return res.status(400).json({ message: 'End date & time must be in the future' });
    }
    if (updates.startTime) {
      const startMs = new Date(updates.startTime).getTime();
      if (endMs <= startMs) {
        return res.status(400).json({ message: 'End time must be after start time' });
      }
    }
  }
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const classroomCheck = await client.query(
      `SELECT created_by, schedule_type, start_time, status
       FROM classrooms
       WHERE id = $1
         AND organization_id = $2::uuid
       LIMIT 1`,
      [classroomId, orgId],
    );
    if ((classroomCheck.rowCount ?? 0) === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Classroom not found' });
    }

    const existing = classroomCheck.rows[0] as any;
    if (!canBypassOwnership(req) && existing.created_by !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ message: 'Only creator can edit this classroom' });
    }

    const setParts: string[] = [];
    const params: unknown[] = [];

    if (updates.title !== undefined) {
      params.push(updates.title);
      setParts.push(`title = $${params.length}`);
    }
    if (updates.description !== undefined) {
      params.push(updates.description?.trim() || null);
      setParts.push(`description = $${params.length}`);
    }
    if (updates.scheduleType !== undefined) {
      params.push(updates.scheduleType);
      setParts.push(`schedule_type = $${params.length}`);
    }
    if (updates.startTime !== undefined) {
      params.push(updates.startTime ? new Date(updates.startTime) : null);
      setParts.push(`start_time = $${params.length}`);
    }
    if (updates.endTime !== undefined) {
      params.push(updates.endTime ? new Date(updates.endTime) : null);
      setParts.push(`end_time = $${params.length}`);
    }
    if (updates.durationMinutes !== undefined) {
      params.push(updates.durationMinutes);
      setParts.push(`duration_minutes = $${params.length}`);
    }
    if (updates.classLevel !== undefined) {
      params.push(updates.classLevel);
      setParts.push(`class_level = $${params.length}`);
    }
    if (updates.status !== undefined) {
      params.push(updates.status);
      setParts.push(`status = $${params.length}`);
    }
    if (updates.isGlobal !== undefined) {
      if (!canPublishGlobalResources(req)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ message: 'Forbidden: global publish permission required' });
      }
      params.push(updates.isGlobal);
      setParts.push(`is_global = $${params.length}`);
    }
    if (setParts.length > 0) {
      setParts.push('updated_at = NOW()');
      params.push(classroomId, orgId);
      await client.query(
        `UPDATE classrooms
         SET ${setParts.join(', ')}
         WHERE id = $${params.length - 1}
           AND organization_id = $${params.length}::uuid`,
        params,
      );
    }

    if (updates.contentIds || updates.quizIds || updates.assignments) {
      await replaceClassroomResources(
        client,
        classroomId,
        orgId,
        updates.contentIds || [],
        updates.quizIds || [],
        updates.assignments || [],
      );
    }

    await client.query('COMMIT');

    const detailResult = await db.query(
      `SELECT id, title, description, schedule_type, start_time, end_time, duration_minutes, class_level, status, created_by, created_at, updated_at
       FROM classrooms
       WHERE id = $1
       LIMIT 1`,
      [classroomId],
    );
    const classroomRow = detailResult.rows[0] as any;
    const resources = await fetchClassroomResources(classroomId, orgId);
    return res.json({
      classroom: {
        id: classroomRow.id as string,
        title: classroomRow.title as string,
        description: (classroomRow.description as string | null) || '',
        scheduleType: classroomRow.schedule_type as 'instant' | 'scheduled',
        startTime: classroomRow.start_time as string | null,
        endTime: classroomRow.end_time as string | null,
        durationMinutes: Number(classroomRow.duration_minutes || 0),
        classLevel: classroomRow.class_level as string,
        status: resolveClassroomStatus(classroomRow),
        createdBy: classroomRow.created_by as string,
        createdAt: classroomRow.created_at as string,
        updatedAt: classroomRow.updated_at as string,
      },
      ...resources,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    const message = error instanceof Error ? error.message : 'Failed to update classroom';
    return res.status(500).json({ message });
  } finally {
    client.release();
  }
});

classroomsRouter.delete('/:classroomId', requireAuth, async (req: any, res) => {
  const classroomId = req.params.classroomId as string;
  if (!classroomId) return res.status(400).json({ message: 'Invalid classroom id' });
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });

  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId as string | undefined;
  if (!orgId || !userId) return res.status(400).json({ message: 'Organization/user not found in auth context' });

  try {
    const classroomResult = await db.query(
      `SELECT id, created_by, schedule_type, start_time
       FROM classrooms
       WHERE id = $1
         AND organization_id = $2::uuid
       LIMIT 1`,
      [classroomId, orgId],
    );
    if ((classroomResult.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Classroom not found' });

    const classroom = classroomResult.rows[0] as any;
    if (!canBypassOwnership(req) && classroom.created_by !== userId) {
      return res.status(403).json({ message: 'Only creator can delete this classroom' });
    }

    const startTime = classroom.start_time ? new Date(classroom.start_time) : null;
    const isStarted = classroom.schedule_type === 'instant' || (startTime ? startTime.getTime() <= Date.now() : false);

    if (isStarted) {
      const activeAssignmentCheck = await db.query(
        `SELECT 1
         FROM classroom_assignments
         WHERE classroom_id = $1
           AND (
             is_time_bound = false
             OR due_date IS NULL
             OR due_date > NOW()
           )
         LIMIT 1`,
        [classroomId],
      );
      if ((activeAssignmentCheck.rowCount ?? 0) > 0) {
        return res.status(400).json({ message: 'Classroom cannot be deleted after start with active assignments' });
      }
    }

    await db.query(
      `DELETE FROM classrooms
       WHERE id = $1
         AND organization_id = $2::uuid`,
      [classroomId, orgId],
    );
    try {
      await eventBus.publish({
        type: 'classroom.deleted',
        source: 'classroom-service',
        organizationId: orgId,
        userId,
        payload: { classroomId },
      });

    } catch (err) {
      console.error('[classroom-service] failed to publish classroom.deleted', err);
    }
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to delete classroom' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CLASSROOM LIFECYCLE — END / HISTORY / RESTART
// ═══════════════════════════════════════════════════════════════════════════

// PATCH /classrooms/:id/end  — Mark classroom as completed
classroomsRouter.patch('/:classroomId/end', requireAuth, async (req: any, res) => {
  const { classroomId } = req.params;
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId as string | undefined;
  if (!orgId || !userId) return res.status(400).json({ message: 'Auth context missing' });

  try {
    const r = await db.query(
      `UPDATE classrooms SET status = 'completed', ended_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND organization_id = $2::uuid AND created_by = $3
       RETURNING id, title, status, ended_at`,
      [classroomId, orgId, userId],
    );
    if ((r.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Classroom not found or not yours' });
    try {
      const [quizRes, assignRes] = await Promise.all([
        db.query(
          `SELECT cq.quiz_id AS id, q.title
             FROM classroom_quizzes cq
             INNER JOIN quizzes q ON q.id = cq.quiz_id
            WHERE cq.classroom_id = $1`,
          [classroomId],
        ),
        db.query(
          `SELECT id, title FROM classroom_assignments WHERE classroom_id = $1`,
          [classroomId],
        ),
      ]);
      await eventBus.publish({
        type: 'classroom.ended',
        source: 'classroom-service',
        organizationId: orgId,
        userId,
        payload: {
          classroomId,
          title: r.rows[0].title,
          quizzes: quizRes.rows.map((x: any) => ({ id: x.id, title: x.title })),
          assignments: assignRes.rows.map((x: any) => ({ id: x.id, title: x.title })),
        },
      });
    } catch (err) {
      console.error('[classroom-service] failed to publish classroom.ended', err);
    }
    return res.json({ classroom: r.rows[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to end classroom' });
  }
});


// PATCH /classrooms/:id/restart — Reactivate existing classroom
classroomsRouter.patch('/:classroomId/restart', requireAuth, async (req: any, res) => {
  const { classroomId } = req.params;
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  const userId = req?.user?.userId as string | undefined;
  if (!orgId || !userId) return res.status(400).json({ message: 'Auth context missing' });

  try {
    const existing = await db.query(
      `SELECT id, created_by
       FROM classrooms
       WHERE id = $1
         AND organization_id = $2::uuid
       LIMIT 1`,
      [classroomId, orgId],
    );
    if ((existing.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Classroom not found' });
    if (!canBypassOwnership(req) && existing.rows[0].created_by !== userId) {
      return res.status(403).json({ message: 'Forbidden: not allowed to restart this classroom' });
    }

    const restarted = await db.query(
      `UPDATE classrooms
       SET status = 'active',
           schedule_type = 'instant',
           start_time = NOW(),
           ended_at = NULL,
           updated_at = NOW()
       WHERE id = $1
         AND organization_id = $2::uuid
       RETURNING id, title, status, class_level`,
      [classroomId, orgId],
    );

    try {
      const row = restarted.rows[0] as any;
      await eventBus.publish({
        type: 'classroom.scheduled',
        source: 'classroom-service',
        organizationId: orgId,
        userId,
        payload: {
          classroomId,
          title: row.title,
          scheduleType: 'instant',
          startTime: null,
          classLevel: row.class_level,
          isRestart: true,
        },
      });

    } catch (err) {
      console.error('[classroom-service] failed to publish classroom restart', err);
    }

    return res.json({ classroom: restarted.rows[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to restart classroom' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CLASS DETAILS — STUDENT PARTICIPATION STATS
// ═══════════════════════════════════════════════════════════════════════════

// GET /classrooms/:id/class-details — Per-student stats for a classroom
classroomsRouter.get('/:classroomId/class-details', requireAuth, async (req: any, res) => {
  const { classroomId } = req.params;
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Auth context missing' });

  try {
    // Classroom meta
    const cr = await db.query(
      `SELECT c.id, c.title, c.class_level, c.schedule_type, c.start_time, c.ended_at,
              c.duration_minutes, c.status, c.created_at,
              COALESCE(COUNT(DISTINCT cq.quiz_id), 0)::int  AS quiz_count,
              COALESCE(COUNT(DISTINCT ca.id), 0)::int       AS assignment_count,
              COALESCE(COUNT(DISTINCT cc.content_id), 0)::int AS content_count
       FROM classrooms c
       LEFT JOIN classroom_quizzes cq ON cq.classroom_id = c.id
       LEFT JOIN classroom_assignments ca ON ca.classroom_id = c.id
       LEFT JOIN classroom_contents cc ON cc.classroom_id = c.id
       WHERE c.id = $1 AND c.organization_id = $2::uuid
       GROUP BY c.id`,
      [classroomId, orgId],
    );
    if (cr.rows.length === 0) return res.status(404).json({ message: 'Classroom not found' });
    const classroom = cr.rows[0];

    // Students who participated via assignment/quiz/remark/achievement
    const studentsRes = await db.query(
      `WITH participants AS (
         SELECT cas.student_id
         FROM classroom_assignment_submissions cas
         JOIN classroom_assignments ca ON ca.id = cas.classroom_assignment_id
         WHERE ca.classroom_id = $1
         UNION
         SELECT sa.student_id
         FROM student_attempts sa
         JOIN classroom_quizzes cq ON cq.quiz_id = sa.quiz_id
         WHERE cq.classroom_id = $1
         UNION
         SELECT csr.student_id
         FROM classroom_student_remarks csr
         WHERE csr.classroom_id = $1
         UNION
         SELECT sacha.student_id
         FROM student_achievements sacha
         WHERE sacha.classroom_id = $1
       )
       SELECT p.student_id,
              TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS student_name,
              u.email AS student_email,
              COALESCE((
                SELECT COUNT(DISTINCT cas2.classroom_assignment_id)::int
                FROM classroom_assignment_submissions cas2
                JOIN classroom_assignments ca2 ON ca2.id = cas2.classroom_assignment_id
                WHERE ca2.classroom_id = $1 AND cas2.student_id = p.student_id
              ), 0) AS assignments_submitted
       FROM participants p
       LEFT JOIN users u ON u.id = p.student_id
       ORDER BY student_name ASC NULLS LAST`,
      [classroomId],
    );

    // Quiz attempts per student
    const quizRes = await db.query(
      `SELECT sa.student_id, COUNT(DISTINCT sa.quiz_id)::int AS quizzes_completed,
              ROUND(AVG(sa.score)::numeric, 1) AS avg_score
       FROM student_attempts sa
       JOIN classroom_quizzes cq ON cq.quiz_id = sa.quiz_id AND cq.classroom_id = $1
       GROUP BY sa.student_id`,
      [classroomId],
    );
    const quizMap: Record<string, { quizzes_completed: number; avg_score: number }> = {};
    for (const row of quizRes.rows) {
      quizMap[row.student_id] = { quizzes_completed: Number(row.quizzes_completed), avg_score: Number(row.avg_score) };
    }

    // Remarks per student
    const remarkRes = await db.query(
      `SELECT DISTINCT ON (student_id)
         student_id, id, remark_text, parent_note, remark_media_url,
         score_behavior, score_confidence, score_participation, score_performance, updated_at
       FROM classroom_student_remarks
       WHERE classroom_id = $1
       ORDER BY student_id, updated_at DESC, created_at DESC`,
      [classroomId],
    );
    const remarkMap: Record<string, any> = {};
    for (const row of remarkRes.rows) remarkMap[row.student_id] = row;

    // Achievements per student
    const achievRes = await db.query(
      `WITH grouped AS (
         SELECT student_id, achievement_id, COUNT(*)::int AS award_count
         FROM student_achievements
         WHERE classroom_id = $1
         GROUP BY student_id, achievement_id
       )
       SELECT g.student_id,
              json_agg(
                json_build_object(
                  'id', a.id,
                  'name', a.name,
                  'emoji', a.emoji,
                  'color', a.color,
                  'count', g.award_count
                )
                ORDER BY a.name ASC
              ) AS achievements
       FROM grouped g
       JOIN achievements a ON a.id = g.achievement_id
       GROUP BY g.student_id`,
      [classroomId],
    );
    const achievMap: Record<string, any[]> = {};
    for (const row of achievRes.rows) achievMap[row.student_id] = row.achievements;

    const students = studentsRes.rows.map((s: any) => {
      const rawRemark = remarkMap[s.student_id];
      const mappedRemark = rawRemark ? {
        id: rawRemark.id as string | undefined,
        remarkText: (rawRemark.remark_text as string | null) ?? null,
        parentNote: (rawRemark.parent_note as string | null) ?? null,
        remarkMediaUrl: (rawRemark.remark_media_url as string | null) ?? null,
        scoreBehavior: rawRemark.score_behavior !== null ? Number(rawRemark.score_behavior) : null,
        scoreConfidence: rawRemark.score_confidence !== null ? Number(rawRemark.score_confidence) : null,
        scoreParticipation: rawRemark.score_participation !== null ? Number(rawRemark.score_participation) : null,
        scorePerformance: rawRemark.score_performance !== null ? Number(rawRemark.score_performance) : null,
      } : null;
      return ({
      studentId: s.student_id,
      name: (s.student_name && s.student_name.trim()) || s.student_email || 'Unknown Student',
      email: s.student_email,
      assignmentsSubmitted: Number(s.assignments_submitted),
      quizzesCompleted: quizMap[s.student_id]?.quizzes_completed ?? 0,
      avgScore: quizMap[s.student_id]?.avg_score ?? 0,
      remark: mappedRemark,
      achievements: achievMap[s.student_id] ?? [],
    });
    });

    const totalAssignments = Number(classroom.assignment_count);
    const totalQuizzes     = Number(classroom.quiz_count);
    const totalContents    = Number(classroom.content_count);
    const joinedCount      = students.length;

    return res.json({
      classroom: {
        id: classroom.id, title: classroom.title, classLevel: classroom.class_level,
        scheduleType: classroom.schedule_type, startTime: classroom.start_time,
        endedAt: classroom.ended_at, durationMinutes: Number(classroom.duration_minutes),
        status: classroom.status, createdAt: classroom.created_at,
        totalAssignments, totalQuizzes, totalContents,
      },
      students,
      summary: {
        joinedCount,
        quizDoneCount:    students.filter((s) => s.quizzesCompleted > 0).length,
        assignmentDoneCount: students.filter((s) => s.assignmentsSubmitted > 0).length,
        completionPct: joinedCount > 0 ? Math.round((students.filter((s) => s.assignmentsSubmitted >= totalAssignments && s.quizzesCompleted >= totalQuizzes).length / joinedCount) * 100) : 0,
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to fetch class details' });
  }
});

// GET /classrooms/:id/students/:studentId/details — quiz attempts + assignment submissions
classroomsRouter.get('/:classroomId/students/:studentId/details', requireAuth, async (req: any, res) => {
  const { classroomId, studentId } = req.params;
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Auth context missing' });
  if (!classroomId || !studentId) return res.status(400).json({ message: 'Invalid classroom or student id' });

  try {
    const classroomCheck = await db.query(
      `SELECT id
       FROM classrooms
       WHERE id = $1
         AND organization_id = $2::uuid
       LIMIT 1`,
      [classroomId, orgId],
    );
    if ((classroomCheck.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Classroom not found' });

    const quizAttemptsResult = await db.query(
      `SELECT
         sa.id AS attempt_id,
         sa.quiz_id,
         q.title AS quiz_title,
         sa.score,
         sa.total_points,
         sa.completed_at
       FROM student_attempts sa
       INNER JOIN classroom_quizzes cq ON cq.quiz_id = sa.quiz_id AND cq.classroom_id = $1
       INNER JOIN quizzes q ON q.id = sa.quiz_id AND q.organization_id = $2::uuid
       WHERE sa.student_id = $3
       ORDER BY sa.completed_at DESC`,
      [classroomId, orgId, studentId],
    );

    const attemptIds = quizAttemptsResult.rows.map((row: any) => row.attempt_id as string);
    let questionAttemptsByAttemptId: Record<string, any[]> = {};
    if (attemptIds.length > 0) {
      const questionAttemptsResult = await db.query(
        `SELECT
           qa.attempt_id,
           qa.question_id,
           qa.is_correct,
           qa.response_data,
           qa.time_spent_seconds,
           qq.question_title,
           qq.question_type,
           qq.question_instruction,
           qq.question_data
         FROM question_attempts qa
         LEFT JOIN quiz_questions qq ON qq.id = qa.question_id
         WHERE qa.attempt_id = ANY($1::uuid[])
         ORDER BY COALESCE(qq.sort_order, 9999) ASC, qa.id ASC`,
        [attemptIds],
      );

      const signCache = new Map<string, Promise<string>>();
      for (const row of questionAttemptsResult.rows) {
        const key = row.attempt_id as string;
        if (!questionAttemptsByAttemptId[key]) questionAttemptsByAttemptId[key] = [];
        const signedQuestionData = await signMediaValue(row.question_data ?? {}, signCache);
        questionAttemptsByAttemptId[key].push({
          questionId: row.question_id as string,
          questionTitle: (row.question_title as string | null) || 'Question',
          questionType: (row.question_type as string | null) || '',
          questionInstruction: (row.question_instruction as string | null) || '',
          questionData: signedQuestionData,
          isCorrect: Boolean(row.is_correct),
          responseData: row.response_data ?? {},
          timeSpentSeconds: row.time_spent_seconds ? Number(row.time_spent_seconds) : null,
        });
      }
    }

    const quizzes = quizAttemptsResult.rows.map((row: any) => ({
      attemptId: row.attempt_id as string,
      quizId: row.quiz_id as string,
      quizTitle: (row.quiz_title as string | null) || 'Quiz',
      score: Number(row.score || 0),
      totalPoints: Number(row.total_points || 0),
      completedAt: row.completed_at as string | null,
      questionAttempts: questionAttemptsByAttemptId[row.attempt_id as string] || [],
    }));

    const assignmentSubmissionsResult = await db.query(
      `SELECT
         ca.id AS assignment_id,
         ca.title,
         ca.description,
         ca.instructions,
         ca.due_date,
         cas.submission_text,
         cas.attachment_url,
         cas.submitted_at
       FROM classroom_assignments ca
       LEFT JOIN classroom_assignment_submissions cas
         ON cas.classroom_assignment_id = ca.id
        AND cas.student_id = $2
       WHERE ca.classroom_id = $1
       ORDER BY ca.created_at ASC`,
      [classroomId, studentId],
    );

    const assignments = await Promise.all(
      assignmentSubmissionsResult.rows.map(async (row: any) => ({
        assignmentId: row.assignment_id as string,
        title: (row.title as string | null) || 'Assignment',
        description: (row.description as string | null) || '',
        instructions: (row.instructions as string | null) || '',
        dueDate: row.due_date as string | null,
        submissionText: (row.submission_text as string | null) || '',
        attachmentUrl: row.attachment_url ? await getSignedMediaUrlIfNeeded(row.attachment_url as string) : '',
        submittedAt: row.submitted_at as string | null,
      })),
    );

    return res.json({ quizzes, assignments });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to fetch student classroom details' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TEACHER REMARKS & SCORES
// ═══════════════════════════════════════════════════════════════════════════

// PUT /classrooms/:id/remarks/:studentId — Upsert remark + scores
classroomsRouter.put('/:classroomId/remarks/:studentId', requireAuth, async (req: any, res) => {
  const { classroomId, studentId } = req.params;
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const userId = req?.user?.userId as string | undefined;
  if (!userId) return res.status(400).json({ message: 'Auth context missing' });

  const { remarkText, parentNote, scoreBehavior, scoreConfidence, scoreParticipation, scorePerformance, remarkMediaUrl } = req.body;
  const normalizeScore = (v: unknown) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    const rounded = Math.round(n);
    return rounded >= 1 && rounded <= 5 ? rounded : null;
  };
  const normalizedBehavior = normalizeScore(scoreBehavior);
  const normalizedConfidence = normalizeScore(scoreConfidence);
  const normalizedParticipation = normalizeScore(scoreParticipation);
  const normalizedPerformance = normalizeScore(scorePerformance);

  try {
    const updated = await db.query(
      `UPDATE classroom_student_remarks
       SET remark_text = $4,
           parent_note = $5,
           remark_media_url = $6,
           score_behavior = $7,
           score_confidence = $8,
           score_participation = $9,
           score_performance = $10,
           teacher_id = $3,
           updated_at = NOW()
       WHERE classroom_id = $1 AND student_id = $2
       RETURNING *`,
      [classroomId, studentId, userId, remarkText ?? null, parentNote ?? null, remarkMediaUrl ?? null,
       normalizedBehavior, normalizedConfidence, normalizedParticipation, normalizedPerformance],
    );
    const orgId = getOrganizationId(req);
    const publishRemarkEvent = async (remarkRow: any) => {
      if (!orgId || !remarkRow) return;
      try {
        await eventBus.publish({
          type: 'notification.requested',
          source: 'classroom-service',
          organizationId: orgId,
          userId,
          payload: {
            kind: 'student_remark',
            remarkId: remarkRow.id,
            classroomId,
            studentUserId: studentId,
            teacherUserId: userId,
            message: remarkText || parentNote || 'Teacher left a remark',
          },
        });
      } catch (err) {
        console.error('[classroom-service] failed to publish remark notification', err);
      }
    };

    if ((updated.rowCount ?? 0) > 0) {
      await publishRemarkEvent(updated.rows[0]);
      return res.json({ remark: updated.rows[0] });
    }

    const inserted = await db.query(
      `INSERT INTO classroom_student_remarks
         (classroom_id, student_id, teacher_id, remark_text, parent_note, remark_media_url,
          score_behavior, score_confidence, score_participation, score_performance, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING *`,
      [classroomId, studentId, userId, remarkText ?? null, parentNote ?? null, remarkMediaUrl ?? null,
       normalizedBehavior, normalizedConfidence, normalizedParticipation, normalizedPerformance],
    );
    await publishRemarkEvent(inserted.rows[0]);
    return res.json({ remark: inserted.rows[0] });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to save remark' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ACHIEVEMENTS — global catalog/grant moved to achievement-service (Phase 2).
// The classroom-scoped lookup below stays here until classroom-service lifts
// the /classrooms/* tree.
// ═══════════════════════════════════════════════════════════════════════════

// GET /classrooms/:id/achievements — All achievements granted in a classroom
classroomsRouter.get('/:classroomId/achievements', requireAuth, async (req: any, res) => {
  const { classroomId } = req.params;
  try {
    const r = await db.query(
      `SELECT sa.id, sa.student_id, sa.granted_at, a.name, a.emoji, a.color, a.description,
              TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS student_name
       FROM student_achievements sa
       JOIN achievements a ON a.id = sa.achievement_id
       LEFT JOIN users u ON u.id = sa.student_id
       WHERE sa.classroom_id = $1
       ORDER BY sa.granted_at DESC`,
      [classroomId],
    );
    return res.json({ achievements: r.rows });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to fetch classroom achievements' });
  }
});

// /students/my-achievements moved to achievement-service as GET /achievements/my (Phase 2).

classroomsRouter.post('/:classroomId/content', requireAuth, async (req: any, res) => {
  const classroomId = req.params.classroomId as string;
  const parsedBody = addClassroomContentSchema.safeParse(req.body);
  if (!classroomId) return res.status(400).json({ message: 'Invalid classroom id' });
  if (!parsedBody.success) return res.status(400).json({ message: 'Invalid payload', errors: parsedBody.error.issues });
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  try {
    const exists = await db.query(
      `SELECT 1 FROM learning_contents WHERE id = $1 AND (organization_id = $2::uuid OR is_global = true) LIMIT 1`,
      [parsedBody.data.contentId, orgId],
    );
    if ((exists.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Content item not found' });
    await db.query(
      `INSERT INTO classroom_contents (classroom_id, content_id, sort_order)
       VALUES ($1, $2, 0)
       ON CONFLICT (classroom_id, content_id) DO NOTHING`,
      [classroomId, parsedBody.data.contentId],
    );
    return res.status(201).json({ message: 'Content assigned successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to assign content' });
  }
});

classroomsRouter.post('/:classroomId/quiz', requireAuth, async (req: any, res) => {
  const classroomId = req.params.classroomId as string;
  const parsedBody = addClassroomQuizSchema.safeParse(req.body);
  if (!classroomId) return res.status(400).json({ message: 'Invalid classroom id' });
  if (!parsedBody.success) return res.status(400).json({ message: 'Invalid payload', errors: parsedBody.error.issues });
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  try {
    const exists = await db.query(
      `SELECT 1 FROM quizzes WHERE id = $1 AND (organization_id = $2::uuid OR is_global = true) LIMIT 1`,
      [parsedBody.data.quizId, orgId],
    );
    if ((exists.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Quiz not found' });
    await db.query(
      `INSERT INTO classroom_quizzes (classroom_id, quiz_id, sort_order)
       VALUES ($1, $2, 0)
       ON CONFLICT (classroom_id, quiz_id) DO NOTHING`,
      [classroomId, parsedBody.data.quizId],
    );
    return res.status(201).json({ message: 'Quiz assigned successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to assign quiz' });
  }
});

classroomsRouter.post('/:classroomId/assignment', requireAuth, async (req: any, res) => {
  const classroomId = req.params.classroomId as string;
  const parsedBody = addClassroomAssignmentSchema.safeParse(req.body);
  if (!classroomId) return res.status(400).json({ message: 'Invalid classroom id' });
  if (!parsedBody.success) return res.status(400).json({ message: 'Invalid payload', errors: parsedBody.error.issues });
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });

  try {
    const result = await db.query(
      `INSERT INTO classroom_assignments (classroom_id, title, description, attachment_url, instructions, due_date, is_time_bound)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        classroomId,
        parsedBody.data.title,
        parsedBody.data.description?.trim() || null,
        parsedBody.data.attachmentUrl?.trim() ? toPersistentMediaUrl(parsedBody.data.attachmentUrl.trim()) : null,
        parsedBody.data.instructions?.trim() || null,
        parsedBody.data.dueDate ? new Date(parsedBody.data.dueDate) : null,
        parsedBody.data.isTimeBound,
      ],
    );
    return res.status(201).json({ id: result.rows[0].id as string });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to add assignment' });
  }
});



