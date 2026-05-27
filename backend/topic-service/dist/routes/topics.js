import { Router } from 'express';
import { z } from 'zod';
import { canBypassOwnership, canManageTeacherContent, canPublishGlobalResources, getOrganizationId, getUserId, } from '@els-ai/internal-auth';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getSignedMediaUrlIfNeeded, toPersistentMediaUrl } from '../services/s3.js';
export const topicsRouter = Router();
export const catalogRouter = Router();
export const studentsRouter = Router();
const contentTypeSchema = z.enum(['reel', 'image', 'text', 'audio', 'youtube_url', 'reel_url']);
const listContentTopicsQuerySchema = z.object({
    class_level: z.string().trim().optional(),
    subject: z.string().trim().optional(),
    search: z.string().trim().optional(),
    limit: z.coerce.number().int().min(1).max(300).default(100),
});
const createContentTopicSchema = z.object({
    classLevel: z.string().trim().min(1).max(50),
    subject: z.string().trim().min(1).max(255),
    title: z.string().trim().min(1).max(255),
    coverImage: z.string().trim().optional(),
    isGlobal: z.boolean().default(false),
});
const updateContentTopicSchema = z
    .object({
    classLevel: z.string().trim().min(1).max(50).optional(),
    subject: z.string().trim().min(1).max(255).optional(),
    title: z.string().trim().min(1).max(255).optional(),
    coverImage: z.string().trim().optional(),
    isGlobal: z.boolean().optional(),
})
    .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one field must be provided',
});
const contentSectionSchema = z
    .object({
    title: z.string().trim().max(255).optional(),
    contentType: contentTypeSchema,
    mediaUrl: z.string().trim().optional(),
    externalUrl: z.string().trim().optional(),
    textContent: z.string().trim().optional(),
})
    .refine((value) => {
    if (value.contentType === 'text')
        return !!value.textContent?.trim();
    if (value.contentType === 'youtube_url' || value.contentType === 'reel_url')
        return !!value.externalUrl?.trim();
    return !!value.mediaUrl?.trim();
}, { message: 'Missing required field for selected content type' });
const replaceTopicSectionsSchema = z.object({
    sections: z.array(contentSectionSchema).min(1).max(300),
});
const updateTopicAssignmentsSchema = z.object({
    contentIds: z.array(z.string().uuid()).default([]),
});
const updateTopicQuizAssignmentsSchema = z.object({
    quizIds: z.array(z.string().uuid()).default([]),
});
async function ensureTopicEditPermission(topicId, orgId, userId, req) {
    const result = await db.query(`SELECT id, created_by
     FROM content_topics
     WHERE id = $1
       AND organization_id = $2::uuid`, [topicId, orgId]);
    if ((result.rowCount ?? 0) === 0) {
        return { allowed: false, exists: false };
    }
    const createdBy = result.rows[0].created_by;
    if (canBypassOwnership(req) || !createdBy || createdBy === userId) {
        return { allowed: true, exists: true };
    }
    return { allowed: false, exists: true };
}
topicsRouter.get('/_meta', requireAuth, async (_req, res) => {
    const totals = await db.query(`SELECT COUNT(*)::text AS count FROM content_topics`);
    res.json({
        service: 'topic-service',
        version: '2.0.0',
        phase: 2,
        description: 'Owns the topic hierarchy + topic ↔ content / quiz / assignment mappings.',
        topicsCount: Number(totals.rows[0]?.count || 0),
    });
});
topicsRouter.get('/', requireAuth, async (req, res) => {
    const parsedQuery = listContentTopicsQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
        return res.status(400).json({ message: 'Invalid content topic filters', errors: parsedQuery.error.issues });
    }
    if (!canManageTeacherContent(req)) {
        return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
    }
    const orgId = getOrganizationId(req);
    if (!orgId) {
        return res.status(400).json({ message: 'Organization not found in auth context' });
    }
    const { class_level, subject, search, limit } = parsedQuery.data;
    const params = [orgId];
    const whereClauses = ['(ct.organization_id = $1::uuid OR ct.is_global = true)'];
    if (class_level) {
        params.push(class_level);
        whereClauses.push(`ct.class_level = $${params.length}`);
    }
    if (subject) {
        params.push(subject);
        whereClauses.push(`ct.subject = $${params.length}`);
    }
    if (search) {
        params.push(`%${search}%`);
        const idx = params.length;
        whereClauses.push(`(ct.title ILIKE $${idx} OR COALESCE(ct.subject, '') ILIKE $${idx})`);
    }
    params.push(limit);
    try {
        const result = await db.query(`SELECT
         ct.id,
         ct.class_level,
         ct.subject,
         ct.title,
         ct.cover_image,
         ct.is_global,
         ct.created_by,
         ct.created_at,
         ct.updated_at,
         COALESCE(
           (SELECT COUNT(*) FROM topic_content_assignments tca2 WHERE tca2.topic_id = ct.id), 0
         )::int AS content_count,
         COALESCE(
           (SELECT COUNT(*) FROM quizzes q WHERE q.topic_id = ct.id), 0
         )::int AS quiz_count
       FROM content_topics ct
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY ct.id
       ORDER BY ct.class_level ASC, ct.subject ASC, ct.title ASC
       LIMIT $${params.length}`, params);
        const topicRows = await Promise.all(result.rows.map(async (row) => {
            const signedCover = row.cover_image ? await getSignedMediaUrlIfNeeded(row.cover_image) : null;
            return {
                id: row.id,
                classLevel: row.class_level,
                subject: row.subject,
                title: row.title,
                coverImage: signedCover || undefined,
                sectionCount: 0,
                contentCount: Number(row.content_count || 0),
                quizCount: Number(row.quiz_count || 0),
                createdBy: row.created_by || undefined,
                isGlobal: Boolean(row.is_global),
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            };
        }));
        return res.json({ topics: topicRows });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch content topics' });
    }
});
topicsRouter.post('/', requireAuth, async (req, res) => {
    const parsedBody = createContentTopicSchema.safeParse(req.body);
    if (!parsedBody.success) {
        return res.status(400).json({ message: 'Invalid content topic payload', errors: parsedBody.error.issues });
    }
    if (!canManageTeacherContent(req)) {
        return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
    }
    const orgId = getOrganizationId(req);
    const userId = getUserId(req);
    if (!orgId || !userId) {
        return res.status(400).json({ message: 'Organization/user not found in auth context' });
    }
    const { classLevel, subject, title, coverImage, isGlobal } = parsedBody.data;
    if (isGlobal && !canPublishGlobalResources(req)) {
        return res.status(403).json({ message: 'Forbidden: global publish permission required' });
    }
    try {
        const duplicate = await db.query(`SELECT 1
       FROM content_topics
       WHERE organization_id = $1::uuid
         AND class_level = $2
         AND subject = $3
         AND LOWER(title) = LOWER($4)
       LIMIT 1`, [orgId, classLevel, subject, title]);
        if ((duplicate.rowCount ?? 0) > 0) {
            return res.status(400).json({ message: 'Topic already exists for this standard and subject' });
        }
        const result = await db.query(`INSERT INTO content_topics (organization_id, class_level, subject, title, cover_image, created_by, is_global)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
       RETURNING id, class_level, subject, title, cover_image, created_by, is_global, created_at, updated_at`, [orgId, classLevel, subject, title, coverImage ? toPersistentMediaUrl(coverImage) : null, userId, isGlobal]);
        const row = result.rows[0];
        const signedCover = row.cover_image ? await getSignedMediaUrlIfNeeded(row.cover_image) : null;
        return res.status(201).json({
            id: row.id,
            classLevel: row.class_level,
            subject: row.subject,
            title: row.title,
            coverImage: signedCover || undefined,
            sectionCount: 0,
            createdBy: row.created_by || undefined,
            isGlobal: Boolean(row.is_global),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to create content topic' });
    }
});
topicsRouter.patch('/:topicId', requireAuth, async (req, res) => {
    const topicId = req.params.topicId;
    const parsedBody = updateContentTopicSchema.safeParse(req.body);
    if (!topicId) {
        return res.status(400).json({ message: 'Invalid topic id' });
    }
    if (!parsedBody.success) {
        return res.status(400).json({ message: 'Invalid update payload', errors: parsedBody.error.issues });
    }
    if (!canManageTeacherContent(req)) {
        return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
    }
    const orgId = getOrganizationId(req);
    const userId = getUserId(req);
    if (!orgId || !userId) {
        return res.status(400).json({ message: 'Organization/user not found in auth context' });
    }
    try {
        const permission = await ensureTopicEditPermission(topicId, orgId, userId, req);
        if (!permission.exists) {
            return res.status(404).json({ message: 'Topic not found' });
        }
        if (!permission.allowed) {
            return res.status(403).json({ message: 'Forbidden: not allowed to edit this topic' });
        }
        const existing = await db.query(`SELECT class_level, subject, title
       FROM content_topics
       WHERE id = $1
         AND organization_id = $2::uuid
       LIMIT 1`, [topicId, orgId]);
        const existingRow = existing.rows[0];
        const nextClassLevel = parsedBody.data.classLevel ?? existingRow?.class_level;
        const nextSubject = parsedBody.data.subject ?? existingRow?.subject;
        const nextTitle = parsedBody.data.title ?? existingRow?.title;
        const duplicate = await db.query(`SELECT 1
       FROM content_topics
       WHERE organization_id = $1::uuid
         AND class_level = $2
         AND subject = $3
         AND LOWER(title) = LOWER($4)
         AND id <> $5
       LIMIT 1`, [orgId, nextClassLevel, nextSubject, nextTitle, topicId]);
        if ((duplicate.rowCount ?? 0) > 0) {
            return res.status(400).json({ message: 'Topic already exists for this standard and subject' });
        }
        const updates = ['updated_at = NOW()'];
        const params = [];
        if (parsedBody.data.classLevel !== undefined) {
            params.push(parsedBody.data.classLevel);
            updates.push(`class_level = $${params.length}`);
        }
        if (parsedBody.data.subject !== undefined) {
            params.push(parsedBody.data.subject);
            updates.push(`subject = $${params.length}`);
        }
        if (parsedBody.data.title !== undefined) {
            params.push(parsedBody.data.title);
            updates.push(`title = $${params.length}`);
        }
        if (parsedBody.data.coverImage !== undefined) {
            params.push(parsedBody.data.coverImage ? toPersistentMediaUrl(parsedBody.data.coverImage) : null);
            updates.push(`cover_image = $${params.length}`);
        }
        if (parsedBody.data.isGlobal !== undefined) {
            if (!canPublishGlobalResources(req)) {
                return res.status(403).json({ message: 'Forbidden: global publish permission required' });
            }
            params.push(parsedBody.data.isGlobal);
            updates.push(`is_global = $${params.length}`);
        }
        params.push(topicId, orgId);
        const result = await db.query(`UPDATE content_topics
       SET ${updates.join(', ')}
       WHERE id = $${params.length - 1}
         AND organization_id = $${params.length}::uuid
       RETURNING id, class_level, subject, title, cover_image, created_by, is_global, created_at, updated_at`, params);
        const row = result.rows[0];
        const countResult = await db.query(`SELECT COUNT(lcs.id)::int AS count
       FROM topic_content_assignments tca
       LEFT JOIN learning_content_sections lcs ON lcs.content_id = tca.content_id
       WHERE tca.topic_id = $1`, [topicId]);
        const signedCover = row.cover_image ? await getSignedMediaUrlIfNeeded(row.cover_image) : null;
        return res.json({
            id: row.id,
            classLevel: row.class_level,
            subject: row.subject,
            title: row.title,
            coverImage: signedCover || undefined,
            sectionCount: Number(countResult.rows[0]?.count || 0),
            createdBy: row.created_by || undefined,
            isGlobal: Boolean(row.is_global),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to update content topic' });
    }
});
topicsRouter.delete('/:topicId', requireAuth, async (req, res) => {
    const topicId = req.params.topicId;
    if (!topicId) {
        return res.status(400).json({ message: 'Invalid topic id' });
    }
    if (!canManageTeacherContent(req)) {
        return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
    }
    const orgId = getOrganizationId(req);
    const userId = getUserId(req);
    if (!orgId || !userId) {
        return res.status(400).json({ message: 'Organization/user not found in auth context' });
    }
    try {
        const permission = await ensureTopicEditPermission(topicId, orgId, userId, req);
        if (!permission.exists) {
            return res.status(404).json({ message: 'Topic not found' });
        }
        if (!permission.allowed) {
            return res.status(403).json({ message: 'Forbidden: not allowed to delete this topic' });
        }
        await db.query(`DELETE FROM content_topics
       WHERE id = $1
         AND organization_id = $2::uuid`, [topicId, orgId]);
        return res.status(204).send();
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to delete content topic' });
    }
});
topicsRouter.get('/:topicId/details', requireAuth, async (req, res) => {
    const topicId = req.params.topicId;
    if (!topicId) {
        return res.status(400).json({ message: 'Invalid topic id' });
    }
    if (!canManageTeacherContent(req)) {
        return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
    }
    const orgId = getOrganizationId(req);
    if (!orgId) {
        return res.status(400).json({ message: 'Organization not found in auth context' });
    }
    try {
        const topicResult = await db.query(`SELECT id, class_level, subject, title, cover_image, created_by, created_at, updated_at
       FROM content_topics
       WHERE id = $1
         AND (organization_id = $2::uuid OR is_global = true)
       LIMIT 1`, [topicId, orgId]);
        if ((topicResult.rowCount ?? 0) === 0) {
            return res.status(404).json({ message: 'Topic not found' });
        }
        const contentItemsResult = await db.query(`SELECT
         lc.id,
         lc.class_level,
         lc.subject,
         lc.title,
         lc.content_type,
         lc.media_url,
         lc.external_url,
         lc.text_content,
         lc.created_by,
         lc.created_at,
         lc.updated_at,
         tca.sort_order
       FROM topic_content_assignments tca
       INNER JOIN learning_contents lc ON lc.id = tca.content_id
       WHERE tca.topic_id = $1
       ORDER BY tca.sort_order ASC, tca.created_at ASC`, [topicId]);
        const topic = topicResult.rows[0];
        const signedCover = topic.cover_image ? await getSignedMediaUrlIfNeeded(topic.cover_image) : null;
        const contentIds = contentItemsResult.rows.map((row) => row.id);
        let sectionsRows = [];
        if (contentIds.length > 0) {
            const sectionsResult = await db.query(`SELECT id, content_id, section_order, title, content_type, media_url, external_url, text_content, created_at, updated_at
         FROM learning_content_sections
         WHERE content_id = ANY($1::uuid[])
         ORDER BY content_id, section_order ASC, created_at ASC`, [contentIds]);
            sectionsRows = sectionsResult.rows;
        }
        const sectionsGroupedByContentId = {};
        for (const row of sectionsRows) {
            const cId = row.content_id;
            if (!sectionsGroupedByContentId[cId]) {
                sectionsGroupedByContentId[cId] = [];
            }
            sectionsGroupedByContentId[cId].push({
                id: row.id,
                sectionOrder: Number(row.section_order || 0),
                title: row.title || undefined,
                contentType: row.content_type,
                mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url) : undefined,
                externalUrl: row.external_url || undefined,
                textContent: row.text_content || undefined,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            });
        }
        const contentItems = await Promise.all(contentItemsResult.rows.map(async (row) => {
            const cId = row.id;
            let sections = sectionsGroupedByContentId[cId] || [];
            if (sections.length === 0) {
                sections = [
                    {
                        id: row.id,
                        sectionOrder: 1,
                        title: undefined,
                        contentType: row.content_type,
                        mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url) : undefined,
                        externalUrl: row.external_url || undefined,
                        textContent: row.text_content || undefined,
                        createdAt: row.created_at,
                        updatedAt: row.updated_at,
                    },
                ];
            }
            return {
                id: cId,
                classLevel: row.class_level,
                subject: row.subject,
                title: row.title,
                contentType: row.content_type,
                sectionCount: sections.length,
                mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url) : undefined,
                externalUrl: row.external_url || undefined,
                textContent: row.text_content || undefined,
                sections,
                createdBy: row.created_by || undefined,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            };
        }));
        const flatSections = [];
        for (const item of contentItems) {
            flatSections.push(...item.sections);
        }
        return res.json({
            topic: {
                id: topic.id,
                classLevel: topic.class_level,
                subject: topic.subject,
                title: topic.title,
                coverImage: signedCover || undefined,
                createdBy: topic.created_by || undefined,
                createdAt: topic.created_at,
                updatedAt: topic.updated_at,
            },
            contentItems,
            sections: flatSections,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch topic details' });
    }
});
topicsRouter.put('/:topicId/sections', requireAuth, async (req, res) => {
    const topicId = req.params.topicId;
    const parsedBody = replaceTopicSectionsSchema.safeParse(req.body);
    if (!topicId) {
        return res.status(400).json({ message: 'Invalid topic id' });
    }
    if (!parsedBody.success) {
        return res.status(400).json({ message: 'Invalid sections payload', errors: parsedBody.error.issues });
    }
    if (!canManageTeacherContent(req)) {
        return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
    }
    const orgId = getOrganizationId(req);
    const userId = getUserId(req);
    if (!orgId || !userId) {
        return res.status(400).json({ message: 'Organization/user not found in auth context' });
    }
    const permission = await ensureTopicEditPermission(topicId, orgId, userId, req);
    if (!permission.exists) {
        return res.status(404).json({ message: 'Topic not found' });
    }
    if (!permission.allowed) {
        return res.status(403).json({ message: 'Forbidden: not allowed to update this topic' });
    }
    const sections = parsedBody.data.sections;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM topic_content_sections WHERE topic_id = $1`, [topicId]);
        for (let i = 0; i < sections.length; i += 1) {
            const section = sections[i];
            await client.query(`INSERT INTO topic_content_sections (topic_id, section_order, title, content_type, media_url, external_url, text_content)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                topicId,
                i + 1,
                section.title?.trim() || null,
                section.contentType,
                section.mediaUrl ? toPersistentMediaUrl(section.mediaUrl) : null,
                section.externalUrl || null,
                section.textContent || null,
            ]);
        }
        await client.query('COMMIT');
        const detailsResult = await db.query(`SELECT id, section_order, title, content_type, media_url, external_url, text_content, created_at, updated_at
       FROM topic_content_sections
       WHERE topic_id = $1
       ORDER BY section_order ASC`, [topicId]);
        const resolvedSections = await Promise.all(detailsResult.rows.map(async (row) => ({
            id: row.id,
            sectionOrder: Number(row.section_order || 0),
            title: row.title || undefined,
            contentType: row.content_type,
            mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url) : undefined,
            externalUrl: row.external_url || undefined,
            textContent: row.text_content || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        })));
        return res.json({ sections: resolvedSections });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        return res.status(500).json({ message: 'Failed to save content sections' });
    }
    finally {
        client.release();
    }
});
topicsRouter.get('/:topicId/assignments', requireAuth, async (req, res) => {
    const topicId = req.params.topicId;
    if (!topicId) {
        return res.status(400).json({ message: 'Invalid topic id' });
    }
    if (!canManageTeacherContent(req)) {
        return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
    }
    const orgId = getOrganizationId(req);
    if (!orgId) {
        return res.status(400).json({ message: 'Organization not found in auth context' });
    }
    try {
        const topicCheck = await db.query(`SELECT 1 FROM content_topics WHERE id = $1 AND (organization_id = $2::uuid OR is_global = true) LIMIT 1`, [topicId, orgId]);
        if ((topicCheck.rowCount ?? 0) === 0) {
            return res.status(404).json({ message: 'Topic not found' });
        }
        const result = await db.query(`SELECT content_id
       FROM topic_content_assignments
       WHERE topic_id = $1
       ORDER BY sort_order ASC, created_at ASC`, [topicId]);
        return res.json({ contentIds: result.rows.map((row) => row.content_id) });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch topic assignments' });
    }
});
topicsRouter.put('/:topicId/assignments', requireAuth, async (req, res) => {
    const topicId = req.params.topicId;
    const parsedBody = updateTopicAssignmentsSchema.safeParse(req.body);
    if (!topicId) {
        return res.status(400).json({ message: 'Invalid topic id' });
    }
    if (!parsedBody.success) {
        return res.status(400).json({ message: 'Invalid assignment payload', errors: parsedBody.error.issues });
    }
    if (!canManageTeacherContent(req)) {
        return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
    }
    const orgId = getOrganizationId(req);
    const userId = getUserId(req);
    if (!orgId || !userId) {
        return res.status(400).json({ message: 'Organization/user not found in auth context' });
    }
    try {
        const permission = await ensureTopicEditPermission(topicId, orgId, userId, req);
        if (!permission.exists)
            return res.status(404).json({ message: 'Topic not found' });
        if (!permission.allowed)
            return res.status(403).json({ message: 'Forbidden: not allowed to update this topic' });
        const uniqueIds = [...new Set(parsedBody.data.contentIds)];
        if (uniqueIds.length > 0) {
            const validateResult = await db.query(`SELECT COUNT(*)::int AS count
         FROM learning_contents
         WHERE (organization_id = $1::uuid OR is_global = true)
           AND id = ANY($2::uuid[])`, [orgId, uniqueIds]);
            if (Number(validateResult.rows[0]?.count || 0) !== uniqueIds.length) {
                return res.status(400).json({ message: 'One or more selected content items are invalid' });
            }
        }
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            await client.query(`DELETE FROM topic_content_assignments WHERE topic_id = $1`, [topicId]);
            for (let i = 0; i < uniqueIds.length; i += 1) {
                await client.query(`INSERT INTO topic_content_assignments (topic_id, content_id, sort_order)
           VALUES ($1, $2, $3)`, [topicId, uniqueIds[i], i + 1]);
            }
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
        return res.json({ topicId, contentIds: uniqueIds });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to update topic assignments' });
    }
});
topicsRouter.get('/:topicId/quizzes', requireAuth, async (req, res) => {
    const topicId = req.params.topicId;
    if (!topicId)
        return res.status(400).json({ message: 'Invalid topic id' });
    if (!canManageTeacherContent(req))
        return res.status(403).json({ message: 'Forbidden' });
    const orgId = getOrganizationId(req);
    if (!orgId)
        return res.status(400).json({ message: 'Organization not found in auth context' });
    try {
        const result = await db.query(`SELECT id, title, quiz_type, class_level, subject, is_published, total_questions, created_at
       FROM quizzes
       WHERE (organization_id = $1::uuid OR is_global = true) AND topic_id = $2
       ORDER BY created_at DESC`, [orgId, topicId]);
        return res.json({ quizzes: result.rows });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch topic quizzes' });
    }
});
topicsRouter.put('/:topicId/quizzes/:quizId', requireAuth, async (req, res) => {
    const { topicId, quizId } = req.params;
    if (!topicId || !quizId)
        return res.status(400).json({ message: 'Invalid topic or quiz id' });
    if (!canManageTeacherContent(req))
        return res.status(403).json({ message: 'Forbidden' });
    const orgId = getOrganizationId(req);
    if (!orgId)
        return res.status(400).json({ message: 'Organization not found in auth context' });
    try {
        const topicCheck = await db.query(`SELECT 1 FROM content_topics WHERE id = $1 AND (organization_id = $2::uuid OR is_global = true) LIMIT 1`, [topicId, orgId]);
        if ((topicCheck.rowCount ?? 0) === 0)
            return res.status(404).json({ message: 'Topic not found' });
        const quizCheck = await db.query(`SELECT 1 FROM quizzes WHERE id = $1 AND (organization_id = $2::uuid OR is_global = true) LIMIT 1`, [quizId, orgId]);
        if ((quizCheck.rowCount ?? 0) === 0)
            return res.status(404).json({ message: 'Quiz not found' });
        await db.query(`UPDATE quizzes SET topic_id = $1, updated_at = NOW() WHERE id = $2`, [topicId, quizId]);
        return res.json({ message: 'Quiz assigned to topic successfully', topicId, quizId });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to assign quiz to topic' });
    }
});
topicsRouter.put('/:topicId/quizzes', requireAuth, async (req, res) => {
    const topicId = req.params.topicId;
    const parsedBody = updateTopicQuizAssignmentsSchema.safeParse(req.body);
    if (!topicId)
        return res.status(400).json({ message: 'Invalid topic id' });
    if (!parsedBody.success) {
        return res.status(400).json({ message: 'Invalid quiz assignment payload', errors: parsedBody.error.issues });
    }
    if (!canManageTeacherContent(req))
        return res.status(403).json({ message: 'Forbidden' });
    const orgId = getOrganizationId(req);
    if (!orgId)
        return res.status(400).json({ message: 'Organization not found in auth context' });
    const uniqueQuizIds = [...new Set(parsedBody.data.quizIds)];
    try {
        const topicCheck = await db.query(`SELECT 1 FROM content_topics WHERE id = $1 AND (organization_id = $2::uuid OR is_global = true) LIMIT 1`, [topicId, orgId]);
        if ((topicCheck.rowCount ?? 0) === 0)
            return res.status(404).json({ message: 'Topic not found' });
        if (uniqueQuizIds.length > 0) {
            const validQuizCount = await db.query(`SELECT COUNT(*)::int AS count
         FROM quizzes
         WHERE (organization_id = $1::uuid OR is_global = true)
           AND id = ANY($2::uuid[])`, [orgId, uniqueQuizIds]);
            if (Number(validQuizCount.rows[0]?.count || 0) !== uniqueQuizIds.length) {
                return res.status(400).json({ message: 'One or more quizzes are invalid' });
            }
        }
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            if (uniqueQuizIds.length > 0) {
                await client.query(`UPDATE quizzes
           SET topic_id = NULL, updated_at = NOW()
           WHERE (organization_id = $1::uuid OR is_global = true)
             AND topic_id = $2
             AND NOT (id = ANY($3::uuid[]))`, [orgId, topicId, uniqueQuizIds]);
                await client.query(`UPDATE quizzes
           SET topic_id = $1, updated_at = NOW()
           WHERE (organization_id = $2::uuid OR is_global = true)
             AND id = ANY($3::uuid[])`, [topicId, orgId, uniqueQuizIds]);
            }
            else {
                await client.query(`UPDATE quizzes
           SET topic_id = NULL, updated_at = NOW()
           WHERE (organization_id = $1::uuid OR is_global = true)
             AND topic_id = $2`, [orgId, topicId]);
            }
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
        return res.json({ topicId, quizIds: uniqueQuizIds });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to update topic quiz assignments' });
    }
});
topicsRouter.delete('/:topicId/quizzes/:quizId', requireAuth, async (req, res) => {
    const { quizId } = req.params;
    if (!quizId)
        return res.status(400).json({ message: 'Invalid quiz id' });
    if (!canManageTeacherContent(req))
        return res.status(403).json({ message: 'Forbidden' });
    const orgId = getOrganizationId(req);
    if (!orgId)
        return res.status(400).json({ message: 'Organization not found in auth context' });
    try {
        await db.query(`UPDATE quizzes SET topic_id = NULL, updated_at = NOW() WHERE id = $1 AND (organization_id = $2::uuid OR is_global = true)`, [quizId, orgId]);
        return res.json({ message: 'Quiz unassigned from topic successfully' });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to unassign quiz from topic' });
    }
});
catalogRouter.get('/', requireAuth, async (req, res) => {
    const orgId = getOrganizationId(req);
    if (!orgId)
        return res.status(400).json({ message: 'Organization not found in auth context' });
    try {
        const result = await db.query(`SELECT class_level, title AS subject
       FROM subjects
       WHERE organization_id = $1::uuid
       ORDER BY class_level ASC, title ASC`, [orgId]);
        const classLevels = [...new Set(result.rows.map((r) => r.class_level))];
        const subjects = [...new Set(result.rows.map((r) => r.subject))];
        return res.json({ classLevels, subjects, items: result.rows });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch subject catalog' });
    }
});
studentsRouter.get('/', requireAuth, async (req, res) => {
    const orgId = getOrganizationId(req);
    const userId = getUserId(req);
    if (!orgId || !userId)
        return res.status(400).json({ message: 'Organization/user not found' });
    try {
        const userRow = await db.query(`SELECT class_level FROM users WHERE id = $1 LIMIT 1`, [userId]);
        const classLevel = userRow.rows[0]?.class_level;
        if (!classLevel)
            return res.json({ subjects: [], classLevel: null });
        const result = await db.query(`SELECT
         ct.id, ct.class_level, ct.subject, ct.title, ct.cover_image,
         ct.created_at, ct.updated_at,
         COUNT(DISTINCT tca.content_id) AS content_count
       FROM content_topics ct
       LEFT JOIN topic_content_assignments tca ON tca.topic_id = ct.id
       WHERE (ct.organization_id = $1::uuid OR ct.is_global = true)
         AND ct.class_level = $2
       GROUP BY ct.id
       ORDER BY ct.subject, ct.title`, [orgId, classLevel]);
        const subjectMap = {};
        for (const row of result.rows) {
            const sub = row.subject;
            if (!subjectMap[sub])
                subjectMap[sub] = { subject: sub, topics: [] };
            subjectMap[sub].topics.push({
                id: row.id,
                classLevel: row.class_level,
                subject: sub,
                title: row.title,
                coverImage: row.cover_image ? await getSignedMediaUrlIfNeeded(row.cover_image) : null,
                contentCount: Number(row.content_count || 0),
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            });
        }
        return res.json({
            classLevel,
            subjects: Object.values(subjectMap),
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Failed to fetch subjects' });
    }
});
studentsRouter.get('/:topicId', requireAuth, async (req, res) => {
    const orgId = getOrganizationId(req);
    const topicId = req.params.topicId;
    if (!orgId || !topicId)
        return res.status(400).json({ message: 'Invalid params' });
    try {
        const topicRow = await db.query(`SELECT id, class_level, subject, title, cover_image FROM content_topics
       WHERE id = $1 AND (organization_id = $2::uuid OR is_global = true) LIMIT 1`, [topicId, orgId]);
        if ((topicRow.rowCount ?? 0) === 0)
            return res.status(404).json({ message: 'Topic not found' });
        const topic = topicRow.rows[0];
        const contentResult = await db.query(`SELECT lc.id, lc.title, lc.content_type, lc.media_url, lc.external_url, lc.text_content, tca.sort_order
       FROM topic_content_assignments tca
       INNER JOIN learning_contents lc ON lc.id = tca.content_id
       WHERE tca.topic_id = $1
       ORDER BY tca.sort_order ASC, tca.created_at ASC`, [topicId]);
        return res.json({
            topic: {
                id: topic.id,
                classLevel: topic.class_level,
                subject: topic.subject,
                title: topic.title,
                coverImage: topic.cover_image ? await getSignedMediaUrlIfNeeded(topic.cover_image) : null,
            },
            contents: contentResult.rows.map((row) => ({
                id: row.id,
                title: row.title,
                contentType: row.content_type,
                mediaUrl: row.media_url || undefined,
                externalUrl: row.external_url || undefined,
                textContent: row.text_content || undefined,
                sortOrder: Number(row.sort_order || 0),
            })),
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Failed to fetch topic detail' });
    }
});
