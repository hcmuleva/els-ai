import { db } from '../db.js';
export const contentRepository = {
    async findById(contentId, organizationId) {
        const result = await db.query(`SELECT id, title, content_type, content_url, content_text, organization_id,
              is_global, topic_id, sort_order, metadata, created_at, updated_at
       FROM learning_contents
       WHERE id = $1::uuid AND (organization_id = $2::uuid OR is_global = true)
       LIMIT 1`, [contentId, organizationId]);
        return result.rows[0] || null;
    },
    async countForOrganization(organizationId) {
        const result = await db.query(`SELECT COUNT(*)::text AS count FROM learning_contents
       WHERE organization_id = $1::uuid OR is_global = true`, [organizationId]);
        return Number(result.rows[0]?.count || 0);
    },
};
