import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from './auth.js';
import { buildCounselingReport, extractOpenResponses, } from '../services/counseling-scoring.js';
export const counselingRouter = Router();
// ── Question bank (single source of truth, also exposed via GET) ─────────────
const QUESTIONNAIRE = {
    version: 1,
    scale: { min: 0, max: 5 },
    sections: [
        {
            id: 'basic_info',
            title: 'Basic Info',
            questions: [
                { key: 'profile.name', type: 'text', label: 'Child name' },
                { key: 'profile.classLevel', type: 'class', label: 'Class' },
                { key: 'profile.age', type: 'number', label: 'Age' },
                {
                    key: 'profile.board',
                    type: 'single_choice',
                    label: 'School board',
                    options: ['CBSE', 'ICSE', 'State', 'IB', 'IGCSE', 'Other'],
                },
            ],
        },
        {
            id: 'academic',
            title: 'Academic Assessment',
            subjects: [
                { key: 'math', label: 'Mathematics' },
                { key: 'science', label: 'Science' },
                { key: 'english', label: 'English' },
                { key: 'socialStudies', label: 'Social Studies' },
            ],
            dimensions: [
                { key: 'concept', label: 'Understanding of concepts' },
                { key: 'problemSolving', label: 'Problem-solving ability' },
                { key: 'performance', label: 'Exam performance' },
                { key: 'interest', label: 'Interest level' },
            ],
        },
        {
            id: 'cognitive',
            title: 'Cognitive Skills',
            items: [
                { key: 'cognitive.logicalThinking', label: 'Logical thinking' },
                { key: 'cognitive.analyticalAbility', label: 'Analytical ability' },
                { key: 'cognitive.memoryRetention', label: 'Memory retention' },
                { key: 'cognitive.attentionSpan', label: 'Attention span' },
            ],
        },
        {
            id: 'behavioral',
            title: 'Behavioral Traits',
            items: [
                { key: 'behavioral.discipline', label: 'Discipline' },
                { key: 'behavioral.consistency', label: 'Consistency' },
                { key: 'behavioral.responsibility', label: 'Responsibility' },
                { key: 'behavioral.selfMotivation', label: 'Self motivation' },
            ],
        },
        {
            id: 'learning',
            title: 'Learning Behavior',
            items: [
                { key: 'learning.independentLearning', label: 'Learns independently' },
                { key: 'learning.needsGuidance', label: 'Needs guidance frequently' },
                { key: 'learning.handlesDifficulty', label: 'Handles difficult problems' },
            ],
            binary: [{ key: 'learning.homeworkOnTime', label: 'Completes homework on time' }],
        },
        {
            id: 'emotional',
            title: 'Social & Emotional',
            items: [
                { key: 'emotional.confidence', label: 'Confidence' },
                { key: 'emotional.communication', label: 'Communication skills' },
                { key: 'emotional.collaboration', label: 'Collaboration / teamwork' },
                { key: 'emotional.stressManagement', label: 'Stress management' },
            ],
        },
        {
            id: 'interests',
            title: 'Interests',
            items: [
                { key: 'interests.coding', label: 'Coding / technology' },
                { key: 'interests.arts', label: 'Arts / creativity' },
                { key: 'interests.sports', label: 'Sports' },
                { key: 'interests.readingWriting', label: 'Reading / writing' },
                { key: 'interests.scienceCuriosity', label: 'Science curiosity' },
            ],
        },
        {
            id: 'open',
            title: 'Your Notes',
            questions: [
                { key: 'open.weakness', type: 'open_text', label: 'Key weaknesses' },
                { key: 'open.improvementAreas', type: 'open_text', label: 'Where is improvement needed?' },
                { key: 'open.motivationTrigger', type: 'open_text', label: 'What motivates your child?' },
                { key: 'open.parentComments', type: 'open_text', label: 'Anything else?' },
            ],
        },
    ],
};
// ── Schemas ──────────────────────────────────────────────────────────────────
const snapshotSchema = z
    .object({
    name: z.string().trim().max(120).optional(),
    classLevel: z.string().trim().max(50).optional(),
    age: z.union([z.number(), z.string()]).optional(),
    board: z.string().trim().max(50).optional(),
})
    .partial();
const createSessionSchema = z.object({
    studentId: z.string().uuid(),
    snapshot: snapshotSchema.optional(),
});
const responseItemSchema = z.object({
    section: z.string().trim().min(1).max(40),
    questionKey: z.string().trim().min(1).max(80),
    value: z.any(),
});
const saveResponsesSchema = z.object({
    responses: z.array(responseItemSchema).min(1).max(200),
    durationSec: z.number().int().min(0).max(86400).optional(),
    snapshot: snapshotSchema.optional(),
});
const submitSchema = z.object({
    durationSec: z.number().int().min(0).max(86400).optional(),
});
// ── Helpers ──────────────────────────────────────────────────────────────────
function getSingleParam(value) {
    if (Array.isArray(value))
        return value[0] || null;
    return value || null;
}
function orgId(req) {
    return req.user?.organizationId || null;
}
async function isParentOfStudent(parentId, studentId, organizationId) {
    const check = await db.query(`SELECT 1 FROM parent_student_links
      WHERE parent_user_id = $1 AND student_user_id = $2 AND organization_id = $3::uuid LIMIT 1`, [parentId, studentId, organizationId]);
    return (check.rowCount ?? 0) > 0;
}
async function canAccessStudent(req, studentId, organizationId) {
    const user = req.user;
    if (!organizationId || !user?.userId)
        return false;
    if (user.role === 'admin' || user.role === 'superadmin' || user.userId === studentId)
        return true;
    return isParentOfStudent(user.userId, studentId, organizationId);
}
// Parents (or admins) own the counseling flow.
async function canRunCounseling(req, studentId, organizationId) {
    const user = req.user;
    if (!organizationId || !user?.userId)
        return false;
    if (user.role === 'admin' || user.role === 'superadmin')
        return true;
    if (user.role !== 'parent')
        return false;
    return isParentOfStudent(user.userId, studentId, organizationId);
}
// Loads a session the caller is allowed to see; returns null if missing/forbidden.
async function loadAuthorizedSession(req, sessionId, organizationId) {
    const result = await db.query(`SELECT id, parent_user_id, student_user_id, organization_id, status,
            student_snapshot, duration_sec, started_at, submitted_at
       FROM counseling_sessions
      WHERE id = $1::uuid AND organization_id = $2::uuid LIMIT 1`, [sessionId, organizationId]);
    const row = result.rows[0];
    if (!row)
        return null;
    if (!(await canAccessStudent(req, row.student_user_id, organizationId)))
        return null;
    return row;
}
async function loadAnswers(sessionId) {
    const result = await db.query(`SELECT question_key, value_json FROM counseling_responses WHERE session_id = $1::uuid`, [sessionId]);
    const answers = {};
    for (const row of result.rows)
        answers[row.question_key] = row.value_json;
    return answers;
}
// ── Routes ───────────────────────────────────────────────────────────────────
// GET /counseling/questionnaire — the versioned survey definition.
// Accepts optional ?classLevel=X to dynamically populate subjects from DB.
counselingRouter.get('/questionnaire', requireAuth, async (req, res) => {
    const classLevel = req.query.classLevel;
    const organizationId = orgId(req);
    if (classLevel && organizationId) {
        try {
            const subjectsResult = await db.query(`SELECT title FROM subjects WHERE organization_id = $1::uuid AND class_level = $2 ORDER BY title ASC`, [organizationId, classLevel]);
            if (subjectsResult.rows.length > 0) {
                const dynamicSubjects = subjectsResult.rows.map((row) => ({
                    key: row.title.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                    label: row.title,
                }));
                const questionnaire = JSON.parse(JSON.stringify(QUESTIONNAIRE));
                const academicSection = questionnaire.sections.find((s) => s.id === 'academic');
                if (academicSection) {
                    academicSection.subjects = dynamicSubjects;
                }
                return res.json(questionnaire);
            }
        }
        catch (err) {
            console.error('[counseling] failed to fetch subjects for questionnaire', err);
        }
    }
    res.json(QUESTIONNAIRE);
});
// POST /counseling/sessions — start a session for a child.
counselingRouter.post('/sessions', requireAuth, async (req, res) => {
    const organizationId = orgId(req);
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
    if (!(await canRunCounseling(req, parsed.data.studentId, organizationId))) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    try {
        const result = await db.query(`INSERT INTO counseling_sessions (parent_user_id, student_user_id, organization_id, student_snapshot)
       VALUES ($1, $2, $3::uuid, $4::jsonb)
       RETURNING id, status, student_snapshot, started_at, created_at`, [req.user?.userId, parsed.data.studentId, organizationId, JSON.stringify(parsed.data.snapshot ?? {})]);
        const row = result.rows[0];
        return res.status(201).json({
            id: row.id,
            status: row.status,
            snapshot: row.student_snapshot,
            startedAt: row.started_at,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to start counseling session' });
    }
});
// GET /counseling/sessions/:id — session + saved responses.
counselingRouter.get('/sessions/:id', requireAuth, async (req, res) => {
    const sessionId = getSingleParam(req.params.id);
    const organizationId = orgId(req);
    if (!sessionId || !organizationId)
        return res.status(400).json({ message: 'Invalid request' });
    const session = await loadAuthorizedSession(req, sessionId, organizationId);
    if (!session)
        return res.status(404).json({ message: 'Session not found' });
    const answers = await loadAnswers(sessionId);
    return res.json({
        id: session.id,
        studentId: session.student_user_id,
        status: session.status,
        snapshot: session.student_snapshot,
        durationSec: Number(session.duration_sec || 0),
        startedAt: session.started_at,
        submittedAt: session.submitted_at || null,
        answers,
    });
});
// PATCH /counseling/sessions/:id/responses — autosave answers (upsert).
counselingRouter.patch('/sessions/:id/responses', requireAuth, async (req, res) => {
    const sessionId = getSingleParam(req.params.id);
    const organizationId = orgId(req);
    const parsed = saveResponsesSchema.safeParse(req.body);
    if (!sessionId || !organizationId)
        return res.status(400).json({ message: 'Invalid request' });
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
    const session = await loadAuthorizedSession(req, sessionId, organizationId);
    if (!session)
        return res.status(404).json({ message: 'Session not found' });
    if (session.status === 'reported')
        return res.status(409).json({ message: 'Session already reported' });
    try {
        for (const item of parsed.data.responses) {
            await db.query(`INSERT INTO counseling_responses (session_id, organization_id, section, question_key, value_json)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb)
         ON CONFLICT (session_id, question_key) DO UPDATE
           SET value_json = EXCLUDED.value_json, section = EXCLUDED.section, updated_at = NOW()`, [sessionId, organizationId, item.section, item.questionKey, JSON.stringify(item.value ?? null)]);
        }
        if (parsed.data.durationSec != null || parsed.data.snapshot) {
            await db.query(`UPDATE counseling_sessions
            SET duration_sec = GREATEST(duration_sec, $2),
                student_snapshot = COALESCE($3::jsonb, student_snapshot),
                updated_at = NOW()
          WHERE id = $1::uuid`, [
                sessionId,
                parsed.data.durationSec ?? 0,
                parsed.data.snapshot ? JSON.stringify(parsed.data.snapshot) : null,
            ]);
        }
        return res.json({ saved: parsed.data.responses.length });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to save responses' });
    }
});
// POST /counseling/sessions/:id/submit — lock answers for scoring.
counselingRouter.post('/sessions/:id/submit', requireAuth, async (req, res) => {
    const sessionId = getSingleParam(req.params.id);
    const organizationId = orgId(req);
    const parsed = submitSchema.safeParse(req.body ?? {});
    if (!sessionId || !organizationId)
        return res.status(400).json({ message: 'Invalid request' });
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
    const session = await loadAuthorizedSession(req, sessionId, organizationId);
    if (!session)
        return res.status(404).json({ message: 'Session not found' });
    if (!(await canRunCounseling(req, session.student_user_id, organizationId))) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    try {
        await db.query(`UPDATE counseling_sessions
          SET status = CASE WHEN status = 'reported' THEN status ELSE 'submitted' END,
              submitted_at = COALESCE(submitted_at, NOW()),
              duration_sec = GREATEST(duration_sec, $2),
              updated_at = NOW()
        WHERE id = $1::uuid`, [sessionId, parsed.data.durationSec ?? 0]);
        return res.json({ status: 'submitted' });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to submit session' });
    }
});
// POST /counseling/sessions/:id/report — run the scoring engine and persist.
counselingRouter.post('/sessions/:id/report', requireAuth, async (req, res) => {
    const sessionId = getSingleParam(req.params.id);
    const organizationId = orgId(req);
    if (!sessionId || !organizationId)
        return res.status(400).json({ message: 'Invalid request' });
    const session = await loadAuthorizedSession(req, sessionId, organizationId);
    if (!session)
        return res.status(404).json({ message: 'Session not found' });
    if (!(await canRunCounseling(req, session.student_user_id, organizationId))) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    try {
        const answers = await loadAnswers(sessionId);
        const snapshot = (session.student_snapshot || {});
        const report = buildCounselingReport(answers, snapshot);
        const openResponse = extractOpenResponses(answers);
        const reportJson = {
            ...report,
            openResponse,
            reportMeta: {
                sessionId,
                studentId: session.student_user_id,
                generatedAt: new Date().toISOString(),
            },
        };
        const inserted = await db.query(`INSERT INTO counseling_reports
         (session_id, student_user_id, organization_id, overall_score, level, growth_potential, study_pattern_type, report_json)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8::jsonb)
       RETURNING id, created_at`, [
            sessionId,
            session.student_user_id,
            organizationId,
            report.summary.overallScore,
            report.summary.level,
            report.summary.growthPotential,
            report.summary.studyPatternType,
            JSON.stringify(reportJson),
        ]);
        await db.query(`UPDATE counseling_sessions SET status = 'reported', updated_at = NOW() WHERE id = $1::uuid`, [sessionId]);
        return res.status(201).json({
            reportId: inserted.rows[0].id,
            createdAt: inserted.rows[0].created_at,
            report: reportJson,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to generate report' });
    }
});
// GET /counseling/sessions/:id/report — latest persisted report.
counselingRouter.get('/sessions/:id/report', requireAuth, async (req, res) => {
    const sessionId = getSingleParam(req.params.id);
    const organizationId = orgId(req);
    if (!sessionId || !organizationId)
        return res.status(400).json({ message: 'Invalid request' });
    const session = await loadAuthorizedSession(req, sessionId, organizationId);
    if (!session)
        return res.status(404).json({ message: 'Session not found' });
    try {
        const result = await db.query(`SELECT id, overall_score, level, growth_potential, study_pattern_type, report_json, created_at
         FROM counseling_reports
        WHERE session_id = $1::uuid
        ORDER BY created_at DESC LIMIT 1`, [sessionId]);
        if ((result.rowCount ?? 0) === 0)
            return res.status(404).json({ message: 'No report yet' });
        const row = result.rows[0];
        return res.json({
            reportId: row.id,
            overallScore: Number(row.overall_score || 0),
            level: row.level,
            growthPotential: row.growth_potential,
            studyPatternType: row.study_pattern_type,
            report: row.report_json,
            createdAt: row.created_at,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch report' });
    }
});
// GET /counseling/students/:studentId/sessions — history for a child.
counselingRouter.get('/students/:studentId/sessions', requireAuth, async (req, res) => {
    const studentId = getSingleParam(req.params.studentId);
    const organizationId = orgId(req);
    if (!studentId || !organizationId)
        return res.status(400).json({ message: 'Invalid request' });
    if (!(await canAccessStudent(req, studentId, organizationId)))
        return res.status(403).json({ message: 'Forbidden' });
    try {
        const result = await db.query(`SELECT s.id, s.status, s.started_at, s.submitted_at, s.duration_sec,
              r.overall_score, r.level, r.created_at AS report_created_at
         FROM counseling_sessions s
         LEFT JOIN LATERAL (
           SELECT overall_score, level, created_at
             FROM counseling_reports cr
            WHERE cr.session_id = s.id
            ORDER BY cr.created_at DESC LIMIT 1
         ) r ON true
        WHERE s.student_user_id = $1::uuid AND s.organization_id = $2::uuid
        ORDER BY s.created_at DESC LIMIT 50`, [studentId, organizationId]);
        return res.json({
            sessions: result.rows.map((row) => ({
                id: row.id,
                status: row.status,
                startedAt: row.started_at,
                submittedAt: row.submitted_at || null,
                durationSec: Number(row.duration_sec || 0),
                overallScore: row.overall_score != null ? Number(row.overall_score) : null,
                level: row.level || null,
                reportCreatedAt: row.report_created_at || null,
            })),
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch sessions' });
    }
});
// DELETE /counseling/students/:studentId/sessions/pending — drop incomplete
// (un-reported) sessions so abandoned attempts never linger as "in progress".
counselingRouter.delete('/students/:studentId/sessions/pending', requireAuth, async (req, res) => {
    const studentId = getSingleParam(req.params.studentId);
    const organizationId = orgId(req);
    if (!studentId || !organizationId)
        return res.status(400).json({ message: 'Invalid request' });
    if (!(await canRunCounseling(req, studentId, organizationId)))
        return res.status(403).json({ message: 'Forbidden' });
    try {
        const result = await db.query(`DELETE FROM counseling_sessions
        WHERE student_user_id = $1::uuid
          AND organization_id = $2::uuid
          AND status <> 'reported'`, [studentId, organizationId]);
        return res.json({ deleted: result.rowCount ?? 0 });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to delete pending sessions' });
    }
});
//# sourceMappingURL=counseling.js.map