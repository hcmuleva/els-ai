import { db } from '../db.js';
export const quizzesRepository = {
    async findById(quizId, organizationId) {
        const result = await db.query(`SELECT id, title, description, organization_id, created_by, is_published, topic_id
       FROM quizzes
       WHERE id = $1::uuid
         AND (organization_id = $2::uuid OR is_global = true)
       LIMIT 1`, [quizId, organizationId]);
        return result.rows[0] || null;
    },
    async countAttempts(quizId) {
        const result = await db.query(`SELECT COUNT(*)::int AS attempts FROM student_attempts WHERE quiz_id = $1::uuid`, [quizId]);
        return Number(result.rows[0]?.attempts || 0);
    },
};
