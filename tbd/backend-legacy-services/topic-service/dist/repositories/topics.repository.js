import { db } from '../db.js';
export const topicsRepository = {
    async findById(topicId, organizationId) {
        const result = await db.query(`SELECT ct.id, ct.title AS name, ct.title AS description, s.title AS subject, ct.class_level, ct.organization_id, ct.is_global, ct.created_at
       FROM content_topics ct
       LEFT JOIN subjects s ON s.id = ct.subject_id
       WHERE ct.id = $1::uuid AND (ct.organization_id = $2::uuid OR ct.is_global = true)
       LIMIT 1`, [topicId, organizationId]);
        return result.rows[0] || null;
    },
    async countForOrganization(organizationId) {
        const result = await db.query(`SELECT COUNT(*)::text AS count FROM content_topics
       WHERE organization_id = $1::uuid OR is_global = true`, [organizationId]);
        return Number(result.rows[0]?.count || 0);
    },
};
