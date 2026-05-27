import { db } from '../db.js';
export const topicsRepository = {
    async findById(topicId, organizationId) {
        const result = await db.query(`SELECT id, name, description, subject, class_level, organization_id, is_global, created_at
       FROM content_topics
       WHERE id = $1::uuid AND (organization_id = $2::uuid OR is_global = true)
       LIMIT 1`, [topicId, organizationId]);
        return result.rows[0] || null;
    },
    async countForOrganization(organizationId) {
        const result = await db.query(`SELECT COUNT(*)::text AS count FROM content_topics
       WHERE organization_id = $1::uuid OR is_global = true`, [organizationId]);
        return Number(result.rows[0]?.count || 0);
    },
};
