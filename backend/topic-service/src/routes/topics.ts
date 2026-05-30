import { Router } from 'express';
import { z } from 'zod';
import {
  AuthenticatedRequest,
  canBypassOwnership,
  canManageTeacherContent,
  canPublishGlobalResources,
  getOrganizationId,
  getUserId,
} from '@els-ai/internal-auth';
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
  .refine(
    (value) => {
      if (value.contentType === 'text') return !!value.textContent?.trim();
      if (value.contentType === 'youtube_url' || value.contentType === 'reel_url') return !!value.externalUrl?.trim();
      return !!value.mediaUrl?.trim();
    },
    { message: 'Missing required field for selected content type' },
  );

const replaceTopicSectionsSchema = z.object({
  sections: z.array(contentSectionSchema).min(1).max(300),
});

const updateTopicAssignmentsSchema = z.object({
  contentIds: z.array(z.string().uuid()).default([]),
});

const updateTopicQuizAssignmentsSchema = z.object({
  quizIds: z.array(z.string().uuid()).default([]),
});

async function ensureTopicEditPermission(
  topicId: string,
  orgId: string,
  userId: string,
  req: AuthenticatedRequest,
): Promise<{ allowed: boolean; exists: boolean }> {
  const result = await db.query(
    `SELECT id, created_by
     FROM content_topics
     WHERE id = $1
       AND organization_id = $2::uuid`,
    [topicId, orgId],
  );
  if ((result.rowCount ?? 0) === 0) {
    return { allowed: false, exists: false };
  }

  const createdBy = result.rows[0].created_by as string | null;
  if (canBypassOwnership(req) || !createdBy || createdBy === userId) {
    return { allowed: true, exists: true };
  }
  return { allowed: false, exists: true };
}

topicsRouter.get('/_meta', requireAuth, async (_req: AuthenticatedRequest, res) => {
  const totals = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM content_topics`,
  );
  res.json({
    service: 'topic-service',
    version: '2.0.0',
    phase: 2,
    description: 'Owns the topic hierarchy + topic ↔ content / quiz / assignment mappings.',
    topicsCount: Number(totals.rows[0]?.count || 0),
  });
});

topicsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
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
  const params: unknown[] = [orgId];
  const whereClauses: string[] = ['(ct.organization_id = $1::uuid OR ct.is_global = true)'];

  if (class_level) {
    params.push(class_level);
    whereClauses.push(`ct.class_level = $${params.length}`);
  }
  if (subject) {
    params.push(subject);
    whereClauses.push(`s.title = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    whereClauses.push(`(ct.title ILIKE $${idx} OR COALESCE(s.title, '') ILIKE $${idx})`);
  }
  params.push(limit);

  try {
    const result = await db.query(
      `SELECT
         ct.id,
         ct.class_level,
         s.title AS subject,
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
       LEFT JOIN subjects s ON s.id = ct.subject_id
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY ct.id, s.title
       ORDER BY ct.class_level ASC, s.title ASC, ct.title ASC
       LIMIT $${params.length}`,
      params,
    );

    const topicRows = await Promise.all(
      result.rows.map(async (row) => {
        const signedCover = row.cover_image ? await getSignedMediaUrlIfNeeded(row.cover_image as string) : null;
        return {
          id: row.id as string,
          classLevel: row.class_level as string,
          subject: row.subject as string,
          title: row.title as string,
          coverImage: (signedCover as string | null) || undefined,
          sectionCount: 0,
          contentCount: Number(row.content_count || 0),
          quizCount: Number(row.quiz_count || 0),
          createdBy: (row.created_by as string | null) || undefined,
          isGlobal: Boolean(row.is_global),
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        };
      }),
    );

    return res.json({ topics: topicRows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch content topics' });
  }
});

topicsRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
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
    const duplicate = await db.query(
      `SELECT 1
       FROM content_topics ct
       LEFT JOIN subjects s ON s.id = ct.subject_id
       WHERE ct.organization_id = $1::uuid
         AND ct.class_level = $2
         AND s.title = $3
         AND LOWER(ct.title) = LOWER($4)
       LIMIT 1`,
      [orgId, classLevel, subject, title],
    );
    if ((duplicate.rowCount ?? 0) > 0) {
      return res.status(400).json({ message: 'Topic already exists for this standard and subject' });
    }

    const result = await db.query(
      `INSERT INTO content_topics (organization_id, class_level, subject_id, title, cover_image, created_by, is_global)
       VALUES (
         $1::uuid, $2::varchar,
         (SELECT s.id FROM subjects s
            WHERE s.class_level = $2::varchar AND LOWER(s.title) = LOWER($3::varchar)
              AND (s.organization_id = $1::uuid OR $7::boolean = true)
            ORDER BY (s.organization_id = $1::uuid) DESC, s.updated_at DESC NULLS LAST
            LIMIT 1),
         $4::varchar, $5, $6::uuid, $7::boolean)
       RETURNING id, class_level, subject_id,
         (SELECT title FROM subjects WHERE id = content_topics.subject_id) AS subject,
         title, cover_image, created_by, is_global, created_at, updated_at`,
      [orgId, classLevel, subject, title, coverImage ? toPersistentMediaUrl(coverImage) : null, userId, isGlobal],
    );
    const row = result.rows[0];
    const signedCover = row.cover_image ? await getSignedMediaUrlIfNeeded(row.cover_image as string) : null;
    return res.status(201).json({
      id: row.id as string,
      classLevel: row.class_level as string,
      subject: row.subject as string,
      title: row.title as string,
      coverImage: (signedCover as string | null) || undefined,
      sectionCount: 0,
      createdBy: (row.created_by as string | null) || undefined,
      isGlobal: Boolean(row.is_global),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to create content topic' });
  }
});

topicsRouter.patch('/:topicId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const topicId = req.params.topicId as string;
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

    const existing = await db.query(
      `SELECT ct.class_level, s.title AS subject, ct.title
       FROM content_topics ct
       LEFT JOIN subjects s ON s.id = ct.subject_id
       WHERE ct.id = $1
         AND ct.organization_id = $2::uuid
       LIMIT 1`,
      [topicId, orgId],
    );
    const existingRow = existing.rows[0];
    const nextClassLevel = parsedBody.data.classLevel ?? (existingRow?.class_level as string);
    const nextSubject = parsedBody.data.subject ?? (existingRow?.subject as string);
    const nextTitle = parsedBody.data.title ?? (existingRow?.title as string);

    const duplicate = await db.query(
      `SELECT 1
       FROM content_topics ct
       LEFT JOIN subjects s ON s.id = ct.subject_id
       WHERE ct.organization_id = $1::uuid
         AND ct.class_level = $2
         AND s.title = $3
         AND LOWER(ct.title) = LOWER($4)
         AND ct.id <> $5
       LIMIT 1`,
      [orgId, nextClassLevel, nextSubject, nextTitle, topicId],
    );
    if ((duplicate.rowCount ?? 0) > 0) {
      return res.status(400).json({ message: 'Topic already exists for this standard and subject' });
    }

    const updates: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    if (parsedBody.data.classLevel !== undefined) {
      params.push(parsedBody.data.classLevel);
      updates.push(`class_level = $${params.length}`);
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
    if (parsedBody.data.subject !== undefined || parsedBody.data.classLevel !== undefined) {
      params.push(nextClassLevel, nextSubject);
      const cl = `$${params.length - 1}`;
      const sj = `$${params.length}`;
      updates.push(
        `subject_id = (
           SELECT s.id FROM subjects s
            WHERE s.class_level = ${cl}::varchar
              AND LOWER(s.title) = LOWER(${sj}::varchar)
              AND (s.organization_id = content_topics.organization_id OR content_topics.is_global = true)
            ORDER BY (s.organization_id = content_topics.organization_id) DESC,
                     s.updated_at DESC NULLS LAST
            LIMIT 1)`,
      );
    }
    params.push(topicId, orgId);

    const result = await db.query(
      `UPDATE content_topics
       SET ${updates.join(', ')}
       WHERE id = $${params.length - 1}
         AND organization_id = $${params.length}::uuid
       RETURNING id, class_level, subject_id,
         (SELECT title FROM subjects WHERE id = content_topics.subject_id) AS subject,
         title, cover_image, created_by, is_global, created_at, updated_at`,
      params,
    );
    const row = result.rows[0];
    const countResult = await db.query(
      `SELECT COUNT(lcs.id)::int AS count
       FROM topic_content_assignments tca
       LEFT JOIN learning_content_sections lcs ON lcs.content_id = tca.content_id
       WHERE tca.topic_id = $1`,
      [topicId],
    );
    const signedCover = row.cover_image ? await getSignedMediaUrlIfNeeded(row.cover_image as string) : null;
    return res.json({
      id: row.id as string,
      classLevel: row.class_level as string,
      subject: row.subject as string,
      title: row.title as string,
      coverImage: (signedCover as string | null) || undefined,
      sectionCount: Number(countResult.rows[0]?.count || 0),
      createdBy: (row.created_by as string | null) || undefined,
      isGlobal: Boolean(row.is_global),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to update content topic' });
  }
});

topicsRouter.delete('/:topicId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const topicId = req.params.topicId as string;
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

    await db.query(
      `DELETE FROM content_topics
       WHERE id = $1
         AND organization_id = $2::uuid`,
      [topicId, orgId],
    );
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to delete content topic' });
  }
});

topicsRouter.get('/:topicId/details', requireAuth, async (req: AuthenticatedRequest, res) => {
  const topicId = req.params.topicId as string;
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
    const topicResult = await db.query(
      `SELECT ct.id, ct.class_level, s.title AS subject, ct.title, ct.cover_image, ct.created_by, ct.created_at, ct.updated_at
       FROM content_topics ct
       LEFT JOIN subjects s ON s.id = ct.subject_id
       WHERE ct.id = $1
         AND (ct.organization_id = $2::uuid OR ct.is_global = true)
       LIMIT 1`,
      [topicId, orgId],
    );
    if ((topicResult.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    const contentItemsResult = await db.query(
      `SELECT
         lc.id,
         lc.class_level,
         s.title AS subject,
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
       LEFT JOIN subjects s ON s.id = lc.subject_id
       WHERE tca.topic_id = $1
       ORDER BY tca.sort_order ASC, tca.created_at ASC`,
      [topicId],
    );

    const topic = topicResult.rows[0];
    const signedCover = topic.cover_image ? await getSignedMediaUrlIfNeeded(topic.cover_image as string) : null;

    const contentIds = contentItemsResult.rows.map((row) => row.id);
    let sectionsRows: any[] = [];
    if (contentIds.length > 0) {
      const sectionsResult = await db.query(
        `SELECT id, content_id, section_order, title, content_type, media_url, external_url, text_content, quiz_id, created_at, updated_at
         FROM learning_content_sections
         WHERE content_id = ANY($1::uuid[])
         ORDER BY content_id, section_order ASC, created_at ASC`,
        [contentIds],
      );
      sectionsRows = sectionsResult.rows;
    }

    const sectionsGroupedByContentId: Record<string, any[]> = {};
    for (const row of sectionsRows) {
      const cId = row.content_id;
      if (!sectionsGroupedByContentId[cId]) {
        sectionsGroupedByContentId[cId] = [];
      }
      sectionsGroupedByContentId[cId].push({
        id: row.id as string,
        sectionOrder: Number(row.section_order || 0),
        title: (row.title as string | null) || undefined,
        contentType: row.content_type as string,
        mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
        externalUrl: (row.external_url as string | null) || undefined,
        textContent: (row.text_content as string | null) || undefined,
        quizId: (row.quiz_id as string | null) || undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      });
    }

    const contentItems = await Promise.all(
      contentItemsResult.rows.map(async (row) => {
        const cId = row.id as string;
        let sections = sectionsGroupedByContentId[cId] || [];
        if (sections.length === 0) {
          sections = [
            {
              id: row.id as string,
              sectionOrder: 1,
              title: undefined,
              contentType: row.content_type as string,
              mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
              externalUrl: (row.external_url as string | null) || undefined,
              textContent: (row.text_content as string | null) || undefined,
              createdAt: row.created_at as string,
              updatedAt: row.updated_at as string,
            },
          ];
        }
        return {
          id: cId,
          classLevel: row.class_level as string,
          subject: row.subject as string,
          title: row.title as string,
          contentType: row.content_type as string,
          sectionCount: sections.length,
          mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
          externalUrl: (row.external_url as string | null) || undefined,
          textContent: (row.text_content as string | null) || undefined,
          sections,
          createdBy: (row.created_by as string | null) || undefined,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        };
      }),
    );

    const flatSections: any[] = [];
    for (const item of contentItems) {
      flatSections.push(...item.sections);
    }

    return res.json({
      topic: {
        id: topic.id as string,
        classLevel: topic.class_level as string,
        subject: topic.subject as string,
        title: topic.title as string,
        coverImage: (signedCover as string | null) || undefined,
        createdBy: (topic.created_by as string | null) || undefined,
        createdAt: topic.created_at as string,
        updatedAt: topic.updated_at as string,
      },
      contentItems,
      sections: flatSections,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch topic details' });
  }
});

topicsRouter.put('/:topicId/sections', requireAuth, async (req: AuthenticatedRequest, res) => {
  const topicId = req.params.topicId as string;
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
      await client.query(
        `INSERT INTO topic_content_sections (topic_id, section_order, title, content_type, media_url, external_url, text_content)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          topicId,
          i + 1,
          section.title?.trim() || null,
          section.contentType,
          section.mediaUrl ? toPersistentMediaUrl(section.mediaUrl) : null,
          section.externalUrl || null,
          section.textContent || null,
        ],
      );
    }
    await client.query('COMMIT');

    const detailsResult = await db.query(
      `SELECT id, section_order, title, content_type, media_url, external_url, text_content, created_at, updated_at
       FROM topic_content_sections
       WHERE topic_id = $1
       ORDER BY section_order ASC`,
      [topicId],
    );
    const resolvedSections = await Promise.all(
      detailsResult.rows.map(async (row) => ({
        id: row.id as string,
        sectionOrder: Number(row.section_order || 0),
        title: (row.title as string | null) || undefined,
        contentType: row.content_type as string,
        mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
        externalUrl: (row.external_url as string | null) || undefined,
        textContent: (row.text_content as string | null) || undefined,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      })),
    );
    return res.json({ sections: resolvedSections });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ message: 'Failed to save content sections' });
  } finally {
    client.release();
  }
});

topicsRouter.get('/:topicId/assignments', requireAuth, async (req: AuthenticatedRequest, res) => {
  const topicId = req.params.topicId as string;
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
    const topicCheck = await db.query(
      `SELECT 1 FROM content_topics WHERE id = $1 AND (organization_id = $2::uuid OR is_global = true) LIMIT 1`,
      [topicId, orgId],
    );
    if ((topicCheck.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: 'Topic not found' });
    }

    const result = await db.query(
      `SELECT content_id
       FROM topic_content_assignments
       WHERE topic_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [topicId],
    );
    return res.json({ contentIds: result.rows.map((row) => row.content_id as string) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch topic assignments' });
  }
});

topicsRouter.put('/:topicId/assignments', requireAuth, async (req: AuthenticatedRequest, res) => {
  const topicId = req.params.topicId as string;
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
    if (!permission.exists) return res.status(404).json({ message: 'Topic not found' });
    if (!permission.allowed) return res.status(403).json({ message: 'Forbidden: not allowed to update this topic' });

    const uniqueIds = [...new Set(parsedBody.data.contentIds)];
    if (uniqueIds.length > 0) {
      const validateResult = await db.query(
        `SELECT COUNT(*)::int AS count
         FROM learning_contents
         WHERE (organization_id = $1::uuid OR is_global = true)
           AND id = ANY($2::uuid[])`,
        [orgId, uniqueIds],
      );
      if (Number(validateResult.rows[0]?.count || 0) !== uniqueIds.length) {
        return res.status(400).json({ message: 'One or more selected content items are invalid' });
      }
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM topic_content_assignments WHERE topic_id = $1`, [topicId]);
      for (let i = 0; i < uniqueIds.length; i += 1) {
        await client.query(
          `INSERT INTO topic_content_assignments (topic_id, content_id, sort_order)
           VALUES ($1, $2, $3)`,
          [topicId, uniqueIds[i], i + 1],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return res.json({ topicId, contentIds: uniqueIds });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to update topic assignments' });
  }
});

topicsRouter.get('/:topicId/quizzes', requireAuth, async (req: AuthenticatedRequest, res) => {
  const topicId = req.params.topicId as string;
  if (!topicId) return res.status(400).json({ message: 'Invalid topic id' });
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  try {
    const result = await db.query(
      `SELECT q.id, q.title, q.quiz_type, q.class_level, s.title AS subject, q.is_published, q.total_questions, q.created_at
       FROM quizzes q
       LEFT JOIN subjects s ON s.id = q.subject_id
       WHERE (q.organization_id = $1::uuid OR q.is_global = true) AND q.topic_id = $2
       ORDER BY q.created_at DESC`,
      [orgId, topicId],
    );
    return res.json({ quizzes: result.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch topic quizzes' });
  }
});

topicsRouter.put('/:topicId/quizzes/:quizId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { topicId, quizId } = req.params;
  if (!topicId || !quizId) return res.status(400).json({ message: 'Invalid topic or quiz id' });
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  try {
    const topicCheck = await db.query(
      `SELECT 1 FROM content_topics WHERE id = $1 AND (organization_id = $2::uuid OR is_global = true) LIMIT 1`,
      [topicId, orgId],
    );
    if ((topicCheck.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Topic not found' });

    const quizCheck = await db.query(
      `SELECT 1 FROM quizzes WHERE id = $1 AND (organization_id = $2::uuid OR is_global = true) LIMIT 1`,
      [quizId, orgId],
    );
    if ((quizCheck.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Quiz not found' });

    await db.query(`UPDATE quizzes SET topic_id = $1, updated_at = NOW() WHERE id = $2`, [topicId, quizId]);
    return res.json({ message: 'Quiz assigned to topic successfully', topicId, quizId });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to assign quiz to topic' });
  }
});

topicsRouter.put('/:topicId/quizzes', requireAuth, async (req: AuthenticatedRequest, res) => {
  const topicId = req.params.topicId as string;
  const parsedBody = updateTopicQuizAssignmentsSchema.safeParse(req.body);
  if (!topicId) return res.status(400).json({ message: 'Invalid topic id' });
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid quiz assignment payload', errors: parsedBody.error.issues });
  }
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  const uniqueQuizIds = [...new Set(parsedBody.data.quizIds)];

  try {
    const topicCheck = await db.query(
      `SELECT 1 FROM content_topics WHERE id = $1 AND (organization_id = $2::uuid OR is_global = true) LIMIT 1`,
      [topicId, orgId],
    );
    if ((topicCheck.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Topic not found' });

    if (uniqueQuizIds.length > 0) {
      const validQuizCount = await db.query(
        `SELECT COUNT(*)::int AS count
         FROM quizzes
         WHERE (organization_id = $1::uuid OR is_global = true)
           AND id = ANY($2::uuid[])`,
        [orgId, uniqueQuizIds],
      );
      if (Number(validQuizCount.rows[0]?.count || 0) !== uniqueQuizIds.length) {
        return res.status(400).json({ message: 'One or more quizzes are invalid' });
      }
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      if (uniqueQuizIds.length > 0) {
        await client.query(
          `UPDATE quizzes
           SET topic_id = NULL, updated_at = NOW()
           WHERE (organization_id = $1::uuid OR is_global = true)
             AND topic_id = $2
             AND NOT (id = ANY($3::uuid[]))`,
          [orgId, topicId, uniqueQuizIds],
        );
        await client.query(
          `UPDATE quizzes
           SET topic_id = $1, updated_at = NOW()
           WHERE (organization_id = $2::uuid OR is_global = true)
             AND id = ANY($3::uuid[])`,
          [topicId, orgId, uniqueQuizIds],
        );
      } else {
        await client.query(
          `UPDATE quizzes
           SET topic_id = NULL, updated_at = NOW()
           WHERE (organization_id = $1::uuid OR is_global = true)
             AND topic_id = $2`,
          [orgId, topicId],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return res.json({ topicId, quizIds: uniqueQuizIds });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to update topic quiz assignments' });
  }
});

topicsRouter.delete('/:topicId/quizzes/:quizId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { quizId } = req.params;
  if (!quizId) return res.status(400).json({ message: 'Invalid quiz id' });
  if (!canManageTeacherContent(req)) return res.status(403).json({ message: 'Forbidden' });
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  try {
    await db.query(
      `UPDATE quizzes SET topic_id = NULL, updated_at = NOW() WHERE id = $1 AND (organization_id = $2::uuid OR is_global = true)`,
      [quizId, orgId],
    );
    return res.json({ message: 'Quiz unassigned from topic successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to unassign quiz from topic' });
  }
});

catalogRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const orgId = getOrganizationId(req);
  if (!orgId) return res.status(400).json({ message: 'Organization not found in auth context' });

  // Optional class_level filter: pickers can request only the subjects that
  // exist for the currently-selected class so a teacher selecting "LKG" never
  // sees a class-3 subject they can't actually use.
  const classLevelFilter = String(req.query.class_level ?? req.query.classLevel ?? '').trim();
  const params: any[] = [orgId];
  let whereClause = `organization_id = $1::uuid`;
  if (classLevelFilter) {
    params.push(classLevelFilter);
    whereClause += ` AND class_level = $${params.length}`;
  }

  try {
    const result = await db.query(
      `SELECT id, class_level, title, cover_image, icon_image, icon_bg_color
       FROM subjects
       WHERE ${whereClause}
       ORDER BY class_level ASC, title ASC`,
      params,
    );
    const items = await Promise.all(
      result.rows.map(async (row: any) => ({
        id: row.id as string,
        classLevel: row.class_level as string,
        // back-compat: existing planner/quiz callers read `class_level` and `subject`
        class_level: row.class_level as string,
        title: row.title as string,
        subject: row.title as string,
        coverImage: row.cover_image ? await getSignedMediaUrlIfNeeded(row.cover_image as string) : undefined,
        iconImage: row.icon_image ? await getSignedMediaUrlIfNeeded(row.icon_image as string) : undefined,
        iconBgColor: (row.icon_bg_color as string | null) || undefined,
      })),
    );
    const classLevels = [...new Set(items.map((r) => r.classLevel))];
    const subjects = [...new Set(items.map((r) => r.title))];
    return res.json({ classLevels, subjects, items });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch subject catalog' });
  }
});

studentsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const orgId = getOrganizationId(req);
  const userId = getUserId(req);
  if (!orgId || !userId) return res.status(400).json({ message: 'Organization/user not found' });

  try {
    const userRow = await db.query(
      `SELECT class_level FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const classLevel = userRow.rows[0]?.class_level as string | null;
    if (!classLevel) return res.json({ subjects: [], classLevel: null });

    const result = await db.query(
      `SELECT
         ct.id, ct.class_level, s.title AS subject, ct.title, ct.cover_image,
         ct.created_at, ct.updated_at,
         COUNT(DISTINCT tca.content_id) AS content_count
       FROM content_topics ct
       LEFT JOIN subjects s ON s.id = ct.subject_id
       LEFT JOIN topic_content_assignments tca ON tca.topic_id = ct.id
       WHERE (ct.organization_id = $1::uuid OR ct.is_global = true)
         AND ct.class_level = $2
       GROUP BY ct.id, s.title
       ORDER BY s.title, ct.title`,
      [orgId, classLevel],
    );

    const distinctSubjectTitles = Array.from(
      new Set(
        result.rows
          .map((row) => String(row.subject ?? '').trim())
          .filter((title) => title.length > 0),
      ),
    );

    const subjectsMeta = new Map<string, {
      coverImage: string | null;
      icon: string | null;
      iconBgColor: string | null;
    }>();

    if (distinctSubjectTitles.length > 0) {
      // Look up subject metadata by class_level + title across orgs.
      // Prefer the user's own organization; fall back to any other org so global
      // topics whose matching `subjects` row lives in a different org (e.g. the
      // seed/system org) still get cover_image / icon / icon_bg_color.
      const subjectsMetaResult = await db.query(
        `SELECT title, cover_image, icon_image, icon_bg_color, organization_id, updated_at
         FROM subjects
         WHERE class_level = $1
           AND LOWER(title) = ANY($2::text[])
         ORDER BY
           CASE WHEN organization_id = $3::uuid THEN 0 ELSE 1 END,
           updated_at DESC NULLS LAST`,
        [classLevel, distinctSubjectTitles.map((t) => t.toLowerCase()), orgId],
      );
      for (const row of subjectsMetaResult.rows) {
        const key = String(row.title ?? '').trim().toLowerCase();
        if (!key || subjectsMeta.has(key)) continue; // first match wins (user-org first)
        const signedCover = row.cover_image
          ? await getSignedMediaUrlIfNeeded(row.cover_image as string)
          : null;
        subjectsMeta.set(key, {
          coverImage: signedCover,
          icon: (row.icon_image as string | null) || null,
          iconBgColor: (row.icon_bg_color as string | null) || null,
        });
      }
    }

    type SubjectGroup = {
      subject: string;
      coverImage: string | null;
      icon: string | null;
      iconBgColor: string | null;
      topics: unknown[];
    };
    const subjectMap: Record<string, SubjectGroup> = {};
    for (const row of result.rows) {
      const sub = row.subject as string;
      if (!subjectMap[sub]) {
        const meta = subjectsMeta.get(sub.trim().toLowerCase());
        subjectMap[sub] = {
          subject: sub,
          coverImage: meta?.coverImage ?? null,
          icon: meta?.icon ?? null,
          iconBgColor: meta?.iconBgColor ?? null,
          topics: [],
        };
      }
      subjectMap[sub].topics.push({
        id: row.id as string,
        classLevel: row.class_level as string,
        subject: sub,
        title: row.title as string,
        coverImage: row.cover_image ? await getSignedMediaUrlIfNeeded(row.cover_image as string) : null,
        contentCount: Number(row.content_count || 0),
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      });
    }

    return res.json({
      classLevel,
      subjects: Object.values(subjectMap),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to fetch subjects' });
  }
});

studentsRouter.get('/:topicId', requireAuth, async (req: AuthenticatedRequest, res) => {
  const orgId = getOrganizationId(req);
  const topicId = req.params.topicId as string;
  if (!orgId || !topicId) return res.status(400).json({ message: 'Invalid params' });

  try {
    const topicRow = await db.query(
      `SELECT ct.id, ct.class_level,
              (SELECT title FROM subjects WHERE id = ct.subject_id) AS subject,
              ct.title, ct.cover_image
         FROM content_topics ct
        WHERE ct.id = $1 AND (ct.organization_id = $2::uuid OR ct.is_global = true)
        LIMIT 1`,
      [topicId, orgId],
    );
    if ((topicRow.rowCount ?? 0) === 0) return res.status(404).json({ message: 'Topic not found' });
    const topic = topicRow.rows[0];

    const contentResult = await db.query(
      `SELECT lc.id, lc.title, lc.content_type, lc.media_url, lc.external_url, lc.text_content, tca.sort_order
       FROM topic_content_assignments tca
       INNER JOIN learning_contents lc ON lc.id = tca.content_id
       WHERE tca.topic_id = $1
       ORDER BY tca.sort_order ASC, tca.created_at ASC`,
      [topicId],
    );

    const contentIds = contentResult.rows.map((row) => row.id as string);
    const sectionsByContentId: Record<string, any[]> = {};
    if (contentIds.length > 0) {
      const sectionsResult = await db.query(
        `SELECT content_id, section_order, title, content_type, media_url, external_url, text_content, quiz_id
         FROM learning_content_sections
         WHERE content_id = ANY($1::uuid[])
         ORDER BY content_id, section_order ASC, created_at ASC`,
        [contentIds],
      );
      for (const row of sectionsResult.rows) {
        const cId = row.content_id as string;
        if (!sectionsByContentId[cId]) sectionsByContentId[cId] = [];
        sectionsByContentId[cId].push(row);
      }
    }

    // Flatten content items into individual single-type lessons so the student
    // carousel can render each section (text, video, activity) on its own.
    const contents: any[] = [];
    for (const row of contentResult.rows) {
      const cId = row.id as string;
      const sections = sectionsByContentId[cId] || [];
      if (sections.length > 0) {
        for (let i = 0; i < sections.length; i += 1) {
          const sec = sections[i];
          contents.push({
            id: `${cId}:${sec.section_order ?? i + 1}`,
            title: (sec.title as string | null) || (row.title as string),
            contentType: sec.content_type as string,
            mediaUrl: sec.media_url ? await getSignedMediaUrlIfNeeded(sec.media_url as string) : undefined,
            externalUrl: (sec.external_url as string | null) || undefined,
            textContent: (sec.text_content as string | null) || undefined,
            quizId: (sec.quiz_id as string | null) || undefined,
            sortOrder: Number(row.sort_order || 0) * 1000 + Number(sec.section_order || i + 1),
          });
        }
      } else {
        contents.push({
          id: cId,
          title: row.title as string,
          contentType: row.content_type as string,
          mediaUrl: row.media_url ? await getSignedMediaUrlIfNeeded(row.media_url as string) : undefined,
          externalUrl: (row.external_url as string | null) || undefined,
          textContent: (row.text_content as string | null) || undefined,
          quizId: undefined,
          sortOrder: Number(row.sort_order || 0),
        });
      }
    }

    return res.json({
      topic: {
        id: topic.id as string,
        classLevel: topic.class_level as string,
        subject: topic.subject as string,
        title: topic.title as string,
        coverImage: topic.cover_image ? await getSignedMediaUrlIfNeeded(topic.cover_image as string) : null,
      },
      contents,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Failed to fetch topic detail' });
  }
});
