import { db } from '../db.js';

export const questionsRepository = {
  async findById(questionId: string, organizationId: string) {
    const result = await db.query(
      `SELECT id, question_type, question_title, question_data, organization_id, is_global,
              difficulty_level, tags, created_at
       FROM quiz_questions
       WHERE id = $1::uuid AND (organization_id = $2::uuid OR is_global = true)
       LIMIT 1`,
      [questionId, organizationId],
    );
    return result.rows[0] || null;
  },

  async countForOrganization(organizationId: string): Promise<number> {
    const result = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM quiz_questions
       WHERE organization_id = $1::uuid OR is_global = true`,
      [organizationId],
    );
    return Number(result.rows[0]?.count || 0);
  },
};
