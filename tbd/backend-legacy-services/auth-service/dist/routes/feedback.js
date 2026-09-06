import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from './auth.js';
import { eventBus } from '../events/bus.js';
export const feedbackRouter = Router();
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
async function isTeacherOfStudent(teacherId, studentId, organizationId) {
    const check = await db.query(`SELECT 1 FROM classrooms c
     INNER JOIN users u ON u.class_level = c.class_level
     WHERE c.created_by = $1
       AND u.id = $2
       AND c.organization_id = $3::uuid
     LIMIT 1`, [teacherId, studentId, organizationId]);
    return (check.rowCount ?? 0) > 0;
}
async function canAccessThread(req, studentId, organizationId) {
    const user = req.user;
    if (!user?.userId)
        return false;
    if (user.role === 'admin' || user.role === 'superadmin')
        return true;
    if (user.role === 'parent')
        return isParentOfStudent(user.userId, studentId, organizationId);
    if (user.role === 'teacher')
        return isTeacherOfStudent(user.userId, studentId, organizationId);
    return user.userId === studentId;
}
// ── Schemas ──────────────────────────────────────────────────────────────────
const createThreadSchema = z.object({
    studentId: z.string().uuid(),
    classroomId: z.string().uuid().optional(),
    category: z.enum(['academic', 'non_academic']),
    topicId: z.string().uuid(),
    topicTitle: z.string().trim().min(1).max(255),
    subject: z.string().trim().min(1).max(255),
    description: z.string().trim().min(1).max(4000),
    attachmentUrl: z.string().trim().url().optional().or(z.literal('')).transform((v) => v || undefined),
});
const postMessageSchema = z.object({
    message: z.string().trim().min(1).max(2000),
    responseType: z.enum(['observation', 'action_plan', 'recommendation', 'general']).optional(),
    attachmentUrl: z.string().trim().url().optional().or(z.literal('')).transform((v) => v || undefined),
});
const listThreadsQuerySchema = z.object({
    studentId: z.string().uuid().optional(),
    status: z.enum(['open', 'closed']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    before: z.string().datetime().optional(),
});
// ── POST /feedback/threads — Create a new conversation thread ────────────────
feedbackRouter.post('/threads', requireAuth, async (req, res) => {
    const organizationId = orgId(req);
    const parsed = createThreadSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
    if (!organizationId)
        return res.status(400).json({ message: 'Organization not found' });
    const user = req.user;
    if (!user?.userId)
        return res.status(401).json({ message: 'Unauthorized' });
    const { studentId, classroomId, category, topicId, topicTitle, subject, description, attachmentUrl } = parsed.data;
    if (!(await canAccessThread(req, studentId, organizationId))) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const threadResult = await client.query(`INSERT INTO feedback_threads (student_user_id, organization_id, classroom_id, subject, created_by, created_by_role, category, topic_id, topic_title, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, created_at`, [studentId, organizationId, classroomId || null, subject, user.userId, user.role, category, topicId, topicTitle, description]);
        const threadId = threadResult.rows[0].id;
        await client.query(`INSERT INTO feedback_messages (thread_id, sender_user_id, sender_role, message_text, attachment_url)
       VALUES ($1, $2, $3, $4, $5)`, [threadId, user.userId, user.role, description, attachmentUrl || null]);
        await client.query('COMMIT');
        try {
            await eventBus.publish({
                type: 'notification.requested',
                source: 'auth-service',
                organizationId,
                userId: user.userId,
                payload: {
                    kind: 'feedback_thread_created',
                    threadId,
                    studentUserId: studentId,
                    createdByRole: user.role,
                    subject,
                    category,
                    topicTitle,
                },
            });
        }
        catch (err) {
            console.error('[feedback] failed to publish thread notification', err);
        }
        return res.status(201).json({
            id: threadId,
            studentId,
            category,
            topicId,
            topicTitle,
            subject,
            description,
            classroomId: classroomId || null,
            createdByRole: user.role,
            createdAt: threadResult.rows[0].created_at,
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        return res.status(500).json({ message: 'Failed to create feedback thread' });
    }
    finally {
        client.release();
    }
});
// ── GET /feedback/threads — List threads for a student ───────────────────────
feedbackRouter.get('/threads', requireAuth, async (req, res) => {
    const organizationId = orgId(req);
    if (!organizationId)
        return res.status(400).json({ message: 'Organization not found' });
    const user = req.user;
    if (!user?.userId)
        return res.status(401).json({ message: 'Unauthorized' });
    const parsed = listThreadsQuerySchema.safeParse(req.query);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid query', errors: parsed.error.issues });
    const { studentId, status, limit, before } = parsed.data;
    const params = [organizationId];
    const whereClauses = ['ft.organization_id = $1::uuid'];
    if (before) {
        params.push(before);
        whereClauses.push(`ft.updated_at < $${params.length}::timestamp`);
    }
    if (studentId) {
        if (!(await canAccessThread(req, studentId, organizationId))) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        params.push(studentId);
        whereClauses.push(`ft.student_user_id = $${params.length}`);
    }
    else if (user.role === 'parent') {
        params.push(user.userId);
        whereClauses.push(`ft.student_user_id IN (
      SELECT student_user_id FROM parent_student_links WHERE parent_user_id = $${params.length} AND organization_id = $1::uuid
    )`);
    }
    else if (user.role === 'teacher') {
        params.push(user.userId);
        whereClauses.push(`ft.student_user_id IN (
      SELECT u.id FROM users u
      INNER JOIN classrooms c ON c.class_level = u.class_level AND c.organization_id = $1::uuid
      WHERE c.created_by = $${params.length}
    )`);
    }
    else if (user.role !== 'admin' && user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Forbidden' });
    }
    if (status) {
        params.push(status);
        whereClauses.push(`ft.status = $${params.length}`);
    }
    params.push(limit);
    try {
        // Use lateral joins for efficient batch computation instead of per-row subqueries
        const currentUserIdx = params.indexOf(user.userId) + 1 || 1;
        const result = await db.query(`SELECT ft.id, ft.student_user_id, ft.classroom_id, ft.subject, ft.status,
              ft.created_by, ft.created_by_role, ft.created_at, ft.updated_at,
              ft.category, ft.topic_id, ft.topic_title, ft.description,
              TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS student_name,
              COALESCE(stats.message_count, 0) AS message_count,
              COALESCE(stats.unread_count, 0) AS unread_count,
              latest.message_text AS last_message,
              latest.created_at AS last_message_at
       FROM feedback_threads ft
       LEFT JOIN users u ON u.id = ft.student_user_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS message_count,
                COUNT(*) FILTER (WHERE fm.is_read = false AND fm.sender_user_id != '${user.userId}')::int AS unread_count
         FROM feedback_messages fm WHERE fm.thread_id = ft.id
       ) stats ON true
       LEFT JOIN LATERAL (
         SELECT fm2.message_text, fm2.created_at
         FROM feedback_messages fm2 WHERE fm2.thread_id = ft.id
         ORDER BY fm2.created_at DESC LIMIT 1
       ) latest ON true
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY ft.updated_at DESC
       LIMIT $${params.length}`, params);
        const threads = result.rows.map((row) => ({
            id: row.id,
            studentId: row.student_user_id,
            studentName: (row.student_name || '').trim(),
            classroomId: row.classroom_id || null,
            subject: row.subject,
            status: row.status,
            category: row.category || null,
            topicId: row.topic_id || null,
            topicTitle: row.topic_title || null,
            description: row.description || null,
            createdBy: row.created_by,
            createdByRole: row.created_by_role,
            messageCount: Number(row.message_count || 0),
            unreadCount: Number(row.unread_count || 0),
            lastMessage: row.last_message || null,
            lastMessageAt: row.last_message_at || null,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }));
        return res.json({
            threads,
            hasMore: threads.length === limit,
            nextCursor: threads.length === limit ? threads[threads.length - 1].updatedAt : null,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch feedback threads' });
    }
});
// ── GET /feedback/threads/:id — Thread detail with messages ──────────────────
feedbackRouter.get('/threads/:id', requireAuth, async (req, res) => {
    const threadId = getSingleParam(req.params.id);
    const organizationId = orgId(req);
    if (!threadId || !organizationId)
        return res.status(400).json({ message: 'Invalid request' });
    const user = req.user;
    if (!user?.userId)
        return res.status(401).json({ message: 'Unauthorized' });
    try {
        const threadResult = await db.query(`SELECT ft.id, ft.student_user_id, ft.classroom_id, ft.subject, ft.status,
              ft.created_by, ft.created_by_role, ft.created_at,
              ft.category, ft.topic_id, ft.topic_title, ft.description,
              TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS student_name
       FROM feedback_threads ft
       LEFT JOIN users u ON u.id = ft.student_user_id
       WHERE ft.id = $1::uuid AND ft.organization_id = $2::uuid
       LIMIT 1`, [threadId, organizationId]);
        if ((threadResult.rowCount ?? 0) === 0)
            return res.status(404).json({ message: 'Thread not found' });
        const thread = threadResult.rows[0];
        if (!(await canAccessThread(req, thread.student_user_id, organizationId))) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        // Mark messages as read in background (non-blocking)
        db.query(`UPDATE feedback_messages SET is_read = true
       WHERE thread_id = $1::uuid AND sender_user_id != $2 AND is_read = false`, [threadId, user.userId]).catch(() => { });
        // Load last N messages (default 10, cursor-based pagination using message ID)
        const msgLimit = Math.min(parseInt(req.query.msgLimit || '10', 10), 200);
        const msgBeforeId = req.query.msgBeforeId;
        let msgWhere;
        let msgParams;
        if (msgBeforeId) {
            msgWhere = `WHERE fm.thread_id = $1::uuid AND fm.created_at < (SELECT created_at FROM feedback_messages WHERE id = $2::uuid)`;
            msgParams = [threadId, msgBeforeId];
        }
        else {
            msgWhere = `WHERE fm.thread_id = $1::uuid`;
            msgParams = [threadId];
        }
        const messagesResult = await db.query(`SELECT fm.id, fm.sender_user_id, fm.sender_role, fm.message_text, fm.attachment_url,
              fm.is_read, fm.created_at, fm.response_type,
              TRIM(CONCAT(u.first_name, ' ', COALESCE(u.last_name, ''))) AS sender_name
       FROM feedback_messages fm
       LEFT JOIN users u ON u.id = fm.sender_user_id
       ${msgWhere}
       ORDER BY fm.created_at DESC
       LIMIT ${msgLimit + 1}`, msgParams);
        const hasMoreMessages = messagesResult.rows.length > msgLimit;
        const msgRows = messagesResult.rows.slice(0, msgLimit).reverse();
        return res.json({
            thread: {
                id: thread.id,
                studentId: thread.student_user_id,
                studentName: (thread.student_name || '').trim(),
                classroomId: thread.classroom_id || null,
                subject: thread.subject,
                status: thread.status,
                category: thread.category || null,
                topicId: thread.topic_id || null,
                topicTitle: thread.topic_title || null,
                description: thread.description || null,
                createdBy: thread.created_by,
                createdByRole: thread.created_by_role,
                createdAt: thread.created_at,
            },
            messages: msgRows.map((row) => ({
                id: row.id,
                senderUserId: row.sender_user_id,
                senderRole: row.sender_role,
                senderName: (row.sender_name || '').trim(),
                message: row.message_text,
                responseType: row.response_type || null,
                attachmentUrl: row.attachment_url || null,
                isRead: Boolean(row.is_read),
                createdAt: row.created_at,
            })),
            hasMoreMessages,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch thread' });
    }
});
// ── POST /feedback/threads/:id/messages — Add a message to a thread ──────────
feedbackRouter.post('/threads/:id/messages', requireAuth, async (req, res) => {
    const threadId = getSingleParam(req.params.id);
    const organizationId = orgId(req);
    const parsed = postMessageSchema.safeParse(req.body);
    if (!threadId || !organizationId)
        return res.status(400).json({ message: 'Invalid request' });
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid payload', errors: parsed.error.issues });
    const user = req.user;
    if (!user?.userId)
        return res.status(401).json({ message: 'Unauthorized' });
    try {
        const threadResult = await db.query(`SELECT student_user_id, status, created_by, created_by_role FROM feedback_threads
       WHERE id = $1::uuid AND organization_id = $2::uuid LIMIT 1`, [threadId, organizationId]);
        if ((threadResult.rowCount ?? 0) === 0)
            return res.status(404).json({ message: 'Thread not found' });
        const thread = threadResult.rows[0];
        if (thread.status === 'closed')
            return res.status(409).json({ message: 'Thread is closed' });
        if (!(await canAccessThread(req, thread.student_user_id, organizationId))) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        // Determine the parent involved in this thread
        let threadParentId = null;
        if (thread.created_by_role === 'parent') {
            threadParentId = thread.created_by;
        }
        else {
            // Thread created by teacher - find the parent who has replied, or the linked parent
            const parentMsgResult = await db.query(`SELECT sender_user_id FROM feedback_messages
         WHERE thread_id = $1::uuid AND sender_role = 'parent'
         ORDER BY created_at ASC LIMIT 1`, [threadId]);
            if ((parentMsgResult.rowCount ?? 0) > 0) {
                threadParentId = parentMsgResult.rows[0].sender_user_id;
            }
            else {
                // No parent has replied yet - find the linked parent for this student
                const linkResult = await db.query(`SELECT parent_user_id FROM parent_student_links
           WHERE student_user_id = $1::uuid AND organization_id = $2::uuid LIMIT 1`, [thread.student_user_id, organizationId]);
                if ((linkResult.rowCount ?? 0) > 0) {
                    threadParentId = linkResult.rows[0].parent_user_id;
                }
            }
        }
        const { message, responseType, attachmentUrl } = parsed.data;
        const insertResult = await db.query(`INSERT INTO feedback_messages (thread_id, sender_user_id, sender_role, message_text, response_type, attachment_url)
       VALUES ($1::uuid, $2, $3, $4, $5, $6)
       RETURNING id, created_at`, [threadId, user.userId, user.role, message, responseType || null, attachmentUrl || null]);
        await db.query(`UPDATE feedback_threads SET updated_at = NOW() WHERE id = $1::uuid`, [threadId]);
        try {
            await eventBus.publish({
                type: 'notification.requested',
                source: 'auth-service',
                organizationId,
                userId: user.userId,
                payload: {
                    kind: 'feedback_message',
                    threadId,
                    studentUserId: thread.student_user_id,
                    senderRole: user.role,
                    parentId: threadParentId,
                    message: message.substring(0, 100),
                },
            });
        }
        catch (err) {
            console.error('[feedback] failed to publish message notification', err);
        }
        return res.status(201).json({
            id: insertResult.rows[0].id,
            senderUserId: user.userId,
            senderRole: user.role,
            message,
            attachmentUrl: attachmentUrl || null,
            createdAt: insertResult.rows[0].created_at,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to post message' });
    }
});
// ── PATCH /feedback/threads/:id/close — Close a thread ───────────────────────
feedbackRouter.patch('/threads/:id/close', requireAuth, async (req, res) => {
    const threadId = getSingleParam(req.params.id);
    const organizationId = orgId(req);
    if (!threadId || !organizationId)
        return res.status(400).json({ message: 'Invalid request' });
    const user = req.user;
    if (!user?.userId)
        return res.status(401).json({ message: 'Unauthorized' });
    try {
        const threadResult = await db.query(`SELECT student_user_id, created_by FROM feedback_threads
       WHERE id = $1::uuid AND organization_id = $2::uuid LIMIT 1`, [threadId, organizationId]);
        if ((threadResult.rowCount ?? 0) === 0)
            return res.status(404).json({ message: 'Thread not found' });
        const thread = threadResult.rows[0];
        const isAdmin = user.role === 'admin' || user.role === 'superadmin';
        const isCreator = thread.created_by === user.userId;
        if (!isAdmin && !isCreator)
            return res.status(403).json({ message: 'Only creator or admin can close thread' });
        await db.query(`UPDATE feedback_threads SET status = 'closed', updated_at = NOW() WHERE id = $1::uuid`, [threadId]);
        return res.json({ status: 'closed' });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to close thread' });
    }
});
// ── GET /feedback/unread-count — Unread messages count for current user ──────
feedbackRouter.get('/unread-count', requireAuth, async (req, res) => {
    const organizationId = orgId(req);
    const user = req.user;
    if (!organizationId || !user?.userId)
        return res.status(400).json({ message: 'Invalid request' });
    try {
        let studentFilter = '';
        const params = [organizationId, user.userId];
        if (user.role === 'parent') {
            studentFilter = `AND ft.student_user_id IN (
        SELECT student_user_id FROM parent_student_links WHERE parent_user_id = $2 AND organization_id = $1::uuid
      )`;
        }
        else if (user.role === 'teacher') {
            studentFilter = `AND ft.student_user_id IN (
        SELECT u.id FROM users u
        INNER JOIN classrooms c ON c.class_level = u.class_level AND c.organization_id = $1::uuid
        WHERE c.created_by = $2
      )`;
        }
        const result = await db.query(`SELECT COUNT(*)::int AS unread
       FROM feedback_messages fm
       INNER JOIN feedback_threads ft ON ft.id = fm.thread_id
       WHERE ft.organization_id = $1::uuid
         AND fm.sender_user_id != $2
         AND fm.is_read = false
         ${studentFilter}`, params);
        return res.json({ unread: Number(result.rows[0]?.unread || 0) });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch unread count' });
    }
});
// ── GET /feedback/class-levels — Available class levels for the teacher ──────
feedbackRouter.get('/class-levels', requireAuth, async (req, res) => {
    const organizationId = orgId(req);
    const user = req.user;
    if (!organizationId || !user?.userId)
        return res.status(400).json({ message: 'Invalid request' });
    try {
        const result = await db.query(`SELECT DISTINCT u.class_level
       FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE ur.organization_id = $1::uuid
         AND r.role_name = 'student'
         AND u.deleted_at IS NULL
         AND u.class_level IS NOT NULL
         AND u.class_level != ''
       ORDER BY u.class_level ASC`, [organizationId]);
        return res.json({ classLevels: result.rows.map((r) => r.class_level) });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch class levels' });
    }
});
// ── GET /feedback/students — Search students for feedback (teacher/admin) ────
const searchStudentsSchema = z.object({
    query: z.string().trim().optional(),
    classLevel: z.string().trim().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
});
feedbackRouter.get('/students', requireAuth, async (req, res) => {
    const organizationId = orgId(req);
    const user = req.user;
    if (!organizationId || !user?.userId)
        return res.status(400).json({ message: 'Invalid request' });
    if (user.role !== 'teacher' && user.role !== 'admin' && user.role !== 'superadmin') {
        return res.status(403).json({ message: 'Forbidden' });
    }
    const parsed = searchStudentsSchema.safeParse(req.query);
    if (!parsed.success)
        return res.status(400).json({ message: 'Invalid query', errors: parsed.error.issues });
    const { query, classLevel, limit } = parsed.data;
    const params = [organizationId];
    const whereClauses = ['ur.organization_id = $1::uuid', "r.role_name = 'student'", 'u.deleted_at IS NULL', 'u.is_active = true'];
    if (query) {
        params.push(`%${query}%`);
        const idx = params.length;
        whereClauses.push(`(concat_ws(' ', u.first_name, u.last_name) ILIKE $${idx}
        OR u.email ILIKE $${idx}
        OR COALESCE(u.mobile_number, '') ILIKE $${idx}
        OR COALESCE(u.unique_registration_id, '') ILIKE $${idx})`);
    }
    if (classLevel) {
        params.push(classLevel);
        whereClauses.push(`u.class_level = $${params.length}`);
    }
    params.push(limit);
    try {
        const result = await db.query(`SELECT DISTINCT ON (u.id)
         u.id,
         u.first_name,
         u.last_name,
         u.email,
         u.mobile_number,
         u.class_level,
         CASE WHEN psl.parent_user_id IS NOT NULL THEN 1 ELSE 0 END AS has_parent
       FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id
       LEFT JOIN parent_student_links psl ON psl.student_user_id = u.id AND psl.organization_id = $1::uuid
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY u.id, u.first_name, u.last_name
       LIMIT $${params.length}`, params);
        return res.json({
            students: result.rows.map((row) => ({
                id: row.id,
                firstName: row.first_name,
                lastName: row.last_name,
                email: row.email || '',
                mobileNumber: row.mobile_number || '',
                classLevel: row.class_level || '',
                hasLinkedParent: Number(row.has_parent || 0) > 0,
            })),
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to search students' });
    }
});
// ── GET /feedback/topics — Fetch academic + non-academic topics for feedback ─
feedbackRouter.get('/topics', requireAuth, async (req, res) => {
    const organizationId = orgId(req);
    const user = req.user;
    if (!organizationId || !user?.userId)
        return res.status(400).json({ message: 'Invalid request' });
    const classLevel = req.query.classLevel;
    try {
        // Academic topics: from subjects table, filtered by class_level
        const academicResult = await db.query(`SELECT id, title, class_level
       FROM subjects
       WHERE organization_id = $1::uuid
         ${classLevel ? `AND class_level = $2` : ''}
       ORDER BY title ASC`, classLevel ? [organizationId, classLevel] : [organizationId]);
        // Non-academic topics: from feedback_topics, class_level = 'any' or matching
        const nonAcademicResult = await db.query(`SELECT id, title, description, class_level
       FROM feedback_topics
       WHERE (organization_id = $1::uuid OR organization_id IS NULL)
         AND is_active = true
         AND (class_level = 'any' ${classLevel ? `OR class_level = $2` : ''})
       ORDER BY title ASC`, classLevel ? [organizationId, classLevel] : [organizationId]);
        return res.json({
            academic: academicResult.rows.map((row) => ({
                id: row.id,
                title: row.title,
                classLevel: row.class_level,
            })),
            nonAcademic: nonAcademicResult.rows.map((row) => ({
                id: row.id,
                title: row.title,
                description: row.description || null,
                classLevel: row.class_level,
            })),
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch topics' });
    }
});
