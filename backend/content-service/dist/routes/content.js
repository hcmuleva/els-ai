import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getSignedMediaUrlIfNeeded, toPersistentMediaUrl } from '../services/s3.js';
export const contentRouter = Router();
const contentTypeSchema = z.enum(['reel', 'image', 'text', 'audio', 'youtube_url', 'reel_url']);
const listSubjectCatalogQuerySchema = z.object({
    class_level: z.string().trim().optional(),
});
const contentSectionSchema = z
    .object({
    title: z.string().trim().max(255).optional(),
    contentType: contentTypeSchema,
    mediaUrl: z.string().trim().optional(),
    externalUrl: z.string().trim().optional(),
    textContent: z.string().trim().optional(),
    quizId: z.string().uuid().optional().nullable(),
})
    .refine((value) => {
    if (value.contentType === 'text')
        return !!value.textContent?.trim();
    if (value.contentType === 'youtube_url' || value.contentType === 'reel_url')
        return !!value.externalUrl?.trim();
    return !!value.mediaUrl?.trim();
}, { message: 'Missing required field for selected content type' });
const createLearningContentSchema = z.object({
    classLevel: z.string().trim().min(1).max(50),
    subject: z.string().trim().min(1).max(255),
    topicId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(255),
    contentType: contentTypeSchema.optional(),
    mediaUrl: z.string().trim().optional(),
    externalUrl: z.string().trim().optional(),
    textContent: z.string().trim().optional(),
    sections: z.array(contentSectionSchema).min(1).max(300).optional(),
    isGlobal: z.boolean().default(false),
});
const updateLearningContentSchema = z.object({
    classLevel: z.string().trim().min(1).max(50),
    subject: z.string().trim().min(1).max(255),
    title: z.string().trim().min(1).max(255),
    contentType: contentTypeSchema.optional(),
    mediaUrl: z.string().trim().optional(),
    externalUrl: z.string().trim().optional(),
    textContent: z.string().trim().optional(),
    sections: z.array(contentSectionSchema).min(1).max(300).optional(),
    isGlobal: z.boolean().optional(),
});
const listLearningContentQuerySchema = z.object({
    class_level: z.string().trim().optional(),
    subject: z.string().trim().optional(),
    topic_id: z.string().uuid().optional(),
    search: z.string().trim().optional(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
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
function normalizeLearningContentSections(payload) {
    if (Array.isArray(payload.sections) && payload.sections.length > 0) {
        return payload.sections.map((section) => ({
            title: section.title?.trim() || null,
            contentType: section.contentType,
            mediaUrl: section.mediaUrl?.trim() ? toPersistentMediaUrl(section.mediaUrl.trim()) : null,
            externalUrl: section.externalUrl?.trim() || null,
            textContent: section.textContent?.trim() || null,
            quizId: section.quizId || null,
        }));
    }
    if (!payload.contentType)
        return [];
    return [
        {
            title: null,
            contentType: payload.contentType,
            mediaUrl: payload.mediaUrl?.trim() ? toPersistentMediaUrl(payload.mediaUrl.trim()) : null,
            externalUrl: payload.externalUrl?.trim() || null,
            textContent: payload.textContent?.trim() || null,
            quizId: null,
        },
    ];
}
contentRouter.get('/_meta', requireAuth, async (_req, res) => {
    const totals = await db.query(`SELECT COUNT(*)::text AS count FROM learning_contents`);
    res.json({
        service: 'content-service',
        version: '2.0.0',
        phase: 2,
        description: 'Owns the learning content library (videos, articles, reels, audio, images, YouTube URLs) plus the org subject catalog.',
        contentItems: Number(totals.rows[0]?.count || 0),
    });
});
contentRouter.get('/subjects', requireAuth, async (req, res) => {
    const parsedQuery = listSubjectCatalogQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
        return res.status(400).json({ message: 'Invalid subject filters', errors: parsedQuery.error.issues });
    }
    if (!canManageTeacherContent(req)) {
        return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
    }
    const orgId = getOrganizationId(req);
    if (!orgId) {
        return res.status(400).json({ message: 'Organization not found in auth context' });
    }
    const { class_level } = parsedQuery.data;
    const params = [orgId];
    const whereClauses = ['organization_id = $1::uuid'];
    if (class_level) {
        params.push(class_level);
        whereClauses.push(`class_level = $${params.length}`);
    }
    try {
        const result = await db.query(`SELECT id, title, class_level, cover_image, icon_image, icon_bg_color
       FROM subjects
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY class_level ASC, title ASC`, params);
        const rows = await Promise.all(result.rows.map(async (row) => ({
            id: row.id,
            title: row.title,
            classLevel: row.class_level,
            coverImage: row.cover_image ? await getSignedMediaUrlIfNeeded(row.cover_image) : undefined,
            iconImage: row.icon_image ? await getSignedMediaUrlIfNeeded(row.icon_image) : undefined,
            iconBgColor: row.icon_bg_color || undefined,
        })));
        return res.json({ subjects: rows });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch subject catalog' });
    }
});
contentRouter.post('/items', requireAuth, async (req, res) => {
    const parsedBody = createLearningContentSchema.safeParse(req.body);
    if (!parsedBody.success) {
        return res.status(400).json({ message: 'Invalid content payload', errors: parsedBody.error.issues });
    }
    if (!canManageTeacherContent(req)) {
        return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
    }
    const orgId = getOrganizationId(req);
    const userId = req?.user?.userId;
    if (!orgId || !userId) {
        return res.status(400).json({ message: 'Organization/user not found in auth context' });
    }
    const { classLevel, subject, topicId, title, isGlobal } = parsedBody.data;
    if (isGlobal && !canPublishGlobalResources(req)) {
        return res.status(403).json({ message: 'Forbidden: global publish permission required' });
    }
    const sections = normalizeLearningContentSections(parsedBody.data);
    if (sections.length === 0) {
        return res.status(400).json({ message: 'At least one valid section is required' });
    }
    try {
        if (topicId) {
            const topicCheck = await db.query(`SELECT 1 FROM content_topics WHERE id = $1 AND (organization_id = $2::uuid OR is_global = true) LIMIT 1`, [topicId, orgId]);
            if ((topicCheck.rowCount ?? 0) === 0) {
                return res.status(404).json({ message: 'Topic not found for assignment' });
            }
        }
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            const contentResult = await client.query(`INSERT INTO learning_contents (organization_id, class_level, subject_id, title, content_type, media_url, external_url, text_content, created_by, is_global)
         VALUES (
           $1::uuid, $2::varchar,
           (SELECT s.id FROM subjects s
              WHERE s.class_level = $2::varchar AND LOWER(s.title) = LOWER($3::varchar)
                AND (s.organization_id = $1::uuid OR $10::boolean = true)
              ORDER BY (s.organization_id = $1::uuid) DESC, s.updated_at DESC NULLS LAST
              LIMIT 1),
           $4::varchar, $5::varchar, $6, $7, $8, $9::uuid, $10::boolean)
         RETURNING id, class_level, subject_id,
           (SELECT title FROM subjects WHERE id = learning_contents.subject_id) AS subject,
           title, content_type, media_url, external_url, text_content, created_by, is_global, created_at, updated_at`, [
                orgId,
                classLevel,
                subject,
                title,
                sections.length > 1 ? 'multi_section' : sections[0].contentType,
                sections[0].mediaUrl,
                sections[0].externalUrl,
                sections[0].textContent,
                userId,
                isGlobal,
            ]);
            const created = contentResult.rows[0];
            for (let i = 0; i < sections.length; i += 1) {
                const section = sections[i];
                await client.query(`INSERT INTO learning_content_sections (content_id, section_order, title, content_type, media_url, external_url, text_content, quiz_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [created.id, i + 1, section.title?.trim() || null, section.contentType, section.mediaUrl ? toPersistentMediaUrl(section.mediaUrl) : null, section.externalUrl || null, section.textContent || null, section.quizId || null]);
            }
            if (topicId) {
                await client.query(`INSERT INTO topic_content_assignments (topic_id, content_id, sort_order)
           VALUES ($1, $2, 0)
           ON CONFLICT (topic_id, content_id) DO NOTHING`, [topicId, created.id]);
            }
            await client.query('COMMIT');
            return res.status(201).json({
                id: created.id,
                classLevel: created.class_level,
                subject: created.subject,
                title: created.title,
                contentType: created.content_type,
                sectionCount: sections.length,
                mediaUrl: created.media_url ? await getSignedMediaUrlIfNeeded(created.media_url) : undefined,
                externalUrl: created.external_url || undefined,
                textContent: created.text_content || undefined,
                createdBy: created.created_by || undefined,
                isGlobal: Boolean(created.is_global),
                createdAt: created.created_at,
                updatedAt: created.updated_at,
            });
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to create content item' });
    }
});
contentRouter.get('/items', requireAuth, async (req, res) => {
    const parsedQuery = listLearningContentQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
        return res.status(400).json({ message: 'Invalid content filters', errors: parsedQuery.error.issues });
    }
    if (!canManageTeacherContent(req)) {
        return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
    }
    const orgId = getOrganizationId(req);
    if (!orgId) {
        return res.status(400).json({ message: 'Organization not found in auth context' });
    }
    const { class_level, subject, topic_id, search, limit } = parsedQuery.data;
    const params = [orgId];
    const whereClauses = ['(lc.organization_id = $1::uuid OR lc.is_global = true)'];
    if (class_level) {
        params.push(class_level);
        whereClauses.push(`lc.class_level = $${params.length}`);
    }
    if (subject) {
        params.push(subject);
        whereClauses.push(`s.title = $${params.length}`);
    }
    if (search) {
        params.push(`%${search}%`);
        const idx = params.length;
        whereClauses.push(`(lc.title ILIKE $${idx} OR COALESCE(lc.text_content, '') ILIKE $${idx})`);
    }
    if (topic_id) {
        params.push(topic_id);
        whereClauses.push(`EXISTS (SELECT 1 FROM topic_content_assignments tca WHERE tca.topic_id = $${params.length} AND tca.content_id = lc.id)`);
    }
    params.push(limit);
    try {
        const result = await db.query(`SELECT
         lc.id,
         lc.class_level,
         s.title AS subject,
         lc.title,
         lc.content_type,
         lc.media_url,
         lc.external_url,
         lc.text_content,
         lc.created_by,
         lc.is_global,
         lc.created_at,
         lc.updated_at,
         COALESCE(sec.count, 0)::int AS section_count,
         COALESCE(
           jsonb_agg(
             DISTINCT jsonb_build_object(
               'topicId', ct.id,
               'title', ct.title,
               'classLevel', ct.class_level,
               'subject', cts.title
             )
           ) FILTER (WHERE ct.id IS NOT NULL),
           '[]'::jsonb
         ) AS assigned_topics
       FROM learning_contents lc
       LEFT JOIN subjects s ON s.id = lc.subject_id
       LEFT JOIN (
         SELECT content_id, COUNT(*)::int AS count
         FROM learning_content_sections
         GROUP BY content_id
       ) sec ON sec.content_id = lc.id
       LEFT JOIN topic_content_assignments tca ON tca.content_id = lc.id
       LEFT JOIN content_topics ct ON ct.id = tca.topic_id AND ct.organization_id = lc.organization_id
       LEFT JOIN subjects cts ON cts.id = ct.subject_id
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY lc.id, s.title, sec.count
       ORDER BY lc.created_at DESC
       LIMIT $${params.length}`, params);
        const items = await Promise.all(result.rows.map(async (row) => ({
            id: row.id,
            classLevel: row.class_level,
            subject: row.subject,
            title: row.title,
            contentType: row.content_type,
            sectionCount: Number(row.section_count || 0),
            mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url) : undefined,
            externalUrl: row.external_url || undefined,
            textContent: row.text_content || undefined,
            assignedTopics: row.assigned_topics || [],
            createdBy: row.created_by || undefined,
            isGlobal: Boolean(row.is_global),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        })));
        return res.json({ items });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to list content items' });
    }
});
contentRouter.get('/items/:contentId', requireAuth, async (req, res) => {
    const contentId = req.params.contentId;
    if (!contentId)
        return res.status(400).json({ message: 'Invalid content id' });
    if (!canManageTeacherContent(req)) {
        return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
    }
    const orgId = getOrganizationId(req);
    if (!orgId)
        return res.status(400).json({ message: 'Organization not found in auth context' });
    try {
        const contentResult = await db.query(`SELECT lc.id, lc.class_level, s.title AS subject, lc.title, lc.content_type, lc.media_url, lc.external_url, lc.text_content, lc.created_by, lc.is_global, lc.created_at, lc.updated_at
       FROM learning_contents lc
       LEFT JOIN subjects s ON s.id = lc.subject_id
       WHERE lc.id = $1
         AND (lc.organization_id = $2::uuid OR lc.is_global = true)
       LIMIT 1`, [contentId, orgId]);
        if ((contentResult.rowCount ?? 0) === 0) {
            return res.status(404).json({ message: 'Content item not found' });
        }
        const sectionsResult = await db.query(`SELECT id, section_order, title, content_type, media_url, external_url, text_content, quiz_id, created_at, updated_at
       FROM learning_content_sections
       WHERE content_id = $1
       ORDER BY section_order ASC`, [contentId]);
        let sections = await Promise.all(sectionsResult.rows.map(async (row) => ({
            id: row.id,
            sectionOrder: Number(row.section_order || 0),
            title: row.title || undefined,
            contentType: row.content_type,
            mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url) : undefined,
            externalUrl: row.external_url || undefined,
            textContent: row.text_content || undefined,
            quizId: row.quiz_id || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        })));
        const row = contentResult.rows[0];
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
                    quizId: undefined,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                },
            ];
        }
        return res.json({
            id: row.id,
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
            isGlobal: Boolean(row.is_global),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to fetch content item' });
    }
});
contentRouter.put('/items/:contentId', requireAuth, async (req, res) => {
    const contentId = req.params.contentId;
    const parsedBody = updateLearningContentSchema.safeParse(req.body);
    if (!contentId) {
        return res.status(400).json({ message: 'Invalid content id' });
    }
    if (!parsedBody.success) {
        return res.status(400).json({ message: 'Invalid content payload', errors: parsedBody.error.issues });
    }
    if (!canManageTeacherContent(req)) {
        return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
    }
    const orgId = getOrganizationId(req);
    if (!orgId) {
        return res.status(400).json({ message: 'Organization not found in auth context' });
    }
    const { classLevel, subject, title, isGlobal } = parsedBody.data;
    const sections = normalizeLearningContentSections(parsedBody.data);
    if (sections.length === 0) {
        return res.status(400).json({ message: 'At least one valid section is required' });
    }
    try {
        const existing = await db.query(`SELECT id, is_global
       FROM learning_contents
       WHERE id = $1
         AND (organization_id = $2::uuid OR is_global = true)
       LIMIT 1`, [contentId, orgId]);
        if ((existing.rowCount ?? 0) === 0) {
            return res.status(404).json({ message: 'Content item not found' });
        }
        if (isGlobal !== undefined && !canPublishGlobalResources(req)) {
            return res.status(403).json({ message: 'Forbidden: global publish permission required' });
        }
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            const updated = await client.query(`UPDATE learning_contents lc
         SET class_level = $1::varchar,
             subject_id = (
               SELECT s.id FROM subjects s
                WHERE s.class_level = $1::varchar AND LOWER(s.title) = LOWER($2::varchar)
                  AND (s.organization_id = lc.organization_id OR $8::boolean = true)
                ORDER BY (s.organization_id = lc.organization_id) DESC,
                         s.updated_at DESC NULLS LAST
                LIMIT 1),
             title = $3::varchar,
             content_type = $4::varchar,
             media_url = $5,
             external_url = $6,
             text_content = $7,
             is_global = $8::boolean,
             updated_at = NOW()
         WHERE id = $9::uuid
           AND (organization_id = $10::uuid OR is_global = true)
         RETURNING id, class_level, subject_id,
           (SELECT title FROM subjects WHERE id = lc.subject_id) AS subject,
           title, content_type, media_url, external_url, text_content, created_by, is_global, created_at, updated_at`, [
                classLevel,
                subject,
                title,
                sections.length > 1 ? 'multi_section' : sections[0].contentType,
                sections[0].mediaUrl,
                sections[0].externalUrl,
                sections[0].textContent,
                isGlobal ?? Boolean(existing.rows[0]?.is_global),
                contentId,
                orgId,
            ]);
            await client.query(`DELETE FROM learning_content_sections WHERE content_id = $1`, [contentId]);
            for (let i = 0; i < sections.length; i += 1) {
                const section = sections[i];
                await client.query(`INSERT INTO learning_content_sections (content_id, section_order, title, content_type, media_url, external_url, text_content, quiz_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [contentId, i + 1, section.title?.trim() || null, section.contentType, section.mediaUrl ? toPersistentMediaUrl(section.mediaUrl) : null, section.externalUrl || null, section.textContent || null, section.quizId || null]);
            }
            await client.query('COMMIT');
            const row = updated.rows[0];
            return res.json({
                id: row.id,
                classLevel: row.class_level,
                subject: row.subject,
                title: row.title,
                contentType: row.content_type,
                sectionCount: sections.length,
                mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url) : undefined,
                externalUrl: row.external_url || undefined,
                textContent: row.text_content || undefined,
                createdBy: row.created_by || undefined,
                isGlobal: Boolean(row.is_global),
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            });
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to update content item' });
    }
});
contentRouter.delete('/items/:contentId', requireAuth, async (req, res) => {
    const contentId = req.params.contentId;
    if (!contentId) {
        return res.status(400).json({ message: 'Invalid content id' });
    }
    if (!canManageTeacherContent(req)) {
        return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
    }
    const orgId = getOrganizationId(req);
    if (!orgId) {
        return res.status(400).json({ message: 'Organization not found in auth context' });
    }
    try {
        const result = await db.query(`DELETE FROM learning_contents
       WHERE id = $1
         AND organization_id = $2::uuid`, [contentId, orgId]);
        if ((result.rowCount ?? 0) === 0) {
            return res.status(404).json({ message: 'Content item not found' });
        }
        return res.status(204).send();
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Failed to delete content item' });
    }
});
