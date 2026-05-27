import { db } from '../db.js';
export const achievementsRepository = {
    async listForOrganization(organizationId) {
        const result = await db.query(`SELECT id, name, description, icon_url, criteria, organization_id, is_global
       FROM achievements
       WHERE organization_id = $1::uuid OR is_global = true
       ORDER BY created_at DESC NULLS LAST
       LIMIT 200`, [organizationId]);
        return result.rows;
    },
    async countGrantsForStudent(studentId) {
        const result = await db.query(`SELECT COUNT(*)::text AS count FROM student_achievements WHERE student_id = $1::uuid`, [studentId]);
        return Number(result.rows[0]?.count || 0);
    },
};
