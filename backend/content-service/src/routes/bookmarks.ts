import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.js';

export const bookmarksRouter = Router();

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

const bookmarkItemSchema = z
  .object({
    itemType: z.enum(['content', 'quiz']),
    contentId: z.string().uuid().optional().nullable(),
    quizId: z.string().uuid().optional().nullable(),
    subjectId: z.string().uuid().optional().nullable(),
    topicId: z.string().uuid().optional().nullable(),
    classLevel: z.string().trim().max(50).optional().nullable(),
  })
  .refine((value) => (value.itemType === 'content' ? !!value.contentId : !!value.quizId), {
    message: 'Missing resource id for selected item type',
  });

const upsertBookmarkSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).optional().nullable(),
  classLevel: z.string().trim().max(50).optional().nullable(),
  items: z.array(bookmarkItemSchema).max(500).default([]),
});

const listBookmarkQuerySchema = z.object({
  search: z.string().trim().optional(),
  class_level: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  type: z.enum(['content', 'quiz']).optional(),
});

bookmarksRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsedQuery = listBookmarkQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ message: 'Invalid bookmark filters', errors: parsedQuery.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  const teacherId = getUserId(req);
  if (!orgId || !teacherId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const { search, class_level, subject, type } = parsedQuery.data;
  const params: unknown[] = [orgId, teacherId];
  const whereClauses: string[] = ['b.organization_id = $1::uuid', 'b.teacher_user_id = $2::uuid'];

  if (search) {
    params.push(`%${search}%`);
    const idx = params.length;
    whereClauses.push(`(b.name ILIKE $${idx} OR COALESCE(b.description, '') ILIKE $${idx})`);
  }
  if (class_level) {
    params.push(class_level);
    whereClauses.push(`b.class_level = $${params.length}`);
  }
  if (type) {
    params.push(type);
    whereClauses.push(
      `EXISTS (SELECT 1 FROM teacher_bookmark_items ti WHERE ti.bookmark_id = b.id AND ti.item_type = $${params.length})`,
    );
  }
  if (subject) {
    params.push(subject);
    whereClauses.push(
      `EXISTS (
        SELECT 1 FROM teacher_bookmark_items ti
        JOIN subjects ts ON ts.id = ti.subject_id
        WHERE ti.bookmark_id = b.id AND ts.title = $${params.length}
      )`,
    );
  }

  try {
    const result = await db.query(
      `SELECT
         b.id,
         b.name,
         b.description,
         b.class_level,
         b.created_at,
         b.updated_at,
         u.first_name AS teacher_first_name,
         u.last_name AS teacher_last_name,
         COALESCE(COUNT(i.id), 0)::int AS item_count,
         COALESCE(COUNT(i.id) FILTER (WHERE i.item_type = 'content'), 0)::int AS content_count,
         COALESCE(COUNT(i.id) FILTER (WHERE i.item_type = 'quiz'), 0)::int AS quiz_count,
         COALESCE(jsonb_agg(DISTINCT s.title) FILTER (WHERE s.title IS NOT NULL), '[]'::jsonb) AS subjects
       FROM teacher_bookmarks b
       LEFT JOIN users u ON u.id = b.teacher_user_id
       LEFT JOIN teacher_bookmark_items i ON i.bookmark_id = b.id
       LEFT JOIN subjects s ON s.id = i.subject_id
       WHERE ${whereClauses.join(' AND ')}
       GROUP BY b.id, u.first_name, u.last_name
       ORDER BY b.updated_at DESC`,
      params,
    );

    return res.json({
      bookmarks: result.rows.map((row) => ({
        id: row.id as string,
        name: row.name as string,
        description: (row.description as string | null) || undefined,
        classLevel: (row.class_level as string | null) || undefined,
        teacherName: `${row.teacher_first_name || ''} ${row.teacher_last_name || ''}`.trim() || undefined,
        itemCount: Number(row.item_count || 0),
        contentCount: Number(row.content_count || 0),
        quizCount: Number(row.quiz_count || 0),
        subjects: (row.subjects as string[]) || [],
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to list bookmarks' });
  }
});

bookmarksRouter.get('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const bookmarkId = req.params.id as string;
  if (!bookmarkId) return res.status(400).json({ message: 'Invalid bookmark id' });
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  const teacherId = getUserId(req);
  if (!orgId || !teacherId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  try {
    const bookmarkResult = await db.query(
      `SELECT id, name, description, class_level, created_at, updated_at
       FROM teacher_bookmarks
       WHERE id = $1::uuid AND organization_id = $2::uuid AND teacher_user_id = $3::uuid`,
      [bookmarkId, orgId, teacherId],
    );
    if (bookmarkResult.rowCount === 0) {
      return res.status(404).json({ message: 'Bookmark not found' });
    }
    const bookmark = bookmarkResult.rows[0];

    const itemsResult = await db.query(
      `SELECT
         i.id,
         i.item_type,
         i.content_id,
         i.quiz_id,
         i.subject_id,
         i.topic_id,
         i.class_level,
         i.sort_order,
         s.title AS subject_title,
         ct.title AS topic_title,
         lc.title AS content_title,
         lc.content_type AS content_type,
         q.title AS quiz_title,
         q.quiz_type AS quiz_type,
         q.total_questions AS total_questions
       FROM teacher_bookmark_items i
       LEFT JOIN subjects s ON s.id = i.subject_id
       LEFT JOIN content_topics ct ON ct.id = i.topic_id
       LEFT JOIN learning_contents lc ON lc.id = i.content_id
       LEFT JOIN quizzes q ON q.id = i.quiz_id
       WHERE i.bookmark_id = $1::uuid
       ORDER BY i.sort_order ASC, i.created_at ASC`,
      [bookmarkId],
    );

    return res.json({
      bookmark: {
        id: bookmark.id as string,
        name: bookmark.name as string,
        description: (bookmark.description as string | null) || undefined,
        classLevel: (bookmark.class_level as string | null) || undefined,
        createdAt: bookmark.created_at as string,
        updatedAt: bookmark.updated_at as string,
        items: itemsResult.rows.map((row) => ({
          id: row.id as string,
          itemType: row.item_type as 'content' | 'quiz',
          contentId: (row.content_id as string | null) || undefined,
          quizId: (row.quiz_id as string | null) || undefined,
          subjectId: (row.subject_id as string | null) || undefined,
          topicId: (row.topic_id as string | null) || undefined,
          classLevel: (row.class_level as string | null) || undefined,
          subject: (row.subject_title as string | null) || undefined,
          topicTitle: (row.topic_title as string | null) || undefined,
          title: (row.item_type === 'content' ? row.content_title : row.quiz_title) as string,
          contentType: (row.content_type as string | null) || undefined,
          quizType: (row.quiz_type as string | null) || undefined,
          totalQuestions: row.total_questions != null ? Number(row.total_questions) : undefined,
        })),
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to fetch bookmark' });
  }
});

async function replaceBookmarkItems(
  client: any,
  bookmarkId: string,
  items: z.infer<typeof bookmarkItemSchema>[],
) {
  await client.query('DELETE FROM teacher_bookmark_items WHERE bookmark_id = $1::uuid', [bookmarkId]);
  let sortOrder = 0;
  for (const item of items) {
    await client.query(
      `INSERT INTO teacher_bookmark_items
         (bookmark_id, item_type, content_id, quiz_id, subject_id, topic_id, class_level, sort_order)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT DO NOTHING`,
      [
        bookmarkId,
        item.itemType,
        item.itemType === 'content' ? item.contentId : null,
        item.itemType === 'quiz' ? item.quizId : null,
        item.subjectId || null,
        item.topicId || null,
        item.classLevel || null,
        sortOrder,
      ],
    );
    sortOrder += 1;
  }
}

bookmarksRouter.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  const parsedBody = upsertBookmarkSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid bookmark payload', errors: parsedBody.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  const teacherId = getUserId(req);
  if (!orgId || !teacherId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const { name, description, classLevel, items } = parsedBody.data;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO teacher_bookmarks (organization_id, teacher_user_id, name, description, class_level)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5)
       RETURNING id`,
      [orgId, teacherId, name, description || null, classLevel || null],
    );
    const bookmarkId = inserted.rows[0].id as string;
    await replaceBookmarkItems(client, bookmarkId, items);
    await client.query('COMMIT');
    return res.status(201).json({ id: bookmarkId });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error(error);
    return res.status(500).json({ message: 'Failed to create bookmark' });
  } finally {
    client.release();
  }
});

bookmarksRouter.put('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const bookmarkId = req.params.id as string;
  const parsedBody = upsertBookmarkSchema.safeParse(req.body);
  if (!bookmarkId) return res.status(400).json({ message: 'Invalid bookmark id' });
  if (!parsedBody.success) {
    return res.status(400).json({ message: 'Invalid bookmark payload', errors: parsedBody.error.issues });
  }
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  const teacherId = getUserId(req);
  if (!orgId || !teacherId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  const { name, description, classLevel, items } = parsedBody.data;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const owned = await client.query(
      `SELECT 1 FROM teacher_bookmarks
       WHERE id = $1::uuid AND organization_id = $2::uuid AND teacher_user_id = $3::uuid`,
      [bookmarkId, orgId, teacherId],
    );
    if (owned.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Bookmark not found' });
    }
    await client.query(
      `UPDATE teacher_bookmarks
       SET name = $1, description = $2, class_level = $3, updated_at = NOW()
       WHERE id = $4::uuid`,
      [name, description || null, classLevel || null, bookmarkId],
    );
    await replaceBookmarkItems(client, bookmarkId, items);
    await client.query('COMMIT');
    return res.json({ id: bookmarkId });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    console.error(error);
    return res.status(500).json({ message: 'Failed to update bookmark' });
  } finally {
    client.release();
  }
});

bookmarksRouter.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const bookmarkId = req.params.id as string;
  if (!bookmarkId) return res.status(400).json({ message: 'Invalid bookmark id' });
  if (!canManageTeacherContent(req)) {
    return res.status(403).json({ message: 'Forbidden: teacher/admin role required' });
  }
  const orgId = getOrganizationId(req);
  const teacherId = getUserId(req);
  if (!orgId || !teacherId) {
    return res.status(400).json({ message: 'Organization not found in auth context' });
  }

  try {
    const deleted = await db.query(
      `DELETE FROM teacher_bookmarks
       WHERE id = $1::uuid AND organization_id = $2::uuid AND teacher_user_id = $3::uuid
       RETURNING id`,
      [bookmarkId, orgId, teacherId],
    );
    if (deleted.rowCount === 0) {
      return res.status(404).json({ message: 'Bookmark not found' });
    }
    return res.json({ id: bookmarkId });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to delete bookmark' });
  }
});
