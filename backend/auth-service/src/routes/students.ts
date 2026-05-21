import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { AuthenticatedRequest, requireAuth } from './auth.js';

function getSingleParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function getRequestOrganizationId(req: AuthenticatedRequest): string | null {
  return req.user?.organizationId || null;
}

const logActivitySchema = z.object({
  activityType: z.enum(['content', 'quiz', 'assignment']),
  referenceId: z.string().uuid().optional(),
  referenceTitle: z.string().trim().max(255).optional(),
  status: z.enum(['completed', 'pending', 'attempted']).default('attempted'),
  score: z.number().int().min(0).max(100).optional().nullable(),
  timeSpentSeconds: z.number().int().min(0).default(0),
});

const analyticsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export const studentsRouter = Router();

// ── GET /students/parent/:parentId/students ─────────────────────────────────
// Returns all students linked to a parent with their profile + latest analytics
studentsRouter.get('/parent/:parentId/students', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parentId = getSingleParam(req.params.parentId);
  const organizationId = getRequestOrganizationId(req);

  if (!parentId) return res.status(400).json({ message: 'Invalid parent id' });

  // Allow: admin OR the parent themselves
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
  const isSelf = req.user?.userId === parentId;
  if (!isAdmin && !isSelf) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const result = await db.query(
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         u.email,
         u.mobile_number,
         u.class_level,
         u.profile_image,
         sa.streak_days,
         sa.consistency_score,
         sa.completion_rate,
         sa.attempted_count,
         sa.completed_count,
         sa.total_time_seconds
       FROM parent_student_links psl
       INNER JOIN users u ON u.id = psl.student_user_id
       LEFT JOIN student_analytics sa
         ON sa.student_id = u.id
         AND sa.analytics_date = (
           SELECT MAX(analytics_date) FROM student_analytics WHERE student_id = u.id
         )
       WHERE psl.parent_user_id = $1
         AND psl.organization_id = $2::uuid
         AND u.deleted_at IS NULL
       ORDER BY u.first_name ASC`,
      [parentId, organizationId],
    );

    const students = result.rows.map((row) => ({
      id: row.id as string,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      email: row.email as string,
      mobileNumber: (row.mobile_number as string | null) || undefined,
      classLevel: (row.class_level as string | null) || undefined,
      profileImage: (row.profile_image as string | null) || undefined,
      analytics: {
        streakDays: Number(row.streak_days || 0),
        consistencyScore: Number(row.consistency_score || 0),
        completionRate: Number(row.completion_rate || 0),
        attemptedCount: Number(row.attempted_count || 0),
        completedCount: Number(row.completed_count || 0),
        totalTimeSeconds: Number(row.total_time_seconds || 0),
      },
    }));

    return res.json({ students });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch students for parent' });
  }
});

// ── GET /students/:id/activity ──────────────────────────────────────────────
studentsRouter.get('/:id/activity', requireAuth, async (req: AuthenticatedRequest, res) => {
  const studentId = getSingleParam(req.params.id);
  const organizationId = getRequestOrganizationId(req);
  const limitRaw = parseInt((req.query.limit as string) || '50', 10);
  const limit = Math.min(Math.max(limitRaw, 1), 200);
  const activityType = getSingleParam(req.query.activityType as string | undefined);
  const fromDate = getSingleParam(req.query.from as string | undefined);
  const toDate = getSingleParam(req.query.to as string | undefined);

  if (!studentId) return res.status(400).json({ message: 'Invalid student id' });

  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
  const isSelf = req.user?.userId === studentId;
  // Parents can also read their children's activity — checked via parent_student_links
  let isParentOfStudent = false;
  if (!isAdmin && !isSelf) {
    const parentCheck = await db.query(
      `SELECT 1 FROM parent_student_links
       WHERE parent_user_id = $1 AND student_user_id = $2 AND organization_id = $3::uuid LIMIT 1`,
      [req.user?.userId, studentId, organizationId],
    );
    isParentOfStudent = (parentCheck.rowCount ?? 0) > 0;
    if (!isParentOfStudent) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  }

  try {
    const params: unknown[] = [studentId, organizationId, limit];
    const whereClauses = ['sa.student_id = $1', 'sa.organization_id = $2::uuid'];
    if (activityType) {
      params.push(activityType);
      whereClauses.push(`sa.activity_type = $${params.length}`);
    }
    if (fromDate) {
      params.push(fromDate);
      whereClauses.push(`sa.activity_date >= $${params.length}::date`);
    }
    if (toDate) {
      params.push(toDate);
      whereClauses.push(`sa.activity_date <= $${params.length}::date`);
    }

    const result = await db.query(
      `SELECT
         sa.id,
         sa.activity_type,
         sa.reference_id,
         sa.reference_title,
         sa.status,
         sa.score,
         sa.time_spent_seconds,
         sa.activity_date,
         sa.created_at
       FROM student_activity sa
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY sa.activity_date DESC, sa.created_at DESC
       LIMIT $3`,
      params,
    );

    const activities = result.rows.map((row) => ({
      id: row.id as string,
      activityType: row.activity_type as string,
      referenceId: (row.reference_id as string | null) || undefined,
      referenceTitle: (row.reference_title as string | null) || undefined,
      status: row.status as string,
      score: (row.score as number | null) ?? undefined,
      timeSpentSeconds: Number(row.time_spent_seconds || 0),
      activityDate: row.activity_date as string,
      createdAt: row.created_at as string,
    }));

    return res.json({ activities });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch student activity' });
  }
});

// ── POST /students/:id/activity ─────────────────────────────────────────────
studentsRouter.post('/:id/activity', requireAuth, async (req: AuthenticatedRequest, res) => {
  const studentId = getSingleParam(req.params.id);
  const organizationId = getRequestOrganizationId(req);
  const parsed = logActivitySchema.safeParse(req.body);

  if (!studentId) return res.status(400).json({ message: 'Invalid student id' });
  if (!parsed.success) return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });

  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
  const isSelf = req.user?.userId === studentId;
  if (!isAdmin && !isSelf) {
    return res.status(403).json({ message: 'Forbidden: can only log own activity' });
  }

  const { activityType, referenceId, referenceTitle, status, score, timeSpentSeconds } = parsed.data;

  try {
    const insertResult = await db.query(
      `INSERT INTO student_activity(student_id, organization_id, activity_type, reference_id, reference_title, status, score, time_spent_seconds)
       VALUES($1, $2::uuid, $3, $4::uuid, $5, $6, $7, $8)
       RETURNING id, activity_type, reference_title, status, score, time_spent_seconds, activity_date, created_at`,
      [studentId, organizationId, activityType, referenceId || null, referenceTitle || null, status, score ?? null, timeSpentSeconds],
    );

    // Recompute today's analytics for this student
    await recomputeDailyAnalytics(studentId, organizationId!);

    const row = insertResult.rows[0];
    return res.status(201).json({
      id: row.id as string,
      activityType: row.activity_type as string,
      referenceTitle: (row.reference_title as string | null) || undefined,
      status: row.status as string,
      score: (row.score as number | null) ?? undefined,
      timeSpentSeconds: Number(row.time_spent_seconds || 0),
      activityDate: row.activity_date as string,
      createdAt: row.created_at as string,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to log activity' });
  }
});

// ── GET /students/:id/analytics ─────────────────────────────────────────────
studentsRouter.get('/:id/analytics', requireAuth, async (req: AuthenticatedRequest, res) => {
  const studentId = getSingleParam(req.params.id);
  const organizationId = getRequestOrganizationId(req);
  const parsedQuery = analyticsQuerySchema.safeParse(req.query);

  if (!studentId) return res.status(400).json({ message: 'Invalid student id' });

  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
  const isSelf = req.user?.userId === studentId;
  if (!isAdmin && !isSelf) {
    const parentCheck = await db.query(
      `SELECT 1 FROM parent_student_links
       WHERE parent_user_id = $1 AND student_user_id = $2 AND organization_id = $3::uuid LIMIT 1`,
      [req.user?.userId, studentId, organizationId],
    );
    if ((parentCheck.rowCount ?? 0) === 0) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  }

  const fromDate = parsedQuery.success ? parsedQuery.data.from : undefined;
  const toDate = parsedQuery.success ? parsedQuery.data.to : undefined;

  try {
    // Daily analytics over date range
    const params: unknown[] = [studentId, organizationId];
    const whereClauses = ['sa.student_id = $1', 'sa.organization_id = $2::uuid'];
    if (fromDate) {
      params.push(fromDate);
      whereClauses.push(`sa.analytics_date >= $${params.length}::date`);
    }
    if (toDate) {
      params.push(toDate);
      whereClauses.push(`sa.analytics_date <= $${params.length}::date`);
    }

    const dailyResult = await db.query(
      `SELECT
         sa.analytics_date,
         sa.streak_days,
         sa.consistency_score,
         sa.attempted_count,
         sa.not_attempted_count,
         sa.completed_count,
         sa.completion_rate,
         sa.total_time_seconds
       FROM student_analytics sa
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY sa.analytics_date DESC
       LIMIT 90`,
      params,
    );

    // Latest summary
    const latest = dailyResult.rows[0];

    // Activity type breakdown (last 30 days)
    const breakdownResult = await db.query(
      `SELECT
         activity_type,
         COUNT(*) AS count,
         SUM(time_spent_seconds) AS total_time,
         AVG(score) FILTER (WHERE score IS NOT NULL) AS avg_score
       FROM student_activity
       WHERE student_id = $1
         AND organization_id = $2::uuid
         AND activity_date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY activity_type`,
      [studentId, organizationId],
    );

    const breakdown = breakdownResult.rows.reduce(
      (acc, row) => {
        acc[row.activity_type as string] = {
          count: Number(row.count),
          totalTime: Number(row.total_time || 0),
          avgScore: row.avg_score !== null ? Math.round(Number(row.avg_score)) : null,
        };
        return acc;
      },
      {} as Record<string, { count: number; totalTime: number; avgScore: number | null }>,
    );

    return res.json({
      summary: latest
        ? {
            streakDays: Number(latest.streak_days || 0),
            consistencyScore: Number(latest.consistency_score || 0),
            attemptedCount: Number(latest.attempted_count || 0),
            notAttemptedCount: Number(latest.not_attempted_count || 0),
            completedCount: Number(latest.completed_count || 0),
            completionRate: Number(latest.completion_rate || 0),
            totalTimeSeconds: Number(latest.total_time_seconds || 0),
          }
        : null,
      daily: dailyResult.rows.map((row) => ({
        date: row.analytics_date as string,
        streakDays: Number(row.streak_days || 0),
        consistencyScore: Number(row.consistency_score || 0),
        attemptedCount: Number(row.attempted_count || 0),
        completedCount: Number(row.completed_count || 0),
        completionRate: Number(row.completion_rate || 0),
        totalTimeSeconds: Number(row.total_time_seconds || 0),
      })),
      breakdown,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch analytics' });
  }
});

// ── GET /students/:id/assignments ────────────────────────────────────────────
studentsRouter.get('/:id/assignments', requireAuth, async (req: AuthenticatedRequest, res) => {
  const studentId = getSingleParam(req.params.id);
  const organizationId = getRequestOrganizationId(req);
  const status = getSingleParam(req.query.status as string | undefined);

  if (!studentId) return res.status(400).json({ message: 'Invalid student id' });

  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
  const isSelf = req.user?.userId === studentId;
  if (!isAdmin && !isSelf) {
    const parentCheck = await db.query(
      `SELECT 1 FROM parent_student_links
       WHERE parent_user_id = $1 AND student_user_id = $2 AND organization_id = $3::uuid LIMIT 1`,
      [req.user?.userId, studentId, organizationId],
    );
    if ((parentCheck.rowCount ?? 0) === 0) return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const params: unknown[] = [studentId, organizationId];
    const where = ['student_id = $1', 'organization_id = $2::uuid'];
    if (status) {
      params.push(status);
      where.push(`submission_status = $${params.length}`);
    }

    const result = await db.query(
      `SELECT id, assignment_title, file_url, submission_status, submitted_at, grade, feedback, created_at
       FROM assignment_submissions
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC LIMIT 50`,
      params,
    );

    return res.json({
      assignments: result.rows.map((row) => ({
        id: row.id as string,
        title: (row.assignment_title as string | null) || '',
        fileUrl: (row.file_url as string | null) || undefined,
        status: row.submission_status as string,
        submittedAt: (row.submitted_at as string | null) || undefined,
        grade: (row.grade as number | null) ?? undefined,
        feedback: (row.feedback as string | null) || undefined,
        createdAt: row.created_at as string,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch assignments' });
  }
});

// ── GET /students/:id/quiz-attempts ─────────────────────────────────────────
studentsRouter.get('/:id/quiz-attempts', requireAuth, async (req: AuthenticatedRequest, res) => {
  const studentId = getSingleParam(req.params.id);
  const organizationId = getRequestOrganizationId(req);
  const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 100);

  if (!studentId) return res.status(400).json({ message: 'Invalid student id' });

  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
  const isSelf = req.user?.userId === studentId;
  if (!isAdmin && !isSelf) {
    const parentCheck = await db.query(
      `SELECT 1 FROM parent_student_links
       WHERE parent_user_id = $1 AND student_user_id = $2 AND organization_id = $3::uuid LIMIT 1`,
      [req.user?.userId, studentId, organizationId],
    );
    if ((parentCheck.rowCount ?? 0) === 0) return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const result = await db.query(
      `SELECT
         sa.id,
         sa.score,
         sa.total_points,
         sa.completed_at AS attempted_at,
         q.title AS quiz_title,
         q.class_level,
         COUNT(qa.id) AS total_questions,
         COUNT(qa.id) FILTER (WHERE qa.is_correct) AS correct_count,
         CASE WHEN COUNT(qa.id) > 0
              THEN ROUND((COUNT(qa.id) FILTER (WHERE qa.is_correct))::numeric / COUNT(qa.id) * 100)
              ELSE 0 END AS score_pct
       FROM student_attempts sa
       INNER JOIN quizzes q ON q.id = sa.quiz_id
       LEFT JOIN question_attempts qa ON qa.attempt_id = sa.id
       WHERE sa.student_id = $1
         AND q.organization_id = $2::uuid
       GROUP BY sa.id, sa.score, sa.total_points, sa.completed_at, q.title, q.class_level
       ORDER BY sa.completed_at DESC
       LIMIT $3`,
      [studentId, organizationId, limit],
    );

    return res.json({
      attempts: result.rows.map((row) => ({
        id: row.id as string,
        quizTitle: row.quiz_title as string,
        classLevel: (row.class_level as string | null) || undefined,
        score: Number(row.score || 0),
        totalPoints: Number(row.total_points || 0),
        scorePct: Number(row.score_pct || 0),
        totalQuestions: Number(row.total_questions || 0),
        correctCount: Number(row.correct_count || 0),
        attemptedAt: row.attempted_at as string,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch quiz attempts' });
  }
});

// ── GET /students/:id/quiz-attempts/:attemptId ───────────────────────────────
studentsRouter.get('/:id/quiz-attempts/:attemptId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const studentId = getSingleParam(req.params.id);
  const attemptId = getSingleParam(req.params.attemptId);
  const organizationId = getRequestOrganizationId(req);

  if (!studentId || !attemptId) return res.status(400).json({ message: 'Invalid params' });

  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
  const isSelf = req.user?.userId === studentId;
  if (!isAdmin && !isSelf) {
    const parentCheck = await db.query(
      `SELECT 1 FROM parent_student_links
       WHERE parent_user_id = $1 AND student_user_id = $2 AND organization_id = $3::uuid LIMIT 1`,
      [req.user?.userId, studentId, organizationId],
    );
    if ((parentCheck.rowCount ?? 0) === 0) return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    // Verify attempt belongs to this student
    const attemptRow = await db.query(
      `SELECT sa.id, sa.score, sa.total_points, sa.completed_at, q.title AS quiz_title, q.class_level
       FROM student_attempts sa
       JOIN quizzes q ON q.id = sa.quiz_id
       WHERE sa.id = $1 AND sa.student_id = $2 AND q.organization_id = $3::uuid`,
      [attemptId, studentId, organizationId],
    );
    if ((attemptRow.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Attempt not found' });
    const attempt = attemptRow.rows[0];

    // Fetch question-level results
    const qRows = await db.query(
      `SELECT
         qq.id AS question_id,
         qq.question_title,
         qq.question_instruction,
         qq.question_type,
         qq.question_data,
         qq.sort_order,
         qa.is_correct,
         qa.response_data
       FROM question_attempts qa
       JOIN quiz_questions qq ON qq.id = qa.question_id
       WHERE qa.attempt_id = $1
       ORDER BY qq.sort_order ASC NULLS LAST`,
      [attemptId],
    );

    const totalQuestions = qRows.rowCount ?? 0;
    const correctCount = qRows.rows.filter((r) => r.is_correct).length;
    const scorePct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    return res.json({
      attempt: {
        id: attempt.id as string,
        quizTitle: attempt.quiz_title as string,
        classLevel: attempt.class_level as string | null,
        completedAt: attempt.completed_at as string,
        scorePct,
        correctCount,
        totalQuestions,
      },
      questions: qRows.rows.map((r) => ({
        questionId: r.question_id as string,
        questionTitle: r.question_title as string | null,
        questionInstruction: r.question_instruction as string | null,
        questionType: r.question_type as string,
        questionData: r.question_data as Record<string, unknown>,
        sortOrder: r.sort_order as number | null,
        isCorrect: r.is_correct as boolean,
        responseData: r.response_data as Record<string, unknown>,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch attempt details' });
  }
});

// ── GET /students/:id/upcoming-classrooms ────────────────────────────────────
studentsRouter.get('/:id/upcoming-classrooms', requireAuth, async (req: AuthenticatedRequest, res) => {
  const studentId = getSingleParam(req.params.id);
  const organizationId = getRequestOrganizationId(req);

  if (!studentId) return res.status(400).json({ message: 'Invalid student id' });

  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
  const isSelf = req.user?.userId === studentId;
  if (!isAdmin && !isSelf) {
    const parentCheck = await db.query(
      `SELECT 1 FROM parent_student_links
       WHERE parent_user_id = $1 AND student_user_id = $2 AND organization_id = $3::uuid LIMIT 1`,
      [req.user?.userId, studentId, organizationId],
    );
    if ((parentCheck.rowCount ?? 0) === 0) return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    // Get student class level
    const studentRes = await db.query(`SELECT class_level FROM users WHERE id = $1 LIMIT 1`, [studentId]);
    const classLevel = studentRes.rows[0]?.class_level as string | null;

    if (!classLevel) return res.json({ classrooms: [] });

    const result = await db.query(
      `SELECT id, title, class_level, status, description
       FROM classrooms
       WHERE organization_id = $1::uuid
         AND class_level = $2
         AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 5`,
      [organizationId, classLevel],
    );

    return res.json({
      classrooms: result.rows.map((row) => ({
        id: row.id as string,
        title: row.title as string,
        classLevel: row.class_level as string,
        status: row.status as string,
        description: (row.description as string | null) || undefined,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch upcoming classrooms' });
  }
});

// ── Helper: recompute daily analytics ───────────────────────────────────────
async function recomputeDailyAnalytics(studentId: string, organizationId: string) {
  try {
    const todayResult = await db.query(
      `SELECT
         COUNT(*) AS attempted,
         COUNT(*) FILTER (WHERE status = 'completed') AS completed,
         SUM(time_spent_seconds) AS total_time
       FROM student_activity
       WHERE student_id = $1
         AND organization_id = $2::uuid
         AND activity_date = CURRENT_DATE`,
      [studentId, organizationId],
    );

    const streakResult = await db.query(
      `WITH daily AS (
         SELECT DISTINCT activity_date
         FROM student_activity
         WHERE student_id = $1 AND organization_id = $2::uuid
         ORDER BY activity_date DESC
       ),
       ranked AS (
         SELECT activity_date,
                ROW_NUMBER() OVER (ORDER BY activity_date DESC) AS rn
         FROM daily
       )
       SELECT COUNT(*) AS streak
       FROM ranked
       WHERE activity_date = CURRENT_DATE - (rn - 1) * INTERVAL '1 day'`,
      [studentId, organizationId],
    );

    const attempted = Number(todayResult.rows[0]?.attempted || 0);
    const completed = Number(todayResult.rows[0]?.completed || 0);
    const totalTime = Number(todayResult.rows[0]?.total_time || 0);
    const streak = Number(streakResult.rows[0]?.streak || 0);
    const completionRate = attempted > 0 ? Math.round((completed / attempted) * 100 * 100) / 100 : 0;
    const consistencyScore = Math.min(100, streak * 14.3);

    await db.query(
      `INSERT INTO student_analytics(student_id, organization_id, analytics_date, streak_days, consistency_score, attempted_count, completed_count, completion_rate, total_time_seconds)
       VALUES($1, $2::uuid, CURRENT_DATE, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (student_id, analytics_date) DO UPDATE SET
         streak_days = $3,
         consistency_score = $4,
         attempted_count = $5,
         completed_count = $6,
         completion_rate = $7,
         total_time_seconds = $8,
         updated_at = NOW()`,
      [studentId, organizationId, streak, consistencyScore, attempted, completed, completionRate, totalTime],
    );
  } catch (e) {
    console.warn('[analytics] recompute failed:', e);
  }
}
