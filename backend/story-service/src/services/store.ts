import { db } from '../db.js';

export type StoryRow = {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  class_level: string | null;
  scheduled_at: string | null;
  ended_at: string | null;
  status: 'draft' | 'scheduled' | 'live' | 'ended';
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type SectionRow = {
  id: string;
  story_id: string;
  title: string;
  body_text: string | null;
  media: Array<{ kind: 'image' | 'video' | 'audio'; url: string; caption?: string }>;
  quiz_id: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export function toStoryDto(row: StoryRow, extras?: { sectionCount?: number }) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    description: row.description || '',
    coverImageUrl: row.cover_image_url || null,
    classLevel: row.class_level || null,
    scheduledAt: row.scheduled_at,
    endedAt: row.ended_at,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sectionCount: extras?.sectionCount ?? undefined,
  };
}

export function toSectionDto(row: SectionRow) {
  return {
    id: row.id,
    storyId: row.story_id,
    title: row.title,
    bodyText: row.body_text || '',
    media: row.media || [],
    quizId: row.quiz_id,
    orderIndex: row.order_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const StoryStore = {
  async listForOrg(orgId: string, filters: { status?: string; classLevel?: string; limit?: number; offset?: number }) {
    const where = ['organization_id = $1::uuid'];
    const params: any[] = [orgId];
    if (filters.status) { params.push(filters.status); where.push(`status = $${params.length}`); }
    if (filters.classLevel) { params.push(filters.classLevel); where.push(`class_level = $${params.length}`); }
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    params.push(limit); params.push(offset);
    const result = await db.query<StoryRow & { section_count: string; total_count: string }>(
      `SELECT s.*,
              COALESCE((SELECT COUNT(*) FROM story_sections WHERE story_id = s.id), 0)::text AS section_count,
              COUNT(*) OVER ()::text AS total_count
         FROM stories s
        WHERE ${where.join(' AND ')}
        ORDER BY
          CASE status WHEN 'live' THEN 1 WHEN 'scheduled' THEN 2 WHEN 'draft' THEN 3 ELSE 4 END,
          COALESCE(ended_at, scheduled_at, updated_at) DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const total = result.rows[0] ? Number(result.rows[0].total_count) : 0;
    return { items: result.rows.map((r) => toStoryDto(r, { sectionCount: Number(r.section_count) })), total };
  },

  async getById(orgId: string, storyId: string) {
    const result = await db.query<StoryRow>(
      `SELECT * FROM stories WHERE id = $1::uuid AND organization_id = $2::uuid LIMIT 1`,
      [storyId, orgId],
    );
    return result.rows[0] || null;
  },

  async create(input: {
    orgId: string; userId: string; title: string; description?: string | null;
    coverImageUrl?: string | null; classLevel?: string | null;
  }) {
    const result = await db.query<StoryRow>(
      `INSERT INTO stories (organization_id, title, description, cover_image_url, class_level, status, created_by)
       VALUES ($1::uuid, $2, $3, $4, $5, 'draft', $6::uuid) RETURNING *`,
      [input.orgId, input.title, input.description ?? null, input.coverImageUrl ?? null, input.classLevel ?? null, input.userId],
    );
    return result.rows[0];
  },

  async update(orgId: string, storyId: string, patch: Partial<{
    title: string; description: string | null; coverImageUrl: string | null; classLevel: string | null;
    scheduledAt: string | null; status: 'draft' | 'scheduled' | 'live' | 'ended'; endedAt: string | null;
  }>) {
    const sets: string[] = []; const params: any[] = [];
    const push = (col: string, val: any) => { params.push(val); sets.push(`${col} = $${params.length}`); };
    if (patch.title !== undefined) push('title', patch.title);
    if (patch.description !== undefined) push('description', patch.description);
    if (patch.coverImageUrl !== undefined) push('cover_image_url', patch.coverImageUrl);
    if (patch.classLevel !== undefined) push('class_level', patch.classLevel);
    if (patch.scheduledAt !== undefined) push('scheduled_at', patch.scheduledAt ? new Date(patch.scheduledAt) : null);
    if (patch.status !== undefined) push('status', patch.status);
    if (patch.endedAt !== undefined) push('ended_at', patch.endedAt ? new Date(patch.endedAt) : null);
    if (sets.length === 0) return this.getById(orgId, storyId);
    sets.push(`updated_at = NOW()`);
    params.push(storyId); params.push(orgId);
    const result = await db.query<StoryRow>(
      `UPDATE stories SET ${sets.join(', ')}
         WHERE id = $${params.length - 1}::uuid AND organization_id = $${params.length}::uuid
       RETURNING *`,
      params,
    );
    return result.rows[0] || null;
  },

  async delete(orgId: string, storyId: string) {
    const result = await db.query(
      `DELETE FROM stories WHERE id = $1::uuid AND organization_id = $2::uuid`,
      [storyId, orgId],
    );
    return (result.rowCount ?? 0) > 0;
  },

  async listSections(storyId: string) {
    const result = await db.query<SectionRow>(
      `SELECT * FROM story_sections WHERE story_id = $1::uuid ORDER BY order_index ASC, created_at ASC`,
      [storyId],
    );
    return result.rows.map(toSectionDto);
  },

  async createSection(storyId: string, input: {
    title: string; bodyText?: string | null; media?: any[]; quizId?: string | null; orderIndex?: number;
  }) {
    const orderResult = await db.query<{ max_order: number | null }>(
      `SELECT MAX(order_index) AS max_order FROM story_sections WHERE story_id = $1::uuid`,
      [storyId],
    );
    const nextOrder = input.orderIndex ?? Number(orderResult.rows[0]?.max_order ?? -1) + 1;
    const result = await db.query<SectionRow>(
      `INSERT INTO story_sections (story_id, title, body_text, media, quiz_id, order_index)
       VALUES ($1::uuid, $2, $3, $4::jsonb, $5, $6) RETURNING *`,
      [storyId, input.title, input.bodyText ?? null, JSON.stringify(input.media || []), input.quizId ?? null, nextOrder],
    );
    return toSectionDto(result.rows[0]);
  },

  async updateSection(sectionId: string, storyId: string, patch: Partial<{
    title: string; bodyText: string | null; media: any[]; quizId: string | null; orderIndex: number;
  }>) {
    const sets: string[] = []; const params: any[] = [];
    const push = (col: string, val: any) => { params.push(val); sets.push(`${col} = $${params.length}`); };
    if (patch.title !== undefined) push('title', patch.title);
    if (patch.bodyText !== undefined) push('body_text', patch.bodyText);
    if (patch.media !== undefined) { params.push(JSON.stringify(patch.media)); sets.push(`media = $${params.length}::jsonb`); }
    if (patch.quizId !== undefined) push('quiz_id', patch.quizId);
    if (patch.orderIndex !== undefined) push('order_index', patch.orderIndex);
    if (sets.length === 0) return null;
    sets.push(`updated_at = NOW()`);
    params.push(sectionId); params.push(storyId);
    const result = await db.query<SectionRow>(
      `UPDATE story_sections SET ${sets.join(', ')}
         WHERE id = $${params.length - 1}::uuid AND story_id = $${params.length}::uuid
       RETURNING *`,
      params,
    );
    return result.rows[0] ? toSectionDto(result.rows[0]) : null;
  },

  async deleteSection(sectionId: string, storyId: string) {
    const result = await db.query(
      `DELETE FROM story_sections WHERE id = $1::uuid AND story_id = $2::uuid`,
      [sectionId, storyId],
    );
    return (result.rowCount ?? 0) > 0;
  },

  async getProgress(userId: string, storyId: string) {
    const result = await db.query(
      `SELECT * FROM story_progress WHERE user_id = $1::uuid AND story_id = $2::uuid LIMIT 1`,
      [userId, storyId],
    );
    return result.rows[0] || null;
  },

  async upsertProgress(userId: string, storyId: string, input: {
    currentSectionId?: string | null; completedSectionIds?: string[]; completed?: boolean;
  }) {
    const result = await db.query(
      `INSERT INTO story_progress (user_id, story_id, current_section_id, completed_section_ids, completed_at, last_active_at)
       VALUES ($1::uuid, $2::uuid, $3, $4::uuid[], $5, NOW())
       ON CONFLICT (user_id, story_id) DO UPDATE SET
         current_section_id = COALESCE(EXCLUDED.current_section_id, story_progress.current_section_id),
         completed_section_ids = EXCLUDED.completed_section_ids,
         completed_at = EXCLUDED.completed_at,
         last_active_at = NOW()
       RETURNING *`,
      [
        userId, storyId,
        input.currentSectionId ?? null,
        input.completedSectionIds ?? [],
        input.completed ? new Date() : null,
      ],
    );
    return result.rows[0];
  },

  async findDueScheduled() {
    const result = await db.query<StoryRow>(
      `SELECT * FROM stories WHERE status = 'scheduled' AND scheduled_at <= NOW()`,
    );
    return result.rows;
  },
};
