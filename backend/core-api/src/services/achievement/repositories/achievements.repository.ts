import { db } from '../db.js';

export const achievementsRepository = {
  async listForOrganization(organizationId: string) {
    const result = await db.query(
      `SELECT id, name, description, icon_url, criteria, organization_id, is_global
       FROM achievements
       WHERE organization_id = $1::uuid OR is_global = true
       ORDER BY created_at DESC NULLS LAST
       LIMIT 200`,
      [organizationId],
    );
    return result.rows;
  },

  async countGrantsForStudent(studentId: string) {
    const result = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM student_achievements WHERE student_id = $1::uuid`,
      [studentId],
    );
    return Number(result.rows[0]?.count || 0);
  },
};
