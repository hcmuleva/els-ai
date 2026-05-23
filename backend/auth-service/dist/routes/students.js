import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from './auth.js';
function getSingleParam(value) {
    if (Array.isArray(value))
        return value[0] || null;
    return value || null;
}
function getRequestOrganizationId(req) {
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
studentsRouter.get('/parent/:parentId/students', requireAuth, async (req, res) => {
    const parentId = getSingleParam(req.params.parentId);
    const organizationId = getRequestOrganizationId(req);
    if (!parentId)
        return res.status(400).json({ message: 'Invalid parent id' });
    // Allow: admin OR the parent themselves
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
    const isSelf = req.user?.userId === parentId;
    if (!isAdmin && !isSelf) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    try {
        const result = await db.query(`SELECT
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
       ORDER BY u.first_name ASC`, [parentId, organizationId]);
        const students = result.rows.map((row) => ({
            id: row.id,
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email,
            mobileNumber: row.mobile_number || undefined,
            classLevel: row.class_level || undefined,
            profileImage: row.profile_image || undefined,
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
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch students for parent' });
    }
});
// ── GET /students/:id/activity ──────────────────────────────────────────────
studentsRouter.get('/:id/activity', requireAuth, async (req, res) => {
    const studentId = getSingleParam(req.params.id);
    const organizationId = getRequestOrganizationId(req);
    const limitRaw = parseInt(req.query.limit || '50', 10);
    const limit = Math.min(Math.max(limitRaw, 1), 200);
    const activityType = getSingleParam(req.query.activityType);
    const fromDate = getSingleParam(req.query.from);
    const toDate = getSingleParam(req.query.to);
    if (!studentId)
        return res.status(400).json({ message: 'Invalid student id' });
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
    const isSelf = req.user?.userId === studentId;
    // Parents can also read their children's activity — checked via parent_student_links
    let isParentOfStudent = false;
    if (!isAdmin && !isSelf) {
        const parentCheck = await db.query(`SELECT 1 FROM parent_student_links
       WHERE parent_user_id = $1 AND student_user_id = $2 AND organization_id = $3::uuid LIMIT 1`, [req.user?.userId, studentId, organizationId]);
        isParentOfStudent = (parentCheck.rowCount ?? 0) > 0;
        if (!isParentOfStudent) {
            return res.status(403).json({ message: 'Forbidden' });
        }
    }
    try {
        const params = [studentId, organizationId, limit];
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
        const result = await db.query(`SELECT
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
       LIMIT $3`, params);
        const activities = result.rows.map((row) => ({
            id: row.id,
            activityType: row.activity_type,
            referenceId: row.reference_id || undefined,
            referenceTitle: row.reference_title || undefined,
            status: row.status,
            score: row.score ?? undefined,
            timeSpentSeconds: Number(row.time_spent_seconds || 0),
            activityDate: row.activity_date,
            createdAt: row.created_at,
        }));
        return res.json({ activities });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch student activity' });
    }
});
// ── POST /students/:id/activity ─────────────────────────────────────────────
studentsRouter.post('/:id/activity', requireAuth, async (req, res) => {
    const studentId = getSingleParam(req.params.id);
    const organizationId = getRequestOrganizationId(req);
    const parsed = logActivitySchema.safeParse(req.body);
    if (!studentId)
        return res.status(400).json({ message: 'Invalid student id' });
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
    const isSelf = req.user?.userId === studentId;
    if (!isAdmin && !isSelf) {
        return res.status(403).json({ message: 'Forbidden: can only log own activity' });
    }
    const { activityType, referenceId, referenceTitle, status, score, timeSpentSeconds } = parsed.data;
    try {
        const insertResult = await db.query(`INSERT INTO student_activity(student_id, organization_id, activity_type, reference_id, reference_title, status, score, time_spent_seconds)
       VALUES($1, $2::uuid, $3, $4::uuid, $5, $6, $7, $8)
       RETURNING id, activity_type, reference_title, status, score, time_spent_seconds, activity_date, created_at`, [studentId, organizationId, activityType, referenceId || null, referenceTitle || null, status, score ?? null, timeSpentSeconds]);
        // Recompute today's analytics for this student
        await recomputeDailyAnalytics(studentId, organizationId);
        const row = insertResult.rows[0];
        return res.status(201).json({
            id: row.id,
            activityType: row.activity_type,
            referenceTitle: row.reference_title || undefined,
            status: row.status,
            score: row.score ?? undefined,
            timeSpentSeconds: Number(row.time_spent_seconds || 0),
            activityDate: row.activity_date,
            createdAt: row.created_at,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to log activity' });
    }
});
// ── GET /students/:id/analytics ─────────────────────────────────────────────
studentsRouter.get('/:id/analytics', requireAuth, async (req, res) => {
    const studentId = getSingleParam(req.params.id);
    const organizationId = getRequestOrganizationId(req);
    const parsedQuery = analyticsQuerySchema.safeParse(req.query);
    if (!studentId)
        return res.status(400).json({ message: 'Invalid student id' });
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
    const isSelf = req.user?.userId === studentId;
    if (!isAdmin && !isSelf) {
        const parentCheck = await db.query(`SELECT 1 FROM parent_student_links
       WHERE parent_user_id = $1 AND student_user_id = $2 AND organization_id = $3::uuid LIMIT 1`, [req.user?.userId, studentId, organizationId]);
        if ((parentCheck.rowCount ?? 0) === 0) {
            return res.status(403).json({ message: 'Forbidden' });
        }
    }
    const fromDate = parsedQuery.success ? parsedQuery.data.from : undefined;
    const toDate = parsedQuery.success ? parsedQuery.data.to : undefined;
    try {
        // Daily analytics over date range
        const params = [studentId, organizationId];
        const whereClauses = ['sa.student_id = $1', 'sa.organization_id = $2::uuid'];
        if (fromDate) {
            params.push(fromDate);
            whereClauses.push(`sa.analytics_date >= $${params.length}::date`);
        }
        if (toDate) {
            params.push(toDate);
            whereClauses.push(`sa.analytics_date <= $${params.length}::date`);
        }
        const dailyResult = await db.query(`SELECT
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
       LIMIT 90`, params);
        // Latest summary
        const latest = dailyResult.rows[0];
        // Activity type breakdown (last 30 days)
        const breakdownResult = await db.query(`SELECT
         activity_type,
         COUNT(*) AS count,
         SUM(time_spent_seconds) AS total_time,
         AVG(score) FILTER (WHERE score IS NOT NULL) AS avg_score
       FROM student_activity
       WHERE student_id = $1
         AND organization_id = $2::uuid
         AND activity_date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY activity_type`, [studentId, organizationId]);
        const breakdown = breakdownResult.rows.reduce((acc, row) => {
            acc[row.activity_type] = {
                count: Number(row.count),
                totalTime: Number(row.total_time || 0),
                avgScore: row.avg_score !== null ? Math.round(Number(row.avg_score)) : null,
            };
            return acc;
        }, {});
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
                date: row.analytics_date,
                streakDays: Number(row.streak_days || 0),
                consistencyScore: Number(row.consistency_score || 0),
                attemptedCount: Number(row.attempted_count || 0),
                completedCount: Number(row.completed_count || 0),
                completionRate: Number(row.completion_rate || 0),
                totalTimeSeconds: Number(row.total_time_seconds || 0),
            })),
            breakdown,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch analytics' });
    }
});
// ── GET /students/:id/assignments ────────────────────────────────────────────
studentsRouter.get('/:id/assignments', requireAuth, async (req, res) => {
    const studentId = getSingleParam(req.params.id);
    const organizationId = getRequestOrganizationId(req);
    const status = getSingleParam(req.query.status);
    if (!studentId)
        return res.status(400).json({ message: 'Invalid student id' });
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
    const isSelf = req.user?.userId === studentId;
    if (!isAdmin && !isSelf) {
        const parentCheck = await db.query(`SELECT 1 FROM parent_student_links
       WHERE parent_user_id = $1 AND student_user_id = $2 AND organization_id = $3::uuid LIMIT 1`, [req.user?.userId, studentId, organizationId]);
        if ((parentCheck.rowCount ?? 0) === 0)
            return res.status(403).json({ message: 'Forbidden' });
    }
    try {
        // All assignments in the student's classrooms, LEFT JOIN to get submission if exists
        const params = [studentId, organizationId];
        let statusFilter = '';
        if (status === 'pending') {
            statusFilter = 'AND cas.id IS NULL';
        }
        else if (status === 'submitted') {
            statusFilter = 'AND cas.id IS NOT NULL';
        }
        const result = await db.query(`SELECT
         ca.id,
         ca.title,
         ca.description,
         ca.attachment_url AS file_url,
         ca.due_date,
         ca.created_at,
         cas.id            AS submission_id,
         cas.submission_text,
         cas.submitted_at,
         CASE WHEN cas.id IS NOT NULL THEN 'submitted' ELSE 'pending' END AS status
       FROM classroom_assignments ca
       INNER JOIN classrooms c ON c.id = ca.classroom_id
       INNER JOIN users u ON u.id = $1 AND u.class_level = c.class_level
       LEFT JOIN classroom_assignment_submissions cas
              ON cas.classroom_assignment_id = ca.id AND cas.student_id = $1
       WHERE c.organization_id = $2::uuid
       ${statusFilter}
       ORDER BY ca.created_at DESC
       LIMIT 50`, params);
        return res.json({
            assignments: result.rows.map((row) => ({
                id: row.id,
                title: row.title || '',
                description: row.description || undefined,
                fileUrl: row.file_url || undefined,
                dueDate: row.due_date || undefined,
                status: row.status,
                submittedAt: row.submitted_at || undefined,
                submissionText: row.submission_text || undefined,
                createdAt: row.created_at,
            })),
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch assignments' });
    }
});
// ── GET /students/:id/quiz-attempts ─────────────────────────────────────────
studentsRouter.get('/:id/quiz-attempts', requireAuth, async (req, res) => {
    const studentId = getSingleParam(req.params.id);
    const organizationId = getRequestOrganizationId(req);
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    if (!studentId)
        return res.status(400).json({ message: 'Invalid student id' });
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
    const isSelf = req.user?.userId === studentId;
    if (!isAdmin && !isSelf) {
        const parentCheck = await db.query(`SELECT 1 FROM parent_student_links
       WHERE parent_user_id = $1 AND student_user_id = $2 AND organization_id = $3::uuid LIMIT 1`, [req.user?.userId, studentId, organizationId]);
        if ((parentCheck.rowCount ?? 0) === 0)
            return res.status(403).json({ message: 'Forbidden' });
    }
    try {
        const result = await db.query(`SELECT
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
       LIMIT $3`, [studentId, organizationId, limit]);
        return res.json({
            attempts: result.rows.map((row) => ({
                id: row.id,
                quizTitle: row.quiz_title,
                classLevel: row.class_level || undefined,
                score: Number(row.score || 0),
                totalPoints: Number(row.total_points || 0),
                scorePct: Number(row.score_pct || 0),
                totalQuestions: Number(row.total_questions || 0),
                correctCount: Number(row.correct_count || 0),
                attemptedAt: row.attempted_at,
            })),
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch quiz attempts' });
    }
});
// ── GET /students/:id/quiz-attempts/:attemptId ───────────────────────────────
studentsRouter.get('/:id/quiz-attempts/:attemptId', requireAuth, async (req, res) => {
    const studentId = getSingleParam(req.params.id);
    const attemptId = getSingleParam(req.params.attemptId);
    const organizationId = getRequestOrganizationId(req);
    if (!studentId || !attemptId)
        return res.status(400).json({ message: 'Invalid params' });
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
    const isSelf = req.user?.userId === studentId;
    if (!isAdmin && !isSelf) {
        const parentCheck = await db.query(`SELECT 1 FROM parent_student_links
       WHERE parent_user_id = $1 AND student_user_id = $2 AND organization_id = $3::uuid LIMIT 1`, [req.user?.userId, studentId, organizationId]);
        if ((parentCheck.rowCount ?? 0) === 0)
            return res.status(403).json({ message: 'Forbidden' });
    }
    try {
        // Verify attempt belongs to this student
        const attemptRow = await db.query(`SELECT sa.id, sa.score, sa.total_points, sa.completed_at, q.title AS quiz_title, q.class_level
       FROM student_attempts sa
       JOIN quizzes q ON q.id = sa.quiz_id
       WHERE sa.id = $1 AND sa.student_id = $2 AND q.organization_id = $3::uuid`, [attemptId, studentId, organizationId]);
        if ((attemptRow.rowCount ?? 0) === 0)
            return res.status(404).json({ message: 'Attempt not found' });
        const attempt = attemptRow.rows[0];
        // Fetch question-level results
        const qRows = await db.query(`SELECT
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
       ORDER BY qq.sort_order ASC NULLS LAST`, [attemptId]);
        const totalQuestions = qRows.rowCount ?? 0;
        const correctCount = qRows.rows.filter((r) => r.is_correct).length;
        const scorePct = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
        return res.json({
            attempt: {
                id: attempt.id,
                quizTitle: attempt.quiz_title,
                classLevel: attempt.class_level,
                completedAt: attempt.completed_at,
                scorePct,
                correctCount,
                totalQuestions,
            },
            questions: qRows.rows.map((r) => ({
                questionId: r.question_id,
                questionTitle: r.question_title,
                questionInstruction: r.question_instruction,
                questionType: r.question_type,
                questionData: r.question_data,
                sortOrder: r.sort_order,
                isCorrect: r.is_correct,
                responseData: r.response_data,
            })),
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch attempt details' });
    }
});
// ── GET /students/:id/upcoming-classrooms ────────────────────────────────────
studentsRouter.get('/:id/upcoming-classrooms', requireAuth, async (req, res) => {
    const studentId = getSingleParam(req.params.id);
    const organizationId = getRequestOrganizationId(req);
    if (!studentId)
        return res.status(400).json({ message: 'Invalid student id' });
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
    const isSelf = req.user?.userId === studentId;
    if (!isAdmin && !isSelf) {
        const parentCheck = await db.query(`SELECT 1 FROM parent_student_links
       WHERE parent_user_id = $1 AND student_user_id = $2 AND organization_id = $3::uuid LIMIT 1`, [req.user?.userId, studentId, organizationId]);
        if ((parentCheck.rowCount ?? 0) === 0)
            return res.status(403).json({ message: 'Forbidden' });
    }
    try {
        // Get student class level
        const studentRes = await db.query(`SELECT class_level FROM users WHERE id = $1 LIMIT 1`, [studentId]);
        const classLevel = studentRes.rows[0]?.class_level;
        if (!classLevel)
            return res.json({ classrooms: [] });
        const result = await db.query(`SELECT id, title, class_level, status, description
       FROM classrooms
       WHERE organization_id = $1::uuid
         AND class_level = $2
         AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 5`, [organizationId, classLevel]);
        return res.json({
            classrooms: result.rows.map((row) => ({
                id: row.id,
                title: row.title,
                classLevel: row.class_level,
                status: row.status,
                description: row.description || undefined,
            })),
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch upcoming classrooms' });
    }
});
// ── GET /students/:id/classroom-remarks — parent/student view of all classroom remarks+achievements ──
studentsRouter.get('/:id/classroom-remarks', requireAuth, async (req, res) => {
    const studentId = getSingleParam(req.params.id);
    const organizationId = getRequestOrganizationId(req);
    if (!studentId)
        return res.status(400).json({ message: 'Invalid student id' });
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
    const isSelf = req.user?.userId === studentId;
    if (!isAdmin && !isSelf) {
        const parentCheck = await db.query(`SELECT 1 FROM parent_student_links WHERE parent_user_id=$1 AND student_user_id=$2 AND organization_id=$3::uuid LIMIT 1`, [req.user?.userId, studentId, organizationId]);
        if ((parentCheck.rowCount ?? 0) === 0)
            return res.status(403).json({ message: 'Forbidden' });
    }
    try {
        // Active classrooms with their remark for this student
        const activeRes = await db.query(`SELECT c.id, c.title, c.class_level, c.status, c.created_at,
              r.remark_text, r.parent_note, r.remark_media_url,
              r.score_behavior, r.score_confidence, r.score_participation, r.score_performance
       FROM classrooms c
       LEFT JOIN classroom_student_remarks r ON r.classroom_id = c.id AND r.student_id = $1
       WHERE c.organization_id = $2::uuid AND c.status = 'active'
         AND c.class_level = (SELECT class_level FROM users WHERE id = $1 LIMIT 1)
       ORDER BY c.created_at DESC`, [studentId, organizationId]);
        // Completed classrooms
        const histRes = await db.query(`SELECT c.id, c.title, c.class_level, c.status, c.created_at, c.ended_at,
              r.remark_text, r.parent_note, r.remark_media_url,
              r.score_behavior, r.score_confidence, r.score_participation, r.score_performance
       FROM classrooms c
       LEFT JOIN classroom_student_remarks r ON r.classroom_id = c.id AND r.student_id = $1
       WHERE c.organization_id = $2::uuid AND c.status = 'completed'
         AND c.class_level = (SELECT class_level FROM users WHERE id = $1 LIMIT 1)
       ORDER BY c.ended_at DESC NULLS LAST
       LIMIT 20`, [studentId, organizationId]);
        // Achievements for this student across all classrooms
        const achievRes = await db.query(`SELECT sa.classroom_id, a.id, a.name, a.emoji, a.color, a.description, sa.granted_at
       FROM student_achievements sa
       JOIN achievements a ON a.id = sa.achievement_id
       WHERE sa.student_id = $1
       ORDER BY sa.granted_at DESC`, [studentId]);
        // Group achievements by classroom
        const achievByClass = {};
        for (const row of achievRes.rows) {
            const cid = row.classroom_id;
            if (!achievByClass[cid])
                achievByClass[cid] = [];
            achievByClass[cid].push({ id: row.id, name: row.name, emoji: row.emoji, color: row.color, description: row.description, grantedAt: row.granted_at });
        }
        const mapRow = (row) => ({
            id: row.id,
            title: row.title,
            classLevel: row.class_level,
            status: row.status,
            createdAt: row.created_at,
            endedAt: row.ended_at,
            remarkText: row.remark_text,
            parentNote: row.parent_note,
            remarkMediaUrl: row.remark_media_url,
            scoreBehavior: row.score_behavior,
            scoreConfidence: row.score_confidence,
            scoreParticipation: row.score_participation,
            scorePerformance: row.score_performance,
            achievements: achievByClass[row.id] ?? [],
        });
        return res.json({
            active: activeRes.rows.map(mapRow),
            completed: histRes.rows.map(mapRow),
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch classroom remarks' });
    }
});
// ── Helper: recompute daily analytics ───────────────────────────────────────
async function recomputeDailyAnalytics(studentId, organizationId) {
    try {
        const todayResult = await db.query(`SELECT
         COUNT(*) AS attempted,
         COUNT(*) FILTER (WHERE status = 'completed') AS completed,
         SUM(time_spent_seconds) AS total_time
       FROM student_activity
       WHERE student_id = $1
         AND organization_id = $2::uuid
         AND activity_date = CURRENT_DATE`, [studentId, organizationId]);
        const streakResult = await db.query(`WITH daily AS (
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
       WHERE activity_date = CURRENT_DATE - (rn - 1) * INTERVAL '1 day'`, [studentId, organizationId]);
        const attempted = Number(todayResult.rows[0]?.attempted || 0);
        const completed = Number(todayResult.rows[0]?.completed || 0);
        const totalTime = Number(todayResult.rows[0]?.total_time || 0);
        const streak = Number(streakResult.rows[0]?.streak || 0);
        const completionRate = attempted > 0 ? Math.round((completed / attempted) * 100 * 100) / 100 : 0;
        const consistencyScore = Math.min(100, streak * 14.3);
        await db.query(`INSERT INTO student_analytics(student_id, organization_id, analytics_date, streak_days, consistency_score, attempted_count, completed_count, completion_rate, total_time_seconds)
       VALUES($1, $2::uuid, CURRENT_DATE, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (student_id, analytics_date) DO UPDATE SET
         streak_days = $3,
         consistency_score = $4,
         attempted_count = $5,
         completed_count = $6,
         completion_rate = $7,
         total_time_seconds = $8,
         updated_at = NOW()`, [studentId, organizationId, streak, consistencyScore, attempted, completed, completionRate, totalTime]);
    }
    catch (e) {
        console.warn('[analytics] recompute failed:', e);
    }
}
