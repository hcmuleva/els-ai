import { db } from '../db.js';
export const assignmentsRepository = {
    async findById(assignmentId) {
        const result = await db.query(`SELECT id, classroom_id, title, instructions, due_at, created_at
       FROM classroom_assignments
       WHERE id = $1::uuid
       LIMIT 1`, [assignmentId]);
        return result.rows[0] || null;
    },
    async countSubmissionsForAssignment(assignmentId) {
        const result = await db.query(`SELECT COUNT(*)::text AS count
       FROM classroom_assignment_submissions
       WHERE classroom_assignment_id = $1::uuid`, [assignmentId]);
        return Number(result.rows[0]?.count || 0);
    },
};
