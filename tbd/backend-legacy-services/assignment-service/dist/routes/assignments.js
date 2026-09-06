import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toPersistentMediaUrl } from '../services/s3.js';
import { eventBus } from '../events/bus.js';
export const assignmentsRouter = Router();
const createAssignmentSubmissionSchema = z
    .object({
    submissionText: z.string().trim().optional(),
    attachmentUrl: z.string().trim().optional(),
})
    .refine((value) => Boolean(value.submissionText?.trim() || value.attachmentUrl?.trim()), {
    message: 'Submission text or attachment is required',
});
function getOrganizationId(req) {
    return req?.user?.organizationId || null;
}
function canBypassOwnership(req) {
    const role = req?.user?.role;
    return role === 'admin' || role === 'superadmin';
}
function canManageTeacherContent(req) {
    const role = req?.user?.role;
    return role === 'teacher' || role === 'admin' || role === 'superadmin';
}
function canPublishGlobalResources(req) {
    const role = req?.user?.role;
    return role === 'superadmin' || Boolean(req?.user?.canPublishGlobal);
}
assignmentsRouter.get('/_meta', requireAuth, async (_req, res) => {
    const totals = await db.query(`SELECT COUNT(*)::text AS count FROM classroom_assignment_submissions`);
    res.json({
        service: 'assignment-service',
        version: '2.0.0',
        phase: 2,
        description: 'Owns classroom assignment submissions submitted by students. Teachers attach assignments via classroom-service.',
        submissionsCount: Number(totals.rows[0]?.count || 0),
    });
});
assignmentsRouter.post('/classrooms/:classroomId/:assignmentId/submissions', requireAuth, async (req, res) => {
    const classroomId = req.params.classroomId;
    const assignmentId = req.params.assignmentId;
    const parsedBody = createAssignmentSubmissionSchema.safeParse(req.body);
    if (!classroomId || !assignmentId)
        return res.status(400).json({ message: 'Invalid classroom or assignment id' });
    if (!parsedBody.success)
        return res.status(400).json({ message: 'Invalid submission payload', errors: parsedBody.error.issues });
    const orgId = getOrganizationId(req);
    const userId = req?.user?.userId;
    if (!orgId || !userId)
        return res.status(400).json({ message: 'Organization/user not found in auth context' });
    try {
        const userResult = await db.query(`SELECT u.active_role FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id
       WHERE u.id = $1 AND ur.organization_id = $2::uuid LIMIT 1`, [userId, orgId]);
        if ((userResult.rowCount ?? 0) === 0)
            return res.status(404).json({ message: 'User not found' });
        const role = userResult.rows[0].active_role || '';
        if (role !== 'student')
            return res.status(403).json({ message: 'Only students can submit assignments' });
        const assignmentCheck = await db.query(`SELECT ca.id
       FROM classroom_assignments ca
       INNER JOIN classrooms c ON c.id = ca.classroom_id
       WHERE ca.id = $1
         AND ca.classroom_id = $2
         AND c.organization_id = $3::uuid
       LIMIT 1`, [assignmentId, classroomId, orgId]);
        if ((assignmentCheck.rowCount ?? 0) === 0)
            return res.status(404).json({ message: 'Assignment not found for classroom' });
        await db.query(`INSERT INTO classroom_assignment_submissions (classroom_assignment_id, student_id, submission_text, attachment_url, submitted_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (classroom_assignment_id, student_id)
       DO UPDATE SET
         submission_text = EXCLUDED.submission_text,
         attachment_url = EXCLUDED.attachment_url,
         submitted_at = NOW(),
         updated_at = NOW()`, [
            assignmentId,
            userId,
            parsedBody.data.submissionText?.trim() || null,
            parsedBody.data.attachmentUrl?.trim() ? toPersistentMediaUrl(parsedBody.data.attachmentUrl.trim()) : null,
        ]);
        try {
            const meta = await db.query(`SELECT c.id AS classroom_id, c.title AS classroom_title, c.created_by AS teacher_id, ca.title AS assignment_title
           FROM classroom_assignments ca
           INNER JOIN classrooms c ON c.id = ca.classroom_id
          WHERE ca.id = $1 AND c.organization_id = $2::uuid
          LIMIT 1`, [assignmentId, orgId]);
            const row = meta.rows[0];
            if (row) {
                await eventBus.publish({
                    type: 'assignment.submitted',
                    source: 'assignment-service',
                    organizationId: orgId,
                    userId,
                    payload: {
                        classroomId: row.classroom_id,
                        classroomTitle: row.classroom_title,
                        teacherId: row.teacher_id,
                        assignmentId,
                        assignmentTitle: row.assignment_title,
                        studentUserId: userId,
                    },
                });
            }
        }
        catch (err) {
            console.error('[assignment-service] failed to publish assignment.submitted', err);
        }
        return res.status(201).json({ message: 'Assignment submitted successfully' });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to submit assignment' });
    }
});
