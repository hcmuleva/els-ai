import { db } from '../db.js';
export const classroomsRepository = {
    async findById(classroomId, organizationId) {
        const result = await db.query(`SELECT id, title, description, schedule_type, start_time, duration_minutes,
              class_level, status, is_global, created_by, created_at, updated_at, organization_id
       FROM classrooms
       WHERE id = $1::uuid AND organization_id = $2::uuid
       LIMIT 1`, [classroomId, organizationId]);
        return result.rows[0] || null;
    },
    async countActive(organizationId) {
        const result = await db.query(`SELECT COUNT(*)::text AS count FROM classrooms
       WHERE organization_id = $1::uuid AND status = 'active'`, [organizationId]);
        return Number(result.rows[0]?.count || 0);
    },
    async markEnded(classroomId, organizationId) {
        const result = await db.query(`UPDATE classrooms
       SET status = 'completed', ended_at = NOW(), updated_at = NOW()
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING id, status, ended_at`, [classroomId, organizationId]);
        return result.rows[0] || null;
    },
};
